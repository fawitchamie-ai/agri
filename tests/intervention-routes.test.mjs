import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {testParcel} from './support/land-fixtures.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';import {emptyManagement} from '../lib/seasonal/management.ts';
const base='https://agri.test/api/seasonal';
async function post(b,status=200){const r=await localFetch(base,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(b)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,300));return d;}
test('realized product corrections require explicit new revision; response, reload and export retain provenance',async()=>{try{
 setIdentity(null);await post({action:'calibration-status',country:'TGO',cropId:'maize'},401);
 setIdentity({userId:'record-owner',email:'record-owner@test.invalid',displayName:'Test owner'});
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.landSelection='potentialLand';c.managementPlan=emptyManagement(c);
 c.managementPlan.products=[{id:'recorded',date:c.asOfDate,kind:'fertilizer',product:'Synthetic test product',dose:100,unit:'kg/ha',status:'declared',source:'Software fixture, no recommendation',npkPercent:[15,15,15]}];
 const saved=await post({action:'save',id:'protected-products',expectedRevision:0,config:c},201);assert.equal(saved.campaign.plan.response.fertilizer.realized,1);
 c.managementPlan.products[0].dose=200;await post({action:'save',id:'protected-products',expectedRevision:1,config:c},400);
 c.managementPlan.recordedCorrection={id:'explicit-correction',reason:'Dose corrected after checking the original field receipt'};
 const corrected=await post({action:'save',id:'protected-products',expectedRevision:1,config:c});assert.equal(corrected.campaign.revision,2);assert.match(corrected.reason,/original field receipt/);
 const previous=await (await localFetch(base+'?id=protected-products&revision=1')).json();assert.equal(previous.config.managementPlan.products[0].dose,100);
 const reloaded=await (await localFetch(base+'?id=protected-products')).json();assert.equal(reloaded.campaign.config.managementPlan.products[0].dose,200);
 c.managementPlan.products[0].dose=300;await post({action:'save',id:'protected-products',expectedRevision:2,config:c},400);c.managementPlan.products[0].dose=200;
 const compare=await post({action:'compare-interventions',config:c,events:[]});assert.equal(compare.scenarios[1].products[0].dose,200);assert.equal(compare.scenarios[1].totalNitrogenKgHa,30);assert.equal(compare.scenarios[1].quantifiedYieldEffect,null);
 const sim=await post({action:'simulate',config:c,events:[],requestId:'latest-42'});assert.equal(sim.requestId,'latest-42');assert.equal(sim.plan.response.calibration.forecastValidated,false);
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN']){const d=await post({action:'calibration-status',country,cropId:'maize'});assert.equal(d.metrics,null);assert.equal(d.status,'not_calibrated');}
 const csv=await localFetch(base+'?id=protected-products&format=management-csv');assert.equal(csv.status,200);assert.match(await csv.text(),/P_element_kg_ha/);
 setIdentity({userId:'outsider',email:'outsider@test.invalid',displayName:'Test outsider'});assert.equal((await localFetch(base+'?id=protected-products')).status,404);
}finally{closeHarness();}});
