import test from 'node:test';import assert from 'node:assert/strict';
import {enrichedCampaignFixture} from './support/enriched-campaign-fixture.ts';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
test('enriched campaigns can simulate, save, load and revise while preserving observations and private history',async()=>{try{
 setIdentity({userId:'enriched-owner',email:'enriched@example.test',displayName:'Software test'});
 const config=enrichedCampaignFixture();
 const send=async(action,revision=0)=>{
  const response=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'content-type':'application/json',origin:'https://agri.test'},body:JSON.stringify({action,id:'enriched-campaign',expectedRevision:revision,config,events:[],plan:{growth:{yieldKgHa:999999}}})});
  const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;
 };
 const initial=await send('simulate'),saved=await send('save');
 assert.deepEqual(saved.campaign.plan,initial.plan);
 assert.equal(saved.campaign.config.fieldMonitoring.datedObservations.length,3);
 const previous=initial.plan.growth.scenarios.find(s=>s.id==='proposed').yieldKgHa;
 config.managementPlan.irrigation.applications=[];
 const changed=await send('save',1);assert.equal(changed.campaign.revision,2);
 assert.equal(changed.campaign.plan.growth.scenarios.find(s=>s.id==='proposed').water.irrigationNetMm,0);
 const old=await (await localFetch('https://agri.test/api/seasonal?id=enriched-campaign&revision=1')).json();
 assert.equal(old.plan.growth.scenarios.find(s=>s.id==='proposed').yieldKgHa,previous);
 assert.deepEqual(old.config.inputs,saved.campaign.config.inputs);
 const loaded=await (await localFetch('https://agri.test/api/seasonal?id=enriched-campaign')).json();
 assert.equal(loaded.campaign.revision,2);assert.equal(loaded.campaign.config.fieldMonitoring.datedObservations.length,3);
 setIdentity({userId:'another',email:'another@example.test',displayName:'Other'});
 assert.equal((await localFetch('https://agri.test/api/seasonal?id=enriched-campaign')).status,404);
}finally{closeHarness();}});
