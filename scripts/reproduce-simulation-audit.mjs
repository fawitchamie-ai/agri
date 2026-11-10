/** Offline reconstruction, not calibration. Never writes a campaign or observed event.
 * node --experimental-transform-types scripts/reproduce-simulation-audit.mjs [engine-root] [output.json]
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]??'.'),out=process.argv[3]??'research-data/simulation-audit/2026-11-10/after.json';
const mod=path=>import(pathToFileURL(resolve(root,path)));
const {applyCropProfile}=await mod('lib/seasonal/catalog.ts'),{exampleCampaign}=await mod('lib/seasonal/example.ts');
const {growthTemplate,growthScope}=await mod('lib/seasonal/growth.ts'),{planSeason}=await mod('lib/seasonal/yield.ts');
const {emptyManagement}=await mod('lib/seasonal/management.ts'),{parcelMetrics}=await mod('lib/seasonal/parcel.ts');
const {assessLandGeometry}=await mod('lib/seasonal/land.ts'),{loadNasaHistory}=await mod('lib/seasonal/nasa.ts');
const {addDays}=await mod('lib/seasonal/validation.ts');
const date='2026-11-10',time=date+'T00:00:00Z',folder='research-data/simulation-audit/2026-11-10/';
const raw=JSON.parse(await readFile(folder+'nasa-power-20171216-20180405.json','utf8'));
const nasa=await loadNasaHistory(10.880314,0.192194,'2017-12-16','2018-04-05',date,async()=>Response.json(raw),time);
const lon=0.192194,lat=10.880314,shape={type:'Polygon',coordinates:[[[lon,lat],[lon+.001,lat],[lon+.001,lat+.001],[lon,lat+.001],[lon,lat]]]};
const land=assessLandGeometry(shape,[{id:'worldcover',status:'available',provider:'Explicit test domain',product:'Assumed terrestrial research plot; NOT satellite evidence',version:'scenario-1',referencePeriod:null,observedAt:null,acquiredAt:time,resolutionM:10,crs:'EPSG:4326',cells:[{id:'plot',value:40,geometry:shape}],reason:null,assets:[],limitations:['Software reconstruction only; synthetic mask, no real parcel delineation']}],time);
const published={sowing:'2017-12-16',harvest:'2018-04-05',stageDays:[20,30,46,15],irrigationMm:[[193.8,280.2,507,57.5],[155.3,224.3,405.5,46],[137.8,157.3,303.5,34]],observedKgHa:[2200.4,1830.9,1068.3],initialTheta:[.2872,.2819,.2179,.2337],thetaFC:[.2602,.2559,.2548,.2510],thetaWP:[.041,.0718,.0794,.0991]};
function fixture(index,supply='illustrative',initial='FC-assumption'){
 const c=applyCropProfile(exampleCampaign(published.sowing),'maize');
 Object.assign(c,{asOfDate:date,waterCondition:'drained',country:'TGO',variety:'TZEE-W (name only; generic RUE parameters)',parcelGeometry:shape,areaM2:parcelMetrics(shape).areaM2,landAssessment:land,landSelection:'potentialLand',weather:nasa.weather,fallback:null});
 c.stages=c.stages.map((s,i)=>({...s,days:published.stageDays[i],kcStart:[.5,.5,1.2,1.2][i],kcEnd:[.5,1.2,1.2,.9][i],rootStartM:[.1,.1,.5,.5][i],rootEndM:[.1,.5,.5,.5][i]}));
 c.cropProfile.mode='custom';c.parameterSource='Table 4 stage durations; FAO-style linear Kc within stages; roots truncated at published 0.5 m soil depth: explicit reconstruction, not TZEE-W calibration';
 c.soil={source:'Water SA 2020 Table 2: retention; initial state hypothesis FC in top two horizons, NOT published initial values',infiltrationMmDay:574.81,layers:[.1,.1,.15,.15].map((thicknessM,i)=>({thicknessM,thetaFC:published.thetaFC[i],thetaWP:published.thetaWP[i],initialTheta:initial==='published'?published.initialTheta[i]:i<2?published.thetaFC[i]:published.initialTheta[i]}))};
 c.system={...c.system,applicationEfficiency:1,transportEfficiency:1,sourceBudgetM3:null,sourceFlowM3h:null,hoursPerDay:null,minIntervalDays:1,maxNetMmPerDay:null,allowedWeekdays:[0,1,2,3,4,5,6],dailySourceLimits:[],source:'Exploratory 100% efficiency; not measured'};
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation.mode='manual';
 c.managementPlan.products=[{id:'compound',date:addDays(c.sowingDate,15),kind:'fertilizer',product:'NPK 15-15-15',dose:200,unit:'kg/ha',status:'declared',source:'Water SA 2020 management: shared treatment, N-P2O5-K2O convention assumed',npkPercent:[15,15,15]},{id:'urea',date:addDays(c.sowingDate,35),kind:'fertilizer',product:'Urea',dose:100,unit:'kg/ha',status:'declared',source:'Water SA 2020 management',npkPercent:[46,0,0]}];
 c.growth=growthTemplate(c);c.growth.parameters.moisturePercent=13; // midpoint of published 12–14% range; not a fitted value
 if(supply==='nonlimiting')c.growth.soilSupply={initialKgHa:[1000,1000,1000],releaseKgHaDay:[0,0,0],source:'Synthetic nonlimiting nutrient control; not a soil measurement'};
 c.growth.scope=growthScope(c);
 // Internal replay adapter only. The legacy engine accepts past forcing via
 // declared events. Every such event is explicitly SCENARIO, never measured;
 // these are archived as reconstructionForcing, NOT imported into storage.
 const forcing=[];let offset=0;
 for(const [stage,n] of published.stageDays.entries())for(let j=0;j<n;j++)forcing.push({id:'reconstructed-'+offset,date:addDays(c.sowingDate,offset++),kind:'irrigation',amount:published.irrigationMm[index][stage]/n,unit:'mm',point:'field',status:'declared',source:'SCENARIO RECONSTRUCTION: uniform daily distribution of Table 4 stage totals; NOT observed irrigation',recordedAt:time,landSelection:c.landSelection});
 return {config:c,reconstructionForcing:forcing};
}
function summary(p){const g=p.growth;if(g?.status!=='scenario')throw Error(JSON.stringify(g?.missing??p.missing));const s=g.scenarios.find(s=>s.id==='proposed');return {engineVersion:g.engineVersion??g.version,yieldKgHa:s.yieldKgHa,productionKg:s.productionKg,areaM2:g.areaM2,water:s.water,balance:s.balance,diagnostics:s.diagnostics??null,waterLimitedDays:s.days.filter(d=>d.waterFactor<1-1e-9).length,nutrientLimitedDays:s.days.filter(d=>d.nutrientFactor<1-1e-9).length,maxWaterResidualMm:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm))),moisturePercent:g.moisturePercent};}
const cases=[];
for(const supply of ['illustrative','nonlimiting'])for(let i=0;i<3;i++){
 const input=fixture(i,supply),plan=planSeason(input.config,input.reconstructionForcing);
 cases.push({label:['FI','80% FI','60% FI'][i],nutrients:supply,observedKgHa:published.observedKgHa[i],...input,result:summary(plan)});
}
const metrics=rows=>{const n=rows.length,mean=rows.reduce((a,r)=>a+r.observedKgHa,0)/n,e=rows.map(r=>(r.result?.yieldKgHa??r.predictionKgHa)-r.observedKgHa);const mae=e.reduce((a,n)=>a+Math.abs(n),0)/n,rmse=Math.sqrt(e.reduce((a,n)=>a+n*n,0)/n);return {n,maeKgHa:mae,rmseKgHa:rmse,biasKgHa:e.reduce((a,n)=>a+n,0)/n,nrmsePercent:100*rmse/mean};};
let rejectedPublishedInitial='not rejected';try{const c=fixture(0,'illustrative','published');planSeason(c.config,c.reconstructionForcing);}catch(e){rejectedPublishedInitial=e.message;}
const reference=published.observedKgHa.map(observedKgHa=>({observedKgHa,predictionKgHa:2000}));
const engineSourceSha256=createHash('sha256').update(await readFile(resolve(root,'lib/seasonal/growth.ts'))).digest('hex');
const result={engineSourceSha256,engineVersion:cases[0].result.engineVersion,workingTreeDirty:execFileSync('git',['-C',root,'status','--porcelain','--','lib/seasonal/growth.ts'],{encoding:'utf8'}).trim().length>0,protocol:'Exploratory replacement protocol frozen before numeric comparison; original named script/archive NOT located; do not claim identical reproduction.',commit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),date,sourceDoi:'10.17159/wsa/2020.v46.i1.7894',scope:'3 treatment means from ONE site-season; 3 plots per treatment; no independent validation or parameter fitting',observedMoisture:'12–14%; model set to midpoint 13% before comparison; 12 and 14% are sensitivity scenarios, not measured exact moistures',hypotheses:['Daily uniform stage irrigation; actual dates unknown','First two initial moisture horizons unavailable to this bucket model: explicit FC assumption, never silent clamp','Generic RUE/HI/fAPAR/NPK profiles are illustrative','0.5 m rooting limit; original AquaCrop 1 m profile cannot be recreated without deeper hydraulic data','100% application efficiency scenario; sensitivity not statistical uncertainty','NPK convention N-P2O5-K2O assumed; no conversion from total soil N or extractable P'],published,rejectedPublishedInitial,cases,metrics:Object.fromEntries(['illustrative','nonlimiting'].map(s=>[s,metrics(cases.filter(c=>c.nutrients===s))])),reference:{name:'Fixed 2000 kg/ha local cultivar description in source; not fitted on these means',...metrics(reference)},moistureSensitivity:Object.fromEntries([12,13,14].map(h=>[h,metrics(cases.filter(c=>c.nutrients==='illustrative').map(r=>({...r,result:{...r.result,yieldKgHa:r.result.yieldKgHa*.87/(1-h/100)}})))]))};
await writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,metrics:result.metrics,reference:result.reference,results:cases.map(c=>({label:c.label,nutrients:c.nutrients,...c.result}))},null,2));
