import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const url='https://agri.test/api/seasonal';
async function post(body,status=200){const r=await localFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,300));return d;}
test('engine and catalog APIs require identity and never substitute a yield for unavailable compute',async()=>{try{
 setIdentity(null);await post({action:'crop-engine'},401);await post({action:'nutrient-balance',applications:[]},401);
 setIdentity({userId:'engine-reader',email:'engine@example.test',displayName:'Engine Reader'});
 const d=await post({action:'crop-engine'});assert.equal(d.selected.operationalForecast,false);assert.deepEqual(d.selected.validatedCountries,[]);assert.equal(d.service.configured,false);
 const c=await post({action:'product-catalog'});assert.equal(c.prescription,false);assert.equal(c.entries.find(x=>x.id==='compost').examplePercent,null);
 const b=await post({action:'nutrient-balance',applications:[]});assert.equal(b.availableDuringCycleKgHa,null);
 await post({action:'soil-inventory',parameters:{}},400);
 await post({action:'engine-submit',bundle:{result:4000}},503);await post({action:'engine-status',jobId:'forged'},503);
 assert.equal(globalThis.__agriTestEnv.CROP_COMPUTE_TOKEN,undefined);
}finally{closeHarness();}});
