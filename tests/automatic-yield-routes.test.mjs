import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness,restartDatabase} from './support/local-route-harness.mjs';
import {automaticYieldFixture} from './support/automatic-yield-fixture.ts';
const url='https://agri.test/api/seasonal';
async function post(body,status=200){
 const response=await localFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});
 const data=await response.json();assert.equal(response.status,status,JSON.stringify(data).slice(0,600));return data;
}
test('automatic yield is recalculated by the API, isolated by owner and preserved in immutable revisions',async()=>{try{
 const config=automaticYieldFixture();
 setIdentity(null);await post({action:'simulate',config,events:[]},401);
 setIdentity({userId:'automatic-owner',email:'automatic@example.test',displayName:'Automatic yield test'});
 const {plan}=await post({action:'simulate',config,events:[]});
 assert.equal(plan.automaticYield.status,'ready');assert.ok(plan.growth.scenarios[2].yieldKgHa>0);
 const id=crypto.randomUUID();
 const {campaign}=await post({action:'save',id,config,events:[],expectedRevision:0,plan:{growth:{scenarios:[{yieldKgHa:999999}]}}},201);
 assert.equal(campaign.config.growth,undefined);assert.equal(campaign.config.automaticYield.enabled,true);
 assert.deepEqual(campaign.plan.automaticYield,plan.automaticYield);assert.deepEqual(campaign.plan.growth,plan.growth,'The server ignores a forged client result');
 restartDatabase();
 const loaded=await (await localFetch(url+'?id='+id)).json();assert.deepEqual(loaded.campaign.plan.growth,plan.growth);
 const changed=structuredClone(config);changed.automaticYield.soilSupply={initialKgHa:[30,.1,40],releaseKgHaDay:[.3,0,.2],source:'SYNTHETIC SOFTWARE TEST, low available P'};
 const revised=await post({action:'save',id,config:changed,events:[],expectedRevision:1});
 assert.equal(revised.campaign.revision,2);assert.ok(revised.campaign.plan.growth.scenarios[2].yieldKgHa<plan.growth.scenarios[2].yieldKgHa);
 const old=await (await localFetch(url+'?id='+id+'&revision=1')).json();assert.deepEqual(old.plan.growth,plan.growth);assert.equal(old.config.automaticYield.soilSupply,undefined);
 await post({action:'save',id,config:changed,events:[],expectedRevision:1},409);
 setIdentity({userId:'automatic-other',email:'other@example.test',displayName:'Other account'});
 assert.equal((await localFetch(url+'?id='+id)).status,404);assert.equal((await localFetch(url+'?id='+id+'&revision=1')).status,404);
 const list=await (await localFetch(url)).json();assert.ok(!list.campaigns.some(c=>c.id===id));
}finally{closeHarness();}});
