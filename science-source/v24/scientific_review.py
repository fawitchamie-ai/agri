"""Scientific interpretation of frozen forecasts; no refitting or post-2015 selection."""
from pathlib import Path
import json
import hashlib
import numpy as np
import pandas as pd

FR={'Maize':'maïs','Millet':'mil','Rice':'riz','Sorghum':'sorgho'}
KEY=['crop','geographic_level','territory','forecast_year']
BASELINES=['recent_mean5','last_observation','prefecture_climatology']

def read(path):
    return pd.read_csv(path,low_memory=False)

def run(results):
    out=Path(results)
    comparison=read(out/'comparaison_predictions_observations_2016_2027.csv')
    primary=comparison.primary_evaluation.astype('string').str.lower().isin(['true','1','1.0'])
    d=comparison[primary & comparison.signed_error_t_ha.notna()].copy()
    selected=d[d.model.eq('selected_system')].copy()
    pairs=[]
    for baseline in BASELINES:
        reference=d[d.model.eq(baseline)]
        columns=KEY+['prediction_t_ha','observed_t_ha']
        x=selected[columns].merge(reference[columns],on=KEY,suffixes=('_system','_reference'),validate='one_to_one')
        if not np.allclose(x.observed_t_ha_system,x.observed_t_ha_reference,rtol=0,atol=1e-12):
            raise ValueError('Different observations in paired baseline comparison')
        for (crop,level),g in x.groupby(['crop','geographic_level']):
            annual=g.assign(system_abs=(g.prediction_t_ha_system-g.observed_t_ha_system).abs(),
                            reference_abs=(g.prediction_t_ha_reference-g.observed_t_ha_reference).abs()).groupby('forecast_year')[['system_abs','reference_abs']].mean()
            a=float(annual.system_abs.mean());b=float(annual.reference_abs.mean())
            pairs.append(dict(crop=crop,geographic_level=level,baseline=baseline,n_pairs=len(g),n_campaigns=len(annual),
                              system_mae_macro_year=a,baseline_mae_macro_year=b,
                              gain_mae_pct=100*(1-a/b) if b>0 else np.nan,
                              campaigns_system_better=int((annual.system_abs<annual.reference_abs).sum()),
                              campaigns_system_worse=int((annual.system_abs>annual.reference_abs).sum()),
                              interpretation='DESCRIPTIVE_ALREADY_INSPECTED_NO_RESELECTION'))
    head=pd.DataFrame(pairs)
    head.to_csv(out/'baseline_head_to_head.csv',index=False)

    temporal=[]
    for (crop,level,territory),g in selected.groupby(['crop','geographic_level','territory']):
        g=g.sort_values('forecast_year')
        y=g.observed_t_ha.to_numpy(float);p=g.prediction_t_ha.to_numpy(float)
        errors=p-y;denom=float(np.sum((y-y.mean())**2))
        dy=np.diff(y);dp=np.diff(p)
        consecutive=np.diff(g.forecast_year.to_numpy(int))==1
        # Ties and nonconsecutive years cannot be counted as a correct direction.
        non_tie=consecutive&(np.abs(dy)>1e-12)&(np.abs(dp)>1e-12)
        corr=float(np.corrcoef(y,p)[0,1]) if len(y)>=3 and np.std(p)>1e-12 and np.std(y)>1e-12 else np.nan
        temporal.append(dict(crop=crop,geographic_level=level,territory=territory,n_campaigns=len(g),
                             mae=float(np.abs(errors).mean()),bias=float(errors.mean()),pearson_r=corr,
                             r2_diagnostic=1-float(np.sum(errors**2))/denom if denom>1e-24 else np.nan,
                             observed_std_t_ha=float(np.std(y,ddof=1)) if len(y)>1 else np.nan,
                             predicted_std_t_ha=float(np.std(p,ddof=1)) if len(p)>1 else np.nan,
                             centered_rmse_t_ha=float(np.sqrt(np.mean(((p-p.mean())-(y-y.mean()))**2))),
                             n_consecutive_changes=int(consecutive.sum()),n_non_tied_direction_pairs=int(non_tie.sum()),
                             n_predicted_ties=int((consecutive&(np.abs(dp)<=1e-12)).sum()),
                             direction_accuracy_pct=100*float((np.sign(dp[non_tie])==np.sign(dy[non_tie])).mean()) if non_tie.any() else np.nan,
                             interpretation='SHORT_SERIES_DESCRIPTIVE_YEAR_AND_HORIZON_CONFOUNDED'))
    dynamics=pd.DataFrame(temporal)
    dynamics.to_csv(out/'temporal_diagnostics.csv',index=False)

    nested=read(out/'nested_validation.csv')
    back=read(out/'backtest_predictions.csv')
    keys=['crop','geographical_level','forecast_horizon','origin_year','forecast_year','prefecture_modele_35']
    reference=back[back.model.eq('recent_mean5')][keys+['absolute_error_t_ha']].rename(columns={'absolute_error_t_ha':'reference_absolute_error_t_ha'})
    merged=nested.merge(reference,on=keys,validate='one_to_one')
    if (merged.maximum_inner_target_year.dropna()>merged.loc[merged.maximum_inner_target_year.notna(),'origin_year']).any():
        raise ValueError('An inner selection target is after its outer origin')
    summaries=[]
    for (crop,level,h),g in merged.groupby(['crop','geographical_level','forecast_horizon']):
        annual=g.groupby('forecast_year')[['absolute_error_t_ha','reference_absolute_error_t_ha']].mean()
        genuine=g[g.nested_selection_status.eq('NESTED_SELECTION')]
        a=float(annual.absolute_error_t_ha.mean());b=float(annual.reference_absolute_error_t_ha.mean())
        summaries.append(dict(crop=crop,geographical_level=level,forecast_horizon=int(h),n_rows=len(g),
                              outer_campaigns=int(g.forecast_year.nunique()),
                              nested_selection_campaigns=int(genuine.forecast_year.nunique()),
                              fallback_campaigns=int(g.loc[~g.nested_selection_status.eq('NESTED_SELECTION'),'forecast_year'].nunique()),
                              nested_system_macro_mae=a,reference_macro_mae=b,
                              gain_vs_mean5_pct=100*(1-a/b) if b>0 else np.nan,
                              maximum_evaluation_year=int(g.forecast_year.max()),
                              status='NESTED_SELECTION_PARTLY_AVAILABLE' if len(genuine) else 'REFERENCE_FALLBACK_ONLY_NOT_VALIDATED_SELECTION'))
    nested_summary=pd.DataFrame(summaries)
    nested_summary.to_csv(out/'nested_validation_summary.csv',index=False)

    pred=read(out/'predictions_2016_2027.csv')
    lineage=read(out/'forecast_input_lineage.csv')
    choice=json.loads((out/'forecast_model_selection.json').read_text())
    freeze=json.loads((out/'forecast_freeze_sha256.json').read_text())
    prediction_sha=hashlib.sha256((out/'predictions_2016_2027.csv').read_bytes()).hexdigest()
    if prediction_sha!=freeze['predictions_2016_2027.csv']:
        raise ValueError('Forecasts changed after freeze')
    if pred.train_end_year.gt(2015).any() or lineage.input_year.gt(2015).any():
        raise ValueError('Post-2015 inputs in fixed-origin forecasts')
    if any(d.get('maximum_selection_target_year') is not None and d['maximum_selection_target_year']>2015 for d in choice['decisions']):
        raise ValueError('Post-2015 targets used for model selection')
    observations=read(out/'official_observations_with_provenance.csv')
    unverified=observations.comparability_status.astype('string').str.contains('UNVERIFIED|UNRESOLVED|EXCLUDED_GEOGRAPH',regex=True,na=False)
    source_counts=observations.groupby(['source','geographic_level','comparability_status'],dropna=False).agg(
        unique_observations=('observation_id','nunique'),nonmissing_values=('observed_t_ha','count')).reset_index()
    source_counts.to_csv(out/'observation_counts_unique.csv',index=False)

    overview=[]
    metrics=read(out/'model_comparison.csv')
    for r in metrics[metrics.model.eq('selected_system')].itertuples():
        bas=head[(head.crop.eq(r.crop))&head.geographic_level.eq(r.geographic_level)]
        signs=dynamics[dynamics.crop.eq(r.crop)]
        overview.append(dict(crop=r.crop,geographic_level=r.geographic_level,n_campaigns=int(r.n_campaigns),mae=r.mae,mape_pct=r.mape_pct,
                             gain_vs_mean5_pct=r.gain_mae_pct,
                             beats_all_three_simple_baselines=bool(len(bas)==3 and bas.gain_mae_pct.gt(0).all()),
                             positive_temporal_correlation=bool(len(signs) and signs.pearson_r.gt(0).all()),
                             interval_claim='NOT_ESTABLISHED',
                             conclusion='RETROSPECTIVE_NATIONAL_EVALUATION_ONLY_NO_OPERATIONAL_CERTIFICATION'))
    summary=pd.DataFrame(overview)
    summary.to_csv(out/'scientific_claim_summary.csv',index=False)
    lines=['# Synthèse des performances et de leur portée',
           'La sélection des modèles repose sur les campagnes antérieures ou égales à 2015. La comparaison des années ultérieures est descriptive, ces observations ayant été consultées au cours du travail.',
           '## Résultats et références simples']
    for r in summary.itertuples():
        bas=head[head.crop.eq(r.crop)]
        text=' ; '.join(f"{b.baseline} : gain de MAE {b.gain_mae_pct:+.1f} %" for b in bas.itertuples())
        lines.append(f"Pour le {FR[r.crop]}, sur {r.n_campaigns} campagnes nationales : MAE {r.mae:.4f} t/ha, erreur relative moyenne {r.mape_pct:.1f} %. {text}. Ces différences sont descriptives. Le système {'améliore' if r.beats_all_three_simple_baselines else 'n’améliore pas'} simultanément les trois références simples.")
    lines+=['## Niveau moyen et variations annuelles',
            'Une faible erreur relative sur une série nationale peu variable ne démontre pas la capacité à prévoir les fluctuations entre récoltes. Le R² est descriptif, calculé avec la moyenne des observations évaluées comme dénominateur ; cette moyenne n’est pas un modèle entraîné. Les directions ne comptent ni les années non consécutives ni les égalités comme des succès.']
    for r in dynamics.itertuples():
        lines.append(f"{FR[r.crop]} : corrélation descriptive {r.pearson_r:.3f}, R² descriptif {r.r2_diagnostic:.3f}, écart-type observé {r.observed_std_t_ha:.4f} t/ha. Effectif : {r.n_campaigns} campagnes. Les choix de modèle différents selon l’horizon peuvent créer des ruptures de trajectoire.")
    lines+=['## Horizons et échelles réellement soutenus',
            'La validation imbriquée et les replis fixes sont séparés dans nested_validation_summary.csv. Les horizons sans origine externe disposant d’au moins trois campagnes internes ne constituent pas une validation de la sélection. Une prévision à douze ans peut exister sans validation imbriquée à douze ans. À origine unique, année et horizon sont confondus.',
            f"Les observations locales exclues pour géographie non vérifiée sont comptées une seule fois : {int(observations.loc[unverified,'observation_id'].nunique())}. Les lignes répliquées par modèle ne sont pas de nouvelles observations. Aucun score préfectoral post-2015 compatible n’est revendiqué.",
            '## Incertitude et portée des projections',
            'Aucun intervalle prédictif nominal n’est établi à tous les horizons. Le désaccord des modèles reste une analyse de sensibilité. L’état d’exécution des traitements Earth Engine et SPAM est précisé dans les comptes rendus. Les archives de publication disponibles en 2015 et les correspondances administratives demeurent nécessaires pour des revendications opérationnelles ou locales.',
            'Les résultats documentent les performances des méthodes sur les observations disponibles et les limites de prévision dans un contexte de données rares. L’interprétation tient compte des erreurs du mil, des performances des références simples et de l’absence de validation locale compatible après 2015.',
            '## Traçabilité des résultats',
            'Les comparaisons utilisent une cohorte commune de prédictions admissibles. Les contrôles de provenance documentent la coupure temporelle, les entrées et l’identité des fichiers de prévisions avant et après l’évaluation.',
            'Les modèles et leurs paramètres sont ceux du protocole défini avant la confrontation aux années évaluées. Les vérifications intégrées portent sur la cohérence des fichiers et le respect des coupures temporelles.']
    report='\n\n'.join(lines)+'\n'
    (out/'rapport_audit_scientifique.md').write_text(report,encoding='utf-8')
    audit={'prediction_sha256_unchanged':prediction_sha,'input_max_year':int(lineage.input_year.max()),
           'primary_unique_targets':int(selected[KEY].drop_duplicates().shape[0]),
           'post2015_reselection':False,'additional_test_suite_executed':False,
           'interpretation':'ADDED_DIAGNOSTICS_DO_NOT_CHANGE_FROZEN_MODELS'}
    (out/'scientific_review_status.json').write_text(json.dumps(audit,indent=2))
    return summary,head,dynamics,nested_summary,report
