import test from 'node:test';import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';import {automaticCampaign} from '../lib/seasonal/automatic.ts';import {geometryIdentity} from '../lib/seasonal/provenance.ts';
async function req(body,status=200,path='/api/seasonal'){const r=await localFetch('https://agri.test'+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)}:{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,400));return d;}
test('server recalculates seed quantities, retains manual doses and rejects changed observation scope',async()=>{try{
 setIdentity({userId:'sowing-owner',email:'sowing@example.test',displayName:'Test'});
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.landSelection='potentialLand';c.sowingPlan={version:'sowing-input-1',geometryId:geometryIdentity(testParcel),cropId:'maize',areaM2:1000,seedRateKgHa:25,source:'Synthetic seed lot'};
 c.areaM2=1e8;c.landAssessment=landFixture(testParcel);c.landAssessment.candidateAreaM2=1e8;
 const result=await req({action:'simulate',config:c,plan:{sowingPlan:{seedKg:999999}}});assert.equal(result.plan.sowingPlan.seedKg,2.5);assert.equal(result.plan.calculationArea.areaM2,1000);
 const huge=structuredClone(c);huge.sowingPlan.areaM2=1e8;await req({action:'simulate',config:huge},400);
 await req({action:'save',id:'sowing-campaign',expectedRevision:0,config:c},201);c.sowingPlan.seedRateKgHa=20;await req({action:'save',id:'sowing-campaign',expectedRevision:1,config:c});
 const current=await req(undefined,200,'/api/seasonal?id=sowing-campaign');assert.equal(current.campaign.config.sowingPlan.seedRateKgHa,20);assert.equal(current.campaign.plan.sowingPlan.seedKg,2);
 const old=await req(undefined,200,'/api/seasonal?id=sowing-campaign&revision=1');assert.equal(old.plan.sowingPlan.seedKg,2.5);
 await req({action:'event',id:'sowing-campaign',expectedRevision:2,event:{id:'actual',date:c.asOfDate,kind:'irrigation',amount:2,unit:'mm',point:'net',status:'declared',source:'Synthetic'}},200);
 c.sowingPlan.areaM2=500;await req({action:'save',id:'sowing-campaign',expectedRevision:3,config:c},400);
 const unsupported=automaticCampaign({...c,sowingPlan:undefined},'sorghum');assert.equal(unsupported.stages.length,0);
 const seeds=await req({action:'sowing-plan',config:unsupported});assert.equal(seeds.sowingPlan.seedRateKgHa,10);assert.ok(seeds.sowingPlan.seedKg>0);await req({action:'simulate',config:unsupported},400);
 setIdentity({userId:'other',email:'other@example.test',displayName:'Other'});await req(undefined,404,'/api/seasonal?id=sowing-campaign');
}finally{closeHarness();}});
