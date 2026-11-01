import test from 'node:test';import assert from 'node:assert/strict';
import {closeHarness} from './support/local-route-harness.mjs';
const {failure,ServiceStageError,HttpError}=await import('../lib/server-db.ts');
test('503 errors expose a request reference and a controlled acquisition stage without raw internal details',async()=>{try{
 const r=failure(new ServiceStageError('terrain',new Error('Private payload must not appear in the response'))),data=await r.json();assert.equal(r.status,503);assert.equal(data.stage,'terrain');assert.match(data.requestId,/^[a-f0-9-]{36}$/);assert.equal(r.headers.get('X-Request-Id'),data.requestId);assert.doesNotMatch(JSON.stringify(data),/Private payload/);assert.equal(failure(new HttpError(409,'Secteurs requis')).status,409);
}finally{closeHarness();}});
