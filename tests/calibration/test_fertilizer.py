"""Leakage and reproducibility checks, not agronomic validation claims."""
import copy
import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/calibration'))
from fertilizer_pipeline import originals,paired,digest,evaluate,weights


class FertilizerEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _,rows=originals(ROOT/'research-data/fertilizer/v1')
        cls.pairs,cls.rejected=paired(rows)
        cls.protocol=json.loads((ROOT/'docs/calibration/fertilizer/PROTOCOL-v2.json').read_text())

    def test_reproducible_pairs_and_published_report(self):
        self.assertEqual(len(self.pairs),554)
        self.assertEqual(len({r['site'] for r in self.pairs}),25)
        report,_=evaluate(self.pairs,self.protocol)
        self.assertEqual(report,json.loads((ROOT/'docs/calibration/fertilizer/VALIDATION.json').read_text()))
        self.assertFalse(report['productionEnabled'])
        self.assertIsNone(report['interval95']['radiusTonnesHa'])
        self.assertTrue(any(r['deltaKgHa']<0 for r in self.pairs if r['country']=='Togo'))
        self.assertTrue(all(r['moisturePercent'] is None for r in self.pairs))

    def test_test_labels_do_not_select_or_fit_model(self):
        report,_=evaluate(self.pairs,self.protocol)
        changed=copy.deepcopy(self.pairs)
        for r in changed:
            if self.protocol['splitBySite'][r['site']]=='test':r['deltaKgHa']+=100000
        protocol={**self.protocol,'pairsSha256':digest(changed)}
        alternate,_=evaluate(changed,protocol)
        self.assertEqual(report['model'],alternate['model'])
        self.assertEqual(report['selectionScores'],alternate['selectionScores'])
        self.assertFalse(alternate['productionEnabled'])

    def test_frozen_input_togo_holdout_alias_and_equal_site_weights(self):
        self.assertTrue(all(self.protocol['splitBySite'][r['site']]=='test' for r in self.pairs if r['country']=='Togo'))
        self.assertNotIn('Nigeria/T/wada',self.protocol['splitBySite'])
        changed=copy.deepcopy(self.pairs);changed[0]['deltaKgHa']+=1
        with self.assertRaisesRegex(ValueError,'freeze'):evaluate(changed,self.protocol)
        bysite={}
        for r,w in zip(self.pairs,weights(self.pairs)):bysite[r['site']]=bysite.get(r['site'],0)+w
        for weight in bysite.values():self.assertAlmostEqual(weight,1/25)


if __name__=='__main__':unittest.main()
