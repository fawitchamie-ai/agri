import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInfo} from '../lib/build-info.ts';
import {authorizeAccessRequest} from '../lib/cloudflare-access.ts';
test('public version is identity-free, uncached, and does not open other API paths',async()=>{
 const request=new Request('https://agri.test/api/version');
 const result=await authorizeAccessRequest(request,{});assert.ok(!(result instanceof Response));
 assert.equal(result.identity,null);assert.equal(buildInfo().localCalibration,false);
 for(const path of ['/api/health','/api/seasonal','/api/version/extra']){
  const denied=await authorizeAccessRequest(new Request('https://agri.test'+path),{});assert.ok(denied instanceof Response);assert.ok(denied.status>=400);
 }
});
