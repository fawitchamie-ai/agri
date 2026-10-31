/** Explicit live provider check: actual workerd execution, no application credentials. */
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
if(!process.argv.includes('--live')){console.log('Usage: node scripts/check-land-worker.mjs --live [output.json]');process.exit(0);}
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare,Response:WorkerResponse}=wranglerRequire('miniflare'),{build}=wranglerRequire('esbuild');
const bundle=await build({entryPoints:['tests/support/land-worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
let subrequests=0;
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  // Forward TLS from this network's proxy-aware host. Request construction,
  // RangeClient, GeoTIFF decoding and classification still run inside workerd.
  outboundService:async request=>{
    subrequests++;
    const r=await fetch(request.url,{headers:request.headers,redirect:'manual',signal:AbortSignal.timeout(50000)});
    return new WorkerResponse(r.body,{status:r.status,headers:r.headers});
  }});
const cases=[{country:'TGO',lon:1.43,lat:6.24},{country:'BEN',lon:2.45,lat:6.433333},{country:'BFA',lon:-.55,lat:11.55},{country:'GHA',lon:0,lat:7},{country:'CIV',lon:-5.48,lat:7.17},{country:'SEN',lon:-15.85,lat:16.25}];
const report={generatedAt:new Date().toISOString(),scope:'Live public raster requests forwarded through the host network; application land provider, native GeoTIFF decoder and geometry analysis run in local Cloudflare workerd. Not a production-authenticated check, independent ground truth or field validation.',fieldValidation:false,results:[]};
try{
  for(let i=0;i<cases.length;i+=2)await Promise.all(cases.slice(i,i+2).map(async place=>{
    const a=await (await mf.dispatchFetch(`http://local/?lon=${place.lon}&lat=${place.lat}`)).json();
    report.results.push({...place,...a});console.log(place.country,a.status,JSON.stringify(a.fractions));
  }));
  report.subrequests=subrequests;
  const destination=process.argv[process.argv.indexOf('--live')+1]??'docs/verification-worker-2026-10-31.json';
  await writeFile(destination,JSON.stringify(report,null,2)+'\n');console.log('Saved',destination);
  if(report.results.some(a=>!a.sources?.some(s=>s.id==='worldcover'&&s.status==='available')||!a.sources?.some(s=>s.id==='jrc'&&s.status==='available')))process.exitCode=1;
}finally{await mf.dispose();}
