"""Publish immutable scientific evidence as paginated assets, separate from member records."""
import csv,gzip,hashlib,json,shutil,sys
from pathlib import Path
csv.field_size_limit(10_000_000)
root=Path(__file__).resolve().parents[1]
base=Path(sys.argv[1]); out=root/'public/data';out.mkdir(parents=True,exist_ok=True)
labels={'canonical_panel':'Panel harmonisé — toutes les cultures','source_candidates':'Candidats et exclusions de l’harmonisation','source_exclusions':'Synthèse des exclusions','administrative_correspondence_audit':'Correspondances administratives','fews_linked_indicators':'Indicateurs FEWS rapprochés','forecast_input_lineage':'Données utilisées par chaque prévision','predictions_2016_2027':'Prévisions sélectionnées 2016–2027','candidates_all_forecasts':'Tous les modèles candidats','backtest_predictions':'Prédictions des tests historiques','national_history':'Historique national FAOSTAT','official_observations_with_provenance':'Observations et provenance officielle','model_comparison':'Comparaison des modèles','nested_validation':'Validation temporelle imbriquée','hvstat_africa_data_v1.2':'HarvestStat — fichier collecté intégral','crop_data':'FEWS FDW — fichier collecté intégral'}
catalog=[]
files=[(p,'resultats') for p in sorted((base/'v24-run/results').glob('*')) if p.suffix in {'.csv','.json'}]
files += [(p,'collecte') for p in sorted((base/'originals').rglob('*')) if p.suffix in {'.csv','.json','.geojson'} and not p.name.endswith('.transfer.json') and not p.name.startswith('drive_inventory_')]
for i,(p,group) in enumerate(files):
 ident=f'{group}-{i:03d}'; dest=out/ident;dest.mkdir(exist_ok=True)
 raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest()
 # Compressed exact original bytes; never silently repair malformed source rows.
 (dest/(p.name+'.gz')).write_bytes(gzip.compress(raw,mtime=0))
 columns=[];count=0;parts=[];chunk=[];malformed=0
 if p.suffix=='.csv':
  with p.open(encoding='utf-8-sig',errors='strict',newline='') as f:
   reader=csv.DictReader(f);columns=reader.fieldnames or []
   for r in reader:
    if None in r:
     r['__extra_columns']=r.pop(None);malformed+=1
    chunk.append(r);count+=1
    if len(chunk)==500:
     fn=f'part-{len(parts)}.json';(dest/fn).write_text(json.dumps(chunk,ensure_ascii=False));parts.append(fn);chunk=[]
   if chunk:
    fn=f'part-{len(parts)}.json';(dest/fn).write_text(json.dumps(chunk,ensure_ascii=False));parts.append(fn)
 else:
  value=json.loads(raw)
  rows=value if isinstance(value,list) else value.get('features') if isinstance(value,dict) and value.get('type')=='FeatureCollection' else [{'champ':k,'valeur':v} for k,v in value.items()] if isinstance(value,dict) else [{'valeur':value}]
  columns=list(dict.fromkeys(k for r in rows if isinstance(r,dict) for k in r));count=len(rows)
  for n in range(0,count,500):
   fn=f'part-{len(parts)}.json';(dest/fn).write_text(json.dumps(rows[n:n+500],ensure_ascii=False));parts.append(fn)
 status='Archive collectée — non validée pour v24' if group=='collecte' else 'Résultat exploratoire v24'
 if p.stem in {'canonical_panel','source_candidates','source_exclusions','fews_linked_indicators','administrative_correspondence_audit'}:status='Harmonisation v24 — limites documentées'
 catalog.append(dict(id=ident,name=labels.get(p.stem,p.stem.replace('_',' ')),filename=p.name,group=group,status=status,rows=count,columns=columns,parts=parts,download=f'/data/{ident}/{p.name}.gz',sha256=sha,bytes=len(raw),malformedRows=malformed,sourcePath=str(p.relative_to(base)),protocol='v24, origine fixe 2015' if group=='resultats' else 'Archive source — versions multiples, ne pas confondre avec les résultats v24'))
# Include executable rules with exact hashes.
for p in (root/'science-source/v24').glob('*.py'):shutil.copyfile(p,out/p.name)
(out/'catalog.json').write_text(json.dumps({'datasets':catalog,'referenceForecastSha256':'aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d','missing':['Supplément INSEED 2020–2024 indisponible pour cette reproduction','Covariables GEE/SPAM non validées pour l’expérience v24'],'rulesCode':'/data/build_panel.py'},ensure_ascii=False))
print(f'{len(catalog)} jeux, {sum(d["rows"] for d in catalog)} lignes, {sum(len(d["parts"]) for d in catalog)} partitions')
