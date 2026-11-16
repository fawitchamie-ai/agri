// Opt-in production check using an isolated demo session and public technical geometry.
// node --use-env-proxy --experimental-transform-types scripts/verify-satellite-relay-production.mjs --live output.json EXPECTED_COMMIT [all|ndvi|visuals]
const liveIndex=process.argv.indexOf('--live');
if(liveIndex<0){console.log('Usage: verify-satellite-relay-production.mjs --live output.json EXPECTED_COMMIT');process.exit(0);}
const destination=process.argv[liveIndex+1],expectedCommit=process.argv[liveIndex+2];
if(!destination||!/^[a-f0-9]{40}$/.test(expectedCommit||''))throw new Error('Choose an output JSON and the exact expected production commit.');
const mode=process.argv[liveIndex+3]||'all';
if(!['all','ndvi','visuals'].includes(mode))throw new Error('Unknown probe mode.');
import {writeFile} from 'node:fs/promises';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {zoneGrid} from '../lib/seasonal/field-zones.ts';
import {fieldImageSummary} from '../lib/seasonal/field-analysis.ts';
import {canRelaySentinel} from '../lib/seasonal/sentinel-raster-transport.ts';
import {readSatelliteVisual} from '../lib/seasonal/satellite-visual.ts';
const base='https://agri.fawitchamie.workers.dev';
const nativeFetch=fetch;
const version=await (await nativeFetch(base+'/api/version?relayCheck='+Date.now(),{cache:'no-store'})).json();
if(version.commit!==expectedCommit)throw new Error('Expected deployment is not live yet.');
const demo=await nativeFetch(base+'/api/demo',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({role:'producteur',coopId:'demo-a'})});
if(!demo.ok)throw new Error('Isolated demo session failed HTTP '+demo.status);
const cookie=demo.headers.get('set-cookie')?.split(';')[0];
if(!cookie)throw new Error('Missing isolated demo cookie.');
const geometry={type:'Polygon',coordinates:[[[1.2,9.4],[1.2007472,9.4],[1.2007472,9.4007472],[1.2,9.4007472],[1.2,9.4]]]};
let directFailures=0,relayRequests=0;
const relayResponses=[];
const fetcher=async(input,init={})=>{
 const url=String(input);
 if(url.startsWith('/api/seasonal?')){
  relayRequests++;
  const headers=new Headers(init.headers);headers.set('cookie',cookie);headers.set('origin',base);
  const started=Date.now();
  const response=await nativeFetch(base+url,{...init,headers});
  console.log(JSON.stringify({relayStatus:response.status,range:headers.get('range'),elapsedMs:Date.now()-started}));
  relayResponses.push({status:response.status,range:response.headers.get('content-range'),transport:response.headers.get('x-satellite-transport'),sourceEndpoint:response.headers.get('x-satellite-source-endpoint')});
  return response;
 }
 if(canRelaySentinel(url)){directFailures++;throw new TypeError('Injected direct raster transport failure');}
 return nativeFetch(input,init);
};
globalThis.window={};
const day='2026-11-15',grid=zoneGrid(geometry);
const result={commit:version.commit,productionEndpoint:base+'/api/seasonal?satellite=raster',actualPublicRasterData:true,directFailureInjected:true,privateUserParcelTested:false,geometry,areaHa:grid.areaM2/10000,date:day,completedLayers:[],visuals:[],status:'running'};
const checkpoint=async()=>writeFile(destination,JSON.stringify({...result,verifiedAt:new Date().toISOString(),directFailures,relayRequests,httpFailures:relayResponses.filter(r=>r.status!==206).length,relayResponses},null,2)+'\n');
try{
 if(mode!=='visuals'){
 const read=await readZoneSeason(geometry,{id:'production-relay-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false},fetcher);
 const s=fieldImageSummary(grid,read);
 console.log(JSON.stringify({phase:'NDVI complete',cells:s.cells,coverage:s.coverage,ndviMean:s.mean,relayRequests}));
 if(s.cells!==25||s.coverage<.99||Math.abs(s.mean-.4450165590844608)>1e-10||read.issues.length||directFailures!==3||relayRequests<3)throw new Error('Production relay did not return the expected complete observation.');
 Object.assign(result,{itemId:read.scenes[0]?.itemId,source:read.source,cells:s.cells,coverage:s.coverage,ndviMean:s.mean,issues:read.issues});
 result.completedLayers.push('ndvi');await checkpoint();
 }
 for(const layer of mode==='ndvi'?[]:['rgb','classification']){
  const before=relayRequests,visual=await readSatelliteVisual(grid.bounds,day,layer,fetcher);
  const colors=new Set(visual.pixels.map(p=>p.color)).size;
  if(!visual.pixels.length||(layer==='rgb'&&colors<2))throw new Error('Missing actual native visual pixels.');
  const summary={layer,date:visual.date,itemId:visual.itemId,source:visual.source,pixels:visual.pixels.length,distinctColors:colors,resolutionM:visual.resolutionM,relayRequests:relayRequests-before};
  result.visuals.push(summary);result.completedLayers.push(layer);await checkpoint();console.log(JSON.stringify(summary));
 }
 result.status='passed';await checkpoint();
 console.log(JSON.stringify(result,null,2));
}catch(error){result.status='failed';result.error=error.message;await checkpoint();throw error;
}finally{
 delete globalThis.window;
 try{const logout=await nativeFetch(base+'/api/demo',{method:'DELETE',headers:{'content-type':'application/json',origin:base,cookie},body:'{}',signal:AbortSignal.timeout(20000)});result.isolatedDemoSessionClosed=logout.ok;}
 catch(error){result.isolatedDemoSessionClosed=false;result.sessionCleanupError=error.message;}
 await checkpoint();console.log(JSON.stringify({isolatedDemoSessionClosed:result.isolatedDemoSessionClosed}));
}
