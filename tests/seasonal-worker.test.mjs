import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {writeArrayBuffer} from 'geotiff';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {mergeEnvironment} from '../lib/seasonal/automatic.ts';
import {declareScenario,geometryIdentity} from '../lib/seasonal/provenance.ts';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {Miniflare,Response:WorkerResponse}=wr('miniflare'),{build}=wr('esbuild'),root=resolve('.');
const bundle=await build({entryPoints:['tests/support/seasonal-worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['node:*','cloudflare:workers'],alias:{'@':root},plugins:[{name:'test-only-identity',setup(b){b.onLoad({filter:/\/app\/chatgpt-auth\.ts$/},()=>({contents:`import {currentAccessIdentity} from ${JSON.stringify(root+'/lib/cloudflare-access.ts')};export async function getChatGPTUser(){return currentAccessIdentity();}`,loader:'ts'}));}}]});
function raster(value){return new Uint8Array(writeArrayBuffer(Uint8Array.from({length:16*16},(_,i)=>typeof value==='function'?value(i):value),{width:16,height:16,BitsPerSample:[8],GeographicTypeGeoKey:4326,ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,1.1992,9.5012,0]}));}
const land=raster(40),fragmentedLand=raster(i=>[40,80,90,50][(i+Math.floor(i/16))%4]),water=raster(0),shape={type:'Polygon',coordinates:[[[1.2,9.5],[1.2004,9.5],[1.2004,9.5004],[1.2,9.5004],[1.2,9.5]]]};
function fixture(){const c=applyCropProfile(exampleCampaign(),'maize');c.parcelGeometry=shape;c.landSelection='potentialLand';c.waterCondition='drained';c.yieldEstimation={version:'yield-input-1',method:'declared-scenario',scopeGeometryId:geometryIdentity(shape),homogeneityAssumption:'Synthetic runtime fixture',units:[{id:'field',sownAreaM2:1000,harvestedAreaM2:null,areaSource:'Synthetic',reference:{kind:'scenario',kgHa:4000,denominator:'sown',source:'Synthetic only',availableOn:c.asOfDate,context:'Test only',cropId:'maize',independentYm:true}}]};return c;}
test('Workers seasonal API: concurrent simulation, audit and D1 snapshots execute in the deployed runtime',async()=>{
 let outage=false,fragmented=false,malformedForecast=false,soilCalls=0,soilActive=0,soilPeak=0;
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],outboundService:async req=>{
  const u=new URL(req.url),isSoil=u.hostname==='maps.isric.org';if(isSoil){soilCalls++;soilActive++;soilPeak=Math.max(soilPeak,soilActive);}await new Promise(r=>setTimeout(r,15));
  if(isSoil)soilActive--;
  if(outage)return new WorkerResponse(null,{status:503});
  if(isSoil){const prop=u.searchParams.get('COVERAGE').split('_')[0],v={phh2o:64,soc:108,nitrogen:95,cec:115,sand:643,clay:161,wv0033:300,wv1500:150}[prop];return new WorkerResponse(writeArrayBuffer(new Uint16Array([v]),{width:1,height:1,BitsPerSample:[16],SampleFormat:[1]}));}
  if(u.hostname.includes('open-meteo.com')){
   const year=new Date().getUTCFullYear(),from=u.searchParams.get('start_date')??new Date().toISOString().slice(0,10),to=u.searchParams.get('end_date');
   const length=to?(Date.parse(to)-Date.parse(from))/86400000+1:16,dates=Array.from({length},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
   const daily={time:dates,precipitation_sum:dates.map(()=>3),et0_fao_evapotranspiration:dates.map(()=>5),temperature_2m_mean:dates.map(()=>27)};
   if(malformedForecast&&u.hostname==='api.open-meteo.com')delete daily.et0_fao_evapotranspiration;
   return WorkerResponse.json({latitude:9.5,longitude:1.2,daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C'},daily});
  }
  if(u.hostname==='explorer.digitalearth.africa')return WorkerResponse.json({features:[]});
  if(u.pathname.includes('/inputquality/'))return new WorkerResponse(null,{status:404});
  const bytes=u.hostname==='esa-worldcover.s3.eu-central-1.amazonaws.com'?(fragmented?fragmentedLand:land):water,range=req.headers.get('range');
  if(!range)return new WorkerResponse(null,{status:503});const [start,end]=range.slice(6).split('-').map(Number),last=Math.min(end,bytes.length-1);
  return new WorkerResponse(bytes.slice(start,last+1),{status:206,headers:{'content-range':`bytes ${start}-${last}/${bytes.length}`,'content-length':String(last-start+1)}});
 }});
 try{
  const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){const sql=readFileSync('drizzle/'+f,'utf8').replace(/--.*$/gm,'').replaceAll('\n',' ');await db.exec(sql);}
  async function post(body,status=200){const r=await mf.dispatchFetch('https://local/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://local'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d).slice(0,500));return d;}
  const c=fixture();
  for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN']){c.country=country;const [s]=await Promise.all(['simulate','data-readiness','agronomic-coverage'].map(action=>post({action,config:c})));assert.equal(s.plan.yieldEstimation.scenarios[0].totals.productionKg,400);}
  const saved=await post({action:'save',id:'runtime-campaign',expectedRevision:0,config:c},201);assert.equal(saved.campaign.plan.yieldEstimation.scenarios[0].totals.productionKg,400);
  const large=structuredClone(c);large.stages=large.stages.map((s,i)=>({...s,days:i===0?276:30}));const data=await post({action:'save',id:'runtime-large',expectedRevision:0,config:large},201);assert.equal(data.campaign.plan.days.length,366);
  const got=await mf.dispatchFetch('https://local/api/seasonal?id=runtime-large');assert.equal(got.status,200);assert.equal((await got.json()).campaign.plan.days.length,366);
  const season=fixture();season.inputPolicy={allowAssumptions:false,allowStale:false};season.country='BEN';season.stages=season.stages.map((s,i)=>({...s,days:i===0?120:30}));
  const body={action:'environment',country:'BEN',start:season.sowingDate,days:210,geometry:shape,refresh:true};
  const e=await post(body);assert.equal(e.weather.length,210);assert.ok(e.soil.hydraulicLayers);assert.ok(soilPeak<=4,'Soil requests must stay bounded');
  let acquired=mergeEnvironment(season,e);const blocked=await post({action:'simulate',config:acquired});assert.equal(blocked.plan.status,'blocked');assert.match(blocked.plan.missing.join(' '),/hypothétiques/);
  acquired=declareScenario(acquired);const ready=await post({action:'simulate',config:acquired});assert.equal(ready.plan.status,'conditional');assert.equal(ready.plan.days.length,210);assert.ok(ready.plan.totals.demandMm>0);assert.ok(ready.plan.totals.actualEtMm>0);
  const originalSoilCalls=soilCalls;malformedForecast=true;
  const refreshed=await post(body);assert.equal(refreshed.weather.length,210);assert.ok(refreshed.weather.every(w=>w.status==='scenario'));assert.match(refreshed.warnings.join(' '),/Prévisions météo indisponibles/);assert.equal(soilCalls,originalSoilCalls,'Stable complete soil profiles retain their original acquisition instead of refetching 30 rasters');
  fragmented=true;malformedForecast=false;
  const sloped={type:'Polygon',coordinates:[[[1.20003,9.50002],[1.20055,9.50009],[1.20049,9.50063],[1.20006,9.50057],[1.20003,9.50002]]]};
  for(const country of ['TGO','BEN','BFA','GHA','CIV','SEN']){const restored=await post({action:'environment',country,start:season.sowingDate,days:125,geometry:sloped,refresh:true});assert.equal(restored.weather.length,125);assert.equal(restored.landAssessment.analysis,undefined);assert.ok(restored.landAssessment.candidateAreaM2>0);assert.ok(restored.landAssessment.excludedAreaM2>0);assert.equal(restored.landAssessment.areaMethod,'spherical-linear-edges-1');}
  fragmented=false;
  outage=true;const moved=structuredClone(c);moved.parcelGeometry={type:'Polygon',coordinates:shape.coordinates.map(r=>r.map(([x,y])=>[x+.0001,y]))};moved.yieldEstimation=undefined;
  const noSource=await post({action:'simulate',config:moved});assert.equal(noSource.plan.status,'blocked');assert.ok(noSource.plan.land.unknownAreaM2>0);
 }finally{await mf.dispose();}
});
