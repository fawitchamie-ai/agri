import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "build-grow-africa.py"
spec = importlib.util.spec_from_file_location("grow_africa_builder", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def fixture():
    values = {
        "A": [1, 2, 3, 4, 40, 400],
        "B": [2, 3, 4, 5, 50, 500],
        "C": [3, 4, 5, 6, 60, 600],
        "D": [4, 5, 6, 7, 70, 700],
        "E": [5, 6, 7, 8, 80, 800],
    }
    return [
        {"country": "Benin", "admin_level": 2, "region_id": region, "crop": "Maize",
         "harvest_year": 2008 + offset, "yield_t_ha": float(yield_value)}
        for region, yields in values.items()
        for offset, yield_value in enumerate(yields)
    ]


def group(report, validation, model):
    return next(g for g in report["groups"] if g["validation"] == validation and g["model"] == model)


class GrowEvaluationTest(unittest.TestCase):
    def test_temporal_and_spatial_metrics_have_expected_independent_units(self):
        report = builder.evaluate(fixture(), test_start=2011, test_end=2011)
        temporal = group(report, "rolling_temporal_same_administrative_unit", "same_region_historical_mean")["metrics"]
        self.assertEqual(temporal["n_test_region_years"], 5)
        self.assertEqual(temporal["independent_regions"], 5)
        self.assertEqual(temporal["test_years"], [2011, 2011])
        self.assertAlmostEqual(temporal["mae_t_ha"], 2.0)
        self.assertAlmostEqual(temporal["rmse_t_ha"], 2.0)
        self.assertAlmostEqual(temporal["bias_t_ha_prediction_minus_observed"], -2.0)
        self.assertEqual(len(temporal["mae_95pct_cluster_bootstrap_ci_t_ha"]), 2)

        spatial = group(report, "held_out_administrative_units_and_future_years", "other_regions_historical_mean")["metrics"]
        self.assertEqual(spatial["n_test_region_years"], 5)
        self.assertEqual(spatial["independent_regions"], 5)
        self.assertEqual(spatial["test_years"], [2011, 2011])
        self.assertAlmostEqual(spatial["mae_t_ha"], 2.2)
        self.assertAlmostEqual(spatial["bias_t_ha_prediction_minus_observed"], -2.0)

    def test_future_observations_cannot_change_an_earlier_temporal_or_spatial_test(self):
        original = fixture()
        changed_future = [dict(row, yield_t_ha=row["yield_t_ha"] * 100)
                          if row["harvest_year"] > 2011 else row for row in original]
        first = builder.evaluate(original, test_start=2011, test_end=2011)
        second = builder.evaluate(changed_future, test_start=2011, test_end=2011)
        for validation, model in [
            ("rolling_temporal_same_administrative_unit", "same_region_historical_mean"),
            ("held_out_administrative_units_and_future_years", "other_regions_historical_mean"),
        ]:
            a = group(first, validation, model)["metrics"]
            b = group(second, validation, model)["metrics"]
            self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
