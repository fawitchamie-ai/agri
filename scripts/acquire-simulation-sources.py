"""Restore the exact public source files; never fetch private or on-request data."""
from pathlib import Path
import hashlib,json,urllib.request
folder=Path('research-data/simulation-audit/2026-11-10')
for source in json.loads((folder/'sources.json').read_text()):
 p=folder/source['file']
 if p.exists():
  if hashlib.sha256(p.read_bytes()).hexdigest()!=source['sha256']:raise RuntimeError(f'Existing file differs: {p}; not overwritten')
  print('Verified',p.name);continue
 with urllib.request.urlopen(source['url'],timeout=60) as response:data=response.read()
 if hashlib.sha256(data).hexdigest()!=source['sha256']:raise RuntimeError(f'Public source changed: {p}; not written')
 p.write_bytes(data);print('Restored',p.name)
