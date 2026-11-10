"""Acquire no data: qualify the supplied USDA workbooks and export a retrospective replay.

Usage: python scripts/lirf-adapter.py /path/to/usda
The compiled dataset is deliberately NOT a national crop profile.
"""
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
from statistics import mean
import openpyxl
import gzip
import json
import sys
import hashlib

src = Path(sys.argv[1])
out = Path('research-data/lirf/2026-11-10')
out.mkdir(parents=True, exist_ok=True)
w = openpyxl.load_workbook(src/'LIRF_2012_2013.xlsx', read_only=True, data_only=True)
num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
annual = []
for r in list(w['Annual data by plot'].values)[2:]:
    if num(r[0]):
        annual.append(dict(zip(['year','plot','treatmentCode','treatment','harvestIndex','biomassKgHa','maxLai','plantsHa','grainKgHa','etMm'], [v if num(v) or isinstance(v,str) and v!='.' else None for v in r[:10]])))
daily = defaultdict(list)
for r in list(w['Water Balance ET'].values)[2:]:
    if num(r[0]): daily[(r[0],r[3])].append(r)
weather = defaultdict(list)
negative_solar = 0
for r in list(w['Weather data'].values)[1:]:
    if not isinstance(r[2],datetime): continue
    # Local MST, hour-ending observations; midnight belongs to previous day.
    day=(r[2]-timedelta(microseconds=1)).date().isoformat()
    if num(r[6]) and r[6]<0: negative_solar+=1
    weather[day].append(r)
met={}
for day,rs in weather.items():
    if len(rs)!=24 or not all(num(r[i]) for r in rs for i in [3,6,18]): continue
    met[day]={'date':day,'temperatureMeanC':mean(r[3] for r in rs),'temperatureMinC':min(r[3] for r in rs),'temperatureMaxC':max(r[3] for r in rs),'radiationMj':sum(max(0,r[6])*60/1000 for r in rs),'et0Mm':max(0,sum(r[18] for r in rs))}
fc=defaultdict(list)
for r in list(w['Soil Field Capacity'].values)[2:]:
    if num(r[0]) and num(r[3]): fc[(r[0],r[1])].append(r[3]/100)
cover=defaultdict(list)
for r in list(w['Canopy Cover by Plot'].values)[2:]:
    if num(r[0]) and num(r[6]):cover[(r[0],r[3])].append({'date':r[2].date().isoformat(),'plot':r[5],'cover':r[6]/100})
root_identity=[r for rs in daily.values() for r in rs if r[8]==1050 and num(r[17]) and num(r[18])]
assert len(root_identity)==327 and all(abs(r[17]-r[18])<1e-5 for r in root_identity)
cases=[]
for (year,code),rs in sorted(daily.items()):
    sowing=next(r[2] for r in rs if r[4]=='Plant')
    # 2013 log reports R6 on 25 September; row itself labels R5. Retain disagreement.
    r6=next((r[2] for r in rs if r[4]=='R6'),datetime(2013,9,25))
    rows=[r for r in rs if sowing<=r[2]<=r6]
    n=len(rows)
    assert all((r[2]-sowing).days==i for i,r in enumerate(rows))
    fc4=fc[(year,code)][:4]
    first=rows[0]
    initial_depletion=first[31] if num(first[31]) else 8
    # Initial root-zone depletion is a field-balance ESTIMATE, not measured theta.
    initial_fraction=max(0,min(1,1-initial_depletion/(80*(fc4[0]*.5))))
    ds=[min(30,n-3), min(45,n-33), min(45,n-78)]
    ds.append(n-sum(ds))
    assert min(ds)>0
    roots=[.08,.3,1.05,1.05,1.05]
    kcs=[(.3,.3),(.3,1.2),(1.2,1.2),(1.2,.35)]
    stages=[{'name':name,'days':d,'kcStart':kc[0],'kcEnd':kc[1],'rootStartM':roots[i],'rootEndM':roots[i+1],'depletionFraction':.55} for i,(name,d,kc) in enumerate(zip(['initial','development','mid','late'],ds,kcs))]
    ws=[];events=[];diagnostics=[]
    for r in rows:
        day=r[2].date().isoformat()
        if day not in met: raise ValueError('Incomplete weather '+day)
        ws.append({**met[day],'rainMm':r[19],'status':'estimated','source':'USDA LIRF: MST hour-ending, grass ETo; rain field gauge','availableAt':day+'T23:59:59Z'})
        if num(r[22]) and r[22]>0:events.append({'id':day,'date':day,'kind':'irrigation','amount':r[22],'unit':'mm','point':'net','status':'measured','source':'USDA field effective irrigation, gross retained in audit','recordedAt':day+'T23:59:59Z','landSelection':'whole'})
        diagnostics.append({'date':day,'etFieldBalanceMm':r[28] if num(r[28]) else None,'rootRawLabelCm':r[8],'rootInterpretedM':r[8]/1000 if num(r[8]) else None,'coverInterpolated':r[9] if num(r[9]) else None,'evaporationEstimatedMm':r[27] if num(r[27]) else None,'rootDepletionFieldMm':r[18] if num(r[18]) else None,'deficit105Mm':r[17] if num(r[17]) else None,'thetaMeasured':[v/100 if num(v) else None for v in r[10:14]],'irrigationGrossMm':r[21],'irrigationEffectiveMm':r[22],'etrAlfalfaMm':r[23]})
    obs=[a for a in annual if a['year']==year and a['treatmentCode']==code]
    cases.append({'id':f'LIRF-{year}-{code}','year':year,'treatmentCode':code,'treatment':obs[0]['treatment'],'sowingDate':sowing.date().isoformat(),'maturityDate':r6.date().isoformat(),'stages':stages,'soil':{'source':'LIRF FC by year/treatment; WP=0.5 FC and initial profile are explicit reconstruction scenarios','layers':[{'thicknessM':d,'thetaFC':f,'thetaWP':f*.5,'initialTheta':f*.5+f*.5*initial_fraction} for d,f in zip([.15,.3,.3,.3],fc4)],'infiltrationMmDay':None},'weather':ws,'events':events,'annualObservations':obs,'coverObservations':cover[(year,code)],'dailyDiagnostics':diagnostics})
soilbook=openpyxl.load_workbook(src/'LIRF_soils_2008_2011.xlsx',read_only=True,data_only=True)
soil_samples=[{'siteId':r[0],'plotId':r[1],'topCm':r[2],'bottomCm':r[3],'theta1500Measured':r[32]} for r in list(soilbook['Moisture Release'].values)[4:] if num(r[0])]
result={'sourceDoi':'10.15482/USDA.ADC/1439968','soilDoi':'10.15482/USDA.ADC/1254006','sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [src/'LIRF_2012_2013.xlsx',src/'LIRF_soils_2008_2011.xlsx']},'grainMoisturePercent':15.5,'annualRows':len(annual),'usableGrainRows':sum(a['grainKgHa'] is not None for a in annual),'negativeSolarHoursClippedToPhysicalZero':negative_solar,'rootUnitAudit':{'header':'cm','numericallyConsistentUnit':'mm, inferred from exact SWD105=SWDRZ at root=1050','identityRows':len(root_identity),'status':'inferred unit correction; no author confirmation'},'soilSamples2007':soil_samples,'limits':['Treatment daily series are means, not independent plot-level forcing.','2013 R6 date disagrees between crop log and daily sheet; date is a replay input, not forecast.','No complete spatial mapping of old pressure plate horizons onto all 2012/13 plots; not silently transferred. WP scenarios remain visible.','Initial whole-profile theta is reconstructed using estimated initial root depletion, not observed at sowing.','Annual ET is planting to plot maturity; treatment maturity date uncertain, and annual ET differs from sum of truncated daily rows.','Canopy and estimated field ET/roots/stress are diagnostic observations; future values unavailable in a forecast.'], 'cases':cases}
with gzip.open(out/'adapter.json.gz','wt') as f:json.dump(result,f,allow_nan=False)
(out/'input-audit.json').write_text(json.dumps({k:v for k,v in result.items() if k!='cases'},indent=2)+'\n')
print(json.dumps({'cases':len(cases),'annualRows':result['annualRows'],'usableGrainRows':result['usableGrainRows'],'rootIdentityRows':len(root_identity),'negativeSolarHours':negative_solar}))
