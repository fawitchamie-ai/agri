import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEnvironment} from '../lib/seasonal/environment.ts';
import {automaticCampaign,mergeEnvironment} from '../lib/seasonal/automatic.ts';
import {emptyCampaign} from '../lib/seasonal/example.ts';
import {environmentContext} from '../lib/seasonal/provenance.ts';

const now='2026-11-24T09:00:00Z';
const dates=['2024-08-01','2024-08-02'];
const moistureVariables=['soil_moisture_0_to_7cm','soil_moisture_7_to_28cm','soil_moisture_28_to_100cm','soil_moisture_100_to_255cm'];

test('cycle passé : météo quotidienne de ses dates exactes et humidité ERA5-Land restent traçables',async()=>{
 const urls:string[]=[];
 const provider:typeof fetch=async input=>{
  const url=new URL(String(input));urls.push(url.href);
  if(url.hostname==='maps.isric.org')return new Response('no TIFF for synthetic test');
  if(url.searchParams.has('hourly')){
   const time=dates.flatMap(date=>Array.from({length:24},(_,hour)=>`${date}T${String(hour).padStart(2,'0')}:00`));
   return Response.json({hourly_units:Object.fromEntries(moistureVariables.map(key=>[key,'m³/m³'])),hourly:{time,...Object.fromEntries(moistureVariables.map((key,layer)=>[key,time.map(()=>.1+layer*.05)]))}});
  }
  assert.equal(url.searchParams.get('start_date'),dates[0]);
  assert.equal(url.searchParams.get('end_date'),dates[1]);
  return Response.json({
   latitude:6.3,longitude:1.2,timezone:'Africa/Lome',
   daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_mean:'°C',temperature_2m_min:'°C',temperature_2m_max:'°C',relative_humidity_2m_mean:'%',wind_speed_10m_mean:'m/s',shortwave_radiation_sum:'MJ/m²'},
   daily:{time:dates,precipitation_sum:[7,2],et0_fao_evapotranspiration:[4,5],temperature_2m_mean:[25,26],temperature_2m_min:[20,21],temperature_2m_max:[30,31],relative_humidity_2m_mean:[75,70],wind_speed_10m_mean:[2,3],shortwave_radiation_sum:[18,19]},
  });
 };

 const environment=await loadEnvironment(6.3,1.2,'TGO',dates[0],2,provider,now,undefined,false,[1.2,6.3]);
 assert.equal(urls.filter(value=>new URL(value).hostname==='api.open-meteo.com').length,0);
 assert.equal(urls.filter(value=>new URL(value).hostname==='archive-api.open-meteo.com').length,2);
 assert.ok(urls.some(value=>new URL(value).searchParams.get('models')==='era5_land'));
 assert.deepEqual(environment.weather.map(day=>day.date),dates);
 assert.deepEqual(environment.weather.map(day=>day.rainMm),[7,2]);
 assert.deepEqual(environment.weather.map(day=>day.status),['estimated','estimated']);
 assert.equal(environment.weather[0].temperatureMinC,20);
 assert.equal(environment.weather[0].humidityPercent,75);
 assert.equal(environment.weather[0].provenance!.rainMm.product,'Historical Weather API · date exacte');
 assert.match(environment.weather[0].provenance!.rainMm.replacementReason!,/pas d’une station/);
 assert.equal(environment.soilMoistureHistory!.length,2);
 assert.deepEqual(environment.soilMoistureHistory![0].layers.map(layer=>layer.validHours),[24,24,24,24]);
 const expectedMoisture=[.1,.15,.2,.25];
 assert.ok(environment.soilMoistureHistory![0].layers.every((layer,index)=>Math.abs(layer.waterContentM3M3!-expectedMoisture[index])<1e-12));

 const campaign=automaticCampaign(emptyCampaign(dates[0]));campaign.asOfDate=now.slice(0,10);
 const initialTheta=campaign.soil.layers.map(layer=>layer.initialTheta);
 environment.context=environmentContext(campaign);
 const merged=mergeEnvironment(campaign,environment);
 assert.ok(Math.abs(Number(merged.inputs!.values['source.soil.historicalMoisture.2024-08-01.0-7cm'].value)-.1)<1e-12);
 assert.equal(merged.inputs!.values['source.soil.historicalMoisture.2024-08-01.0-7cm'].status,'estimated');
 assert.ok(Math.abs(Number(merged.inputs!.values['source.soil.historicalMoisture.2024-08-02.7-28cm'].value)-.15)<1e-12,'the whole daily series is stored');
 assert.deepEqual(merged.soil.layers.map(layer=>layer.initialTheta),initialTheta,'reanalysis moisture remains contextual and cannot silently reset model soil water');
});
