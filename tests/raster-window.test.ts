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
  assert.throws(()=>rasterWindows(0,0,MAX_NATIVE_PIXELS+1,1),/24 000 pixels/);
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
