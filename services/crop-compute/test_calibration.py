"""Technical fixtures only: no fitted African cultivar or validation evidence."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest
from calibration import calibrate,scenario_ensemble
from server import Jobs

class NativeCalibration(unittest.TestCase):
    def setUp(self):self.b=json.loads((Path(__file__).parent/'fixtures/upstream-potato.json').read_text())
    def test_real_native_search_hook_without_claiming_field_validation(self):
        p={'nativeStage':'crop','nativeGrid':[{'path':'cropParameters.SPAN','values':[self.b['cropParameters']['SPAN']],'source':'Upstream fixture, technical wiring test only'}]}
        m=calibrate([{'bundle':self.b}],p,lambda rows,pred:{'RMSE':abs(pred[0]-11532.58562954839)/1000})
        self.assertEqual(m['model'],'wofost_snomin');self.assertLess(m['trainingLoss'],1e-6);self.assertFalse(m['chemicalStatesValidated'])
        p['nativeStage']='phenology'
        with self.assertRaisesRegex(ValueError,'anthesis'):calibrate([{'bundle':self.b}],p,lambda a,b:None)
    def test_scenario_range_is_not_a_prediction_interval_and_failures_are_not_dropped(self):
        bad=deepcopy(self.b);bad['applications'][0]['ureaNkgHa']=1
        r=scenario_ensemble([{'axis':'soil','label':'Supplier technical reference','bundle':self.b},{'axis':'product','label':'Unsupported urea, must fail','bundle':bad}])
        self.assertFalse(r['complete']);self.assertIsNone(r['rangeKgHa']);self.assertIsNone(r['probability']);self.assertIsNone(r['predictiveInterval95']);self.assertEqual(r['scenarios'][1]['status'],'failed')
    def test_runtime_version_is_in_job_identity_and_stale_pending_work_is_not_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            jobs=Jobs(str(Path(tmp)/'jobs.sqlite'));a=jobs.submit('a'*64,self.b)
            jobs.runtime='changed-runtime-version';b=jobs.submit('a'*64,self.b)
            self.assertNotEqual(a['id'],b['id']);jobs.step();r=jobs.get('a'*64,a['id']);self.assertEqual(r['status'],'failed');self.assertIsNone(r['result']);self.assertIn('version changed',r['error'])

if __name__=='__main__':unittest.main()
