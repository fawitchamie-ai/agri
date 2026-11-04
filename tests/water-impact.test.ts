import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
import {addDays} from '../lib/seasonal/validation.ts';
import {prepareYieldHypothesis} from '../lib/seasonal/scenario-guidance.ts';
function fixture(){
 const c=applyCropProfile(exampleCampaign(),'maize');c.waterCondition='drained';
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};
 c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:new Date().toISOString(),resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 c.fallback={label:'Synthetic moderate rain',rainMmDay:2,et0MmDay:4};c.system.sourceBudgetM3=1e6;
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';
 return c;
}
test('relative water response needs no yield reference and responds to irrigation, not area multiplication',()=>{
 const c=fixture(),original=JSON.stringify(c),p=planSeason(c),base=p.waterImpact!;
 assert.equal(JSON.stringify(c),original);assert.equal(c.yieldEstimation,undefined);assert.equal(p.yieldEstimation,undefined);
 assert.equal(base.areaBasis,'planned');assert.ok(base.scenarios[0].relativeYieldPercent!<100);
 c.managementPlan!.irrigation.applications=Array.from({length:25},(_,i)=>({date:addDays(c.sowingDate,i*5),fieldM3Ha:200}));
 const wet=planSeason(c).waterImpact!;
 assert.ok(wet.scenarios[2].relativeYieldPercent!>base.scenarios[2].relativeYieldPercent!);
 assert.deepEqual(wet.scenarios[0],base.scenarios[0]);assert.deepEqual(wet.scenarios[1],base.scenarios[1]);
 assert.equal(wet.scenarios[2].deltaPointsVsRainfed,wet.scenarios[2].relativeYieldPercent!-wet.scenarios[0].relativeYieldPercent!);
});
test('relative and absolute FAO outputs share the same response equation without applying it twice',()=>{
 const c=fixture();c.managementPlan!.irrigation.mode='automatic';
 const configured=prepareYieldHypothesis(c,{kgHa:6000,source:'Synthetic independent Ym',areaM2:1000,drained:true});
 const p=planSeason(configured);assert.equal(p.waterImpact!.areaBasis,'planned');assert.equal(p.sowingPlan!.areaBasis,'declared-plan');
 for(const row of p.waterImpact!.scenarios){
  const absolute=p.yieldEstimation!.scenarios.find(s=>s.id===row.id)!;
  assert.ok(absolute.totals);assert.ok(Math.abs(absolute.totals!.yieldKgHaSown!/6000*100-row.relativeYieldPercent!)<1e-9);
 }
});
test('flooding, severe drought, unsupported crops, salinity and missing weather never imply a zero effect',()=>{
 for(const edit of [
  (c:ReturnType<typeof fixture>)=>{c.waterCondition='submerged';},
  (c:ReturnType<typeof fixture>)=>{c.fallback=null;c.weather=[];},
  (c:ReturnType<typeof fixture>)=>{Object.assign(c,applyCropProfile(c,'millet'));},
  (c:ReturnType<typeof fixture>)=>{c.soilAnalyses=[{source:'Synthetic salinity',date:c.asOfDate,availableOn:c.asOfDate,topCm:0,bottomCm:20,status:'declared',measurements:[{parameter:'EC',value:8,unit:'dS/m',method:'saturated_paste'}]}];},
 ]){const c=fixture();edit(c);const r=planSeason(c).waterImpact!;assert.equal(r.status,'unavailable');assert.ok(r.scenarios.every(s=>s.relativeYieldPercent===null));}
 const dry=fixture();dry.fallback={label:'Extreme dry test',rainMmDay:0,et0MmDay:10};
 assert.equal(planSeason(dry).waterImpact!.scenarios[0].relativeYieldPercent,null);
});
test('adding an unmodelled product cannot change water response',()=>{
 const c=fixture(),before=planSeason(c).waterImpact;
 c.managementPlan!.products=[{id:'other',date:c.asOfDate,kind:'other',product:'Unmodelled amendment',dose:10,unit:'kg/ha',status:'planned',source:'Synthetic test',npkPercent:[null,null,null]}];
 assert.deepEqual(planSeason(c).waterImpact,before);
});

test('a planned zero area cannot be replaced by the full contour in the relative comparison',()=>{
 const c=fixture();c.sowingPlan={version:'sowing-input-1',geometryId:geometryIdentity(c.parcelGeometry),cropId:'maize',areaM2:0,seedRateKgHa:null,source:'Synthetic zero-area scenario'};
 const p=planSeason(c);assert.equal(p.status,'blocked');assert.equal(p.waterImpact!.status,'unavailable');assert.deepEqual(p.waterImpact!.scenarios,[]);
});
