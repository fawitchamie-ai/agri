"""Technical sensitivity/reproducibility evidence; never predictive validation."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import platform
import sys
import time

from runner import run

root=Path(__file__).resolve().parents[2]
fixture=Path(__file__).parent/'fixtures/upstream-potato.json'
base=json.loads(fixture.read_text())
rows=[]
for label in ('upstream_reference','no_added_n','same_total_n_delayed','40_percent_sown_area'):
    b=deepcopy(base)
    if label=='no_added_n':b['applications']=[]
    if label=='same_total_n_delayed':
        for a in b['applications']:a['date']='2020-08-01'
    if label=='40_percent_sown_area':b['sownAreaHa']=.4
    started=time.perf_counter();r=run(b)
    rows.append({'scenario':label,'elapsedSecondsIncludingImport':time.perf_counter()-started,'engineElapsedSeconds':r['elapsedSeconds'],'days':len(r['daily']),'result':r['result'],'inputSha256':r['inputSha256']})
proof={'checkedOn':'2026-11-01','kind':'technical_execution_not_field_validation','model':'Wofost81_NWLP_MLWB_SNOMIN','pcseVersion':'6.0.13','python':platform.python_version(),'hardware':'ephemeral execution environment; not a service capacity guarantee','country':'DEMO','crop':'potato','predictiveMetrics':{'MAE':None,'RMSE':None,'reason':'No qualified independent local observed labels used'},'fixtureSha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'rows':rows,'fileSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__).with_name('runner.py'),Path(__file__).with_name('server.py'),Path(__file__).with_name('requirements.lock.txt')]},'limits':['Upstream technical example, no six-country calibration','Artificial variants test date/dose/surface wiring, not agronomic accuracy','No NC-SA experimental data or private campaign data used']}
json.dump(proof,sys.stdout,ensure_ascii=False,indent=2);print()
