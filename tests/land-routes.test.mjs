import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
async function request(body,status=200){const r=await localFetch('http://agri.test/api/seasonal',{method:'POST',headers:{Origin:'http://agri.test','Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
test('Serveur : contrôle avant simulation et sauvegarde, rapport client favorable ignoré',async()=>{
 try{
  setIdentity({userId:'land-owner',displayName:'Land test',email:'land@example.test'});
  const c=exampleCampaign();c.parcelGeometry=testParcel;c.landAssessment=landFixture(testParcel,40);
  globalThis.__agriLandClass=80;
  const result=await request({action:'simulate',config:c});assert.equal(result.plan.status,'blocked');assert.equal(result.plan.days.length,0);assert.equal(result.plan.land.status,'excluded');assert.equal(result.plan.totals.fieldM3,null);
  const saved=await request({action:'save',id:'water-contour',expectedRevision:0,config:c},201);assert.equal(saved.campaign.plan.status,'blocked');assert.equal(saved.campaign.config.landAssessment.status,'excluded');
  globalThis.__agriLandClass=0;
  const unknown=await request({action:'simulate',config:c});assert.equal(unknown.plan.status,'blocked');assert.equal(unknown.plan.land.unknownAreaM2,unknown.plan.land.areaM2);
  await request({action:'environment',country:'TGO',start:c.sowingDate,days:125,latitude:9.5,longitude:1.2},400);
  const unlocated=await request({action:'simulate',config:{...c,parcelGeometry:undefined}});assert.equal(unlocated.plan.status,'blocked');assert.match(unlocated.plan.missing[0],/Contour complet/);
  globalThis.__agriLandClass=40;
  const dry=await request({action:'simulate',config:c});assert.equal(dry.plan.status,'conditional');assert.ok(dry.plan.days.length>0);
  const forged={...c,landSelection:'potentialLand',landAssessment:{...landFixture(testParcel,40),candidateAreaM2:1e9}};
  const selected=await request({action:'simulate',config:forged});
  assert.equal(selected.plan.complete,true);assert.equal(selected.plan.calculationArea.areaM2,selected.plan.land.candidateAreaM2);assert.ok(selected.plan.calculationArea.areaM2<1e9);
  globalThis.__agriLandClass=80;
  const waterSelection=await request({action:'simulate',config:forged});assert.equal(waterSelection.plan.status,'blocked');assert.equal(waterSelection.plan.days.length,0);

 }finally{delete globalThis.__agriLandClass;closeHarness();}
});
