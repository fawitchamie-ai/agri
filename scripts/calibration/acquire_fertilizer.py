"""Acquire versioned open fertilizer evidence; preserve immutable originals.

No credentials, restricted datasets, or private campaign data are requested.
An existing receipt pins bytes; changed upstream files require a new version folder.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'research-data/fertilizer/v1/raw'


def fetch(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        data = response.read(25_000_001)
    if len(data) > 25_000_000:
        raise ValueError('Source exceeds acquisition budget')
    return data


def acquire(destination=DEST):
    destination.mkdir(parents=True, exist_ok=True)
    receipt = destination.parent / 'sources.json'
    if receipt.exists():
        old = json.loads(receipt.read_text())
        for source in old['files']:
            if source['status'] == 'acquired':
                path=destination/source['path']
                content=path.read_bytes() if path.exists() else fetch(source['url'])
                if hashlib.sha256(content).hexdigest() != source['sha256']:
                    raise ValueError('Pinned original changed: ' + source['path'])
                if not path.exists():path.write_bytes(content)
        return old
    fig = json.loads(fetch('https://api.figshare.com/v2/articles/27022285'))
    zen = json.loads(fetch('https://zenodo.org/api/records/4383403'))
    if fig['license']['name'] != 'CC BY 4.0':
        raise ValueError('Unexpected Senegal license')
    if zen['metadata'].get('license',{}).get('id')!='cc-zero':
        raise ValueError('Unexpected OFRA license')
    specs = [dict(path='carob.zip', url='https://geodata.ucdavis.edu/carob/zip/doi_10.7910_DVN_GXUNAZ.zip',
                  doi='10.7910/DVN/GXUNAZ', version='2.2 / Carob 2023-05-29', license='CC-BY-4.0',
                  owner='Kihara, Okeyo, Bolo, Kinyua / Harvard Dataverse; Carob standardization'),
             dict(path='senegal.xlsx', url=next(f['download_url'] for f in fig['files'] if f['name']=='Senegal crop yield response database.xlsx'),
                  doi=fig['doi'], version=str(fig['version']), license='CC-BY-4.0', owner=fig['title']),
             dict(path='ofra.xlsx', url=zen['files'][0]['links']['self'], doi='10.5061/dryad.tt6h5h1',
                  version='Updated Aug 2023 / Zenodo 4383403', license='CC0-1.0', owner='Wortmann et al. / OFRA'),
             dict(path='carob-standardization.R',url='https://raw.githubusercontent.com/carob-data/carob/main/scripts/agronomy/doi_10.7910_DVN_GXUNAZ.R',
                  doi='10.7910/DVN/GXUNAZ',version='audit snapshot; not executed',license='GPL-3.0',owner='Carob'),
             dict(path='CAROB-LICENSE',url='https://raw.githubusercontent.com/carob-data/carob/main/LICENSE',doi='10.7910/DVN/GXUNAZ',version='GPL-3.0',license='GPL-3.0',owner='Carob')]
    def one(spec):
        try:
            data=fetch(spec['url'])
            target=destination/spec['path']
            if target.exists() and target.read_bytes()!=data:
                raise ValueError('Refusing to overwrite original')
            target.write_bytes(data)
            return dict(spec,status='acquired',sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),acquiredAt=datetime.now(timezone.utc).isoformat())
        except Exception as e:
            return dict(spec,status='unavailable',reason=str(e))
    with ThreadPoolExecutor(4) as pool:
        results=list(pool.map(one,specs))
    (destination/'figshare-metadata.json').write_text(json.dumps(fig,ensure_ascii=False,indent=2)+'\n')
    (destination/'zenodo-metadata.json').write_text(json.dumps(zen,ensure_ascii=False,indent=2)+'\n')
    result=dict(version='fertilizer-sources-1',files=results,
                excluded=[dict(doi='10.18167/DVN1/MHLKKW',reason='CC-BY-NC-SA-4.0; not used in operational evidence or training')])
    receipt.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--destination',type=Path,default=DEST)
    print(json.dumps(acquire(p.parse_args().destination),ensure_ascii=False))
