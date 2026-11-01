#!/usr/bin/env python3
"""Generate small deployment-safe metadata from a checked research database.
Raw NC data and SQLite files are never copied into public assets.
"""
import argparse,csv,hashlib,json,sqlite3,subprocess
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
COUNTRIES=['TGO','BEN','BFA','GHA','CIV','SEN']
ALIASES={'Maize':'maize','Cowpea':'cowpea','Groundnut':'groundnut','Groundnuts (In Shell)':'groundnut','Soybean':'soybean','Sorghum':'sorghum','Rice':'rice','Millet':'millet','Pearl millet':'millet','Cassava':'cassava','Cotton':'cotton','Sesame':'sesame','Rice, upland':'rice-upland','Rice, lowland':'rice-lowland','Rice, irrigated':'rice-irrigated','CowpeaBio':'cowpea-bio','SorghumBio':'sorghum-bio'}

def generate(database,quality_path,destination):
    q=json.loads(Path(quality_path).read_text())
    if q['purpose']!='noncommercial_research':raise ValueError('Full source audit requires the explicitly separate research import')
    db=sqlite3.connect('file:'+str(Path(database).resolve())+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    registry=json.loads((ROOT/'docs/calibration/REGISTRE_SOURCES.json').read_text())
    manifest=json.loads((ROOT/'research-data/calibration/manifest.json').read_text())
    fingerprints={'manifest_sha256':ROOT/'research-data/calibration/manifest.json','registry_sha256':ROOT/'docs/calibration/REGISTRE_SOURCES.json','schema_sha256':ROOT/'research-data/calibration/schema.sql','importer_sha256':ROOT/'scripts/calibration/build.py','xlsx_reader_sha256':ROOT/'scripts/calibration/xlsx_reader.py'}
    if any(q['input_fingerprints'].get(k)!=hashlib.sha256(p.read_bytes()).hexdigest() for k,p in fingerprints.items()):raise ValueError('Stale audit: rebuild after source, schema or importer changes')
    actual_files={r['path']:r['sha256'] for r in db.execute('SELECT path,sha256 FROM source_files')}
    if actual_files!={r['path']:r['sha256'] for r in q['files']}:raise ValueError('Quality report does not belong to this database')
    if any(db.execute('SELECT count(*) FROM "'+table+'"').fetchone()[0]!=count for table,count in q['table_counts'].items() if table in {r[0] for r in db.execute('SELECT name FROM sqlite_master WHERE type="table"')}):raise ValueError('Database table counts changed since audit')
    existing=json.loads(subprocess.check_output(['node','--experimental-transform-types','--input-type=module','-e',"import {CROPS} from './lib/seasonal/catalog.ts';process.stdout.write(JSON.stringify(CROPS.map(c=>c.id)));"],cwd=ROOT,stderr=subprocess.DEVNULL))
    historical=Counter()
    for row in csv.DictReader((ROOT/'docs/refonte/COUVERTURE_DONNEES.csv').open()):historical[(row['country'],ALIASES.get(row['crop'],row['crop'].lower()))]+=int(row['observations'])
    functions=Counter()
    for r in db.execute('SELECT country,crop,count(*) AS n FROM response_functions GROUP BY country,crop'):functions[(r['country'],ALIASES.get(r['crop'],r['crop'].lower()))]+=r['n']
    experiments={(r['country'],r['crop']):r for r in q['plot_seasons'] if r['crop']!='fallow'}
    crops=sorted(set(existing)|{c for _,c in historical}|{c for _,c in functions}|{c for _,c in experiments})
    matrix=[]
    for country in COUNTRIES:
        for crop in crops:
            r=experiments.get((country,crop));matrix.append({'country':country,'crop':crop,'experimentalPlotSeasons':r['plot_seasons'] if r else 0,'quantifiedHarvests':r['quantified_harvests'] if r else 0,'experimentalSites':r['sites'] if r else 0,'experimentalPlots':r['plots'] if r else 0,'fromYear':r['first_year'] if r else None,'toYear':r['last_year'] if r else None,'externalFittedFunctions':functions[(country,crop)],'administrativeRecords':historical[(country,crop)],'status':'research_dataset_requires_qualification' if r else 'external_context_only' if functions[(country,crop)] or historical[(country,crop)] else 'no_local_trial_acquired','calibrated':False,'licence':'CC-BY-NC-SA-4.0' if r else None})
    wosis=next(f for f in manifest['files'] if f['source_id']=='wosis-phaq')['upstream_by_country']
    source_digest=q['input_fingerprints']['manifest_sha256']
    out={'version':'experimental-evidence-2026-11-01','checkedOn':'2026-11-01','sourceManifestSha256':source_digest,'countries':COUNTRIES,'cropIds':crops,'calibratedCountries':[],'rawExperimentalDataUsedInProduction':False,'privateCampaignDataUsed':False,'matrix':matrix,'soilContext':wosis,'quality':{'tableCounts':q['table_counts'],'missingness':q['missingness'],'issues':q['issues'],'splitAssigned':False},'pilot':{'country':'CIV','crop':'maize','site':'Gagnoa','season':'First','variety':'H507','plotSeasons':q['pilot_cohort']['plot_seasons'],'fromYear':q['pilot_cohort']['first_year'],'toYear':q['pilot_cohort']['last_year'],'plots':q['pilot_cohort']['plots'],'treatments':12,'blocks':8,'status':'research_candidate_after_protocol_review','calibrated':False,'source':'https://doi.org/10.18167/DVN1/MHLKKW','licence':'CC-BY-NC-SA-4.0','required':['Confirmer la répartition annuelle/par cycle des doses d’azote et les dates d’application','Confirmer le dénominateur de rendement et la surface nette récoltée','Résoudre les divergences de protocole et les méthodes analytiques manquantes','Évaluer sur des sites indépendants et des conditions récentes avant tout transfert','Qualifier les droits d’usage pour une exploitation commerciale ou un modèle opérationnel']},'sources':[{'id':s['id'],'title':s['title'],'owner':s['owner'],'url':s['url'],'licence':s['licence'],'countries':s['countries'],'crops':s['crops'],'accessState':s['access_state'],'fileAcquired':s['file_acquired'],'fileChecked':s['file_checked'],'missing':s['missing'],'usableFor':s['usable_for']} for s in registry['sources']],'limits':['Des données acquises ne constituent pas un modèle calibré ou validé. Aucun des six pays n’est déclaré calibré.','Les fonctions OFRA, historiques administratifs, simulations et moyennes variétales ne sont pas des récoltes de parcelles expérimentales.','Les cartes de classes de Kara ne fournissent aucune valeur exacte par parcelle, ni sous 20 cm. SoilGrids standard ne fournit pas P assimilable ou K échangeable.','Les bases Gagnoa et SOERE sont réservées ici à la recherche non commerciale et ne sont pas des paramètres du moteur publié.']}
    dest=Path(destination);dest.mkdir(parents=True,exist_ok=True);(dest/'EVIDENCE.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    (dest/'CONTROLES_IMPORT.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n')
    with (dest/'COUVERTURE_PAYS_CULTURES.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(matrix[0]));w.writeheader();w.writerows(matrix)
    db.close();return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--database',required=True);p.add_argument('--quality',required=True);p.add_argument('--destination',default=str(ROOT/'docs/calibration'));a=p.parse_args();d=generate(a.database,a.quality,a.destination);print(json.dumps({'matrixRows':len(d['matrix']),'pilot':d['pilot'],'calibratedCountries':[]}))
if __name__=='__main__':main()
