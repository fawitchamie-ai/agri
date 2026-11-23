import test from 'node:test';import assert from 'node:assert/strict';
import {satelliteStacSearch} from '../lib/seasonal/satellite.ts';
test('a saturated descending catalogue is split to preserve early dates without following arbitrary next URLs',async()=>{
 const calls:string[]=[],feature=(date:string,id:string)=>({id,properties:{datetime:date+'T12:00:00Z'},assets:{B04:{href:'https://example.test/red'},B08:{href:'https://example.test/nir'},SCL:{href:'https://example.test/scl'}}});
 const fetcher:typeof fetch=async input=>{const u=new URL(String(input));calls.push(u.href);assert.equal(u.hostname,'explorer.digitalearth.africa');const range=u.searchParams.get('datetime')!,from=range.slice(0,10),to=range.split('/')[1].slice(0,10);return Response.json({features:from==='2026-11-01'&&to==='2026-11-03'?Array.from({length:60},(_,i)=>feature(to,String(i))):[feature(from,from)],links:from==='2026-11-01'&&to==='2026-11-03'?[{rel:'next',href:'https://untrusted.invalid/next'}]:[]});};
 const result=await satelliteStacSearch([1.2,9.4,1.202,9.402],'2026-11-01','2026-11-03',fetcher,'ndvi',true,true);
 assert.equal(calls.length,3);assert.deepEqual(result.features.map(v=>v.properties!.datetime!.slice(0,10)),['2026-11-01','2026-11-03']);
});
test('an unresolved single-day saturation refuses a supposedly complete catalogue',async()=>{
 const fetcher:typeof fetch=async()=>Response.json({features:Array.from({length:60},(_,i)=>({id:String(i)}))});
 await assert.rejects(()=>satelliteStacSearch([1,9,1.2,9.2],'2026-11-01','2026-11-01',fetcher,false,true,true),/non certifiable/);
});
