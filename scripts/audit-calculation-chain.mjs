/** Repeat archived inputs through the actual application entry point.
 * Does not overwrite the historical experiments or use trial ratios as inputs.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {planSeason} from '../lib/seasonal/yield.ts';
import {ENGINE_VERSION} from '../lib/seasonal/types.ts';
import {createHash} from 'node:crypto';
Date.now=()=>Date.parse('2026-11-10T12:00:00Z');
const folder='research-data/alternative-models/2026-11-11/audit';await mkdir(folder,{recursive:true});
const source=JSON.parse(gunzipSync(await readFile('research-data/simulation-audit/2026-11-10/after.json.gz')));
function run(row,mutate=()=>{},events=row.reconstructionForcing){const c=structuredClone(row.config);mutate(c);const p=planSeason(c,events),s=p.growth?.scenarios.find(s=>s.id==='proposed');if(p.growth?.status!=='scenario')throw Error(JSON.stringify(p.growth?.missing));return {engine:p.engineVersion,growth:p.growth.engineVersion,yieldKgHa:s.yieldKgHa,productionKg:s.productionKg,areaM2:p.growth.areaM2,biomassKgHa:s.biomassKgHa,irrigationMm:s.water.irrigationNetMm,etMm:p.totals.actualEtMm,rootDrainMm:p.days.reduce((n,d)=>n+d.drainageMm,0),deepDrainMm:p.days.reduce((n,d)=>n+d.deepDrainageMm,0),maxRootBalanceResidualMm:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm))),maxProfileBalanceResidualMm:Math.max(...p.days.map(d=>Math.abs(d.profileBalanceResidualMm))),nutrientBalanceResidualKgHa:s.balance.residualKgHa,nutrientCeilingsKgHa:s.diagnostics.nutrientYieldCeilingsKgHa,limitedDays:s.diagnostics.nutrientLimitedDays,stressByStage:p.stages.map(s=>({stage:s.label,etaMm:s.actualEtMm,etmMm:s.demandMm})),stressDates:p.days.filter(d=>d.demandMm>0&&d.actualEtMm/d.demandMm<.99).map(d=>({date:d.date,stage:d.stageIndex,ratio:d.actualEtMm/d.demandMm}))};}
const trial=source.cases.slice(0,3).map(row=>({label:row.label,observedKgHa:row.observedKgHa,before:row.result.yieldKgHa,after:run(row)}));
const invariance=[];
for(const rue of [.5,1,2]){
 const rs=source.cases.slice(0,3).map(row=>run(row,c=>{c.growth.soilSupply={initialKgHa:[10000,10000,10000],releaseKgHaDay:[0,0,0],source:'Nonlimiting diagnostic only; NOT a soil analysis'};c.growth.parameters.rueGPerMj=rue;c.growth.parameters.harvestIndex=.45;}));
 invariance.push({rue,hi:.45,yieldsKgHa:rs.map(r=>r.yieldKgHa),ratios:rs.map(r=>r.yieldKgHa/rs[0].yieldKgHa)});
}
const sweep=[];for(const factor of [1,.8,.6,.4,.2,.1,0])sweep.push({factor,...run(source.cases[0],()=>{},source.cases[0].reconstructionForcing.map(e=>({...e,amount:e.amount*factor})))});
const hashes={};for(const file of ['lib/seasonal/engine.ts','lib/seasonal/growth.ts','lib/seasonal/yield.ts','lib/seasonal/validation.ts'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const es=trial.map(r=>r.after.yieldKgHa-r.observedKgHa),rmse=Math.sqrt(es.reduce((n,e)=>n+e*e,0)/es.length);
const result={engine:ENGINE_VERSION,sourceDoi:source.sourceDoi,sourceSha256:hashes,scope:'Exploratory Togo reconstruction with stage totals uniformly distributed, not observed daily irrigation',trial,grainMetrics:{n:3,maeKgHa:es.reduce((n,e)=>n+Math.abs(e),0)/3,rmseKgHa:rmse,biasKgHa:es.reduce((n,e)=>n+e,0)/3,nrmsePercent:100*rmse/(trial.reduce((n,r)=>n+r.observedKgHa,0)/3)},nonlimitingScaleInvariance:invariance,allIrrigationDoseSweep:sweep,arithmeticCorrection:{computedRatio:1,observedFigureReadingBounds:[.813,.851],inside:1>=.813&&1<=.851,note:'False: 1.000 is outside [0.813,0.851]. Figure-reading uncertainty is not biological or predictive variability.'},limits:['The K ceiling is conditional on illustrative accessible K and fixed demand, not a field diagnosis.','80% treatment has only late-stage stress in the uniform-calendar reconstruction; reducing its predicted yield by 17% would require additional evidence, not an invented multiplier.','Grain humidity 12-14% in Togo versus 15.5% in LIRF; no pooling of those native masses.','The application can display integrated growth, a FAO water response, or a QUEFTS scenario: compare the same calculation, input calendar and scenario mode.']};
if(result.arithmeticCorrection.inside)throw Error('Arithmetic error');
for(const r of [...trial.map(t=>t.after),...sweep])if(r.maxRootBalanceResidualMm>1e-7||r.maxProfileBalanceResidualMm>1e-7||r.nutrientBalanceResidualKgHa.some(n=>Math.abs(n)>1e-7))throw Error('Mass balance failed');
const maxRatioChange=Math.max(...invariance.flatMap(r=>r.ratios.map((v,i)=>Math.abs(v-invariance[0].ratios[i]))));if(maxRatioChange>1e-9)throw Error('Unexpected RUE scale dependence');
await writeFile(folder+'/results.json',JSON.stringify({...result,maxRatioChange},null,2)+'\n');
console.log(JSON.stringify({trial:trial.map(r=>({label:r.label,observed:r.observedKgHa,before:r.before,after:r.after.yieldKgHa})),grain:result.grainMetrics,maxRatioChange,maxProfileResidual:Math.max(...trial.map(r=>r.after.maxProfileBalanceResidualMm)),doseSweep:sweep.map(r=>({factor:r.factor,yield:r.yieldKgHa}))},null,2));
