import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
test('raster relay preserves the existing session boundary before inspecting any external asset',async()=>{
 try{
  const url='http://agri.test/api/seasonal?satellite=raster&asset=https%3A%2F%2Fprivate.invalid%2Fsecret';
  assert.equal((await localFetch(url)).status,401);
  setIdentity({userId:'relay-test-owner',email:'relay@example.test',displayName:'Relay test'});
  const r=await localFetch(url);assert.equal(r.status,400);assert.match((await r.json()).error,/non autorisé/);
 }finally{closeHarness();}
});
