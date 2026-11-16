import test from 'node:test';import assert from 'node:assert/strict';
import {sentinelRasterProxy} from '../lib/seasonal/sentinel-raster-proxy.ts';
import {relaySentinelRequest} from '../lib/seasonal/sentinel-raster-transport.ts';
const asset='https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/31/P/CL/2026/11/example/B04.tif';
const request=(value=asset,range='bytes=2-5',head=false)=>new Request('https://agri.test/api/seasonal?'+new URLSearchParams({satellite:'raster',asset:value,...(head?{head:'1'}:{})}),{headers:{range,origin:'https://agri.test',cookie:'private-session',authorization:'private-credential'}});
test('authenticated caller gets exactly the requested public bytes without forwarding credentials',async()=>{
 const fetcher:typeof fetch=async(url,init)=>{assert.equal(String(url),asset);assert.equal(init?.redirect,'manual');assert.equal(init?.credentials,'omit');assert.deepEqual([...new Headers(init?.headers)],[['range','bytes=2-5']]);return new Response(new Uint8Array([2,3,4,5]),{status:206,headers:{'content-range':'bytes 2-5/10','content-length':'4'}});};
 const r=await sentinelRasterProxy(request(),fetcher);assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-5/10');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[2,3,4,5]);
});
test('relay refuses arbitrary hosts, bands, oversized ranges, multiple ranges and cross-origin calls',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw new Error('Must not fetch');};
 for(const req of [request('https://private.invalid/B04.tif'),request(asset.replace('B04.tif','index.html')),request(asset,'bytes=0-4000000'),request(asset,'bytes=0-1,3-4'),request(asset+'?secret=x')])assert.equal((await sentinelRasterProxy(req,fetcher)).status,400);
 const foreign=new Request(request(),{headers:{range:'bytes=0-1',origin:'https://foreign.invalid'}});assert.equal((await sentinelRasterProxy(foreign,fetcher)).status,403);assert.equal(calls,0);
});
test('upstream redirect, wrong range and truncated body are explicit failures',async()=>{
 for(const response of [new Response(null,{status:302,headers:{location:'https://unapproved.invalid'}}),new Response(new Uint8Array([0,1]),{status:206,headers:{'content-range':'bytes 0-1/10'}}),new Response(new Uint8Array([2,3]),{status:206,headers:{'content-range':'bytes 2-5/10'}})]){
  const r=await sentinelRasterProxy(request(),async()=>response);assert.equal(r.status,502);
 }
});
test('client fallback retrieves HEAD metadata through JSON, with the same session and cancellation',async()=>{
 const ctrl=new AbortController(),fetcher:typeof fetch=async(url,init)=>{assert.ok(String(url).startsWith('/api/seasonal?'));assert.equal(new URL(String(url),'https://agri.test').searchParams.get('head'),'1');assert.equal(init?.credentials,'same-origin');assert.equal(init?.signal,ctrl.signal);return Response.json({size:123456});};
 const r=await relaySentinelRequest(asset,{method:'HEAD',signal:ctrl.signal},fetcher);assert.equal(r.status,200);assert.equal(r.headers.get('content-length'),'123456');
});
