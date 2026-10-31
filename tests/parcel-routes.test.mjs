import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const {exampleCampaign}=await import('../lib/seasonal/example.ts');
const {polygonFromPoints,parcelMetrics}=await import('../lib/seasonal/parcel.ts');
const {planWater}=await import('../lib/seasonal/engine.ts');
async function request(body,status=200){const res=await localFetch('http://agri.test/api/seasonal',{method:'POST',headers:{Origin:'http://agri.test','Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data).slice(0,250));return data;}
test('Parcelle : API, historique, export et protection des observations existantes',async()=>{
 try{
  setIdentity({userId:'parcel-owner',displayName:'Parcel test',email:'parcel@example.test'});
  const c=exampleCampaign();c.parcelGeometry=polygonFromPoints([[1.2,6.2],[1.201,6.2],[1.201,6.201],[1.2,6.201]]);c.areaM2=1;
  const saved=await request({action:'save',id:'parcel-map-test',expectedRevision:0,config:c},201);
  assert.equal(saved.campaign.config.areaM2,parcelMetrics(c.parcelGeometry).areaM2);assert.deepEqual(saved.campaign.plan,planWater(saved.campaign.config));
  const get=await localFetch('http://agri.test/api/seasonal?id=parcel-map-test&revision=1');assert.equal(get.status,200);const archive=await get.json();assert.deepEqual(archive.config.parcelGeometry,c.parcelGeometry);
  const e={id:'parcel-rain',date:c.sowingDate,kind:'rain',amount:10,unit:'mm',point:'field',status:'measured',source:'Synthetic fixture'};
  const observed=await request({action:'event',id:'parcel-map-test',expectedRevision:1,event:e});
  const changed=structuredClone(observed.campaign.config);changed.parcelGeometry.coordinates[0][1][0]+=.0001;
  await request({action:'save',id:'parcel-map-test',expectedRevision:2,config:changed},400);
  const kept=await request({action:'save',id:'parcel-map-test',expectedRevision:2,config:observed.campaign.config});assert.deepEqual(kept.campaign.config.parcelGeometry,c.parcelGeometry);
  const invalid=structuredClone(c);invalid.parcelGeometry={type:'Polygon',coordinates:[[[0,0],[1,1],[1,0],[0,1],[0,0]]]};await request({action:'simulate',config:invalid},400);
 }finally{closeHarness();}
});
