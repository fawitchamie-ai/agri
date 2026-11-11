import test from 'node:test';import assert from 'node:assert/strict';
import {canopyFixture} from './support/canopy-fixture.ts';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
test('actual campaign handlers compute and save the canopy model, ignoring a forged yield and retaining revisions',async()=>{try{
 setIdentity({userId:'canopy-owner',email:'canopy@example.test',displayName:'Canopy owner'});
 const config=canopyFixture();let revision=0;
 async function send(action,extra={}){const r=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify({action,id:'canopy-campaign',expectedRevision:revision,config,...extra})});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));if(d.campaign)revision=d.campaign.revision;return d;}
 const result=await send('simulate',{plan:{canopyNowcast:{yieldKgHa:999999}}});
 assert.equal(result.plan.canopyNowcast.status,'experimental_nowcast');assert.ok(result.plan.canopyNowcast.yieldKgHa<2000);
 const saved=await send('save');assert.equal(saved.campaign.plan.canopyNowcast.yieldKgHa,result.plan.canopyNowcast.yieldKgHa);
 assert.equal(saved.campaign.config.canopyNowcast.observations.length,2);
 config.canopyNowcast.observations[1].laiSamples=[2,2,2];const changed=await send('save');assert.ok(changed.campaign.plan.canopyNowcast.yieldKgHa>result.plan.canopyNowcast.yieldKgHa);
 const prior=await localFetch('https://agri.test/api/seasonal?id=canopy-campaign&revision=1');const old=await prior.json();assert.equal(old.plan.canopyNowcast.yieldKgHa,result.plan.canopyNowcast.yieldKgHa);
 setIdentity({userId:'other',email:'other@example.test',displayName:'Other'});assert.equal((await localFetch('https://agri.test/api/seasonal?id=canopy-campaign')).status,404);
}finally{closeHarness();}});
