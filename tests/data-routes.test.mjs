import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {testParcel} from './support/land-fixtures.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {addDays} from '../lib/seasonal/validation.ts';
import {valueEvidence,migrateInputs,scopeId,geometryIdentity} from '../lib/seasonal/provenance.ts';
const base='https://agri.test';
async function req(body,status=200,path='/api/seasonal'){const r=await localFetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,500));return d;}
test('new data routes authoritatively scope salinity, retain campaign revisions and reject forged production',async()=>{try{
 setIdentity({userId:'data-owner',email:'data@example.test',displayName:'Data Owner'});
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.landSelection='potentialLand';c.waterCondition='drained';
 c.yieldEstimation={version:'yield-input-1',method:'fao-seasonal',scopeGeometryId:geometryIdentity(testParcel),homogeneityAssumption:'Synthetic',units:[{id:'field',sownAreaM2:1000,harvestedAreaM2:100,areaSource:'Synthetic',reference:{kind:'scenario',kgHa:4000,denominator:'sown',source:'Synthetic independent Ym',availableOn:c.asOfDate,context:'Synthetic only',cropId:'maize',independentYm:true}}]};
 const parameters={ecDsM:2.7,depthM:2,source:'Synthetic representative ECe',product:'grain',noOtherLimitation:true,rootzoneSeasonAverage:true,method:'saturated_paste_25C',availableOn:c.asOfDate,period:{from:c.sowingDate,to:'2099-01-01'},productionKg:999999};
 const d=await req({action:'salinity-scenario',config:{...c,areaM2:1e8},parameters});assert.equal(d.result.productionKg,352);assert.ok(d.config.areaM2<1e8);assert.equal(d.config.salinity.productionKg,undefined);
 const saved=await req({action:'save',id:'data-campaign',expectedRevision:0,config:d.config,plan:{salinity:{productionKg:999999}}},201);assert.equal(saved.campaign.plan.salinity.productionKg,352);
 parameters.ecDsM=1;const next=await req({action:'salinity-scenario',config:d.config,parameters});await req({action:'save',id:'data-campaign',expectedRevision:1,config:next.config});
 const old=await req(undefined,200,'/api/seasonal?id=data-campaign&revision=1');assert.equal(old.config.salinity.ecDsM,2.7);assert.equal(old.plan.salinity.productionKg,352);
 const ready=await req({action:'data-readiness',config:d.config});assert.equal(ready.parameterizedHydricCrops.length,9);assert.equal(ready.salinity.productionKg,352);
 const forged=structuredClone(c);forged.yieldEstimation.units[0].sownAreaM2=1e8;await req({action:'salinity-scenario',config:forged,parameters},400);
 const changed=structuredClone(c);changed.yieldEstimation.scopeGeometryId='other';await req({action:'salinity-scenario',config:changed,parameters},400);
 const rice=structuredClone(c);rice.systemDomain='flooded_rice';await req({action:'salinity-scenario',config:rice,parameters},400);
 await req({action:'nasa-history',config:c,start:'2099-01-01',end:'2099-01-02'},400);
 // A complete year with full per-value evidence exceeds the old 2 MB request and D1 row limits.
 const large=structuredClone(c);large.sowingDate='2025-01-01';large.stages=large.stages.map((s,i)=>({...s,days:i===0?275:30}));large.weather=Array.from({length:365},(_,i)=>{
  const date=addDays('2025-01-01',i),values={rainMm:0,et0Mm:4,temperatureMeanC:25,temperatureMinC:20,temperatureMaxC:30,humidityPercent:60,wind2mMs:2,radiationMj:20};
  return {date,...values,status:'estimated',source:'Synthetic full metadata',availableAt:new Date().toISOString(),provenance:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,valueEvidence(v,'synthetic unit',scopeId(large.parcelGeometry),{origin:'automatic',status:'estimated',provider:'Synthetic test',method:'Synthetic acquisition metadata '.repeat(6),acquiredAt:new Date().toISOString(),interval:{from:date,to:date}})]))};
 });
 const payload={action:'save',id:'large-data-campaign',expectedRevision:0,config:migrateInputs(large)};assert.ok(JSON.stringify(payload).length>2000000);
 const largeSaved=await req(payload,201);assert.equal(largeSaved.campaign.config.weather.length,365);
 const restored=await req(undefined,200,'/api/seasonal?id=large-data-campaign');assert.equal(restored.campaign.config.weather.length,365);assert.deepEqual(restored.campaign.config.inputs,largeSaved.campaign.config.inputs);
 const revision=await req(undefined,200,'/api/seasonal?id=large-data-campaign&revision=1');assert.equal(revision.config.weather.length,365);assert.ok(revision.plan.inputProvenance);
 const lists=await req();assert.ok(lists.campaigns.some(x=>x.id==='large-data-campaign'));
 setIdentity({userId:'data-outsider',email:'other@example.test',displayName:'Other'});await req(undefined,404,'/api/seasonal?id=data-campaign&revision=1');
}finally{closeHarness();}});
