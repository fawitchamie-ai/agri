"""Test a distinct, empirical hypothesis without harvest-time covariates.

Usage: python3 scripts/african-yield-benchmark.py /path/to/OAF.csv OUTDIR
The protocol is written BEFORE any estimator is fitted. Raw data are CC-BY-4.0,
Aramburu Merlos et al., Zenodo 11122388 (v2), Nature Communications (2024).
This is predictive association, not identification of fertilizer causal effects.
"""
import os
os.environ.setdefault('OMP_NUM_THREADS', '4')
from pathlib import Path
import sys, json, hashlib, time
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
features = ['lat', 'lon', 'elev', 'soil_clay', 'soil_pH', 'soil_orgC',
            'soil_ECEC', 'N_kg_ha', 'P_kg_ha', 'K_kg_ha', 'hybrid', 'plant_doy']
weather = ['season_prec_1', 'season_prec_2', 'season_prec_3']
protocol = {
    'version': 'oaf-hypothesis-2026-11-11.1', 'sourceDoi': '10.5281/zenodo.11122388',
    'sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
    'train': '2016-2018, excluding Nigeria',
    'selection': '2019, remove 0.05-degree spatial cells seen in training',
    'finalTemporal': '2020, remove spatial cells seen in 2016-2019',
    'finalGeographic': 'all Nigeria 2022 (115), no fitting or selection',
    'group': 'floor(lat/0.05), floor(lon/0.05); no farm identifier supplied',
    'featuresBeforeSeason': features,
    'featuresConditionalWeather': features + weather,
    'excluded': ['plant density measured at harvest', 'harvest date', 'season-ending adversities',
                 'weeding/pesticide totals not dated', 'plant_date_dev computed from full cluster season'],
    'candidates': ['constant training mean', 'ridge alpha=100, median missing + missing flags',
                   'histogram GBM 150 trees, 15 leaves, rate=.05, min_leaf=40, l2=10',
                   'same GBM monotone nondecreasing N/P/K (hypothesis, not optimal-dose model)'],
    'criterion': 'lowest selection RMSE; one frozen winner, no test tuning',
    'metrics': ['MAE kg/ha', 'RMSE kg/ha', 'bias kg/ha', 'nRMSE / mean observed', 'R2'],
    'scope': 'rainfed African maize; surveyed nutrient inputs are observational, not randomized',
    'weatherAvailability': 'Full-season rain is hindsight or an explicit future weather SCENARIO, never known before sowing.',
    'timing': 'Soil/time inputs are mapped covariates; source availability history not established.'
}
(out / 'protocol-before-fit.json').write_text(json.dumps(protocol, indent=2)+'\n')
d = pd.read_csv(src)
for c in features + weather:
    if d[c].dtype == object:
        d[c] = d[c].map({True: 1., False: 0., 'True': 1., 'False': 0.})
    d[c] = pd.to_numeric(d[c], errors='coerce')
d['spatial_group'] = (np.floor(d.lat/.05).astype(int).astype(str) + ':' +
                      np.floor(d.lon/.05).astype(int).astype(str))
seen_train = set(d.loc[d.year <= 2018, 'spatial_group'])
seen_dev = set(d.loc[d.year <= 2019, 'spatial_group'])
masks = {
    'train': (d.year <= 2018) & (d.iso != 'NGA'),
    'selection': (d.year == 2019) & ~d.spatial_group.isin(seen_train),
    'temporal_2020_spatial_new': (d.year == 2020) & ~d.spatial_group.isin(seen_dev),
    'temporal_2020_all': d.year == 2020,
    'geographic_nigeria_2022': d.iso == 'NGA'
}
assert all(masks[k].sum() > 0 for k in masks)
y = d.yield_kg_ha.to_numpy()
def metrics(pred, obs):
    rmse = np.sqrt(mean_squared_error(obs, pred))
    return {'n': len(obs), 'maeKgHa': mean_absolute_error(obs, pred), 'rmseKgHa': rmse,
            'biasKgHa': float(np.mean(pred-obs)), 'nrmsePercent': 100*rmse/np.mean(obs),
            'r2': r2_score(obs, pred)}
results, models = [], {}
for scope, fs in [('preseason_covariates', features), ('conditional_full_weather', features+weather)]:
    x = d[fs].to_numpy(dtype=float)
    constraints = [1 if f in ['N_kg_ha', 'P_kg_ha', 'K_kg_ha'] else 0 for f in fs]
    estimators = {
        'constant': None,
        'ridge': make_pipeline(SimpleImputer(add_indicator=True), StandardScaler(), Ridge(alpha=100)),
        'gbm': HistGradientBoostingRegressor(max_iter=150, max_leaf_nodes=15, learning_rate=.05,
                    min_samples_leaf=40, l2_regularization=10, early_stopping=False, random_state=20261111),
        'gbm_monotone_npk': HistGradientBoostingRegressor(max_iter=150, max_leaf_nodes=15, learning_rate=.05,
                    min_samples_leaf=40, l2_regularization=10, early_stopping=False,
                    monotonic_cst=constraints, random_state=20261111)
    }
    for name, model in estimators.items():
        if model is not None: model.fit(x[masks['train']], y[masks['train']])
        pred = np.full(len(d), np.mean(y[masks['train']])) if model is None else np.maximum(0, model.predict(x))
        results.append({'scope': scope, 'model': name,
            'metrics': {k: metrics(pred[m], y[m]) for k, m in masks.items() if k != 'train'}})
        models[(scope, name)] = (model, fs)
        print(scope, name, json.dumps(results[-1]['metrics']), flush=True)

# Select before reading final-test errors for any parameter or model decision.
winner = min((r for r in results if r['model'] != 'constant'), key=lambda r:r['metrics']['selection']['rmseKgHa'])
summary = {'protocol': protocol, 'sklearn': sklearn.__version__,
           'sampleCounts': {k:int(m.sum()) for k,m in masks.items()},
           'countryCounts': d.iso.value_counts().to_dict(),
           'winnerBySelectionOnly': {k:winner[k] for k in ['scope','model']},
           'results': results,
           'limits': ['Exact farm IDs unavailable: spatial separation is a proxy, not proof of unique farmer identity.',
                      'Missingness at deployment must follow the measured training support.',
                      'No target-country local validation; Nigeria is a geographic transfer check, not Togo.',
                      'No randomized irrigation effect identified by this rainfed observational dataset.']}
(out/'results.json').write_text(json.dumps(summary,indent=2,allow_nan=False)+'\n')
print('WINNER',json.dumps(summary['winnerBySelectionOnly']))
