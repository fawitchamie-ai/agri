import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {zstdCompressSync} from 'node:zlib';
import {writeArrayBuffer} from 'geotiff';

// Use the exact workerd, Miniflare and bundler versions locked with Wrangler.
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare,Response:WorkerResponse}=wranglerRequire('miniflare');
const {build}=wranglerRequire('esbuild');
const bundle=await build({entryPoints:['tests/support/land-worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const raster=value=>new Uint8Array(writeArrayBuffer(new Uint8Array(16*16).fill(value),{
  width:16,height:16,BitsPerSample:[8],GeographicTypeGeoKey:4326,
  ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,2.4492,6.4341,0]
}));
function zstdRaster(value){
  // Compress the generated strip and update its TIFF tags, preserving the
  // original geographic metadata. No network or Python fixture is required.
  const bytes=raster(value),view=new DataView(bytes.buffer),le=bytes[0]===73;
  const directory=view.getUint32(4,le),count=view.getUint16(directory,le);
  const compressed=zstdCompressSync(new Uint8Array(16*16).fill(value));let offset;
  for(let i=0;i<count;i++){
    const at=directory+2+i*12,tag=view.getUint16(at,le);
    if(tag===259)view.setUint16(at+8,50000,le);
    if(tag===273)offset=view.getUint32(at+8,le);
    if(tag===279)view.setUint32(at+8,compressed.length,le);
  }
  assert.ok(offset>directory+count*12);
  const result=new Uint8Array(offset+compressed.length);result.set(bytes.subarray(0,offset));result.set(compressed,offset);return result;
}
const worldcover=raster(80),jrc=zstdRaster(12);

test('Workers : pixels natifs, panne et redirections sont vérifiés dans workerd',async t=>{
  let mode='available';const calls=[];
  const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
    outboundService:async request=>{
      const url=new URL(request.url);calls.push(url.href);
      if(mode==='redirect')return new WorkerResponse(null,{status:302,headers:{location:'https://unapproved.example/raster.tif'}});
      if(mode==='missing')return new WorkerResponse(null,{status:503});
      if(url.hostname==='explorer.digitalearth.africa')return WorkerResponse.json({features:[]});
      if(url.pathname.includes('/inputquality/'))return new WorkerResponse(null,{status:404});
      const bytes=url.hostname==='esa-worldcover.s3.eu-central-1.amazonaws.com'?worldcover:jrc;
      const range=request.headers.get('range');assert.match(range,/^bytes=\d+-\d+$/);
      const [start,end]=range.slice(6).split('-').map(Number),last=Math.min(end,bytes.length-1);
      return new WorkerResponse(bytes.slice(start,last+1),{status:206,headers:{'content-range':`bytes ${start}-${last}/${bytes.length}`,'content-length':String(last-start+1)}});
    }});
  try{
    await t.test('Le runtime refuse bien error, avant tout appel réseau',async()=>{
      assert.deepEqual(await (await mf.dispatchFetch('http://local/unsupported')).json(),{rejected:true});assert.equal(calls.length,0);
    });
    await t.test('WorldCover et JRC décodés : le lac reste exclu',async()=>{
      const a=await (await mf.dispatchFetch('http://local/')).json();
      assert.equal(a.status,'excluded',JSON.stringify({sources:a.sources,calls}));assert.ok(a.fractions.permanentWater>.99999);
      assert.equal(a.sources.find(s=>s.id==='worldcover').status,'available');
      assert.equal(a.sources.find(s=>s.id==='jrc').status,'available');
      assert.equal(a.sources.find(s=>s.id==='recent').reason,'Aucune observation récente exploitable.');
      assert.ok(calls.some(u=>u.includes('/stac/search?')));
    });
    for(const failure of ['redirect','missing'])await t.test(`${failure} : inconnu, sans suivre un autre hôte`,async()=>{
      mode=failure;calls.length=0;
      const a=await (await mf.dispatchFetch('http://local/')).json();
      assert.equal(a.status,'unknown');assert.equal(a.fractions.unknown,1);
      assert.ok(a.sources.every(s=>s.status==='missing'));
      assert.ok(calls.every(u=>!u.includes('unapproved.example')));
      assert.match(a.sources.find(s=>s.id==='recent').reason,new RegExp(failure==='redirect'?'HTTP 302':'HTTP 503'));
    });
  }finally{await mf.dispose();}
});
