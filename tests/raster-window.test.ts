import test from 'node:test';
import assert from 'node:assert/strict';
import {writeArrayBuffer} from 'geotiff';
import {rasterWindows,readRasterWindow,MAX_NATIVE_PIXELS} from '../lib/seasonal/raster.ts';
import type {ParcelPolygon} from '../lib/seasonal/parcel.ts';

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

test('WorldCover-sized contour above 10,000 pixels preserves all native values and coordinates',async()=>{
  const width=150,height=120;
  const bytes=new Uint8Array(writeArrayBuffer(Uint8Array.from({length:width*height},(_,i)=>i%251),{
    width,height,BitsPerSample:[8],GeographicTypeGeoKey:4326,
    ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,0,.012,0]
  }));
  const fetcher:typeof fetch=async(_input,options)=>{
    const range=new Headers(options?.headers).get('range')!;
    const [start,end]=range.slice(6).split('-').map(Number),last=Math.min(end,bytes.length-1);
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
