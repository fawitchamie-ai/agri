"""Fixed-origin yield hindcasts on revised source vintages.

Only harvest years <= origin enter fits, eligibility, preprocessing or selection.
This is NOT a reconstruction of the exact publications available in 2015.
The historical v22 experiment is deliberately not imported or modified.
"""
from __future__ import annotations

from pathlib import Path
import hashlib
import json
import warnings
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import Ridge
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor

TRAIN_END_YEAR = 2015
FORECAST_YEARS = tuple(range(2016, 2028))
CROPS = ("Maize", "Millet", "Rice", "Sorghum")
PREF = "prefecture_modele_35"
KEY = ["crop", "geographical_level", PREF, "forecast_year"]
MODELS = ("last_observation", "recent_mean5", "prefecture_climatology",
          "national_only", "regional_shrink", "national_pref_shrink",
          "loglinear_ridge", "damped_logtrend", "hierarchical_damped", "ar1",
          "ridge_log_alpha10", "ridge_log_alpha100", "extratrees", "random_forest")
NATIONAL_MODELS = tuple(m for m in MODELS if m not in
                        {"national_only", "regional_shrink", "national_pref_shrink", "hierarchical_damped"})
PROTOCOL = {
    "train_end_year": 2015, "forecast_years": list(FORECAST_YEARS),
    "minimum_individual_observations": 5, "minimum_test_territories_prefecture": 3,
    "minimum_selection_campaigns": 3, "minimum_gain_vs_mean5": 0.05,
    "selection": "per_crop_scale_horizon_macro_MAE_equal_campaign_weights",
    "selection_ties": "fixed_candidate_order", "fallback": "recent_mean5",
    "nested_inner_target_cutoff": "outer_origin", "national_lag_assumption": 0,
    "status": "RETROSPECTIVE_FIXED_ORIGIN_REVISED_VINTAGES_NOT_BLIND",
    "strict_2015_publication_vintage": "BLOCKED_NO_ARCHIVED_VINTAGES",
    "candidate_order": list(MODELS), "national_candidates": list(NATIONAL_MODELS),
    "seed": 42, "trees": 60, "tree_max_depth": 4, "tree_min_samples_leaf": 5,
    "logtrend_alpha": 10., "logtrend_observations": 10, "damping_phi": 0.8,
    "hierarchical_shrink_campaigns": 5., "ar1_alpha": 1.,
    "ar1_minimum_consecutive_pairs": 6, "ar1_coefficient_bounds": [-0.95, 0.95],
    "nominal_prediction_intervals": "NOT_ESTABLISHED",
    "note": "The 5% improvement threshold is a fixed stability convention, not a significance test."
}


def _sha(frame, columns):
    cols = [c for c in columns if c in frame]
    return hashlib.sha256(frame[cols].to_csv(index=False, float_format="%.17g").encode()).hexdigest()


def _past(panel, national, origin):
    # Filter BEFORE all deduplication, validation, sorting, metadata and eligibility.
    p = panel.loc[panel.harvest_year.le(origin) & panel.crop.isin(CROPS)].copy()
    n = national.loc[national.harvest_year.le(origin) & national.crop.isin(CROPS)].copy()
    p = p.sort_values(["crop", PREF, "harvest_year"]).reset_index(drop=True)
    n = n.sort_values(["crop", "harvest_year"]).reset_index(drop=True)
    for d, keys, col in [(p, ["crop", PREF, "harvest_year"], "yield_t_ha"),
                         (n, ["crop", "harvest_year"], "rdt_nat_t_ha")]:
        if d.duplicated(keys).any():
            raise ValueError("Duplicated historical input keys")
        if not np.isfinite(d[col]).all() or d[col].le(0).any():
            raise ValueError("Nonpositive/nonfinite historical yields")
        if not np.equal(d.harvest_year, np.floor(d.harvest_year)).all():
            raise ValueError("Nonintegral harvest years")
    return p, n


def _national_as_panel(n):
    d = n.rename(columns={"rdt_nat_t_ha": "yield_t_ha"}).copy()
    d[PREF] = "Togo"
    d["region"] = "Togo"
    return d


def _trend(g, origin, alpha=10.):
    """Log trend on latest <=10 observations, centered at origin; no clipping."""
    d = g.sort_values("harvest_year").tail(10)
    x = d.harvest_year.to_numpy(float) - origin
    y = np.log(d.yield_t_ha.to_numpy(float))
    slope = float(np.dot(x-x.mean(), y-y.mean()) / (np.dot(x-x.mean(), x-x.mean()) + alpha))
    intercept = float(y.mean() - slope*x.mean())
    return intercept, slope


def _exp(value):
    with np.errstate(over="raise", invalid="raise", under="raise"):
        return np.exp(value)


def _features():
    return ColumnTransformer([
        ("year", StandardScaler(), ["harvest_year"]),
        ("geo", OneHotEncoder(handle_unknown="ignore", sparse_output=False), ["region", PREF]),
    ], sparse_threshold=0.)


def _ar1(g, horizon, origin):
    d = g.sort_values("harvest_year")
    years = d.harvest_year.to_numpy(int)
    logs = np.log(d.yield_t_ha.to_numpy(float))
    mask = np.diff(years) == 1
    if int(mask.sum()) < 6:
        return float(d.yield_t_ha.tail(5).mean()), "recent_mean5_insufficient_consecutive_pairs"
    x, y = logs[:-1][mask], logs[1:][mask]
    raw = float(np.dot(x-x.mean(), y-y.mean()) / (np.dot(x-x.mean(), x-x.mean()) + 1.))
    # An explicit stationary-parameter constraint, NOT yield clipping.
    beta = float(np.clip(raw, -0.95, 0.95))
    intercept = float(y.mean() - beta*x.mean())
    value = float(logs[-1])
    for _ in range(int(origin + horizon - years[-1])):
        value = intercept + beta*value
    return float(_exp(value)), ("ar1_coefficient_constrained" if beta != raw else "none")


def predict_candidates(panel, national, origin, years, level="prefecture"):
    """Pure, deterministic, past-only fitting; target years are labels, never covariates observed in future."""
    if level not in {"prefecture", "national"}:
        raise ValueError(level)
    years = tuple(sorted(set(int(y) for y in years)))
    if not years or min(years) <= origin:
        raise ValueError("All target years must be after origin")
    p, n = _past(panel, national, origin)
    source = p if level == "prefecture" else _national_as_panel(n)
    models = MODELS if level == "prefecture" else NATIONAL_MODELS
    rows = []
    for crop in CROPS:
        tr = source[source.crop.eq(crop)].copy()
        if tr.empty:
            continue
        eligible = tr.groupby(PREF).size()
        eligible = eligible[eligible.ge(5)].index
        if len(eligible) == 0:
            continue
        # Metadata from the last PAST row only. Never use a future inventory.
        units = tr[tr[PREF].isin(eligible)].sort_values("harvest_year").groupby(PREF, sort=True).tail(1)
        target = pd.concat([units[["crop", "region", PREF]].assign(harvest_year=y) for y in years], ignore_index=True)
        nat = n[n.crop.eq(crop)].copy()
        anchor = float(nat.rdt_nat_t_ha.tail(5).mean()) if len(nat) else np.nan
        nat_last = int(nat.harvest_year.max()) if len(nat) else np.nan
        regional = tr.groupby(["region", "harvest_year"], as_index=False).yield_t_ha.mean()
        regional_mean = regional.groupby("region").yield_t_ha.mean()
        regional_trends = {r: _trend(g, origin) for r, g in regional.groupby("region")}
        ratios = tr.merge(nat[["harvest_year", "rdt_nat_t_ha"]], on="harvest_year", how="inner", validate="many_to_one")
        ratios["ratio"] = ratios.yield_t_ha / ratios.rdt_nat_t_ha
        region_ratios = ratios.groupby(["region", "harvest_year"]).ratio.mean().groupby("region").mean()
        pref_ratios = ratios.groupby(PREF).ratio.agg(["mean", "count"])
        train_digest = _sha(tr, ["crop", "region", PREF, "harvest_year", "yield_t_ha", "raw_file_sha256", "raw_record_id"])
        nat_digest = _sha(nat, ["crop", "harvest_year", "rdt_nat_t_ha", "raw_file_sha256", "raw_record_id"])
        # The common input reference records the exact passed historical crop frame.
        lineage_id = f"{level}|{crop}|{origin}|{train_digest}|{nat_digest}"
        ml_predictions = {}
        ml_status = {}
        estimators = {
            "ridge_log_alpha10": Ridge(alpha=10.),
            "ridge_log_alpha100": Ridge(alpha=100.),
            "extratrees": ExtraTreesRegressor(n_estimators=60, max_depth=4, min_samples_leaf=5, random_state=42, n_jobs=1),
            "random_forest": RandomForestRegressor(n_estimators=60, max_depth=4, min_samples_leaf=5, random_state=42, n_jobs=1),
        }
        for model, estimator in estimators.items():
            try:
                pipeline = make_pipeline(_features(), estimator)
                pipeline.fit(tr[["harvest_year", "region", PREF]], np.log(tr.yield_t_ha))
                ml_predictions[model] = _exp(pipeline.predict(target[["harvest_year", "region", PREF]]))
                ml_status[model] = "OK"
            except (ValueError, FloatingPointError) as error:
                # A failed candidate is visible and cannot enter model selection.
                ml_predictions[model] = np.full(len(target), np.nan)
                ml_status[model] = f"FAILED:{type(error).__name__}:{error}"
        by_pref = {key: g for key, g in tr.groupby(PREF, sort=True)}
        for index, row in target.iterrows():
            g = by_pref[row[PREF]].sort_values("harvest_year")
            h = int(row.harvest_year-origin)
            mean5 = float(g.yield_t_ha.tail(5).mean())
            intercept, slope = _trend(g, origin)
            nobs = len(g)
            weight = nobs/(nobs+5.)
            _, regional_slope = regional_trends[row.region]
            shrink_slope = weight*slope + (1-weight)*regional_slope
            damped_h = 0.8*(1.-0.8**h)/(1.-0.8)
            ar, ar_status = _ar1(g, h, origin)
            rr = region_ratios.get(row.region, np.nan)
            if row[PREF] in pref_ratios.index:
                pr = pref_ratios.loc[row[PREF]]
                shrunk_ratio = (pr["count"]*pr["mean"] + 5.*rr)/(pr["count"]+5.)
            else:
                shrunk_ratio = np.nan
            candidates = {
                "last_observation": float(g.yield_t_ha.iloc[-1]),
                "recent_mean5": mean5,
                "prefecture_climatology": float(g.yield_t_ha.mean()),
                "national_only": anchor,
                "regional_shrink": weight*mean5 + (1-weight)*float(regional_mean[row.region]),
                "national_pref_shrink": anchor*shrunk_ratio,
                "loglinear_ridge": float(_exp(intercept+slope*h)),
                "damped_logtrend": float(_exp(intercept+slope*damped_h)),
                "hierarchical_damped": float(_exp(intercept+shrink_slope*damped_h)),
                "ar1": ar,
                **{m: float(a[index]) for m, a in ml_predictions.items()},
            }
            for model in models:
                value = candidates[model]
                status = ml_status.get(model, "OK")
                if not np.isfinite(value) or value <= 0:
                    status = "FAILED_NONPOSITIVE_OR_NONFINITE" if status == "OK" else status
                rows.append({
                    "crop": crop, "region": row.region, PREF: row[PREF],
                    "geographical_level": level, "forecast_year": int(row.harvest_year),
                    "forecast_horizon": h, "origin_year": int(origin), "train_end_year": int(origin),
                    "last_observed_label_year": int(g.harvest_year.max()),
                    "crop_last_label_year": int(tr.harvest_year.max()),
                    "national_last_observed_year": nat_last,
                    "model": model, "prediction_t_ha": value,
                    "model_status": status, "fallback": ar_status if model == "ar1" else "none",
                    "parameters_json": json.dumps({
                        "model": model, "seed": 42, "trees": 60,
                        "tree_depth": 4, "tree_leaf_min": 5,
                        "ridge_alpha": 100 if model == "ridge_log_alpha100" else 10,
                        "trend_latest_observations": 10, "damping_phi": 0.8,
                        "regional_shrink_k": 5, "ar1_alpha": 1,
                        "ar1_stationary_bounds": [-0.95, 0.95],
                    }, sort_keys=True, separators=(",", ":")),
                    "series_training_observations": nobs,
                    "training_rows": len(tr), "training_campaigns": tr.harvest_year.nunique(),
                    "source_lineage": lineage_id, "training_input_sha256": train_digest,
                    "national_input_sha256": nat_digest,
                    "prediction_status": "RETROSPECTIVE_FIXED_2015_REVISED_VINTAGES" if origin == 2015 else "HISTORICAL_ORIGIN_REVISED_VINTAGES",
                    "lower_interval_t_ha": np.nan, "upper_interval_t_ha": np.nan,
                    "interval_status": "NOT_CALIBRATED_NO_NOMINAL_COVERAGE",
                })
    return pd.DataFrame(rows)


def _backtests(panel, national):
    p, n = _past(panel, national, TRAIN_END_YEAR)
    records = []
    for level, src in [("prefecture", p), ("national", _national_as_panel(n))]:
        for origin in range(int(src.harvest_year.min())+4, TRAIN_END_YEAR):
            years = range(origin+1, min(origin+12, TRAIN_END_YEAR)+1)
            pred = predict_candidates(p, n, origin, years, level)
            if pred.empty:
                continue
            truth = src[["crop", PREF, "harvest_year", "yield_t_ha"]].rename(columns={"harvest_year": "forecast_year", "yield_t_ha": "observation_t_ha"})
            matched = pred.merge(truth, on=["crop", PREF, "forecast_year"], how="inner", validate="many_to_one")
            if not matched.empty:
                counts = matched.groupby(["crop", "forecast_horizon"])[PREF].transform("nunique")
                matched = matched[counts.ge(3 if level == "prefecture" else 1)].copy()
                records.append(matched)
    b = pd.concat(records, ignore_index=True)
    b["error_t_ha"] = b.prediction_t_ha-b.observation_t_ha
    b["absolute_error_t_ha"] = b.error_t_ha.abs()
    # Flag complete candidate/cohort before ranking; failure never silently falls back.
    return b


def _rank(group):
    if group.empty:
        return "recent_mean5", 0, {}, "FALLBACK_NO_FOLDS"
    nfold = int(group.forecast_year.nunique())
    if nfold < 3:
        return "recent_mean5", nfold, {}, "FALLBACK_FEWER_THAN_3_CAMPAIGNS"
    level = group.geographical_level.iloc[0]
    models = MODELS if level == "prefecture" else NATIONAL_MODELS
    key = ["origin_year", "forecast_year", PREF]
    reference = group[group.model.eq("recent_mean5")]
    refkeys = set(map(tuple, reference[key].to_numpy()))
    scores = {}
    for m in models:
        g = group[group.model.eq(m)]
        if (set(map(tuple, g[key].to_numpy())) == refkeys and
                g.model_status.eq("OK").all() and np.isfinite(g.absolute_error_t_ha).all()):
            # Same exact targets; first average within campaign, then equally over campaigns.
            scores[m] = float(g.groupby("forecast_year").absolute_error_t_ha.mean().mean())
    if "recent_mean5" not in scores:
        raise ValueError("Reference failed; ranking cannot continue")
    winner = min(scores, key=lambda m: (scores[m], models.index(m)))
    # Stability rule set before post-2015 evaluation, not statistical significance.
    if scores[winner] >= 0.95*scores["recent_mean5"]:
        winner = "recent_mean5"
        status = "REFERENCE_RETAINED_GAIN_BELOW_5PCT"
    else:
        status = "SELECTED_PRE2016_MACRO_MAE_GAIN_GE_5PCT"
    return winner, nfold, scores, status


def select_models(backtests):
    decisions, nested, feasible = [], [], []
    for level in ("prefecture", "national"):
        for crop in CROPS:
            for h in range(1, 13):
                g = backtests[(backtests.geographical_level.eq(level)) & backtests.crop.eq(crop) & backtests.forecast_horizon.eq(h)]
                winner, count, scores, status = _rank(g)
                decisions.append({"crop": crop, "geographical_level": level, "forecast_horizon": h,
                                  "selected_model": winner, "selection_campaigns": count,
                                  "selection_status": status, "scores_macro_mae_t_ha": scores,
                                  "validation_target_years": sorted(map(int, g.forecast_year.unique())),
                                  "maximum_selection_target_year": int(g.forecast_year.max()) if len(g) else None})
                nested_count = 0
                for origin, outer in g.groupby("origin_year", sort=True):
                    inner = g[g.forecast_year.le(origin)]
                    choice, inner_n, inner_scores, inner_status = _rank(inner)
                    chosen = outer[outer.model.eq(choice)].copy()
                    chosen["selected_model"] = choice
                    chosen["inner_validation_campaigns"] = inner_n
                    chosen["maximum_inner_target_year"] = int(inner.forecast_year.max()) if len(inner) else np.nan
                    chosen["nested_selection_status"] = "NESTED_SELECTION" if inner_n >= 3 else "FIXED_REFERENCE_FALLBACK_NOT_NESTED_SELECTION"
                    chosen["inner_selection_status"] = inner_status
                    nested_count += inner_n >= 3
                    nested.append(chosen)
                feasible.append({"crop": crop, "geographical_level": level, "forecast_horizon": h,
                                 "simple_validation_campaigns": count,
                                 "nested_selection_outer_campaigns": nested_count,
                                 "simple_validation_status": "AVAILABLE" if count else "NOT_ESTIMABLE",
                                 "nested_validation_status": "AVAILABLE_LIMITED" if nested_count else "NOT_ESTIMABLE",
                                 "final_selection_status": status})
    return {"protocol": PROTOCOL, "decisions": decisions}, pd.concat(nested, ignore_index=True), pd.DataFrame(feasible)


def _selected(candidates, selection):
    choices = pd.DataFrame(selection["decisions"])
    cols = ["crop", "geographical_level", "forecast_horizon", "selected_model", "selection_campaigns", "selection_status"]
    d = candidates.merge(choices[cols], on=["crop", "geographical_level", "forecast_horizon"], validate="many_to_one")
    d = d[d.model.eq(d.selected_model)].copy().sort_values(KEY).reset_index(drop=True)
    if d.duplicated(KEY).any() or not d.model_status.eq("OK").all():
        raise ValueError("Selected forecasts contain duplicates or failed estimates")
    return d


def generate_predictions(panel, national, selection=None):
    """End-to-end deterministic prediction API. When no selection is supplied it is recomputed on <=2015 only."""
    p, n = _past(panel, national, TRAIN_END_YEAR)
    if selection is None:
        selection, _, _ = select_models(_backtests(p, n))
    candidates = pd.concat([predict_candidates(p, n, TRAIN_END_YEAR, FORECAST_YEARS, level)
                            for level in ("prefecture", "national")], ignore_index=True)
    return _selected(candidates, selection)


def _lineage(panel, national, candidates):
    p, n = _past(panel, national, TRAIN_END_YEAR)
    lines = []
    for (level, crop), targets in candidates.groupby(["geographical_level", "crop"]):
        reference = targets.source_lineage.iloc[0]
        frames = [("prefectural_labels", p[p.crop.eq(crop)])] if level == "prefecture" else []
        frames += [("national_labels_or_anchor", n[n.crop.eq(crop)])]
        for role, frame in frames:
            for row in frame.to_dict("records"):
                lines.append({"source_lineage": reference, "crop": crop, "geographical_level": level,
                              "input_role": role, "input_year": int(row["harvest_year"]),
                              PREF: row.get(PREF, "Togo"),
                              "input_value_t_ha": row.get("yield_t_ha", row.get("rdt_nat_t_ha")),
                              "raw_file": row.get("raw_file", "FAOSTAT_data_en_8-31-2026.csv"),
                              "raw_record_id": row.get("raw_record_id", f"{crop}|{row['harvest_year']}"),
                              "raw_row_number": row.get("raw_row_number", np.nan),
                              "raw_file_sha256": row.get("raw_file_sha256", "NOT_SUPPLIED_BY_CALLER"),
                              "lineage_scope": "EXACT_HISTORICAL_INPUT_FRAMES_PASSED_TO_CANDIDATE_GENERATOR",
                              "note": "Individual baselines use a subset; record lists all admissible crop inputs passed to the estimator system."})
    return pd.DataFrame(lines)


def run(panel, national, outdir):
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    p, n = _past(panel, national, TRAIN_END_YEAR)
    (out/"forecast_protocol.json").write_text(json.dumps(PROTOCOL, indent=2, ensure_ascii=False))
    backtests = _backtests(p, n)
    selection, nested, feasible = select_models(backtests)
    # Decisions frozen and persisted before any final external matching.
    (out/"forecast_model_selection.json").write_text(json.dumps(selection, indent=2, ensure_ascii=False))
    candidates = pd.concat([predict_candidates(p, n, TRAIN_END_YEAR, FORECAST_YEARS, level)
                            for level in ("prefecture", "national")], ignore_index=True)
    selected = _selected(candidates, selection)
    tables = {"predictions_2016_2027.csv": selected,
              "candidates_all_forecasts.csv": candidates,
              "backtest_predictions.csv": backtests,
              "nested_validation.csv": nested,
              "validation_feasibility.csv": feasible,
              "forecast_input_lineage.csv": _lineage(p, n, candidates)}
    for name, data in tables.items():
        data.to_csv(out/name, index=False, float_format="%.12g")
    # Disagreement bands do NOT claim prediction coverage, and remain separate from interval fields.
    sens = candidates[candidates.model_status.eq("OK")].groupby(KEY).prediction_t_ha.agg(["min", "max", "count"]).reset_index()
    sens = sens.rename(columns={"min": "model_range_min_t_ha", "max": "model_range_max_t_ha", "count": "n_candidates"})
    sens["sensitivity_status"] = "FIXED_CANDIDATE_DISAGREEMENT_NOT_PREDICTION_INTERVAL"
    sens.to_csv(out/"model_sensitivity.csv", index=False)
    # Historical selected-candidate errors: descriptive because candidate selection reused those errors.
    bands = []
    for d in selection["decisions"]:
        g = backtests[(backtests.crop.eq(d["crop"])) & backtests.geographical_level.eq(d["geographical_level"]) &
                      backtests.forecast_horizon.eq(d["forecast_horizon"]) & backtests.model.eq(d["selected_model"])]
        annual = g.groupby("forecast_year").absolute_error_t_ha.mean()
        bands.append({"crop": d["crop"], "geographical_level": d["geographical_level"], "forecast_horizon": d["forecast_horizon"],
                      "model": d["selected_model"], "historical_campaigns": len(annual),
                      "max_annual_mae_t_ha": float(annual.max()) if len(annual) else np.nan,
                      "status": "DESCRIPTIVE_HISTORICAL_ERROR_NOT_CALIBRATED_INTERVAL" if len(annual) else "NOT_ESTIMABLE"})
    pd.DataFrame(bands).to_csv(out/"historical_error_sensitivity.csv", index=False)
    manifest = {name: hashlib.sha256((out/name).read_bytes()).hexdigest() for name in tables}
    (out/"forecast_freeze_sha256.json").write_text(json.dumps(manifest, indent=2))
    return selected
