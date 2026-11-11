/** Execute the PRODUCTION entry point; freeze shared coefficients on 2012 only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {growthTemplate,growthScope} from '../lib/seasonal/growth.ts';
import {emptyManagement} from '../lib/seasonal/management.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
const folder='research-data/lirf/2026-11-10';
const data=JSON.parse(gunzipSync(await readFile(folder+'/adapter.json.gz')));
const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;
const observedMean=a=>a.length?mean(a):null;
const metrics=input=>{const rows=input.filter(r=>r.every(v=>typeof v==='number'&&Number.isFinite(v)));if(!rows.length)return {n:0,status:'unavailable',mae:null,rmse:null,bias:null,nrmsePercent:null};const es=rows.map(([p,o])=>p-o),rmse=Math.sqrt(mean(es.map(e=>e*e)));return {n:es.length,mae:mean(es.map(Math.abs)),rmse,bias:mean(es),nrmsePercent:100*rmse/mean(rows.map(([,o])=>o))};};
const shape={type:'Polygon',coordinates:[[[-104.64,40.445],[-104.639,40.445],[-104.639,40.446],[-104.64,40.446],[-104.64,40.445]]]};
const land=assessLandGeometry(shape,[{id:'worldcover',status:'available',provider:'Computational fixture, not land measurement',product:'Synthetic terrestrial mask for point-process replay',version:'1',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-10T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'replay',value:40,geometry:shape}],reason:null,assets:[],limitations:['Not the observed trial boundary']}],'2026-11-10T00:00:00Z');
export function config(row,dual,wpRatio=.5){
 const c=applyCropProfile(exampleCampaign(row.sowingDate),'maize');c.asOfDate='2026-11-10';c.country='TGO';c.name=row.id;c.territory='USDA LIRF Colorado, country field is computational envelope only';c.variety='DK52-04, replay, not a transferred cultivar';
 c.parcelGeometry=shape;c.areaM2=parcelMetrics(shape).areaM2;c.landAssessment=land;c.landSelection='potentialLand';c.waterCondition='drained';
 c.stages=structuredClone(row.stages);c.soil=structuredClone(row.soil);c.soil.layers.forEach(l=>{const fraction=(l.initialTheta-l.thetaWP)/(l.thetaFC-l.thetaWP);l.thetaWP=l.thetaFC*wpRatio;l.initialTheta=l.thetaWP+fraction*(l.thetaFC-l.thetaWP);});
 c.weather=row.weather;c.fallback=null;c.parameterSource='LIRF retrospective stage reconstruction; no independently measured WP';
 c.system={...c.system,sourceBudgetM3:null,sourceFlowM3h:null,hoursPerDay:null,applicationEfficiency:1,transportEfficiency:1,maxNetMmPerDay:null};
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';
 c.growth=growthTemplate(c);c.growth.availableOn='2012-01-01';c.growth.parameters.moisturePercent=15.5;
 c.growth.parameters.temperatureC=[0,15,35,50];
 c.growth.parameters.stages=[{faparStart:0,faparEnd:.12,waterSensitivity:1},{faparStart:.12,faparEnd:.95,waterSensitivity:1},{faparStart:.95,faparEnd:.95,waterSensitivity:1},{faparStart:.95,faparEnd:.15,waterSensitivity:1}];
 c.growth.soilSupply={initialKgHa:[10000,10000,10000],releaseKgHaDay:[0,0,0],source:'Nonlimiting nutrients DIAGNOSTIC ONLY; not measured available NPK'};
 if(dual)c.waterModel={version:'fao56-dual-1',source:'FAO56 table17 maize Kcb, REW8/TEW20 and drip fraction .3 are transferred scenarios, not local calibration',availableOn:'2012-01-01',readilyEvaporableMm:8,totalEvaporableMm:20,initialDepletionMm:15,wettedFraction:.3,kcMax:1.25,stages:[{kcbStart:.15,kcbEnd:.15,coverStart:0,coverEnd:.12},{kcbStart:.15,kcbEnd:1.15,coverStart:.12,coverEnd:.95},{kcbStart:1.15,kcbEnd:1.15,coverStart:.95,coverEnd:.95},{kcbStart:1.15,kcbEnd:.15,coverStart:.95,coverEnd:.15}]};
 c.growth.scope=growthScope(c);return c;
}
if(process.argv[1]?.endsWith('lirf-replay.mjs')){
// Archived synthetic geometry is evaluated at its original replay clock.
Date.now=()=>Date.parse('2026-11-10T12:00:00Z');
const outputFolder=process.env.LIRF_REPLAY_OUTPUT??folder;
const records=[];
for(const wpRatio of [.35,.5,.65])for(const mode of ['single','dual','dual-wp'])for(const row of data.cases){
 const c=config(row,mode!=='single',wpRatio);if(mode==='dual-wp')c.growth.parameters.biomassModel={kind:'transpiration-normalized',waterProductivityGm2:25,source:'Effective WP diagnostic initialized at 25, fitted ONLY on 2012 biomass',availableOn:'2012-01-01'};
 const p=planSeason(c,row.events.map(e=>({...e,landSelection:c.landSelection})));
 if(!p.complete||p.growth?.status!=='scenario')throw Error(row.id+JSON.stringify(p.growth?.missing??p.missing));
 const g=p.growth.scenarios.find(s=>s.id==='proposed');
 const obs=row.annualObservations.filter(o=>o.grainKgHa!==null),etRows=p.days.map((d,i)=>[d.actualEtMm,row.dailyDiagnostics[i].etFieldBalanceMm]).filter(([,o])=>o!==null);
 const reserveRows=p.days.flatMap((d,i)=>{const obs=row.dailyDiagnostics[i].deficit105Mm;return obs!==null&&Math.abs(d.rootM-1.05)<1e-8?[[d.depletionMm,obs]]:[];});
 const coverRows=row.coverObservations.map(o=>{const index=p.days.findIndex(d=>d.date===o.date);return index>=0?[p.days[index].dualKc?.cover??g.days[index].fapar,o.cover]:null;}).filter(Boolean);
 const maxBalance=Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm)));
 if(maxBalance>1e-7)throw Error('Water balance '+row.id);
 records.push({id:row.id,year:row.year,treatment:row.treatment,mode,wpRatio,engine:p.engineVersion,growthVersion:p.growth.engineVersion,observedGrainKgHa:mean(obs.map(o=>o.grainKgHa)),observedBiomassKgHa:observedMean(row.annualObservations.map(o=>o.biomassKgHa).filter(v=>typeof v==='number')),grainPlotObservations:obs.map(o=>({plot:o.plot,block:o.plot.slice(0,2),grainKgHa:o.grainKgHa})),observedEtAnnualMm:mean(obs.map(o=>o.etMm)),predictedEtMm:p.totals.actualEtMm,fieldEtDailySumMm:etRows.reduce((n,[,o])=>n+o,0),rawBiomassKgHa:g.biomassKgHa,rawGrainKgHa:g.yieldKgHa,etDailyMetrics:metrics(etRows),reserve105Metrics:reserveRows.length?metrics(reserveRows):null,coverMetrics:coverRows.length?metrics(coverRows):null,maxBalanceResidualMm:maxBalance,days:p.days.map((d,i)=>({date:d.date,etMm:d.actualEtMm,transpirationMm:d.dualKc?.transpirationMm??null,evaporationMm:d.dualKc?.evaporationMm??null,reserveMm:d.stockEndMm,stress:g.days[i].waterFactor,biomassKgHa:g.days[i].biomassKgHa,cover:d.dualKc?.cover??g.days[i].fapar}))});
}
// Two identifiable scalars. Biomass first, then grain; no treatment-specific coefficient.
const fits=[];
for(const mode of ['single','dual','dual-wp'])for(const wpRatio of [.35,.5,.65]){
 const train=records.filter(r=>r.year===2012&&r.mode===mode&&r.wpRatio===wpRatio),rueMultiplier=train.reduce((n,r)=>n+r.rawBiomassKgHa*r.observedBiomassKgHa,0)/train.reduce((n,r)=>n+r.rawBiomassKgHa**2,0);
 const hi=train.reduce((n,r)=>n+r.rawBiomassKgHa*rueMultiplier*r.observedGrainKgHa*.845,0)/train.reduce((n,r)=>n+(r.rawBiomassKgHa*rueMultiplier)**2,0);
 for(const r of records.filter(r=>r.mode===mode&&r.wpRatio===wpRatio)){r.fittedBiomassKgHa=r.rawBiomassKgHa*rueMultiplier;r.fittedGrainKgHa=r.fittedBiomassKgHa*hi/.845;}
 fits.push({mode,wpRatio,trainingYears:[2012],rueGPerGlobalMj:mode==='dual-wp'?null:1.5*rueMultiplier,waterProductivityGm2:mode==='dual-wp'?25*rueMultiplier:null,harvestIndex:hi,years:Object.fromEntries([2012,2013].map(year=>{const rs=records.filter(r=>r.year===year&&r.mode===mode&&r.wpRatio===wpRatio);return [year,{grain:metrics(rs.map(r=>[r.fittedGrainKgHa,r.observedGrainKgHa])),biomass:metrics(rs.map(r=>[r.fittedBiomassKgHa,r.observedBiomassKgHa])),etAnnual:metrics(rs.map(r=>[r.predictedEtMm,r.observedEtAnnualMm])),fieldDailyEtSum:metrics(rs.map(r=>[r.predictedEtMm,r.fieldEtDailySumMm])),treatmentContrasts:rs.map(r=>({treatment:r.treatment,predictedRatio:r.fittedGrainKgHa/rs.find(x=>x.treatment==='100/100').fittedGrainKgHa,observedRatio:r.observedGrainKgHa/rs.find(x=>x.treatment==='100/100').observedGrainKgHa}))}];}))});
}
// Verify the fitted scalars by an actual second execution of the public engine.
for(const fit of fits)for(const row of data.cases){
 const r=records.find(r=>r.id===row.id&&r.mode===fit.mode&&r.wpRatio===fit.wpRatio);
 const c=config(row,fit.mode!=='single',fit.wpRatio);c.growth.parameters.harvestIndex=fit.harvestIndex;
 if(fit.mode==='dual-wp')c.growth.parameters.biomassModel={kind:'transpiration-normalized',waterProductivityGm2:fit.waterProductivityGm2,source:'Fitted on 2012 biomass only; experimental LIRF domain',availableOn:'2013-01-01'};
 else c.growth.parameters.rueGPerMj=fit.rueGPerGlobalMj;
 const rerun=planSeason(c,row.events.map(e=>({...e,landSelection:c.landSelection}))).growth.scenarios.find(s=>s.id==='proposed');
 if(Math.abs(rerun.yieldKgHa-r.fittedGrainKgHa)>1e-6||Math.abs(rerun.biomassKgHa-r.fittedBiomassKgHa)>1e-6)throw Error('Fitted profile does not reproduce '+row.id);
 r.fittedProfileActuallyExecuted=true;
}
await mkdir(outputFolder,{recursive:true});
await writeFile(outputFolder+'/replay-daily.json.gz',gzipSync(JSON.stringify({fits,records,limits:data.limits})));
await writeFile(outputFolder+'/replay-summary.json',JSON.stringify({status:'experimental retrospective reconstruction; no accepted African profile',fitProtocol:{declaredFreeParameters:['one RUE scalar per model / WP scenario on 2012 biomass','one common HI on 2012 dry grain'],'waterParameters':'fixed transferred FAO56, not optimized on 2013','no2013YieldFitting':true},fits,records:records.map(({days,...r})=>r),limits:data.limits},null,2)+'\n');
console.log(JSON.stringify(fits.filter(r=>r.wpRatio===.5),null,2));

}
