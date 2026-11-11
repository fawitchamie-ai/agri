"""Acquire public, checksum-pinned official reference archives; never redistribute binaries."""
from pathlib import Path
import hashlib, json, sys, urllib.request
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
files=[
 ('AquaCrop-v7.3_typofix.tar.gz','9813648659c9688d8be47698a0678cddebb8e18e27c745574b3a892731d4f898','https://api.github.com/repos/KUL-RSDA/AquaCrop/tarball/v7.3_typofix'),
 ('aquacrop-7.3-x86_64-linux.zip','cb018479b3b4c1352c9608eed5a680cee4a826622616cee6aaeb3fb09c33babe','https://github.com/KUL-RSDA/AquaCrop/releases/download/v7.3_typofix/aquacrop-7.3-x86_64-linux.zip')]
for name,expected,url in files:
 path=root/name
 if not path.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'AgriPrevision-scientific-replay'})
  with urllib.request.urlopen(request,timeout=60) as response:data=response.read()
  if hashlib.sha256(data).hexdigest()!=expected:raise SystemExit('Official archive checksum mismatch: '+name)
  path.write_bytes(data)
 if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise SystemExit('Existing official archive checksum mismatch: '+name)
 print(json.dumps({'file':name,'sha256':expected,'source':url}))
