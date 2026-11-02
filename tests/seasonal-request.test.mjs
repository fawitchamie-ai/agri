import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonalRequest} from '../lib/seasonal/request.ts';
test('simulation: timeout covers a stalled body, aborts and allows a fresh retry',async()=>{
 let signal;
 await assert.rejects(seasonalRequest({action:'simulate'},undefined,20,async(_url,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(()=>{})};}),/trop de temps/);
 assert.equal(signal.aborted,true);
 const result=await seasonalRequest({requestId:'retry'},undefined,100,async()=>Response.json({requestId:'retry',plan:{complete:true}}));
 assert.equal(result.requestId,'retry');assert.equal(result.plan.complete,true);
});
test('simulation: network and session failures explain recovery without a raw Failed to fetch',async()=>{
 await assert.rejects(seasonalRequest({},undefined,100,async()=>{throw new TypeError('Failed to fetch');}),/Connexion.*saisies sont conservées/);
 await assert.rejects(seasonalRequest({},undefined,100,async()=>new Response('<html>login</html>',{status:401})),/session.*saisies sont conservées/);
 await assert.rejects(seasonalRequest({},undefined,100,async()=>Response.json({error:'Terrain indisponible'},{status:503})),/Terrain indisponible/);
});
test('simulation: cancellation is immediate even when transport ignores AbortSignal',async()=>{
 const controller=new AbortController();
 const pending=seasonalRequest({},controller.signal,10000,()=>new Promise(()=>{}));
 controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
