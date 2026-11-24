// Explicit live check. Reads a local private GeoJSON; never copies its coordinates
// or campaign into the report or the production database.
// node --use-env-proxy --experimental-transform-types scripts/verify-field-coverage.mjs --live GEOMETRY.json FROM TO REPORT.json EXPECTED_COMMIT
import {readFile,writeFile} from 'node:fs/promises';
import {verifiedImageCatalog,loadUsableFieldImage,fieldImageFailureMessage} from '../lib/seasonal/field-image-loader.ts';
import {bbox} from '../lib/seasonal/land.ts';
import {intersection} from '../lib/seasonal/geometry-ops.ts';
import {multiArea} from '../lib/seasonal/land.ts';
import {readZoneSeason} from '../lib/seasonal/field-zones-provider.ts';
import {fieldImageSummary} from '../lib/seasonal/field-analysis.ts';
import {zoneGrid} from '../lib/seasonal/field-zones.ts';
import {readSatelliteVisual} from '../lib/seasonal/satellite-visual.ts';
const args=process.argv.slice(2);
if(args[0]!=='--live'){console.log('Usage: --live GEOMETRY.json FROM TO REPORT.json EXPECTED_COMMIT');process.exit(0);}
const [,file,from,to,destination,commit]=args;
if(!file||!from||!to||!destination||!/^[a-f0-9]{40}$/.test(commit??''))throw new Error('Geometry, period, report and exact deployed commit are required.');
const input=JSON.parse(await readFile(file,'utf8')),shape=input.type==='Feature'?input.geometry:input,grid=zoneGrid(shape),base='https://agri.fawitchamie.workers.dev';
const demo=await fetch(base+'/api/demo',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({role:'producteur',coopId:'demo-a'}),signal:AbortSignal.timeout(30000)});
const cookie=demo.headers.get('set-cookie')?.split(';')[0];if(!demo.ok||!cookie)throw new Error('Cannot open isolated verification session.');
const report={status:'running',expectedCommit:commit,actualPublicRasterData:true,privateParcelGeometryPublished:false,productionCampaignModified:false,observations:[]};
const originalWindow=globalThis.window;
try{
 const v=await fetch(base+'/api/version',{headers:{cookie},cache:'no-store',signal:AbortSignal.timeout(30000)}),version=await v.json();
 if(!v.ok||version.commit!==commit)throw new Error('Expected source is not deployed.');report.commit=version.commit;
 let relayRequests=0;
 const fetcher=async(input,init={})=>{
  if(String(input).startsWith('/api/seasonal?')){
   relayRequests++;const headers=new Headers(init.headers);headers.set('cookie',cookie);headers.set('origin',base);
   return fetch(base+input,{...init,headers});
  }
  return fetch(input,init);
 };
 globalThis.window={};
 const catalog=await verifiedImageCatalog(bbox(shape),from,to,fetcher),dates=catalog.dates;
 Object.assign(report,{period:{from,to},officialVerified:catalog.officialVerified,officialScenes:catalog.officialScenes,sources:catalog.sources,warnings:catalog.warnings});
 const result=await loadUsableFieldImage(shape,dates,{signal:AbortSignal.timeout(900000),fetcher,catalog,
  reader:(...args)=>readZoneSeason(...args),
  onProgress:(date,attempt,total)=>console.log(JSON.stringify({date,attempt,total})),
  onRead:r=>{const s=fieldImageSummary(grid,r);report.observations.push({date:r.season.startDate,scenes:r.scenes,gridCoverage:s.coverage,cells:s.cells,mean:s.mean,issues:r.issues});},
 });
 report.attempts=result.attempts;report.targetCoverage=result.targetCoverage;report.dates=dates.length;report.checks=result.checks;report.usableDates=result.usableCount;report.readFailures=result.readFailures;report.unavailable=result.unavailable;
 if(!result.read)throw new Error(fieldImageFailureMessage(result));
 const selected=result.read,day=selected.season.startDate,itemId=selected.scenes[0].itemId;report.selectedDate=day;
 report.visuals=[];
 for(const layer of ['rgb','classification','ndvi','contrast']){
  const image=await readSatelliteVisual(grid.bounds,day,layer,fetcher,undefined,undefined,itemId,shape);
  if(image.itemId!==itemId||!image.pixels.length)throw new Error('Mismatched or empty native image.');
  const index=layer==='ndvi'||layer==='contrast',outside=index?image.pixels.filter(p=>multiArea(intersection(p.geometry.coordinates,shape.coordinates))<=.001).length:null;
  if(index&&(image.resolutionM!==10||outside))throw new Error('NDVI must retain native 10 m footprints intersecting the field.');
  report.visuals.push({layer,date:image.date,itemId:image.itemId,pixels:image.pixels.length,resolutionM:image.resolutionM,valueRange:image.valueRange,fullyOutsidePixels:outside});
 }
 report.relayRequests=relayRequests;report.status='passed';
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1;}
finally{
 if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
 try{const closed=await fetch(base+'/api/demo',{method:'DELETE',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});report.isolatedSessionClosed=closed.ok;}catch{report.isolatedSessionClosed=false;}
 report.verifiedAt=new Date().toISOString();await writeFile(destination,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
