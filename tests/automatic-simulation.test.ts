import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {readSoilPixel,loadEnvironment,type Environment} from '../lib/seasonal/environment.ts';
import {automaticCampaign,mergeEnvironment,phSuitability} from '../lib/seasonal/automatic.ts';
import {declareScenario,reconcileInputs,environmentContext} from '../lib/seasonal/provenance.ts';
import {emptyCampaign} from '../lib/seasonal/example.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import {addDays,validateConfig} from '../lib/seasonal/validation.ts';
const now='2026-10-30T08:00:00Z';
function pixel(value:number,compression=1,tiled=false,nodata=-32768){
 const n=13,head=8+2+n*12+4,raw=new Uint8Array(tiled?256*256*2:2);new DataView(raw.buffer).setInt16(0,value,true);
 const data=compression===1?raw:deflateSync(raw),bytes=new Uint8Array(head+10+data.length),v=new DataView(bytes.buffer);
 v.setUint16(0,0x4949);v.setUint16(2,42,true);v.setUint32(4,8,true);v.setUint16(8,n,true);
 const noData=new TextEncoder().encode(String(nodata)+'\0');bytes.set(noData,head);
 const tags=[[256,3,1,1],[257,3,1,1],[258,3,1,16],[259,3,1,compression],[277,3,1,1],[339,3,1,2],[tiled?324:273,4,1,head+10],[tiled?325:279,4,1,data.length],[42113,2,noData.length,head],[322,3,1,256],[323,3,1,256],[317,3,1,2],[284,3,1,1]];
 tags.forEach(([id,type,count,value],i)=>{const at=10+12*i;v.setUint16(at,id,true);v.setUint16(at+2,type,true);v.setUint32(at+4,count,true);if(type===3)v.setUint16(at+8,value,true);else v.setUint32(at+8,value,true);});bytes.set(data,head+10);return bytes.buffer;
}
const fakeFetch:typeof fetch=async(input)=>{
 const url=new URL(String(input));
 if(url.hostname==='maps.isric.org'){
  const prop=url.searchParams.get('COVERAGE')!.split('_')[0];
  const values:Record<string,number>={phh2o:63,soc:103,nitrogen:83,cec:131,sand:595,clay:187,wv0033:240,wv1500:110};
  return new Response(pixel(values[prop],8,true));
 }
 const dates=url.hostname==='archive-api.open-meteo.com'?['2023-10-30','2024-10-30','2025-10-30','2023-10-31','2024-10-31','2025-10-31']:['2026-10-30'];
 return Response.json({daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C'},daily:{time:dates,precipitation_sum:dates.map(()=>url.hostname==='archive-api.open-meteo.com'?3:1),et0_fao_evapotranspiration:dates.map(()=>5),temperature_2m_mean:dates.map(()=>27)}});
};
test('SoilGrids : TIFF brut, Deflate tuilé, no-data et formats rejetés',async()=>{
 assert.equal(await readSoilPixel(pixel(63)),63);assert.equal(await readSoilPixel(pixel(63,8,true)),63);
 assert.equal(await readSoilPixel(pixel(-32768)),null);assert.equal(await readSoilPixel(pixel(63,5)),null);
 assert.equal(await readSoilPixel(new TextEncoder().encode('<ServiceException/>').buffer),null);
 const corrupt=pixel(63);new DataView(corrupt).setUint32(4,99999,true);assert.equal(await readSoilPixel(corrupt),null);
});
test('Acquisition automatique : conversions, six horizons, prévision puis scénario explicite',async()=>{
 const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-30',2,fakeFetch,now);
 assert.equal(e.soil.ph,6.3);assert.equal(e.soil.totalN,.83);assert.equal(e.soil.organicC,10.3);assert.equal(e.soil.cec,13.1);assert.equal(e.soil.sand,59.5);
 assert.equal(e.soil.hydraulicLayers!.length,6);assert.equal(e.soil.hydraulicLayers!.reduce((s,l)=>s+l.thicknessM,0),2);
 assert.equal(e.soil.hydraulicLayers![0].thetaFC,.24);assert.equal(e.soil.hydraulicLayers![0].thetaWP,.11);
 assert.equal(e.weather[0].status,'forecast');assert.equal(e.weather[0].rainMm,1);assert.equal(e.weather[1].status,'scenario');assert.equal(e.weather[1].rainMm,3);assert.match(e.weather[1].source,/2023–2025/);
});
test('Sources inaccessibles : valeurs inconnues et météo manquante, aucun zéro inventé',async()=>{
 const bad:typeof fetch=async()=>{throw new Error('Offline');};
 const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-30',2,bad,now);
 assert.equal(e.soil.ph,null);assert.equal(e.soil.hydraulicLayers,undefined);assert.deepEqual(e.weather,[]);assert.equal(e.warnings.length,3);
 await assert.rejects(()=>loadEnvironment(NaN,1.2,'TGO','2026-10-30',2,bad,now),/Localisation/);
 await assert.rejects(()=>loadEnvironment(9.5,1.2,'TGO','2026-10-30',400,bad,now),/Cycle/);
});
test('Unités erronées et année historique incomplète ne remplissent pas le cycle',async()=>{
 const bad:typeof fetch=async input=>String(input).includes('mapserv')?new Response('missing'):Response.json({daily_units:{precipitation_sum:'inch'},daily:{time:['2026-10-30']}});
 const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-30',2,bad,now);assert.equal(e.weather.length,0);
 const partial=await loadEnvironment(9.5,1.2,'TGO','2026-10-31',2,fakeFetch,now);assert.equal(partial.weather.length,1);assert.equal(partial.weather[0].date,'2026-10-31');
});
test('Fusion : mesures prioritaires, ajustements préservés, propriétés hydriques réelles du modèle',async()=>{
 const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-30',2,fakeFetch,now);
 let c=automaticCampaign(emptyCampaign('2026-10-30'));c.asOfDate='2026-10-30';
 c.soilAnalyses=[{source:'Laboratoire local',date:'2026-10-29',availableOn:'2026-10-30',topCm:0,bottomCm:20,status:'measured',measurements:[{parameter:'pH',value:5.5,unit:'pH',method:'water'}]}];
 c.weather=[{date:'2026-10-30',rainMm:12,et0Mm:5,status:'observed',source:'Pluviomètre',availableAt:now}];
 e.context=environmentContext(c);const merged=mergeEnvironment(c,e);assert.equal(merged.soilAnalyses![0].measurements[0].value,5.5);assert.equal(merged.soilAnalyses!.flatMap(a=>a.measurements).filter(m=>m.parameter==='pH').length,1);
 assert.equal(merged.weather[0].rainMm,12);assert.equal(merged.soil.layers.length,6);assert.equal(validateConfig(merged).soil.layers.length,6);
 const custom=reconcileInputs(c,{...c,soil:{...c.soil,source:'Mesures hydriques locales',layers:c.soil.layers.map(l=>({...l,thetaFC:.31}))}});assert.equal(mergeEnvironment(custom,e).soil.layers.length,1);
});
test('Simulation automatique : cycle complet, sensibilité aux apports, pH sans faux effet sur le rendement',async()=>{
 const e=await loadEnvironment(9.5,1.2,'TGO','2026-10-30',2,fakeFetch,now);
 const c=declareScenario(automaticCampaign(emptyCampaign('2026-10-30')));c.asOfDate='2026-10-30';c.areaM2=1000;
 const all=mergeEnvironment(c,{...e,context:environmentContext(c),weather:Array.from({length:125},(_,i)=>({...e.weather[0],date:addDays('2026-10-30',i),status:'scenario'}))});
 const plan=planWater(all);assert.equal(plan.complete,true);assert.equal(plan.days.length,125);
 const wet=planWater({...all,weather:all.weather.map(w=>({...w,rainMm:10}))});assert.ok(wet.totals.netMm<plan.totals.netMm);
 const phOnly=structuredClone(all);phOnly.soilAnalyses![0].measurements.find(m=>m.parameter==='pH')!.value=5;
 assert.deepEqual(planWater(phOnly).totals,plan.totals);
 assert.equal(phSuitability(null,[5,7],[4,8]),null);assert.equal(phSuitability(6,[5,7],[4,8]),100);assert.equal(phSuitability(4.5,[5,7],[4,8]),50);
 assert.equal(automaticCampaign(c,'fonio').stages.length,0);assert.equal(automaticCampaign(c,'rice-flooded').stages.length,0);
});
