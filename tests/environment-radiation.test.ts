import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEnvironment} from '../lib/seasonal/environment.ts';
const now='2026-11-24T09:00:00Z';
test('radiation uses validated MJ/m² and field-wise historical completion preserves other forecast values',async()=>{
 for(const mode of ['complete','missing','wrong-unit'] as const){
  const urls:string[]=[];
  const provider:typeof fetch=async input=>{
   const url=new URL(String(input));urls.push(url.href);const archive=url.hostname==='archive-api.open-meteo.com';
   const dates=archive?['2023-11-24','2024-11-24','2025-11-24','2023-11-25','2024-11-25','2025-11-25']:['2026-11-24'];
   return Response.json({daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C',shortwave_radiation_sum:mode==='wrong-unit'?'W/m²':'MJ/m²'},daily:{time:dates,precipitation_sum:dates.map(()=>archive?3:1),et0_fao_evapotranspiration:dates.map(()=>5),temperature_2m_mean:dates.map(()=>27),shortwave_radiation_sum:archive?[12,18,24,12,18,24]:[mode==='missing'?null:22]}});
  };
  const e=await loadEnvironment(9.5,1.2,'BEN','2026-11-24',2,provider,now,undefined,false,null);
  assert.equal(urls.length,2);assert.ok(urls.every(u=>new URL(u).searchParams.get('daily')!.includes('shortwave_radiation_sum')));
  assert.equal(e.weather[0].rainMm,1);assert.equal(e.weather[0].provenance!.rainMm.status,'forecast');
  assert.equal(e.weather[0].radiationMj,mode==='complete'?22:mode==='missing'?18:null);
  assert.equal(e.weather[1].radiationMj,mode==='wrong-unit'?null:18);
  if(mode==='missing'){assert.equal(e.weather[0].provenance!.radiationMj.status,'scenario');assert.deepEqual(e.weather[0].provenance!.radiationMj.rawValue,[12,18,24]);}
  if(mode==='wrong-unit')assert.match(e.warnings.join(' '),/Rayonnement solaire quotidien indisponible sur 2 jours/);
 }
});
