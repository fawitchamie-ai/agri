import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonalRequest} from '../lib/seasonal/request.ts';
test('simulation: timeout covers a stalled body, aborts and allows a fresh retry',async()=>{
 let signal;
 await assert.rejects(seasonalRequest({action:'simulate'},undefined,20,async(_url,options)=>{signal=options.signal;return {ok:true,text:()=>new Promise(()=>{})};}),/trop de temps/);
 assert.equal(signal.aborted,true);
 const result=await seasonalRequest({requestId:'retry'},undefined,100,async()=>Response.json({requestId:'retry',plan:{complete:true}}));
 assert.equal(result.requestId,'retry');assert.equal(result.plan.complete,true);
});
test('simulation: network and session failures explain recovery without a raw Failed to fetch',async()=>{
 await assert.rejects(seasonalRequest({},undefined,100,async()=>{throw new TypeError('Failed to fetch');}),/Connexion.*saisies sont conservées/);
 await assert.rejects(seasonalRequest({},undefined,100,async()=>new Response('<html>login</html>',{status:401})),/session.*saisies sont conservées/);
 await assert.rejects(seasonalRequest({},undefined,100,async()=>Response.json({error:'Terrain indisponible'},{status:503})),/Terrain indisponible/);
});
test('Cloudflare 1102 HTML is diagnosed once and never automatically retried',async()=>{
 let calls=0;
 await assert.rejects(seasonalRequest({action:'simulate'},undefined,100,async()=>{calls++;return new Response('<title>Worker exceeded resource limits</title><span class="cf-error-code">1102</span>',{status:503});}),e=>e.code==='CLOUDFLARE_RESOURCE_LIMIT'&&e.action==='simulate'&&e.status===503&&/1102/.test(e.message));
 assert.equal(calls,1);
 await assert.rejects(seasonalRequest({action:'simulate'},undefined,100,async()=>Response.json({error:'Humidité initiale invalide'},{status:400})),e=>e.status===400&&/Humidité/.test(e.message));
});
test('simulation: cancellation is immediate even when transport ignores AbortSignal',async()=>{
 const controller=new AbortController();
 const pending=seasonalRequest({},controller.signal,10000,()=>new Promise(()=>{}));
 controller.abort();await assert.rejects(pending,{name:'AbortError'});
});

test('large contours share one resumable runner, progress is not returned as a simulation',async()=>{
 const base={id:'shared-test-job',status:'pending',completed:0,total:3,processedM2:0,totalM2:300,errors:[],assessment:null};let steps=0,simulations=0;const progress=[];
 const fetcher=async(_url,options)=>{const b=JSON.parse(options.body);if(b.action==='land-job-step'){await new Promise(r=>setTimeout(r,12));steps++;return Response.json({...base,completed:steps,processedM2:steps*100,status:steps===3?'complete':'pending',assessment:steps===3?{synthetic:true}:null});}simulations++;return steps<3?Response.json({code:'LAND_ANALYSIS_PENDING',job:base},{status:202}):Response.json({plan:{complete:true,synthetic:true}});};
 const [a,b]=await Promise.all([seasonalRequest({action:'simulate'},undefined,100,fetcher,{onLandProgress:p=>progress.push(p.completed)}),seasonalRequest({action:'environment'},undefined,100,fetcher)]);
 assert.equal(steps,3);assert.equal(simulations,4);assert.equal(a.plan.complete,true);assert.equal(b.plan.synthetic,true);assert.deepEqual(progress,[0,1,2,3]);
});
test('cancelling one consumer keeps a shared terrain job running for the other',async()=>{
 const base={id:'cancel-shared-job',status:'pending',completed:0,total:1,processedM2:0,totalM2:10,errors:[],assessment:null};let ready=false,steps=0;
 const fetcher=async(_url,options)=>{const b=JSON.parse(options.body);if(b.action==='land-job-step'){steps++;await new Promise(r=>setTimeout(r,25));ready=true;return Response.json({...base,status:'complete',completed:1,assessment:{synthetic:true}});}return ready?Response.json({done:true}):Response.json({code:'LAND_ANALYSIS_PENDING',job:base},{status:202});};
 const ctrl=new AbortController();const a=seasonalRequest({action:'simulate'},ctrl.signal,200,fetcher),b=seasonalRequest({action:'land'},undefined,200,fetcher);setTimeout(()=>ctrl.abort(),10);
 await assert.rejects(a,{name:'AbortError'});assert.equal((await b).done,true);assert.equal(steps,1);
});
test('sector acquisition errors stop the runner and retain the resumable job',async()=>{
 const job={id:'failed-test-job',status:'pending',completed:0,total:4,processedM2:0,totalM2:400,errors:[],assessment:null};let count=0;
 const fetcher=async(_url,options)=>{const b=JSON.parse(options.body);if(b.action==='land-job-step'){count++;return Response.json({...job,errors:[{sector:0,error:'Acquisition interrompue'}]});}return Response.json({code:'LAND_ANALYSIS_PENDING',job},{status:202});};
 await assert.rejects(seasonalRequest({action:'simulate'},undefined,100,fetcher),/Acquisition interrompue.*Reprendre/);assert.equal(count,1);
});

test('large native land partitions stay on the server and never inflate calculation payloads',async()=>{
 const source={action:'simulate',config:{crop:'Maïs',landAssessment:{largeNativeGeometry:'synthetic partition'.repeat(10000)}}};let wire;
 await seasonalRequest(source,undefined,100,async(_url,options)=>{wire=JSON.parse(options.body);return Response.json({done:true});});
 assert.equal(wire.config.crop,'Maïs');assert.equal(wire.config.landAssessment,undefined);assert.ok(source.config.landAssessment.largeNativeGeometry.length>100000);
});
