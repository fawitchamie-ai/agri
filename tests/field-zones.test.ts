import test from 'node:test';import assert from 'node:assert/strict';
import {fieldZonesFixture} from './support/field-zones-fixture.ts';
import {spatialRanks,zoneGrid,analyzeFieldZones,zonePrescription,zonesGeoJson,zonePrescriptionCsv,parseFieldMonitoring,parseZoneSeason,type ZoneDoseInput} from '../lib/seasonal/field-zones.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {multiArea} from '../lib/seasonal/land.ts';
import {reflectanceTransform,vegetationIndices,sentinelAssetUrl} from '../lib/seasonal/satellite-index.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';

test('the historical grid conserves the exact parcel area, excludes holes and does not invent finer-than-20m pixels',()=>{
 const c=fieldZonesFixture(),shape=structuredClone(c.parcelGeometry!);
 shape.coordinates.push([[1.2005,9.4005],[1.2007,9.4005],[1.2007,9.4007],[1.2005,9.4007],[1.2005,9.4005]]);
 const g=zoneGrid(shape);assert.ok(g.gridM>=20);assert.ok(g.cells.length<=3000);
 assert.ok(Math.abs(g.cells.reduce((n,p)=>n+p.areaM2,0)-parcelMetrics(shape).areaM2)<.01);
 assert.ok(Math.abs(multiArea(g.cells.flatMap(p=>p.geometry.coordinates))-g.areaM2)<.01);
});
test('equal vegetation values receive equal midranks and a uniform field is never forced into three zones',()=>{
 const ranks=spatialRanks([{id:0,value:.5,area:1},{id:1,value:.5,area:9}]);assert.equal(ranks.get(0),.5);assert.equal(ranks.get(1),.5);
 const c=fieldZonesFixture();for(const s of c.fieldMonitoring!.seasons)for(const v of s.cells)v[1]=.5;
 const a=analyzeFieldZones(c);assert.equal(a.status,'homogeneous');assert.ok(a.cells.every(p=>p.zone==='medium'));assert.equal(a.projection,'unavailable');
});
test('a stable four-year gradient produces a relative hypothesis with a withheld-last-season spatial check, never tonnes',()=>{
 const c=fieldZonesFixture(),a=analyzeFieldZones(c);assert.equal(a.projection,'relative-hypothesis');assert.equal(a.backtestAgreement,1);assert.equal(a.backtestSeason,c.fieldMonitoring!.seasons.at(-1)!.season.id);
 assert.ok(a.coverage>.999);assert.ok(a.stableFraction>.999);assert.ok(a.zones.filter(z=>z.areaM2>0).length===3);
 const out=zonesGeoJson(a);assert.equal(out.metadata.forecastYieldTonnes,null);assert.ok(out.features.every(f=>f.properties.basis==='relative_satellite_vigor_not_measured_yield'));
 assert.ok(Math.abs(out.features.reduce((n,f)=>n+multiArea(f.geometry.coordinates),0)-a.areaM2)<.01);
});
test('a reversal in the reserved latest year blocks relative projection even when the older majority is stable',()=>{
 const c=fieldZonesFixture();for(const v of c.fieldMonitoring!.seasons.at(-1)!.cells)v[1]=1-v[1];
 const a=analyzeFieldZones(c);assert.equal(a.projection,'unavailable');assert.ok(a.backtestAgreement!<.65);assert.ok(a.reasons.some(r=>r.includes('65 %')));
});
test('unknown crops and only three seasons remain descriptive; a changed scope cannot reuse another crop history',()=>{
 const c=fieldZonesFixture();c.fieldMonitoring!.seasons=c.fieldMonitoring!.seasons.slice(0,3);
 let a=analyzeFieldZones(c);assert.equal(a.status,'mapped');assert.equal(a.projection,'unavailable');assert.equal(a.backtestAgreement,null);
 c.fieldMonitoring!.seasons[0].season.cropId='unknown';a=analyzeFieldZones(c);assert.ok(a.reasons.some(r=>r.includes('même culture')));
 c.sowingDate='2030-01-01';a=analyzeFieldZones(c);assert.equal(a.reads.length,0);assert.ok(a.notes.some(r=>r.includes('ancien contour')));
});
test('coverage uses a common spatial support; missing cloudy cells are not imputed or converted to zero',()=>{
 const c=fieldZonesFixture(),seasons=c.fieldMonitoring!.seasons;
 seasons.forEach((s,i)=>{s.cells=s.cells.filter(v=>v[0]%4!==i);});
 const a=analyzeFieldZones(c);assert.ok(a.coverage<.6);assert.equal(a.status,'insufficient');assert.ok(a.cells.every(p=>p.zone==='unknown'));
 assert.equal(a.projection,'unavailable');
});
test('single clear observations and imagery acquired after the analysis date cannot qualify historical cells',()=>{
 const c=fieldZonesFixture();for(const s of c.fieldMonitoring!.seasons)for(const v of s.cells)v[2]=1;
 assert.equal(analyzeFieldZones(c).reads.length,0);
 const old=fieldZonesFixture();old.asOfDate='2020-01-01';assert.equal(analyzeFieldZones(old).reads.length,0);
});
test('duplicate years and overlapping windows cannot inflate stability or the last-year check',()=>{
 const c=fieldZonesFixture(),duplicate=structuredClone(c.fieldMonitoring!.seasons[0]);duplicate.season.id='duplicate-year';c.fieldMonitoring!.seasons.push(duplicate);
 assert.throws(()=>parseFieldMonitoring(c.fieldMonitoring,c),/une seule fenêtre/);
 const a=analyzeFieldZones(c);assert.equal(a.reads.length,3);assert.equal(a.projection,'unavailable');assert.equal(a.backtestAgreement,null);
 const other=fieldZonesFixture(),first=other.fieldMonitoring!.seasons[0],second=other.fieldMonitoring!.seasons[1],year=first.season.startDate.slice(0,4),next=second.season.startDate.slice(0,4);
 first.season.startDate=year+'-12-01';first.season.endDate=next+'-01-15';first.scenes=[];first.cells=[];
 second.season.startDate=next+'-01-01';second.season.endDate=next+'-03-01';second.scenes=[];second.cells=[];
 assert.throws(()=>parseFieldMonitoring(other.fieldMonitoring,other),/chevaucher/);
});
test('prescriptions conserve product mass and require explicit rates for every zone including unknown or variable',()=>{
 const c=fieldZonesFixture(),a=analyzeFieldZones(c),d:ZoneDoseInput={kind:'fertilizer',product:'NPK TEST',unit:'kg/ha',reference:'Synthetic advisor',baseline:100,rates:{low:80,medium:100,high:120},confirmed:true};
 const result=zonePrescription(a,d);assert.ok(Math.abs(result.total-result.rows.reduce((n,r)=>n+r.areaM2/10000*r.dose,0))<1e-9);
 assert.equal(result.totalUnit,'kg');assert.equal(zonesGeoJson(a,d).features[0].properties.status,'user_confirmed_scenario_not_automatic_optimum');
 const other=structuredClone(a);other.zones[0].id='unknown';assert.throws(()=>zonePrescription(other,d),/explicitement/);
 assert.throws(()=>zonePrescription(a,{...d,confirmed:false}),/Confirmez/);
 assert.throws(()=>zonePrescription({...a,cultivatedContour:false},d),/surface cultivée/);
 assert.throws(()=>zonePrescription(a,{...d,unit:'seeds/ha'}),/Unité/);
 const csv=zonePrescriptionCsv(a,{...d,product:'=HYPERLINK("bad")'});assert.ok(csv.includes("'=HYPERLINK"));
});
test('archives round-trip through real config validation and malformed or future metadata are rejected',()=>{
 const c=fieldZonesFixture(),validated=validateConfig(c);assert.equal(validated.fieldMonitoring!.seasons.length,4);
 const bad=structuredClone(c.fieldMonitoring!);bad.seasons[0].cells.push([...bad.seasons[0].cells[0]]);assert.throws(()=>parseFieldMonitoring(bad,c),/dupliquée/);
 assert.throws(()=>parseZoneSeason({id:'bad',startDate:'2099-01-01',endDate:'2099-02-01',cropId:'maize',comparable:true}),/Saison satellite/);
});
test('C1 transformations agree with already-offset legacy COG values and never apply the BOA offset twice',()=>{
 const asset={href:'', 'raster:bands':[{scale:.0001,offset:-.1}]};
 const legacy=reflectanceTransform(asset,{properties:{'earthsearch:boa_offset_applied':true}}),c1=reflectanceTransform(asset);
 const a=vegetationIndices(1000,2000,6000,{blue:legacy,red:legacy,nir:legacy});
 const b=vegetationIndices(2000,3000,7000,{blue:c1,red:c1,nir:c1});
 assert.ok(Math.abs(a.ndvi!-b.ndvi!)<1e-12);assert.ok(Math.abs(a.evi!-b.evi!)<1e-12);
 const dea=reflectanceTransform({'raster:bands':[{offset:-1000}]});assert.equal(dea.offset,-1000);assert.equal(dea.light,10000);
 assert.ok(sentinelAssetUrl('s3://deafrica-sentinel-2-l2a-c1/sentinel-2-c1-l2a/31/N/BH/test/red.tif').startsWith('https://deafrica-sentinel-2-l2a-c1.s3.af-south-1.amazonaws.com/'));
 assert.throws(()=>sentinelAssetUrl('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/other/red.tif'),/autorisé/);
});
