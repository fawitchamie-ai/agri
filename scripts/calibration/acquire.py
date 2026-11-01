#!/usr/bin/env python3
"""Fetch only pinned public source URLs; never bypass an embargo or login.
Acquisition receipts are saved separately; original checked snapshots are never replaced.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request
import urllib.error
from datetime import datetime, timezone
from xlsx_reader import Workbook

ROOT=Path(__file__).resolve().parents[2]


def ckan_resource_public(package, resource, as_of):
    end=package.get('embargo_end_date')
    if end and str(end)>as_of:return False,'dataset embargo until '+str(end)
    raw=resource.get('restricted','')
    if raw:
        try:
            if json.loads(raw).get('level')!='public':return False,'resource-level restriction'
        except (ValueError,TypeError):return False,'unreadable resource access restriction'
    return True,'public resource metadata'


def acquire_one(spec, destination, allow_research):
    if 'NC' in spec['license'] and not allow_research:
        return {'path':spec['path'],'status':'not_requested_noncommercial_research_opt_in_required'}
    # The CSV context snapshots are transformations, not the source bytes.
    if not spec['path'].endswith('.xlsx'):
        return {'path':spec['path'],'status':'pinned_derived_snapshot_use_offline_import','upstream_url':spec['url']}
    target=destination/Path(spec['path']).name
    if target.exists():return {'path':str(target),'status':'already_exists_not_overwritten'}
    try:
        with urllib.request.urlopen(spec['url'],timeout=30) as response:
            content=response.read(30_000_001)
            if len(content)>30_000_000:raise ValueError('Download exceeds budget')
            digest=hashlib.sha256(content).hexdigest()
            if digest!=spec['sha256'] or len(content)!=spec['bytes']:
                return {'path':spec['path'],'status':'upstream_version_changed_not_installed','sha256_received':digest,'bytes_received':len(content)}
            target.write_bytes(content)
            return {'path':str(target),'status':'acquired_checksum_verified','bytes':len(content),'sha256':digest,'license':spec['license'],'url':spec['url']}
    except (urllib.error.URLError,ValueError,TimeoutError) as e:
        return {'path':spec['path'],'status':'unavailable','reason':str(e)}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--destination',required=True);p.add_argument('--include-noncommercial-research',action='store_true');a=p.parse_args()
    out=Path(a.destination);out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'research-data/calibration/manifest.json').read_text())
    with ThreadPoolExecutor(4) as pool:results=list(pool.map(lambda s:acquire_one(s,out,a.include_noncommercial_research),manifest['files']))
    receipt={'checked_at':datetime.now(timezone.utc).isoformat(),'results':results}
    (out/'acquisition-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False))

if __name__=='__main__':main()
