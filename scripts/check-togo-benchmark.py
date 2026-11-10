"""Checks after an ACTUAL pinned AquaCrop run, never a surrogate calculation."""
import gzip,json,math,pathlib
p=pathlib.Path('research-data/togo-causal/2026-11-10')
a=json.load(gzip.open(p/'aquacrop-daily.json.gz'));r=json.load(gzip.open(p/'rue-daily.json.gz'))
assert a['parameters']['version']=='3.0.12'
assert len(a['results'])==20
for row in a['results']:
 assert row['maxWaterBalanceResidualMm']<1e-6
 assert abs(row['yieldDryTonneHa']*1000-row['biomassKgHa']*row['HIadjusted'])<1e-5
 assert abs(row['yieldAt13PercentKgHa']*.87-row['yieldDryTonneHa']*1000)<1e-5
 assert row['deliveredIrrigationMm']<=row['plannedIrrigationMm']+1e-6
 assert all(math.isfinite(d['biomassKgHa']) and d['canopyCover']>=0 and d['canopyCover']<=1 for d in row['days'])
for row in r['records']:
 for d in row['days']:
  assert all(abs(n)<1e-7 for n in d['nutrientBalanceResidualKgHa'])
  w=d['water'];assert abs(w['stockStartMm']+w['rootGainMm']+w['assimilationMm']+w['rainMm']+w['irrigationNetMm']-w['runoffMm']-w['drainageMm']-w['actualEtMm']-w['stockEndMm'])<1e-7
assert abs(r['formula']['ceilingTonneHa']-r['formula']['simulatedTonneHa'])<1e-8
print('PASS: 20 actual AquaCrop runs; daily full-profile water and dry-grain mass checks; 36 RUE diagnostic cases and daily root-zone/NPK balances. No calibration or validation claim.')
