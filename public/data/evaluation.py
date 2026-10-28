"""Confrontation après gel des prévisions. Aucune fonction d'ajustement ici."""
from pathlib import Path
import json, hashlib
import numpy as np
import pandas as pd

KEY = ['crop','geographic_level','territory','forecast_year']

def normalize_forecasts(d):
    d=d.copy().rename(columns={'geographical_level':'geographic_level'})
    if 'geographic_level' not in d:
        d['geographic_level']=np.where(d.prefecture_modele_35.eq('Togo'),'national','prefecture')
    d['territory']=np.where(d.geographic_level.eq('national'),'Togo',d.prefecture_modele_35)
    d['forecast_year']=d.forecast_year.astype(int)
    d['forecast_horizon']=d.forecast_year-2015
    return d

def metric_values(d):
    z=d[d.observed_t_ha.notna() & d.prediction_t_ha.notna()].copy()
    e=z.prediction_t_ha-z.observed_t_ha
    mask=z.observed_t_ha.ge(.1)
    r=e[mask].abs()/z.loc[mask,'observed_t_ha']
    lower=pd.to_numeric(z.get('lower_interval_t_ha',pd.Series(np.nan,index=z.index)),errors='coerce')
    upper=pd.to_numeric(z.get('upper_interval_t_ha',pd.Series(np.nan,index=z.index)),errors='coerce')
    valid=lower.notna()&upper.notna()
    corr=np.nan
    if len(z)>=3 and z.prediction_t_ha.std()>1e-12 and z.observed_t_ha.std()>1e-12:
        corr=float(z.prediction_t_ha.corr(z.observed_t_ha))
    return dict(n=len(z),mae=float(e.abs().mean()),rmse=float(np.sqrt((e**2).mean())),bias=float(e.mean()),
                mape_pct=float(100*r.mean()),median_ape_pct=float(100*r.median()),within20_pct=float(100*(r<=.2).mean()),
                n_relative_eligible=int(mask.sum()),n_relative_excluded=int((~mask).sum()),
                n_campaigns=int(z.forecast_year.nunique()),n_territories=int(z.territory.nunique()),
                n_intervals=int(valid.sum()),coverage_pct=float(100*((z.observed_t_ha[valid]>=lower[valid])&(z.observed_t_ha[valid]<=upper[valid])).mean()) if valid.any() else np.nan,
                pearson_r=corr)

def grouped_metrics(d):
    rows=[]
    for (crop,level,model),g in d.groupby(['crop','geographic_level','model'],sort=True):
        base=dict(crop=crop,geographic_level=level,model=model)
        rows.append(dict(base,grouping='all',group_value='all',**metric_values(g)))
        for col in ['forecast_year','forecast_horizon','region']:
            if col not in g:continue
            for val,part in g.groupby(col,dropna=False,sort=True):
                rows.append(dict(base,grouping=col,group_value=str(val),**metric_values(part)))
    return pd.DataFrame(rows,columns=['crop','geographic_level','model','grouping','group_value',*metric_values(d.iloc[:0]).keys()])

def run(outdir):
    out=Path(outdir)
    pred_path=out/'predictions_2016_2027.csv'
    before=hashlib.sha256(pred_path.read_bytes()).hexdigest()
    selected=normalize_forecasts(pd.read_csv(pred_path))
    selected['effective_model']=selected['model']
    selected['model']='selected_system'
    candidates=normalize_forecasts(pd.read_csv(out/'candidates_all_forecasts.csv'))
    candidates['effective_model']=candidates['model']
    p=pd.concat([selected,candidates],ignore_index=True)
    if p.duplicated(KEY+['model']).any():raise ValueError('Prévisions non uniques')
    obs=pd.read_csv(out/'official_observations_with_provenance.csv',low_memory=False)
    obs['geographic_level']=obs.geographic_level.replace({'prefectural':'prefecture','regional':'region'})
    obs['original_territory']=obs.territory
    has_name=obs.geographic_level.eq('prefecture') & obs.prefecture_modele_35.notna() & obs.prefecture_modele_35.ne('')
    obs.loc[has_name,'territory']=obs.loc[has_name,'prefecture_modele_35']
    obs['forecast_year']=obs.forecast_year.astype(int)
    obs=obs[obs.forecast_year.between(2016,2026)].copy()
    if obs.observation_id.duplicated().any():raise ValueError('Identifiant observation dupliqué')
    obs['primary_evaluation']=obs.primary_evaluation.astype('string').str.strip().str.lower().isin(['true','1','1.0']).astype(bool)
    if obs.loc[obs.primary_evaluation].duplicated(KEY).any():raise ValueError('Deux vérités principales pour une cible')
    # Les données non comparables sont conservées sans calcul d'erreur.
    observation_cols=[c for c in obs if c not in p.columns or c in KEY]
    d=p.merge(obs[observation_cols],on=KEY,how='left',validate='many_to_many')
    d['primary_evaluation']=d.primary_evaluation.astype('string').str.strip().str.lower().isin(['true','1','1.0']).astype(bool)
    d['comparability_status']=d.comparability_status.fillna('NO_OBSERVATION')
    d['evaluation_status']=d.evaluation_status.fillna('NOT_EVALUATED_NO_OBSERVATION')
    d['source']=d.source.fillna('NO_OBSERVATION')
    national_fao=d.geographic_level.eq('national')&d.source.astype(str).str.contains('FAOSTAT',case=False)&d.observed_t_ha.notna()
    admitted=(d.primary_evaluation|national_fao)&d.observed_t_ha.notna()
    # Même un futur changement de source ne peut autoriser une jointure géographique non vérifiée.
    excluded_geo=d.comparability_status.str.contains('UNVERIFIED|UNRESOLVED|EXCLUDED_GEOGRAPH',case=False,regex=True)
    if (d.primary_evaluation&excluded_geo).any():raise ValueError('Géographie non validée présentée comme évaluable')
    prediction_ok=np.isfinite(pd.to_numeric(d.prediction_t_ha,errors='coerce')) & d.prediction_t_ha.gt(0)
    if 'model_status' in d:
        prediction_ok &= d.model_status.eq('OK')
    d['prediction_admitted_for_scores']=prediction_ok
    admitted &= ~excluded_geo & prediction_ok & np.isfinite(pd.to_numeric(d.observed_t_ha,errors='coerce')) & d.observed_t_ha.gt(0)
    d['signed_error_t_ha']=(d.prediction_t_ha-d.observed_t_ha).where(admitted)
    d['absolute_error_t_ha']=d.signed_error_t_ha.abs()
    eligible=admitted&d.observed_t_ha.ge(.1)
    d['relative_error_pct']=(100*d.signed_error_t_ha/d.observed_t_ha).where(eligible)
    d['absolute_relative_error_pct']=d.relative_error_pct.abs()
    d['within_20pct']=np.where(eligible,d.absolute_relative_error_pct.le(20).astype(float),np.nan)
    d['scientific_evaluation_status']=d.evaluation_status
    d.to_csv(out/'comparaison_predictions_observations_2016_2027.csv',index=False)
    main=d[d.primary_evaluation&admitted].copy()
    # Intersection explicite des cibles entre les modèles, avant comparaison.
    expected_models=p.groupby('geographic_level').model.apply(lambda s:sorted(s.unique())).to_dict()
    common=main.groupby(KEY).model.nunique()
    counts=common.rename('n_models').reset_index()
    counts['required_models']=counts.geographic_level.map({k:len(v) for k,v in expected_models.items()})
    common_keys=counts[counts.n_models.eq(counts.required_models)][KEY]
    same=main.merge(common_keys,on=KEY,how='inner',validate='many_to_one')
    metrics=grouped_metrics(same)
    metrics.to_csv(out/'metrics_by_crop_year_horizon.csv',index=False)
    comp=metrics[metrics.grouping.eq('all')].copy()
    reference=comp[comp.model.eq('recent_mean5')][['crop','geographic_level','mae','rmse']].rename(columns={'mae':'reference_mae','rmse':'reference_rmse'})
    comp=comp.merge(reference,on=['crop','geographic_level'],how='left',validate='many_to_one')
    comp['gain_mae_pct']=100*(1-comp.mae/comp.reference_mae.where(comp.reference_mae.gt(0)))
    comp['gain_rmse_pct']=100*(1-comp.rmse/comp.reference_rmse.where(comp.reference_rmse.gt(0)))
    comp['cohort']='INTERSECTION_SAME_OFFICIAL_OBSERVATIONS_ALL_MODELS'
    comp.to_csv(out/'model_comparison.csv',index=False)
    diag=d[admitted&~d.primary_evaluation].copy()
    grouped_metrics(diag).to_csv(out/'metrics_diagnostic_non_official.csv',index=False)
    d[d.model.eq('selected_system')&national_fao].to_csv(out/'national_selected_comparison.csv',index=False)
    audit={'forecast_sha256_before_evaluation':before,'forecast_sha256_after_evaluation':hashlib.sha256(pred_path.read_bytes()).hexdigest(),
           'primary_pairs_selected':int((same.model=='selected_system').sum()),'diagnostic_pairs_selected':int((diag.model=='selected_system').sum()),
           'models_same_cohort':expected_models,'n_common_targets':len(common_keys),
           'primary_years':sorted(same.forecast_year.unique().tolist()),'prefecture_primary_pairs':int((same.geographic_level=='prefecture').sum()),
           'excluded_unverified_pairs':int(excluded_geo.sum()),'excluded_unverified_unique_observations':int(d.loc[excluded_geo,'observation_id'].nunique()),'invalid_prediction_rows':int((~prediction_ok).sum()),'missing_observation_rows':int(d.observed_t_ha.isna().sum()),
           'relative_error_min_yield_t_ha':.1,'errors_sign':'prediction minus observation','score_is_retrospective_not_blind':True}
    assert audit['forecast_sha256_before_evaluation']==audit['forecast_sha256_after_evaluation']
    (out/'evaluation_audit.json').write_text(json.dumps(audit,indent=2))
    print(json.dumps(audit,ensure_ascii=False))
    return d,metrics,comp
