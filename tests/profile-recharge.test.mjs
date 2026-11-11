import test from 'node:test';import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planWater} from '../lib/seasonal/engine.ts';
function fixture(country='TGO'){
 const c=exampleCampaign('2026-01-01');c.asOfDate='2026-01-02';c.country=country;
 c.soilWaterModel={version:'profile-recharge-1',usage:'diagnostic',acceptedHypothesis:true,source:'Synthetic layer-conservation check; no forecast acceptance',availableOn:'2026-01-01'};
 c.stages=[{name:'Root expansion',days:2,kcStart:0,kcEnd:0,rootStartM:.1,rootEndM:.5,depletionFraction:.5}];
 c.soil.layers=[.1,.4,.5].map(thicknessM=>({thicknessM,thetaFC:.3,thetaWP:.15,initialTheta:.15}));
 c.fallback={label:'Zero ET and rain to isolate conservation',et0MmDay:0,rainMmDay:0};c.weather=[];c.system.sourceBudgetM3=0;c.system.applicationEfficiency=1;
 return c;
}
const water=amount=>[{id:'pulse',date:'2026-01-01',kind:'irrigation',amount,unit:'mm',point:'net',status:'measured',source:'Synthetic conservation experiment',recordedAt:'2026-01-01T00:00:00Z'}];
for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'])test(`${country}: recharge below young roots remains available to expanding roots`,()=>{
 const p=planWater(fixture(country),water(60));assert.equal(p.complete,true);
 assert.ok(Math.abs(p.days[0].stockEndMm-15)<1e-8);assert.ok(Math.abs(p.days[0].drainageMm-45)<1e-8);
 assert.equal(p.days[0].deepDrainageMm,0);assert.ok(Math.abs(p.days[1].rootGainMm-45)<1e-8);
 assert.ok(Math.abs(p.days[1].stockEndMm-60)<1e-8);
 assert.ok(p.days.every(d=>Math.abs(d.balanceResidualMm)<1e-8&&Math.abs(d.profileBalanceResidualMm)<1e-8));
});
test('deep drainage is distinct from root-zone flux, and neither flux manufactures profile water',()=>{
 const p=planWater(fixture(),water(200));assert.ok(Math.abs(p.days[0].drainageMm-185)<1e-8);
 assert.ok(Math.abs(p.days[0].deepDrainageMm-50)<1e-8);assert.ok(Math.abs(p.days[0].profileStockEndMm-150)<1e-8);
 assert.ok(p.days.every(d=>Math.abs(d.profileBalanceResidualMm)<1e-8));
});
test('losses are applied once before recharge, preserving gross field and net root inputs',()=>{
 const c=fixture();c.system.applicationEfficiency=.5;
 const e=water(100);e[0].point='field';const p=planWater(c,e);
 assert.equal(p.days[0].irrigationNetMm,50);assert.ok(Math.abs(p.days[1].stockEndMm-50)<1e-8);
 assert.ok(Math.abs(p.days[0].profileStockEndMm-50)<1e-8);
});
test('rejected recharge hypothesis cannot silently replace the legacy forecast path',()=>{
 const c=fixture();delete c.soilWaterModel;const p=planWater(c,water(60));
 assert.equal(p.soilWaterMethod,'root-zone-bucket');assert.ok(Math.abs(p.days[1].rootGainMm)<1e-8);
 assert.ok(Math.abs(p.days[1].stockEndMm-15)<1e-8);
});
