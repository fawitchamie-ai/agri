#!/usr/bin/env python3
"""Acquire/qualify GROW-Africa v2 regional yields and run leakage-safe baselines.

Input is the unmodified Zenodo GROW-Africa-Database.zip. Only administrative
regional rows with author QC flag A are exported. This is a context/evaluation
dataset; it is never converted to field-level labels or treatment effects.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
import time
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.request import urlopen

try:
    import openpyxl
except ImportError as exc:
    raise SystemExit("Install the pinned dependency: python -m pip install -r research-data/grow-africa/requirements.lock.txt") from exc

DOI = "10.5281/zenodo.16544448"
ARCHIVE_URL = "https://zenodo.org/api/records/16544448/files/GROW-Africa-Database.zip/content"
ARCHIVE_MD5 = "e7c5b8d4783ab5bfee23ae143203b1af"
ARCHIVE_SIZE = 64_638_070
ACQUIRED_ON = "2026-11-12"
PAPER_DOI = "10.1038/s41597-025-05257-5"
COUNTRIES = {"Togo", "Benin", "Burkina Faso", "Ghana", "Senegal", "Cote dIvoire"}
APP_CROPS = {
    "Maize": ["maize"], "Sorghum": ["sorghum"], "Millet": ["millet"],
    "Rice": ["rice-upland", "rice-flooded"], "Cowpea": ["cowpea"],
    "Soybean": ["soybean"], "Groundnut": ["groundnut"],
    "Bambara groundnut": ["bambara"], "Cassava": ["cassava"],
    "Sweet potato": ["sweet-potato"], "Yam": ["yam"], "Okra": ["okra"],
    "Tomato": ["tomato"], "Pepper": ["hot-pepper", "bell-pepper"],
    "Cucumber": ["cucumber"], "Watermelon": ["watermelon"],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def metric_rows(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    errors = [r["prediction_t_ha"] - r["observed_t_ha"] for r in rows]
    obs = [r["observed_t_ha"] for r in rows]
    mae = statistics.mean(abs(e) for e in errors)
    rmse = math.sqrt(statistics.mean(e * e for e in errors))
    mean_obs = statistics.mean(obs)
    sst = sum((v - mean_obs) ** 2 for v in obs)
    r2 = 1 - sum(e * e for e in errors) / sst if len(rows) > 1 and sst > 0 else None
    groups: dict[str, list[float]] = defaultdict(list)
    for r, e in zip(rows, errors):
        groups[r["region_id"]].append(abs(e))
    ci = None
    if len(groups) >= 3:
        # Cluster bootstrap by administrative unit, not by duplicated rows.
        import random
        rng = random.Random(20261112)
        keys = sorted(groups)
        boot = []
        for _ in range(1000):
            sampled = [rng.choice(keys) for _ in keys]
            values = [v for key in sampled for v in groups[key]]
            boot.append(statistics.mean(values))
        boot.sort()
        ci = [boot[24], boot[974]]
    return {
        "n_test_region_years": len(rows),
        "independent_regions": len(groups),
        "test_years": [min(r["year"] for r in rows), max(r["year"] for r in rows)],
        "mae_t_ha": mae,
        "rmse_t_ha": rmse,
        "bias_t_ha_prediction_minus_observed": statistics.mean(errors),
        "nrmse_percent_of_test_mean": 100 * rmse / mean_obs if mean_obs else None,
        "r2": r2,
        "mae_95pct_cluster_bootstrap_ci_t_ha": ci,
        "interval_method": "percentile bootstrap (1000 resamples of whole administrative units); CI for MAE only, not a predictive interval",
    }


def evaluate(records: list[dict], test_start: int = 2011, test_end: int | None = None) -> dict:
    panel: dict[tuple, list[dict]] = defaultdict(list)
    for row in records:
        panel[(row["country"], row["admin_level"], row["region_id"], row["crop"])].append(row)
    for values in panel.values():
        values.sort(key=lambda r: r["harvest_year"])

    temporal: dict[tuple, list[dict]] = defaultdict(list)
    spatial: dict[tuple, list[dict]] = defaultdict(list)
    for (country, level, region, crop), values in panel.items():
        for row in values:
            year = row["harvest_year"]
            if year < test_start or (test_end is not None and year > test_end):
                continue
            previous = [v for v in values if v["harvest_year"] < year]
            if len(previous) >= 3:
                temporal[(country, level, crop, "same_region_historical_mean")].append({
                    "region_id": region, "year": year,
                    "observed_t_ha": row["yield_t_ha"],
                    "prediction_t_ha": statistics.mean(v["yield_t_ha"] for v in previous),
                })
                temporal[(country, level, crop, "same_region_previous_observation")].append({
                    "region_id": region, "year": year,
                    "observed_t_ha": row["yield_t_ha"],
                    "prediction_t_ha": previous[-1]["yield_t_ha"],
                })
                spatial_train = [v for (c, l, reg, cr), vals in panel.items()
                                 if c == country and l == level and cr == crop and reg != region
                                 for v in vals if v["harvest_year"] < year]
                spatial_regions = {v["region_id"] for v in spatial_train}
                if len(spatial_regions) >= 3 and len(spatial_train) >= 10:
                    spatial[(country, level, crop, "other_regions_historical_mean")].append({
                        "region_id": region, "year": year,
                        "observed_t_ha": row["yield_t_ha"],
                        "prediction_t_ha": statistics.mean(v["yield_t_ha"] for v in spatial_train),
                    })

    out = []
    for (country, level, crop, model), rows in sorted(temporal.items()):
        metrics = metric_rows(rows)
        # The label is deliberately a baseline; no covariate model is fit on these aggregates.
        out.append({"country": country, "admin_level": int(level), "crop": crop,
                    "validation": "rolling_temporal_same_administrative_unit",
                    "model": model, "metrics": metrics})
    for (country, level, crop, model), rows in sorted(spatial.items()):
        metrics = metric_rows(rows)
        out.append({"country": country, "admin_level": int(level), "crop": crop,
                    "validation": "held_out_administrative_units_and_future_years",
                    "model": model, "metrics": metrics})
    return {
        "protocol": {
            "version": "grow-africa-regional-baselines-1.0",
            "label": "GROW-Africa Regional yieldTonHa, QC_flag_Y=A; statistics aggregated by administrative unit/crop/harvest year",
            "temporal": f"For each held-out harvest year >= {test_start}"+(f" and <= {test_end}" if test_end is not None else "")+", fit only on earlier years. Same-unit test requires >=3 earlier unit-years.",
            "spatial": f"Hold out the entire administrative unit; use only other units and years earlier than the held-out year, requiring >=3 other units and >=10 observations. Test years start at {test_start}"+(f" and end at {test_end}." if test_end is not None else "."),
            "deduplication": "The selected GROW regional subset has one record per country, GADM ID, crop, harvest year and level. Duplicate keys are rejected.",
            "baselines": ["historical mean within the same administrative unit", "most recent earlier observation within the same administrative unit", "historical mean from other administrative units in the same country/crop/level"],
            "metrics": ["MAE", "RMSE", "prediction-minus-observation bias", "nRMSE", "R2 when defined"],
            "uncertainty": "Cluster bootstrap CI for MAE only when >=3 independent administrative units; not a prediction interval.",
            "target_scope": "Administrative statistics only. No plot-level/field labels, common grain moisture, matched weather, soil or satellite covariates, or intervention effects are inferred.",
            "model_status": "research benchmark; no model is approved for production prediction",
        },
        "groups": out,
        "not_evaluable": [
            {"country": "Cote dIvoire", "reason": "No qualifying administrative regional records in GROW-Africa Regional v2.0."},
            {"country": "Ghana", "reason": "Administrative labels are sparse across 2012–2016; no region/crop group meets the minimum three earlier observations for a leakage-safe temporal test. Ghana field datasets are kept separate."},
        ],
    }


def audit_source_tables(zf: zipfile.ZipFile) -> list[dict]:
    specs = [
        ("GROW-Africa-Database/GROW-Africa_Regional.xlsx", "administrative regional statistics", "yieldTonHa"),
        ("GROW-Africa-Database/GROW-Africa_LSMS_survey.xlsx", "household plot surveys", "Yield_ton_ha_"),
        ("GROW-Africa-Database/GROW-Africa_Point.xlsx", "point-based surveys or crop cuts", "Yield_ton_ha_"),
        ("GROW-Africa-Database/GROW-Africa_LSMS_cropcut.xlsx", "LSMS crop cuts", "Yield_ton_ha_"),
    ]
    code_by_name = {"togo": "TGO", "benin": "BEN", "burkina faso": "BFA", "ghana": "GHA", "senegal": "SEN",
                    "cote divoire": "CIV", "cote d ivoire": "CIV", "cote divoire": "CIV"}
    out = []
    for filename, observation_type, _ in specs:
        with zf.open(filename) as stream:
            ws = openpyxl.load_workbook(stream, read_only=True, data_only=True).active
            rows = iter(ws.values)
            header = next(rows)
            idx = {v: i for i, v in enumerate(header)}
            country_col = "country" if "country" in idx else "Country"
            crop_col = "crop" if "crop" in idx else "Crop"
            year_col = next((c for c in ("harvest_year", "HarvestYear", "Year", "AgYearEnd") if c in idx), None)
            yield_col = next((c for c in ("yieldTonHa", "Yield_ton_ha_", "Yield_ton_ha", "YieldUsingGPS_ton_ha_") if c in idx), None)
            precision_col = next((c for c in ("SpatialPrecision_km_",) if c in idx), None)
            counts: dict[str, dict] = {code: {"rows": 0, "crops": Counter(), "years": []} for code in ("TGO", "BEN", "BFA", "GHA", "CIV", "SEN")}
            for row in rows:
                raw_country = row[idx[country_col]]
                normalized_country = " ".join(str(raw_country or "").lower().replace("’", " ").replace("'", " ").split())
                normalized_country = normalized_country.replace(" ", "") if normalized_country == "cotedivoire" else normalized_country
                code = code_by_name.get(normalized_country)
                if not code:
                    continue
                item = counts[code]
                item["rows"] += 1
                item["crops"][str(row[idx[crop_col]] or "Unknown")] += 1
                if year_col and isinstance(row[idx[year_col]], (int, float)):
                    item["years"].append(int(row[idx[year_col]]))
            by_country = []
            for code, item in counts.items():
                by_country.append({"country_code": code, "rows": item["rows"],
                    "crops": [{"name": k, "rows": v} for k, v in sorted(item["crops"].items())],
                    "year_range": [min(item["years"]), max(item["years"])] if item["years"] else None})
            out.append({"file": filename, "observation_type": observation_type, "rows_total": ws.max_row - 1,
                "columns": list(header), "yield_columns_present": [c for c in idx if "yield" in str(c).lower()],
                "location_precision_column": precision_col, "country_column": country_col, "crop_column": crop_col,
                "year_column": year_col, "by_country": by_country})
    return out


def build(archive: Path, output: Path, runtime_data: Path, acquired_on: str) -> None:
    if hashlib.md5(archive.read_bytes()).hexdigest() != ARCHIVE_MD5:
        raise SystemExit("GROW-Africa archive MD5 mismatch; refusing to use an altered or partial download.")
    if archive.stat().st_size != ARCHIVE_SIZE:
        raise SystemExit("GROW-Africa archive size mismatch; refusing to use a partial download.")
    if date.fromisoformat(acquired_on).isoformat() != acquired_on:
        raise SystemExit("--acquired-on must use YYYY-MM-DD.")

    with zipfile.ZipFile(archive) as zf:
        source_tables = audit_source_tables(zf)
        name = "GROW-Africa-Database/GROW-Africa_Regional.xlsx"
        if name not in zf.namelist():
            raise SystemExit(f"Expected source workbook missing: {name}")
        with zf.open(name) as source:
            book = openpyxl.load_workbook(source, read_only=True, data_only=True)
            ws = book.active
            rows = iter(ws.values)
            header = next(rows)
            idx = {v: i for i, v in enumerate(header)}
            required = ["country", "GDAM_ID", "admin_1", "admin_2", "level", "crop", "harvest_year",
                        "areaHa", "productionTon", "yieldTonHa", "QC_flag_Y", "Source"]
            absent = [c for c in required if c not in idx]
            if absent:
                raise SystemExit(f"Source schema changed; missing columns: {absent}")
            excluded = Counter()
            selected: list[dict] = []
            for r in rows:
                country = r[idx["country"]]
                if country not in COUNTRIES:
                    continue
                if str(r[idx["level"]]) not in {"1", "2"}:
                    excluded["unsupported_administrative_level"] += 1
                    continue
                if r[idx["QC_flag_Y"]] != "A":
                    excluded["yield_quality_flag_not_A"] += 1
                    continue
                crop = r[idx["crop"]]
                if crop not in APP_CROPS:
                    excluded["crop_not_exactly_mapped_to_app"] += 1
                    continue
                year = r[idx["harvest_year"]]
                y = r[idx["yieldTonHa"]]
                if not isinstance(year, (int, float)) or not float(year).is_integer():
                    excluded["harvest_year_missing_or_invalid"] += 1
                    continue
                if not isinstance(y, (int, float)) or not math.isfinite(y) or y <= 0:
                    excluded["yield_missing_nonfinite_or_nonpositive"] += 1
                    continue
                if not r[idx["GDAM_ID"]]:
                    excluded["administrative_id_missing"] += 1
                    continue
                selected.append({
                    "country": country,
                    "country_code": str(r[idx["country_code"]] or ""),
                    "region_id": str(r[idx["GDAM_ID"]]),
                    "admin_level": int(r[idx["level"]]),
                    "admin_1": str(r[idx["admin_1"]] or ""),
                    "admin_2": str(r[idx["admin_2"]] or ""),
                    "crop": crop,
                    "app_crop_ids": APP_CROPS[crop],
                    "harvest_year": int(year),
                    "area_ha": float(r[idx["areaHa"]]) if isinstance(r[idx["areaHa"]], (int, float)) else None,
                    "production_t": float(r[idx["productionTon"]]) if isinstance(r[idx["productionTon"]], (int, float)) else None,
                    "yield_t_ha": float(y),
                    "yield_qc_flag": "A",
                    "source": str(r[idx["Source"]] or ""),
                    "denominator_note": "Regional ministry/statistical yield as supplied by GROW-Africa; denominator details are source-dependent and not harmonized to field-sown area.",
                    "product_note": "No common grain moisture or harvest-product basis established across sources.",
                })

    key_fields = ("country", "region_id", "crop", "harvest_year", "admin_level")
    keys = [tuple(x[k] for k in key_fields) for x in selected]
    if len(set(keys)) != len(keys):
        duplicates = [k for k, n in Counter(keys).items() if n > 1][:5]
        raise SystemExit(f"Duplicate administrative/crop/year rows require explicit adjudication: {duplicates}")
    selected.sort(key=lambda r: (r["country"], r["crop"], r["admin_level"], r["region_id"], r["harvest_year"]))

    output.mkdir(parents=True, exist_ok=True)
    # Keep at most five reported harvest years per unit/crop in the Worker
    # lookup; the full panel is used only by the reproducible offline evaluator.
    by_unit: dict[tuple, list[dict]] = defaultdict(list)
    for row in selected:
        by_unit[(row["country"], row["region_id"], row["crop"], row["admin_level"])].append(row)
    runtime_records = []
    for values in by_unit.values():
        allowed_years = sorted({x["harvest_year"] for x in values}, reverse=True)[:5]
        runtime_records.extend({k: x[k] for k in (
            "country", "region_id", "admin_level", "admin_1", "admin_2", "crop",
            "app_crop_ids", "harvest_year", "yield_t_ha", "yield_qc_flag", "source")}
            for x in values if x["harvest_year"] in allowed_years)
    runtime_records.sort(key=lambda r: (r["country"], r["crop"], r["admin_level"], r["region_id"], r["harvest_year"]))
    runtime_data.parent.mkdir(parents=True, exist_ok=True)
    data_path = runtime_data
    data_path.write_text(json.dumps({
        "dataset": "GROW-Africa Database v2.0",
        "doi": DOI,
        "paper_doi": PAPER_DOI,
        "version": "v2.0",
        "license": "CC-BY-4.0",
        "acquired_on": acquired_on,
        "archive_md5": ARCHIVE_MD5,
        "archive_sha256": sha256(archive),
        "source_file": "GROW-Africa-Database/GROW-Africa_Regional.xlsx",
        "source_rows_selected": len(selected),
        "runtime_rows_latest_five_years_per_region_crop": len(runtime_records),
        "selection": "Six target countries; admin levels 1/2; crop has exact documented mapping; QC_flag_Y=A; positive finite yield and GADM administrative ID.",
        "excluded_rows_by_reason": dict(sorted(excluded.items())),
        "countries": sorted(COUNTRIES),
        "records": runtime_records,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    qualification = {
        "dataset": "GROW-Africa Database v2.0", "doi": DOI, "paper_doi": PAPER_DOI,
        "license": "CC-BY-4.0", "acquired_on": acquired_on,
        "archive_size_bytes": archive.stat().st_size, "archive_md5": ARCHIVE_MD5,
        "archive_sha256": sha256(archive), "source_workbook": "GROW-Africa-Database/GROW-Africa_Regional.xlsx",
        "published_record_size_bytes": ARCHIVE_SIZE,
        "source_row_counts": {"selected_regional_admin1_admin2_qc_A": len(selected), "excluded_by_reason": dict(sorted(excluded.items()))},
        "coverage": [],
        "source_tables": source_tables,
        "limits": [
            "The regional file contains reported administrative statistics, not 3,489 independent field cuts.",
            "Yield reporting sources differ in crop/product and area denominator; common grain moisture is not established.",
            "No weather, soil, management or satellite joins were used. These labels cannot estimate causal irrigation or fertilizer effects.",
            "The temporal baseline is a diagnostic of historical stability, not a seasonal forecast. Spatial transfer is evaluated separately.",
            "GROW-Africa has no qualifying regional series for Côte d’Ivoire; local Ghana field observations remain a separate, single-area data source.",
            "No region is inferred from a parcel polygon. The application only exposes a row as a regional historical reference after an exact unique territory-name match.",
        ],
    }
    by_country_crop_level: dict[tuple, list[dict]] = defaultdict(list)
    for x in selected:
        by_country_crop_level[(x["country"], x["crop"], x["admin_level"])].append(x)
    for (country, crop, level), values in sorted(by_country_crop_level.items()):
        qualification["coverage"].append({
            "country": country, "crop": crop, "admin_level": level,
            "rows": len(values), "regions": len({x["region_id"] for x in values}),
            "year_range": [min(x["harvest_year"] for x in values), max(x["harvest_year"] for x in values)],
            "yield_range_t_ha": [min(x["yield_t_ha"] for x in values), max(x["yield_t_ha"] for x in values)],
            "sources": sorted({x["source"] for x in values}),
        })
    (output / "qualification.json").write_text(json.dumps(qualification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "evaluation.json").write_text(json.dumps(evaluate(selected), ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"records": len(selected), "qualification": str(output / "qualification.json"),
                      "data": str(data_path), "evaluation": str(output / "evaluation.json")}, ensure_ascii=False))


def acquire(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    last_error = None
    for attempt in range(1, 4):
        digest = hashlib.md5()
        total = 0
        try:
            with urlopen(ARCHIVE_URL, timeout=90) as response, partial.open("wb") as out:
                while block := response.read(1024 * 1024):
                    out.write(block)
                    digest.update(block)
                    total += len(block)
            if total == ARCHIVE_SIZE and digest.hexdigest() == ARCHIVE_MD5:
                partial.replace(path)
                return
            last_error = f"bytes={total}, md5={digest.hexdigest()}"
        except Exception as exc:  # preserve an interrupted transfer reason for the retry report
            last_error = f"{type(exc).__name__}: {exc}"
        partial.unlink(missing_ok=True)
        if attempt < 3:
            time.sleep(attempt * 2)
    raise SystemExit(f"Downloaded archive failed three integrity/transport attempts: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True, help="Path to the original GROW-Africa-Database.zip")
    parser.add_argument("--output", type=Path, default=Path("research-data/grow-africa"))
    parser.add_argument("--runtime-data", type=Path, default=Path("data/seasonal/grow-africa-regional.json"))
    parser.add_argument("--acquired-on", default=ACQUIRED_ON)
    parser.add_argument("--acquire", action="store_true", help="Download archive from the DOI source before validating it")
    args = parser.parse_args()
    if args.acquire:
        acquire(args.archive)
    build(args.archive, args.output, args.runtime_data, args.acquired_on)


if __name__ == "__main__":
    main()
