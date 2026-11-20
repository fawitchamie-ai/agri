import test from 'node:test';
import assert from 'node:assert/strict';
import {planSeason} from '../lib/seasonal/yield.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import type {GrowthScenario} from '../lib/seasonal/growth.ts';
import {enrichedCampaignFixture} from './support/enriched-campaign-fixture.ts';

test('a rich campaign keeps the same water scenarios, evidence and balances without mutating the inputs',()=>{
 const c=enrichedCampaignFixture(),before=JSON.stringify(c),plan=planSeason(c);
 assert.equal(plan.growth?.status,'scenario');assert.equal(plan.complete,true);
 for(const scenario of plan.waterImpact!.scenarios){
  const water=planWater(c,[],{irrigationMode:scenario.id,unitAreaM2:c.sowingPlan!.areaM2!,unitGeometry:plan.calculationArea!.geometry});
  assert.equal(scenario.etaMm,water.totals.actualEtMm);
  assert.equal(scenario.etmMm,water.totals.demandMm);
  const growth:GrowthScenario=plan.growth!.scenarios.find(s=>s.id===scenario.id)!;
  assert.equal(growth.water!.etaMm,water.totals.actualEtMm);
 }
 assert.deepEqual(plan.inputProvenance,c.inputs);
 assert.ok(plan.days.every(d=>Math.abs(d.balanceResidualMm)<1e-8));
 assert.equal(JSON.stringify(c),before);
 const original=plan.growth!.scenarios.find(s=>s.id==='proposed')!;
 c.managementPlan!.irrigation.applications=[];
 const updated=planSeason(c).growth!.scenarios.find(s=>s.id==='proposed')!;
 assert.equal(updated.water!.irrigationNetMm,0);
 assert.ok(original.water!.irrigationNetMm>0,'A later edit cannot reuse a preceding request’s water plan');
 assert.notEqual(original,updated);
 c.inputs!.values['weather.'+c.weather[0].date+'.rainMm'].acquiredAt='invalid';
 assert.throws(()=>planSeason(c),/Date de provenance/,'Every new request must validate its evidence again');
});
