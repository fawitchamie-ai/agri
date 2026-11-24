import test from 'node:test';
import assert from 'node:assert/strict';
import {writeArrayBuffer} from 'geotiff';
import {rasterWindows,readRasterWindow,MAX_NATIVE_PIXELS} from '../lib/seasonal/raster.ts';
import type {ParcelPolygon} from '../lib/seasonal/parcel.ts';
import proj4 from 'proj4';

test('Native windows cover the full rectangle once, with bounded decoder allocations',()=>{
  const seen=new Set<string>();
  for(const [x0,y0,x1,y1] of rasterWindows(7,9,157,129)){
    assert.ok((x1-x0)*(y1-y0)<=10000);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const key=`${x}:${y}`;assert.ok(!seen.has(key));seen.add(key);
    }
  }
  assert.equal(seen.size,18000);
  assert.throws(()=>rasterWindows(0,0,MAX_NATIVE_PIXELS+1,1),/16 millions de pixels/);
});

test('a projected Sentinel-style GeoTIFF preserves every 10 m pixel footprint and raw sample',async()=>{
 const width=13,height=9,east=400000,north=750000;
 proj4.defs('EPSG:32631','+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs');
 const toGeo=(p:number[])=>proj4('EPSG:32631','EPSG:4326',p) as [number,number];
 const bytes=new Uint8Array(writeArrayBuffer(Uint16Array.from({length:width*height},(_,i)=>2000+i),{width,height,BitsPerSample:[16],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32631,ModelPixelScale:[10,10,0],ModelTiepoint:[0,0,0,east,north,0]}));
 const fetcher:typeof fetch=async(_u,init)=>{const r=new Headers(init?.headers).get('range')!.match(/^bytes=(\d+)-(\d+)/)!,start=Number(r[1]),end=Math.min(Number(r[2]),bytes.length-1);return new Response(bytes.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});};
 const ring=[[east,north],[east+width*10,north],[east+width*10,north-height*10],[east,north-height*10],[east,north]].map(toGeo);
 const result=await readRasterWindow('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/test.tif',{type:'Polygon',coordinates:[ring]},fetcher);
 assert.equal(result.resolutionM,10);assert.equal(result.crs,'EPSG:32631');assert.equal(result.cells.length,width*height);
 for(const [i,c] of result.cells.entries()){
  assert.equal(c.value,2000+i);
  const p=c.geometry.coordinates[0].map(v=>proj4('EPSG:4326','EPSG:32631',v));
  assert.ok(Math.abs(p[1][0]-p[0][0]-10)<1e-6);assert.ok(Math.abs(p[2][1]-p[1][1]+10)<1e-6);
 }
});

test('WorldCover-sized contour above 10,000 pixels preserves all native values and coordinates',async()=>{
  const width=150,height=120;
  const bytes=new Uint8Array(writeArrayBuffer(Uint8Array.from({length:width*height},(_,i)=>i%251),{
    width,height,BitsPerSample:[8],GeographicTypeGeoKey:4326,
    ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,0,.012,0]
  }));
  const fetcher:typeof fetch=async(_input,options)=>{
    const range=new Headers(options?.headers).get('range')!,match=range.match(/^bytes=(\d+)-(\d+)/)!;
    const start=Number(match[1]),end=Number(match[2]),last=Math.min(end,bytes.length-1);
    return new Response(bytes.slice(start,last+1),{status:206,headers:{'content-range':`bytes ${start}-${last}/${bytes.length}`}});
  };
  const shape:ParcelPolygon={type:'Polygon',coordinates:[[[0,0],[.015,0],[.015,.012],[0,.012],[0,0]]]};
  const result=await readRasterWindow('https://esa-worldcover.s3.eu-central-1.amazonaws.com/test.tif',shape,fetcher);
  assert.equal(result.cells.length,width*height);
  const cells=new Map(result.cells.map(c=>[c.id,c]));assert.equal(cells.size,width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const c=cells.get(`${x}:${y}`)!;assert.equal(c.value,(y*width+x)%251);
    assert.ok(Math.abs(c.geometry.coordinates[0][0][0]-x*.0001)<1e-12);
    assert.ok(Math.abs(c.geometry.coordinates[0][0][1]-(.012-y*.0001))<1e-12);
  }
});

test('recovers a CORS-hidden Content-Range from the safelisted HEAD length',async()=>{
  const width=30,height=20;
  const bytes=new Uint8Array(writeArrayBuffer(Uint8Array.from({length:width*height},(_,i)=>i%251),{
    width,height,BitsPerSample:[8],GeographicTypeGeoKey:4326,
    ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,0,.002,0]
  }));
  const fetcher:typeof fetch=async(_input,options)=>{
    if(options?.method==='HEAD')return new Response(null,{status:200,headers:{'content-length':String(bytes.length)}});
    const range=new Headers(options?.headers).get('range')!,match=range.match(/^bytes=(\d+)-(\d+)/)!;
    const start=Number(match[1]),end=Number(match[2]),last=Math.min(end,bytes.length-1);
    // Browsers hide Content-Range on a CORS response unless the source exposes it.
    return new Response(bytes.slice(start,last+1),{status:206,headers:{'content-length':String(last-start+1)}});
  };
  const shape:ParcelPolygon={type:'Polygon',coordinates:[[[0,0],[.003,0],[.003,.002],[0,.002],[0,0]]]};
  const result=await readRasterWindow('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/test.tif',shape,fetcher);
  assert.equal(result.cells.length,width*height);
  assert.equal(result.cells[width*height-1].value,(width*height-1)%251);
});

test('browser can decode actual TIFF bytes through the same-origin relay after a direct fetch failure',async()=>{
 const bytes=new Uint8Array(writeArrayBuffer(new Uint8Array(4*4).fill(42),{width:4,height:4,BitsPerSample:[8],GeographicTypeGeoKey:4326,ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,0,.0004,0]}));
 const before=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:{},configurable:true});let direct=0,relayed=0;
 const fetcher:typeof fetch=async(input,init)=>{
  if(String(input).startsWith('https://')){direct++;throw new TypeError('Failed to fetch');}
  relayed++;assert.equal(init?.credentials,'same-origin');const u=new URL(String(input),'https://agri.test');assert.equal(u.searchParams.get('satellite'),'raster');
  const range=new Headers(init?.headers).get('range')!.match(/^bytes=(\d+)-(\d+)$/)!,start=Number(range[1]),end=Math.min(Number(range[2]),bytes.length-1);
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});
 };
 try{const r=await readRasterWindow('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/B04.tif',{type:'Polygon',coordinates:[[[0,0],[.0004,0],[.0004,.0004],[0,.0004],[0,0]]]},fetcher);assert.equal(r.cells.length,16);assert.ok(r.cells.every(c=>c.value===42));assert.equal(direct,1);assert.ok(relayed>0);}
 finally{if(before)Object.defineProperty(globalThis,'window',before);else Reflect.deleteProperty(globalThis,'window');}
});

test('GeoTIFF does not hide the actual HTTP failure behind a generic Request failed',async()=>{
 const fetcher:typeof fetch=async()=>new Response(null,{status:503});
 await assert.rejects(()=>readRasterWindow('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/test/B04.tif',{type:'Polygon',coordinates:[[[0,0],[.0004,0],[.0004,.0004],[0,.0004],[0,0]]]},fetcher),/Lecture des pixels impossible.*503/);
});

test('Large contour: exact native rectangles avoid per-pixel geometry explosion',async()=>{
  const width=600,height=500;
  const bytes=new Uint8Array(writeArrayBuffer(Uint8Array.from({length:width*height},(_,i)=>i%width<307?40:80),{
    width,height,BitsPerSample:[8],GeographicTypeGeoKey:4326,
    ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,0,.05,0]
  }));
  const fetcher:typeof fetch=async(_input,options)=>{
    const [start,end]=new Headers(options?.headers).get('range')!.slice(6).split('-').map(Number),last=Math.min(end,bytes.length-1);
    return new Response(bytes.slice(start,last+1),{status:206,headers:{'content-range':`bytes ${start}-${last}/${bytes.length}`}});
  };
  const shape:ParcelPolygon={type:'Polygon',coordinates:[[[0,0],[.06,0],[.06,.05],[0,.05],[0,0]]]};
  const result=await readRasterWindow('https://esa-worldcover.s3.eu-central-1.amazonaws.com/test.tif',shape,fetcher,AbortSignal.timeout(10000),[0],true);
  assert.ok(result.cells.length<100);assert.equal(result.crs,'EPSG:4326');
  let land=0,water=0;
  for(const cell of result.cells){
    const ring=cell.geometry.coordinates[0],x0=Math.round(ring[0][0]/.0001),x1=Math.round(ring[1][0]/.0001);
    const rows=Math.round((ring[0][1]-ring[2][1])/.0001),pixels=(x1-x0)*rows;
    if(cell.value===40){assert.ok(x1<=307);land+=pixels;}else {assert.equal(cell.value,80);assert.ok(x0>=307);water+=pixels;}
  }
  assert.equal(land,307*height);assert.equal(water,(width-307)*height);
});
