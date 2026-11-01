"""Execute one self-contained, explicit WOFOST/SNOMIN research scenario.

No provider downloads, pickle, executable configuration or client-selected model.
PCSE is a separate EUPL-1.2 dependency; its code is not modified here.
"""
import datetime as dt
from copy import deepcopy
import hashlib
import json
import math
import sys
import time

MODEL = 'Wofost81_NWLP_MLWB_SNOMIN'
VERSION = 'pcse-snomin-bundle-1'


def number(v, lo, hi, name):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not lo <= v <= hi:
        raise ValueError(f'{name}: numeric value outside [{lo}, {hi}]')
    return float(v)


def date(v):
    if not isinstance(v, str) or len(v) != 10:
        raise ValueError('ISO date required')
    return dt.date.fromisoformat(v)


def site_parameters(bundle):
    result={}
    for key in ('processParameters','siteParameters','initialState'):
        values=bundle[key]
        if not isinstance(values,dict) or result.keys() & values.keys():
            raise ValueError('Separate process, site and initial-state keys without duplicates')
        result.update(values)
    if not {'WAV','SSI','NH4I','NO3I','A0SOM'} <= bundle['initialState'].keys():
        raise ValueError('Initial water, surface storage, mineral N and organic age belong in initialState')
    return result


def validate(bundle):
    if not isinstance(bundle, dict) or bundle.get('version') != VERSION:
        raise ValueError('Unsupported input bundle version')
    if bundle.get('purpose') != 'named_research_scenario' or bundle.get('pkAssumption') != 'P_K_nonlimiting_not_simulated':
        raise ValueError('Named research scenario and explicit non-simulated P/K assumption required')
    meta = bundle['metadata']
    for key in ('scenario', 'parameterSource', 'parameterLicense', 'weatherSource', 'soilSource', 'cultivar', 'country'):
        if not isinstance(meta.get(key), str) or not meta[key].strip():
            raise ValueError(f'Missing provenance: {key}')
    if meta['country'] not in ('TGO', 'BEN', 'BFA', 'GHA', 'CIV', 'SEN', 'DEMO'):
        raise ValueError('Unsupported country')
    # Potato is confined to the upstream technical fixture, not added to the agronomic catalog.
    if meta.get('cropId') != 'maize' and not (meta['country'] == 'DEMO' and meta.get('cropId') == 'potato'):
        raise ValueError('Only maize research packs or the isolated upstream potato demo are enabled; no legume fixation')
    cal = bundle['calendar']
    start, sowing, end = (date(cal[k]) for k in ('start', 'sowing', 'end'))
    if not start <= sowing < end or (end-start).days > 366:
        raise ValueError('Calendar outside one crop cycle / 366-day domain')
    soil, site, crop = bundle['soilProperties'], site_parameters(bundle), bundle['cropParameters']
    for key in ('A0SOM','CNRatioBio','CO2','FASDIS','IFUNRN','KDENIT_REF','KNIT_REF','KSORP','MRCDIS','NH4ConcR','NO3ConcR','NOTINF','WFPS_CRIT','SMLIM','SSI','SSMAX','WAV','NH4I','NO3I'):
        if key not in site:
            raise ValueError(f'Explicit site/state parameter required: {key}; no hidden default')
    layers = soil['SoilProfileDescription']['SoilLayers']
    if not 1 <= len(layers) <= 20 or soil['SoilProfileDescription'].get('GroundWater') is not False:
        raise ValueError('1–20 soil horizons, no groundwater coupling')
    for layer in layers:
        for k in ('Thickness','CNRatioSOMI','CRAIRC','FSOMI','RHOD','Soil_pH','SMfromPF','CONDfromPF'):
            if k not in layer:
                raise ValueError(f'Missing soil property: {k}')
        number(layer['Thickness'], 1, 300, 'Thickness cm')
    for k in ('NH4I','NO3I'):
        if len(site[k]) != len(layers):
            raise ValueError(f'{k} must describe every horizon')
        for n in site[k]:
            number(n, 0, 5000, k+' kg N/ha')
    if not isinstance(crop, dict) or len(crop) < 20:
        raise ValueError('Complete sourced cultivar parameters required')
    if crop.get('NFIX_FR') != 0:
        raise ValueError('Biological N fixation is outside the enabled domain; NFIX_FR must be explicitly zero')
    weather = bundle['weather']
    if not isinstance(weather,list) or not 1 <= len(weather) <= 367:
        raise ValueError('Daily weather required')
    dates = [date(w['DAY']) for w in weather]
    if len(set(dates)) != len(dates) or not set(start+dt.timedelta(days=i) for i in range((end-start).days+1)) <= set(dates):
        raise ValueError('Weather must cover every simulation date without duplicates')
    for k, lo, hi in [('LAT',-90,90),('LON',-180,180),('ELEV',-300,6000)]:
        number(bundle['location'][k],lo,hi,k)
    number(bundle['sownAreaHa'],0.0000001,100000,'sown hectares')
    if not isinstance(bundle.get('applications'),list) or len(bundle['applications'])>200:
        raise ValueError('At most 200 distinct application components')
    ids=set()
    for a in bundle['applications']:
        if not isinstance(a.get('id'),str) or not a['id'] or a['id'] in ids:
            raise ValueError('Distinct component ids required')
        ids.add(a['id'])
        if not start <= date(a['date']) <= end:
            raise ValueError('Application outside the modeled cycle')
        if a.get('status') not in ('planned','declared'):
            raise ValueError('Application status required')
        if a['status']=='declared' and date(a['date'])>dt.date.today():
            raise ValueError('A future application cannot be declared realized')
        if a.get('ureaNkgHa') != 0:
            raise ValueError('Urea hydrolysis not simulated; do not silently replace urea with ammonium')
        for key in ('amountKgHa','nh4KgHa','no3KgHa','organicNKgHa','organicMatterKgHa','carbonKgHa'):
            number(a[key],0,1000000,key)
        amount=a['amountKgHa']
        if sum(a[k] for k in ('nh4KgHa','no3KgHa','organicMatterKgHa'))>amount+1e-7 or a['carbonKgHa']+a['organicNKgHa']>a['organicMatterKgHa']+1e-7:
            raise ValueError('Organic N is part of organic matter; mineral N plus organic matter exceed material mass')
        number(a['depthCm'],layers[0]['Thickness'],sum(l['Thickness'] for l in layers),'application depth cm')
        number(a['initialAgeYears'],0,100,'SNOMIN apparent age years')
        # PCSE fixes C/OM=0.58. Never reinterpret a different laboratory result silently.
        if not math.isclose(a['carbonKgHa'],.58*a['organicMatterKgHa'],rel_tol=1e-6,abs_tol=1e-7):
            raise ValueError('SNOMIN fixes C/OM=0.58; product incompatible. Supply a separately named model scenario or another module')
        if (a['organicNKgHa']>0)!=(a['carbonKgHa']>0):
            raise ValueError('Organic C and N characterization incompatible')
        if not isinstance(a.get('source'),str) or not a['source'].strip():
            raise ValueError('Application source required')
    irrigation=bundle['irrigation']
    if not isinstance(irrigation,list) or len(irrigation)>366:
        raise ValueError('Irrigation table required')
    irr_dates=[]
    for a in irrigation:
        d=date(a['date']);irr_dates.append(d)
        if not start<=d<=end:
            raise ValueError('Irrigation date outside cycle')
        number(a['fieldMm'],0,1000,'Irrigation field mm')
        number(a['efficiency'],0.00001,1,'Application efficiency')
    if len(set(irr_dates))!=len(irr_dates):
        raise ValueError('Group irrigation events on the same date')
    return bundle


def run(bundle):
    bundle=validate(bundle)
    input_sha=hashlib.sha256(json.dumps(bundle,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    import pcse
    from pcse.base import ParameterProvider, WeatherDataProvider, WeatherDataContainer
    from pcse.models import Wofost81_NWLP_MLWB_SNOMIN
    import numpy as np
    if pcse.__version__ != '6.0.13':
        raise ValueError('PCSE 6.0.13 required')
    began=time.perf_counter()
    weather=WeatherDataProvider()
    for w in bundle['weather']:
        day=date(w['DAY'])
        required={k:w[k] for k in WeatherDataContainer.required}
        if required['TMIN']>required['TMAX']:
            raise ValueError('TMIN > TMAX')
        for k,v in required.items():
            if not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v):
                raise ValueError('Missing/non-finite weather: '+k)
        container=WeatherDataContainer(DAY=day,**bundle['location'],**required)
        weather._store_WeatherDataContainer(container,day)
    c=bundle['calendar'];events=[]
    irr=[{date(a['date']):{'amount':a['fieldMm']/10,'efficiency':a['efficiency']}} for a in bundle['irrigation']]
    if irr:
        events.append({'event_signal':'irrigate','name':'Explicit irrigation','comment':'cm at field, before efficiency','events_table':irr})
    # PCSE keeps a single pending amendment buffer. Aggregate same-day components
    # only if their incorporation depth and apparent age are equal; otherwise refuse.
    grouped={}
    for a in bundle['applications']:
        d=a['date']
        if d not in grouped:grouped[d]=dict(a)
        else:
            b=grouped[d]
            if b['depthCm']!=a['depthCm'] or b['initialAgeYears']!=a['initialAgeYears']:
                raise ValueError('Same-day amendments with distinct depth/age unsupported by this adapter; no overwrite')
            for k in ('amountKgHa','nh4KgHa','no3KgHa','organicNKgHa','organicMatterKgHa','carbonKgHa'):b[k]+=a[k]
    amendments=[]
    for d,a in sorted(grouped.items()):
        amount=a['amountKgHa']
        if amount==0:continue
        amendments.append({date(d):{'amount':amount,'application_depth':a['depthCm'],'cnratio':a['carbonKgHa']/a['organicNKgHa'] if a['organicNKgHa'] else 0,'f_orgmat':a['organicMatterKgHa']/amount,'f_NH4N':a['nh4KgHa']/amount,'f_NO3N':a['no3KgHa']/amount,'initial_age':a['initialAgeYears']}})
    if amendments:events.append({'event_signal':'apply_n_snomin','name':'Distinct preserved components','comment':'kg material/ha; fractions relative to same material','events_table':amendments})
    agro=[{date(c['start']):{'CropCalendar':{'crop_name':bundle['metadata']['cropId'],'variety_name':bundle['metadata']['cultivar'],'crop_start_date':date(c['sowing']),'crop_start_type':'sowing','crop_end_date':date(c['end']),'crop_end_type':'harvest','max_duration':366},'TimedEvents':events or None,'StateEvents':None}}]
    parameters=ParameterProvider(sitedata=deepcopy(site_parameters(bundle)),soildata=deepcopy(bundle['soilProperties']),cropdata=deepcopy(bundle['cropParameters']))
    engine=Wofost81_NWLP_MLWB_SNOMIN(parameters,weather,agro,output_vars=['NORG','CORG','ORGMAT','NDENITCUM','NH4LEACHCUM','NO3LEACHCUM'])
    engine.run_till_terminate()
    summaries=engine.get_summary_output()
    if len(summaries)!=1 or summaries[0].get('TWSO') is None:
        raise ValueError('No complete storage-organ result from real engine')
    kgHa=float(summaries[0]['TWSO'])
    if not math.isfinite(kgHa) or kgHa<0:
        raise ValueError('Invalid engine yield')
    def native(o):
        if isinstance(o,(dt.date,dt.datetime)):return o.isoformat()
        if isinstance(o,np.ndarray):return o.tolist()
        if isinstance(o,np.generic):return o.item()
        raise TypeError(type(o).__name__)
    output={'version':VERSION,'engine':MODEL,'pcseVersion':pcse.__version__,'status':'research_scenario','validated':False,'nutrientsSimulated':['N'],'nutrientsNotSimulated':['P','K'],'inputSha256':input_sha,'metadata':bundle['metadata'],'elapsedSeconds':time.perf_counter()-began,'result':{'storageOrganDryMatterKgHaSown':kgHa,'productionDryKg':kgHa*bundle['sownAreaHa'],'sownAreaHa':bundle['sownAreaHa'],'denominator':'sown','freshOrMarketableProductionKg':None},'daily':engine.get_output(),'summary':summaries[0],'terminal':engine.get_terminal_output(),'applications':bundle['applications'],'outputUnits':{'WSO':'kg dry storage organ/ha sown','NH4':'kg N/m² per layer','NO3':'kg N/m² per layer','NAVAIL':'kg N/ha','NLOSSCUM':'kg N/ha','NuptakeTotal':'kg N/ha','RD':'cm','RAIN':'cm/day','WC':'cm per layer','SM':'cm³/cm³ per layer'},'limits':['Technical/research scenario, no six-country field validation. P and K assumed non-limiting, not simulated.','No urea hydrolysis, NH3 volatilization, legume fixation, daily pH change, salinity/toxicity response or flood mortality.','One homogeneous unit; geometry and disjoint aggregation belong to the existing spatial API.','No fresh-mass or marketable-mass conversion without documented product moisture and harvest fractions.']}
    units=output['outputUnits']
    units.update({'day':'ISO date','DVS':'dimensionless development stage','LAI':'m² leaf/m² ground','LAIMAX':'m² leaf/m² ground','RFTRA':'actual/potential transpiration ratio','Ndemand':'kg N/ha/day','NORG':'kg N/m² per amendment and layer','CORG':'kg C/m² per amendment and layer','ORGMAT':'kg organic matter/m² per amendment and layer'})
    for key in ('WLV','WST','WRT','TAGP','TWSO','TWLV','TWST','TWRT'):units[key]='kg dry matter/ha sown'
    for key in ('RMINT','NamountSO','NamountLV','NamountST','NamountRT','NDENITCUM','NH4LEACHCUM','NO3LEACHCUM'):units[key]='kg N/ha'
    for key in ('RIRR','EVS','TRA'):units[key]='cm/day'
    for key in ('CEVST','CTRAT','WTRAT','EVST','EVWT','TSR','RAINT','TOTINF','TOTIRR','PERCT','LOSST'):units[key]='cm'
    for key in ('DOS','DOE','DOA','DOM','DOH','DOV'):units[key]='ISO date or null'
    output['nitrogenDailyKgHa']=[{'date':row['day'],'nh4ByLayer':[float(n)*10000 for n in row['NH4']], 'no3ByLayer':[float(n)*10000 for n in row['NO3']], 'lossCumulative':row['NLOSSCUM'],'leachedNh4Cumulative':row['NH4LEACHCUM'],'leachedNo3Cumulative':row['NO3LEACHCUM'],'denitrifiedCumulative':row['NDENITCUM'],'cropUptakeCumulative':row['NuptakeTotal']} for row in output['daily']]
    return json.loads(json.dumps(output,default=native,allow_nan=False))


if __name__=='__main__':
    try:
        result=run(json.load(sys.stdin))
        # PCSE initializes a demo DB on first import; stdout must be redirected by callers.
        print(json.dumps(result,allow_nan=False))
    except Exception as exc:
        print(json.dumps({'error':str(exc)[:1000],'result':None}),file=sys.stderr)
        sys.exit(1)
