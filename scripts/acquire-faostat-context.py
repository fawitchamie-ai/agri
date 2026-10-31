#!/usr/bin/env python3
"""Acquire official national context, never field potential. Optional network task, outside CI."""
import argparse, csv, hashlib, io, json, math, os, pathlib, tempfile, urllib.request, zipfile
from datetime import datetime, timezone
URL='https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip'
COUNTRIES={'768':'TGO','204':'BEN','854':'BFA','288':'GHA','384':'CIV','686':'SEN'}
ITEMS={56,83,79,27,195,236,242,203,125,122,137,403,388,430,401,358,397,567,399,289,94}
FIELDS={'5312':('areaHa','ha'),'5510':('productionT','t'),'5412':('yieldKgHaHarvested','kg/ha')}
p=argparse.ArgumentParser();p.add_argument('--archive',type=pathlib.Path);p.add_argument('--output',default='data/seasonal/faostat-context.json');a=p.parse_args()
headers={}
if a.archive:
 path=a.archive;acquired=datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat()
else:
 fd,temporary=tempfile.mkstemp(suffix='.zip');os.close(fd);path=pathlib.Path(temporary)
 with urllib.request.urlopen(URL,timeout=60) as response,path.open('wb') as out:
  headers={k:response.headers.get(k) for k in ['Last-Modified','ETag','Content-Length']}
  while block:=response.read(1024*1024):out.write(block)
 acquired=datetime.now(timezone.utc).isoformat()
sha=hashlib.sha256(path.read_bytes()).hexdigest();records={};items={};flags={};units=set()
with zipfile.ZipFile(path) as z:
 def reader(suffix):return csv.DictReader(io.TextIOWrapper(z.open(next(n for n in z.namelist() if n.endswith(suffix))),encoding='utf-8-sig'))
 for r in reader('Flags.csv'):flags[r['Flag']]=r[' Description']
 for r in reader('ItemCodes.csv'):
  if r['Item Code'].isdigit() and int(r['Item Code']) in ITEMS:items[r['Item Code']]={'name':r['Item'],'cpc':r['CPC Code'].lstrip("'")}
 for r in reader('All_Data_(Normalized).csv'):
  country=COUNTRIES.get(r['Area Code (M49)'].lstrip("'"))
  if not country or not r['Item Code'].isdigit():continue
  item=int(r['Item Code']);year=int(r['Year']);element=r['Element Code']
  if not country or item not in ITEMS or year<2020 or year>2024 or element not in FIELDS:continue
  field,unit=FIELDS[element];raw_unit=r['Unit'];units.add((field,raw_unit))
  value=float(r['Value']) if r['Value'].strip() and r['Flag']!='M' else None
  if value is not None and (not math.isfinite(value) or value<0):raise ValueError('Non-physical national figure')
  if field=='yieldKgHaHarvested' and raw_unit=='hg/ha':value=None if value is None else value*.1
  elif raw_unit!=unit:raise ValueError(f'Unexpected unit {raw_unit} for {field}')
  key=(country,item,year);record=records.setdefault(key,{})
  if field in record:raise ValueError('Duplicate national observation')
  record[field]={'value':value,'flag':r['Flag'],'note':r['Note'],'rawValue':None if value is None else float(r['Value']),'rawUnit':raw_unit}
rows=[];warnings=[]
for (country,item,year),r in sorted(records.items()):
 area=r.get('areaHa',{}).get('value');production=r.get('productionT',{}).get('value');yield_=r.get('yieldKgHaHarvested',{}).get('value')
 if area and production is not None and yield_ is not None and abs(1000*production/area-yield_)>max(.11,.001*yield_):warnings.append([country,item,year,'Production / surface récoltée non réconciliée à 0,1 % ou 0,11 kg/ha'])
 rows.append([country,item,year,r.get('areaHa'),r.get('productionT'),r.get('yieldKgHaHarvested')])
report={'version':'FAOSTAT-QCL-snapshot-2026-10-31','source':URL,'licence':'CC-BY-4.0','acquiredAt':acquired,'processedAt':datetime.now(timezone.utc).isoformat(),'archiveSha256':sha,'httpHeaders':headers,'period':{'from':2020,'to':2024},'rowFields':['country','itemCode','year','areaHa','productionT','yieldKgHaHarvested'],'items':items,'flags':flags,'sourceUnits':[list(x) for x in sorted(units)],'warnings':warnings,'rows':rows,'limits':['Référence statistique nationale historique, jamais Ym de parcelle.','Surface et rendement par hectare récolté ; produit national pouvant regrouper espèces, variétés et conduites.','Flags et notes de chaque variable conservés. Absence de valeur ne signifie pas zéro.','Une disponibilité actuelle ne prouve pas la disponibilité lors d’un conseil ancien.']}
pathlib.Path(a.output).write_text(json.dumps(report,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'records':len(rows),'countries':{c:sum(r[0]==c for r in rows) for c in COUNTRIES.values()},'units':report['sourceUnits'],'warnings':len(warnings),'archiveSha256':sha}))
