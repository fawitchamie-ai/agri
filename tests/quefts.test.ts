import test from 'node:test';
import assert from 'node:assert/strict';
import {QUEFTS_PROFILES,queftsYield,pairUptake,anchorSupply,type NPK} from '../lib/seasonal/quefts.ts';
import {fertilizerScenario,fertilizerScope,parseFertilizerScenario} from '../lib/seasonal/fertilizer-scenario.ts';
import {fixture} from './support/field-trial-fixture.ts';
import {emptyManagement,applicationNutrients} from '../lib/seasonal/management.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {COUNTRIES,type WaterPlan} from '../lib/seasonal/types.ts';
import {landFixture} from './support/land-fixtures.mjs';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';
const near=(a:number,b:number,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
function scenario(){
 const c=fixture();c.waterCondition='drained';c.managementPlan=emptyManagement(c);
 c.fertilizerScenario={version:'quefts-scenario-1',scope:fertilizerScope(c),acceptedTransfer:true,ceilingKgHa:6000,ceilingSource:'Synthetic test ceiling, not an agricultural recommendation',availableOn:c.asOfDate,control:null};
 return c;
}
function fertilizer(c:ReturnType<typeof scenario>,id='planned',status:'planned'|'declared'='planned'){
 return {id,date:c.asOfDate,kind:'fertilizer' as const,product:'Synthetic NPK 15-15-15',dose:200,unit:'kg/ha' as const,status,source:'Synthetic label',npkPercent:[15,15,15] as [number,number,number]};
}
test('published mean-soil formulas and efficiencies retain each coherent source profile',()=>{
 near(QUEFTS_PROFILES[0].soilSupply[0],45.3424);near(QUEFTS_PROFILES[1].soilSupply[1],6.832437132);
 assert.deepEqual(QUEFTS_PROFILES.map(p=>p.recovery),[[.42,.16,.54],[.32,.08,.37]]);
});
test('analytical limiting cases: nitrogen and phosphorus cap yield even with excess of other nutrients',()=>{
 for(const p of QUEFTS_PROFILES){
  near(queftsYield([10,100,1000],[0,0,0],6000,p).yieldKgHa,p.d[0]*(10-p.r[0]));
  const y=queftsYield([100,1,1000],[0,0,0],6000,p).yieldKgHa;
  near(y,p.d[1]*(1-p.r[1]));near(queftsYield([100,1,1000],[100,0,0],6000,p).yieldKgHa,y);
  assert.equal(queftsYield([0,0,0],[0,0,0],6000,p).yieldKgHa,0);
  assert.equal(queftsYield([1e4,1e4,1e4],[0,0,0],6000,p).yieldKgHa,6000);
 }
});
test('pairwise uptake is continuous at both analytical branch boundaries',()=>{
 const p=QUEFTS_PROFILES[0];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(i!==j){
  const sj=30,low=(sj-p.r[j])*p.a[j]/p.d[i],high=(sj-p.r[j])*p.d[j]/p.a[i];
  for(const si of [p.r[i]+low,p.r[i]+2*high-low]){
   const f=(x:number)=>pairUptake(x,sj,p.a[i],p.d[i],p.a[j],p.d[j],p.r[i],p.r[j]);
   near(f(si-1e-8),f(si+1e-8),1e-6);
  }
 }
});
test('monotonic nutrient response, finite uptake and ceiling across a deterministic supply grid',()=>{
 for(const p of QUEFTS_PROFILES)for(const n of [0,5,20,60,160])for(const ph of [0,.5,2,8,30])for(const k of [0,5,20,60,160]){
  const soil:NPK=[n,ph,k],q=queftsYield(soil,[0,0,0],6000,p);
  assert.ok(q.yieldKgHa>=0&&q.yieldKgHa<=6000);
  q.uptake.forEach((x,i)=>assert.ok(x>=0&&x<=q.supply[i]+1e-9));
  for(let i=0;i<3;i++){const s=[...soil] as NPK;s[i]+=.01;assert.ok(queftsYield(s,[0,0,0],6000,p).yieldKgHa>=q.yieldKgHa-1e-8);}
 }
});
test('inverse control anchor fits the declared control while retaining non-identifiable response differences',()=>{
 const deltas=QUEFTS_PROFILES.map(p=>{const a=anchorSupply(1500,6000,p);near(queftsYield(a.supply,[0,0,0],6000,p).yieldKgHa,1500);return queftsYield(a.supply,[80,30,30],6000,p).yieldKgHa-1500;});
 assert.ok(Math.abs(deltas[0]-deltas[1])>100);
 assert.throws(()=>anchorSupply(6000,6000,QUEFTS_PROFILES[0]));
});
test('zero planned dose equals baseline; realized fertilizer retained, conversions and paired differences exact',()=>{
 const c=scenario();c.managementPlan!.products=[{...fertilizer(c,'done','declared'),dose:100}];
 let r=fertilizerScenario(c,{} as WaterPlan).results!;assert.deepEqual(r.deltaKgHa,[0,0]);
 const done=structuredClone(r.realizedKgHa);c.managementPlan!.products.push(fertilizer(c));
 r=fertilizerScenario(c,{} as WaterPlan).results!;assert.deepEqual(r.realizedKgHa,done);
 const mass=applicationNutrients(fertilizer(c))!.elementalKgHa;
 assert.deepEqual(r.plannedKgHa,[mass.N,mass.P,mass.K]);assert.ok(r.plannedKgHa[1]<30&&r.plannedKgHa[2]<30);
 for(const p of r.profiles)near(p.deltaKgHa,p.withKgHa-p.withoutKgHa);
 assert.equal(r.deltaKgHa[0],Math.min(...r.profiles.map(p=>p.deltaKgHa)));
 assert.equal(r.productionWithKg,null);
});
test('all six countries have explicit transferred maize scenarios without local validation claims',()=>{
 for(const country of Object.keys(COUNTRIES) as (keyof typeof COUNTRIES)[]){const c=scenario();c.country=country;c.fertilizerScenario!.scope=fertilizerScope(c);const r=fertilizerScenario(c,{} as WaterPlan);assert.equal(r.status,'exploratory_transfer');assert.equal(r.validated,false);assert.equal(r.predictiveInterval95,null);assert.equal(r.optimalDose,null);}
});
test('unknown nutrient is not zero, domain ceiling and stale or changed contexts block',()=>{
 const base=scenario();base.managementPlan!.products=[fertilizer(base)];
 const variations=[
  (c:typeof base)=>{c.managementPlan!.products[0].npkPercent[1]=null;},
  (c:typeof base)=>{c.managementPlan!.products[0].dose=2000;},
  (c:typeof base)=>{c.waterCondition='unknown';},
  (c:typeof base)=>{c.cropProfile!.id='sorghum';},
  (c:typeof base)=>{c.variety='Changed';},
  (c:typeof base)=>{c.asOfDate='2026-11-01';},
  (c:typeof base)=>{c.managementPlan!.products[0].date='2026-11-01';},
 ];
 for(const modify of variations){const c=structuredClone(base);modify(c);const r=fertilizerScenario(c,{} as WaterPlan);assert.equal(r.status,'unavailable');assert.equal(r.results,null);assert.ok(r.missing.length);}
});
test('no default ceiling, no coerced missing values, and anchor units/source are mandatory',()=>{
 const c=scenario(),v=c.fertilizerScenario!;
 for(const change of [{ceilingKgHa:null},{ceilingKgHa:10001},{acceptedTransfer:false},{ceilingSource:''},{control:{kgHa:1500,source:'test',moisturePercent:14,withoutFertilizer:true,denominator:'sown'}}])assert.throws(()=>parseFertilizerScenario({...v,...change}));
 assert.deepEqual(validateConfig(c).fertilizerScenario,v);
});
test('verified sown area used exactly once; baseline water outputs are unchanged',()=>{
 const c=scenario();c.landAssessment=landFixture(c.parcelGeometry);c.managementPlan!.products=[fertilizer(c)];
 c.yieldEstimation={version:'yield-input-1',method:'declared-scenario',scopeGeometryId:geometryIdentity(c.parcelGeometry),homogeneityAssumption:'Synthetic single unit',units:[{id:'u1',sownAreaM2:1000,harvestedAreaM2:500,areaSource:'Synthetic surface',reference:null}]};
 const p=planSeason(c),r=p.fertilizerScenario!.results!;assert.equal(r.areaM2,1000);
 near(r.productionWithKg![0],r.yieldWithKgHa[0]*.1);near(r.extraProductionKg![1],r.deltaKgHa[1]*.1);
 const q=planSeason({...c,fertilizerScenario:undefined});assert.deepEqual(q.yieldEstimation,p.yieldEstimation);assert.deepEqual(q.totals,p.totals);
});
