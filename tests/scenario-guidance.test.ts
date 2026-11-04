import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import {prepareYieldHypothesis,scenarioComparison} from '../lib/seasonal/scenario-guidance.ts';
import {fieldBrief} from '../lib/seasonal/field-intelligence.ts';
function fixture(){
 const c=applyCropProfile(exampleCampaign('2026-11-04'),'maize');
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.0006,8],[1.0006,8.0006],[1,8.0006],[1,8]]]};
 c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;c.waterCondition='drained';
 c.fallback!.rainMmDay=3;c.system.sourceBudgetM3=100000;c.system.hoursPerDay=24;c.system.maxNetMmPerDay=100;
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-04T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 return c;
}
const proposal=(c:ReturnType<typeof fixture>)=>({kgHa:6000,source:'Synthetic independent scenario reference, not a field observation.',areaM2:c.landAssessment!.candidateAreaM2,drained:true});
test('preparing a scenario preserves soil, weather, products and source config; no observed sowing is invented',()=>{
 const c=fixture(),before=JSON.stringify(c),v=prepareYieldHypothesis(c,proposal(c));
 assert.equal(JSON.stringify(c),before);assert.deepEqual(v.soil,c.soil);assert.deepEqual(v.weather,c.weather);assert.deepEqual(v.managementPlan,c.managementPlan);
 assert.equal(v.yieldEstimation!.units[0].reference!.kind,'scenario');
 assert.match(v.yieldEstimation!.units[0].areaSource,/hypothèse|Hypothèse/);
 assert.equal(v.yieldEstimation!.units[0].harvestedAreaM2,null);
 assert.equal(v.yieldEstimation!.method,'fao-seasonal');assert.equal(v.inputPolicy!.allowAssumptions,true);
});
test('real water outputs are ranked only when complete; stale, missing and simple arithmetic outputs are never ranked',()=>{
 const c=prepareYieldHypothesis(fixture(),proposal(fixture())),p=planSeason(c),r=scenarioComparison(c,p);
 assert.equal(r.comparable,true);assert.ok(r.best);
 assert.equal(r.best.kgHa,Math.max(...r.rows.map(x=>x.kgHa!)));
 assert.equal(scenarioComparison(c,p,true).best,null);
 const incomplete=structuredClone(p);incomplete.yieldEstimation!.scenarios[1].totals=null;
 assert.equal(scenarioComparison(c,incomplete).best,null);
 const simple=structuredClone(p);simple.yieldEstimation!.method='declared-scenario';
 assert.equal(scenarioComparison(c,simple).best,null);
});
test('equal yields retain the least additional irrigation scenario rather than promote extra watering',()=>{
 const c=prepareYieldHypothesis(fixture(),proposal(fixture())),p=planSeason(c);
 for(const s of p.yieldEstimation!.scenarios){s.status='conditional';s.totals={productionKg:60,yieldKgHaSown:6000,productionKgHaContour:6000};}
 assert.equal(scenarioComparison(c,p).best!.id,'rainfed');
});
test('selected scenario survives validation and drives the overview output',()=>{
 const c=prepareYieldHypothesis(fixture(),proposal(fixture()));c.yieldScenario='rainfed';
 const checked=validateConfig(c),p=planSeason(checked);
 assert.equal(checked.yieldScenario,'rainfed');
 assert.deepEqual(fieldBrief(checked,p,[]).result,p.yieldEstimation!.scenarios.find(x=>x.id==='rainfed')!.totals);
});
test('flooding, stale terrain, oversized surfaces and unsupported partitions cannot be silently reset',()=>{
 const c=fixture(),v=proposal(c);
 assert.throws(()=>prepareYieldHypothesis({...c,waterCondition:'submerged'},v),/engorgement/);
 assert.throws(()=>prepareYieldHypothesis(c,{...v,drained:false}),/engorgement/);
 assert.throws(()=>prepareYieldHypothesis(c,{...v,areaM2:v.areaM2*2}),/surface/i);
 assert.throws(()=>prepareYieldHypothesis({...c,landAssessment:undefined},v),/analyse/);
 const ready=prepareYieldHypothesis(c,v);ready.yieldEstimation!.units.push({...ready.yieldEstimation!.units[0],id:'second'});
 assert.throws(()=>prepareYieldHypothesis(ready,v),/unités spatiales/);
});
test('an existing reference, analytical context and declared surface provenance are preserved unchanged',()=>{
 const c=prepareYieldHypothesis(fixture(),proposal(fixture())),u=c.yieldEstimation!.units[0];
 u.areaSource='Measured sowing area';u.reference!.context='Independent trial A, variety X, non-water-limiting conditions';
 u.reference!.kind='attainable';u.reference!.availableOn='2026-11-01';
 const next=prepareYieldHypothesis(c,{...proposal(c),areaM2:u.sownAreaM2!,kgHa:u.reference!.kgHa,source:u.reference!.source});
 assert.deepEqual(next.yieldEstimation!.units[0],u);
 assert.equal(next.yieldEstimation!.scopeGeometryId,geometryIdentity(c.parcelGeometry));
});
test('national or harvested-area references cannot be promoted into water-stress-free Ym',()=>{
 const c=prepareYieldHypothesis(fixture(),proposal(fixture()));
 c.yieldEstimation!.units[0].reference!.independentYm=false;
 c.yieldEstimation!.units[0].reference!.denominator='harvested';
 const before=JSON.stringify(c);
 assert.throws(()=>prepareYieldHypothesis(c,proposal(c)),/indépendante/);
 assert.equal(JSON.stringify(c),before);
});
