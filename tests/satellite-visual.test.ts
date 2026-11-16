import test from 'node:test';
import assert from 'node:assert/strict';
import {readSatelliteVisual,reflectanceChannel,SCL_PALETTE} from '../lib/seasonal/satellite-visual.ts';
import type {readRasterWindow} from '../lib/seasonal/raster.ts';
const geometry={type:'Polygon' as const,coordinates:[[[1.2,9.4],[1.2001,9.4],[1.2001,9.4001],[1.2,9.4001],[1.2,9.4]]] as [number,number][][]};
const item={id:'S2_TEST',properties:{datetime:'2024-10-19T12:00:00Z'},assets:Object.fromEntries(['B02','B03','B04','B08','SCL'].map(b=>[b,{href:'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/'+b+'.tif','raster:bands':[{scale:.0001,offset:-.1}]}]))};
const fetcher:typeof fetch=async()=>Response.json({features:[item]});
test('RGB uses matched native red/green/blue pixels and the declared C1 offset',async()=>{
 const reader:typeof readRasterWindow=async url=>({crs:'EPSG:4326',resolutionM:10,cells:[{id:'pixel',geometry,value:url.includes('B04')?2000:url.includes('B03')?2500:3000}]});
 const r=await readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','rgb',fetcher,new AbortController().signal,reader);
 assert.equal(r.pixels.length,1);assert.equal(r.itemId,'S2_TEST');assert.equal(r.pixels[0].color,`rgb(${[.1,.15,.2].map(reflectanceChannel).join(',')})`);
 const empty:typeof readRasterWindow=async()=>({crs:'EPSG:4326',resolutionM:10,cells:[]});
 await assert.rejects(()=>readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','rgb',fetcher,new AbortController().signal,empty),/sans pixels RGB/);
});
test('SCL keeps clouds visible and never converts them into a vegetation measurement',async()=>{
 const reader:typeof readRasterWindow=async()=>({crs:'EPSG:4326',resolutionM:20,cells:[{id:'cloud',geometry,value:9},{id:'cirrus',geometry,value:10},{id:'missing',geometry,value:0}]});
 const r=await readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','classification',fetcher,new AbortController().signal,reader);
 assert.deepEqual(r.pixels.map(p=>p.color),[SCL_PALETTE[9],SCL_PALETTE[10]]);assert.equal(r.pixels.length,2);
});
