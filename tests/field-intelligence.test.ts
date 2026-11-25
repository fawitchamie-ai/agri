import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldBrief,addFieldNote,fieldNotes} from '../lib/seasonal/field-intelligence.ts';
import {fieldImagePeriod} from '../lib/seasonal/field-analysis.ts';
import {fieldObservationFixture} from './support/field-zones-fixture.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {validateConfig,addDays} from '../lib/seasonal/validation.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {COUNTRIES,type SeasonalConfig} from '../lib/seasonal/types.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
function config():SeasonalConfig{
 const c=exampleCampaign('2026-11-02');
 c.parcelGeometry={type:'Polygon',coordinates:[[[.96,8.01],[.961,8.01],[.961,8.011],[.96,8.011],[.96,8.01]]]};
 const m=parcelMetrics(c.parcelGeometry);return {...c,areaM2:m.areaM2,longitude:m.point[0],latitude:m.point[1]};
}
test('calendar stage is indicative and handles boundaries and pre-sowing dates',()=>{
 const c=config();assert.equal(fieldBrief(c,null,[]).stage,'Implantation');
 c.asOfDate=addDays(c.sowingDate,20);assert.equal(fieldBrief(c,null,[]).stage,'Croissance');
 c.asOfDate=addDays(c.sowingDate,125);assert.equal(fieldBrief(c,null,[]).stage,'Fin du cycle de référence');
 c.asOfDate=addDays(c.sowingDate,-1);assert.equal(fieldBrief(c,null,[]).stage,'Semis à venir');
});
test('weather never replaces missing data with zero or treats personal scenarios as forecasts',()=>{
 const c=config();let b=fieldBrief(c,null,[]);assert.equal(b.covered,0);assert.equal(b.rain,null);
 c.weather=Array.from({length:7},(_,i)=>({date:addDays(c.asOfDate,i),rainMm:0,et0Mm:3,status:'forecast',source:'Synthetic forecast',availableAt:c.asOfDate+'T00:00:00Z'}));
 b=fieldBrief(c,null,[]);assert.equal(b.covered,7);assert.equal(b.rain,0);
 c.weather[3].status='scenario';b=fieldBrief(c,null,[]);assert.equal(b.covered,6);assert.equal(b.rain,null);assert.equal(b.weather[3].day!.status,'scenario');
 c.weather[3].status='forecast';c.weather[3].availableAt='2026-11-03T00:00:00Z';b=fieldBrief(c,null,[]);assert.equal(b.weather[3].day,null);assert.equal(b.rain,null);
 c.weather[4].status='observed';assert.equal(fieldBrief(c,null,[]).weather[4].day,null);
});
test('flooding has first priority and suppresses irrigation suggestions',()=>{
 const c=config(),p=planSeason(c);c.waterCondition='submerged';
 const b=fieldBrief(c,p,[]);assert.equal(b.actions[0].id,'flood');assert.equal(b.usable,false);assert.equal(b.result,null);assert.equal(b.actions.some(a=>a.id==='irrigate'),false);
});
test('all six countries retain field notes through server validation, without inventing a diagnosis',()=>{
 for(const country of Object.keys(COUNTRIES) as (keyof typeof COUNTRIES)[]){
  const c={...config(),country};const note={parameter:'Ravageurs',date:c.asOfDate,note:'Traces sur feuilles, à faire vérifier.',observer:'Conseiller test'};
  const next=addFieldNote(c,note),parsed=validateConfig(next);
  assert.equal(fieldNotes(parsed).length,1);assert.equal(fieldNotes(parsed)[0].source,note.observer);assert.equal(fieldNotes(parsed)[0].value,note.note);assert.equal(c.agronomic,undefined);
 }
});
test('notes reject invalid dates, future dates, missing authors, wrong contours and bounded storage overflow',()=>{
 const c=config(),n={parameter:'Levée',date:c.asOfDate,note:'Levée irrégulière au nord.',observer:'Test'};
 for(const bad of [{date:'2026-02-30'},{date:'2026-11-03'},{observer:' '},{note:' '},{parameter:'Diagnostic certain'}])assert.throws(()=>addFieldNote(c,{...n,...bad}));
 const next=addFieldNote(c,n);next.agronomic!.geometryId='old';assert.equal(fieldNotes(next).length,0);assert.throws(()=>addFieldNote(next,n));
 const full=addFieldNote(c,n);full.agronomic!.observations=Array(100).fill(full.agronomic!.observations[0]);assert.throws(()=>addFieldNote(full,n));
});
test('stale plans hide all old totals and stage calendar never becomes a measurement',()=>{
 const c=config(),p=planSeason(c);const b=fieldBrief(c,p,[],true);
 assert.equal(b.result,null);assert.equal(b.estimate,undefined);assert.equal(b.usable,false);assert.equal(b.actions.some(a=>a.id==='irrigate'),false);assert.equal(b.stage,'Implantation');
});

test('satellite review works without crop history, qualifies only usable imagery and defers to a reported emergency',()=>{
 const c=fieldObservationFixture(),read=c.fieldMonitoring!.currentObservation!;
 const latest=fieldBrief(c,null,[]).actions[0];
 assert.equal(latest.id,'satellite');assert.equal(latest.imageDate,c.asOfDate);assert.ok(latest.visibleM2!>0);
 assert.deepEqual(latest.focus?.dates,[c.asOfDate]);
 c.waterCondition='waterlogged';assert.equal(fieldBrief(c,null,[]).actions[0].id,'flood');
 c.waterCondition=undefined;read.scenes[0].clearFraction=.12;read.cells=[];
 const masked=fieldBrief(c,null,[]).actions[0];
 assert.match(masked.title,/plus claire/);assert.equal(masked.focus,undefined);
 assert.ok(Math.abs(masked.visibleM2!-c.areaM2!*.12)<1e-8);
 c.fieldMonitoring=undefined;const fresh=fieldBrief(c,null,[]).actions[0];
 assert.equal(fresh.imageDate,undefined);assert.equal(fresh.visibleM2,undefined);
 assert.equal(fieldImagePeriod(c).to,c.asOfDate);
 const old={...c,sowingDate:'2024-05-01',asOfDate:'2024-12-31'};
 assert.equal(fieldImagePeriod(old).to,addDays(old.sowingDate,old.stages.reduce((n,s)=>n+s.days,0)-1));
});

test('the primary satellite action reserves another cached date for checking recurrence',()=>{
 const c=fieldObservationFixture(),latest=c.fieldMonitoring!.currentObservation!;
 const older=(offset:number,variation:number)=>{
  const read=structuredClone(latest),date=addDays(c.asOfDate,offset);
  read.season.startDate=date;read.season.endDate=date;read.scenes[0].date=date;
  read.cells=read.cells.map(([id])=>[id,id<3?.5+variation:.5,1]);return read;
 };
 c.fieldMonitoring!.datedObservations=[older(-10,0),older(-5,-.17)];
 latest.cells=older(0,-.23).cells;
 c.fieldMonitoring!.cropContext={cropId:'maize',sowingDate:addDays(c.asOfDate,-12)};
 const action=fieldBrief(c,null,[]).actions[0];
 assert.equal(action.title,'Vérifier la zone où l’écart se répète');
 assert.deepEqual(action.focus?.dates,[addDays(c.asOfDate,-10),c.asOfDate]);
 assert.equal(action.focus?.zone?.repeatedOn,addDays(c.asOfDate,-5));
});

test('zone and coordinates round-trip with a terrain visit and legacy notes stay readable',()=>{
 const c=config(),legacy=addFieldNote(c,{parameter:'Levée',date:c.asOfDate,note:'Ancienne note sans coordonnées',observer:'Aïcha'});
 const visit={outcome:'ordinary' as const,campaignId:'campagne-test',dates:['2026-10-19','2026-10-29'],
  zone:{id:'ndvi-0',cellIds:[0,1],gridM:20,areaM2:600},planned:[.9602,8.0102] as [number,number],
  comparison:[.9608,8.0108] as [number,number],observed:[.96021,8.01022] as [number,number]};
 const n={parameter:'Visite terrain',date:c.asOfDate,note:'',observer:'Aïcha',visit};
 const restored=validateConfig(JSON.parse(JSON.stringify(addFieldNote(legacy,n))));
 assert.deepEqual(fieldNotes(restored).map(o=>o.visit),[undefined,visit]);
 assert.equal(fieldNotes(restored)[0].value,'Ancienne note sans coordonnées');
 assert.throws(()=>addFieldNote(legacy,{...n,visit:{...visit,planned:[.95,8]}}),/invalide/);
 assert.throws(()=>addFieldNote(legacy,{...n,visit:{...visit,observed:[0,91]}}),/invalide/);
 assert.throws(()=>addFieldNote(legacy,{...n,visit:{...visit,dates:['2026-10-19','2026-11-03']}}),/invalide/);
 const free=validateConfig(addFieldNote(legacy,{...n,visit:{dates:[],outcome:'review',campaignId:'campagne-test'}}));
 assert.equal(fieldNotes(free)[1].visit?.observed,undefined);
});
