import test from 'node:test';
import assert from 'node:assert/strict';
import {readSatelliteVisual,reflectanceChannel,SCL_PALETTE} from '../lib/seasonal/satellite-visual.ts';
import {fieldNdviColor} from '../lib/seasonal/field-analysis.ts';
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


test('dated NDVI and contrast use aligned native 10 m B04/B08 pixels',async()=>{
 const square=(w:number,s:number,e:number,n:number)=>({type:'Polygon' as const,coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]] as [number,number][][]});
 const cellA={id:'a',geometry:square(1.2,9.4,1.20009,9.40009),value:3000};
 const cellB={id:'b',geometry:square(1.20009,9.4,1.20018,9.40009),value:5000};
 const nirA={...cellA,value:6000},nirB={...cellB,value:8000};
 const sclCell={id:'scl',geometry:square(1.1999,9.3999,1.2003,9.4003),value:4};
 const reader:typeof readRasterWindow=async url=>url.includes('/B04.tif')
  ?{crs:'EPSG:32631',resolutionM:10,cells:[cellA,cellB]}
  :url.includes('/B08.tif')
   ?{crs:'EPSG:32631',resolutionM:10,cells:[nirA,nirB]}
   :{crs:'EPSG:32631',resolutionM:20,cells:[sclCell]};
 const ndvi=await readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','ndvi',fetcher,new AbortController().signal,reader);
 const contrast=await readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','contrast',fetcher,new AbortController().signal,reader);
 const expected=[(.5-.2)/(.5+.2),(.7-.4)/(.7+.4)];
 assert.equal(ndvi.resolutionM,10);assert.equal(contrast.resolutionM,10);
 assert.equal(ndvi.pixels.length,2);assert.equal(contrast.pixels.length,2);
 assert.deepEqual(ndvi.valueRange,[-1,1]);
 assert.ok(Math.abs(ndvi.pixels[0].value-expected[0])<1e-9);
 assert.ok(Math.abs(ndvi.pixels[1].value-expected[1])<1e-9);
 const minimum=Math.min(...expected),maximum=Math.max(...expected);
 assert.ok(Math.abs(contrast.valueRange[0]-minimum)<1e-9);
 assert.ok(Math.abs(contrast.valueRange[1]-maximum)<1e-9);
 assert.equal(contrast.pixels[0].color,fieldNdviColor(expected[0],minimum,maximum));
 assert.equal(contrast.pixels[1].color,fieldNdviColor(expected[1],minimum,maximum));
 const coarseReader:typeof readRasterWindow=async url=>({...await reader(url),resolutionM:url.includes('/B04.tif')?20:10});
 await assert.rejects(()=>readSatelliteVisual([1.2,9.4,1.2001,9.4001],'2024-10-19','contrast',fetcher,new AbortController().signal,coarseReader),/doivent être à 10 m/);
});
