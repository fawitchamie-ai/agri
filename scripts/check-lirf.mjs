/** Check executed results and data partitions; not a scientific accuracy certificate. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root='research-data/lirf/2026-11-10/';
const a=JSON.parse(gunzipSync(await readFile(root+'adapter.json.gz'))),s=JSON.parse(await readFile(root+'replay-summary.json','utf8')),h=JSON.parse(await readFile(root+'holdout-2011-results.json','utf8')),f=JSON.parse(await readFile(root+'profile-frozen-2012.json','utf8'));
assert.equal(a.cases.length,24);assert.equal(a.annualRows,96);assert.equal(a.usableGrainRows,94);
assert.equal(a.cases.flatMap(c=>c.annualObservations).filter(o=>o.grainKgHa===null).length,2);
assert.equal(a.cases.filter(c=>c.year===2013).flatMap(c=>c.annualObservations).filter(o=>o.biomassKgHa===null).length,48);
assert.ok(s.records.every(r=>r.fittedProfileActuallyExecuted&&r.maxBalanceResidualMm<1e-7));
assert.ok(s.fits.every(r=>r.trainingYears.length===1&&r.trainingYears[0]===2012&&r.years['2013'].biomass.n===0));
const fitted=s.fits.find(r=>r.mode==='dual-wp'&&r.wpRatio===.5);
assert.ok(Math.abs(fitted.waterProductivityGm2-f.profile.waterProductivityGm2)<1e-10);
assert.equal(h.no2011Fitting,true);assert.equal(h.records.length,24);
assert.equal(h.frozenProfile.waterProductivityGm2,f.profile.waterProductivityGm2);
assert.ok(h.records.every(r=>r.plots.length===4&&r.maxBalanceResidualMm<1e-7&&Number.isFinite(r.predictedGrainKgHa)));
console.log('PASS: 24 treatment-season replays, 94 nonmissing grain observations; actual fitted-profile executions; 2013 biomass correctly unavailable; 2011 frozen-coefficient evaluation; water balances. No African validation claim.');
