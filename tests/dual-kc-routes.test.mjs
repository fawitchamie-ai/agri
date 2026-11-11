import test from 'node:test';
import assert from 'node:assert/strict';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {growthTemplate,growthScope} from '../lib/seasonal/growth.ts';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
test('authenticated simulation route executes dual-Kc and normalized-transpiration biomass',async()=>{try{
 const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=testParcel;c.landAssessment=landFixture(testParcel);c.landSelection='potentialLand';c.waterCondition='drained';c.system.sourceBudgetM3=0;
 c.waterModel={version:'fao56-dual-1',source:'Synthetic route test, not a measured profile',availableOn:c.asOfDate,totalEvaporableMm:20,readilyEvaporableMm:8,initialDepletionMm:20,wettedFraction:.3,kcMax:1.25,stages:c.stages.map(()=>({kcbStart:.6,kcbEnd:.6,coverStart:.6,coverEnd:.6}))};
 c.growth=growthTemplate(c);c.growth.parameters.biomassModel={kind:'transpiration-normalized',waterProductivityGm2:25,source:'Synthetic route WP',availableOn:c.asOfDate};c.growth.weatherScenario={temperatureMeanC:28,radiationMj:18,source:'Synthetic weather'};c.growth.scope=growthScope(c);
 setIdentity({userId:'dual-owner',email:'dual@example.test',displayName:'Dual probe'});
 const r=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify({action:'simulate',config:c,events:[]})}),body=await r.json();assert.equal(r.status,200,JSON.stringify(body).slice(0,700));
 const p=body.plan??body;assert.equal(p.growth.engineVersion,'daily-rue-npk-1.4.0');assert.equal(p.engineVersion,'water-balance-1.6.0');assert.equal(p.growth.status,'scenario');assert.ok(p.days.some(d=>d.dualKc.transpirationMm>0));assert.equal(p.growth.validated,false);
}finally{closeHarness();}});
