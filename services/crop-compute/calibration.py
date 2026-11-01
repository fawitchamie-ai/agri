"""Bounded parameter search against qualified trials, using the real PCSE runner.

Called only by the preregistered research pipeline. This module never registers a
model for production, infers missing cultivar parameters or fabricates labels.
"""
from copy import deepcopy
import itertools
import math
from runner import run

ALLOWED={'phenology':{'cropParameters.TSUM1','cropParameters.TSUM2'},'crop':{'cropParameters.TDWI','cropParameters.SPAN'},'soilN':{'processParameters.KNIT_REF','processParameters.KDENIT_REF'},'organic':{'organicProduct.initialAgeYears'},'interaction':set()}

def calibrate(train,protocol,loss):
    stage=protocol['nativeStage'];grid=protocol['nativeGrid']
    if stage not in ALLOWED or not isinstance(grid,list) or not 1<=len(grid)<=2:raise ValueError('One or two identifiable native parameters per stage required')
    if any('bundle' not in r for r in train):raise ValueError('Real complete input bundles required for each experimental observation')
    if stage=='organic' and not all(r.get('organicContrastDocumented') is True for r in train):raise ValueError('Organic parameters require real documented organic contrasts')
    if stage=='phenology' and not all(r.get('anthesisDate') for r in train):raise ValueError('Phenology parameters require observed anthesis dates')
    if len(grid)>1 and not all(r.get('anthesisDate') or r.get('biomassKgHa') for r in train):raise ValueError('Yield alone does not identify multiple native parameters')
    for p in grid:
        if p.get('path') not in ALLOWED[stage] or not p.get('source') or not p.get('values') or any(type(v) not in (int,float) or not math.isfinite(v) for v in p['values']):raise ValueError('Unsupported or unsourced native parameter grid')
    if math.prod(len(p['values']) for p in grid)>64:raise ValueError('64 candidate parameter sets maximum')
    best=None;failures=[]
    for values in itertools.product(*(p['values'] for p in grid)):
        parameters=dict(zip((p['path'] for p in grid),values))
        try:
            predictions,anthesis=predict(train,parameters)
            score=loss(train,predictions)['RMSE']
            if stage=='phenology':
                from datetime import date
                score=sum(abs((date.fromisoformat(p)-date.fromisoformat(r['anthesisDate'])).days) for r,p in zip(train,anthesis))/len(train)
            if best is None or score<best[0]:best=(score,parameters)
        except Exception as e:failures.append({'parameters':parameters,'error':str(e)[:300]})
    if best is None:raise ValueError('Every real-engine candidate failed; no fallback result')
    return {'model':'wofost_snomin','parameters':best[1],'stage':stage,'trainingLoss':best[0],'failures':failures,'chemicalStatesValidated':False}

def predict(rows,parameters):
    yields=[];anthesis=[]
    for row in rows:
        b=deepcopy(row['bundle'])
        for path,v in parameters.items():
            if path=='organicProduct.initialAgeYears':
                for a in b['applications']:
                    if a['organicMatterKgHa']>0:a['initialAgeYears']=v
                continue
            parent,key=path.split('.')
            if key not in b[parent]:raise ValueError('Missing native parameter cannot be silently initialized')
            b[parent][key]=v
        result=run(b)
        yields.append(result['result']['storageOrganDryMatterKgHaSown']);anthesis.append(result['summary']['DOA'])
    return yields,anthesis

def scenario_ensemble(bundles):
    if not isinstance(bundles,list) or not 1<=len(bundles)<=16:raise ValueError('1–16 explicitly named uncertainty scenarios required')
    rows=[]
    for item in bundles:
        if item.get('axis') not in ('soil','future_weather','product','parameters','structure') or not item.get('label'):raise ValueError('Uncertainty axis and label required')
        try:r=run(item['bundle']);rows.append({'axis':item['axis'],'label':item['label'],'status':'complete','result':r['result']})
        except Exception as e:rows.append({'axis':item['axis'],'label':item['label'],'status':'failed','result':None,'error':str(e)[:400]})
    values=[r['result']['storageOrganDryMatterKgHaSown'] for r in rows if r['status']=='complete']
    complete=len(values)==len(rows)
    return {'scenarios':rows,'complete':complete,'rangeKgHa':([min(values),max(values)] if complete else None),'probability':None,'predictiveInterval95':None,'interpretation':'Range of declared scenarios only. No failed member is silently excluded from the range; no probabilistic coverage or model-structure difference is invented.'}
