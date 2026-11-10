import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCropProfile,cropById} from '../lib/seasonal/catalog.ts';
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

function dry(country='TGO',crop='maize'){
 const c=fixture();c.country=country as typeof c.country;c.cropProfile!.id=crop;c.cropProfile!.mode='custom';c.crop=cropById(crop)!.name;c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';
 c.fallback!.rainMmDay=0;c.soil.layers.forEach(l=>l.initialTheta=l.thetaWP);
 c.system.sourceBudgetM3=null;c.system.sourceFlowM3h=null;c.system.hoursPerDay=null;
 c.growth!.soilSupply={initialKgHa:[1000,1000,1000],releaseKgHaDay:[0,0,0],source:'Synthetic nonlimiting nutrients'};
 c.growth!.scope=growthScope(c);return c;
}
function irrigate(c:ReturnType<typeof fixture>,dose:number){c.managementPlan!.irrigation.applications=Array.from({length:125},(_,i)=>({date:addDays(c.sowingDate,i),fieldM3Ha:dose}));return c;}
// Shared synthetic crop parameters: these tests check wiring, not local calibration.
for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'])for(const crop of ['maize','sorghum','millet','rice-upland'])test(`${country}/${crop}: zero available water gives zero growth; irrigation changes yield`,()=>{
 const rows=[0,10,50].map(dose=>{const c=irrigate(dry(country,crop),dose),p=planSeason(c);assert.ok(p.complete);assert.equal(p.growth!.status,'scenario');
 assert.ok(p.days.every(d=>Math.abs(d.balanceResidualMm)<1e-8));
 assert.equal(p.growth!.scenarios.find(s=>s.id==='rainfed')!.yieldKgHa,0);
 const r=p.growth!.scenarios.find(s=>s.id==='proposed')!;assert.equal(r.water!.irrigationNetMm,p.totals.netMm);assert.equal(r.water!.etaMm,p.totals.actualEtMm);assert.ok(r.balance.residualKgHa.every(n=>Math.abs(n)<1e-8));return r.yieldKgHa;});
 assert.equal(rows[0],0);assert.ok(rows[1]>0);assert.ok(rows[2]>rows[1]);
});
test('initial soil water, application efficiency and infiltration actually change dry-season yield',()=>{
 const empty=dry();const wet=structuredClone(empty);wet.soil.layers.forEach(l=>l.initialTheta=l.thetaFC);assert.ok(proposed(wet).yieldKgHa>proposed(empty).yieldKgHa);
 const c=irrigate(dry(),20),base=proposed(c).yieldKgHa;
 const inefficient=structuredClone(c);inefficient.system.applicationEfficiency=.1;assert.ok(proposed(inefficient).yieldKgHa<base);
 const slow=structuredClone(c);slow.soil.infiltrationMmDay=.1;assert.ok(proposed(slow).yieldKgHa<base);
});
test('a zero water quota prevents planned irrigation from creating yield',()=>{
 const c=irrigate(dry(),100);c.system.sourceBudgetM3=0;const p=planSeason(c);
 assert.equal(p.totals.netMm,0);assert.equal(proposed(c).yieldKgHa,0);assert.ok(p.days.some(d=>d.intervention?.constrained));
});
test('each accessible nutrient can limit yield independently of abundant water',()=>{
 const c=irrigate(dry(),100),base=proposed(c).yieldKgHa;
 for(let k=0;k<3;k++){const limited=structuredClone(c);limited.growth!.soilSupply.initialKgHa[k]=0;assert.equal(proposed(limited).yieldKgHa,0);}
 assert.ok(base>0);
});
test('rainfed comparison retains the same observed soil moisture when no irrigation was recorded',()=>{
 const c=dry();c.soil.layers.forEach(l=>l.initialTheta=l.thetaFC);
 const p=planSeason(c,[{id:'dry-soil',date:c.sowingDate,kind:'soil',amount:c.soil.layers[0].thetaWP,unit:'fraction',point:'net',status:'measured',source:'Synthetic moisture measurement',recordedAt:c.asOfDate+'T00:00:00Z',landSelection:c.landSelection}]);
 const g=p.growth!;assert.equal(g.status,'scenario');
 assert.equal(g.scenarios.find(s=>s.id==='rainfed')!.yieldKgHa,g.scenarios.find(s=>s.id==='recorded')!.yieldKgHa);
 assert.equal(p.waterImpact!.scenarios[0].etaMm,p.waterImpact!.scenarios[1].etaMm);
});

test('a K ceiling can mask irrigation without removing a legitimate nutrient limit',()=>{
 const c=irrigate(dry(),100);c.growth!.soilSupply.initialKgHa=[1000,1000,1];
 const wet=proposed(c),partial=proposed(irrigate(structuredClone(c),10));
 assert.ok(Math.abs(wet.yieldKgHa-partial.yieldKgHa)<1e-7);
 assert.ok(wet.diagnostics.nutrientLimitedDays[2]>0);
 assert.deepEqual(wet.diagnostics.nutrientLimitedDays.slice(0,2),[0,0]);
 assert.ok(wet.days.some(d=>d.limitingNutrients.includes('K')));
 assert.ok(wet.balance.residualKgHa.every(n=>Math.abs(n)<1e-8));
 const enriched=structuredClone(c);enriched.growth!.soilSupply.initialKgHa[2]=1000;
 assert.ok(proposed(enriched).yieldKgHa>wet.yieldKgHa);
 const rainy=dry();rainy.fallback!.rainMmDay=10;
 assert.equal(proposed(irrigate(structuredClone(rainy),100)).yieldKgHa,proposed(rainy).yieldKgHa);
});
