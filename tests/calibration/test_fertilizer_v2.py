"""Data integrity, design identity and held-out-label isolation for v2."""
import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/calibration'))
from fertilizer_pipeline import digest
from fertilizer_v2_import import BASE,DOC,prepare,verify_sources,pair_p
from fertilizer_v2_evaluate import evaluate,fit_n,predict_n,weights
from fertilizer_v2_export import build


class FertilizerV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows,cls.pairs,cls.rejected,cls.audit=prepare()
        cls.protocol=json.loads((DOC/'PROTOCOL.json').read_text())
        cls.report,cls.predictions=evaluate(cls.pairs,cls.protocol)

    def test_frozen_originals_and_derived_ids_are_reproducible(self):
        f=json.loads((BASE/'FREEZE.json').read_text())
        self.assertEqual(digest(self.rows),f['rowsSha256'])
        self.assertEqual(digest(self.pairs),f['pairsSha256'])
        self.assertEqual(digest(self.rejected),f['rejectedSha256'])
        self.assertEqual([r['id'] for r in self.pairs],f['pairIds'])
        self.assertEqual(self.audit,json.loads((DOC/'IMPORT_AUDIT.json').read_text()))
        saved=json.loads((DOC/'VALIDATION.json').read_text())
        # JSON object keys are strings (the in-memory byYear keys are integers).
        for k,v in json.loads(json.dumps(self.report)).items():self.assertEqual(v,saved[k])
        self.assertEqual(self.predictions,json.loads((BASE/'predictions.json').read_text()))

    def test_changed_and_missing_originals_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);shutil.copytree(BASE/'raw',p/'raw')
            for name in ('sources.json','supplement-sources.json'):shutil.copy(BASE/name,p/name)
            b=(p/'raw/AMAZXA.zip').read_bytes()
            (p/'raw/AMAZXA.zip').write_bytes(b[:-1]+bytes([b[-1]^1]))
            with self.assertRaisesRegex(ValueError,'checksum'):verify_sources(p)
            (p/'raw/AMAZXA.zip').unlink()
            with self.assertRaises(FileNotFoundError):verify_sources(p)

    def test_primary_environment_id_resolves_trial_header_error(self):
        rr=[r for r in self.rows if r.get('environmentId')==18]
        self.assertTrue(rr)
        self.assertTrue(all(r['trialId']=='10' and r['yieldHeaderTrialId']=='9' for r in rr))
        self.assertTrue(all(r.get('blockId') is None for r in self.rows))
        self.assertTrue(any(r.get('replicationCount')==3 for r in self.rows))
        for p in self.pairs:
            if p['source']=='AMAZXA':
                self.assertEqual(p['baselineNutrients'][::2],p['treatedNutrients'][::2])
                self.assertEqual(p['moisturePercent'],14)
                self.assertTrue(all(v is not None for v in p['baselineNutrients']))
        self.assertTrue(any(p['deltaKgHa']<0 for p in self.pairs))
        self.assertTrue(any(r['reason']=='unknown_background_nutrients_no_zero_fill' for r in self.rejected))

    def test_ambiguity_missing_doses_and_missing_season_never_form_pairs(self):
        p=next(p for p in self.pairs if p['source']=='AMAZXA')
        rr=copy.deepcopy([r for r in self.rows if r['source']=='AMAZXA' and r['recordId'] in (p['controlRecord'],p['treatmentRecord'])])
        rejected=[];self.assertEqual(len(pair_p(rr,rejected)),1)
        duplicate=copy.deepcopy(rr[0]);duplicate['recordId']='duplicate_identity'
        self.assertEqual(pair_p(rr+[duplicate],[]),[])
        rr[0]['nutrients'][0]=None
        self.assertEqual(pair_p(rr,[]),[])
        rr[0]['nutrients'][0]=80;rr[0]['season']=None
        self.assertEqual(pair_p(rr,[]),[])

    def test_country_labels_do_not_select_fit_or_scale_its_heldout_model(self):
        changed=copy.deepcopy(self.pairs)
        for r in changed:
            if r['source']=='AMAZXA' and r['country']=='Benin':
                r['deltaKgHa']+=100000;r['controlKgHa']+=50000;r['treatedKgHa']+=150000
        other,_=evaluate(changed,self.protocol)
        for report in (self.report,other):
            fold=next(f for f in report['AMAZXA']['folds'] if f['heldOutCountry']=='Benin')
            self.assertFalse(set(fold['trainSites'])&set(fold['testSites']))
        a=next(f for f in self.report['AMAZXA']['folds'] if f['heldOutCountry']=='Benin')
        b=next(f for f in other['AMAZXA']['folds'] if f['heldOutCountry']=='Benin')
        for key in ('selectedCandidate','innerScores','model','controlModel'):self.assertEqual(a[key],b[key])

    def test_temporal_test_labels_never_enter_selection_or_control_fit(self):
        changed=copy.deepcopy(self.pairs)
        for r in changed:
            if r['source']=='GFWCYQ' and r['year']>=2021:
                r['deltaKgHa']+=100000;r['controlKgHa']+=50000;r['treatedKgHa']+=150000
        other,_=evaluate(changed,self.protocol)
        a=self.report['GFWCYQ'];b=other['GFWCYQ']
        for key in ('selectedCandidate','selectionScores','model','controlModel'):self.assertEqual(a[key],b[key])
        ids=a['splitIds']
        for k in ids:
            for j in ids:
                if k!=j:self.assertFalse(set(ids[k])&set(ids[j]))
        self.assertEqual(a['splitSummary']['test']['years'],[2021,2022])
        for interval in a['interval95'].values():
            self.assertEqual(interval['calibrationYears'],2);self.assertEqual(interval['requiredRank'],3)
            self.assertIsNone(interval['radiusTonnesHa']);self.assertIsNone(interval['coverage'])
            self.assertIsNone(interval['widthTonnesHa']);self.assertFalse(interval['certified'])

    def test_shared_controls_equal_group_weights_and_no_extrapolation(self):
        rr=[r for r in self.pairs if r['source']=='GFWCYQ']
        self.assertEqual(len({r['controlRecord'] for r in rr}),15)
        bycampaign={}
        for r,w in zip(rr,weights(rr,'campaign')):bycampaign[r['campaign']]=bycampaign.get(r['campaign'],0)+w
        self.assertTrue(all(abs(w-1/15)<1e-10 for w in bycampaign.values()))
        model=fit_n(rr,'saturating_30');bad=copy.deepcopy(rr[:1]);bad[0]['treatedNutrients']=[0,26,50]
        with self.assertRaisesRegex(ValueError,'domain'):predict_n(model,bad)

    def test_export_contains_observations_without_model_coefficients(self):
        out=build(self.pairs,self.report)
        self.assertEqual(out,json.loads((ROOT/'data/seasonal/fertilizer-extension.json').read_text()))
        self.assertFalse(out['productionEnabled'])
        self.assertNotIn('coefficients',json.dumps(out))
        self.assertEqual(set(out['missingByCountry']),{'TGO','BEN','BFA','GHA','CIV','SEN'})
        self.assertTrue(all(not r['productionEnabled'] for r in out['research']))
        self.assertTrue(all(p['source'] in ('AMAZXA','GFWCYQ') for p in self.pairs))
        self.assertTrue(all(not self.report[s]['passed'] for s in ('AMAZXA','GFWCYQ')))


if __name__=='__main__':unittest.main()
