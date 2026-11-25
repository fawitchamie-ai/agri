import test from 'node:test';import assert from 'node:assert/strict';
import {fieldZonesFixture,fieldObservationFixture} from './support/field-zones-fixture.ts';
import {addFieldNote,fieldNotes} from '../lib/seasonal/field-intelligence.ts';
import {dayAfter} from '../lib/seasonal/field-analysis.ts';
import {localFetch,setIdentity,closeHarness} from './support/local-route-harness.mjs';

test('historical observations and dose scenarios persist in immutable campaign revisions, with account isolation and consent gates',async()=>{try{
 setIdentity({userId:'zones-owner',email:'zones@example.test',displayName:'Zones owner'});
 let config=fieldZonesFixture();config.country='NGA';
 config.fieldMonitoring.currentObservation=fieldObservationFixture().fieldMonitoring.currentObservation;config.fieldMonitoring.datedObservations=[config.fieldMonitoring.currentObservation];
 config.fieldMonitoring.imagerySearch={from:config.asOfDate,to:config.asOfDate,retrievedOn:config.asOfDate,complete:true,officialVerified:true,sources:['Copernicus Data Space'],warnings:[],entries:[{date:config.asOfDate,status:'usable',itemId:config.fieldMonitoring.currentObservation.scenes[0].itemId,clearFraction:1,gridCoverage:1,cells:30,ndviMean:.5}]};
 config.fieldMonitoring.currentObservation.scenes[0].mask={clear:1,cloud:0,shadow:0,water:0,uncertain:0,noData:0,other:0};
 const {fieldMonitoringScope}=await import('../lib/seasonal/field-zones.ts');config.fieldMonitoring.scope=fieldMonitoringScope(config);
 const request=async body=>{const r=await localFetch('https://agri.test/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://agri.test'},body:JSON.stringify(body)});return {r,data:await r.json()};};
 const denied=await request({action:'field-zone-season',geometry:config.parcelGeometry,season:config.fieldMonitoring.seasons[0].season});assert.equal(denied.r.status,400);
 config=addFieldNote(config,{parameter:'Levée',date:config.asOfDate,note:'Ancienne note sans coordonnées',observer:'Auteur test'});
 const save=await request({action:'save',id:'zones-test',expectedRevision:0,config,events:[]});assert.ok(save.r.ok,JSON.stringify(save.data));assert.equal(save.data.campaign.config.fieldMonitoring.seasons.length,4);assert.equal(save.data.campaign.config.country,'NGA');
 assert.equal(save.data.campaign.config.fieldMonitoring.datedObservations[0].scenes[0].date,config.asOfDate);
 assert.equal(save.data.campaign.config.fieldMonitoring.datedObservations[0].scenes[0].mask.clear,1);assert.equal(save.data.campaign.config.fieldMonitoring.imagerySearch.entries[0].status,'usable');
 config.fieldMonitoring.prescription={kind:'seeds',product:'Synthetic maize',unit:'seeds/ha',baseline:50000,rates:{low:40000,medium:50000,high:60000},reference:'Synthetic test protocol',confirmed:true};
 const dates=[dayAfter(config.asOfDate,-5),config.asOfDate];
 const visit={campaignId:'zones-test',dates,zone:{id:'ndvi-0',cellIds:[0,1],areaM2:650,gridM:20},
  planned:[1.2001,9.4001],observed:[1.20011,9.40012],outcome:'difference'};
 config=addFieldNote(config,{parameter:'Visite terrain',date:config.asOfDate,note:'Visite de contrôle',observer:'Auteur test',visit});
 config.fieldMonitoring.cropContext={cropId:'maize',sowingDate:dayAfter(config.asOfDate,-15)};
 const next=await request({action:'save',id:'zones-test',expectedRevision:1,config,events:[]});assert.ok(next.r.ok,JSON.stringify(next.data));assert.equal(next.data.campaign.config.fieldMonitoring.prescription.unit,'seeds/ha');
 const reopened=await localFetch('https://agri.test/api/seasonal?id=zones-test');
 assert.equal(reopened.status,200);
 const loaded=(await reopened.json()).campaign.config;
 assert.deepEqual(fieldNotes(loaded).map(note=>note.visit),[undefined,visit]);assert.deepEqual(loaded.fieldMonitoring.cropContext,config.fieldMonitoring.cropContext);
 const old=await localFetch('https://agri.test/api/seasonal?id=zones-test&revision=1'),oldConfig=(await old.json()).config;
 assert.equal(oldConfig.fieldMonitoring.prescription,undefined);
 assert.equal(fieldNotes(oldConfig).length,1);assert.equal(fieldNotes(oldConfig)[0].value,'Ancienne note sans coordonnées');
 setIdentity({userId:'other-zones',email:'other@example.test',displayName:'Other'});assert.equal((await localFetch('https://agri.test/api/seasonal?id=zones-test')).status,404);
 }finally{closeHarness();}});
