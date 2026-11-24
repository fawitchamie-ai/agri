import test from 'node:test';
import assert from 'node:assert/strict';
import {cropById} from '../lib/seasonal/catalog.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import {growthTemplate} from '../lib/seasonal/growth.ts';
import type {SeasonalConfig} from '../lib/seasonal/types.ts';

import {automaticYieldFixture} from './support/automatic-yield-fixture.ts';
test('automatic profile, complete data and accepted assumptions produce actual daily growth and harvest',()=>{
 const c=automaticYieldFixture(),before=JSON.stringify(c),p=planSeason(c),a=p.automaticYield!;
 assert.equal(JSON.stringify(c),before);assert.equal(c.growth,undefined,'Automatic preparation never replaces the user configuration with a manual profile');
 assert.equal(a.status,'ready',JSON.stringify(a.missing));assert.equal(a.profileId,'maize-rue-indicative-1');assert.equal(a.validated,false);assert.ok(a.profile);assert.equal(a.weather.completeDays,125);
 const r=p.growth!.scenarios.find(s=>s.id==='recorded')!;assert.ok(r.yieldKgHa>0);assert.equal(r.days.length,125);assert.ok(Math.abs(r.productionKg-r.yieldKgHa*p.growth!.areaM2!/10000)<1e-8);
 assert.equal(p.growth!.validated,false);assert.equal(p.growth!.predictiveInterval95,null);assert.equal(JSON.parse(JSON.stringify(p)).automaticYield.profile.source,a.profile.source);
 assert.deepEqual(planSeason(validateConfig(JSON.parse(JSON.stringify(c)))).growth,p.growth,'A serialized campaign reruns the same deterministic calculation');
});
test('rain, radiation and area changes recompute the automatic result without changing scope or historical values',()=>{
 const c=automaticYieldFixture(),baseline=planSeason(c).growth!.scenarios.find(s=>s.id==='recorded')!;
 const dark={...c,weather:c.weather.map(w=>({...w,radiationMj:1}))},dry={...c,weather:c.weather.map(w=>({...w,rainMm:0}))};
 assert.ok(planSeason(dark).growth!.scenarios.find(s=>s.id==='recorded')!.yieldKgHa<baseline.yieldKgHa);
 assert.ok(planSeason(dry).growth!.scenarios.find(s=>s.id==='recorded')!.yieldKgHa<baseline.yieldKgHa);
 c.sowingPlan={version:'sowing-input-1',geometryId:JSON.stringify(c.parcelGeometry),cropId:'maize',areaM2:c.areaM2!/2,seedRateKgHa:null,source:'Half area software test'};
 const half=planSeason(c).growth!.scenarios.find(s=>s.id==='recorded')!;assert.equal(half.yieldKgHa,baseline.yieldKgHa);assert.ok(Math.abs(half.productionKg-baseline.productionKg/2)<1e-8);
});
test('missing weather, unaccepted assumptions and unsupported domains give actionable blocks, never replacement tonnes',()=>{
 for(const [mutate,reason] of [
  [(c:SeasonalConfig)=>{c.weather=c.weather.map(w=>({...w,radiationMj:null}));},/Rayonnement/],
  [(c:SeasonalConfig)=>{c.inputPolicy!.allowAssumptions=false;},/hypothèses/],
  [(c:SeasonalConfig)=>{c.waterCondition='waterlogged';},/drainé/],
  [(c:SeasonalConfig)=>{c.cropProfile={...c.cropProfile!,id:'sorghum'};c.crop=cropById('sorghum')!.name;},/profil automatique/],
  [(c:SeasonalConfig)=>{c.asOfDate='2026-11-23';c.weather=[];},/Actualisez/],
 ] as const){const c=automaticYieldFixture();mutate(c);const p=planSeason(c);assert.equal(p.automaticYield!.status,'blocked');assert.match(p.automaticYield!.missing.join(' '),reason);assert.ok(!p.growth||p.growth.status==='unavailable');}
});
test('disabled automatic calculation and explicit expert models preserve their configured behaviour',()=>{
 const c=automaticYieldFixture();c.automaticYield!.enabled=false;assert.equal(planSeason(c).automaticYield,undefined);assert.equal(planSeason(c).growth,undefined);
 c.automaticYield!.enabled=true;c.growth=growthTemplate(c);c.growth.parameters.harvestIndex=.3;
 const p=planSeason(c);assert.equal(p.automaticYield,undefined);assert.ok(p.growth!.scenarios.every(s=>Math.abs(s.yieldDryKgHa-s.biomassKgHa*.3)<1e-7));
 assert.throws(()=>validateConfig({...c,automaticYield:{version:'bad',enabled:true}}),/automatique/);
});
