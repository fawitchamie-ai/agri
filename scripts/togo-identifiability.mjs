import {readFile,writeFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {planSeason} from '../lib/seasonal/yield.ts';
const source=JSON.parse(gunzipSync(await readFile('research-data/simulation-audit/2026-11-10/after.json.gz'))),rows=[];
for(const mode of ['supply-only','supply-HI-confounding'])for(const q of [.95,1,1.05])for(const item of source.cases.slice(0,3)){
 const c=structuredClone(item.config),g=c.growth;g.soilSupply.initialKgHa=g.soilSupply.initialKgHa.map(n=>n*q);g.soilSupply.releaseKgHaDay=g.soilSupply.releaseKgHaDay.map(n=>n*q);g.parameters.fertilizerRecovery=g.parameters.fertilizerRecovery.map(n=>n*q);
 if(mode==='supply-HI-confounding')g.parameters.harvestIndex/=q;
 const r=planSeason(c,item.reconstructionForcing).growth;if(r?.status!=='scenario')throw Error(JSON.stringify(r?.missing));const s=r.scenarios.find(s=>s.id==='proposed');
 rows.push({mode,q,treatment:item.label,HI:g.parameters.harvestIndex,KsupplyKgHa:s.balance.suppliedKgHa[2],biomassKgHa:s.biomassKgHa,yieldKgHa:s.yieldKgHa});
}
await writeFile('research-data/togo-causal/2026-11-10/identifiability.json',JSON.stringify({calibration:false,rangeStatus:'Exploratory mathematical perturbation, not a statistical interval',rows},null,2)+'\n');console.log(JSON.stringify(rows));
