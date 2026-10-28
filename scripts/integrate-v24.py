#!/usr/bin/env python3
"""Freeze verified, byte-matching v24 exports into the web application's bundle.
Usage: python scripts/integrate-v24.py /path/reproduction/results /path/v24.ipynb
"""
from pathlib import Path
import argparse,csv,datetime,hashlib,json,math,shutil
ROOT=Path(__file__).resolve().parents[1]
EXPECTED='aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d'
CROPS={'Maize','Millet','Rice','Sorghum'}
LIMITATIONS=[
 'Résultats rétrospectifs à origine fixe 2015, reconstitués par réexécution exacte du protocole v24 ; aucune observation postérieure à 2015 ne réactualise les prévisions.',
 'Le CSV des 1 092 prévisions reproduit exactement l’empreinte SHA-256 conservée dans la sortie exécutée du notebook v24.',
 'Les statistiques historiques sont révisées : les publications réellement disponibles en 2015 ne sont pas archivées. Ce n’est pas un nouveau test aveugle.',
 'Les 28 paires nationales FAOSTAT de 2016 à 2022 forment l’évaluation principale. Les observations locales après 2015 ne sont pas validées géographiquement et sont exclues des scores.',
 'Les projections nationales ne constituent pas des prévisions validées pour une parcelle. La grille préfectorale est historique et ne garantit pas les limites administratives actuelles.',
 'Aucun intervalle prédictif nominal n’a été établi. Les variantes utilisateur et le désaccord entre modèles ne sont pas des intervalles statistiques.',
 'Le modèle peut varier selon l’horizon ; une rupture de la courbe n’est pas automatiquement une évolution agronomique prévue.',
 'Les superficies HarvestStat restent de sémantique semée/récoltée non résolue. Toute simulation locale comporte une hypothèse explicite sur sa superficie.',
 'Le supplément INSEED 2020–2024 n’était pas disponible pour cette reproduction : ses diagnostics sont absents ; il ne participe ni à l’apprentissage ni aux 28 paires principales.',
 'Les sorties des traitements GEE et SPAM ne sont pas des covariables validées de cette expérience.'
]
def sha(b):return hashlib.sha256(b).hexdigest()
def rows(p):
 with p.open(newline='') as f:return list(csv.DictReader(f))
def number(v):
 try:
  n=float(v)
  return n if math.isfinite(n) else None
 except (ValueError,TypeError):return None
def truth(v):return str(v).lower() in {'true','1','1.0'}
def level(v):return 'National' if v=='national' else 'Préfecture historique' if v in {'prefecture','prefectural'} else 'Région'
def integrate(source,notebook):
 p=source/'predictions_2016_2027.csv';h=sha(p.read_bytes())
 assert h==EXPECTED,'Le fichier ne correspond pas à la sortie v24 vérifiée.'
 nb=json.loads(notebook.read_bytes());audit=json.loads((source/'evaluation_audit.json').read_text())
 assert audit['primary_pairs_selected']==28 and audit['prefecture_primary_pairs']==0
 predictions=rows(p);assert len(predictions)==1092
 source_status=json.loads((source/'reproduction-status.json').read_text())
 now=datetime.datetime.now(datetime.timezone.utc).isoformat()
 generated=source_status.get('generatedAt',now)
 forecasts=[]
 for r in predictions:
  assert r['model_status']=='OK' and number(r['prediction_t_ha']) is not None
  forecasts.append({'id':f"v24:{r['crop']}:{r['geographical_level']}:{r['prefecture_modele_35']}:{r['forecast_year']}",
   'crop':r['crop'],'year':int(r['forecast_year']),'territory':r['prefecture_modele_35'],
   'region':r['region'],'level':level(r['geographical_level']),'yield':float(r['prediction_t_ha']),
   'model':r['model'],'version':'v24-origine2015','issuedAt':generated,
   'originYear':int(r['origin_year']),'cutoffYear':int(r['train_end_year']),
   'horizonYears':int(r['forecast_horizon']),'status':'exploratoire',
   'source':'Réexécution exacte du protocole v24 — CSV conforme à l’empreinte du notebook',
   'areaDefinition':'FAOSTAT_YIELD_DEFINITION_national' if r['geographical_level']=='national' else 'cropped_area_reported_harvested_vs_planted_unresolved',
   'lastObservationYear':int(r['last_observed_label_year']),'observationCount':int(r['series_training_observations']),
   'forecastType':'Prévision rétrospective à origine 2015' if int(r['forecast_year'])<=2026 else 'Projection à origine 2015',
   'selectionStatus':r['selection_status'],'selectionCampaigns':int(r['selection_campaigns']),
   'sourceLineage':r['source_lineage'],'trainingInputSha256':r['training_input_sha256'],
   'nationalInputSha256':r['national_input_sha256'],'intervalStatus':r['interval_status'],
   'sourceCsvSha256':h})
 observations=[]
 # Historical prefectural labels actually available to the fitting protocol.
 for r in rows(source/'canonical_panel.csv'):
  if r['crop'] not in CROPS or int(r['harvest_year'])>2015:continue
  observations.append({'id':f"panel:{r['crop']}:{r['prefecture_modele_35']}:{r['harvest_year']}",'crop':r['crop'],
   'year':int(r['harvest_year']),'territory':r['prefecture_modele_35'],'region':r['region'],
   'level':'Préfecture historique','yield':float(r['yield_t_ha']),'source':r['source_id'],
   'areaDefinition':r['area_semantics'],'geographyStatus':r['geography_status'],
   'rawFile':r['raw_file'],'rawRecord':r['raw_record_id'],'rawSha256':r['raw_file_sha256'],
   'observationStatus':'Historique utilisé pour l’apprentissage','primaryEvaluation':False})
 for r in rows(source/'national_history.csv'):
  if int(r['harvest_year'])>2015:continue
  observations.append({'id':f"FAOSTAT_QCL_{r['crop']}_{r['harvest_year']}",'crop':r['crop'],'year':int(r['harvest_year']),
   'territory':'Togo','region':'Togo','level':'National','yield':float(r['rdt_nat_t_ha']),
   'source':'FAOSTAT_QCL_local_export_2026_08_31','areaDefinition':'FAOSTAT_YIELD_DEFINITION_national',
   'rawFile':r['source_file'],'rawRecord':r['raw_record_id'],'rawSha256':r['source_sha256'],
   'observationStatus':r['Flag']+': '+r['Flag Description'],'primaryEvaluation':False})
 for r in rows(source/'official_observations_with_provenance.csv'):
  val=number(r['observed_t_ha'])
  if val is None:continue
  observations.append({'id':r['observation_id'],'crop':r['crop'],'year':int(r['forecast_year']),
   'territory':r['prefecture_modele_35'] if r['geographic_level'] in {'prefecture','prefectural'} and r.get('prefecture_modele_35') else r['territory'],
   'region':r['region'],'level':level(r['geographic_level']),'yield':val,'source':r['source'],
   'areaDefinition':r['area_semantics'],'rawFile':r['source_file'],'rawRecord':r['raw_row_or_page'],
   'rawSha256':r['source_sha256'],'observationStatus':r['observation_status'],
   'comparabilityStatus':r['comparability_status'],'primaryEvaluation':truth(r['primary_evaluation'])})
 comparisons=[]
 for r in rows(source/'national_selected_comparison.csv'):
  assert r['geographic_level']=='national'
  forecasts_match=[f for f in forecasts if f['crop']==r['crop'] and f['year']==int(r['forecast_year']) and f['level']=='National']
  assert len(forecasts_match)==1
  f=forecasts_match[0]
  comparisons.append({'id':f"pair:{r['crop']}:national:{r['forecast_year']}",'forecastId':f['id'],
   'crop':r['crop'],'year':int(r['forecast_year']),'territory':'Togo','level':'National',
   'prediction':float(r['prediction_t_ha']),'observation':float(r['observed_t_ha']),
   'yield':float(r['prediction_t_ha']),'observedYield':float(r['observed_t_ha']),
   'model':r['effective_model'],'source':r['source'],'areaDefinition':r['area_semantics'],
   'labelCutoff':2015,'compatibleForMetrics':truth(r['primary_evaluation']),
   'comparisonLimitation':None if truth(r['primary_evaluation']) else 'Statut FAOSTAT X/E : diagnostic séparé des statistiques officielles A.',
   'evaluationScope':'RETROSPECTIVE_OFFICIAL_NOT_BLIND' if truth(r['primary_evaluation']) else 'DIAGNOSTIC_INSTITUTIONAL_ESTIMATE_OR_EXTERNAL_SOURCE'})
 assert sum(c['compatibleForMetrics'] for c in comparisons)==28
 data={'meta':{'notebook':notebook.name,'sha256':sha(notebook.read_bytes()),
  'sourceDescription':'Réexécution exacte du protocole v24 à origine fixe 2015 ; CSV identique à l’empreinte conservée dans le notebook exécuté.',
  'limitations':LIMITATIONS,'generatedAt':generated,'reconstructedAt':now,'version':'v24-origine2015',
  'originYear':2015,'isDemo':False,'operationallyValidated':False,'hasStatisticalIntervals':False,
  'forecastCsvSha256':h,'sourceNotebookPredictionSha256':EXPECTED,
  'sourceNotebookExecutionCells':[52,82,87,114,119],
  'reconstructionChecks':{'snapshotFilesVerified':302,'canonicalRows':2014,'forecastRows':1092,
   'exactSourceCsvHashMatch':True,'primaryEvaluationPairs':28,'primaryEvaluationYears':list(range(2016,2023)),
   'prefecturalPrimaryPairs':0},'reproduction':source_status,
  'comparisonsDescription':'Système v24 sélectionné selon les seules campagnes antérieures ou égales à 2015 ; 28 statistiques nationales FAOSTAT A de2016–2022, 8diagnostics X/E séparés.'},
  'forecasts':forecasts,'observations':observations,'comparisons':comparisons}
 data['meta']['coverage']={'forecastRows':len(forecasts),'nationalForecastRows':sum(f['level']=='National' for f in forecasts),'prefecturalForecastRows':sum(f['level']=='Préfecture historique' for f in forecasts),'observations':len(observations),'crops':sorted(CROPS),'years':list(range(2016,2028)),'byCrop':[{'crop':c,'nationalSeries':len({f['territory'] for f in forecasts if f['crop']==c and f['level']=='National'}),'prefecturalSeries':len({f['territory'] for f in forecasts if f['crop']==c and f['level']=='Préfecture historique'})} for c in sorted(CROPS)]}
 data['meta']['methods']=[{'crop':c,'level':lev,'models':sorted({f['model'] for f in forecasts if f['crop']==c and f['level']==lev}),'selection':'Sélection chronologique sur les campagnes antérieures ou égales à 2015, par culture, niveau et horizon ; repli explicite selon disponibilité.'} for c in sorted(CROPS) for lev in ['National','Préfecture historique']]
 blob=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)
 for dest in [ROOT/'public/scientific-data.json',ROOT/'lib/scientific-data.json']:dest.write_text(blob)
 public=ROOT/'public/scientific';public.mkdir(exist_ok=True)
 for name in ['predictions_2016_2027.csv','forecast_input_lineage.csv','forecast_model_selection.json','forecast_protocol.json','forecast_freeze_sha256.json','official_observations_with_provenance.csv','national_history.csv','national_selected_comparison.csv','evaluation_audit.json','model_comparison.csv','reproduction-status.json']:
  shutil.copy2(source/name,public/name)
 print(json.dumps({'forecasts':len(forecasts),'observations':len(observations),'comparisons':len(comparisons),'compatiblePairs':28,'bytes':len(blob.encode()),'sha256':h,'status':'PASS'},ensure_ascii=False))
 return data
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('notebook',type=Path);a=p.parse_args();integrate(a.source.resolve(),a.notebook.resolve())
