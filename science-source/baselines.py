"""Transparent forecast references with separate label and national cutoffs.

No file IO, tuning, availability assumptions, or mutation of supplied frames.
Historical national observations are assumed usable only after the caller has
chosen national_cutoff. The module does not establish historical publication
availability. mean3 means the last three *observations*, with their dates logged.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

PREF = "prefecture_modele_35"
KEY = ["crop", PREF, "harvest_year"]
MODELS = ("last_observation", "recent_mean5", "prefecture_climatology",
          "national_only", "national_region_ratio", "national_pref_shrink")


def _numeric_years(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    years = pd.to_numeric(d.harvest_year, errors="raise")
    if years.isna().any() or not np.equal(years, np.floor(years)).all():
        raise ValueError("harvest_year must contain finite integral years")
    d["harvest_year"] = years.astype(int)
    return d


def _assert_unique(df: pd.DataFrame, keys: list[str], label: str) -> None:
    if df[keys].isna().any(axis=None) or df.duplicated(keys).any():
        raise ValueError(f"{label}: missing or duplicate keys {keys}")


def national_anchor(national: pd.DataFrame, crop: str, cutoff: int,
                    method: str = "mean3") -> tuple[float, dict]:
    """Past-only arithmetic reference; no retrospective method selection."""
    if method not in {"last", "mean3"}:
        raise ValueError("Fixed reference method must be last or mean3")
    d = _numeric_years(national)
    d = d[d.crop.eq(crop) & d.harvest_year.le(cutoff)].copy()
    if "statut_ancre" in d:
        d = d[d.statut_ancre.astype(str).str.startswith("OBSERVE")]
    _assert_unique(d, ["crop", "harvest_year"], "national")
    d["rdt_nat_t_ha"] = pd.to_numeric(d.rdt_nat_t_ha, errors="coerce")
    d = d[np.isfinite(d.rdt_nat_t_ha) & d.rdt_nat_t_ha.gt(0)].sort_values("harvest_year")
    used = d.tail(1 if method == "last" else 3)
    info = {"anchor_method": method, "anchor_last_year": np.nan,
            "anchor_years": "", "anchor_n_observations": len(used)}
    if used.empty:
        return np.nan, info
    info.update(anchor_last_year=int(used.harvest_year.max()),
                anchor_years=";".join(used.harvest_year.astype(str)))
    return float(used.rdt_nat_t_ha.mean()), info


def predict_baselines(panel: pd.DataFrame, national: pd.DataFrame,
                      targets: pd.DataFrame, *, label_cutoff: int,
                      national_cutoff: int, anchor_method: str = "mean3",
                      shrink_years: float = 5.) -> pd.DataFrame:
    """Return all baseline predictions on every target, with missing status.

    Regional effect is the equal-year mean of within-region mean arithmetic
    yield/national ratios; this is not an area-weighted national reconciliation.
    A prefectoral mean ratio is shrunk toward that regional effect using the
    number of distinct observed campaigns, not the number of rows. Unknown
    prefectures use the region effect; unknown regions use the global effect.
    This fallback is explicitly recorded and never creates a new observation.
    Targets' yield values and target-year area are never used.
    """
    if shrink_years < 0 or not np.isfinite(shrink_years):
        raise ValueError("shrink_years must be nonnegative and finite")
    d = _numeric_years(panel)
    t = _numeric_years(targets)
    if not {"crop", PREF, "region", "harvest_year", "yield_t_ha"}.issubset(d):
        raise ValueError("panel lacks required schema")
    if not {"crop", PREF, "region", "harvest_year"}.issubset(t):
        raise ValueError("targets lacks required schema")
    _assert_unique(t, KEY, "targets")
    if t.harvest_year.le(label_cutoff).any():
        raise ValueError("Targets must follow label_cutoff")
    if t.harvest_year.le(national_cutoff).any():
        raise ValueError("Projected-anchor targets must follow national_cutoff")
    # Filtering occurs before deduplication/estimation: future labels cannot
    # influence current fitting even if they are present in the supplied panel.
    d = d[d.harvest_year.le(label_cutoff)].copy()
    _assert_unique(d, KEY, "training panel")
    d["yield_t_ha"] = pd.to_numeric(d.yield_t_ha, errors="coerce")
    d = d[np.isfinite(d.yield_t_ha) & d.yield_t_ha.gt(0)].copy()
    n = _numeric_years(national)
    n = n[n.harvest_year.le(national_cutoff)].copy()
    if "statut_ancre" in n:
        n = n[n.statut_ancre.astype(str).str.startswith("OBSERVE")]
    _assert_unique(n, ["crop", "harvest_year"], "training national")
    n["rdt_nat_t_ha"] = pd.to_numeric(n.rdt_nat_t_ha, errors="coerce")
    n = n[np.isfinite(n.rdt_nat_t_ha) & n.rdt_nat_t_ha.gt(0)]
    rows = []
    for crop, tg in t.groupby("crop", sort=True):
        tr = d[d.crop.eq(crop)].sort_values([PREF, "harvest_year"])
        anchor, ainfo = national_anchor(n, crop, national_cutoff, anchor_method)
        by_pref = {p: g for p, g in tr.groupby(PREF, sort=True)}
        # Equal-year global fallback avoids changing weight merely because
        # more administrative units happen to be reported in one year.
        global_y = float(tr.groupby("harvest_year").yield_t_ha.mean().mean())
        reg_y = tr.groupby(["region", "harvest_year"]).yield_t_ha.mean().groupby("region").mean()
        ratio = tr.merge(n[["crop", "harvest_year", "rdt_nat_t_ha"]],
                         on=["crop", "harvest_year"], how="inner", validate="many_to_one")
        ratio["ratio"] = ratio.yield_t_ha / ratio.rdt_nat_t_ha
        global_r = float(ratio.groupby("harvest_year").ratio.mean().mean())
        regional_r = ratio.groupby(["region", "harvest_year"]).ratio.mean().groupby("region").mean()
        pref_r = ratio.groupby(PREF).ratio.agg(["mean", "count"])
        for _, target in tg.iterrows():
            pref, region = target[PREF], target.region
            hist = by_pref.get(pref, tr.iloc[:0])
            fallback_y = reg_y.get(region, global_y)
            fallback_name = "region_climatology" if region in reg_y.index else "global_climatology"
            reg_r = regional_r.get(region, global_r)
            ratio_fallback = "none" if region in regional_r.index else "global_ratio"
            if pref in pref_r.index:
                pr = pref_r.loc[pref]
                shrunk = (pr["count"] * pr["mean"] + shrink_years * reg_r) / (pr["count"] + shrink_years)
                pref_status = "none"
            else:
                shrunk, pref_status = reg_r, "region_ratio" if region in regional_r.index else "global_ratio"
            predictions = {
                "last_observation": (float(hist.yield_t_ha.iloc[-1]) if len(hist) else fallback_y,
                                     "none" if len(hist) else fallback_name),
                "recent_mean5": (float(hist.yield_t_ha.tail(5).mean()) if len(hist) else fallback_y,
                                 "none" if len(hist) else fallback_name),
                "prefecture_climatology": (float(hist.yield_t_ha.mean()) if len(hist) else fallback_y,
                                           "none" if len(hist) else fallback_name),
                "national_only": (anchor, "none"),
                "national_region_ratio": (anchor * reg_r, ratio_fallback),
                "national_pref_shrink": (anchor * shrunk, pref_status),
            }
            common = {k: target[k] for k in KEY + ["region"]}
            common.update(label_cutoff=int(label_cutoff), national_cutoff=int(national_cutoff),
                          label_gap_requested=int(target.harvest_year-label_cutoff),
                          prefecture_last_label_year=int(hist.harvest_year.max()) if len(hist) else np.nan,
                          crop_last_label_year=int(tr.harvest_year.max()) if len(tr) else np.nan,
                          national_horizon_requested=int(target.harvest_year-national_cutoff),
                          national_anchor_t_ha=anchor, shrink_years=shrink_years, **ainfo)
            for model, (pred, fallback) in predictions.items():
                rows.append(dict(common, model=model, prediction_t_ha=pred,
                                 fallback=fallback, status="predicted" if np.isfinite(pred) else "unavailable"))
    return pd.DataFrame(rows)