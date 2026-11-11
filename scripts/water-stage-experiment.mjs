/** Distinct statistical yield-production hypothesis: predict water first,
 * then estimate grain from two stage water ratios, without invented soil NPK.
 * US fits remain experimental; no coefficients are copied into country defaults.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {config} from './lirf-replay.mjs';
import {planSeason} from '../lib/seasonal/yield.ts';
const folder='research-data/alternative-models/2026-11-11/water';await mkdir(folder,{recursive:true});
// Pin the replay clock to the archived synthetic land fixture, not today's map.
// No historical land measurement is refreshed or invented by this experiment.
Date.now=()=>Date.parse('2026-11-10T12:00:00Z');
await writeFile(folder+'/protocol-before-fit.json',JSON.stringify({version:'stage-water-2026-11-11.1',freeParameters:['Jensen log reference yield','one nonnegative vegetative exponent','one nonnegative reproductive exponent'],training:'2012 treatment means only',evaluation:'2013 and 2011; previously explored outcomes, not blind',model:'Y=Ym*(ETa_veg/ETm_veg)^lambdaV*(ETa_repro/ETm_repro)^lambdaR',inputET:'computed using production daily water balance; field balance ET excluded from predictor',alternatives:['constant 2012 training mean','FAO seasonal Ky=1.25 fitted reference on 2012 only','Jensen 2-stage fitted on 2012 only'],noTreatmentCoefficients:true,noUniversalTransfer:true},null,2)+'\n');
const cases=[];for(const path of ['research-data/lirf/2026-11-10/adapter.json.gz','research-data/lirf/2026-11-10/holdout-2011-adapter.json.gz'])cases.push(...JSON.parse(gunzipSync(await readFile(path))).cases);
const records=[];
for(const row of cases){
 const c=config(row,true);delete c.growth;
 const p=planSeason(c,row.events.map(e=>({...e,landSelection:c.landSelection})));
 if(!p.complete)throw Error(JSON.stringify(p.missing));
 const phases=[p.days.filter(d=>d.stageIndex<2),p.days.filter(d=>d.stageIndex>=2)];
 const sums=ds=>({eta:ds.reduce((n,d)=>n+d.actualEtMm,0),etm:ds.reduce((n,d)=>n+d.demandMm,0),tr:ds.reduce((n,d)=>n+d.dualKc.transpirationMm,0),trm:ds.reduce((n,d)=>n+d.dualKc.transpirationDemandMm,0)});
 const obs=row.annualObservations.map(o=>o.grainKgHa).filter(v=>typeof v==='number');
 records.push({id:row.id,year:row.year,treatment:row.treatment,observedKgHa:obs.reduce((n,v)=>n+v,0)/obs.length,nPlots:obs.length,plots:row.annualObservations.map(o=>({id:o.plot,yieldKgHa:o.grainKgHa})),phases:phases.map(sums),season:sums(p.days),maxBalanceResidual:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm)))});
}
await writeFile(folder+'/computed-water-features.json',JSON.stringify({records},null,2)+'\n');
console.log('Computed known-input water features:',records.length,'treatment-seasons');
