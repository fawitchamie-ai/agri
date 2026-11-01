import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {testParcel} from './support/land-fixtures.mjs';import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';import {emptyManagement} from '../lib/seasonal/management.ts';
const base='https://agri.test';
async function req(body,status=200,path='/api/seasonal'){const r=await localFetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,400));return d;}
test('server calculates and revisions input calendars, ignores forged summaries and preserves old campaigns',async()=>{try{
 setIdentity({userId:'inputs-owner',email:'inputs@example.test',displayName:'Inputs Owner'});
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.landSelection='potentialLand';c.managementPlan=emptyManagement(c);c.managementPlan.irrigation={mode:'manual',applications:[{date:c.asOfDate,fieldM3Ha:100}]};c.managementPlan.products=[{id:'npk',date:c.asOfDate,kind:'fertilizer',product:'Synthetic NPK',dose:100,unit:'kg/ha',status:'planned',source:'Test only',npkPercent:[15,15,15]}];
 const computed=await req({action:'simulate',config:{...c,areaM2:1e9},plan:{management:{areaM2:1e9,products:[{totalProduct:999999}]}}});assert.ok(computed.plan.management.areaM2<1e9);assert.equal(computed.plan.management.irrigation[0].simulatedFieldM3Ha,100);assert.ok(computed.plan.management.products[0].totalProduct<100);assert.equal(computed.plan.management.products[0].yieldEffect,'not_modelled');
 const bad=structuredClone(c);bad.managementPlan.geometryId='forged';await req({action:'simulate',config:bad},400);
 const saved=await req({action:'save',id:'inputs-campaign',expectedRevision:0,config:c},201);assert.deepEqual(saved.campaign.config.managementPlan,c.managementPlan);
 c.managementPlan.irrigation.applications[0].fieldM3Ha=50;c.managementPlan.products[0].dose=200;const changed=await req({action:'save',id:'inputs-campaign',expectedRevision:1,config:c});assert.equal(changed.campaign.plan.management.irrigation[0].simulatedFieldM3Ha,50);
 const old=await req(undefined,200,'/api/seasonal?id=inputs-campaign&revision=1');assert.equal(old.config.managementPlan.products[0].dose,100);assert.equal(old.plan.management.irrigation[0].fieldM3Ha,100);
 await req({action:'save',id:'inputs-campaign',expectedRevision:1,config:c},409);
 const csv=await localFetch(base+'/api/seasonal?id=inputs-campaign&format=management-csv');assert.equal(csv.status,200);const text=await csv.text();assert.match(text,/kg\/ha/);assert.match(text,/m3\/ha/);assert.match(text,/non_modelise/);
 const legacy={...c,managementPlan:undefined};await req({action:'save',id:'legacy-inputs',expectedRevision:0,config:legacy},201);assert.equal((await req(undefined,200,'/api/seasonal?id=legacy-inputs')).campaign.config.managementPlan,undefined);
 setIdentity({userId:'inputs-outsider',email:'outside@example.test',displayName:'Outside'});await req(undefined,404,'/api/seasonal?id=inputs-campaign&format=management-csv');
}finally{closeHarness();}});
