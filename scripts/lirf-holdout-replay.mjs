import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {config} from './lirf-replay.mjs';
import {planSeason} from '../lib/seasonal/yield.ts';
const folder='research-data/lirf/2026-11-10',a=JSON.parse(gunzipSync(await readFile(folder+'/holdout-2011-adapter.json.gz'))),freeze=JSON.parse(await readFile(folder+'/profile-frozen-2012.json','utf8'));
const previous=JSON.parse(await readFile(folder+'/replay-summary.json','utf8'));
const single=previous.fits.find(f=>f.mode==='single'&&f.wpRatio===.5),wp=freeze.profile;
const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;
const records=[];
for(const efficiency of [.9,1])for(const mode of ['single','dual-wp'])for(const row of a.cases){
 const c=config(row,mode==='dual-wp',.5);c.system.applicationEfficiency=efficiency;
 const fit=mode==='single'?single:wp;c.growth.parameters.harvestIndex=fit.harvestIndex;
 if(mode==='single')c.growth.parameters.rueGPerMj=fit.rueGPerGlobalMj;
 else c.growth.parameters.biomassModel={kind:'transpiration-normalized',waterProductivityGm2:fit.waterProductivityGm2,source:'Frozen 2012-only effective WP; no 2011 adjustment',availableOn:'2013-01-01'};
 const p=planSeason(c,row.events),s=p.growth?.scenarios.find(s=>s.id==='proposed');
 if(!s||p.growth.status!=='scenario')throw Error(JSON.stringify(p.growth?.missing));
 records.push({mode,efficiency,treatment:row.treatment,observedGrainKgHa:mean(row.annualObservations.map(o=>o.grainKgHa)),predictedGrainKgHa:s.yieldKgHa,observedBiomassKgHa:mean(row.annualObservations.map(o=>o.biomassKgHa)),predictedBiomassKgHa:s.biomassKgHa,etMm:p.totals.actualEtMm,fieldEtMm:row.annualObservations[0].etMm,plots:row.annualObservations.map(o=>o.plot),maxBalanceResidualMm:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm)))});
}
const results=[];
for(const efficiency of [.9,1])for(const mode of ['single','dual-wp']){
 const rs=records.filter(r=>r.mode===mode&&r.efficiency===efficiency),es=rs.map(r=>r.predictedGrainKgHa-r.observedGrainKgHa),rmse=Math.sqrt(mean(es.map(e=>e*e)));
 results.push({mode,efficiency,nTreatmentMeans:6,nSeasons:1,rmseKgHa:rmse,maeKgHa:mean(es.map(Math.abs)),biasKgHa:mean(es),nrmsePercent:100*rmse/mean(rs.map(r=>r.observedGrainKgHa))});
}
await writeFile(folder+'/holdout-2011-results.json',JSON.stringify({frozenProfile:wp,no2011Fitting:true,results,records,limits:a.limits},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
