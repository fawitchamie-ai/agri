import test from 'node:test';import assert from 'node:assert/strict';
import {SEED_REFERENCES,estimateSowing,sowingCsv} from '../lib/seasonal/sowing.ts';
import {automaticCampaign} from '../lib/seasonal/automatic.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';import {geometryIdentity} from '../lib/seasonal/provenance.ts';import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import type {Country,SeasonalConfig} from '../lib/seasonal/types.ts';
const shape={type:'Polygon' as const,coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]] as [number,number][][]};
function fixture(crop='maize',value:number|null=40){const c=crop==='sorghum'?automaticCampaign(exampleCampaign('2026-11-01'),crop):applyCropProfile(exampleCampaign('2026-11-01'),crop);c.parcelGeometry=shape;c.areaM2=parcelMetrics(shape).areaM2;c.landAssessment=assessLandGeometry(shape,[{id:'worldcover',status:'available',provider:'Test',product:'Synthetic only',version:'test',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-01T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'cell',geometry:shape,value}],reason:null,assets:[],limitations:[]}]);return c;}
function manual(c:SeasonalConfig,areaM2:number|null,seedRateKgHa:number|null){c.sowingPlan={version:'sowing-input-1',geometryId:geometryIdentity(c.parcelGeometry),cropId:c.cropProfile!.id,areaM2,seedRateKgHa,source:'Synthetic declared seed lot'};return c;}
test('all six countries receive explicitly indicative, sourced seed plans, not optimum or yield predictions',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as Country[])for(const crop of Object.keys(SEED_REFERENCES)){
  const c=fixture(crop);c.country=country;const p=c.stages.length?planSeason(c).sowingPlan!:estimateSowing(validateConfig(c,{allowUnparametrisedCycle:true}));assert.equal(p.status,'indicative');assert.equal(p.areaBasis,'mapped-scenario');assert.equal(p.seedRateKgHa,SEED_REFERENCES[crop].defaultKgHa);assert.ok(Math.abs(p.seedKg!-c.landAssessment!.candidateAreaM2/10000*p.seedRateKgHa!)<1e-9);assert.ok(p.reference?.url.startsWith('https://'));assert.match(p.limits.join(' '),/pas un optimum/);assert.equal(c.yieldEstimation,undefined);
 }
});
test('4000 m² at 25 kg/ha needs 10 kg; manual rate and area survive validation and explicit CSV units',()=>{
 const c=manual(fixture(),4000,25),valid=validateConfig(c),p=planSeason(valid);assert.equal(p.sowingPlan!.seedKg,10);assert.equal(p.sowingPlan!.areaBasis,'declared-plan');assert.equal(p.sowingPlan!.rateBasis,'manual');assert.deepEqual(valid.sowingPlan,c.sowingPlan);assert.match(sowingCsv(p.sowingPlan!),/surface_prevue_m2.*dose_kg_ha.*semences_kg/);
 const originalWater=p.totals;valid.sowingPlan!.seedRateKgHa=50;const changed=planSeason(valid);assert.equal(changed.sowingPlan!.seedKg,20);assert.deepEqual(changed.totals,originalWater,'changing a seed rate must not invent a water or yield response');
});
test('water, unknown land, unsupported crop and flooded systems never obtain fabricated seed quantities',()=>{
 for(const c of [fixture('maize',80),fixture('maize',null),fixture('tomato'),{...fixture(),waterCondition:'submerged' as const}])assert.equal(planSeason(c).sowingPlan!.seedKg,null);
 const c=fixture('tomato');manual(c,1000,2);assert.equal(estimateSowing(c).seedKg,.2,'a documented manual dose can be used without a default for the crop');
});
test('mapped land fractions, holes and a smaller sown declaration govern the seed surface',()=>{
 const c=fixture();const hole=[[1.0002,8.0002],[1.0004,8.0002],[1.0004,8.0004],[1.0002,8.0004],[1.0002,8.0002]] as [number,number][];const holed=structuredClone(shape);holed.coordinates.push(hole);c.parcelGeometry=holed;c.areaM2=parcelMetrics(holed).areaM2;c.landAssessment=assessLandGeometry(holed,[{...c.landAssessment!.sources[0],cells:[{id:'land',geometry:shape,value:40}]}]);assert.ok(estimateSowing(c).areaM2!<parcelMetrics(shape).areaM2);
 c.yieldEstimation={version:'yield-input-1',method:'declared-scenario',scopeGeometryId:geometryIdentity(holed),homogeneityAssumption:'Synthetic',units:[{id:'field',sownAreaM2:1000,harvestedAreaM2:null,areaSource:'Synthetic declaration',reference:null}]};const e=estimateSowing(c);assert.equal(e.areaM2,1000);assert.equal(e.areaBasis,'sown-declaration');assert.equal(e.seedKg,2.5);
});
test('wrong scope, wrong crop, forged surface and invalid seed doses are rejected or unavailable',()=>{
 const c=manual(fixture(),1000,25);for(const p of [{areaM2:1e9},{seedRateKgHa:-1},{seedRateKgHa:NaN},{geometryId:'wrong'},{cropId:'soybean'}])assert.throws(()=>validateConfig({...c,sowingPlan:{...c.sowingPlan!,...p}}));
 const excluded=manual(fixture('maize',80),1000,25);assert.throws(()=>planSeason(excluded),/surface prévue dépasse/);
 const before=JSON.stringify(c);estimateSowing(c);assert.equal(JSON.stringify(c),before);
});

test('planned water volume uses the planned area without declaring it sown, zero and late references stay explicit',()=>{const c=manual(fixture(),4000,null),p=planSeason(c);assert.equal(p.calculationArea!.areaM2,4000);assert.equal(p.yieldEstimation,undefined);assert.match(p.assumptions.join(' '),/Ce n’est pas une déclaration/);c.sowingPlan!.areaM2=0;const zero=planSeason(c);assert.equal(zero.status,'blocked');assert.equal(zero.nextWindows.length,0);c.sowingPlan!.areaM2=null;c.asOfDate='2026-10-30';assert.equal(estimateSowing(c).seedKg,null);});
