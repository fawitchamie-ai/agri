import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness,restartDatabase} from './support/local-route-harness.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';import {growthTemplate} from '../lib/seasonal/growth.ts';import {parcelMetrics} from '../lib/seasonal/parcel.ts';import {testParcel,landFixture} from './support/land-fixtures.mjs';
const url='https://agri.test/api/seasonal';
async function post(body,status=200){const r=await localFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,500));return d;}
test('authenticated server recalculates, persists and reloads integrated growth with the same parameter set',async()=>{try{
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.areaM2=parcelMetrics(testParcel).areaM2;c.landAssessment=landFixture(testParcel);c.landSelection='potentialLand';c.waterCondition='drained';c.system.sourceBudgetM3=1e6;c.fallback={label:'Synthetic forcing',rainMmDay:4,et0MmDay:4};c.growth=growthTemplate(c);c.growth.weatherScenario={temperatureMeanC:28,radiationMj:18,source:'Synthetic weather for test'};
 setIdentity(null);await post({action:'simulate',config:c,events:[]},401);
 setIdentity({userId:'growth-owner',email:'growth@example.test',displayName:'Growth Test'});
 const simulated=await post({action:'simulate',config:c,events:[]});const plan=simulated.plan??simulated;assert.equal(plan.growth.status,'scenario');assert.equal(plan.growth.scenarios.length,4);assert.ok(plan.growth.scenarios[2].yieldKgHa>0);
 const saved=await post({action:'save',id:crypto.randomUUID(),config:c,events:[],expectedRevision:0},201);assert.equal(saved.campaign.config.growth.version,c.growth.version);assert.deepEqual(saved.campaign.plan.growth.scenarios,plan.growth.scenarios);
 restartDatabase();const r=await localFetch(url+'?id='+saved.campaign.id),loaded=await r.json();assert.equal(r.status,200);assert.deepEqual(loaded.campaign.plan.growth,plan.growth);
 await post({action:'simulate',config:{...c,growth:{...c.growth,parameters:{...c.growth.parameters,rueGPerMj:-1}}},events:[]},400);
 setIdentity({userId:'growth-other',email:'other@example.test',displayName:'Other'});assert.equal((await localFetch(url+'?id='+saved.campaign.id)).status,404);
}finally{closeHarness();}});
