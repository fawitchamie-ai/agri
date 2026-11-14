import test from 'node:test';
import assert from 'node:assert/strict';
import {SATELLITE_INDEX_VERSION,satelliteMonitoringScope} from '../lib/seasonal/satellite.ts';
import {satelliteIndexSeries,sentinelAssetUrl,vegetationIndices} from '../lib/seasonal/satellite-index.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {validateConfig} from '../lib/seasonal/validation.ts';
import type {RasterWindow} from '../lib/seasonal/raster.ts';
import type {ParcelPolygon,Position} from '../lib/seasonal/parcel.ts';
import type {RasterCell} from '../lib/seasonal/land.ts';
import {readRasterWindow} from '../lib/seasonal/raster.ts';

const today=new Date().toISOString().slice(0,10);
const shape:ParcelPolygon={type:'Polygon',coordinates:[[[1,8],[1.002,8],[1.002,8.002],[1,8.002],[1,8]]]};
function cell(id:string,ring:Position[],value:number|null):RasterCell{return {id,value,geometry:{type:'Polygon',coordinates:[[...ring,ring[0]]]}};}
function blueRedNir(value:number){const cells:RasterCell[]=[];let i=0;for(let y=0;y<2;y++)for(let x=0;x<5;x++){const lon=1.0001+x*.0001,lat=8.0001+y*.0001;cells.push(cell(String(i++),[[lon,lat],[lon+.0001,lat],[lon+.0001,lat+.0001],[lon,lat+.0001]],value));}return cells;}

test('NDVI and EVI use reflectance units, including declared scale and offset',()=>{
 const raw=vegetationIndices(1000,2000,6000),scaled=vegetationIndices(1000,2000,6000,{blue:{scale:.0001,offset:0,light:1},red:{scale:.0001,offset:0,light:1},nir:{scale:.0001,offset:0,light:1}});
 assert.ok(Math.abs(raw.ndvi!-.5)<1e-12);assert.ok(Math.abs(raw.evi!-2.5*4000/20500)<1e-12);assert.ok(Math.abs(raw.evi!-scaled.evi!)<1e-12);
 assert.deepEqual(vegetationIndices(0,0,0),{ndvi:null,evi:null});
});

test('Sentinel assets are restricted to trusted public COG buckets',()=>{
 assert.equal(sentinelAssetUrl('s3://deafrica-sentinel-2/sentinel-s2-l2a-cogs/34/K/AB/2026/1/scene/B04.tif'),'https://deafrica-sentinel-2.s3.af-south-1.amazonaws.com/sentinel-s2-l2a-cogs/34/K/AB/2026/1/scene/B04.tif');
 assert.equal(sentinelAssetUrl('https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/P/YR/2021/9/scene/B04.tif'),'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/P/YR/2021/9/scene/B04.tif');
 assert.throws(()=>sentinelAssetUrl('https://evil.example/sentinel-s2-l2a-cogs/x.tif'),/autorisé/);
 assert.throws(()=>sentinelAssetUrl('s3://another-bucket/sentinel-s2-l2a-cogs/x.tif'),/autorisé/);
});

test('parcel series masks cloudy pixels, reports per-field coverage, and stores only aggregate measurements',async()=>{
 const assets=Object.fromEntries(['B02','B04','B08','SCL'].map(name=>[name,{href:`s3://deafrica-sentinel-2/sentinel-s2-l2a-cogs/34/K/AB/2026/1/scene/${name}.tif`} ]));
 const fetcher=(async()=>Response.json({features:[{id:'scene-1',properties:{datetime:`${today}T10:12:00Z`,'eo:cloud_cover':92},assets}]}) as Response) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>{
  const isScl=url.endsWith('/SCL.tif');
  const cells=isScl?[cell('scl',[[1,8],[1.002,8],[1.002,8.002],[1,8.002]],4)]:blueRedNir(url.endsWith('/B02.tif')?1000:url.endsWith('/B04.tif')?2000:6000);
  return {cells,resolutionM:isScl?20:10,crs:'EPSG:6933'} as RasterWindow;
 };
 const result=await satelliteIndexSeries(shape,today,today,fetcher,reader,1);
 assert.equal(result.version,SATELLITE_INDEX_VERSION);assert.equal(result.observations.length,1);
 const observation=result.observations[0];assert.equal(observation.validPixels,10);assert.equal(observation.parcelPixels,10);assert.equal(observation.clearFraction,1);assert.equal(observation.quality,'usable');assert.equal(observation.sceneCloudPercent,92);assert.ok(Math.abs(observation.ndviMedian!-.5)<1e-12);assert.ok(observation.itemId==='scene-1');
 const c=exampleCampaign(today);c.parcelGeometry=shape;c.satelliteMonitoring={version:result.version,scope:'',source:result.source,retrievedOn:result.retrievedOn,observations:result.observations};c.satelliteMonitoring.scope=satelliteMonitoringScope(c);
 assert.equal(validateConfig(c).satelliteMonitoring?.observations[0].validPixels,10);
 assert.equal(c.satelliteMonitoring.scope,satelliteMonitoringScope(c));
 assert.notEqual(c.satelliteMonitoring.scope,satelliteMonitoringScope({...c,crop:'another crop'}));
});

test('cloud and shadow classes do not become clear vegetation measurements',async()=>{
 const assets=Object.fromEntries(['B02','B04','B08','SCL'].map(name=>[name,{href:`s3://deafrica-sentinel-2/sentinel-s2-l2a-cogs/34/K/AB/2026/1/scene/${name}.tif`} ]));
 const fetcher=(async()=>Response.json({features:[{id:'scene-cloudy',properties:{datetime:`${today}T10:12:00Z`},assets}]}) as Response) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({cells:url.endsWith('/SCL.tif')?[cell('cloud',[[1,8],[1.002,8],[1.002,8.002],[1,8.002]],8)]:blueRedNir(2000),resolutionM:10,crs:'EPSG:6933'} as RasterWindow);
 const result=await satelliteIndexSeries(shape,today,today,fetcher,reader),observation=result.observations[0];
 assert.equal(observation.validPixels,0);assert.equal(observation.clearFraction,0);assert.equal(observation.quality,'too-few-pixels');assert.equal(observation.ndviMedian,null);assert.equal(observation.eviMedian,null);
});

test('a blocked Digital Earth Africa catalogue falls back to Earth Search assets',async()=>{
 let calls=0;
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;const url=String(input);
  if(url.includes('explorer.digitalearth.africa'))return new Response('forbidden',{status:403});
  assert.ok(url.startsWith('https://earth-search.aws.element84.com/v1/search'));assert.equal(init?.method,'POST');
  const assets=Object.fromEntries([['blue','B02'],['red','B04'],['nir','B08'],['scl','SCL']].map(([name,band])=>[name,{href:`https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/31/P/BL/${today.replaceAll('-','/')}/S2B_test/${band}.tif`}]));
  return Response.json({features:[{id:'earth-search-scene',properties:{datetime:`${today}T10:00:00Z`},assets}]});
 }) as typeof fetch;
 const reader:typeof readRasterWindow=async(url)=>({cells:url.endsWith('/SCL.tif')?[cell('scl',[[1,8],[1.002,8],[1.002,8.002],[1,8.002]],4)]:blueRedNir(url.endsWith('/B02.tif')?1000:url.endsWith('/B04.tif')?2000:6000),resolutionM:10,crs:'EPSG:6933'} as RasterWindow);
 const result=await satelliteIndexSeries(shape,today,today,fetcher,reader,1);
 assert.equal(calls,2);assert.ok(result.source.startsWith('Earth Search STAC'));assert.equal(result.observations[0].itemId,'earth-search-scene');assert.equal(result.observations[0].quality,'usable');
});
