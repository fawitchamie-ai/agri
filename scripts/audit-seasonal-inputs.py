#!/usr/bin/env python3
"""Inspect existing notebooks without executing cells; stream verified archives.

python scripts/audit-seasonal-inputs.py --country-notebook /path/previsions_ghana_autonome.ipynb \
  --notebook /path/v22.ipynb --notebook /path/v24.ipynb \
  --togo-results /path/reproduced/results --out /path/new-audit --data-out /path/new-inputs

Dependencies: pandas/numpy from science-source/requirements.txt. Never executes
notebook code. Original archives remain unchanged. No raw FEWS file is loaded
in a DataFrame or copied. Reproduction of v24 uses reproduce-v24.py separately.
"""
import argparse
import ast
import base64
import csv
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import resource
import stat
import time
import zipfile

import numpy as np
import pandas as pd

SCHEMA = 'seasonal-input-audit-1.0.0'
ISO = {'benin': 'BEN', 'burkina_faso': 'BFA', 'ghana': 'GHA', 'senegal': 'SEN'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def fresh(path):
    path.mkdir(parents=True, exist_ok=False)
    return path


def notebook_info(path):
    raw = path.read_bytes()
    n = json.loads(raw)
    cells = n['cells']
    code = [c for c in cells if c['cell_type'] == 'code']
    return n, dict(name=path.name, bytes=len(raw), sha256=sha(raw), cells=len(cells),
                   code_cells=len(code), saved_execution_counts=sum(c.get('execution_count') is not None for c in code),
                   saved_errors=sum(o.get('output_type') == 'error' for c in code for o in c.get('outputs', [])),
                   executed_during_audit=False)


def literals(source):
    result = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                result[node.targets[0].id] = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                pass
    return result


def verified_country(n, data_root):
    values = literals(''.join(n['cells'][4]['source']))
    blob = base64.b64decode(values['SOURCE_ARCHIVE_BASE64'], validate=True)
    if sha(blob) != values['SOURCE_ARCHIVE_SHA256']:
        raise ValueError('Empreinte de l’archive différente')
    kept = {}
    inspected = []
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        members = z.infolist()
        if len(members) > 4096 or sum(m.file_size for m in members) > 1024**3:
            raise ValueError('Archive au-delà des limites explicites')
        names = [m.filename for m in members]
        if len(names) != len(set(names)):
            raise ValueError('Membre dupliqué')
        for m in members:
            p = PurePosixPath(m.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in m.filename or stat.S_ISLNK(m.external_attr >> 16):
                raise ValueError('Chemin ou lien interdit dans l’archive')
        manifest = {r['path']: r for r in json.loads(z.read('documents/input_manifest.json'))}
        for name in manifest:
            if name not in names:
                raise ValueError('Membre du manifeste absent : ' + name)
        keep = {'data/harveststat.csv', 'data/faostat.csv', 'data/boundaries.geojson',
                'config/country.json', 'config/protocol.json', 'documents/SOURCES.md'}
        for m in members:
            if m.is_dir():
                continue
            if m.filename in keep and m.file_size > 16 * 1024**2:
                raise ValueError('Fichier sélectionné trop volumineux')
            # Verify every member in bounded memory, even files not retained.
            h = hashlib.sha256()
            size = 0
            buffer = io.BytesIO() if m.filename in keep else None
            with z.open(m) as stream:
                for chunk in iter(lambda: stream.read(128 * 1024), b''):
                    size += len(chunk)
                    h.update(chunk)
                    if buffer is not None:
                        buffer.write(chunk)
            expected = manifest.get(m.filename)
            if expected and (size != expected['bytes'] or h.hexdigest() != expected['sha256']):
                raise ValueError('Intégrité différente : ' + m.filename)
            inspected.append(dict(path=m.filename, bytes=size, sha256=h.hexdigest(),
                                  manifest_verified=expected is not None, retained=buffer is not None))
            if buffer is not None:
                kept[m.filename] = buffer.getvalue()
    cfg = json.loads(kept['config/country.json'])
    root = fresh(data_root / cfg['slug'])
    for name, raw in kept.items():
        p = root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(raw)
    return cfg, root, inspected


def audit_country(cfg, root, out):
    h = pd.read_csv(root / 'data/harveststat.csv', keep_default_na=False)
    for col in ['yield', 'area', 'production', 'harvest_year', 'qc_flag']:
        h[col] = pd.to_numeric(h[col], errors='coerce')
    if h['country'].ne(cfg['country']).any() or h['harvest_year'].isna().any():
        raise ValueError('Identité pays ou année incohérente')
    h['raw_row_number'] = np.arange(len(h)) + 2
    h['crop'] = h['product'] + ' | ' + h.crop_production_system + ' | ' + h.season_name
    geo = json.loads((root / 'data/boundaries.geojson').read_text())
    ids = [f['properties']['fnid'] for f in geo['features']]
    if len(set(ids)) != len(ids):
        raise ValueError('Identifiant géographique dupliqué')
    h['exclusion_reason'] = ''
    checks = [(~h['product'].isin(cfg['crops']), 'outside_configured_crops'),
              (~h.fnid.isin(ids), 'missing_boundary'), (h.qc_flag.ne(0), 'source_qc_flag'),
              (~np.isfinite(h['yield']) | h['yield'].le(0), 'invalid_yield'),
              (~np.isfinite(h.area) | h.area.le(0), 'invalid_area'),
              ((h['yield'] - h.production / h.area).abs().gt(.001), 'production_area_yield_inconsistent')]
    for mask, reason in checks:
        h.loc[h.exclusion_reason.eq('') & mask, 'exclusion_reason'] = reason
    h.loc[h.duplicated(['crop', 'fnid', 'harvest_year'], keep=False), 'exclusion_reason'] = 'duplicate_series_year'
    panel = h[h.exclusion_reason.eq('')].copy()
    if panel.empty:
        raise ValueError('Aucune observation admissible')
    panel.to_csv(root / 'canonical_panel.csv', index=False)
    h[['raw_row_number', 'fnid', 'crop', 'harvest_year', 'exclusion_reason']].to_csv(root / 'row_audit.csv', index=False)
    grouped = panel.groupby(['product', 'crop_production_system', 'season_name'], dropna=False)
    records = []
    for (crop, system, season), g in grouped:
        records.append(dict(country=ISO[cfg['slug']], crop=crop, system=system, season=season,
                            spatial_support=cfg['level'], geography_vintage='HarvestStat harmonized FNID; current boundaries unverified',
                            first_year=int(g.harvest_year.min()), last_year=int(g.harvest_year.max()),
                            observations=len(g), territories=int(g.fnid.nunique()), unit='t/ha',
                            source='HarvestStat v1.2', area_definition='reported; harvested-area semantics unverified',
                            publication_vintages_verified=False, parcel_observations=False))
    status = dict(country=ISO[cfg['slug']], rows_raw=len(h), rows_selected=len(panel),
                  first_year=int(panel.harvest_year.min()), last_year=int(panel.harvest_year.max()),
                  selected_territories=int(panel.fnid.nunique()), boundary_units=len(ids),
                  exclusions={str(k or 'selected'): int(v) for k, v in h.exclusion_reason.value_counts().items()},
                  canonical_panel_sha256=sha((root / 'canonical_panel.csv').read_bytes()))
    return records, status


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--country-notebook', type=Path, action='append', default=[])
    p.add_argument('--notebook', type=Path, action='append', default=[])
    p.add_argument('--togo-results', type=Path)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--data-out', type=Path, required=True)
    a = p.parse_args()
    started = time.perf_counter()
    out, data = fresh(a.out), fresh(a.data_out)
    inventory, coverage, statuses = [], [], []
    for path in a.notebook:
        _, info = notebook_info(path)
        inventory.append(info)
    for path in a.country_notebook:
        n, info = notebook_info(path)
        cfg, root, members = verified_country(n, data)
        rows, status = audit_country(cfg, root, out)
        info.update(country=status['country'], members=members)
        inventory.append(info)
        coverage.extend(rows)
        statuses.append(status)
    if a.togo_results:
        panel = pd.read_csv(a.togo_results / 'canonical_panel.csv')
        statuses.append(dict(country='TGO', rows_selected=len(panel),
            selected_territories=int(panel.prefecture_modele_35.nunique()),
            first_year=int(panel.harvest_year.min()), last_year=int(panel.harvest_year.max()),
            canonical_panel_sha256=sha((a.togo_results / 'canonical_panel.csv').read_bytes())))
        for crop, g in panel.groupby('crop'):
            coverage.append(dict(country='TGO', crop=crop, system='unspecified', season='unspecified',
                spatial_support='prefecture historique', geography_vintage='post-2015 FNID unverified',
                first_year=int(g.harvest_year.min()), last_year=int(g.harvest_year.max()),
                observations=len(g), territories=int(g.prefecture_modele_35.nunique()), unit='t/ha', source='v24 reconstructed',
                area_definition='reported; harvested-area semantics unverified',
                publication_vintages_verified=False, parcel_observations=False))
        status = json.loads((a.togo_results / 'reproduction-status.json').read_text())
        write_json(out / 'REPRODUCTION_V24.json', status)
    pd.DataFrame(coverage).sort_values(['country', 'crop', 'system', 'season']).to_csv(out / 'COUVERTURE_DONNEES.csv', index=False)
    write_json(out / 'INVENTAIRE_FICHIERS.json', inventory)
    write_json(out / 'AUDIT_PAYS.json', statuses)
    report = dict(schema=SCHEMA, country_notebooks=len(a.country_notebook), other_notebooks=len(a.notebook),
                  seasonal_yield_model_executed=False, notebook_cells_executed=False,
                  wall_seconds=round(time.perf_counter() - started, 3),
                  peak_rss_mib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2),
                  limits='Linux ru_maxrss for this process; excludes separate v24 reproduction and browser',
                  raw_data_written_outside_notebook=True, full_fews_dataframe_loaded=False)
    write_json(out / 'EXECUTION_AUDIT.json', report)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
