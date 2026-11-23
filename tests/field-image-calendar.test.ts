import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldObservationFixture} from './support/field-zones-fixture.ts';
import {parseFieldMonitoring,type FieldImageSearch} from '../lib/seasonal/field-zones.ts';
import {fieldImageChoices,fieldIndexEvolution,dayAfter} from '../lib/seasonal/field-analysis.ts';
import {loadUsableFieldImage} from '../lib/seasonal/field-image-loader.ts';
test('all qualified dates survive serialization even when their detailed grids are no longer cached',()=>{
 const c=fieldObservationFixture(),older=dayAfter(c.asOfDate,-40);
 const q:FieldImageSearch={from:older,to:c.asOfDate,retrievedOn:c.asOfDate,complete:true,officialVerified:true,sources:['Copernicus Data Space'],warnings:[],entries:[{date:older,status:'usable',itemId:'S2_OLDER',clearFraction:1,gridCoverage:1,cells:50,ndviMean:.6},{date:dayAfter(c.asOfDate,-3),status:'insufficient',clearFraction:0,reason:'Nuages'}]};
 c.fieldMonitoring!.imagerySearch=q;c.fieldMonitoring=parseFieldMonitoring(JSON.parse(JSON.stringify(c.fieldMonitoring)),c);
 const choices=fieldImageChoices(c);assert.ok(choices.some(v=>v.date===older));assert.equal(choices.length,2);assert.ok(!choices.some(v=>v.date===q.entries[1].date));
 const evolution=fieldIndexEvolution(c);assert.equal(evolution.points[0].ndvi,.6);assert.equal(evolution.points[1].ndvi,null);
 c.fieldMonitoring!.scope='other-account-or-outline';assert.equal(fieldImageChoices(c).length,0);
});
test('a forged qualified date below the target or a completed calendar with pending entries is rejected',()=>{
 const c=fieldObservationFixture(),m=c.fieldMonitoring!;
 m.imagerySearch={from:c.asOfDate,to:c.asOfDate,retrievedOn:c.asOfDate,complete:true,officialVerified:true,sources:[],warnings:[],entries:[{date:c.asOfDate,status:'usable',itemId:'x',clearFraction:.7,gridCoverage:1,cells:50}]};
 assert.throws(()=>parseFieldMonitoring(m,c),/80 %/);m.imagerySearch.entries[0]={date:c.asOfDate,status:'pending'};assert.throws(()=>parseFieldMonitoring(m,c),/incomplet/);
});
test('an exhaustive scan keeps multiple clear dates after the first success',async()=>{
 const c=fieldObservationFixture(),r=c.fieldMonitoring!.currentObservation!,days=['2024-10-04','2024-10-14','2024-10-29'],seen:string[]=[];
 const result=await loadUsableFieldImage(c.parcelGeometry,days,{signal:new AbortController().signal,reader:async(_g,s)=>{const day=(s as {startDate:string}).startDate,copy=structuredClone(r);copy.season.startDate=copy.season.endDate=copy.scenes[0].date=day;return copy;},onRead:r=>seen.push(r.season.startDate)});
 assert.equal(result.attempts,3);assert.equal(result.usableCount,3);assert.deepEqual(seen,days.toReversed());assert.equal(result.read!.season.startDate,'2024-10-29');assert.equal(result.checks.length,3);
});
test('resuming reuses verified pixels, retries read failures and detects a changed acquisition',async()=>{
 const c=fieldObservationFixture(),template=c.fieldMonitoring!.currentObservation!,days=['2024-10-04','2024-10-14','2024-10-29'],today=new Date().toISOString().slice(0,10);
 const catalog={provider:'test',dates:days,features:days.map(date=>({id:'S2_'+date,properties:{datetime:date+'T10:00:00Z',updated:'v1'}})),officialVerified:true,officialScenes:3,sources:['test'],warnings:[]};
 const cached:typeof template[]=[],seen:string[]=[];let first=true;
 const reader:Parameters<typeof loadUsableFieldImage>[2]['reader']=async(_g,s)=>{
  const day=(s as {startDate:string}).startDate;seen.push(day);
  if(first&&day===days[1])throw new Error('temporary connection failure');
  const r=structuredClone(template);r.season.startDate=r.season.endDate=r.scenes[0].date=day;r.scenes[0].itemId='S2_'+day;
  if(day===days[0]&&catalog.features[0].properties.updated==='v1'){r.cells=[];r.scenes[0].clearFraction=0;}
  return r;
 };
 const options={catalog,reader,signal:new AbortController().signal,onRead:(r:typeof template,usable:boolean)=>{if(usable)cached.push(r);}};
 const a=await loadUsableFieldImage(c.parcelGeometry,days,options);first=false;
 const previous=(entries:FieldImageSearch['entries']):FieldImageSearch=>({from:days[0],to:days.at(-1)!,retrievedOn:today,complete:true,officialVerified:true,sources:[],warnings:[],entries});
 seen.length=0;
 const b=await loadUsableFieldImage(c.parcelGeometry,days,{...options,previousSearch:previous(a.checks),cachedReads:cached});
 assert.deepEqual(seen,[days[1]]);assert.equal(b.reused,2);assert.equal(b.usableCount,2);
 seen.length=0;catalog.features[0].properties.updated='v2';
 const d=await loadUsableFieldImage(c.parcelGeometry,days,{...options,previousSearch:previous(b.checks),cachedReads:cached});
 assert.deepEqual(seen,[days[0]]);assert.equal(d.reused,2);assert.equal(d.usableCount,3);
});
