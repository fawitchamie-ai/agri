import test from 'node:test';
import assert from 'node:assert/strict';
import {bestSentinelScene,sentinelMaskCoverage} from '../lib/seasonal/sentinel-scene.ts';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {readSatelliteVisual} from '../lib/seasonal/satellite-visual.ts';
import type {readRasterWindow} from '../lib/seasonal/raster.ts';
import type {ParcelPolygon} from '../lib/seasonal/parcel.ts';
const shape:ParcelPolygon={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};
const day='2024-10-19',features=['regional-clear','parcel-clear'].map((id,i)=>({id,properties:{datetime:day+'T10:00:00Z','eo:cloud_cover':i?90:1},assets:Object.fromEntries(['B02','B03','B04','B08','SCL'].map(b=>[b,{href:`https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/${id}/${b}.tif`,'raster:bands':b==='SCL'?[]:[{scale:.0001,offset:-.1}]}]))}));
const fetcher:typeof fetch=async()=>Response.json({features});
const reader:typeof readRasterWindow=async url=>({resolutionM:url.endsWith('SCL.tif')?20:10,crs:'EPSG:4326',cells:[{id:'p',geometry:shape,value:url.endsWith('SCL.tif')?url.includes('regional-clear')?9:4:url.endsWith('B08.tif')?7000:3000}]});
test('local SCL coverage wins over a misleading scene cloud percentage',async()=>{
 const selected=await bestSentinelScene(features,shape,fetcher,new AbortController().signal,reader);
 assert.equal(selected.item.id,'parcel-clear');assert.ok(selected.mask.clear>.999);
 const r=await readZoneSeason(shape,{id:'test',startDate:day,endDate:day,cropId:'unknown',comparable:false},fetcher,reader);
 assert.equal(r.scenes[0].itemId,'parcel-clear');assert.ok(r.scenes[0].clearFraction>.999);assert.ok(r.cells.length);
});
test('RGB, classification and NDVI use the chosen acquisition, including an explicit archived item',async()=>{
 for(const layer of ['rgb','classification','ndvi','contrast'] as const){
  const image=await readSatelliteVisual([1,8,1.001,8.001],day,layer,fetcher,undefined,reader);
  assert.equal(image.itemId,'parcel-clear');assert.ok(image.pixels.length);
 }
 const cloudy=await readSatelliteVisual([1,8,1.001,8.001],day,'rgb',fetcher,undefined,reader,'regional-clear');
 assert.equal(cloudy.itemId,'regional-clear');assert.ok(cloudy.mask.cloud>.999);assert.ok(cloudy.pixels.length,'An RGB image can exist entirely above clouds');
 const masked=await readSatelliteVisual([1,8,1.001,8.001],day,'ndvi',fetcher,undefined,reader,'regional-clear');
 assert.equal(masked.itemId,'regional-clear');assert.deepEqual(masked.pixels,[]);assert.match(masked.maskReason!,/100 % de nuages/);assert.equal(masked.valueRange,null);
 await assert.rejects(()=>readSatelliteVisual([1,8,1.001,8.001],day,'rgb',fetcher,undefined,reader,'missing'),/Aucune acquisition/);
});
test('an unreadable overlapping tile falls back to a readable acquisition',async()=>{
 const fail:typeof readRasterWindow=async(...args)=>{if(args[0].includes('regional-clear'))throw new Error('Raster connection interrupted');return reader(...args);};
 const r=await bestSentinelScene(features,shape,fetcher,new AbortController().signal,fail);
 assert.equal(r.item.id,'parcel-clear');assert.equal(r.errors.length,1);
});
test('every distinct overlapping capture is checked, including the fifth candidate',async()=>{
 const candidates=Array.from({length:5},(_,i)=>({...features[0],id:'capture-'+i,assets:Object.fromEntries(Object.entries(features[0].assets).map(([b,a])=>[b,{...a,href:a.href.replace('regional-clear','capture-'+i)}]))}));
 const seen:string[]=[];
 const read:typeof readRasterWindow=async url=>{seen.push(url);return {resolutionM:20,crs:'EPSG:4326',cells:[{id:'p',geometry:shape,value:url.includes('capture-4')?4:9}]};};
 const result=await bestSentinelScene(candidates,shape,fetcher,new AbortController().signal,read);
 assert.equal(seen.length,5);assert.equal(result.item.id,'capture-4');assert.ok(result.mask.clear>.999);
});
test('holes and uncovered footprint are measured without promoting water or uncertain pixels',()=>{
 const hole:ParcelPolygon={type:'Polygon',coordinates:[shape.coordinates[0],[[1.0002,8.0002],[1.0004,8.0002],[1.0004,8.0004],[1.0002,8.0004],[1.0002,8.0002]]]};
 const empty=sentinelMaskCoverage(hole,[]);assert.equal(empty.noData,1);assert.equal(empty.clear,0);
 for(const value of [4,5,6,7,8,9,10,2,3,null]){
  const mask=sentinelMaskCoverage(hole,[{id:'p',geometry:shape,value}]);
  assert.ok(Math.abs(Object.values(mask).reduce((a,b)=>a+b,0)-1)<1e-7);
  assert.equal(mask.clear>0,value===4||value===5);
 }
});
