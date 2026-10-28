#!/usr/bin/env python3
"""Re-run the EXISTING v24 fixed-origin protocol and verify its printed CSV hash.

python scripts/reproduce-v24.py --snapshot-notebook /path/v22.ipynb --notebook /path/v24.ipynb --out /tmp/agriprevision-v24

This preparation is optional for consultation: the web app reads frozen results.
It needs numpy2.3.5,pandas2.2.3,scikit-learn1.8.0. No method/parameter is changed.
The additional INSEED supplement is optional and excluded from fitting and
primary scores; without it, supplemental diagnostics are explicitly incomplete.
"""
from pathlib import Path
import os
os.environ['OMP_NUM_THREADS']='1'
os.environ['OPENBLAS_NUM_THREADS']='1'
import argparse,ast,base64,datetime,hashlib,importlib.util,io,json,sys,time,zipfile
ROOT=Path(__file__).resolve().parents[1]
EXPECTED='aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d'
def digest(data):return hashlib.sha256(data).hexdigest()
def assignments(s):
    d={}
    for n in ast.parse(s).body:
        if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name):
            try:d[n.targets[0].id]=ast.literal_eval(n.value)
            except (ValueError,TypeError):pass
    return d

def run(args):
    import numpy,pandas,sklearn
    expected={'numpy':'2.3.5','pandas':'2.2.3','sklearn':'1.8.0'}
    actual={k:sys.modules[k].__version__ for k in expected}
    if actual!=expected:raise RuntimeError(f'Versions exactes requises : {expected}; trouvées : {actual}')
    t=time.monotonic();nb=json.loads(args.notebook.read_bytes());old=json.loads(args.snapshot_notebook.read_bytes())
    source=lambda n,i:''.join(n['cells'][i]['source'])
    v=assignments(source(old,4));blob=base64.b64decode(v['SNAPSHOT_BASE64'],validate=True)
    if digest(blob)!=v['SNAPSHOT_SHA256']:raise ValueError('Snapshot SHA différent')
    out=args.out.resolve()
    if out.exists() and any(out.iterdir()):raise FileExistsError('Choisir --out neuf pour préserver les exécutions')
    out.mkdir(parents=True,exist_ok=True)
    rawroot=out/'input';rawroot.mkdir()
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for e in z.infolist():
            if not (rawroot/e.filename).resolve().is_relative_to(rawroot):raise ValueError('Archive unsafe')
        z.extractall(rawroot)
    for item in v['INPUT_MANIFEST']:
        b=(rawroot/item['path']).read_bytes()
        if len(b)!=item['bytes'] or digest(b)!=item['sha256']:raise ValueError(item['path'])
    code=out/'code';code.mkdir();results=out/'results';results.mkdir()
    for i in [75,78,81,86,118]:
        s=source(nb,i);name=s.splitlines()[0].rsplit('/',1)[1];body=s.split('\n',1)[1]
        if (ROOT/'science-source/v24'/name).read_text()!=body:raise ValueError('Module différent '+name)
        (code/name).write_text(body)
    sys.path.insert(0,str(code))
    from build_panel import build
    from official_data import run as official
    from fixed_origin import run as forecast
    build(rawroot/'originals',results)
    panel=pandas.read_csv(results/'canonical_panel.csv')
    national,observations,audit=official(rawroot/'originals',results,args.inseed)
    # Exact cell79 metadata aliases are important for byte-identical lineage hashes.
    national['raw_file_sha256']=national.source_sha256
    national['raw_row_number']=national.raw_row
    national['raw_file']=national.source_file
    national['raw_record_id']=national.crop+'|'+national.harvest_year.astype(str)
    national.to_csv(results/'national_history.csv',index=False)
    selected=forecast(panel,national,results)
    h=digest((results/'predictions_2016_2027.csv').read_bytes())
    status={'notebook':args.notebook.name,'notebookSha256':digest(args.notebook.read_bytes()),
        'rows':len(selected),'sha256':h,'expectedSha256':EXPECTED,'exactMatch':h==EXPECTED,
        'elapsedSeconds':time.monotonic()-t,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'versions':actual,'supplementINSEED':'included' if args.inseed else 'absent; supplemental diagnostics incomplete; excluded from fitting and primary scores'}
    (results/'reproduction-status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2))
    print(json.dumps(status,ensure_ascii=False),flush=True)
    if h!=EXPECTED:raise RuntimeError('CSV différent de l’empreinte sortie notebook ; ne pas intégrer.')
    from evaluation import run as evaluate
    evaluate(results)
    return results
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--snapshot-notebook',type=Path,required=True)
    p.add_argument('--notebook',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--inseed',type=Path)
    run(p.parse_args())
