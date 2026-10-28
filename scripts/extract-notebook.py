#!/usr/bin/env python3
"""Reconstitute the v22 arithmetic reference, never train a replacement model.

Usage: python scripts/extract-notebook.py /path/to/memoire_togo_v22_complet_execute.ipynb
Requires numpy==2.3.5 and pandas==2.2.3. All archive entries and source file
hashes are checked before executing the two audited, embedded Python modules.
"""
from pathlib import Path
import argparse, ast, base64, datetime, hashlib, importlib.util, io, json, sys, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
LIMITATIONS = [
    "Reconstitution du calcul v22 depuis ses entrées embarquées ; le CSV final v22 n'est pas joint au notebook.",
    "Résultats exploratoires, sans validation opérationnelle ni nouveau test aveugle.",
    "La moyenne des cinq dernières observations disponibles est constante entre 2025, 2026 et 2027 ; elle ne décrit pas une évolution annuelle.",
    "Les dernières observations datent de 2005 à 2019 selon la série ; aucune météo future n'est utilisée.",
    "Aucun intervalle statistique n'a été produit pour ces estimations finales.",
    "Grille historique de 35 unités : les correspondances administratives après 2015 restent à vérifier.",
    "Les superficies FEWS sont semées ; pour HarvestStat, la distinction entre superficie semée et récoltée reste non résolue.",
    "Les dates de disponibilité historique des publications ne sont pas vérifiées."
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def literal_assignments(source):
    result = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0], ast.Name):
            try: result[node.targets[0].id] = ast.literal_eval(node.value)
            except (ValueError, TypeError): pass
    return result

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def extract(notebook_path):
    import numpy as np
    import pandas as pd
    if np.__version__ != '2.3.5' or pd.__version__ != '2.2.3':
        raise RuntimeError('Utiliser numpy==2.3.5 et pandas==2.2.3 pour cette reconstitution.')
    raw = notebook_path.read_bytes()
    nb = json.loads(raw)
    src=lambda i: ''.join(nb['cells'][i]['source'])
    snapshot_values=literal_assignments(src(4))
    protocol=literal_assignments(src(2))['PROTOCOL']
    source_run=json.loads(''.join(nb['cells'][64]['outputs'][0]['text']))
    assert protocol['production_model']=='recent_mean5' and protocol['production_recent_observations']==5
    snapshot=base64.b64decode(snapshot_values['SNAPSHOT_BASE64'],validate=True)
    assert sha(snapshot)==snapshot_values['SNAPSHOT_SHA256'], 'Archive altérée'
    with tempfile.TemporaryDirectory(prefix='agriprevision-v22-') as temp:
        work=Path(temp)
        with zipfile.ZipFile(io.BytesIO(snapshot)) as z:
            for entry in z.infolist():
                destination=(work/entry.filename).resolve()
                if not destination.is_relative_to(work): raise ValueError('Chemin archive dangereux')
            z.extractall(work)
        for item in snapshot_values['INPUT_MANIFEST']:
            b=(work/item['path']).read_bytes()
            assert len(b)==item['bytes'] and sha(b)==item['sha256'],item['path']
        # These exact audited notebook modules are kept in the source repository.
        for cell, name in [(6,'build_panel.py'),(16,'baselines.py')]:
            code='\n'.join(src(cell).splitlines()[1:])
            saved=ROOT/'science-source'/name
            assert saved.read_text()==code, f'Module différent du notebook : {name}'
            (work/name).write_text(code)
        builder=load_module('agriprevision_panel',work/'build_panel.py')
        baselines=load_module('agriprevision_baselines',work/'baselines.py')
        result=work/'results'
        builder.build(work/'originals',result)
        panel=pd.read_csv(result/'canonical_panel.csv')
        manifest=json.loads((result/'panel_manifest.json').read_text())
        assert len(panel)==2014 and panel.groupby(['crop','prefecture_modele_35']).ngroups==152
        # Only the relevant national reader is evaluated. No sklearn import,
        # candidate fitting, temporal competition or notebook execution occurs.
        fn=next(x for x in ast.parse(src(18).split('\n',1)[1]).body if isinstance(x,ast.FunctionDef) and x.name=='read_national')
        namespace={'pd':pd}
        exec(compile(ast.Module(body=[fn],type_ignores=[]),'<v22 read_national>','exec'),namespace)
        national=namespace['read_national'](work/'originals/root/FAOSTAT_data_en_8-31-2026.csv')
        observations=[]
        for row in panel.to_dict('records'):
            observations.append({'id':f"obs:{row['crop']}:{row['prefecture_modele_35']}:{row['harvest_year']}",
                'crop':row['crop'],'year':int(row['harvest_year']),'territory':row['prefecture_modele_35'],
                'region':row['region'],'level':'Préfecture historique','yield':float(row['yield_t_ha']),
                'source':row['source_id'],'areaDefinition':row['area_semantics'],
                'geographyStatus':row['geography_status'],'rawFile':row['raw_file'],
                'rawRecord':str(row['raw_record_id']),'rawSha256':row['raw_file_sha256']})
        latest=panel.sort_values('harvest_year').drop_duplicates(['crop','prefecture_modele_35'],keep='last')
        forecasts=[]
        for year in [2025,2026,2027]:
            targets=latest[['crop','region','prefecture_modele_35']].assign(harvest_year=year)
            exact=baselines.predict_baselines(panel,national,targets,label_cutoff=2019,national_cutoff=min(year-2,int(national.harvest_year.max())))
            exact=exact[exact.model.eq('recent_mean5')]
            for row in exact.to_dict('records'):
                history=panel[(panel.crop==row['crop'])&(panel.prefecture_modele_35==row['prefecture_modele_35'])].sort_values('harvest_year').tail(5)
                val=float(history.yield_t_ha.mean())
                assert abs(val-float(row['prediction_t_ha']))<1e-12
                lineage=[{'observationId':f"obs:{h.crop}:{h.prefecture_modele_35}:{h.harvest_year}",'year':int(h.harvest_year),'yield':float(h.yield_t_ha),'weight':1/len(history),'areaDefinition':h.area_semantics,'source':h.source_id} for h in history.itertuples()]
                assert abs(sum(h['yield']*h['weight'] for h in lineage)-val)<1e-12
                forecasts.append({'id':f"v22:{row['crop']}:{row['prefecture_modele_35']}:{year}",
                    'crop':row['crop'],'year':year,'territory':row['prefecture_modele_35'],'region':row['region'],
                    'level':'Préfecture historique','yield':val,'model':'recent_mean5','version':'v22-reconstitution',
                    'issuedAt':source_run['generated_utc'],'decisionDate':'2025-12-31' if year==2025 else '2026-08-15','status':'exploratoire',
                    'source':'Reconstitution du calcul v22 depuis ses entrées embarquées',
                    'areaDefinition':str(history.iloc[-1].area_semantics) if history.area_semantics.nunique()==1 else 'mixed_source_area_definitions',
                    'inputAreaDefinitions':sorted(history.area_semantics.unique().tolist()),
                    'lastObservationYear':int(history.harvest_year.max()),'observationCount':len(history),
                    'forecastType':{2025:'Estimation rétrospective',2026:'Prévision reconstruite — disponibilité non vérifiée',2027:'Projection sans météo future'}[year],
                    'lineage':lineage})
        assert len(forecasts)==456
        ages=[f['year']-f['lastObservationYear'] for f in forecasts]
        assert min(ages)==6 and max(ages)==22
        # Same v22 recent_mean5 and eligible gap-1 cohorts, reconstructed for
        # historical comparison. These are not the nested-selected-system scores.
        comparisons=[]
        for crop in sorted(panel.crop.unique()):
            for year in protocol['outer_years']+[2019]:
                train=panel[(panel.crop==crop)&(panel.harvest_year<=year-1)]
                target=panel[(panel.crop==crop)&(panel.harvest_year==year)&panel.prefecture_modele_35.isin(train.prefecture_modele_35)]
                if train.harvest_year.nunique()<5 or target.prefecture_modele_35.nunique()<3: continue
                pred=baselines.predict_baselines(panel,national,target,label_cutoff=year-1,national_cutoff=year-2)
                pred=pred[pred.model.eq('recent_mean5')]
                for r in pred.to_dict('records'):
                    actual=target[target.prefecture_modele_35==r['prefecture_modele_35']].iloc[0]
                    input_history=train[train.prefecture_modele_35==r['prefecture_modele_35']].sort_values('harvest_year').tail(5)
                    area_compatible=input_history.area_semantics.nunique()==1 and input_history.iloc[-1].area_semantics==actual.area_semantics
                    geography_compatible=actual.geography_status=='SAME_HARVESTSTAT_UNIT_ID' and input_history.geography_status.eq('SAME_HARVESTSTAT_UNIT_ID').all()
                    comparisons.append({'id':f"retrov22:{crop}:{r['prefecture_modele_35']}:{year}",
                        'crop':crop,'year':year,'territory':r['prefecture_modele_35'],'level':'Préfecture historique',
                        'prediction':float(r['prediction_t_ha']),'observation':float(actual.yield_t_ha),
                        'yield':float(r['prediction_t_ha']),'observedYield':float(actual.yield_t_ha),
                        'model':'recent_mean5','source':'Reconstitution rétrospective v22, horizon demandé 1 an',
                        'status':'rétrospectif exploratoire','areaDefinition':actual.area_semantics,
                        'geographyStatus':actual.geography_status,'labelCutoff':year-1,
                        'compatibleForMetrics':bool(area_compatible and geography_compatible),
                        'comparisonLimitation':None if area_compatible and geography_compatible else 'Définitions de superficie ou correspondances géographiques non concordantes : diagnostic uniquement.',
                        'inputAreaDefinitions':sorted(input_history.area_semantics.unique().tolist()),
                        'evaluationScope':'DESCRIPTIVE_2019_ALREADY_CONSULTED' if year==2019 else ('DIAGNOSTIC_2016_2018_SOURCE_AND_BOUNDARY_UNRESOLVED' if year>=2016 else 'RETROSPECTIVE_SAME_HARVESTSTAT_GRID_ALREADY_CONSULTED')})
        data={'meta':{'notebook':notebook_path.name,'sha256':sha(raw),
            'snapshotSha256':sha(snapshot),'sourceDescription':'Reconstitution du calcul v22 depuis ses entrées embarquées',
            'limitations':LIMITATIONS,'generatedAt':source_run['generated_utc'],
            'reconstructedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'version':'v22','executedCells':[50,58,62,64],
            'model':'recent_mean5','isDemo':False,'operationallyValidated':False,
            'hasStatisticalIntervals':False,'sourceManifest':manifest,
            'reconstructionChecks':{'snapshotFilesVerified':len(snapshot_values['INPUT_MANIFEST']),
                'canonicalRows':len(panel),'series':152,'forecastRows':len(forecasts),
                'minLabelAge':min(ages),'maxLabelAge':max(ages),'allExactBaselineAndLineageChecksPassed':True},
            'comparisonsDescription':'Référence recent_mean5 reconstituée sur les cohortes admissibles à horizon demandé 1 an ; distincte des scores du système sélectionné.'},
            'forecasts':forecasts,'observations':observations,'comparisons':comparisons}
        out=ROOT/'public/scientific-data.json'
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False))
        (ROOT/'lib/scientific-data.json').write_text(out.read_text())
        print(json.dumps({'output':str(out),'forecasts':len(forecasts),'observations':len(observations),'comparisons':len(comparisons),'bytes':out.stat().st_size,'checks':'PASS'},ensure_ascii=False))
        return data

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('notebook',type=Path)
    args=p.parse_args()
    extract(args.notebook.resolve())
