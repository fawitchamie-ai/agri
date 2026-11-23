import test from 'node:test';import assert from 'node:assert/strict';
import {fieldZonesFixture} from './support/field-zones-fixture.ts';
import {zoneGrid} from '../lib/seasonal/field-zones.ts';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {readRasterWindow} from '../lib/seasonal/raster.ts';
import type {ParcelPolygon} from '../lib/seasonal/parcel.ts';

test('historical reads use native C1 assets, actual dates and cloud masks without making crop or harvest labels',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season={...c.fieldMonitoring!.seasons[0].season,cropId:'unknown',comparable:false};let queries=0;
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  queries++;const u=String(input);
  if(u.includes('digitalearth.africa'))return new Response('unavailable',{status:503});
  assert.deepEqual(JSON.parse(String(init?.body)).collections,['sentinel-2-c1-l2a']);
  return Response.json({features:['06-15','07-15'].map(day=>({id:'controlled-'+day,properties:{datetime:season.startDate.slice(0,4)+'-'+day+'T10:00:00Z','eo:cloud_cover':90},assets:Object.fromEntries(['red','nir','scl'].map(band=>[band,{href:'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/'+band+'.tif','raster:bands':band==='scl'?[]:[{scale:.0001,offset:-.1}]}]))}))});
 }) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({resolutionM:20,crs:'EPSG:4326',cells:g.cells.map((p,i)=>({id:String(i),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('scl.tif')?(i%4===0?8:4):url.endsWith('red.tif')?3000:7000}))});
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);
 assert.equal(queries,2);assert.equal(r.season.cropId,'unknown');assert.equal(r.season.comparable,false);assert.equal(r.scenes.length,2);
 assert.ok(r.cells.length<g.cells.length);assert.ok(r.cells.length>g.cells.length*.6);
 assert.ok(r.cells.every(v=>v[2]===2&&Math.abs(v[1]-.5)<1e-6));assert.ok(r.scenes.every(s=>s.clearFraction<1));
 assert.ok(r.source.includes('Collection 1'));assert.equal(r.issues.length,0);
});
test('a wholly cloudy historical scene records its date while all vegetation cells stay absent',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;
 const assets=Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/'+b+'.tif','raster:bands':[{scale:.0001,offset:-.1}]}]));
 const fetcher=(async()=>Response.json({features:[{id:'all-cloud',properties:{datetime:season.startDate+'T00:00:00Z'},assets}]})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({resolutionM:20,crs:'EPSG:4326',cells:g.cells.map(p=>({id:String(p.id),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('scl.tif')?9:6000}))});
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);assert.equal(r.cells.length,0);assert.equal(r.scenes[0].clearFraction,0);
});
test('starts with two dates and avoids reading extra scenes when coverage is already sufficient',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;let reads=0;
 const dates=Array.from({length:8},(_,i)=>new Date(Date.parse(season.startDate+'T00:00:00Z')+i*7*86400000).toISOString().slice(0,10));
 const features=dates.map(date=>({id:date,properties:{datetime:date+'T10:00:00Z','eo:cloud_cover':10},assets:Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/${date}/${b}.tif`,'raster:bands':b==='scl'?[]:[{scale:.0001,offset:-.1}]}]))}));
 const fetcher=(async()=>Response.json({features})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>{reads++;return {resolutionM:20,crs:'EPSG:4326',cells:g.cells.map((p,i)=>({id:String(i),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('/scl.tif')?4:url.endsWith('/red.tif')?3000:7000}))};};
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);
 assert.equal(r.scenes.length,2);assert.equal(reads,6);assert.equal(r.cells.length,g.cells.length);assert.ok(r.cells.every(v=>v[2]===2));
});
test('caps each Cloudflare request at three scenes even when the field stays cloudy',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;let reads=0;
 const dates=Array.from({length:4},(_,i)=>new Date(Date.parse(season.startDate+'T00:00:00Z')+i*14*86400000).toISOString().slice(0,10));
 const features=dates.map((date,i)=>({id:date,properties:{datetime:date+'T10:00:00Z','eo:cloud_cover':i===0||i===2?0:20},assets:Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/${date}/${b}.tif`,'raster:bands':b==='scl'?[]:[{scale:.0001,offset:-.1}]}]))}));
 const fetcher=(async()=>Response.json({features})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>{reads++;return {resolutionM:20,crs:'EPSG:4326',cells:g.cells.map((p,i)=>({id:String(i),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('/scl.tif')?9:url.endsWith('/red.tif')?3000:7000}))};};
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);
 assert.equal(r.scenes.length,3);assert.equal(reads,3,'Opaque scenes only download their masks');assert.equal(r.cells.length,0);assert.ok(r.scenes.every(s=>s.mask!.cloud>.99));
});
test('one fallback restores two-date coverage without reading a fourth acquisition',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;let reads=0;
 const dates=Array.from({length:4},(_,i)=>new Date(Date.parse(season.startDate+'T00:00:00Z')+i*14*86400000).toISOString().slice(0,10));
 const features=dates.map((date,i)=>({id:date,properties:{datetime:date+'T10:00:00Z','eo:cloud_cover':i===0||i===2?0:20},assets:Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/${date}/${b}.tif`,'raster:bands':b==='scl'?[]:[{scale:.0001,offset:-.1}]}]))}));
 const fetcher=(async()=>Response.json({features})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>{reads++;const date=dates.find(d=>url.includes(d));return {resolutionM:20,crs:'EPSG:4326',cells:g.cells.map((p,i)=>({id:String(i),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('/scl.tif')?date===dates[2]?9:4:url.endsWith('/red.tif')?3000:7000}))};};
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);
 assert.equal(r.scenes.length,3);assert.equal(reads,7);assert.equal(r.cells.length,g.cells.length);assert.ok(r.cells.every(v=>v[2]===2));
});
test('clips a native pixel across two interior cells without counting its full area twice',async()=>{
 const south=9.4,dy=20/111320,cos=Math.cos((south+dy/2)*Math.PI/180),west=1.2,dx=20/(111320*cos),geometry:ParcelPolygon={type:'Polygon',coordinates:[[[west,south],[west+2*dx,south],[west+2*dx,south+dy],[west,south+dy],[west,south]]]},season={id:'cross-boundary',startDate:'2022-06-01',endDate:'2022-07-01',cropId:'maize',comparable:true};
 const midX=west+dx,midY=south+dy/2,halfW=5/(111320*cos),halfH=5/111320;
 const cross:ParcelPolygon={type:'Polygon',coordinates:[[[midX-halfW,midY-halfH],[midX+halfW,midY-halfH],[midX+halfW,midY+halfH],[midX-halfW,midY+halfH],[midX-halfW,midY-halfH]]]},mask:ParcelPolygon={type:'Polygon',coordinates:[geometry.coordinates[0]]};
 const fetcher=(async()=>Response.json({features:['2022-06-10','2022-06-20'].map(date=>({id:date,properties:{datetime:date+'T10:00:00Z'},assets:Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/${date}/${b}.tif`,'raster:bands':[{scale:.0001,offset:-.1}]}]))}))})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({resolutionM:10,crs:'EPSG:4326',cells:[{id:'test-pixel',geometry:url.endsWith('/scl.tif')?mask:cross,value:url.endsWith('/scl.tif')?4:url.endsWith('/red.tif')?3000:7000}]});
 const r=await readZoneSeason(geometry,season,fetcher,reader);
 assert.ok(Math.abs(r.scenes[0].clearFraction-.125)<.001);assert.ok(Math.abs(r.scenes[1].clearFraction-.125)<.001);assert.equal(r.cells.length,0);
});
test('older imagery is accepted only with an explicitly already-applied BOA offset when C1 has no coverage',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;
 const reader:typeof readRasterWindow=async(url)=>({resolutionM:20,crs:'EPSG:4326',cells:g.cells.map(p=>({id:String(p.id),geometry:{type:'Polygon' as const,coordinates:p.geometry.coordinates[0]},value:url.endsWith('scl.tif')?4:url.endsWith('red.tif')?2000:6000}))});
 const fetcher=(verified:boolean)=>(async(input:RequestInfo|URL,init?:RequestInit)=>{
  if(String(input).includes('digitalearth.africa'))return new Response('unavailable',{status:503});
  const collection=JSON.parse(String(init?.body)).collections[0];if(collection==='sentinel-2-c1-l2a')return Response.json({features:[]});
  const assets=Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/test/'+b+'.tif','raster:bands':[{scale:.0001,offset:-.1}]}]));
  return Response.json({features:[{id:'legacy',properties:{datetime:season.startDate+'T00:00:00Z',...(verified?{'earthsearch:boa_offset_applied':true}:{})},assets}]});
 }) as typeof fetch;
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher(true),reader);assert.ok(r.cells.every(v=>Math.abs(v[1]-.5)<1e-6));assert.ok(r.source.includes('offset déjà appliqué'));
 await assert.rejects(()=>readZoneSeason(c.parcelGeometry,season,fetcher(false),reader),/radiométrie vérifiable/);
});
test('one clear native pixel cannot certify a whole 20m cell on repeated dates',async()=>{
 const c=fieldZonesFixture(),g=zoneGrid(c.parcelGeometry),season=c.fieldMonitoring!.seasons[0].season;
 const assets=Object.fromEntries(['red','nir','scl'].map(b=>[b,{href:'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/'+b+'.tif','raster:bands':[{scale:.0001,offset:-.1}]}]));
 const fetcher=(async()=>Response.json({features:['06-15','07-15'].map(d=>({id:d,properties:{datetime:season.startDate.slice(0,4)+'-'+d+'T10:00:00Z'},assets}))})) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({resolutionM:10,crs:'EPSG:4326',cells:url.endsWith('scl.tif')?[{id:'mask',geometry:c.parcelGeometry!,value:4}]:g.cells.map(p=>{
  const ring=p.geometry.coordinates[0][0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),w=Math.min(...xs),s=Math.min(...ys),e=(w+Math.max(...xs))/2,n=(s+Math.max(...ys))/2;
  return {id:String(p.id),geometry:{type:'Polygon' as const,coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]},value:url.endsWith('red.tif')?3000:7000};
 })});
 const r=await readZoneSeason(c.parcelGeometry,season,fetcher,reader);assert.equal(r.cells.length,0);assert.ok(r.scenes.every(s=>s.clearFraction<.3));
});
