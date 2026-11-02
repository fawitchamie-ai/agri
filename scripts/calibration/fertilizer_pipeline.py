"""Matched fertilizer contrasts, grouped research evaluation and UI evidence.

Python standard library only. No synthetic labels. No operational predictor is
exported: moisture, dates, plot denominator and randomization remain unqualified.
Run `--prepare` before `--evaluate`; the latter verifies the frozen protocol.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import statistics
import zipfile
from xlsx_reader import Workbook

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'research-data/fertilizer/v1'
DOC=ROOT/'docs/calibration/fertilizer'
REFERENCES={'AfSIS_DT','TAMASA','Generose_Togo','Generose_Nigeria'}
COUNTRIES={'Togo':'TGO','Benin':'BEN','Burkina Faso':'BFA','Ghana':'GHA',"Côte d'Ivoire":'CIV','Senegal':'SEN'}
KEYS=('country','location','reference','trial_id','variety')


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')


def num(value):
    try:
        n=float(value)
        return n if math.isfinite(n) and n not in (-9,-999) else None
    except (ValueError,TypeError):return None


def originals(base):
    manifest=json.loads((base/'sources.json').read_text())
    for f in manifest['files']:
        if f['status']=='acquired' and (base/'raw'/f['path']).exists() and hashlib.sha256((base/'raw'/f['path']).read_bytes()).hexdigest()!=f['sha256']:
            raise ValueError('Original checksum mismatch: '+f['path'])
    with zipfile.ZipFile(base/'raw/carob.zip') as z:
        rows=list(csv.DictReader(io.StringIO(z.read('doi_10.7910_DVN_GXUNAZ.csv').decode())))
        meta=list(csv.DictReader(io.StringIO(z.read('doi_10.7910_DVN_GXUNAZ_meta.csv').decode())))[0]
    if meta['license']!='CC-BY-4.0':raise ValueError('Unexpected Carob license')
    return manifest,rows


def paired(rows):
    groups=defaultdict(list);rejected=[];pairs=[]
    for r in rows:
        if r['crop']!='maize' or r['treatment'] not in ('Abs_Control','NPK'):continue
        if r['reference'] not in REFERENCES:
            rejected.append(dict(record=r['record_id'],reason='compilation_or_ambiguous_repetition_excluded_to_avoid_overlap'));continue
        groups[tuple(r[k] for k in KEYS)].append(r)
    for key,members in sorted(groups.items()):
        if sorted(r['treatment'] for r in members)!=['Abs_Control','NPK']:
            rejected.extend(dict(record=r['record_id'],reason='no_unique_control_treatment_pair') for r in members);continue
        c=next(r for r in members if r['treatment']=='Abs_Control');t=next(r for r in members if r['treatment']=='NPK')
        if not c['trial_id'] or any(num(r['yield']) is None or num(r['yield'])<0 for r in members):
            rejected.extend(dict(record=r['record_id'],reason='missing_trial_or_invalid_yield') for r in members);continue
        if any(num(c[f'{n}_fertilizer'])!=0 or num(t[f'{n}_fertilizer']) is None for n in ('N','P','K')):
            rejected.extend(dict(record=r['record_id'],reason='control_or_dose_not_qualified') for r in members);continue
        # Matching uses design identifiers, NEVER yield or soil values as identity.
        # Missing rep is not fabricated; the published rep column is replication
        # COUNT for some sources, not a unique block identifier.
        if any(c[k]!=t[k] for k in ('latitude','longitude','yield_part','yield_moisture','yield_isfresh')):
            rejected.extend(dict(record=r['record_id'],reason='incompatible_context') for r in members);continue
        location='Tudun Wada' if c['country']=='Nigeria' and c['location']=='T/wada' else c['location']
        pair=dict(id=digest(key)[:20],country=c['country'],site=c['country']+'/'+location,location=location,
                  reference=c['reference'],trialId=c['trial_id'],variety=c['variety'],
                  latitude=num(c['latitude']),longitude=num(c['longitude']),
                  controlRecord=c['record_id'],treatmentRecord=t['record_id'],
                  controlKgHa=num(c['yield']),treatedKgHa=num(t['yield']),
                  deltaKgHa=num(t['yield'])-num(c['yield']),
                  doseReported={n:num(t[f'{n}_fertilizer']) for n in ('N','P','K')},
                  moisturePercent=None,year=None,denominator='not_verified',assignment='not_verified',
                  unit='kg grain/ha as reported; moisture unspecified',license='CC-BY-4.0')
        pairs.append(pair)
    return pairs,rejected


def source_audit(base,rows):
    result={'carob':{'rows':len(rows),'countryCropCounts':dict(Counter(r['country']+'|'+r['crop'] for r in rows)),
                     'missingMoisture':sum(not r['yield_moisture'] for r in rows),'missingPlantingDate':sum(not r['planting_date'] for r in rows),
                     'reportedPageRows':7555,'archiveRows':len(rows)}}
    for name,sheet in [('ofra','Raw'),('senegal','Sheet1')]:
        book=Workbook(base/f'raw/{name}.xlsx')
        raw=list(book.rows(sheet));headers=[str(v).strip() if v is not None else '' for v in raw[0][1]]
        if name=='senegal':
            records=list(book.records(sheet))
            result[name]={'rows':len(records),'numericYieldRows':sum(any(num(r.get(k)) is not None for k in ('yield.wb.kg_ha','yield.db.kg_ha')) for _,r in records),
                          'crops':dict(Counter(str(r.get('crop')) for _,r in records)),
                          'status':'acquired_read_not_paired','reason':'Treatment names mix cultivars and interventions; confirm same cultivar, water, product, denominator and experimental arms in cited papers before pooling. Soil file not joined.'}
        else:
            # Preserve source header names in the audit, rather than guessing units.
            country=next(i for i,k in enumerate(headers) if k.lower()=='country')
            crop=next(i for i,k in enumerate(headers) if k.lower()=='crop')
            useful=[r for _,r in raw[1:] if len(r)>max(country,crop) and r[country] and r[crop]]
            result[name]={'rawRows':len(raw)-1,'rowsWithCountryCrop':len(useful),'headers':headers,
                          'countries':dict(Counter(str(r[country]) for r in useful)),
                          'countryCropCounts':dict(Counter(str(r[country])+'|'+str(r[crop]) for r in useful)),
                          'status':'external_fitted_functions_not_raw_trials','reason':'Not independent yield observations; dose domain, background nutrients and formula must be qualified per citation.'}
        book.close()
    return result


def freeze(pairs):
    sites=sorted({r['site'] for r in pairs});other=[s for s in sites if not s.startswith('Togo/')]
    other.sort(key=lambda s:hashlib.sha256(('fertilizer-20261102|'+s).encode()).hexdigest())
    nv=max(1,round(len(other)*.2));nt=max(1,round(len(other)*.2))
    split={s:'validation' if i<nv else 'test' if i<nv+nt else 'train' for i,s in enumerate(other)}
    split.update({s:'test' for s in sites if s.startswith('Togo/')})
    return dict(version='fertilizer-protocol-2',registeredOn='2026-11-02',pairsSha256=digest(pairs),splitBySite=split,
                siteAliases={'Nigeria/T/wada':'Nigeria/Tudun Wada'},
                priorRun='Initial split invalidated after identifying adjacent T/wada and Tudun Wada aliases. Original protocol/scores retained under invalidated-alias-split. No scores used to tune the correction. Test labels have been exposed; this is a research diagnostic, not a pristine certification test.',
                target='matched NPK minus absolute control; kg grain/ha as reported, not certified dry product',
                weighting='equal locality, then equal matched pairs within locality',
                candidates=['site_weighted_mean','ridge_context_0.1','ridge_context_1','ridge_context_10'],
                predictors=['latitude','longitude','reported N','reported P','reported K'],
                predictorQualification='Geographic and stated dose context only; soil methods/timing not known, so soil excluded. No control yield used as a predictor.',
                selection='validation locality-weighted delta MAE; fit on train only; final test never tunes',
                acceptance=dict(minRelativeMAEImprovement=.1,maxDeltaMAETonnesHa=.5,maxAbsDeltaBiasTonnesHa=.25,
                                minIndependentTargetSites=5,requireMoistureDenominatorAndAssignment=True),
                rationale='Screen for <500 kg/ha gain error and <250 kg/ha systematic gain bias; at least 10% better than a simple mean. Even passing this research screen cannot activate advice without qualified units and prospective review.',
                unavailableCandidates={'dose_plateau':'One NPK dose per matched experimental unit; cross-site dose differences do not identify a causal optimum.',
                                       'QUEFTS':'No qualified crop uptake/soil nutrient supply and efficiency bounds for these contrasts. Fitting arbitrary efficiencies would not implement a justified QUEFTS comparison.',
                                       'WOFOST_SNOMIN':'No daily forcing, dated applications, cultivar phenology and initial mineral N compatible with these pairs.'},
                uncertainty='95% split-conformal interval using validation locality max residual; return unavailable if too few localities for finite 95% quantile.',
                temporalValidation='Unavailable: no qualified year/campaign dates in this Carob snapshot.',productionEnabled=False)


def weights(rows):
    counts=Counter(r['site'] for r in rows)
    return [1/len(counts)/counts[r['site']] for r in rows]


def solve(a,b):
    a=[list(row)+[value] for row,value in zip(a,b)]
    for j in range(len(b)):
        p=max(range(j,len(b)),key=lambda i:abs(a[i][j]));a[j],a[p]=a[p],a[j]
        if abs(a[j][j])<1e-12:raise ValueError('Singular regression')
        scale=a[j][j];a[j]=[v/scale for v in a[j]]
        for i in range(len(b)):
            if i!=j:
                scale=a[i][j];a[i]=[v-scale*w for v,w in zip(a[i],a[j])]
    return [r[-1] for r in a]


def features(r):
    return [r['latitude'],r['longitude'],*[r['doseReported'][n] for n in ('N','P','K')]]


def fit(rows,candidate,target):
    w=weights(rows);y=[r[target]/1000 for r in rows]
    if candidate=='site_weighted_mean':return dict(candidate=candidate,coefficients=[sum(a*b for a,b in zip(w,y))])
    raw=[features(r) for r in rows]
    if any(v is None for row in raw for v in row):raise ValueError('Required predictor missing; no silent imputation')
    means=[sum(a*row[j] for a,row in zip(w,raw)) for j in range(5)]
    scales=[max(1e-8,math.sqrt(sum(a*(row[j]-means[j])**2 for a,row in zip(w,raw)))) for j in range(5)]
    x=[[1]+[(v-m)/s for v,m,s in zip(row,means,scales)] for row in raw];n=len(x[0]);penalty=float(candidate.rsplit('_',1)[1])
    a=[[sum(p*r[i]*r[j] for p,r in zip(w,x))+(penalty if i==j and i else 0) for j in range(n)] for i in range(n)]
    b=[sum(p*r[j]*v for p,r,v in zip(w,x,y)) for j in range(n)]
    return dict(candidate=candidate,coefficients=solve(a,b),means=means,scales=scales)


def predict(model,rows):
    if model['candidate']=='site_weighted_mean':return [model['coefficients'][0]]*len(rows)
    x=[[1]+[(v-m)/s for v,m,s in zip(features(r),model['means'],model['scales'])] for r in rows]
    return [sum(a*b for a,b in zip(model['coefficients'],r)) for r in x]


def metrics(rows,pred,target='deltaKgHa'):
    if not rows:return None
    if len(pred)!=len(rows) or any(not math.isfinite(p) for p in pred):raise ValueError('Incomplete prediction vector')
    err=[p-r[target]/1000 for r,p in zip(rows,pred)];w=weights(rows)
    return dict(pairs=len(rows),localities=len({r['site'] for r in rows}),unit='t grain/ha as reported; moisture unspecified',
                MAE=sum(a*abs(e) for a,e in zip(w,err)),RMSE=math.sqrt(sum(a*e*e for a,e in zip(w,err))),bias=sum(a*e for a,e in zip(w,err)))


def evaluate(pairs,protocol):
    if digest(pairs)!=protocol['pairsSha256']:raise ValueError('Pairs changed after protocol freeze')
    split=protocol['splitBySite']
    if set(split)!={r['site'] for r in pairs} or set(split.values())!={'train','validation','test'}:raise ValueError('Invalid site split')
    subsets={s:[r for r in pairs if split[r['site']]==s] for s in ('train','validation','test')}
    train,validation,test=[subsets[s] for s in ('train','validation','test')]
    candidates={name:fit(train,name,'deltaKgHa') for name in protocol['candidates']}
    scores={name:metrics(validation,predict(model,validation)) for name,model in candidates.items()}
    selected=min(scores,key=lambda name:scores[name]['MAE']);model=candidates[selected]
    pred=predict(model,test);base=predict(candidates['site_weighted_mean'],test)
    score=metrics(test,pred);baseline=metrics(test,base);improvement=1-score['MAE']/baseline['MAE'] if baseline['MAE'] else 0
    errors=defaultdict(list)
    for r,p in zip(validation,predict(model,validation)):errors[r['site']].append(abs(p-r['deltaKgHa']/1000))
    rank=math.ceil((len(errors)+1)*.95);maxima=sorted(max(v) for v in errors.values())
    radius=maxima[rank-1] if rank<=len(maxima) else None
    y0=fit(train,selected,'controlKgHa');p0=predict(y0,test);p1=[a+b for a,b in zip(p0,pred)]
    bycountry={country:metrics([r for r in test if r['country']==country],[p for r,p in zip(test,pred) if r['country']==country]) for country in sorted({r['country'] for r in test})}
    criteria=protocol['acceptance'];reasons=[]
    if improvement<criteria['minRelativeMAEImprovement']:reasons.append('insufficient_improvement_over_mean')
    if score['MAE']>criteria['maxDeltaMAETonnesHa']:reasons.append('gain_error_too_large')
    if abs(score['bias'])>criteria['maxAbsDeltaBiasTonnesHa']:reasons.append('gain_bias_too_large')
    targetsites={r['site'] for r in test if r['country'] in COUNTRIES}
    if len(targetsites)<criteria['minIndependentTargetSites']:reasons.append('insufficient_independent_target_localities')
    reasons+=['moisture_denominator_and_assignment_unqualified','no_temporal_or_prospective_validation']
    report=dict(version='fertilizer-research-1',pairsSha256=digest(pairs),protocolSha256=digest(protocol),
                status='research_only_criteria_failed',productionEnabled=False,forecastValidated=False,
                selectedCandidate=selected,selectionScores=scores,model=model,baseline=baseline,test=score,
                yieldControl=metrics(test,p0,'controlKgHa'),yieldTreated=metrics(test,p1,'treatedKgHa'),
                relativeMAEImprovement=improvement,byCountry=bycountry,
                bySite={s:metrics([r for r in test if r['site']==s],[p for r,p in zip(test,pred) if r['site']==s]) for s in sorted({r['site'] for r in test})},
                weakResponse={'definition':'observed gain <=500 kg/ha, includes negative gains',
                              'sensitivity':sum(p<=.5 and r['deltaKgHa']<=500 for r,p in zip(test,pred))/max(1,sum(r['deltaKgHa']<=500 for r in test)),
                              'trueWeak':sum(r['deltaKgHa']<=500 for r in test)},
                interval95={'radiusTonnesHa':radius,'validationLocalities':len(maxima),
                            'coverage':sum(abs(p-r['deltaKgHa']/1000)<=radius for r,p in zip(test,pred))/len(test) if radius is not None else None,
                            'widthTonnesHa':2*radius if radius is not None else None,'certified':False,
                            'reason':'Too few calibration localities for finite 95% group conformal interval; exchangeability with Togo unestablished.' if radius is None else 'Nominal group-conformal calculation only; transfer exchangeability unestablished.'},
                splitSummary={k:dict(pairs=len(v),localities=len({r['site'] for r in v})) for k,v in subsets.items()},
                economicDecisionError=None,economicReason='No verified prices/costs or alternative dose gradients in these pairs.',
                failedCriteria=reasons,unavailableCandidates=protocol['unavailableCandidates'],
                missingnessSensitivity='No soil imputation: soil excluded because analytical method and pre-treatment status are unqualified. All chosen geographic/dose predictors complete.',
                domain='maize NPK vs absolute control; 25 published locality groups, not necessarily 25 independent study clusters; no parcel prescription')
    predictions=[dict(id=r['id'],site=r['site'],observedDeltaTonnesHa=r['deltaKgHa']/1000,predictedDeltaTonnesHa=p) for r,p in zip(test,pred)]
    return report,predictions


def quantile(values,p):
    v=sorted(values);i=(len(v)-1)*p;lo=math.floor(i);hi=math.ceil(i)
    return v[lo]+(v[hi]-v[lo])*(i-lo)


def ui_evidence(pairs,report):
    summaries=[]
    for site in sorted({r['site'] for r in pairs if r['country'] in COUNTRIES}):
        rs=[r for r in pairs if r['site']==site];r=rs[0]
        summaries.append(dict(country=COUNTRIES[r['country']],cropId='maize',location=r['location'],site=site,pairs=len(rs),
                              controlMedianTonnesHa=statistics.median(x['controlKgHa']/1000 for x in rs),
                              treatedMedianTonnesHa=statistics.median(x['treatedKgHa']/1000 for x in rs),
                              deltaMedianTonnesHa=statistics.median(x['deltaKgHa']/1000 for x in rs),
                              deltaObserved80=[quantile([x['deltaKgHa']/1000 for x in rs],q) for q in (.1,.9)],
                              negativePairs=sum(x['deltaKgHa']<0 for x in rs),doseReported=r['doseReported'],
                              distinctDoseVectors=len({tuple(x['doseReported'].values()) for x in rs}),
                              independentStudyCount=1,year=None,denominator='not_verified',moisture='not_reported',
                              source='https://doi.org/10.7910/DVN/GXUNAZ',license='CC-BY-4.0'))
    return dict(version='fertilizer-evidence-1',checkedOn='2026-11-02',availableOn='2026-11-02',source='https://doi.org/10.7910/DVN/GXUNAZ',
                license='CC-BY-4.0',attribution='Kihara, Okeyo, Bolo, Kinyua (2020), Harvard Dataverse v2.2; Carob standardization.',
                productionEnabled=False,forecastValidated=False,summaries=summaries,
                calibration={k:report[k] for k in ('version','status','selectedCandidate','test','byCountry','splitSummary','relativeMAEImprovement','failedCriteria','interval95')},
                limits=['Contrastes appariés publiés, pas des prévisions pour votre parcelle.',
                        'Humidité, année, attribution aléatoire et surface de référence non vérifiées : interprétation causale et transfert limités.',
                        'Les barres sont les 10e–90e percentiles des différences observées, pas des intervalles prédictifs ni des intervalles de confiance.',
                        'Une dose NPK par unité expérimentale ne permet pas de calculer une dose optimale. P/K conservés tels que rapportés, sans conversion vers des produits commerciaux.',
                        'Ces témoins ne sont pas des Ym sans stress hydrique. Aucun gain expérimental n’est ajouté à une moyenne nationale.'])


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--prepare',action='store_true');p.add_argument('--evaluate',action='store_true');a=p.parse_args()
    manifest,rows=originals(BASE);pairs,rejected=paired(rows)
    if a.prepare:
        protocol=freeze(pairs);path=DOC/'PROTOCOL-v2.json'
        if path.exists() and json.loads(path.read_text())!=protocol:raise ValueError('Protocol already frozen; use a new version')
        write(path,protocol);write(BASE/'pairs.json',pairs);write(BASE/'rejected.json',rejected);write(DOC/'SOURCE_AUDIT.json',source_audit(BASE,rows))
        with (BASE/'pairs.csv').open('w',newline='') as f:
            fields=['id','country','site','reference','trialId','controlRecord','treatmentRecord','controlKgHa','treatedKgHa','deltaKgHa','N_reported','P_reported','K_reported','moisturePercent','year','denominator','assignment','unit','license']
            w=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");w.writeheader()
            for r in pairs:w.writerow({**{k:r[k] for k in fields if k in r},**{n+'_reported':r['doseReported'][n] for n in ('N','P','K')}})
        audit=json.loads((DOC/'SOURCE_AUDIT.json').read_text());crops=sorted({r['crop'] for r in rows}|{s.lower() for s in audit['senegal']['crops']})
        with (DOC/'COVERAGE.csv').open('w',newline='') as f:
            w=csv.DictWriter(f,fieldnames=['country','crop','system','evidence','rawRows','matchedPairs','localityGroups','independentStudiesVerified','doseCoverage','validated'],lineterminator='\n');w.writeheader()
            for country,code in COUNTRIES.items():
                for crop in crops:
                    rs=[r for r in pairs if r['country']==country and crop=='maize']
                    w.writerow(dict(country=code,crop=crop,system='unqualified',evidence='Carob published compilation',rawRows=audit['carob']['countryCropCounts'].get(country+'|'+crop,0),matchedPairs=len(rs),localityGroups=len({r['site'] for r in rs}),independentStudiesVerified='',doseCoverage='NPK fixed dose within matched unit' if rs else '',validated=False))
        print(json.dumps({'preparedPairs':len(pairs),'localities':len({r['site'] for r in pairs}),'sha256':digest(pairs)}))
    if a.evaluate:
        report,predictions=evaluate(pairs,json.loads((DOC/'PROTOCOL-v2.json').read_text()))
        write(DOC/'VALIDATION.json',report);write(BASE/'test-predictions.json',predictions)
        write(ROOT/'data/seasonal/fertilizer-evidence.json',ui_evidence(pairs,report))
        print(json.dumps({k:report[k] for k in ('status','test','byCountry','splitSummary','failedCriteria')}))
    if not(a.prepare or a.evaluate):p.error('Choose --prepare or --evaluate')


if __name__=='__main__':main()
