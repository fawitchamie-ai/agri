import test from 'node:test';import assert from 'node:assert/strict';
import {fieldObservationFixture,fieldZonesFixture} from './support/field-zones-fixture.ts';
import {zoneGrid,parseFieldMonitoring,analyzeFieldZones,analyzeObservationZones,chooseFieldZoneMap,zonePrescription,fieldZoneMapScope,zonesGeoJson} from '../lib/seasonal/field-zones.ts';
import {fieldImageArchive,fieldImageSummary,compareFieldImages,fieldIndexEvolution,fieldWeatherEvolution,datedLineSegments,fieldEvolutionCsv,dayAfter} from '../lib/seasonal/field-analysis.ts';

test('image summaries weight clipped-cell areas and compare absolute NDVI on identical support',()=>{
 const c=fieldObservationFixture(),grid=zoneGrid(c.parcelGeometry),a=c.fieldMonitoring!.currentObservation!;
 a.cells=a.cells.map(([id,,n],i)=>[id,i<100?.4:.8,n]);const b=structuredClone(a);b.cells=b.cells.slice(0,110);
 const sum=fieldImageSummary(grid,a),expected=grid.cells.reduce((s,v,i)=>s+v.areaM2*(i<100?.4:.8),0)/grid.areaM2;
 assert.ok(Math.abs(sum.mean!-expected)<1e-12);assert.equal(sum.minimum,.4);assert.equal(sum.maximum,.8);
 const comparison=compareFieldImages(grid,a,b);assert.ok(comparison.coverage>=.6);assert.equal(comparison.delta,0,'A coverage change alone cannot create an NDVI trend');
 assert.equal(compareFieldImages(grid,a,{...b,cells:b.cells.slice(0,5)}).delta,null);
 const changed={...b,cells:b.cells.map(([id,v,n])=>[id,v+.05,n] as [number,number,number])};assert.ok(Math.abs(compareFieldImages(grid,a,changed).delta!-.05)<1e-10);
});

test('dated archives roundtrip and exclude foreign outlines, future availability, composites and duplicate dates',()=>{
 const c=fieldObservationFixture(),m=c.fieldMonitoring!,r=m.currentObservation!;
 m.datedObservations=[structuredClone(r)];assert.equal(parseFieldMonitoring(m,c)!.datedObservations!.length,1);assert.equal(fieldImageArchive(c).length,1);
 m.currentObservation={...r,retrievedOn:dayAfter(c.asOfDate,1)};m.datedObservations=[];assert.equal(fieldImageArchive(c).length,0);
 m.currentObservation={...r,geometryId:'foreign'};assert.equal(fieldImageArchive(c).length,0);
 m.currentObservation=r;m.datedObservations=[r,r];assert.throws(()=>parseFieldMonitoring(m,c),/uniques/);
 m.datedObservations=[{...r,season:{...r.season,endDate:dayAfter(r.season.startDate,1)}}];assert.equal(fieldImageArchive(c).length,1);assert.throws(()=>parseFieldMonitoring(m,c));
 m.datedObservations=Array(49).fill(r);assert.throws(()=>parseFieldMonitoring(m,c),/48/);
});

test('past weather charts preserve missing days and exclude forecasts/scenarios; heat accumulation requires an explicit base',()=>{
 const c=fieldObservationFixture(),from=dayAfter(c.asOfDate,-4),day=(n:number)=>dayAfter(from,n);
 const w=(n:number,rain:number|null,status:'observed'|'estimated'|'forecast'|'scenario'='observed')=>({date:day(n),rainMm:rain,et0Mm:null,temperatureMinC:20,temperatureMaxC:30,status,source:'SYNTHETIC SOFTWARE TEST',availableAt:c.asOfDate+'T00:00:00Z'});
 c.weather=[w(0,10),w(2,5,'estimated'),w(3,999,'forecast'),w(4,999,'scenario')];
 const noBase=fieldWeatherEvolution(c,from,c.asOfDate,null);assert.equal(noBase.rainTotal,15);assert.equal(noBase.rainDays,2);assert.equal(noBase.points[1].rainCumulative,null);assert.equal(noBase.temperatureDays,0);
 const actual=fieldWeatherEvolution(c,from,c.asOfDate,10);assert.equal(actual.gddTotal,30);assert.equal(actual.temperatureDays,2);assert.equal(actual.days,5);assert.equal(actual.points[2].rainCumulative,15);assert.equal(actual.points[3].rain,null);
 c.weather.push(w(0,10));assert.equal(fieldWeatherEvolution(c,from,c.asOfDate,10).rainTotal,5);
 const csv=fieldEvolutionCsv(c,from,c.asOfDate,10);assert.match(csv,/statistique_ndvi/);assert.match(csv,/;;;;;;/);assert.ok(csv.split('\r\n').slice(1).every(row=>row.split(';')[4]!=='999'));
});

test('index evolution rejects other campaign scopes; chart lines break across missing values and long gaps',()=>{
 const c=fieldObservationFixture(),old=structuredClone(c.fieldMonitoring!.currentObservation!);old.season.startDate=dayAfter(c.asOfDate,-5);old.season.endDate=old.season.startDate;old.scenes[0].date=old.season.startDate;c.fieldMonitoring!.datedObservations=[old];
 assert.equal(fieldIndexEvolution(c).points.length,2);c.fieldMonitoring!.scope='other-scope';assert.equal(fieldIndexEvolution(c).points.length,0);
 const p=[{date:'2026-01-01',value:.2},{date:'2026-01-06',value:.3},{date:'2026-01-11',value:null},{date:'2026-01-16',value:.5},{date:'2026-03-01',value:.7}];assert.deepEqual(datedLineSegments(p).map(s=>s.length),[2,1,1]);
});

test('observed maps support explicit doses while preserving forecast controls and invalidating stale confirmations',()=>{
 const c=fieldObservationFixture(),historical=analyzeFieldZones(c),observed=analyzeObservationZones(c)!;
 assert.equal(observed.status,'mapped');assert.equal(observed.projection,'unavailable');assert.equal(observed.backtest,null);assert.equal(chooseFieldZoneMap(historical,observed).analysis,observed);
 const input={kind:'fertilizer' as const,product:'SYNTHETIC TEST',unit:'kg/ha' as const,reference:'Synthetic test only',baseline:100,rates:{low:80,medium:100,high:120,unknown:100},confirmed:true,mapScope:fieldZoneMapScope(observed)};
 assert.ok(zonePrescription(observed,input).total>0);assert.equal(zonesGeoJson(observed,input).metadata.forecastYieldTonnes,null);assert.equal(zonesGeoJson(observed,input).metadata.observedOn,c.asOfDate);
 c.fieldMonitoring!.currentObservation!.scenes[0].date=dayAfter(c.asOfDate,-1);c.fieldMonitoring!.currentObservation!.season.startDate=dayAfter(c.asOfDate,-1);c.fieldMonitoring!.currentObservation!.season.endDate=dayAfter(c.asOfDate,-1);
 const next=analyzeObservationZones(c)!;assert.throws(()=>zonePrescription(next,input),/confirmez/);
 c.fieldMonitoring!.currentObservation!.retrievedOn=dayAfter(c.asOfDate,1);assert.equal(analyzeObservationZones(c)!.status,'insufficient');
 assert.equal(analyzeFieldZones(c).backtestAgreement,historical.backtestAgreement);
});

test('one lucky last season cannot qualify a forecast when an earlier reserved temporal control fails',()=>{
 const c=fieldZonesFixture(),seasons=c.fieldMonitoring!.seasons;
 seasons[2].cells=seasons[2].cells.map(([id,v,n])=>[id,1-v,n]);
 const a=analyzeFieldZones(c);assert.equal(a.backtestAgreement,1);assert.equal(a.temporalChecks.length,2);assert.ok(a.temporalChecks[0].agreement<.65);assert.equal(a.projection,'unavailable');
});
