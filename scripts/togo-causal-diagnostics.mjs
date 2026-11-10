/** Reproduce the frozen causal protocol; no parameter fitting or campaign writes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {planSeason} from '../lib/seasonal/yield.ts';
import {growthScope} from '../lib/seasonal/growth.ts';
const folder='research-data/togo-causal/2026-11-10';await mkdir(folder,{recursive:true});
const source=JSON.parse(gunzipSync(await readFile('research-data/simulation-audit/2026-11-10/after.json.gz')));
const calendars=[{id:'daily',interval:1,phase:0},{id:'pulse3-start',interval:3,phase:0},{id:'pulse3-end',interval:3,phase:2},{id:'pulse7-start',interval:7,phase:0},{id:'pulse7-end',interval:7,phase:6}];
function events(config,index,calendar,nonlimitingWater){
 const maximumStore=config.soil.layers.reduce((n,l)=>n+1000*l.thicknessM*(l.thetaFC-l.thetaWP),0),maximumDemand=Math.max(...config.weather.map(w=>w.et0Mm))*Math.max(...config.stages.map(s=>Math.max(s.kcStart,s.kcEnd)));
 let offset=0;const rows=[];
 for(const [si,stage] of config.stages.entries()){
  const dates=Array.from({length:stage.days},(_,i)=>i).filter(i=>nonlimitingWater||i%calendar.interval===calendar.phase);
  if(!dates.length)throw Error('Calendar has no event in a stage');
  const amount=nonlimitingWater?maximumStore+maximumDemand:source.published.irrigationMm[index][si]/dates.length;
  for(const i of dates)rows.push({id:'scenario-'+(offset+i),date:new Date(Date.parse(config.sowingDate)+(offset+i)*86400000).toISOString().slice(0,10),kind:'irrigation',amount,unit:'mm',point:'field',status:'declared',source:'DIAGNOSTIC SCENARIO: hypothetical calendar, NOT measured irrigation',recordedAt:'2026-11-10T00:00:00Z',landSelection:config.landSelection});
  if(!nonlimitingWater&&Math.abs(rows.filter(r=>r.date>=new Date(Date.parse(config.sowingDate)+offset*86400000).toISOString().slice(0,10)).reduce((n,r)=>n+r.amount,0)-source.published.irrigationMm[index][si])>1e-8)throw Error('Stage total mismatch');
  offset+=stage.days;
 }
 return rows;
}
const records=[];
for(const experiment of ['A-original','B-nutrition-unlimited','C-water-unlimited','D-both-unlimited'])for(const calendar of (experiment.startsWith('C')||experiment.startsWith('D')?[calendars[0]]:calendars))for(let i=0;i<3;i++){
 const c=structuredClone(source.cases[i].config),nutrition=experiment.startsWith('B')||experiment.startsWith('D'),water=experiment.startsWith('C')||experiment.startsWith('D');
 if(nutrition)c.growth.soilSupply={initialKgHa:[1000,1000,1000],releaseKgHaDay:[0,0,0],source:'Diagnostic synthetic nonlimiting nutrients; NOT inferred soil fertility'};
 c.growth.scope=growthScope(c);const forcing=events(c,i,calendar,water),plan=planSeason(c,forcing),g=plan.growth;
 if(g?.status!=='scenario')throw Error(JSON.stringify(g?.missing??plan.missing));
 const s=g.scenarios.find(r=>r.id==='proposed'),days=s.days;
 if(days.some(d=>Math.abs(plan.days.find(w=>w.date===d.date).balanceResidualMm)>1e-8||d.nutrientBalanceResidualKgHa.some(n=>Math.abs(n)>1e-8)))throw Error('Daily balance failure');
 const byStage=c.stages.map((stage,j)=>{const rows=days.filter(d=>d.stage===stage.name),ws=plan.days.filter(d=>d.stageIndex===j),sum=k=>ws.reduce((n,w)=>n+w[k],0);return {name:stage.name,days:rows.length,etaMm:sum('actualEtMm'),etmMm:sum('demandMm'),irrigationNetMm:sum('irrigationNetMm'),drainageMm:sum('drainageMm'),runoffMm:sum('runoffMm'),meanBiomassKgHa:rows.reduce((n,d)=>n+d.biomassKgHa,0)/rows.length,endBiomassKgHa:rows.at(-1).biomassKgHa,meanFapar:rows.reduce((n,d)=>n+d.fapar,0)/rows.length,minWaterFactor:Math.min(...rows.map(d=>d.waterFactor)),waterLimitedDays:rows.filter(d=>d.waterFactor<1-1e-9).length};});
 records.push({experiment,calendar:calendar.id,treatment:['FI','80','60'][i],observedKgHa:source.published.observedKgHa[i],yieldKgHa:s.yieldKgHa,yieldDryKgHa:s.yieldDryKgHa,biomassKgHa:s.biomassKgHa,moisturePercent:13,harvestIndex:c.growth.parameters.harvestIndex,water:s.water,balance:s.balance,diagnostics:s.diagnostics,byStage,days,forcing});
}
const contrasts=[];
for(const experiment of ['A-original','B-nutrition-unlimited','C-water-unlimited','D-both-unlimited'])for(const calendar of [...new Set(records.filter(r=>r.experiment===experiment).map(r=>r.calendar))]){
 const rs=records.filter(r=>r.experiment===experiment&&r.calendar===calendar),fi=rs[0],mean=rs.reduce((n,r)=>n+r.observedKgHa,0)/rs.length,errors=rs.map(r=>r.yieldKgHa-r.observedKgHa),rmse=Math.sqrt(errors.reduce((n,e)=>n+e*e,0)/3);
 for(const r of rs.slice(1)){
  const first=key=>r.days.findIndex((d,i)=>Math.abs(key(d)-key(fi.days[i]))>1e-7),firstDiff=first(d=>d.biomassKgHa),maxDiff=Math.max(...r.days.map((d,i)=>Math.abs(d.biomassKgHa-fi.days[i].biomassKgHa))),atMax=r.days.findIndex((d,i)=>Math.abs(d.biomassKgHa-fi.days[i].biomassKgHa)===maxDiff);
  contrasts.push({experiment,calendar,treatment:r.treatment,ratioVsFI:r.yieldKgHa/fi.yieldKgHa,deltaYieldVsFI:r.yieldKgHa-fi.yieldKgHa,deltaBiomassVsFI:r.biomassKgHa-fi.biomassKgHa,firstWaterFactorDivergence:r.days[first(d=>d.waterFactor)]?.date??null,firstBiomassDivergence:r.days[firstDiff]?.date??null,maxBiomassDifferenceKgHa:maxDiff,dateMaxBiomassDifference:r.days[atMax]?.date??null,lastDivergence:r.days.filter((d,i)=>Math.abs(d.biomassKgHa-fi.days[i].biomassKgHa)>1e-7).at(-1)?.date??null,firstKLimited:r.days.find(d=>d.limitingNutrients.includes('K'))?.date??null,metrics:{n:3,maeKgHa:errors.reduce((n,e)=>n+Math.abs(e),0)/3,rmseKgHa:rmse,biasKgHa:errors.reduce((n,e)=>n+e,0)/3,nrmsePercent:100*rmse/mean}});
 }
}
const original=records.find(r=>r.experiment==='A-original'&&r.calendar==='daily'&&r.treatment==='FI');
const formula={suppliedKKgHa:original.balance.suppliedKgHa[2],kDemandKgPerTonneBiomass:15,harvestIndex:.45,dryMatterFraction:.87,ceilingTonneHa:original.balance.suppliedKgHa[2]/15*.45/.87,simulatedTonneHa:original.yieldKgHa/1000};
const result={protocolSha256:createHash('sha256').update(await readFile(folder+'/PROTOCOL.md')).digest('hex'),engines:{water:'water-balance-1.4.0',growth:planSeason(source.cases[0].config,source.cases[0].reconstructionForcing).growth.engineVersion},limits:['Diagnostic scenarios, no calibration or independent validation.','RUE fAPAR is intercepted radiation fraction, not measured canopy cover.','Evaporation/transpiration are not separately identifiable in the single-Kc engine.'],formula,publishedEtcMm:755.2,etmReconstructedMm:original.water.etmMm,observedRatios:{Y80_YFI:1830.9/2200.4,Y60_YFI:1068.3/2200.4},calendars,records,contrasts};
await writeFile(folder+'/rue-daily.json.gz',gzipSync(JSON.stringify(result),{mtime:0}));
await writeFile(folder+'/rue-summary.json',JSON.stringify({...result,records:records.map(({days,forcing,...r})=>{void days;void forcing;return r;})},null,2)+'\n');
const headers=['experiment','calendar','treatment','date','stage','rain_mm','irrigation_field_mm','irrigation_net_mm','water_stock_start_mm','water_stock_end_mm','drainage_mm','runoff_mm','et_demand_mm','et_actual_mm','water_factor','radiation_global_mj_m2','radiation_intercepted_mj_m2','temperature_factor','biomass_potential_before_water_kg_ha','biomass_potential_before_nutrition_kg_ha','stock_N_start','stock_P_start','stock_K_start','supply_N','supply_P','supply_K','uptake_N','uptake_P','uptake_K','stock_N_end','stock_P_end','stock_K_end','nutrient_factor','biomass_increment_kg_ha','biomass_cumulative_kg_ha','assumed_HI','root_gain_mm','water_assimilation_mm'];
const rows=records.flatMap(r=>r.days.map(d=>[r.experiment,r.calendar,r.treatment,d.date,d.stage,d.water.rainMm,d.water.irrigationFieldMm,d.water.irrigationNetMm,d.water.stockStartMm,d.water.stockEndMm,d.water.drainageMm,d.water.runoffMm,d.water.demandMm,d.water.actualEtMm,d.waterFactor,d.radiationMj,d.interceptedRadiationMj,d.temperatureFactor,d.potentialBeforeWaterKgHa,d.potentialBeforeNutritionKgHa,...d.nutrientStockStartKgHa,...d.nutrientSupplyKgHa,...d.nutrientUptakeKgHa,...d.stockKgHa,d.nutrientFactor,d.incrementKgHa,d.biomassKgHa,d.assumedHarvestIndex,d.water.rootGainMm,d.water.assimilationMm]));
const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await writeFile(folder+'/rue-daily.csv.gz',gzipSync([headers,...rows].map(row=>row.map(q).join(',')).join('\n')+'\n',{mtime:0}));
console.log(JSON.stringify({formula,etm:result.etmReconstructedMm,contrasts:contrasts.filter(r=>r.calendar==='daily'),calendars:records.filter(r=>r.experiment==='A-original').map(r=>({calendar:r.calendar,treatment:r.treatment,y:r.yieldKgHa,stress:r.diagnostics.waterLimitedDays}))},null,2));
