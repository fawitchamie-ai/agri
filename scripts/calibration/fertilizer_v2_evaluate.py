"""Evaluate the frozen source-separated v2 protocol, never export a predictor.

Run importer --prepare first; --evaluate refuses changed data or protocols.
All errors are in t grain/ha; bias = predicted minus observed.
"""
import argparse
from collections import Counter
import json
import math
import statistics

from fertilizer_pipeline import COUNTRIES, digest, quantile, solve, write
from fertilizer_v2_import import ROOT, BASE, DOC, prepare

P_CANDIDATES = ['mean','ridge_0.1','ridge_1','ridge_10']
N_CANDIDATES = ['mean','dose_mean','saturating_30','saturating_60','saturating_120']


def weights(rows, group):
    counts=Counter(r[group] for r in rows)
    return [1/len(counts)/counts[r[group]] for r in rows]


def features(r):
    return [r['treatedNutrients'][1]-r['baselineNutrients'][1],
            r['baselineNutrients'][0],r['baselineNutrients'][2],
            int(r['system']=='lowland'),int(r['irrigated']),int(r['season']=='dry')]


def fit_p(rows, candidate, target='deltaKgHa'):
    w=weights(rows,'site');y=[r[target]/1000 for r in rows]
    if candidate=='mean':return dict(candidate=candidate,coefficients=[sum(a*b for a,b in zip(w,y))])
    raw=[features(r) for r in rows]
    if any(v is None for rr in raw for v in rr):raise ValueError('Missing feature, no imputation')
    means=[sum(a*rr[j] for a,rr in zip(w,raw)) for j in range(6)]
    scales=[math.sqrt(sum(a*(rr[j]-means[j])**2 for a,rr in zip(w,raw))) for j in range(6)]
    scales=[s if s>1e-8 else 1 for s in scales]
    sites=sorted({r['site'] for r in rows}) if candidate=='hierarchical_ridge_1' else []
    x=[[1]+[(v-m)/s for v,m,s in zip(rr,means,scales)]+[int(r['site']==site) for site in sites]
       for rr,r in zip(raw,rows)]
    penalty=float(candidate.rsplit('_',1)[1]);size=len(x[0])
    a=[[sum(p*rr[i]*rr[j] for p,rr in zip(w,x))+(penalty if i==j and i else 0)
        for j in range(size)] for i in range(size)]
    b=[sum(p*rr[j]*v for p,rr,v in zip(w,x,y)) for j in range(size)]
    return dict(candidate=candidate,coefficients=solve(a,b),means=means,scales=scales,sites=sites)


def predict_p(model, rows):
    if model['candidate']=='mean':return [model['coefficients'][0]]*len(rows)
    return [sum(a*b for a,b in zip(model['coefficients'],
        [1]+[(v-m)/s for v,m,s in zip(features(r),model['means'],model['scales'])]
        +[int(r['site']==s) for s in model['sites']])) for r in rows]


def metrics(rows,pred,target='deltaKgHa',group='site'):
    if not rows:return None
    if len(pred)!=len(rows) or any(not math.isfinite(p) for p in pred):raise ValueError('Invalid predictions')
    w=weights(rows,group);err=[p-r[target]/1000 for r,p in zip(rows,pred)]
    return dict(pairs=len(rows),sites=len({r['site'] for r in rows}),campaigns=len({r['campaign'] for r in rows}),
        publications=len({r['publication'] for r in rows}),MAE=sum(a*abs(e) for a,e in zip(w,err)),
        RMSE=math.sqrt(sum(a*e*e for a,e in zip(w,err))),bias=sum(a*e for a,e in zip(w,err)),
        unit='t grain/ha at 14% moisture' if all(r['moisturePercent']==14 for r in rows) else 't grain/ha as reported; moisture unqualified',
        weighting='equal '+group+', then equal contrasts within group')


def p_selection(train):
    scores={}
    for candidate in P_CANDIDATES:
        rr=[];pp=[]
        for site in sorted({r['site'] for r in train}):
            fit=[r for r in train if r['site']!=site];valid=[r for r in train if r['site']==site]
            model=fit_p(fit,candidate);rr+=valid;pp+=predict_p(model,valid)
        scores[candidate]=metrics(rr,pp)
    selected=min(P_CANDIDATES,key=lambda c:scores[c]['MAE'])
    return selected,scores


def breakdown(rows,pred,group,metric_group):
    return {key:metrics([r for r in rows if r[group]==key],
        [p for r,p in zip(rows,pred) if r[group]==key],group=metric_group)
        for key in sorted({r[group] for r in rows},key=str)}


def screen(score,base,sites,qualified,interval,criteria):
    improvement=1-score['MAE']/base['MAE'] if base['MAE'] else 0
    failed=[]
    if improvement<criteria['minRelativeMAEImprovement']:failed.append('insufficient_improvement_over_mean')
    if score['MAE']>criteria['maxDeltaMAETonnesHa']:failed.append('delta_MAE_exceeds_0.5_t_ha')
    if abs(score['bias'])>criteria['maxAbsDeltaBiasTonnesHa']:failed.append('absolute_bias_exceeds_0.25_t_ha')
    if sites<criteria['minIndependentTargetSites']:failed.append('fewer_than_five_target_sites')
    if not qualified:failed.append('units_assignment_or_domain_not_qualified_for_parcel_prediction')
    if not interval:failed.append('usable_predictive_interval_unavailable')
    return dict(relativeMAEImprovement=improvement,failedCriteria=failed,passed=not failed,
        productionEnabled=False,prospectivelyValidated=False)


def evaluate_p(rows,criteria):
    predictions=[];folds=[]
    for country in sorted({r['country'] for r in rows}):
        train=[r for r in rows if r['country']!=country];test=[r for r in rows if r['country']==country]
        selected,scores=p_selection(train)
        model=fit_p(train,selected);base=fit_p(train,'mean');control=fit_p(train,selected,'controlKgHa')
        pp=predict_p(model,test);bb=predict_p(base,test);p0=predict_p(control,test)
        hp=predict_p(fit_p(train,'hierarchical_ridge_1'),test)
        folds.append(dict(heldOutCountry=country,selectedCandidate=selected,innerScores=scores,
            trainSites=sorted({r['site'] for r in train}),testSites=sorted({r['site'] for r in test}),
            model=model,controlModel=control,test=metrics(test,pp),baseline=metrics(test,bb),
            hierarchicalComparison=metrics(test,hp)))
        predictions.extend(dict(id=r['id'],split='outer_'+country,delta=p,baseline=b,control=c,treated=c+p,hierarchical=h)
            for r,p,b,c,h in zip(test,pp,bb,p0,hp))
    predictions.sort(key=lambda r:r['id']);lookup={p['id']:p for p in predictions}
    pred=[lookup[r['id']]['delta'] for r in rows];base=[lookup[r['id']]['baseline'] for r in rows]
    score=metrics(rows,pred);baseline=metrics(rows,base)
    resid=[r['deltaKgHa']/1000-p for r,p in zip(rows,pred)]
    lo,hi=quantile(resid,.1),quantile(resid,.9)
    w=weights(rows,'site')
    report=dict(source='AMAZXA',status='research_transfer_diagnostic',folds=folds,test=score,baseline=baseline,
        yieldControl=metrics(rows,[lookup[r['id']]['control'] for r in rows],'controlKgHa'),
        yieldTreated=metrics(rows,[lookup[r['id']]['treated'] for r in rows],'treatedKgHa'),
        byCountry=breakdown(rows,pred,'country','site'),bySystem=breakdown(rows,pred,'system','site'),
        bySite=breakdown(rows,pred,'site','site'),
        hierarchicalComparison=metrics(rows,[lookup[r['id']]['hierarchical'] for r in rows]),
        residualDescription=dict(residualQuantilesTonnesHa={'q10':lo,'q50':quantile(resid,.5),'q90':hi},
            retrospectiveCentral80Coverage=sum(a*(lo<=e<=hi) for a,e in zip(w,resid)),
            retrospectiveWidthTonnesHa=hi-lo,certified=False,
            reason='Quantiles use these same outer residuals; retrospective dispersion, not out-of-sample interval calibration.'),
        interval95=dict(radiusTonnesHa=None,coverage=None,widthTonnesHa=None,certified=False,
            reason='No independent calibration groups reserved; seven shared-publication sites do not establish a finite calibrated transfer interval.'),
        scope='Matched genotype P environment differences, neighboring fields, one publication; not a clean randomized fertilizer-only or prospective parcel effect.',
        domain=dict(crop='rice',targetSites=sorted({r['site'] for r in rows if r['country'] in COUNTRIES}),
            N=sorted({r['baselineNutrients'][0] for r in rows}),P=sorted({r['treatedNutrients'][1] for r in rows}),
            K=sorted({r['baselineNutrients'][2] for r in rows}),years=sorted({r['year'] for r in rows}),
            system=sorted({r['system'] for r in rows}),continuousDoseOptimization=False))
    report.update(screen(score,baseline,len(report['domain']['targetSites']),False,False,criteria))
    report['byTargetCountrySystem']={}
    for country in sorted(COUNTRIES):
        for system in sorted({r['system'] for r in rows}):
            rr=[r for r in rows if r['country']==country and r['system']==system]
            if not rr:continue
            pp=[lookup[r['id']]['delta'] for r in rr];bb=[lookup[r['id']]['baseline'] for r in rr]
            report['byTargetCountrySystem'][country+'|'+system]=dict(metrics=metrics(rr,pp),
                baseline=metrics(rr,bb),
                **screen(metrics(rr,pp),metrics(rr,bb),len({r['site'] for r in rr}),False,False,criteria))
    return report,predictions


def n_partition(rows):
    return {s:[r for r in rows if low<=r['year']<=high]
        for s,low,high in [('train',2015,2018),('validation',2019,2020),('test',2021,2022)]}


def fit_n(rows,candidate):
    w=weights(rows,'campaign');y=[r['deltaKgHa']/1000 for r in rows]
    if candidate=='mean':return dict(candidate=candidate,mean=sum(a*b for a,b in zip(w,y)))
    if candidate=='dose_mean':return dict(candidate=candidate,means={str(n):statistics.mean(
        r['deltaKgHa']/1000 for r in rows if r['treatedNutrients'][0]==n) for n in (60,120,180)})
    tau=int(candidate.rsplit('_',1)[1]);x=[1-math.exp(-r['treatedNutrients'][0]/tau) for r in rows]
    mx=sum(a*b for a,b in zip(w,x));my=sum(a*b for a,b in zip(w,y))
    b=sum(p*(a-mx)*(v-my) for p,a,v in zip(w,x,y))/sum(p*(a-mx)**2 for p,a in zip(w,x))
    return dict(candidate=candidate,tau=tau,a=my-b*mx,b=b)


def predict_n(model,rows):
    if any(r['treatedNutrients'] not in ([60,26,50],[120,26,50],[180,26,50]) for r in rows):
        raise ValueError('Outside documented dose domain; no zero-N extrapolation')
    if model['candidate']=='mean':return [model['mean']]*len(rows)
    if model['candidate']=='dose_mean':return [model['means'][str(int(r['treatedNutrients'][0]))] for r in rows]
    return [model['a']+model['b']*(1-math.exp(-r['treatedNutrients'][0]/model['tau'])) for r in rows]


def interval95(validation,pv,test,pt,target):
    maxima=[max(abs(p-r[target]/1000) for r,p in zip(validation,pv) if r['year']==year)
        for year in sorted({r['year'] for r in validation})]
    rank=math.ceil((len(maxima)+1)*.95)
    radius=sorted(maxima)[rank-1] if rank<=len(maxima) else None
    return dict(calibrationYears=len(maxima),requiredRank=rank,radiusTonnesHa=radius,
        coverage=None if radius is None else sum(a*(abs(p-r[target]/1000)<=radius)
            for a,r,p in zip(weights(test,'campaign'),test,pt)),
        widthTonnesHa=None if radius is None else 2*radius,certified=False,
        reason='Two validation years cannot supply finite 95% group quantile; repeated plots and model selection on validation also preclude certification.')


def evaluate_n(rows,criteria):
    split=n_partition(rows);train,valid,test=(split[s] for s in ('train','validation','test'))
    models={c:fit_n(train,c) for c in N_CANDIDATES}
    scores={c:metrics(valid,predict_n(m,valid),group='campaign') for c,m in models.items()}
    selected=min(N_CANDIDATES,key=lambda c:scores[c]['MAE']);model=models[selected]
    pv=predict_n(model,valid);pt=predict_n(model,test);bt=predict_n(models['mean'],test)
    # Three contrasts share each control: collapse identity before fitting level.
    controls={r['controlRecord']:r['controlKgHa']/1000 for r in train}
    control=statistics.mean(controls.values());v0=[control]*len(valid);t0=[control]*len(test)
    intervals=dict(delta=interval95(valid,pv,test,pt,'deltaKgHa'),
        control=interval95(valid,v0,test,t0,'controlKgHa'),
        treated=interval95(valid,[control+p for p in pv],test,[control+p for p in pt],'treatedKgHa'))
    score=metrics(test,pt,group='campaign');baseline=metrics(test,bt,group='campaign')
    report=dict(source='GFWCYQ',status='single_site_temporal_diagnostic',selectedCandidate=selected,
        selectionScores=scores,model=model,controlModel=dict(candidate='campaign_mean',valueTonnesHa=control),
        test=score,baseline=baseline,doseMeanReference=metrics(test,predict_n(models['dose_mean'],test),group='campaign'),
        yieldControl=metrics(test,t0,'controlKgHa','campaign'),
        yieldTreated=metrics(test,[control+p for p in pt],'treatedKgHa','campaign'),
        splitSummary={k:dict(pairs=len(v),campaigns=len({r['campaign'] for r in v}),years=sorted({r['year'] for r in v})) for k,v in split.items()},
        splitIds={k:[r['id'] for r in v] for k,v in split.items()},
        byCountry={'Senegal':score},bySystem={'lowland_irrigated':score},
        byYear=breakdown(test,pt,'year','campaign'),interval95=intervals,
        scope='Sahel 108, fully irrigated Ndiaye, repeated fertilizer regimes on same plots; includes decades of history, not a first-season input effect.',
        domain=dict(crop='rice',site='Senegal/Ndiaye',N=[60,120,180],P=26,K=50,years=[2015,2022],
            moisturePercent=None,continuousDoseOptimization=False),
        publishedCalendar=dict(scope='Observed Ndiaye experimental protocol only, not a personal recommendation',
            basalPKDaysAfterTransplant=14,NFractions=[.5,.25,.25],
            NStages=['14 days after transplant','panicle initiation','around 10 days before flowering'],
            source='https://doi.org/10.1371/journal.pone.0317170'))
    report.update(screen(score,baseline,1,False,False,criteria))
    predictions=[dict(id=r['id'],split='test',delta=p,baseline=b,control=control,treated=control+p) for r,p,b in zip(test,pt,bt)]
    return report,predictions


def evaluate(pairs,protocol):
    p,pp=evaluate_p([r for r in pairs if r['source']=='AMAZXA'],protocol['screen'])
    n,np=evaluate_n([r for r in pairs if r['source']=='GFWCYQ'],protocol['screen'])
    return dict(version='fertilizer-extension-evaluation-1',productionEnabled=False,prospectivelyValidated=False,
        AMAZXA=p,GFWCYQ=n),pp+np


def run():
    frozen=json.loads((BASE/'FREEZE.json').read_text());protocol=json.loads((DOC/'PROTOCOL.json').read_text())
    amendment=json.loads((DOC/'IMPLEMENTATION.json').read_text())
    rows,pairs,rejected,audit=prepare()
    if any([digest(protocol)!=frozen['protocolSha256'],digest(amendment)!=frozen['amendmentSha256'],
            digest(pairs)!=frozen['pairsSha256'],digest(rows)!=frozen['rowsSha256'],
            digest(rejected)!=frozen['rejectedSha256'],audit['sources']!=frozen['originals']]):
        raise ValueError('Inputs or protocol changed after freeze')
    report,predictions=evaluate(pairs,protocol)
    report['freezeSha256']=digest(frozen);report['pairsSha256']=digest(pairs)
    report['unavailableComparisons']=amendment['unavailableComparisons']
    write(DOC/'VALIDATION.json',report);write(BASE/'predictions.json',predictions)
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--evaluate',action='store_true',required=True);p.parse_args()
    r=run();print(json.dumps({s:{k:r[s][k] for k in ('test','baseline','relativeMAEImprovement','failedCriteria')} for s in ('AMAZXA','GFWCYQ')}))
