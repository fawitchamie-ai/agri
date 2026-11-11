import test from 'node:test';import assert from 'node:assert/strict';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {canopyNowcastScope,CANOPY_NOWCAST_PROFILE as profile} from '../lib/seasonal/canopy-nowcast.ts';
import {planSeason} from '../lib/seasonal/yield.ts';import {validateConfig} from '../lib/seasonal/validation.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {landFixture} from './support/land-fixtures.mjs';
import {canopyFixture as fixture} from './support/canopy-fixture.ts';
test('observed canopy produces a separate native-grain nowcast and production on declared terrestrial area',()=>{
 const c=fixture(),p=planSeason(c),r=p.canopyNowcast!;assert.equal(r.status,'experimental_nowcast',JSON.stringify(r.missing));
 const expected=profile.coefficients.interceptKgHa+profile.coefficients.slopeKgHaPerLai*1.5;
 assert.ok(Math.abs(r.yieldKgHa!-expected)<1e-8);assert.ok(Math.abs(r.productionKg!-expected*.1)<1e-8);
 assert.equal(r.moisturePercent,null);assert.equal(r.forecastValidated,false);assert.equal(r.test.coverage90,.7);
});
test('water edits cannot masquerade as causal effects in the canopy-only statistical nowcast',()=>{
 const c=fixture(),before=planSeason(c).canopyNowcast;
 c.fallback={label:'Synthetic dry alternative',rainMmDay:0,et0MmDay:9};
 assert.equal(planSeason(c).canopyNowcast!.yieldKgHa,before!.yieldKgHa);
});
test('future and late-available observations are excluded rather than used to improve a past issue',()=>{
 const c=fixture();c.asOfDate='2026-11-13';c.canopyNowcast!.observations.push({date:'2026-11-12',availableOn:'2026-11-12',laiSamples:[5,5,5],method:'field-green-lai',source:'Later sample must not leak'});
 const r=planSeason(c).canopyNowcast!;assert.equal(r.status,'experimental_nowcast');assert.ok(Math.abs(r.peakLai!-1.5)<1e-12);assert.equal(r.laterVisitsExcluded,1);
 c.canopyNowcast!.observations[1].availableOn='2026-11-13';assert.equal(planSeason(c).canopyNowcast!.status,'unavailable');
 c.canopyNowcast!.observations[1].date='2026-11-14';assert.throws(()=>validateConfig(c),/futur|indisponible/);
});
test('other countries, unsupported LAI, an old contour and preseason timing cannot activate this local profile',()=>{
 for(const country of ['TGO','BEN','BFA','CIV','SEN'] as const){const c=fixture();c.country=country;c.canopyNowcast!.scope=canopyNowcastScope(c);assert.equal(planSeason(c).canopyNowcast!.status,'unavailable');}
 const c=fixture();c.canopyNowcast!.observations[1].laiSamples=[8,8,8];assert.equal(planSeason(c).canopyNowcast!.status,'unavailable');
 c.canopyNowcast!.observations[1].laiSamples=[1,1,1];c.canopyNowcast!.scope='old';assert.equal(planSeason(c).canopyNowcast!.status,'unavailable');
 c.canopyNowcast!.scope=canopyNowcastScope(c);c.asOfDate='2026-11-05';assert.equal(planSeason(c).canopyNowcast!.status,'unavailable');
});
test('duplicate visits, NDVI substitution, bad units and a window beyond maturity fail explicitly',()=>{
 const c=fixture();c.canopyNowcast!.observations.push({...c.canopyNowcast!.observations[0]});assert.throws(()=>validateConfig(c),/visite/);
 c.canopyNowcast!.observations.pop();(c.canopyNowcast!.observations[0] as any).method='NDVI';assert.throws(()=>validateConfig(c),/LAI/);
 c.canopyNowcast!.observations[0].method='field-green-lai';c.canopyNowcast!.observations[0].laiSamples=[1,1,NaN];assert.throws(()=>validateConfig(c),/LAI/);
 c.canopyNowcast!.observations[0].laiSamples=[1,1,1];c.canopyNowcast!.monitoringStart='2026-12-25';assert.throws(()=>validateConfig(c),/cycle|futur/);
});
