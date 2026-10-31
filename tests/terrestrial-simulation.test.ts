import test from 'node:test';
import assert from 'node:assert/strict';
import {writeArrayBuffer} from 'geotiff';
import {COUNTRIES,type Country,type SeasonalConfig} from '../lib/seasonal/types.ts';
import {polygonFromPoints,parcelMetrics} from '../lib/seasonal/parcel.ts';
import {assessLandGeometry,missingLandLayer,terrestrialSoilPoint,type LandLayer} from '../lib/seasonal/land.ts';
import {loadEnvironment} from '../lib/seasonal/environment.ts';
import {automaticCampaign,mergeEnvironment} from '../lib/seasonal/automatic.ts';
import {emptyCampaign} from '../lib/seasonal/example.ts';
import {declareScenario} from '../lib/seasonal/provenance.ts';
import {planWater,waterPlanCsv} from '../lib/seasonal/engine.ts';
import {validateConfig,addDays} from '../lib/seasonal/validation.ts';
const now=new Date().toISOString(),start=now.slice(0,10);
const places:{country:Country;lon:number;lat:number}[]=[{country:'TGO',lon:1.2,lat:9.5},{country:'BEN',lon:2.4,lat:9.3},{country:'BFA',lon:-1.6,lat:12.3},{country:'GHA',lon:-1.1,lat:8},{country:'CIV',lon:-5.5,lat:7.5},{country:'SEN',lon:-14.5,lat:14.4}];
function campaign(p=places[0]){
 const {lon:x,lat:y}=p,geometry=polygonFromPoints([[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001]]);
 const land:LandLayer={...missingLandLayer('worldcover','',now),status:'available',cells:[{id:'land',value:40,geometry}]};
 return {c:automaticCampaign({...emptyCampaign(start),country:p.country,parcelGeometry:geometry,longitude:x,latitude:y}),land,geometry};
}
const fake:typeof fetch=async input=>{
 const u=new URL(String(input));
 if(u.hostname==='maps.isric.org'){
  const prop=u.searchParams.get('COVERAGE')!.split('_')[0],values:Record<string,number>={phh2o:63,soc:100,nitrogen:80,cec:120,sand:600,clay:200,wv0033:250,wv1500:120};
  const bytes=writeArrayBuffer(new Int16Array([values[prop]]),{width:1,height:1,BitsPerSample:[16],SampleFormat:[2]});
  const view=new DataView(bytes),le=view.getUint16(0)===0x4949,ifd=view.getUint32(4,le);
  for(let i=0;i<view.getUint16(ifd,le);i++){const at=ifd+2+i*12;if(view.getUint16(at,le)===273)view.setInt16(view.getUint32(at+8,le),values[prop],le);}
  return new Response(bytes);
 }
 const dates=Array.from({length:125},(_,i)=>addDays(start,i));
 return Response.json({daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C'},daily:{time:dates,precipitation_sum:dates.map(()=>1),et0_fao_evapotranspiration:dates.map(()=>5),temperature_2m_mean:dates.map(()=>27)}});
};
test('All six countries: terrestrial soil acquisition, scope merge and full conditional simulation',async()=>{
 for(const p of places){
  const {c,land,geometry}=campaign(p),a=assessLandGeometry(geometry,[land],now),point=terrestrialSoilPoint(a)!;
  const e=await loadEnvironment(p.lat,p.lon,p.country,start,125,fake,now,geometry,true,point);e.landAssessment=a;
  assert.equal(e.soil.ph,6.3,COUNTRIES[p.country].name);assert.equal(e.soil.hydraulicLayers?.length,6);
  const merged=declareScenario(mergeEnvironment(c,e)),plan=planWater(merged,[],{requireGeometry:true});
  assert.equal(plan.complete,true,p.country+JSON.stringify(plan.missing));assert.equal(plan.days.length,125);assert.ok(plan.totals.fieldM3!>0);
 }
});
test('Explicit terrestrial selection computes only mapped land including inner water holes',()=>{
 const {c,geometry,land}=campaign(),[x,y]=geometry.coordinates[0][0];
 const water=polygonFromPoints([[x+.00025,y+.00025],[x+.00075,y+.00025],[x+.00075,y+.00075],[x+.00025,y+.00075]]);
 const a=assessLandGeometry(geometry,[land,{...missingLandLayer('jrc','',now),status:'available',cells:[{id:'water',value:12,geometry:water}]}]);
 const base:SeasonalConfig=declareScenario({...c,landAssessment:a,fallback:{label:'Explicit synthetic weather scenario',rainMmDay:0,et0MmDay:5}});
 assert.equal(planWater(base).status,'blocked');
 const full=planWater({...base,landAssessment:assessLandGeometry(geometry,[land])});
 const selected=planWater({...base,landSelection:'potentialLand'});
 assert.equal(selected.complete,true,JSON.stringify(selected.missing));assert.equal(selected.calculationArea?.geometry?.coordinates[0].length,2);
 assert.ok(Math.abs(selected.totals.fieldM3!/full.totals.fieldM3!-a.candidateAreaM2/a.areaM2)<1e-7);
 assert.equal(selected.calculationArea?.areaM2,a.candidateAreaM2);assert.match(waterPlanCsv(selected),/surface_calcul_m2/);assert.ok(waterPlanCsv(selected).includes(String(a.candidateAreaM2)));assert.match(waterPlanCsv(selected),/potentialLand/);assert.equal(validateConfig({...base,landSelection:'potentialLand'}).areaM2,parcelMetrics(geometry).areaM2);
 const event={id:'old',date:start,kind:'irrigation',amount:100,unit:'L',point:'field',status:'measured',source:'Test meter',recordedAt:now};
 assert.equal(planWater({...base,landSelection:'potentialLand'},[event]).status,'blocked');
 assert.equal(planWater({...base,landSelection:'potentialLand'},[{...event,landSelection:'potentialLand'}]).complete,true);
});
test('Unknown or water-only area cannot be selected as terrestrial, and stale reports stay blocked',()=>{
 const {c,geometry}=campaign(),a=assessLandGeometry(geometry,[]);
 const base=declareScenario({...c,landAssessment:a,landSelection:'potentialLand' as const});
 assert.match(planWater(base).missing.join(' '),/Aucune partie terrestre/);
 const valid=campaign().land;
 const stale=assessLandGeometry(geometry,[valid],new Date(Date.now()-2*86400000).toISOString());
 assert.match(planWater({...base,landAssessment:stale}).missing.join(' '),/actualiser/);
});
test('New explicit defaults repair old null evidence, without disguising missing automatic values',()=>{
 const {c}=campaign();assert.equal(c.inputs?.values['soil.layers.0.initialTheta'].status,'assumed');
 assert.equal(c.inputs?.values['system.applicationEfficiency'].status,'assumed');
 assert.equal(c.inputPolicy?.allowAssumptions,false);
 const e=structuredClone(c);e.inputs!.values['soil.layers.0.initialTheta']={...e.inputs!.values['soil.layers.0.initialTheta'],origin:'automatic',status:'missing',value:null};
 assert.equal(automaticCampaign(e).inputs!.values['soil.layers.0.initialTheta'].status,'missing');
});

test('A transient provider failure is retried without replacing missing values with invented data',async()=>{
 const calls=new Map<string,number>();
 const retrying:typeof fetch=async(input,options)=>{
  const u=new URL(String(input)),key=u.hostname==='maps.isric.org'?u.searchParams.get('COVERAGE')!:u.hostname;
  const count=(calls.get(key)??0)+1;calls.set(key,count);
  if(count===1&&(key==='phh2o_5-15cm_mean'||key==='api.open-meteo.com'))return new Response('temporarily unavailable',{status:503});
  return fake(input,options);
 };
 const e=await loadEnvironment(9.5,1.2,'TGO',start,125,retrying,now);
 assert.equal(e.soil.ph,6.3);assert.equal(e.weather.length,125);
 assert.equal(calls.get('phh2o_5-15cm_mean'),2);assert.equal(calls.get('api.open-meteo.com'),2);
});
