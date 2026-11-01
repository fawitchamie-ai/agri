import test from 'node:test';import assert from 'node:assert/strict';
import {waterIndicator} from '../lib/seasonal/water-indicator.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {declareScenario,migrateInputs} from '../lib/seasonal/provenance.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
test('water indicator explains required acceptance and calculates after explicit scenario consent',()=>{
 const c=migrateInputs(exampleCampaign());c.inputPolicy={allowAssumptions:false,allowStale:false};const blocked=planSeason(c);
 assert.equal(blocked.status,'blocked');assert.equal(waterIndicator(c,blocked).kind,'assumptions');assert.equal(waterIndicator(c,blocked).percent,null);
 const accepted=declareScenario(c),plan=planSeason(accepted),ready=waterIndicator(accepted,plan);assert.equal(ready.kind,'ready');assert.ok(ready.percent!>=0&&ready.percent!<=100);assert.equal(plan.days.length,c.stages.reduce((n,s)=>n+s.days,0));
 assert.equal(c.inputPolicy.allowAssumptions,false);assert.equal(accepted.inputPolicy!.allowAssumptions,true);
 assert.equal(waterIndicator(accepted,plan,true).percent,null);assert.equal(waterIndicator(accepted,plan,false,true).kind,'computing');
});
test('missing weather and null demand never turn into a water satisfaction score',()=>{
 const c=declareScenario(exampleCampaign());c.weather=[];c.fallback=null;const p=planSeason(c);assert.equal(waterIndicator(c,p).kind,'missing');assert.equal(waterIndicator(c,p).percent,null);
 const valid=planSeason(declareScenario(exampleCampaign()));valid.totals.demandMm=0;assert.equal(waterIndicator(c,valid).percent,null);
});
