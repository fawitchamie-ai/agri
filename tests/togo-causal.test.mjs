import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {planSeason} from '../lib/seasonal/yield.ts';
const source=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')));
test('the actual Togo reconstruction reaches the documented K ceiling without a forced water penalty',t=>{
 // Reproduce the archived calculation at its clock; the synthetic land fixture
 // must not become a different experiment after its 24-hour operational expiry.
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 for(const c of source.cases.slice(0,3)){
  const g=planSeason(c.config,c.reconstructionForcing).growth;assert.equal(g.status,'scenario');const s=g.scenarios.find(r=>r.id==='proposed');
  const ceiling=s.balance.suppliedKgHa[2]/c.config.growth.parameters.nutrientKgPerTonneBiomass[2]*1000*c.config.growth.parameters.harvestIndex/.87;
  assert.ok(Math.abs(s.yieldKgHa-ceiling)<1e-7);assert.ok(Math.abs(s.yieldKgHa-c.result.yieldKgHa)<1e-7);
  assert.ok(s.diagnostics.atNutrientCeiling);assert.equal(s.diagnostics.nutrientLimitedDays[2],62);
  assert.ok(s.days.every(d=>d.nutrientBalanceResidualKgHa.every(n=>Math.abs(n)<1e-8)));
 }
});
test('announced hypothetical calendars preserve each published stage total',()=>{
 const x=JSON.parse(gunzipSync(readFileSync('research-data/togo-causal/2026-11-10/rue-daily.json.gz')));
 assert.equal(x.records.length,36);
 for(const r of x.records.filter(r=>r.experiment==='A-original'||r.experiment==='B-nutrition-unlimited')){
  const index=['FI','80','60'].indexOf(r.treatment);assert.ok(index>=0);
  r.byStage.forEach((s,i)=>assert.ok(Math.abs(s.irrigationNetMm-source.published.irrigationMm[index][i])<1e-7));
 }
 const matched=x.contrasts.filter(r=>r.experiment==='A-original'&&r.calendar==='daily');assert.ok(matched.every(r=>r.firstKLimited==='2018-02-03'));
 const deficit=matched.find(r=>r.treatment==='60');assert.equal(deficit.firstWaterFactorDivergence,'2018-02-04');assert.equal(deficit.firstBiomassDivergence,null);
});
