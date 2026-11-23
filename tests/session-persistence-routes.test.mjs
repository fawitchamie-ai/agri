import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,restartDatabase,closeHarness} from './support/local-route-harness.mjs';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';

const base='https://agri.test';
async function request(path,{method='GET',body,cookie}={}){
 const response=await localFetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json',Origin:base}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json()}catch{data=null;}
 return {response,data};
}
async function saveCampaign(id,cookie){
 const config=exampleCampaign(new Date().toISOString().slice(0,10));config.parcelGeometry=testParcel;config.landAssessment=landFixture(testParcel);
 const {response,data}=await request('/api/seasonal',{method:'POST',body:{action:'save',id,expectedRevision:0,config},cookie});
 assert.equal(response.status,201,JSON.stringify(data).slice(0,300));return data.campaign;
}

test('comptes réels : campagnes conservées par espace, multi-coopératives et démonstration isolée',async()=>{
 try{
  setIdentity(null);
  const openedDemo=await request('/api/demo',{method:'POST',body:{role:'responsable',coopId:'demo-a'}});
  assert.equal(openedDemo.response.status,200);
  const staleDemoCookie=openedDemo.response.headers.get('set-cookie')?.match(/agri_demo=([^;]+)/)?.[1];assert.ok(staleDemoCookie);

  const owner={userId:'session-owner',email:'owner@example.test',displayName:'Owner',fullName:null};
  const invited={userId:'session-invited',email:'agent@example.test',displayName:'Agent',fullName:null};
  setIdentity(owner);
  const first=await request('/api/workspace',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(first.response.status,200);assert.equal(first.data.session.demo,false);assert.equal(first.data.session.userId,owner.userId);
  assert.equal(first.data.session.cooperatives.length,1);
  const ownerCoop=first.data.session.coopId;
  const ownerCampaign=await saveCampaign('session-owner-campaign',`agri_demo=${staleDemoCookie}`);

  const inviteResult=await request('/api/access',{method:'POST',body:{action:'create',role:'agent',email:invited.email}});
  assert.equal(inviteResult.response.status,201);

  setIdentity(invited);
  const second=await request('/api/workspace',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(second.response.status,200);assert.equal(second.data.session.demo,false);assert.notEqual(second.data.session.coopId,ownerCoop);
  const invitedPersonalCoop=second.data.session.coopId;
  await saveCampaign('session-invited-campaign',`agri_demo=${staleDemoCookie}`);
  const isolated=await request('/api/seasonal?includeArchived=1',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.deepEqual(isolated.data.campaigns.map(c=>c.id),['session-invited-campaign']);

  const accepted=await request('/api/access',{method:'POST',body:{action:'accept',code:inviteResult.data.code},cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(accepted.response.status,200,JSON.stringify(accepted.data));
  const joined=await request('/api/workspace',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(joined.data.session.coopId,ownerCoop);assert.equal(joined.data.session.role,'agent');
  assert.equal(joined.data.session.cooperatives.length,2);
  assert.ok(joined.data.session.cooperatives.some(space=>space.coopId===ownerCoop&&space.role==='agent'));
  assert.ok(joined.data.session.cooperatives.some(space=>space.coopId===invitedPersonalCoop&&space.role==='responsable'));
  const sharedCampaigns=await request('/api/seasonal?includeArchived=1',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.deepEqual(sharedCampaigns.data.campaigns.map(c=>c.id),[ownerCampaign.id]);
  assert.equal((await request('/api/seasonal?id=session-invited-campaign',{cookie:`agri_demo=${staleDemoCookie}`})).response.status,404);

  const switched=await request('/api/session',{method:'POST',body:{action:'switch',coopId:invitedPersonalCoop},cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(switched.response.status,200);
  const personalAgain=await request('/api/seasonal?includeArchived=1',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.deepEqual(personalAgain.data.campaigns.map(c=>c.id),['session-invited-campaign']);
  setIdentity(owner);
  const managerAccess=await request('/api/access');assert.equal(managerAccess.response.status,200);
  assert.ok(managerAccess.data.accounts.some(account=>account.id===invited.userId&&account.role==='agent'),'La liste des accès garde le membre même s’il utilise un autre espace.');
  const ownerAgain=await request('/api/seasonal?includeArchived=1',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.deepEqual(ownerAgain.data.campaigns.map(c=>c.id),[ownerCampaign.id]);

  restartDatabase();setIdentity(invited);
  const afterRestart=await request('/api/workspace',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(afterRestart.data.session.cooperatives.length,2);
  await request('/api/session',{method:'POST',body:{action:'switch',coopId:ownerCoop},cookie:`agri_demo=${staleDemoCookie}`});
  const persisted=await request('/api/seasonal?includeArchived=1',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.deepEqual(persisted.data.campaigns.map(c=>c.id),['session-owner-campaign']);

  setIdentity(null);
  const stillDemo=await request('/api/workspace',{cookie:`agri_demo=${staleDemoCookie}`});
  assert.equal(stillDemo.response.status,200);assert.equal(stillDemo.data.session.demo,true);
  setIdentity(owner);
  const blockedDemo=await request('/api/demo',{method:'POST',body:{role:'responsable',coopId:'demo-a'}});
  assert.equal(blockedDemo.response.status,409);
 }finally{closeHarness();}
});
