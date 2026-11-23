import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldImagePeriod,fieldImageSummary,fieldNdviColor} from '../lib/seasonal/field-analysis.ts';
import {loadUsableFieldImage,fieldImageFailureMessage} from '../lib/seasonal/field-image-loader.ts';
import {fieldObservationFixture} from './support/field-zones-fixture.ts';
import {zoneGrid} from '../lib/seasonal/field-zones.ts';

test('default search covers recent sowing and keeps a past campaign in its actual period',()=>{
 const c=fieldObservationFixture();assert.ok(fieldImagePeriod(c).from<c.asOfDate,'A single archived date must not shrink the next search to one day');delete c.fieldMonitoring;c.asOfDate='2026-11-16';c.sowingDate=c.asOfDate;
 assert.deepEqual(fieldImagePeriod(c),{from:'2026-08-18',to:'2026-11-16'});
 c.sowingDate='2024-07-01';const period=fieldImagePeriod(c);assert.equal(period.from,'2024-07-01');assert.ok(period.to>='2024-10-01'&&period.to<'2025-01-01');
});
test('automatic loading measures each parcel, skips cloudy or failed acquisitions and retains the usable date',async()=>{
 const c=fieldObservationFixture(),clear=c.fieldMonitoring!.currentObservation!,cloudy=structuredClone(clear);cloudy.cells=[];cloudy.scenes[0].clearFraction=0;
 const visited:string[]=[],retained:{date:string;usable:boolean}[]=[];
 const result=await loadUsableFieldImage(c.parcelGeometry,['2024-10-09','2024-10-19','2024-10-29'],{signal:new AbortController().signal,
  reader:async(_g,s)=>{const day=(s as {startDate:string}).startDate;visited.push(day);if(day==='2024-10-29')throw new Error('Realistic unavailable acquisition');const r=structuredClone(day==='2024-10-19'?cloudy:clear);r.season.startDate=day;r.season.endDate=day;r.scenes[0].date=day;return r;},
  onRead:(r,usable)=>retained.push({date:r.season.startDate,usable})});
 assert.deepEqual(visited,['2024-10-29','2024-10-19','2024-10-09']);assert.equal(result.read?.season.startDate,'2024-10-09');
 assert.deepEqual(retained,[{date:'2024-10-19',usable:false},{date:'2024-10-09',usable:true}]);assert.equal(result.issues.length,2);
});
test('a cloudy run is searched beyond six dates without fabricating a clear image',async()=>{
 const c=fieldObservationFixture(),cloudy=structuredClone(c.fieldMonitoring!.currentObservation!);cloudy.cells=[];cloudy.scenes[0].clearFraction=0;let calls=0;
 const r=await loadUsableFieldImage(c.parcelGeometry,Array.from({length:10},(_,i)=>'2024-10-'+String(i+1).padStart(2,'0')),{signal:new AbortController().signal,reader:async()=>{calls++;return cloudy;},onRead:()=>{}});
 assert.equal(calls,10);assert.equal(r.read,null);assert.equal(r.attempts,10);assert.equal(fieldImageSummary(zoneGrid(c.parcelGeometry),cloudy).mean,null);
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(()=>loadUsableFieldImage(c.parcelGeometry,['2024-10-19'],{signal:ctrl.signal,onRead:()=>assert.fail('No result after cancellation')}),{name:'AbortError'});
});
test('the seventh date recovers a field above 80%, while a 70% recent image does not stop the search',async()=>{
 const c=fieldObservationFixture(),clear=c.fieldMonitoring!.currentObservation!,visited:string[]=[],retained:boolean[]=[];
 const days=Array.from({length:8},(_,i)=>'2024-10-'+String(i+1).padStart(2,'0'));
 const r=await loadUsableFieldImage(c.parcelGeometry,days,{signal:new AbortController().signal,reader:async(_g,s)=>{
  const day=(s as {startDate:string}).startDate,r=structuredClone(clear);visited.push(day);r.season.startDate=r.season.endDate=r.scenes[0].date=day;
  if(day!=='2024-10-02'){r.cells=[];r.scenes[0].clearFraction=0;}
  if(day==='2024-10-08'){r.cells=clear.cells;r.scenes[0].clearFraction=.7;}
  return r;
 },onRead:(_r,usable)=>retained.push(usable)});
 assert.equal(visited.length,8);assert.equal(r.read?.season.startDate,'2024-10-02');assert.equal(r.targetCoverage,.8);assert.deepEqual(retained,[false,false,false,false,false,false,true,false]);
});
test('every date is inspected beyond the former 36-date limit',async()=>{
 const c=fieldObservationFixture(),cloudy=structuredClone(c.fieldMonitoring!.currentObservation!);cloudy.cells=[];cloudy.scenes[0].clearFraction=0;
 const days=Array.from({length:40},(_,i)=>new Date(Date.parse('2024-01-01')+i*86400000).toISOString().slice(0,10));
 const r=await loadUsableFieldImage(c.parcelGeometry,days,{signal:new AbortController().signal,reader:async()=>cloudy,onRead:()=>{}});
 assert.equal(r.attempts,40);assert.equal(r.remainingDates,0);assert.equal(r.checks.length,40);
});
test('NDVI palette has distinct visible endpoints and a stable colour for homogeneous fields',()=>{
 assert.equal(fieldNdviColor(.3,.3,.3),fieldNdviColor(0,-1,1));
 assert.notEqual(fieldNdviColor(.4,.4,.7),fieldNdviColor(.7,.4,.7));
 assert.equal(fieldNdviColor(-2,-1,1),fieldNdviColor(-1,-1,1));
});
test('six failed pixel reads never claim that six cloudy images were assessed',async()=>{
 const c=fieldObservationFixture(),r=await loadUsableFieldImage(c.parcelGeometry,Array.from({length:6},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0')),{signal:new AbortController().signal,reader:async()=>{throw new Error('Lecture des pixels impossible : HTTP 403');},onRead:()=>assert.fail('No fabricated observations')});
 assert.equal(r.read,null);assert.equal(r.readFailures,6);assert.equal(r.evaluated,0);const message=fieldImageFailureMessage(r);assert.match(message,/lecture des pixels a échoué/);assert.match(message,/n’a pas pu être évaluée/);assert.doesNotMatch(message,/Aucune image suffisamment claire/);
});
