"""Real-engine regression and adapter checks; not agronomic validation."""
import copy
import hashlib
import json
from pathlib import Path
import sqlite3
import os
import socket
import subprocess
import sys
import time
import tempfile
import unittest
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError

from runner import run,validate
from server import Jobs

FIXTURE=Path(__file__).parent/'fixtures/upstream-potato.json'


class EngineTests(unittest.TestCase):
    def setUp(self):self.b=json.loads(FIXTURE.read_text())

    def test_real_engine_units_and_reference(self):
        before=copy.deepcopy(self.b);r=run(self.b)
        self.assertEqual(before,self.b,'engine must not mutate the stored input bundle')
        self.assertEqual(r['engine'],'Wofost81_NWLP_MLWB_SNOMIN')
        self.assertFalse(r['validated']);self.assertEqual(r['nutrientsSimulated'],['N'])
        self.assertAlmostEqual(r['result']['storageOrganDryMatterKgHaSown'],11532.58562954839,places=4)
        self.assertEqual(len(r['daily']),169)
        self.assertEqual(len(r['daily'][0]['NH4']),4)
        self.assertEqual(r['result']['freshOrMarketableProductionKg'],None)
        self.assertEqual(r['outputUnits']['NH4'],'kg N/m² per layer')
        self.assertEqual(r['outputUnits']['NLOSSCUM'],'kg N/ha')
        for key in set(r['daily'][0])|set(r['summary'])|set(r['terminal']):self.assertIn(key,r['outputUnits'])
        self.assertAlmostEqual(r['nitrogenDailyKgHa'][0]['nh4ByLayer'][0],r['daily'][0]['NH4'][0]*10000)
        last=r['nitrogenDailyKgHa'][-1]
        self.assertAlmostEqual(last['lossCumulative'],last['leachedNh4Cumulative']+last['leachedNo3Cumulative']+last['denitrifiedCumulative'])
        partial=copy.deepcopy(self.b);partial['sownAreaHa']=.4;p=run(partial)
        self.assertEqual(r['result']['storageOrganDryMatterKgHaSown'],p['result']['storageOrganDryMatterKgHaSown'])
        self.assertAlmostEqual(p['result']['productionDryKg'],.4*r['result']['productionDryKg'])

    def test_dates_and_doses_are_real_model_inputs(self):
        baseline=run(self.b)['result']['storageOrganDryMatterKgHaSown']
        no=copy.deepcopy(self.b);no['applications']=[];zero=run(no)['result']['storageOrganDryMatterKgHaSown']
        late=copy.deepcopy(self.b)
        # Merge compatible components on one date, preserving the total dose.
        for a in late['applications']:a['date']='2020-08-01'
        delayed=run(late)['result']['storageOrganDryMatterKgHaSown']
        self.assertNotAlmostEqual(baseline,zero,places=1)
        self.assertNotAlmostEqual(baseline,delayed,places=1)
        split=copy.deepcopy(self.b);a=split['applications'][0];b=copy.deepcopy(a);b['id']='same-day-half'
        for k in ('amountKgHa','nh4KgHa','no3KgHa','organicNKgHa','organicMatterKgHa','carbonKgHa'):
            a[k]/=2;b[k]/=2
        split['applications'].append(b)
        self.assertAlmostEqual(baseline,run(split)['result']['storageOrganDryMatterKgHaSown'],places=6)
        split['applications'][-1]['initialAgeYears']=2
        with self.assertRaisesRegex(ValueError,'Same-day'):run(split)

    def test_organic_c_and_n_are_dynamic_not_instant_soil_improvement(self):
        b=copy.deepcopy(self.b);b['applications']=[{'id':'organic-model-scenario','date':'2020-04-09','amountKgHa':1000,'nh4KgHa':5,'no3KgHa':0,'organicNKgHa':10,'organicMatterKgHa':250,'carbonKgHa':145,'ureaNkgHa':0,'depthCm':25,'initialAgeYears':1,'status':'planned','source':'Named synthetic compatibility scenario, no universal compost profile'}]
        r=run(b);self.assertIsNotNone(r['daily'][-1]['NORG']);self.assertIsNotNone(r['daily'][-1]['CORG'])
        self.assertEqual(b['soilProperties']['SoilProfileDescription']['SoilLayers'][0]['FSOMI'],.05)
        self.assertEqual(r['applications'][0]['organicNKgHa'],10)
        b['applications'][0]['carbonKgHa']=146
        with self.assertRaisesRegex(ValueError,'C/OM'):validate(b)

    def test_incomplete_inputs_do_not_turn_into_default_parameters(self):
        for edit in [lambda b:b['initialState'].pop('NO3I'),lambda b:b['siteParameters'].pop('CO2'),lambda b:b['weather'].pop(1),lambda b:b['metadata'].pop('parameterLicense'),lambda b:b['cropParameters'].update(NFIX_FR=.1),lambda b:b['applications'][0].update(ureaNkgHa=20),lambda b:b['metadata'].update(cropId='soybean')]:
            b=copy.deepcopy(self.b);edit(b)
            with self.assertRaises((ValueError,KeyError)):validate(b)
        b=copy.deepcopy(self.b);b['weather'][0]['RAIN']=None
        with self.assertRaises(ValueError):run(b)

    def test_persistent_jobs_scoping_failure_and_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=str(Path(tmp)/'jobs.sqlite');jobs=Jobs(path)
            a=jobs.submit('a'*64,self.b);again=jobs.submit('a'*64,self.b)
            self.assertEqual(a['id'],again['id']);self.assertEqual(a['status'],'pending')
            with self.assertRaises(KeyError):jobs.get('b'*64,a['id'])
            self.assertTrue(jobs.step());r=Jobs(path).get('a'*64,a['id'])
            self.assertEqual(r['status'],'complete');self.assertIsNotNone(r['result']['result'])
            bad=copy.deepcopy(self.b);bad['cropParameters'].pop('TSUM1')
            f=jobs.submit('a'*64,bad);jobs.step();failed=jobs.get('a'*64,f['id'])
            self.assertEqual(failed['status'],'failed');self.assertIsNone(failed['result'])
            self.assertEqual(jobs.retry('a'*64,f['id'])['status'],'pending')
            for _ in range(2):
                jobs.step()
                if jobs.get('a'*64,f['id'])['attempts']<3:jobs.retry('a'*64,f['id'])
            with self.assertRaises(ValueError):jobs.retry('a'*64,f['id'])
            # Resume after a stale running lease, with no invented completion.
            with sqlite3.connect(path) as db:db.execute("UPDATE jobs SET status='running',updated=0 WHERE id=?",(a['id'],))
            jobs.step();r=jobs.get('a'*64,a['id']);self.assertEqual(r['status'],'failed');self.assertIn('Interrupted',r['error'])

    def test_actual_authenticated_http_service(self):
        with tempfile.TemporaryDirectory() as tmp:
            with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            token='local-test-token-not-a-real-secret-0001'
            process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('server.py')),'--database',str(Path(tmp)/'jobs.sqlite'),'--port',str(port)],env={**os.environ,'CROP_COMPUTE_TOKEN':token},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            origin=f'http://127.0.0.1:{port}'
            def request(path,body=None,owner='a'*64,auth=token):
                req=Request(origin+path,data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+auth,'X-Owner':owner,'Content-Type':'application/json'})
                with urlopen(req,timeout=10) as r:return r.status,json.load(r)
            try:
                for _ in range(80):
                    try:status,health=request('/health');break
                    except URLError:time.sleep(.1)
                else:self.fail('Real HTTP service did not start')
                self.assertEqual(status,200);self.assertEqual(health['pcseVersion'],'6.0.13')
                with self.assertRaises(HTTPError) as e:request('/health',auth='wrong')
                self.assertEqual(e.exception.code,401)
                status,j=request('/jobs',self.b);self.assertEqual(status,202)
                with self.assertRaises(HTTPError) as e:request('/jobs/'+j['id'],owner='b'*64)
                self.assertEqual(e.exception.code,404)
                for _ in range(100):
                    _,r=request('/jobs/'+j['id'])
                    if r['status'] in ('complete','failed'):break
                    time.sleep(.1)
                self.assertEqual(r['status'],'complete',r.get('error'));self.assertEqual(r['result']['engine'],'Wofost81_NWLP_MLWB_SNOMIN')
            finally:process.terminate();process.wait(timeout=10)


if __name__=='__main__':unittest.main()
