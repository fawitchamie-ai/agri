"""Read the same real source assets with GDAL/Rasterio, independently of geotiff.js.

pip install -r tests/requirements-geo.txt
python scripts/check-raster-reference.py
No agronomic or field validation is claimed by this decoder comparison.
"""
import json
import io
import math
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pyproj
import rasterio
import shapely
from rasterio.windows import Window, from_bounds
from shapely.geometry import Polygon, box

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'docs/verification-terrain-2026-10-31.json').read_text())
geod = pyproj.Geod(ellps='WGS84')
results = []

class HTTPRangeFile(io.RawIOBase):
    """Verified urllib transport; GDAL remains the independent TIFF decoder."""
    def __init__(self, url):
        super().__init__()
        if not url.endswith('.tif'):
            raise FileNotFoundError(url)
        self.url, self.position, self.cache = url, 0, {}
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=0-0'}), timeout=20) as response:
            if response.status != 206:
                raise ValueError('Source must support partial reads.')
            self.length = int(response.headers['Content-Range'].split('/')[-1])

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset if whence == 0 else self.position + offset if whence == 1 else self.length + offset
        if self.position < 0:
            raise ValueError('Negative seek.')
        return self.position

    def read(self, size=-1):
        size = min(self.length-self.position, size if size >= 0 else self.length-self.position)
        if size <= 0:
            return b''
        if size > 4_000_000:
            raise ValueError('Bounded check refuses a full-file read.')
        chunks = []
        while size:
            index, offset = divmod(self.position, 65536)
            if index not in self.cache:
                start, end = index*65536, min((index+1)*65536-1, self.length-1)
                request = urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{end}'})
                with urllib.request.urlopen(request, timeout=20) as response:
                    if response.status != 206:
                        raise ValueError('Partial read unavailable.')
                    self.cache[index] = response.read(65537)
                if len(self.cache) > 64:
                    del self.cache[next(iter(self.cache))]
            part = self.cache[index][offset:offset+size]
            if not part:
                raise ValueError('Truncated source block.')
            chunks.append(part)
            self.position += len(part)
            size -= len(part)
        return b''.join(chunks)

with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT=20, GDAL_HTTP_CAINFO=ssl.get_default_verify_paths().cafile):
    for case in data['results']:
        polygon = Polygon(case['geometry']['coordinates'][0])
        for source in case.get('assessment', {}).get('sources', []):
            if source['id'] not in ('worldcover', 'jrc') or source['status'] != 'available':
                continue
            areas = {}
            errors = []
            for asset in source['assets']:
                try:
                    with rasterio.open(asset, opener=lambda path, mode='rb': HTTPRangeFile(path)) as src:
                        if src.crs.to_epsg() != 4326:
                            raise ValueError('This reference check expects the source WGS84 grids.')
                        clip = polygon.intersection(box(*src.bounds))
                        if clip.is_empty:
                            continue
                        w = from_bounds(*clip.bounds, transform=src.transform)
                        x0, y0 = max(0, math.floor(w.col_off)), max(0, math.floor(w.row_off))
                        x1 = min(src.width, math.ceil(w.col_off + w.width))
                        y1 = min(src.height, math.ceil(w.row_off + w.height))
                        if (x1-x0)*(y1-y0) > 10000:
                            raise ValueError('Window exceeds the bounded live check.')
                        values = src.read(1, window=Window(x0, y0, x1-x0, y1-y0), masked=True)
                        for y in range(y0, y1):
                            for x in range(x0, x1):
                                v = values[y-y0, x-x0]
                                if getattr(v, 'mask', False):
                                    continue
                                left, top = src.transform * (x, y)
                                right, bottom = src.transform * (x+1, y+1)
                                intersection = polygon.intersection(box(left, bottom, right, top))
                                if intersection.is_empty:
                                    continue
                                area = abs(geod.geometry_area_perimeter(intersection)[0])
                                areas[str(int(v))] = areas.get(str(int(v)), 0) + area
                except Exception as exc:
                    errors.append(str(exc))
            total = sum(areas.values())
            row = {'country': case['country'], 'sector': case['name'], 'source': source['id'],
                   'decodedFractions': {key: value/total for key, value in sorted(areas.items())} if total else {},
                   'errors': errors}
            results.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
output = {'generatedAt': datetime.now(timezone.utc).isoformat(),
          'versions': {'rasterio': rasterio.__version__, 'shapely': shapely.__version__, 'pyproj': pyproj.__version__},
          'scope': 'Independent native-pixel decoder check on the same recorded assets, with ellipsoidal area weights. Not independent ground truth or crop validation.',
          'fieldValidation': False, 'results': results}
(root / 'docs/verification-rasterio-2026-10-31.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
