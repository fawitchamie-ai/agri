import test from 'node:test';import assert from 'node:assert/strict';
import {calibrationStatus,interventionOutcome,comparePlannedProducts} from '../lib/seasonal/intervention-outcome.ts';
import {aggregateProduction,planSeason} from '../lib/seasonal/yield.ts';
import {protectRecordedProducts,emptyManagement,applicationNutrients} from '../lib/seasonal/management.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import type {Country,WaterPlan} from '../lib/seasonal/types.ts';
test('required 446.937375 m² cases verify units, not agronomic validity',()=>{
 const m2=446.93737505794223,ha=m2/10000;
 assert.ok(Math.abs(ha-.044693737505794223)<1e-16);
 const totals=aggregateProduction([{sownAreaM2:m2,productionKg:4000*ha}],m2);
 assert.ok(Math.abs(totals.productionKg-178.7749500231769)<1e-10);assert.equal(totals.yieldKgHaSown,4000);
 assert.ok(Math.abs(100*ha-4.469373750579422)<1e-12);assert.equal(m2*1,446.93737505794223);assert.equal(10000/1000,10);
 const c=applyCropProfile(exampleCampaign('2026-11-01'),'maize');c.managementPlan=emptyManagement(c);c.managementPlan.products=[{id:'a',date:c.asOfDate,kind:'fertilizer',product:'Synthetic 15-15-15',dose:100,unit:'kg/ha',status:'planned',source:'Unit test, not a recommendation',npkPercent:[15,15,15]}];
 assert.deepEqual(applicationNutrients(c.managementPlan.products[0])!.oxideKgHa,{N:15,P2O5:15,K2O:15});
});
test('no country or hypothetical reference becomes a calibrated fertilizer response',()=>{
 for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN'] as Country[]){const status=calibrationStatus(country,'maize');assert.equal(status.status,'not_calibrated');assert.equal(status.metrics,null);assert.equal(status.forecastValidated,false);}
 const c=applyCropProfile(exampleCampaign('2026-11-01'),'maize'),p=planSeason(c),out=interventionOutcome(c,p);assert.equal(out.fertilizer.status,'unavailable');assert.equal(out.comparison.yieldDeltaTonnesHa,null);assert.equal(out.optimalInput,null);
 const declared={...p,yieldEstimation:{...p.yieldEstimation,method:'declared-scenario',scenarios:[{id:'proposed',totals:{yieldKgHaSown:4000,productionKg:1600}},{id:'rainfed',totals:{yieldKgHaSown:4000,productionKg:1600}}]}} as unknown as WaterPlan;
 assert.equal(interventionOutcome(c,declared).comparison.productionDeltaKg,null);
});
test('planned variants cannot erase actual products or invent nutrient yields',()=>{
 const c=applyCropProfile(exampleCampaign('2026-11-01'),'maize');c.managementPlan=emptyManagement(c);c.managementPlan.products=[{id:'done',date:c.asOfDate,kind:'fertilizer',product:'Synthetic',dose:100,unit:'kg/ha',status:'declared',source:'Unit test',npkPercent:[15,15,15]},{id:'future',date:c.asOfDate,kind:'fertilizer',product:'Synthetic planned',dose:50,unit:'kg/ha',status:'planned',source:'Unit test',npkPercent:[15,15,15]}];
 const before=JSON.stringify(c),r=comparePlannedProducts(c,[],planSeason);assert.equal(JSON.stringify(c),before);assert.equal(r.scenarios[1].products.length,1);assert.equal(r.scenarios[1].products[0].id,'done');assert.equal(r.scenarios[1].quantifiedYieldEffect,null);
 const next=structuredClone(c);next.managementPlan!.products[0].dose=200;assert.throws(()=>protectRecordedProducts(c,next),/Correction explicite/);
 next.managementPlan!.recordedCorrection={id:'correction-1',reason:'Correcting the recorded amount from the original receipt'};assert.equal(protectRecordedProducts(c,next),true);
 const newer=structuredClone(next);newer.managementPlan!.products=[];assert.throws(()=>protectRecordedProducts(next,newer),/Correction explicite/);
 newer.managementPlan!.recordedCorrection={id:'correction-2',reason:'Explicit cancellation of an erroneous record'};assert.equal(protectRecordedProducts(next,newer),true);
 newer.country='BEN';assert.throws(()=>protectRecordedProducts(next,newer),/périmètre/);
});
