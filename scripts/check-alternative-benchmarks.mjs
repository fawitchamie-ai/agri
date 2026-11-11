/** Invariants and provenance checks, not a certificate of local accuracy. */
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const root='research-data/alternative-models/2026-11-11/';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const [old,current,old2011,current2011,audit,ghana,profile]=await Promise.all([
 json('research-data/lirf/2026-11-10/replay-summary.json'),json(root+'current-replay/replay-summary.json'),
 json('research-data/lirf/2026-11-10/holdout-2011-results.json'),json(root+'current-replay/holdout-2011-results.json'),
 json(root+'audit/results.json'),json(root+'ghana/monitoring-results.json'),json('lib/seasonal/profiles/ghana-canopy-2021.json')]);
// Defaults preserve the existing equations; rejected structural profiles remain opt-in diagnostics.
assert.equal(current.records.length,216);assert.ok(current.records.every(r=>r.fittedProfileActuallyExecuted&&r.maxBalanceResidualMm<1e-7));
for(const fit of current.fits){const before=old.fits.find(x=>x.mode===fit.mode&&x.wpRatio===fit.wpRatio);assert.ok(before);assert.deepEqual(fit.trainingYears,[2012]);assert.equal(fit.years['2013'].biomass.n,0);assert.ok(Math.abs(fit.years['2013'].grain.rmse-before.years['2013'].grain.rmse)<1e-6);}
assert.equal(current2011.no2011Fitting,true);assert.equal(current2011.frozenProfile.waterProductivityGm2,old2011.frozenProfile.waterProductivityGm2);
for(const r of current2011.results){const b=old2011.results.find(x=>x.mode===r.mode&&x.efficiency===r.efficiency);assert.ok(Math.abs(r.rmseKgHa-b.rmseKgHa)<1e-6);}
assert.equal(audit.arithmeticCorrection.inside,false);assert.ok(audit.maxRatioChange<1e-9);
assert.ok(audit.trial.every(r=>r.after.maxRootBalanceResidualMm<1e-7&&r.after.maxProfileBalanceResidualMm<1e-7&&r.after.nutrientBalanceResidualKgHa.every(n=>Math.abs(n)<1e-7)));
const sets=['train','calibration','test'].map(k=>new Set(ghana.rows.filter(r=>r.split===k).map(r=>r.field)));
for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++)assert.ok([...sets[i]].every(id=>!sets[j].has(id)));
assert.equal(ghana.rows.length,46);assert.equal(ghana.test.canopy.nFields,10);
assert.equal(profile.trainFields,27);assert.equal(profile.calibrationFields,9);assert.equal(profile.grainMoisturePercent,null);
assert.deepEqual(profile.coefficients,ghana.coefficients);assert.deepEqual(profile.test,ghana.test);
assert.equal(profile.status,'experimental_local_hypothesis');assert.equal(profile.country,'GHA');
// The observed coverage failure must not be replaced by the requested nominal level.
assert.equal(profile.interval.nominalCoverage,.9);assert.equal(profile.test.coverage90,.7);
console.log('PASS: archived defaults preserved, current water/NPK balances, 2012-only fitting and frozen 2011 control, field-grouped LAI partitions, native grain basis and failed nominal coverage retained.');
