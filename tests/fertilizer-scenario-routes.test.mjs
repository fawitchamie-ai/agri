import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness,restartDatabase} from './support/local-route-harness.mjs';
import {fixture} from './support/field-trial-fixture.ts';
import {fertilizerScope} from '../lib/seasonal/fertilizer-scenario.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
const base='https://agri.test';
async function req(body,status=200,path='/api/seasonal'){const r=await localFetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,700));return d;}
test('transferred assumptions and calculated responses persist by revision and remain private',async()=>{try{
 const c=fixture();c.waterCondition='drained';c.managementPlan=emptyManagement(c);c.managementPlan.products=[{id:'p',date:c.asOfDate,kind:'fertilizer',product:'Synthetic NPK',dose:200,unit:'kg/ha',status:'planned',source:'Synthetic test label',npkPercent:[15,15,15]}];
 c.fertilizerScenario={version:'quefts-scenario-1',scope:fertilizerScope(c),acceptedTransfer:true,ceilingKgHa:6000,ceilingSource:'Software fixture only',availableOn:c.asOfDate,control:null};
 setIdentity(null);await req({action:'save',id:'quefts-private',expectedRevision:0,config:c},401);
 setIdentity({userId:'q-owner',email:'q-owner@example.test',displayName:'Owner'});
 const saved=await req({action:'save',id:'quefts-private',expectedRevision:0,config:c},201);
 assert.equal(saved.campaign.plan.fertilizerScenario.status,'exploratory_transfer');assert.ok(saved.campaign.plan.fertilizerScenario.results.deltaKgHa[0]>0);
 c.managementPlan.products[0].dose=100;
 const next=await req({action:'save',id:'quefts-private',expectedRevision:1,config:c});assert.ok(next.campaign.plan.fertilizerScenario.results.deltaKgHa[0]<saved.campaign.plan.fertilizerScenario.results.deltaKgHa[0]);
 restartDatabase();const current=await req(undefined,200,'/api/seasonal?id=quefts-private');assert.deepEqual(current.campaign.config.fertilizerScenario,c.fertilizerScenario);assert.deepEqual(current.campaign.plan.fertilizerScenario,next.campaign.plan.fertilizerScenario);
 const old=await req(undefined,200,'/api/seasonal?id=quefts-private&revision=1');assert.deepEqual(old.plan.fertilizerScenario,saved.campaign.plan.fertilizerScenario);
 setIdentity({userId:'q-other',email:'q-other@example.test',displayName:'Other'});await req(undefined,404,'/api/seasonal?id=quefts-private');
}finally{closeHarness();}});
