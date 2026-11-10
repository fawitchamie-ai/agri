import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {growthTemplate,growthScope} from '../lib/seasonal/growth.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
import {landFixture,testParcel} from './support/land-fixtures.mjs';
import {growthProfileId} from '../lib/seasonal/growth-calibration.ts';
function fixture(){
 const c=applyCropProfile(exampleCampaign('2026-05-01'),'maize');
 c.parcelGeometry=testParcel;c.landAssessment=landFixture(testParcel);c.landSelection='potentialLand';c.waterCondition='drained';
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';
 c.system.sourceBudgetM3=null;c.system.sourceFlowM3h=null;c.system.hoursPerDay=null;c.system.applicationEfficiency=1;
 c.fallback={label:'Synthetic drought for mechanism check',et0MmDay:5,rainMmDay:0};
 c.soil.layers.forEach(l=>l.initialTheta=l.thetaFC);
 c.waterModel={version:'fao56-dual-1',source:'Synthetic test, no calibrated country',availableOn:c.asOfDate,totalEvaporableMm:20,readilyEvaporableMm:8,initialDepletionMm:0,wettedFraction:.3,kcMax:1.25,stages:c.stages.map(()=>({kcbStart:.6,kcbEnd:.6,coverStart:.6,coverEnd:.6}))};
 c.growth=growthTemplate(c);c.growth.weatherScenario={temperatureMeanC:28,radiationMj:18,source:'Synthetic forcing'};
 c.growth.parameters.biomassModel={kind:'transpiration-normalized',waterProductivityGm2:25,source:'Synthetic WP, not maize calibration',availableOn:c.asOfDate};
 c.growth.soilSupply={initialKgHa:[1000,1000,1000],releaseKgHaDay:[0,0,0],source:'Nonlimiting diagnostic'};
 c.growth.scope=growthScope(c);return c;
}
test('dual coefficient conserves the one water store and partitions ET under drought',()=>{
 const c=fixture(),p=planWater(c);
 assert.ok(p.complete);
 for(const d of p.days){const k=d.dualKc!;assert.ok(k);assert.ok(Math.abs(d.balanceResidualMm)<1e-8);assert.ok(Math.abs(k.evaporationMm+k.transpirationMm-d.actualEtMm)<1e-8);assert.ok(k.transpirationMm<=k.transpirationDemandMm+1e-8);assert.ok(k.surfaceDepletionMm>=0&&k.surfaceDepletionMm<=20);}
 assert.ok(p.days.some(d=>d.dualKc!.ks<.5));
});
test('wet bare soil can evaporate but cannot manufacture biomass from evaporation',()=>{
 const c=fixture();c.waterModel!.stages.forEach(s=>{s.kcbStart=0;s.kcbEnd=0;s.coverStart=0;s.coverEnd=0;});
 const p=planSeason(c);assert.equal(p.growth!.status,'scenario');
 assert.ok(p.days[0].dualKc!.evaporationMm>0);
 assert.equal(p.growth!.scenarios.find(s=>s.id==='proposed')!.yieldKgHa,0);
});
test('normalized transpiration growth ignores an unused RUE; it is not multiplied twice',()=>{
 const c=fixture(),p=planSeason(c),s=p.growth!.scenarios.find(s=>s.id==='proposed')!;
 const expected=p.days.reduce((n,d)=>n+25*10*d.dualKc!.transpirationMm/5,0);
 assert.ok(Math.abs(s.biomassKgHa-expected)<1e-7);
 const change=structuredClone(c);change.growth!.parameters.rueGPerMj=8;
 assert.equal(planSeason(change).growth!.scenarios.find(s=>s.id==='proposed')!.yieldKgHa,s.yieldKgHa);
});
test('future canopy, invalid surface storage and unpartitioned WP inputs fail explicitly',()=>{
 const c=fixture();
 const future=structuredClone(c);future.waterModel!.observedCover=[{date:'2026-05-02',availableOn:'2026-05-02',cover:.8,source:'Unavailable future observation'}];assert.throws(()=>validateConfig(future),/indisponible/);
 const broken=structuredClone(c);broken.waterModel!.readilyEvaporableMm=20;assert.throws(()=>validateConfig(broken),/REW/);
 const noDual=structuredClone(c);delete noDual.waterModel;assert.throws(()=>validateConfig(noDual),/séparation/);
});
test('a biomass-model change invalidates previous calibration identity',()=>{
 const c=fixture(),wp=growthProfileId(c.growth!.parameters);
 delete c.growth!.parameters.biomassModel;
 assert.notEqual(growthProfileId(c.growth!.parameters),wp);
});
for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as const)test(country+': shared numerical correction reacts to irrigation, without a country-specific multiplier',()=>{
 const c=fixture();c.country=country;c.growth!.scope=growthScope(c);
 const dry=planSeason(c).growth!.scenarios.find(s=>s.id==='proposed')!.yieldKgHa;
 c.managementPlan!.irrigation.applications=[{date:c.sowingDate,fieldM3Ha:200}];
 // Initial full store can drain the first dose: use a later, depleted date.
 c.managementPlan!.irrigation.applications=[{date:'2026-05-20',fieldM3Ha:200}];
 assert.ok(planSeason(c).growth!.scenarios.find(s=>s.id==='proposed')!.yieldKgHa>dry);
});
