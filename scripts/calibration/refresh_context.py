#!/usr/bin/env python3
"""Reacquire pinned open context snapshots into a separate directory.
A changed upstream SHA is reported and never silently accepted as the audited version.
"""
import argparse,csv,hashlib,io,json,math
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
import tempfile
import urllib.request,urllib.parse
from xml.sax.saxutils import escape
from xlsx_reader import Workbook
from acquire import ckan_resource_public
ROOT=Path(__file__).resolve().parents[2]
COUNTRIES={'Togo':'TGO','Benin':'BEN','Burkina Faso':'BFA','Ghana':'GHA','Senegal':'SEN',"Côte d'Ivoire":'CIV','Ivory Coast':'CIV'}
WOSIS_FIELDS=['country','profile_id','layer_id','profile_code','latitude','longitude','positional_uncertainty','upper_depth','lower_depth','date','value_avg','method_options','dataset_id','licence','source_snapshot_sha256']
OFRA_FIELDS=['source_row','source_id_text','country','crop','nutrient','year_text','latitude','longitude','variety','coefficient_a','coefficient_b','coefficient_c','citation','raw_values_json']
COUNTRY_BOUNDS={'TGO':(-.3,2,5.9,11.5),'BEN':(.7,4,6,12.6),'BFA':(-5.7,2.7,9.2,15.3),'GHA':(-3.5,1.4,4.4,11.4),'CIV':(-8.8,-2.3,4,11),'SEN':(-17.8,-11,12,17)}

def geojson_features(document,code):
    # RFC 7946 §§3.1.1,4: absent crs means WGS84 longitude, latitude.
    # Legacy explicit CRS84 is compatible; other declared CRS need reprojection.
    if document.get('type')!='FeatureCollection':raise ValueError('Expected GeoJSON FeatureCollection')
    if 'crs' in document and document['crs']!={'type':'name','properties':{'name':'urn:ogc:def:crs:OGC:1.3:CRS84'}}:raise ValueError('Unverified GeoJSON coordinate reference system')
    west,east,south,north=COUNTRY_BOUNDS[code]
    for feature in document['features']:
        geometry=feature.get('geometry') or {};xy=geometry.get('coordinates',[])
        if geometry.get('type')!='Point' or len(xy)!=2 or any(isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x) for x in xy):raise ValueError('Invalid point coordinates')
        lon,lat=xy
        if not(west<=lon<=east and south<=lat<=north):raise ValueError('Coordinate outside coarse country bounds; no silent axis swap')
    return document['features']

def canonical_wosis(document):
    """WFS has no stable row order. Canonicalize order, never values or precision."""
    key=lambda f:(f['properties']['profile_id'],f['properties']['layer_id'])
    features=sorted(document['features'],key=key)
    if len({key(f) for f in features})!=len(features):raise ValueError('Duplicate WoSIS profile/layer key')
    normalized={**document,'features':features}
    digest=hashlib.sha256(json.dumps(normalized,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    return digest,features

def get(url,limit=30_000_000):
    with urllib.request.urlopen(url,timeout=30) as r:
        b=r.read(limit+1)
        if len(b)>limit:raise ValueError('Download exceeds budget')
        return b

def csv_bytes(fields,rows):
    f=io.StringIO(newline='');w=csv.DictWriter(f,fields);w.writeheader();w.writerows(rows);return f.getvalue().encode()

def ofra_bytes(path):
    w=Workbook(path);out=[]
    for n,r in w.rows('Raw'):
        if n==1 or len(r)<47 or r[6] not in COUNTRIES:continue
        out.append(dict(source_row=n,source_id_text=r[2],country=COUNTRIES[r[6]],crop=r[16],nutrient=str(r[39] or '').strip(),year_text=r[13],latitude=r[9],longitude=r[10],variety=r[17],coefficient_a=r[40],coefficient_b=r[41],coefficient_c=r[42],citation=r[45],raw_values_json=json.dumps(r[:47],ensure_ascii=False)))
    w.close();return csv_bytes(OFRA_FIELDS,out)

def wosis_url(country,start=0):
    filt='<Filter xmlns="http://www.opengis.net/fes/2.0"><PropertyIsEqualTo><ValueReference>country_name</ValueReference><Literal>'+escape(country)+'</Literal></PropertyIsEqualTo></Filter>'
    q=dict(map='/map/wosis_latest.map',SERVICE='WFS',VERSION='2.0.0',REQUEST='GetFeature',TYPENAMES='ms:wosis_latest_phaq',COUNT='10000',OUTPUTFORMAT='geojson',FILTER=filt)
    if start:q['STARTINDEX']=str(start)
    return 'https://maps.isric.org/mapserv?'+urllib.parse.urlencode(q)

def wosis_rows(country,code,expected_hash):
    rows=[];start=0
    while True:
        b=get(wosis_url(country,start))
        d=json.loads(b)
        geojson_features(d,code)
        digest,features=canonical_wosis(d)
        if start==0 and digest!=expected_hash:raise ValueError('WoSIS upstream values or metadata changed for '+country+'; review new version before replacing snapshot')
        for x in features:
            v=x['properties'];lic=v['licence']
            if v['country_name']!=country:raise ValueError('Server did not apply the requested country filter')
            if 'NonCommercial' in lic or 'CC BY-NC' in lic:continue
            if not any(s in lic for s in ['CC BY 4.0','CC BY 3.0','U.S. Public Domain']):continue
            lon,lat=x['geometry']['coordinates']
            rows.append(dict(country=code,latitude=lat,longitude=lon,source_snapshot_sha256=digest,**{k:v.get(k) for k in WOSIS_FIELDS if k not in ['country','latitude','longitude','source_snapshot_sha256']}))
        if len(features)<10000:
            matched=d.get('numberMatched')
            if isinstance(matched,int) and start+len(features)!=matched:raise ValueError('WoSIS coverage incomplete: returned count differs from numberMatched')
            break
        start+=10000
        if start>=50000:raise ValueError('Coverage incomplete: country exceeds acquisition budget, no complete snapshot claimed')
    return rows

def install_snapshot(spec,content,destination):
    sha=hashlib.sha256(content).hexdigest()
    if sha!=spec['sha256']:return {'source':spec['source_id'],'status':'transformed_snapshot_differs_not_installed','sha256_received':sha}
    path=destination/Path(spec['path']).name
    if path.exists():return {'source':spec['source_id'],'status':'existing_destination_not_overwritten'}
    path.write_bytes(content);return {'source':spec['source_id'],'status':'acquired_and_reproduced','sha256':sha,'bytes':len(content),'path':str(path)}

def refresh(spec,destination):
    try:
        if spec['source_id']=='ofra-functions':
            b=get(spec['url'])
            if hashlib.sha256(b).hexdigest()!=spec['upstream_sha256']:raise ValueError('OFRA source version changed')
            with tempfile.NamedTemporaryFile(suffix='.xlsx') as f:
                f.write(b);f.flush();content=ofra_bytes(f.name)
        elif spec['source_id']=='wosis-phaq':
            # Preserve the frozen country order as part of the snapshot serialization.
            names={'TGO':'Togo','BEN':'Benin','BFA':'Burkina Faso','GHA':'Ghana','CIV':"Côte d'Ivoire",'SEN':'Senegal'}
            def load_country(s):return wosis_rows(names[s['country']],s['country'],s['canonical_sha256'])
            with ThreadPoolExecutor(4) as pool:parts=list(pool.map(load_country,spec['upstream_by_country']))
            content=csv_bytes(WOSIS_FIELDS,[r for part in parts for r in part])
        elif spec['source_id']=='iita-togo-variety':
            metadata=json.loads(get('https://data.iita.org/api/3/action/package_show?id=grain-yield-and-other-agronomic-traits-of-international-maize-trials-togo'))['result']
            matches=[r for r in metadata['resources'] if r['url']==spec['url']]
            if len(matches)!=1:raise ValueError('Resource identity changed')
            public,reason=ckan_resource_public(metadata,matches[0],date.today().isoformat())
            if not public:raise ValueError(reason)
            if metadata.get('rights')!='CC-BY 4.0':raise ValueError('Data licence requires review')
            content=get(spec['url'])
        else:return {'source':spec['source_id'],'status':'not_open_context_source'}
        return install_snapshot(spec,content,destination)
    except Exception as e:return {'source':spec['source_id'],'status':'not_reproduced','reason':str(e)}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--destination',required=True);a=p.parse_args();out=Path(a.destination);out.mkdir(parents=True,exist_ok=True)
    specs=json.loads((ROOT/'research-data/calibration/manifest.json').read_text())['files'];results=[refresh(s,out) for s in specs if '/open/' in s['path']]
    (out/'context-receipt.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps(results,ensure_ascii=False))
if __name__=='__main__':main()
