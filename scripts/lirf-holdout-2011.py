"""Map the newly acquired 2011 season without fitting a crop coefficient."""
from pathlib import Path
from datetime import datetime,timedelta
import openpyxl,json,gzip,sys,hashlib
src=Path(sys.argv[1]);out=Path('research-data/lirf/2026-11-10')
assert (out/'profile-frozen-2012.json').exists(), 'Freeze the 2012 fit first'
w=openpyxl.load_workbook(src/'LIRF_Maize_2011_r1_0.xlsx',read_only=True,data_only=True)
metbook=openpyxl.load_workbook(src/'LIRF_Weather_2011.xlsx',read_only=True,data_only=True)
num=lambda x:isinstance(x,(int,float))
weather={r[0].date().isoformat():r for r in list(metbook['Daily'].values)[6:] if isinstance(r[0],datetime)}
repairs=[]
for key,r in list(weather.items()):
    r=list(r)
    for col in [2,3,4,8,17]:
        if not num(r[col]):
            before=(datetime.fromisoformat(key)-timedelta(days=1)).date().isoformat();after=(datetime.fromisoformat(key)+timedelta(days=1)).date().isoformat()
            assert num(weather[before][col]) and num(weather[after][col]), 'Only isolated one-day input gaps are interpolated'
            r[col]=(weather[before][col]+weather[after][col])/2;repairs.append({'date':key,'column':col,'method':'linear interpolation of immediate adjacent days, not measured'})
    weather[key]=r
season=list(w['Seasonal'].values)
means={r[0]:r for r in season[6:12]}
plots=[r for r in season[25:49] if num(r[0]) and isinstance(r[2],str)]
cases=[]
for trt in range(1,7):
    rows=[r for r in list(w[f'Tmnt{trt}'].values)[4:] if num(r[0])]
    sow=next(r[0] for r in rows if r[12]=='Planting');end=next(r[0] for r in rows if r[12]=='R6')
    rows=[r for r in rows if sow<=r[0]<=end];n=len(rows)
    date=lambda doy:(datetime(2011,1,1)+timedelta(days=doy-1)).date().isoformat()
    fs=[v/100 for v in means[trt][11:15]]
    deficit=rows[0][30];assert num(deficit)
    initial=max(0,min(1,1-deficit/(50*fs[0]*.5)))
    roots=[.05,.3,1.05,1.05,1.05];durations=[30,45,45,n-120];kcs=[(.3,.3),(.3,1.2),(1.2,1.2),(1.2,.35)]
    stages=[{'name':name,'days':d,'kcStart':kc[0],'kcEnd':kc[1],'rootStartM':roots[i],'rootEndM':roots[i+1],'depletionFraction':.55} for i,(name,d,kc) in enumerate(zip(['initial','development','mid','late'],durations,kcs))]
    ws=[];events=[];ds=[]
    for r in rows:
        day=date(r[0]);m=weather[day]
        ws.append({'date':day,'temperatureMeanC':m[2],'temperatureMinC':m[4],'temperatureMaxC':m[3],'radiationMj':max(0,m[8]),'et0Mm':max(0,m[17]),'rainMm':r[1] if num(r[1]) else m[10],'status':'estimated','source':'USDA LIRF 2011 daily weather: grass ETo, radiation MJ/m2/day','availableAt':day+'T23:59:59Z'})
        if num(r[2]) and r[2]>0:events.append({'id':day,'date':day,'kind':'irrigation','amount':r[2],'unit':'mm','point':'field','status':'measured','source':'LIRF 2011 turbine-meter field irrigation, not effective dose','recordedAt':day+'T23:59:59Z','landSelection':'potentialLand'})
        ds.append({'date':day,'etFieldBalanceMm':r[25] if num(r[25]) else None,'deficit105Mm':r[29] if num(r[29]) else None,'thetaMeasured':[v/100 if num(v) else None for v in r[4:8]]})
    obs=[{'year':2011,'plot':r[2],'treatmentCode':trt,'treatment':str(trt),'harvestIndex':r[6],'biomassKgHa':r[5],'grainKgHa':r[7],'etMm':sum(d['etFieldBalanceMm'] or 0 for d in ds)} for r in plots if r[0]==trt]
    assert len(obs)==4
    cases.append({'id':f'LIRF-2011-{trt}','year':2011,'treatmentCode':trt,'treatment':str(trt),'sowingDate':date(sow),'maturityDate':date(end),'stages':stages,'soil':{'source':'FC from 2011 treatment means; same predeclared WP/FC=.5 reconstruction, no WP fitting','layers':[{'thicknessM':d,'thetaFC':f,'thetaWP':f*.5,'initialTheta':f*.5+f*.5*initial} for d,f in zip([.15,.3,.3,.3],fs)],'infiltrationMmDay':None},'weather':ws,'events':events,'annualObservations':obs,'dailyDiagnostics':ds,'coverObservations':[]})
output={'sourceDoi':'10.15482/USDA.ADC/1254006','year':2011,'inputRepairs':repairs,'cases':cases,'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.xlsx')},'limits':['New season evaluated after freezing the 2012 fit; retrospective earlier-year evaluation at same farm, not a new climate domain.','2011 irrigation is gross field water; test efficiencies .90 and 1.00 without selecting on yields.','Effective WP and HI stay frozen; no cultivar reidentification.','Missing sowing-date measured soil profile still reconstructed from field-balance initial depletion.','Grain explicitly at 15.5%, distinct from paired dry grain column; maturity R6 distinct from harvest.']}
with gzip.open(out/'holdout-2011-adapter.json.gz','wt') as f:json.dump(output,f,allow_nan=False)
print('2011 holdout:',len(cases),'treatments /',sum(len(c['annualObservations']) for c in cases),'plots; no fitting')
