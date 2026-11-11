import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {togoStageReplayInput} from '../lib/seasonal/togo-stage-replay.ts';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const archive=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')));
test('actual campaign API computes three Togo stage responses, persists the active model and recalculates water edits',async()=>{try{
 setIdentity({userId:'togo-stage-owner',email:'togo-stage@example.test',displayName:'Togo test'});
 let config,events,revision=0;const values=[];
 async function send(action,extra={}){const r=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify({action,id:'togo-stages',expectedRevision:revision,config,events,plan:{yieldEstimation:{scenarios:[{totals:{yieldKgHaSown:999999}}]}},...extra})});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));if(d.campaign)revision=d.campaign.revision;return d;}
 for(const row of archive.cases.slice(0,3)){config=structuredClone(row.config);config.yieldEstimation=togoStageReplayInput(config);events=structuredClone(row.reconstructionForcing);const d=await send('simulate');values.push(d.plan.yieldEstimation.scenarios.find(s=>s.id==='recorded').totals.yieldKgHaSown);}
 assert.ok(values[0]>values[1]&&values[1]>values[2]);assert.ok(Math.abs(values[2]-1405.4782551085123)<1e-6);
 const saved=await send('save');assert.equal(saved.campaign.config.yieldEstimation.method,'fao-stages');
 // Recorded water is corrected via event, not by replacing a saved event log.
 const event=events.find(e=>e.date==='2018-02-20');assert.ok(event);
 const edited=await send('event',{event:{...event,amount:.1}});
 assert.ok(edited.campaign.plan.yieldEstimation.scenarios.find(s=>s.id==='recorded').totals.yieldKgHaSown<values[2]);
 const old=await (await localFetch('https://agri.test/api/seasonal?id=togo-stages&revision=1')).json();
 assert.ok(Math.abs(old.plan.yieldEstimation.scenarios.find(s=>s.id==='recorded').totals.yieldKgHaSown-values[2])<1e-6);
 setIdentity({userId:'other',email:'other@example.test',displayName:'Other'});assert.equal((await localFetch('https://agri.test/api/seasonal?id=togo-stages')).status,404);
}finally{closeHarness();}});
