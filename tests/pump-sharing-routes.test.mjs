import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const {exampleCampaign}=await import('../lib/seasonal/example.ts');
const {planWater}=await import('../lib/seasonal/engine.ts');
const {testParcel,landFixture}=await import('./support/land-fixtures.mjs');
const base='http://agri.test';
async function request(path,body,status=200,method=body?'POST':'GET'){
 const response=await localFetch(base+path,body?{method,headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});
 const result=await response.json();assert.equal(response.status,status,JSON.stringify(result).slice(0,350));return result;
}
test('Pompes partagées : créneaux issus du bilan, collisions, historique et modifications protégés',async()=>{
 try{
  setIdentity({userId:'pump-owner',displayName:'Responsable',email:'pump-owner@example.test'});
  const config=exampleCampaign(new Date().toISOString().slice(0,10));config.parcelGeometry=testParcel;config.landAssessment=landFixture(testParcel);
  const calculated=planWater(config),next=calculated.days.find(day=>day.intervention?.type==='proposed'&&day.intervention.sourceM3!==null&&day.intervention.sourceM3>0);
  assert.ok(next,'Le scénario de référence doit contenir au moins un arrosage proposé.');
  const campaign=(await request('/api/seasonal',{action:'save',id:'pump-campaign',expectedRevision:0,config},201)).campaign;
  const weekday=new Date(next.date+'T00:00:00Z').getUTCDay();
  const pump=(await request('/api/workspace',{kind:'capacity',data:{point:'Pompe de test',storage:0,transport:0,pumpFlowM3h:config.system.sourceFlowM3h,pumpDays:[weekday],pumpStartHHmm:'00:00',pumpEndHHmm:'23:59'}},201)).record;
  const bookingData={pumpId:pump.id,campaignId:campaign.id,date:next.date,startHHmm:'00:00',status:'reserved'};
  const first=(await request('/api/workspace',{kind:'pumpBooking',data:bookingData},201)).record;
  const second=(await request('/api/workspace',{kind:'pumpBooking',data:{...bookingData,startHHmm:'06:30'}},201)).record;
  await request('/api/workspace',{kind:'pumpBooking',id:first.id,updatedAt:first.updatedAt,data:{...bookingData,startHHmm:'00:31'}},409);
  let workspace=await request('/api/workspace');
  assert.equal(workspace.records.find(record=>record.id===first.id).history.length,0,'Une collision refusée ne doit pas ajouter une entrée d’historique.');
  const capacityUpdate={kind:'capacity',id:pump.id,updatedAt:pump.updatedAt,data:{...pump.data,storage:1}};
  const updatedPump=(await request('/api/workspace',capacityUpdate)).record;
  await request('/api/workspace',{kind:'capacity',id:pump.id,updatedAt:updatedPump.updatedAt,data:{...updatedPump.data,pumpFlowM3h:updatedPump.data.pumpFlowM3h+1}},409);
  await request('/api/workspace',{id:pump.id,confirm:true},409,'DELETE');
  for(const booking of [first,second])await request('/api/workspace',{kind:'pumpBooking',id:booking.id,updatedAt:booking.updatedAt,data:{...bookingData,pumpId:pump.id,campaignId:campaign.id,date:booking.data.date,startHHmm:booking.data.startHHmm,status:'cancelled'}});
  workspace=await request('/api/workspace');
  assert.equal(workspace.records.find(record=>record.id===first.id).data.status,'cancelled');
  const refreshedPump=workspace.records.find(record=>record.id===pump.id);
  await request('/api/workspace',{kind:'capacity',id:pump.id,updatedAt:refreshedPump.updatedAt,data:{...refreshedPump.data,pumpFlowM3h:refreshedPump.data.pumpFlowM3h+1}});
  await request('/api/workspace',{id:pump.id,confirm:true},200,'DELETE');
 }finally{closeHarness();}
});
