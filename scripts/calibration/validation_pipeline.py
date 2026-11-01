"""Preregistered, grouped calibration. No synthetic/territorial labels or defaults.

Models: training-only mean, bounded empirical linear plateau, optional real
WOFOST candidate packs. Outputs remain research artifacts until independent review.
"""
import argparse
from collections import Counter,defaultdict
from copy import deepcopy
import hashlib
import importlib.util
import itertools
import json
import math
from pathlib import Path
import random
import sqlite3
import sys

ROOT=Path(__file__).resolve().parents[2]

def fingerprint(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def finite(v):return type(v) in (int,float) and math.isfinite(v)

def weights(rows):
    sites=defaultdict(lambda:defaultdict(list))
    for i,r in enumerate(rows):sites[r['siteId']][r['experimentId']].append(i)
    w=[0.]*len(rows)
    for experiments in sites.values():
        for indices in experiments.values():
            for i in indices:w[i]=1/len(sites)/len(experiments)/len(indices)
    return w

def metrics(rows,predicted):
    if len(rows)!=len(predicted) or not rows or any(not finite(x) for x in predicted):raise ValueError('Complete finite predictions required; failures cannot be dropped')
    w=weights(rows);errors=[(p-r['yieldKgHaSownDry'])/1000 for p,r in zip(predicted,rows)]
    return {'n':len(rows),'sites':len({r['siteId'] for r in rows}),'experiments':len({r['experimentId'] for r in rows}),'unit':'t dry product/ha sown','MAE':sum(a*abs(e) for a,e in zip(w,errors)),'RMSE':math.sqrt(sum(a*e*e for a,e in zip(w,errors))),'bias':sum(a*e for a,e in zip(w,errors)),'weighting':'equal sites, equal experiments within site, equal rows within experiment'}

def treatment_metrics(rows,pred):
    groups=defaultdict(list)
    for r,p in zip(rows,pred):groups[(r['siteId'],r['experimentId'],r['year'],r['blockId'])].append((r,p))
    gain=[];concordant=discordant=tied=missing=0
    for members in groups.values():
        control=[(r,p) for r,p in members if r['control']]
        if len(control)!=1:missing+=len(members);continue
        c,cp=control[0]
        for r,p in members:
            if r['control']:continue
            if c['yieldKgHaSownDry']>0 and cp>0:gain.append(100*((p/cp-1)-(r['yieldKgHaSownDry']/c['yieldKgHaSownDry']-1)))
            else:missing+=1
        for (a,ap),(b,bp) in itertools.combinations(members,2):
            observed=a['yieldKgHaSownDry']-b['yieldKgHaSownDry'];forecast=ap-bp
            if observed==0 or forecast==0:tied+=1
            elif observed*forecast>0:concordant+=1
            else:discordant+=1
    return {'relativeGainMAEPercentagePoints':sum(map(abs,gain))/len(gain) if gain else None,'gainPairs':len(gain),'unmatchedOrZeroControl':missing,'ranking':{'concordant':concordant,'discordant':discordant,'ties':tied},'pairWeighting':'one observed matched treatment-control pair; no invented controls','causality':'Only interpretable under the documented experimental assignment; no causal claim from observational data'}

def grouped_metrics(rows,pred):
    result={}
    for field in ('siteId','year','soilClass'):
        groups=defaultdict(list)
        for i,r in enumerate(rows):groups[str(r[field])].append(i)
        result[field]={key:metrics([rows[i] for i in ids],[pred[i] for i in ids]) for key,ids in groups.items()}
    return result

def bootstrap_metric(rows,pred,seed,repetitions=500):
    sites=sorted({r['siteId'] for r in rows})
    if len(sites)<2:return {'status':'unavailable','reason':'Independent sites required','predictiveInterval':False}
    rng=random.Random(seed);values=[]
    for _ in range(repetitions):
        rr=[];pp=[]
        for k,site in enumerate(rng.choices(sites,k=len(sites))):
            for r,p in zip(rows,pred):
                if r['siteId']==site:rr.append({**r,'siteId':f'bootstrap-{k}'});pp.append(p)
        values.append(metrics(rr,pp)['MAE'])
    values.sort()
    return {'status':'computed','quantity':'site-cluster bootstrap percentile interval for test MAE only','lower':values[int(.025*repetitions)],'upper':values[min(repetitions-1,int(.975*repetitions))],'unit':'t/ha','seed':seed,'repetitions':repetitions,'predictiveInterval':False,'limit':'Resampling cannot create new independent sites or establish nominal predictive coverage'}

def validate_protocol(data,plan):
    if plan.get('version')!='calibration-protocol-1' or plan.get('inputSha256')!=fingerprint(data):raise ValueError('Protocol must freeze the exact input before fitting')
    if not isinstance(plan.get('seed'),int) or not plan.get('registeredOn') or not plan.get('domain') or not plan.get('scientificRationale'):raise ValueError('Preregistration, domain, seed and rationale required')
    rows=data.get('rows')
    if not rows:raise ValueError('No qualified experimental observations')
    for r in rows:
        for key in ('id','sourceId','siteId','trialId','experimentId','blockId','plotId','duplicateGroup','country','crop','variety','soilClass','waterSystem','product','source','license','predictorAvailableOn','predictionDate','harvestDate'):
            if not isinstance(r.get(key),str) or not r[key].strip():raise ValueError('Missing explicit observation field: '+key)
        if r.get('synthetic') is not False or r.get('kind')!='controlled_trial' or r.get('denominator')!='sown' or r.get('productBasis')!='dry' or r.get('doseBasis')!='kg N/ha/cycle' or r.get('qualification')!='protocol_reviewed':raise ValueError('Unqualified labels, denominator, dose basis or synthetic data cannot calibrate')
        if any(not finite(r.get(k)) or r[k]<0 for k in ('yieldKgHaSownDry','doseNkgHa')) or not isinstance(r.get('year'),int) or not isinstance(r.get('control'),bool):raise ValueError('Finite yield, cycle dose, year and control status required')
        from datetime import date
        dates={k:date.fromisoformat(r[k]) for k in ('predictorAvailableOn','predictionDate','harvestDate')}
        if dates['predictorAvailableOn']>dates['predictionDate'] or dates['predictionDate']>=dates['harvestDate']:raise ValueError('Future predictor leakage or post-harvest prediction')
        if any(r.get(k)!=v for k,v in plan['domain'].items()):raise ValueError('Domain mismatch; do not pool unqualified cultivars/products/systems')
    if len({r['id'] for r in rows})!=len(rows):raise ValueError('Duplicate observation IDs')
    # Shared site OR trial OR experiment OR plot OR duplicate lineage must never cross splits.
    seen={};splits=plan['splitBySite'];parts={k:[] for k in ('train','validation','test')}
    for r in rows:
        split=splits.get(r['siteId'])
        if split not in parts:raise ValueError('Explicit site split required for every row')
        parts[split].append(r)
        for k in ('siteId','trialId','experimentId','plotId','duplicateGroup'):
            key=(r['sourceId'],k,r[k])
            if key in seen and seen[key]!=split:raise ValueError('Connected experiment/plot/duplicate leakage across splits')
            seen[key]=split
    if any(not p for p in parts.values()):raise ValueError('Independent nonempty train, validation and test domains required')
    if max(r['year'] for r in parts['train'])>=min(r['year'] for r in parts['validation']) or max(r['year'] for r in parts['validation'])>=min(r['year'] for r in parts['test']):raise ValueError('Validation and final test must be strictly later campaigns on independent sites')
    if len({(r['sourceId'],r['duplicateGroup']) for r in rows})!=len(rows):raise ValueError('Duplicate labels must be canonicalized before fitting, not counted as replications')
    b=plan['empiricalBounds']
    for name in ('interceptKgHa','slopeKgGrainPerKgN','knotNkgHa'):
        x=b[name]
        if not x.get('source') or not isinstance(x.get('grid'),list) or not x['grid'] or any(not finite(v) for v in x['grid']):raise ValueError('Prespecified finite parameter grids and scientific sources required')
    if len(b['slopeKgGrainPerKgN']['grid'])*len(b['knotNkgHa']['grid'])>1000:raise ValueError('Parameter search exceeds fixed computation bound')
    if min(b['knotNkgHa']['grid'])<0 or len(b['interceptKgHa']['grid'])!=2 or b['interceptKgHa']['grid'][0]>b['interceptKgHa']['grid'][1]:raise ValueError('Invalid physical intercept/knot bounds')
    if any(not finite(plan['acceptance'].get(k)) or plan['acceptance'][k]<0 for k in ('maxRMSETonnesHa','maxAbsBiasTonnesHa')):raise ValueError('Acceptance thresholds must be declared, not derived from test errors')
    return parts

def fit_empirical(train,bounds):
    w=weights(train);lo,hi=bounds['interceptKgHa']['grid'];best=None
    for slope,knot in itertools.product(bounds['slopeKgGrainPerKgN']['grid'],bounds['knotNkgHa']['grid']):
        intercept=min(hi,max(lo,sum(a*(r['yieldKgHaSownDry']-slope*min(r['doseNkgHa'],knot)) for a,r in zip(w,train))))
        pred=[max(0,intercept+slope*min(r['doseNkgHa'],knot)) for r in train]
        score=metrics(train,pred)['RMSE']
        if best is None or score<best[0]:best=(score,{'model':'linear_plateau','interceptKgHa':intercept,'slope':slope,'knot':knot})
    return best[1]

def predict(model,rows):
    if model['model']=='wofost_snomin':
        sys.path.insert(0,str(ROOT/'services/crop-compute'))
        from calibration import predict as native_predict
        return native_predict(rows,model['parameters'])[0]
    if model['model']=='training_mean':return [model['meanKgHa']]*len(rows)
    return [max(0,model['interceptKgHa']+model['slope']*min(r['doseNkgHa'],model['knot'])) for r in rows]

def domain_check(domain,row):
    outside=[];missing=[]
    for k,values in domain['categorical'].items():
        if row.get(k) is None:missing.append(k)
        elif str(row[k]) not in values:outside.append(k)
    if not finite(row.get('doseNkgHa')):missing.append('doseNkgHa')
    elif not domain['doseNkgHa'][0]<=row['doseNkgHa']<=domain['doseNkgHa'][1]:outside.append('doseNkgHa')
    for k,bounds in domain['numeric'].items():
        if not finite(row.get(k)):missing.append(k)
        elif not bounds[0]<=row[k]<=bounds[1]:outside.append(k)
    missing+=domain['uncharacterizedAxes']
    return {'status':'extrapolated' if outside else 'domain_incomplete' if missing else 'in_documented_domain','outside':outside,'unknown':missing,'validatedForecast':False}

def execute(data,plan):
    parts=validate_protocol(data,plan);train=parts['train'];w=weights(train)
    models=[{'model':'training_mean','meanKgHa':sum(a*r['yieldKgHaSownDry'] for a,r in zip(w,train))},fit_empirical(train,plan['empiricalBounds'])]
    if plan.get('nativeGrid'):
        sys.path.insert(0,str(ROOT/'services/crop-compute'))
        from calibration import calibrate
        models.append(calibrate(train,plan,metrics))
    validation=[metrics(parts['validation'],predict(m,parts['validation'])) for m in models]
    selected=min(range(len(models)),key=lambda i:validation[i]['RMSE'])
    # Test is evaluated only after selection; freeze the selected candidate before reading test targets.
    chosen=models[selected];test=parts['test'];pred=predict(chosen,test);score=metrics(test,pred)
    comparisons=[{'model':m,'validation':v,'test':metrics(test,predict(m,test))} for m,v in zip(models,validation)]
    passed=score['RMSE']<=plan['acceptance']['maxRMSETonnesHa'] and abs(score['bias'])<=plan['acceptance']['maxAbsBiasTonnesHa']
    domain={'categorical':{k:sorted({str(r[k]) for r in train}) for k in ('country','crop','variety','soilClass','waterSystem','product')},'doseNkgHa':[min(r['doseNkgHa'] for r in train),max(r['doseNkgHa'] for r in train)]}
    axes=('seasonRainMm','seasonMeanTemperatureC','rootDepthCm','soilPH');domain['numeric']={k:[min(r[k] for r in train),max(r[k] for r in train)] for k in axes if all(finite(r.get(k)) for r in train)};domain['uncharacterizedAxes']=[k for k in axes if k not in domain['numeric']]
    for field in ('soilPHMethod','soilPHDepth'):
        if all(r.get(field) for r in train):domain['categorical'][field]=sorted({str(r[field]) for r in train})
        else:domain['uncharacterizedAxes'].append(field)
    return {'domainChecks':dict(Counter(domain_check(domain,r)['status'] for r in test)),'version':'calibration-result-1','status':'research_evaluated' if passed else 'criteria_failed','validatedForAdvice':False,'agronomicReview':'pending','dataVersion':data.get('version'),'sourceManifestSha256':data.get('sourceManifestSha256'),'protocol':plan,'inputSha256':fingerprint(data),'protocolSha256':fingerprint(plan),'seed':plan['seed'],'parameters':chosen,'comparisons':comparisons,'test':score,'byDomain':grouped_metrics(test,pred),'treatments':treatment_metrics(test,pred),'errorUncertainty':bootstrap_metric(test,pred,plan['seed']),'domain':domain,'internalChemicalStatesValidated':False,'splitBySite':plan['splitBySite'],'codeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'limitations':['No validated seasonal forecast: future meteorological skill not evaluated','Yield-only labels cannot validate internal chemical states','Empirical dose response is not a daily organic mineralization model','No fertilizer prescription or optimum is released automatically']}

def audit_database(path):
    db=sqlite3.connect(f'file:{Path(path).resolve()}?mode=ro',uri=True);db.row_factory=sqlite3.Row
    rows=db.execute('SELECT country,crop,variety,count(*) n,count(DISTINCT dependency_group) groups,sum(CASE WHEN denominator LIKE "%unspecified%" THEN 1 ELSE 0 END) unresolved FROM observation_units GROUP BY country,crop,variety').fetchall()
    return {'acquiredCampaigns':db.execute('SELECT count(*) FROM campaigns').fetchone()[0],'domains':[{'country':r['country'],'crop':r['crop'],'variety':r['variety'],'observations':r['n'],'independentSiteGroups':r['groups'],'unresolvedDenominators':r['unresolved'],'calibrationStatus':'blocked','reasons':['Independent sites and later campaigns not available for a final test in this acquired domain','Cycle-specific input/forcing/cultivar and protocol qualification required before fitting'],'metrics':None} for r in rows],'calibratedDomains':[],'agronomicReview':'pending','privateRowsPublished':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data');p.add_argument('--protocol');p.add_argument('--audit-database');p.add_argument('--output',required=True);a=p.parse_args()
    target=Path(a.output)
    if target.exists():raise ValueError('Output already exists; preserve previous calibration artifacts')
    target.parent.mkdir(parents=True,exist_ok=True)
    if a.audit_database:result=audit_database(a.audit_database)
    else:
        data=json.loads(Path(a.data).read_text());plan=json.loads(Path(a.protocol).read_text());result=execute(data,plan)
        result['license']='; '.join(sorted({r['license'] for r in data['rows']}))
    if any(token in result.get('license','').upper() for token in ('CC-BY-NC','NON-COMMERCIAL','NONCOMMERCIAL')) and not target.resolve().is_relative_to(ROOT/'work'):
        raise ValueError('NC research derivatives must remain in the ignored work directory; no automatic public model export')
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
