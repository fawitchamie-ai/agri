import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {landFixture,testParcel} from './support/land-fixtures.mjs';
import {growthTemplate,growthScope,parseGrowth} from '../lib/seasonal/growth.ts';
import {fitHarvestIndex,growthProfileId,type GrowthHarvestSample} from '../lib/seasonal/growth-calibration.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {addDays,validateConfig} from '../lib/seasonal/validation.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
function fixture(){
 const c=applyCropProfile(exampleCampaign('2026-05-01'),'maize');c.asOfDate='2026-05-01';c.waterCondition='drained';
 c.parcelGeometry=testParcel;c.areaM2=parcelMetrics(testParcel).areaM2;c.landAssessment=landFixture(testParcel);c.landSelection='potentialLand';
 c.fallback={label:'Synthetic rain',rainMmDay:4,et0MmDay:4};c.system.sourceBudgetM3=1e6;
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';c.growth=growthTemplate(c);
 c.growth.weatherScenario={temperatureMeanC:28,radiationMj:18,source:'Synthetic forcing test only'};
 return c;
}
const proposed=(c:ReturnType<typeof fixture>)=>{const r=planSeason(c).growth!;assert.equal(r.status,'scenario',JSON.stringify(r.missing));return r.scenarios.find(s=>s.id==='proposed')!;};
test('integrated daily output is immutable, mass balanced and production scales only with area',()=>{
 const c=fixture(),before=JSON.stringify(c),r=proposed(c);assert.equal(JSON.stringify(c),before);assert.ok(r.yieldKgHa>0);assert.equal(r.days.length,125);
 assert.ok(Math.abs(r.productionKg-r.yieldKgHa*c.areaM2!/10000)<1e-8);
 for(const n of r.balance.residualKgHa)assert.ok(Math.abs(n)<1e-8);
 assert.ok(r.days.every(d=>d.stockKgHa.every(n=>n>=0)&&d.incrementKgHa>=0));
 c.sowingPlan={version:'sowing-input-1',geometryId:JSON.stringify(c.parcelGeometry),cropId:'maize',areaM2:c.areaM2!/2,seedRateKgHa:null,source:'Half area scenario'};
 const half=proposed(c);assert.equal(half.yieldKgHa,r.yieldKgHa);assert.ok(Math.abs(half.productionKg-r.productionKg/2)<1e-8);
});
test('rain, retention, temperature, radiation and stage canopy actually affect biomass',()=>{
 const base=fixture(),normal=proposed(base).yieldKgHa;
 for(const mutate of [
 (c:ReturnType<typeof fixture>)=>{c.fallback!.rainMmDay=0;},
 (c:ReturnType<typeof fixture>)=>{c.growth!.weatherScenario!.temperatureMeanC=44;},
 (c:ReturnType<typeof fixture>)=>{c.growth!.weatherScenario!.radiationMj=2;},
 (c:ReturnType<typeof fixture>)=>{c.growth!.parameters.stages.forEach(s=>{s.faparStart*=.1;s.faparEnd*=.1;});},
 (c:ReturnType<typeof fixture>)=>{c.soil.layers[0].initialTheta=.151;c.soil.layers[0].thetaFC=.16;c.fallback!.rainMmDay=.5;},
 ]){const c=fixture();mutate(c);assert.ok(proposed(c).yieldKgHa<normal);}
});
test('NPK additions act through limiting stocks, timing matters, recorded inputs survive comparisons',()=>{
 const c=fixture();c.growth!.soilSupply.initialKgHa=[1,1000,1000];c.growth!.soilSupply.releaseKgHaDay=[0,0,0];const base=proposed(c).yieldKgHa;
 c.managementPlan!.products=[{id:'n',date:addDays(c.sowingDate,15),kind:'fertilizer',product:'Synthetic N',dose:150,unit:'kg/ha',status:'planned',source:'Synthetic',npkPercent:[100,0,0]}];
 const result=planSeason(c).growth!,wet=result.scenarios.find(s=>s.id==='proposed')!,without=result.scenarios.find(s=>s.id==='without-planned-fertilizer')!;
 assert.ok(wet.yieldKgHa>base);assert.equal(without.yieldKgHa,base);
 c.managementPlan!.products[0].date=addDays(c.sowingDate,124);assert.ok(proposed(c).yieldKgHa<wet.yieldKgHa);
 c.asOfDate=addDays(c.sowingDate,15);c.managementPlan!.products[0].date=c.asOfDate;c.managementPlan!.products[0].status='declared';
 const recorded=planSeason(c).growth!;assert.equal(recorded.scenarios.find(s=>s.id==='proposed')!.yieldKgHa,recorded.scenarios.find(s=>s.id==='without-planned-fertilizer')!.yieldKgHa);
});
test('pH requires a declared curve and matching laboratory method; no hidden pH multiplier',()=>{
 const c=fixture();c.growth!.soilSupply.initialKgHa=[0,0,0];c.soilAnalyses=[{source:'Synthetic pH',date:c.asOfDate,availableOn:c.asOfDate,topCm:0,bottomCm:20,status:'declared',measurements:[{parameter:'pH',value:4,unit:'pH',method:'water'}]}];
 const baseline=proposed(c).yieldKgHa;
 c.growth!.parameters.phResponse={analysisIndex:0,measurementIndex:0,method:'water',curve:[3,5.5,7,9],source:'Synthetic response hypothesis'};
 assert.ok(proposed(c).yieldKgHa<baseline);
 c.growth!.parameters.phResponse.method='KCl';assert.equal(planSeason(c).growth!.status,'unavailable');
});
test('satellite assimilation is past-only, age-limited, quality-gated and changes interception',()=>{
 const c=fixture();c.asOfDate=addDays(c.sowingDate,30);const base=proposed(c).yieldKgHa;
 c.growth!.satellite={index:'NDVI',bare:.1,full:.9,maxAgeDays:5,source:'Synthetic NDVI fAPAR relation',observations:[{date:addDays(c.sowingDate,20),availableOn:addDays(c.sowingDate,22),value:.1,clearFraction:1,source:'Synthetic crop-only polygon mean'}]};
 const r=proposed(c);assert.ok(r.yieldKgHa<base);assert.equal(r.days[19].canopySource,'parameter');assert.equal(r.days[20].canopySource,'satellite');assert.equal(r.days[26].canopySource,'parameter');
 c.growth!.satellite.observations[0].availableOn=addDays(c.asOfDate,1);assert.throws(()=>validateConfig(c),/satellite/);
 c.growth!.satellite.observations[0].availableOn=c.asOfDate;c.growth!.satellite.observations[0].clearFraction=.5;assert.throws(()=>validateConfig(c),/qualité/);
});
test('missing inputs, stale domain, floods, unsupported crops, organic unknowns never fabricate yield',()=>{
 for(const mutate of [
 (c:ReturnType<typeof fixture>)=>{c.growth!.weatherScenario=null;},
 (c:ReturnType<typeof fixture>)=>{c.variety='Other';},
 (c:ReturnType<typeof fixture>)=>{c.waterCondition='waterlogged';},
 (c:ReturnType<typeof fixture>)=>{c.sowingPlan={version:'sowing-input-1',geometryId:JSON.stringify(c.parcelGeometry),cropId:'maize',areaM2:0,seedRateKgHa:null,source:'Zero planned'};},
 ]){const c=fixture();mutate(c);const p=planSeason(c).growth!;assert.equal(p.status,'unavailable');assert.equal(p.scenarios.length,0);assert.ok(p.missing.length);}
 const c=fixture();c.growth!.parameters.rueGPerMj=NaN;assert.throws(()=>parseGrowth(c.growth,c));
});
function samples(c:ReturnType<typeof fixture>):GrowthHarvestSample[]{return [0,1,2,3].map(i=>({id:String(i),site:'site-'+i,season:i<2?2022:2023,split:i<2?'training':'validation',country:c.country,cropId:'maize',variety:c.variety,profileId:growthProfileId(c.growth!.parameters),availableOn:'2024-01-01',source:'Synthetic calibration fixture',biomassDryKgHa:1000*(i+1),observedYieldKgHa:500*(i+1),moisturePercent:0}));}
test('history fits HI on training only, rejects temporal/site leakage, reports held-out error',()=>{
 const c=fixture(),rows=samples(c),domain={country:c.country,cropId:'maize',variety:c.variety,profileId:growthProfileId(c.growth!.parameters),asOfDate:c.asOfDate};
 const fitted=fitHarvestIndex(rows,domain);assert.equal(fitted.harvestIndex,.5);assert.equal(fitted.validation.rmseDryKgHa,0);assert.equal(fitted.forecastValidated,false);
 rows[2].observedYieldKgHa=10;assert.equal(fitHarvestIndex(rows,domain).harvestIndex,.5);assert.ok(fitHarvestIndex(rows,domain).validation.rmseDryKgHa>0);
 rows[2].site=rows[0].site;assert.throws(()=>fitHarvestIndex(rows,domain),/distincts/);
 rows[2].site='another';rows[2].season=2022;assert.throws(()=>fitHarvestIndex(rows,domain),/postérieures/);
});
test('calibrated HI is connected to the simulation without changing biomass or NPK uptake',()=>{
 const c=fixture(),base=proposed(c);c.growth!.history=samples(c);const r=proposed(c);
 assert.equal(r.biomassKgHa,base.biomassKgHa);assert.ok(Math.abs(r.yieldDryKgHa-r.biomassKgHa*.5)<1e-8);assert.deepEqual(r.balance,base.balance);
});

test('organic release conserves product nutrient mass and needs an explicit availability profile',()=>{
 const c=fixture();c.growth!.soilSupply.initialKgHa=[1,1000,1000];c.growth!.soilSupply.releaseKgHaDay=[0,0,0];
 c.managementPlan!.products=[{id:'organic',date:c.sowingDate,kind:'fertilizer',product:'Synthetic organic',dose:1000,unit:'kg/ha',status:'planned',source:'Test',npkPercent:[null,null,null],applicationMode:'Test incorporation',composition:{version:'product-composition-1',id:'test',kind:'organic',name:'Synthetic organic',manufacturer:null,source:'Synthetic test only',lot:null,analysisDate:null,evidence:'declared',scenario:null,convention:'N-P-K',basis:'fresh',percent:[10,0,0],nForms:{urea:0,ammonium:0,nitrate:0,organic:10},moisturePercent:30,densityKgL:null,organic:{carbonPercent:20,cnRatio:2,maturity:null,storage:null},uncertainty:'Test fixture only'}}];
 const missing=planSeason(c).growth!;assert.equal(missing.status,'unavailable');assert.match(missing.missing.join(),/libération organique/);
 c.growth!.organicRelease=[{productId:'organic',availableFraction:[.5,0,0],halfLifeDays:10,source:'Synthetic release kinetics'}];
 const r=proposed(c);assert.ok(r.balance.suppliedKgHa[0]>50&&r.balance.suppliedKgHa[0]<51);assert.ok(r.balance.residualKgHa.every(x=>Math.abs(x)<1e-8));
 c.growth!.organicRelease[0].halfLifeDays=300;assert.ok(proposed(c).yieldKgHa<r.yieldKgHa);
});
test('integrated fertilizer comparison computes all variants and keeps water settings and realised inputs',async()=>{
 const {comparePlannedProducts}=await import('../lib/seasonal/intervention-outcome.ts');
 const c=fixture();c.growth!.soilSupply.initialKgHa=[1,1000,1000];c.growth!.soilSupply.releaseKgHaDay=[0,0,0];
 c.managementPlan!.products=[{id:'n',date:c.sowingDate,kind:'fertilizer',product:'Synthetic N',dose:100,unit:'kg/ha',status:'planned',source:'Test',npkPercent:[100,0,0]}];
 const r=comparePlannedProducts(c,[],planSeason);assert.ok(r.scenarios.every(s=>s.integrated));assert.ok(r.scenarios[0].integrated!.yieldKgHa>r.scenarios[1].integrated!.yieldKgHa);assert.equal(r.scenarios[2].integrated!.yieldKgHa,r.scenarios[0].integrated!.yieldKgHa);assert.equal(r.scenarios[3].integrated!.yieldKgHa,r.scenarios[1].integrated!.yieldKgHa);
});
