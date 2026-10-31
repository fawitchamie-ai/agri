// Optional live acquisition audit. No network requests are made by the unit tests.
// Run: node --use-env-proxy --experimental-transform-types scripts/check-nasa-six-countries.mjs
import {loadNasaHistory} from '../lib/seasonal/nasa.ts';
import {writeFile} from 'node:fs/promises';
const now=new Date().toISOString(),asOf=now.slice(0,10),results=[];
for(const [country,latitude,longitude] of [['TGO',9.5,1.2],['BEN',9.3,2.4],['BFA',12.3,-1.6],['GHA',8,-1.1],['CIV',7.5,-5.5],['SEN',14.4,-14.5]]){
 try{
  const r=await loadNasaHistory(latitude,longitude,'2025-01-01','2025-01-03',asOf,fetch,now);
  results.push({country,requestedPoint:[longitude,latitude],queryPoint:r.point,requestedDays:r.requestedDays,availableDays:r.availableDays,completeWaterDays:r.weather.filter(w=>w.rainMm!==null&&w.et0Mm!==null).length,observations:r.weather.map(w=>({date:w.date,rainMm:w.rainMm,et0Mm:w.et0Mm,temperatureMinC:w.temperatureMinC,temperatureMaxC:w.temperatureMaxC,sourceVersion:w.provenance.et0Mm.productVersion,acquiredAt:w.provenance.et0Mm.acquiredAt})),limits:r.limits});
 }catch(e){results.push({country,error:e.message});}
 console.log(country,results.at(-1).error??`${results.at(-1).completeWaterDays}/3 jours pluie+ET0`);
}
const report={generatedAt:now,scope:'Acquisition réelle NASA POWER à un point par pays, trois jours historiques. Ni validation de rendement ni test de toutes les parcelles.',source:'https://power.larc.nasa.gov/docs/services/api/temporal/daily/',et0Method:'FAO56 Penman–Monteith, G journalier nul, albédo 0,23. Unités NASA strictement contrôlées.',results};
await writeFile(`docs/verification-nasa-six-pays-${asOf.replaceAll('-','')}.json`,JSON.stringify(report,null,2)+'\n');
if(results.some(r=>r.error||r.completeWaterDays!==3))process.exitCode=1;
