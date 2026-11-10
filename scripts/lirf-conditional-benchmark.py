"""Diagnostic conditionnel de réponse du grain à l'ET, et non prévision de campagne.

L'ET est l'estimation saisonnière du bilan d'eau de l'expérience USDA.
Le témoin bien irrigué de chaque année est un proxy, non une ETm démontrée.
Seuls les rendements 2012 ajustent les coefficients; 2013 ne les ajuste pas.
"""
from pathlib import Path
from collections import defaultdict
import json
import math
import sys

import openpyxl

ROOT = Path(__file__).resolve().parent
book_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "usda/LIRF_2012_2013.xlsx"
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "conditional_water_benchmark.json"
book = openpyxl.load_workbook(book_path, read_only=True, data_only=True)
groups = defaultdict(list)
missing_yield = []
missing_et = []
annual_rows = 0
for line, row in enumerate(book["Annual data by plot"].iter_rows(min_row=3, values_only=True), 3):
    if not isinstance(row[0], int):
        continue
    annual_rows += 1
    year, plot, _, treatment = row[:4]
    grain, et = row[8:10]
    if not isinstance(grain, (int, float)) or not math.isfinite(grain):
        missing_yield.append({"row": line, "year": year, "plot": plot, "raw": grain})
        continue
    if not isinstance(et, (int, float)) or not math.isfinite(et):
        missing_et.append({"row": line, "year": year, "plot": plot, "raw": et})
        continue
    groups[(year, treatment)].append((grain, et))

means = {key: (sum(v[0] for v in values) / len(values),
               sum(v[1] for v in values) / len(values))
         for key, values in groups.items()}
yield_reference_2012 = means[(2012, "100/100")][0]
et_references = {year: means[(year, "100/100")][1] for year in (2012, 2013)}
training = [(1 - value[1] / et_references[2012], 1 - value[0] / yield_reference_2012)
            for key, value in means.items() if key[0] == 2012]
response_coefficient = sum(x * y for x, y in training) / sum(x * x for x, _ in training)

def metrics(rows, key):
    errors = [row[key] - row["observedGrainKgHa"] for row in rows]
    n = len(errors)
    rmse = math.sqrt(sum(e * e for e in errors) / n)
    observed_mean = sum(row["observedGrainKgHa"] for row in rows) / n
    return {"nTreatmentMeans": n, "nFieldSeasons": 1,
            "maeKgHa": sum(abs(e) for e in errors) / n,
            "rmseKgHa": rmse, "biasKgHa": sum(errors) / n,
            "observedMeanKgHa": observed_mean,
            "nrmsePercentOfObservedMean": 100 * rmse / observed_mean}

years = {}
for year in (2012, 2013):
    rows = []
    for key, (yield_observed, et) in sorted(means.items()):
        if key[0] != year:
            continue
        et_ratio = et / et_references[year]
        prediction = yield_reference_2012 * (1 - response_coefficient * (1 - et_ratio))
        rows.append({"treatment": key[1], "plotsWithYieldAndET": len(groups[key]),
                     "observedGrainKgHa": yield_observed, "fieldBalanceEstimatedEtMm": et,
                     "etRatioToSameYearFullIrrigation": et_ratio,
                     "conditionalPredictionKgHa": prediction,
                     "constant2012ReferenceKgHa": yield_reference_2012})
    years[str(year)] = {"role": "calibration" if year == 2012 else "retrospective temporal check, not blind",
                        "etReferenceMm": et_references[year], "rows": rows,
                        "conditionalMetrics": metrics(rows, "conditionalPredictionKgHa"),
                        "constantBaselineMetrics": metrics(rows, "constant2012ReferenceKgHa")}

result = {
    "status": "conditional-response-diagnostic-not-an-operational-yield-model",
    "sourceDOI": "10.15482/USDA.ADC/1439968",
    "grainBasis": "kg/ha at 15.5% grain moisture, no conversion applied",
    "annualRows": annual_rows,
    "usableYieldAndEtRows": sum(map(len, groups.values())),
    "missingYieldRows": missing_yield, "missingEtRows": missing_et,
    "formula": "Yhat = Y_FI_2012 * (1 - k * (1 - ET_field / ET_FI_same_year))",
    "responseCoefficientFittedOnlyOn2012": response_coefficient,
    "yieldReference2012KgHa": yield_reference_2012,
    "years": years,
    "limits": [
        "ET is supplied by the field experiment, not predicted by AgriPrevision.",
        "The full-irrigation ET reference is a proxy, not independently measured stress-free ETm.",
        "The 2013 ET reference is used retrospectively; no 2013 yield enters fitting.",
        "Treatments within one season share weather and location; plots are not independent climates.",
        "No validation of the application's water balance, NPK response, or African transfer.",
        "This coefficient and the US yield reference must not become defaults for Togo or other countries.",
        "No claim of prospective forecasting or blind evaluation."
    ]
}
out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"usableRows": result["usableYieldAndEtRows"],
                  "coefficient": response_coefficient,
                  "check2013": years["2013"]["conditionalMetrics"],
                  "baseline2013": years["2013"]["constantBaselineMetrics"]}, indent=2))
