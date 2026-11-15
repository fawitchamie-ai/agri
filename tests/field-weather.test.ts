import test from 'node:test';import assert from 'node:assert/strict';
import {loadForecast} from '../lib/seasonal/weather.ts';
test('field weather preserves temperature units, forecast status and availability without inventing missing readings',async()=>{
 const fetcher=(async()=>Response.json({daily_units:{precipitation_sum:'mm',et0_fao_evapotranspiration:'mm',temperature_2m_min:'°C',temperature_2m_max:'°C',temperature_2m_mean:'°C'},daily:{time:['2026-11-15','2026-11-16'],precipitation_sum:[0,null],et0_fao_evapotranspiration:[5,6],temperature_2m_min:[20,null],temperature_2m_max:[32,34],temperature_2m_mean:[26,27]}})) as typeof fetch;
 const r=await loadForecast(9.4,1.2,'Africa/Lome',fetcher,'2026-11-15T08:00:00Z');
 assert.equal(r.weather[0].temperatureMinC,20);assert.equal(r.weather[0].provenance!.temperatureMinC.unit,'°C');assert.equal(r.weather[0].provenance!.temperatureMinC.status,'forecast');
 assert.equal(r.weather[1].rainMm,null);assert.equal(r.weather[1].temperatureMinC,null);assert.equal(r.weather[1].provenance!.temperatureMinC.status,'missing');assert.ok(r.weather.every(w=>w.status==='forecast'&&w.availableAt==='2026-11-15T08:00:00Z'));
});
