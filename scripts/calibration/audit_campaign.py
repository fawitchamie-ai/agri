#!/usr/bin/env python3
"""Inspect a local exported campaign, without treating simulations as harvest labels.
No upload, training, mutation or publication of private records.
"""
import argparse,json,base64,zlib
from pathlib import Path

def decode(value):
    if not isinstance(value,str):return value
    obj=json.loads(value)
    if isinstance(obj,dict) and obj.get('encoding')=='agri-deflate-json-1':
        b=zlib.decompressobj(-15).decompress(base64.b64decode(obj['data']),16_000_001)
        if len(b)>16_000_000:raise ValueError('Snapshot exceeds budget')
        return json.loads(b)
    return obj

def audit_export(document):
    c=document.get('campaign',document)
    config=decode(c.get('config',{}));events=decode(c.get('events',[]))
    products=(config.get('managementPlan') or {}).get('products',[])
    weather=config.get('weather',[])
    return {'version':'private-campaign-audit-1','country':config.get('country'),'crop_id':(config.get('cropProfile') or {}).get('id'),'irrigation_recorded':sum(e.get('kind')=='irrigation' and e.get('status') in ['measured','declared'] for e in events),'irrigation_planned':sum(e.get('kind')=='irrigation' and e.get('status')=='planned' for e in events),'product_applications_declared':sum(x.get('status')=='declared' for x in products),'product_applications_planned':sum(x.get('status')=='planned' for x in products),'soil_analyses':len(config.get('soilAnalyses',[])),'weather_by_status':{s:sum(w.get('status')==s for w in weather) for s in ['observed','estimated','forecast','scenario']},'yield_reference_is_a_harvest_label':False,'plan_is_a_harvest_label':False,'experimental_randomization_documented':False,'public_corpus_imported':False,'missing':['Observed harvested mass/product, moisture, source, denominator and documented area are required separately.','User campaign is observational, not a randomized trial.','Consent, ownership and data-use rights are required before any training export.']}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('file');a=p.parse_args();f=Path(a.file)
    if f.stat().st_size>16_000_000:raise ValueError('File too large')
    print(json.dumps(audit_export(json.loads(f.read_text())),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
