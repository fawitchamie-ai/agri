import test from 'node:test';import assert from 'node:assert/strict';
import {fieldZonesFixture} from './support/field-zones-fixture.ts';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';

test('historical observations and dose scenarios persist in immutable campaign revisions, with account isolation and consent gates',async()=>{try{
 setIdentity({userId:'zones-owner',email:'zones@example.test',displayName:'Zones owner'});
 const config=fieldZonesFixture();config.country='NGA';
 const {fieldMonitoringScope}=await import('../lib/seasonal/field-zones.ts');config.fieldMonitoring.scope=fieldMonitoringScope(config);
 const request=async body=>{const r=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});return {r,data:await r.json()};};
 const denied=await request({action:'field-zone-season',geometry:config.parcelGeometry,season:config.fieldMonitoring.seasons[0].season});assert.equal(denied.r.status,400);
 const save=await request({action:'save',id:'zones-test',expectedRevision:0,config,events:[]});assert.ok(save.r.ok,JSON.stringify(save.data));assert.equal(save.data.campaign.config.fieldMonitoring.seasons.length,4);assert.equal(save.data.campaign.config.country,'NGA');
 config.fieldMonitoring.prescription={kind:'seeds',product:'Synthetic maize',unit:'seeds/ha',baseline:50000,rates:{low:40000,medium:50000,high:60000},reference:'Synthetic test protocol',confirmed:true};
 const next=await request({action:'save',id:'zones-test',expectedRevision:1,config,events:[]});assert.ok(next.r.ok,JSON.stringify(next.data));assert.equal(next.data.campaign.config.fieldMonitoring.prescription.unit,'seeds/ha');
 const old=await localFetch('https://agri.test/api/seasonal?id=zones-test&revision=1');assert.equal((await old.json()).config.fieldMonitoring.prescription,undefined);
 setIdentity({userId:'other-zones',email:'other@example.test',displayName:'Other'});assert.equal((await localFetch('https://agri.test/api/seasonal?id=zones-test')).status,404);
 }finally{closeHarness();}});
