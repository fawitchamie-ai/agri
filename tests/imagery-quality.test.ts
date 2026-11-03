import test from 'node:test';
import assert from 'node:assert/strict';
import {availableImageryLevel,ESRI_IMAGERY} from '../lib/seasonal/imagery-quality.ts';
test('photographic basemap uses provider availability, not HTTP-200 placeholder tiles, and handles adjusted metadata grids',async()=>{
 const calls:string[]=[];
 const fetcher=(async(url:RequestInfo|URL)=>{
  const u=String(url);calls.push(u);const parts=new URL(u).pathname.split('/'),z=Number(parts.at(-5)),y=Number(parts.at(-4)),x=Number(parts.at(-3));
  // The service may return a larger availability grid than the requested 1×1.
  return Response.json({valid:true,location:{left:x-1,top:y-1,width:3,height:3},data:[0,0,0,0,z<=18?1:0,0,0,0,0]});
 }) as typeof fetch;
 const native=await availableImageryLevel(1.2025,9.502,21,undefined,fetcher);assert.equal(native,18);assert.equal(calls.length,4);assert.ok(calls.every(u=>u.startsWith(ESRI_IMAGERY+'/tilemap/')));
 const bad=(async()=>Response.json({valid:true,data:[1],location:{left:0,top:0,width:1,height:1}})) as typeof fetch;
 await assert.rejects(availableImageryLevel(1.2,9.5,18,undefined,bad),/Emprise/);
 await assert.rejects(availableImageryLevel(180,90,18,undefined,fetcher),/Position/);
 const outage=(async()=>new Response('',{status:503})) as typeof fetch;await assert.rejects(availableImageryLevel(1.2,9.5,18,undefined,outage),/non vérifié/);
});
