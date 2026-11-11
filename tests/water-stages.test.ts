import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {planSeason,parseYieldInput,yieldCsv} from '../lib/seasonal/yield.ts';
import {stageWaterFactor,waterStageScope} from '../lib/seasonal/water-stages.ts';
import {canReplayTogoStages,togoStageReplayInput,TOGO_STAGE_REPLAY_PROFILE as profile} from '../lib/seasonal/togo-stage-replay.ts';
import {addDays,validateConfig} from '../lib/seasonal/validation.ts';
import type {SeasonalConfig,WaterPlan} from '../lib/seasonal/types.ts';
const archive=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')).toString());
function fixture(index=0):SeasonalConfig{const c=structuredClone(archive.cases[index].config);c.yieldEstimation=togoStageReplayInput(c);return c;}
test('real Togo engine: one FI capacity yields distinct deficits, conserved water and correct area, with old evidence retained',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const values=archive.cases.slice(0,3).map((r:any,i:number)=>{const c=fixture(i),p=planSeason(c,r.reconstructionForcing),s=p.yieldEstimation!.scenarios.find(s=>s.id==='recorded')!;
  assert.equal(s.status,'conditional');assert.equal(p.waterImpact!.method,'stage-product');assert.equal(p.response!.status,'conditional_water_only');
  assert.ok(p.days.every(d=>Math.abs(d.balanceResidualMm)<1e-8));
  assert.ok(Math.abs(s.totals!.productionKg-s.totals!.yieldKgHaSown!*c.yieldEstimation!.units[0].sownAreaM2!/10000)<1e-8);
  assert.ok(Math.abs(p.growth!.scenarios.find(s=>s.id==='recorded')!.yieldKgHa-2574.1896551724076)<1e-7,'Previous RUE diagnostic must not be relabelled as a new grain model');
  const csv=yieldCsv(p.yieldEstimation!);
  assert.match(csv,/fao-stages/);
  assert.match(csv,/"humidite_reference_pct";"diagnostic_phases_json"/);
  assert.match(csv,/"13";"\{""version"":""FAO33-maize-stage-product-1\.0\.0/);
  const lengths=csv.slice(1).split('\r\n').map(line=>line.replace(/"(?:""|[^"])*"/g,'""').split(';').length);
  assert.ok(lengths.every(n=>n===lengths[0]),'All CSV rows have exactly the same columns');
  return s.totals!.yieldKgHaSown!;});
 assert.ok(Math.abs(values[0]-2200.4)<1e-7);
 assert.ok(Math.abs(values[1]-2155.831941716425)<1e-6);
 assert.ok(Math.abs(values[2]-1405.4782551085123)<1e-6);
 assert.ok(profile.reference.controlsUsedToFitCapacity.length===0);
});
test('same ET loss at different stages causes different grain response; no loss is applied twice',()=>{
 const c=fixture(),calendar=c.yieldEstimation!.responseCalendar!;
 const make=(from=0,to=0)=>Array.from({length:111},(_,i)=>({date:addDays(c.sowingDate,i),demandMm:5,actualEtMm:i+1>=from&&i+1<=to?4:5})) as WaterPlan['days'];
 assert.equal(stageWaterFactor(c,make(),calendar).factor,1);
 const veg=stageWaterFactor(c,make(21,38),calendar),flower=stageWaterFactor(c,make(66,83),calendar),late=stageWaterFactor(c,make(94,111),calendar);
 assert.ok(flower.factor!<veg.factor!);assert.ok(flower.factor!<late.factor!);
 assert.ok(Math.abs(flower.factor!-.7)<1e-10);
 const severe=make(66,83);for(const d of severe.slice(65,83))d.actualEtMm=0;
 const bad=stageWaterFactor(c,severe,calendar);assert.equal(bad.factor,null);assert.match(bad.missing.join(' '),/non physique/);
 const shifted=make();shifted[0].date=addDays(c.sowingDate,-1);assert.equal(stageWaterFactor(c,shifted,calendar).factor,null);
});
test('calendar scope is stable through validation; future references, changed crop and overlapping phases are rejected',()=>{
 const c=fixture(),v=validateConfig(c);
 assert.equal(waterStageScope(c),waterStageScope(v));
 const input=structuredClone(c.yieldEstimation!);input.responseCalendar!.floweringStartDay=10;
 assert.throws(()=>parseYieldInput(input,c),/chevauchantes/);
 input.responseCalendar=c.yieldEstimation!.responseCalendar;input.units[0].reference!.availableOn='2027-01-01';
 assert.throws(()=>parseYieldInput(input,c),/date de disponibilité/);
 const changed=structuredClone(c);changed.variety='Another variety';
 assert.equal(canReplayTogoStages(changed),false);assert.throws(()=>togoStageReplayInput(changed),/limité/);
 const otherYear=structuredClone(c);otherYear.sowingDate='2026-12-16';assert.equal(canReplayTogoStages(otherYear),false);
 for(const country of ['BEN','BFA','GHA','CIV','SEN'] as const){const other=structuredClone(c);other.country=country;assert.equal(canReplayTogoStages(other),false);}
});
