import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSentinelCatalog} from '../lib/seasonal/satellite.ts';
import {verifiedImageCatalog} from '../lib/seasonal/sentinel-catalog.ts';
const bounds=[1,8,1.001,8.001];
function item(date:string,c1=true,verified=true){return {id:'S2_TEST_'+date,properties:{datetime:date+'T10:00:00Z',...(!c1&&verified?{'earthsearch:boa_offset_applied':true}:{})},assets:Object.fromEntries(['red','nir','scl'].map((b,i)=>[b,{href:`https://${c1?'e84-earth-search-sentinel-data':'sentinel-cogs'}.s3.us-west-2.amazonaws.com/${c1?'sentinel-2-c1-l2a':'sentinel-s2-l2a-cogs'}/${date}/${['B04','B08','SCL'][i]}.tif`,'raster:bands':[{scale:.0001,offset:-.1}]}]))};}
test('short pages with next tokens retain older acquisitions and preserve the original query',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async(_u,init)=>{
  calls++;const b=JSON.parse(String(init?.body));assert.deepEqual(b.bbox,bounds);assert.deepEqual(b.collections,['sentinel-2-c1-l2a']);
  return b.next?Response.json({features:[item('2026-10-14')],numberMatched:2}):Response.json({features:[item('2026-10-29')],numberMatched:2,links:[{rel:'next',href:'https://earth-search.aws.element84.com/v1/search',method:'POST',body:{next:'older',bbox:[80,80,81,81]}}]});
 };
 const r=await searchSentinelCatalog('earth',bounds,'2026-10-01','2026-10-31',true,fetcher);
 assert.equal(calls,2);assert.deepEqual(r.map(i=>i.properties!.datetime!.slice(0,10)),['2026-10-29','2026-10-14']);
});
test('repeating cursors fail explicitly instead of dropping or endlessly rereading dates',async()=>{
 const fetcher:typeof fetch=async()=>Response.json({features:[item('2026-10-14')],links:[{rel:'next',href:'https://earth-search.aws.element84.com/v1/search',method:'POST',body:{next:'same'}}]});
 await assert.rejects(()=>searchSentinelCatalog('earth',bounds,'2026-10-01','2026-10-31',true,fetcher),/répétée/);
});
test('the official calendar and every COG collection are consulted even when C1 is nonempty',async()=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const u=new URL(String(input));calls.push(u.hostname);
  if(u.hostname==='explorer.digitalearth.africa')return new Response('down',{status:503});
  if(u.hostname==='stac.dataspace.copernicus.eu')return Response.json({features:['2026-10-14','2026-10-29','2026-11-23'].map(d=>({id:d,properties:{datetime:d+'T10:00:00Z'}}))});
  const b=JSON.parse(String(init?.body));return Response.json({features:[item(b.collections[0]==='sentinel-2-c1-l2a'?'2026-10-29':'2026-10-14',b.collections[0]==='sentinel-2-c1-l2a')]});
 };
 const r=await verifiedImageCatalog(bounds,'2026-10-01','2026-11-23',fetcher);
 assert.equal(calls.length,5);assert.equal(r.officialVerified,true);assert.deepEqual(r.dates,['2026-10-14','2026-10-29','2026-11-23']);assert.equal(r.features.length,2);assert.equal(r.warnings.length,2);
});
test('unverified legacy reflectances stay unavailable and a failed official calendar is disclosed',async()=>{
 const fetcher:typeof fetch=async(input,init)=>{
  const u=new URL(String(input));if(u.hostname!=='earth-search.aws.element84.com')return new Response('down',{status:503});
  const c=JSON.parse(String(init?.body)).collections[0];return Response.json({features:c==='sentinel-2-c1-l2a'?[]:[item('2026-10-14',false,false)]});
 };
 const r=await verifiedImageCatalog(bounds,'2026-10-01','2026-10-31',fetcher);
 assert.equal(r.officialVerified,false);assert.equal(r.features.length,0);assert.deepEqual(r.dates,['2026-10-14']);assert.ok(r.warnings.some(s=>s.includes('Copernicus')));
});
