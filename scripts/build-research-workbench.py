"""Derive display indexes only; never fit a model or alter scientific outputs."""
import csv,json,hashlib,shutil,re,sys
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]; D=ROOT/'public/data'; C=json.loads((D/'catalog.json').read_text()); S=Path(sys.argv[1]) if len(sys.argv)>1 else None
def rows(name):
 d=next(x for x in C['datasets'] if x['filename']==name and x['group']=='resultats')
 return [r for part in d['parts'] for r in json.loads((D/d['id']/part).read_text())]
def write(name,value): (D/name).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')))
panel=rows('canonical_panel.csv'); candidates=rows('source_candidates.csv')
coverage=[]
for crop in sorted({r['crop'] for r in panel}):
 p=[r for r in panel if r['crop']==crop];years=sorted({int(r['harvest_year']) for r in p});territories=sorted({r['prefecture_modele_35'] for r in p})
 coverage.append(dict(crop=crop,rows=len(p),first=min(years),last=max(years),territories=len(territories),years=[dict(year=y,rows=sum(int(r['harvest_year'])==y for r in p)) for y in years]))
metrics=rows('model_comparison.csv')
write('workbench.json',dict(coverage=coverage,quality=dict(candidates=len(candidates),selected=sum(r['selected']=='True' for r in candidates),excluded=dict(Counter(r['exclusion_reason'] or 'Retenue' for r in candidates if r['selected']!='True')),sources=dict(Counter(r['source_id'] for r in candidates))),metrics=metrics))
for name in ['forecast_input_lineage.csv','canonical_panel.csv']:
 write(name.replace('.csv','-index.json'),rows(name))
cs=rows('candidates_all_forecasts.csv');fields=['crop','prefecture_modele_35','geographical_level','forecast_year','model','prediction_t_ha','model_status','fallback','interval_status']
write('model-candidates.json',[{k:r[k] for k in fields} for r in cs])
geo=next(d for d in C['datasets'] if d['filename']=='togo_prefectures_modele_35.geojson')
import gzip
(D/'togo-map.geojson').write_bytes(gzip.decompress((ROOT/'public'/geo['download'].lstrip('/')).read_bytes()))
resources=[]
for name,path in ([] if S is None else [('Limites géographiques sources (GeoPackage)',S/'originals/root/hvstat_boundary.gpkg'),('Journal d’exécution historique',S/'originals/exports/togo_journal_execution_v19.txt'),('Notebook historique v19',S/'originals/memoire_togo_v19_18_corrige_original.ipynb')]):
 raw=path.read_bytes();fn=path.name+'.gz';(D/fn).write_bytes(gzip.compress(raw,mtime=0));resources.append(dict(name=name,url='/data/'+fn,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),status='Archive historique ; protocole distinct de v24'))
if resources:write('resources.json',resources)
profiles={}
for d in C['datasets']:
 years=set();crops=set();territories=set();countries=set()
 for part in d['parts']:
  for r in json.loads((D/d['id']/part).read_text()):
   for k in ['harvest_year','forecast_year','year','Year','season_year']:
    match=re.search(r'(?<!\d)(?:19|20)\d{2}(?!\d)',str(r.get(k,'')))
    if match:years.add(int(match.group()))
   if r.get('crop') or r.get('product'):crops.add(str(r.get('crop') or r.get('product')))
   if r.get('prefecture_modele_35') or r.get('admin_2'):territories.add(str(r.get('prefecture_modele_35') or r.get('admin_2')))
   if r.get('country'):countries.add(str(r['country']))
 profiles[d['id']]={'first':min(years) if years else None,'last':max(years) if years else None,'crops':sorted(crops),'territories':len(territories),'countries':sorted(countries)}
write('profiles.json',profiles)
print('Indexes built:',len(panel),'panel rows;',len(cs),'candidate predictions')
