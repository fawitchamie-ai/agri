import {landFixture,testParcel} from './support/land-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
const {exampleCampaign}=await import('../lib/seasonal/example.ts');
const {planWater}=await import('../lib/seasonal/engine.ts');
const {applyCropProfile}=await import('../lib/seasonal/catalog.ts');
const {seasonalCapabilities}=await import('../lib/seasonal/capabilities.ts');
const base='http://agri.test';
// New seed planning metadata is tested separately; the entire legacy water balance stays identical.
function sameWater(actual,expected){const {sowingPlan,...water}=actual;assert.ok(sowingPlan.version);assert.deepEqual(water,expected);}
async function req(path,body,status=200){const res=await localFetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)}:{});const json=await res.json();assert.equal(res.status,status,JSON.stringify(json).slice(0,250));return json;}
test('Campagnes : routes, persistance, révisions, idempotence, accès et corrections tardives',async()=>{
  try{
    await req('/api/seasonal',undefined,401);
    const owner={userId:'water-owner',displayName:'Owner',email:'owner@example.test'};
    setIdentity(owner);
    for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN']){
      assert.deepEqual(await req('/api/seasonal',{action:'capabilities',country,cropId:'maize'}),seasonalCapabilities(country,'maize'));
    }
    await req('/api/seasonal',{action:'capabilities',country:'XXX'},400);
    await req('/api/seasonal',{action:'capabilities',country:'TGO',cropId:'unknown'},400);
    const config=exampleCampaign(new Date().toISOString().slice(0,10));config.parcelGeometry=testParcel;config.landAssessment=landFixture(testParcel);
    const save=await req('/api/seasonal',{action:'save',id:'campaign-1',expectedRevision:0,config},201);
    sameWater(save.campaign.plan,planWater(config));assert.equal(save.campaign.revision,1);
    const e={id:'rain-stable',date:config.sowingDate,kind:'rain',amount:20,unit:'mm',point:'field',status:'measured',source:'Synthetic fixture'};
    const updated=await req('/api/seasonal',{action:'event',id:'campaign-1',expectedRevision:1,event:e});assert.equal(updated.campaign.revision,2);assert.equal(updated.campaign.events.length,1);
    const repeat=await req('/api/seasonal',{action:'event',id:'campaign-1',expectedRevision:1,event:e});assert.equal(repeat.unchanged,true);assert.equal(repeat.campaign.revision,2);
    await req('/api/seasonal',{action:'event',id:'campaign-1',expectedRevision:1,event:{...e,amount:30}},409);
    const correction=await req('/api/seasonal',{action:'event',id:'campaign-1',expectedRevision:2,event:{...e,amount:30}});assert.equal(correction.campaign.events.length,1);assert.equal(correction.campaign.revision,3);
    const got=await req('/api/seasonal?id=campaign-1');assert.equal(got.history.length,3);assert.equal(got.history[0].revision,3);sameWater(got.campaign.plan,planWater(got.campaign.config,got.campaign.events));
    const archived=await req('/api/seasonal?id=campaign-1&revision=1');assert.equal(archived.events.length,0);sameWater(archived.plan,planWater(config));
    const csv=await localFetch(base+'/api/seasonal?id=campaign-1&format=csv');assert.equal(csv.status,200);assert.match(await csv.text(),/m3_source/);
    setIdentity({userId:'water-outsider',displayName:'Other',email:'other@example.test'});
    const other=await req('/api/seasonal');assert.equal(other.campaigns.length,0);await req('/api/seasonal?id=campaign-1',undefined,404);
    await req('/api/seasonal',{action:'event',id:'campaign-1',expectedRevision:3,event:e},404);
    setIdentity(owner);
    const raw=(amount)=>localFetch(base+'/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'event',id:'campaign-1',expectedRevision:3,event:{...e,amount}})});
    const race=await Promise.all([raw(31),raw(32)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
    const after=await req('/api/seasonal?id=campaign-1');assert.equal(after.history.length,4);assert.equal(after.campaign.revision,4);
    const keep=await req('/api/seasonal',{action:'save',id:'campaign-1',expectedRevision:4,config:after.campaign.config,events:[]});assert.equal(keep.campaign.events.length,1);
    const imported=await req('/api/seasonal',{action:'save',id:'imported',expectedRevision:0,config:keep.campaign.config,events:keep.campaign.events},201);assert.deepEqual(imported.campaign.events,keep.campaign.events);
    await req('/api/seasonal',{action:'simulate',config:{...config,areaM2:-3}},400);
    const chemical=applyCropProfile(config,'maize');chemical.territory='Kozah';
    chemical.soilAnalyses=[{source:'Laboratoire fictif de test',date:chemical.asOfDate,availableOn:chemical.asOfDate,topCm:0,bottomCm:20,status:'measured',measurements:[{parameter:'availableP',value:8,unit:'mg/kg',method:'Olsen-Dabin'}]}];
    chemical.nutritionReference={id:'tgo-kozah-maize',contextNote:'Exemple de référence Kozah à vérifier localement ; non prescriptif.',alreadyKgHa:[50,null]};
    const expected=planWater(chemical);
    sameWater((await req('/api/seasonal',{action:'simulate',config:chemical})).plan,expected);
    const savedChemical=await req('/api/seasonal',{action:'save',id:'chemical-test',expectedRevision:0,config:chemical},201);
    const loadedChemical=await req('/api/seasonal?id=chemical-test');
    assert.deepEqual(loadedChemical.campaign.config.soilAnalyses,chemical.soilAnalyses);
    assert.deepEqual(loadedChemical.campaign.plan.nutrition,expected.nutrition);
    const historical=await req('/api/seasonal?id=chemical-test&revision=1');
    assert.deepEqual(historical.plan.nutrition,savedChemical.campaign.plan.nutrition);
    await req('/api/seasonal',{action:'simulate',config:{...chemical,country:'BEN'}},400);
    const invalidChemical=structuredClone(chemical);invalidChemical.soilAnalyses[0].measurements[0].unit='kg/ha';
    await req('/api/seasonal',{action:'simulate',config:invalidChemical},400);
  }finally{closeHarness();}
});
