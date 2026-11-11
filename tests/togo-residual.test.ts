import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {togoResidualScenario} from '../lib/seasonal/togo-residual-scenario.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
const archive=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')).toString());
test('candidate preserves input and runs through shared water, grain and area calculations',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const expected=[2200.4,1845.4123888153124,988.3164509405723];
 for(let i=0;i<3;i++){
  const original=archive.cases[i].config,before=JSON.stringify(original),c=togoResidualScenario(original),p=planSeason(c,archive.cases[i].reconstructionForcing);
  assert.equal(JSON.stringify(original),before);
  assert.ok(p.complete);assert.ok(p.days.every(d=>Math.abs(d.balanceResidualMm)<1e-8));
  for(const [j,v] of [82.4,203.7,385.8,83.3].entries())assert.ok(Math.abs(p.stages[j].demandMm-v)<1e-8);
  const s=p.yieldEstimation!.scenarios.find(s=>s.id==='recorded')!;
  assert.ok(Math.abs(s.totals!.yieldKgHaSown!-expected[i])<1e-6);
  assert.ok(Math.abs(s.totals!.productionKg!-expected[i]*c.yieldEstimation!.units[0].sownAreaM2!/10000)<1e-7);
 }
 const missing=structuredClone(archive.cases[0].config);missing.weather.pop();assert.throws(()=>togoResidualScenario(missing),/complète/);
 const elsewhere=structuredClone(archive.cases[0].config);elsewhere.country='GHA';assert.throws(()=>togoResidualScenario(elsewhere),/limité/);
});
