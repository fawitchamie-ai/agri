"""Synthetic software fixtures only; these tests establish no agronomic validity."""
import copy
import sys
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/calibration'))
from validation_pipeline import fingerprint,execute,validate_protocol,metrics,treatment_metrics,bootstrap_metric

def fixture():
    rows=[]
    for site,year in [('train',2020),('validation',2021),('test1',2022),('test2',2022)]:
        for i,dose in enumerate((0,40,80,120)):
            rows.append({'id':site+str(i),'sourceId':'software-fixture','siteId':site,'trialId':site,'experimentId':site,'blockId':'block-1','plotId':site+str(i),'duplicateGroup':site+str(i),'country':'TGO','crop':'maize','variety':'synthetic-test-only','soilClass':'synthetic-test-only','waterSystem':'test','product':'test','source':'Synthetic unit-test fixture; NEVER a real trial','license':'TEST ONLY','predictorAvailableOn':f'{year}-03-01','predictionDate':f'{year}-03-02','harvestDate':f'{year}-09-01','synthetic':False,'kind':'controlled_trial','denominator':'sown','productBasis':'dry','doseBasis':'kg N/ha/cycle','qualification':'protocol_reviewed','yieldKgHaSownDry':1000+20*min(dose,80),'doseNkgHa':dose,'year':year,'control':dose==0})
    data={'version':'test-fixture','rows':rows}
    plan={'version':'calibration-protocol-1','inputSha256':fingerprint(data),'seed':20261101,'registeredOn':'2026-11-01','scientificRationale':'Software test only; not an agronomic parameter source','domain':{'crop':'maize','variety':'synthetic-test-only'},'splitBySite':{'train':'train','validation':'validation','test1':'test','test2':'test'},'empiricalBounds':{k:{'grid':v,'source':'Synthetic software fixture only, not calibration evidence'} for k,v in {'interceptKgHa':[0,5000],'slopeKgGrainPerKgN':[0,10,20,30],'knotNkgHa':[40,80,120]}.items()},'acceptance':{'maxRMSETonnesHa':.2,'maxAbsBiasTonnesHa':.2}}
    return data,plan

class ValidationProtocol(unittest.TestCase):
    def test_train_only_fit_validation_selection_and_reproducibility(self):
        d,p=fixture();a=execute(d,p);b=execute(d,p)
        self.assertEqual(a,b);self.assertEqual(a['test']['RMSE'],0);self.assertEqual(a['parameters']['slope'],20)
        self.assertFalse(a['validatedForAdvice']);self.assertFalse(a['internalChemicalStatesValidated']);self.assertEqual(a['agronomicReview'],'pending')
        self.assertFalse(a['errorUncertainty']['predictiveInterval']);self.assertEqual(a['treatments']['gainPairs'],6)
    def test_test_labels_cannot_select_parameters_or_trigger_fallback(self):
        d,p=fixture();a=execute(d,p)
        for r in d['rows']:
            if r['siteId'].startswith('test'):r['yieldKgHaSownDry']+=100000
        p['inputSha256']=fingerprint(d);b=execute(d,p)
        self.assertEqual(a['parameters'],b['parameters']);self.assertEqual(b['status'],'criteria_failed');self.assertFalse(b['validatedForAdvice'])
    def test_synthetic_or_unqualified_labels_and_stale_freeze_rejected(self):
        for change in [lambda r:r.update(synthetic=True),lambda r:r.update(denominator='harvested'),lambda r:r.update(doseBasis='kg N/ha/year'),lambda r:r.update(yieldKgHaSownDry=None)]:
            d,p=fixture();change(d['rows'][0]);p['inputSha256']=fingerprint(d)
            with self.assertRaises(ValueError):validate_protocol(d,p)
        d,p=fixture();d['rows'][0]['doseNkgHa']=1
        with self.assertRaisesRegex(ValueError,'freeze'):validate_protocol(d,p)
    def test_site_trial_duplicate_and_future_leakage_rejected(self):
        for field in ('trialId','experimentId','plotId','duplicateGroup'):
            d,p=fixture();d['rows'][4][field]=d['rows'][0][field];p['inputSha256']=fingerprint(d)
            with self.assertRaisesRegex(ValueError,'leakage'):validate_protocol(d,p)
        d,p=fixture();d['rows'][0]['predictorAvailableOn']='2020-10-01';p['inputSha256']=fingerprint(d)
        with self.assertRaisesRegex(ValueError,'leakage'):validate_protocol(d,p)
        d,p=fixture();d['rows'][4]['year']=2020;p['inputSha256']=fingerprint(d)
        with self.assertRaisesRegex(ValueError,'later'):validate_protocol(d,p)
    def test_missing_predictions_or_zero_controls_never_become_zero_error(self):
        d,p=fixture();r=d['rows'][:4]
        with self.assertRaises(ValueError):metrics(r,[1000,None,2000,2000])
        r[0]['yieldKgHaSownDry']=0;out=treatment_metrics(r,[0,1,2,3]);self.assertIsNone(out['relativeGainMAEPercentagePoints']);self.assertGreater(out['unmatchedOrZeroControl'],0)
        self.assertEqual(bootstrap_metric(r,[0,1,2,3],1)['status'],'unavailable')
    def test_weighting_does_not_promote_many_repetitions_to_independent_sites(self):
        d,p=fixture();r=[{**d['rows'][0],'siteId':'one','experimentId':'one','yieldKgHaSownDry':1000} for _ in range(100)]+[{**d['rows'][0],'siteId':'two','experimentId':'two','yieldKgHaSownDry':3000}]
        self.assertAlmostEqual(metrics(r,[1000]*len(r))['MAE'],1)

if __name__=='__main__':unittest.main()
