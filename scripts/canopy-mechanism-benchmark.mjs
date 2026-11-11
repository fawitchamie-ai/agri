/** Fit cover first (2012), freeze it, then biomass and grain (2012 only).
 * Evaluate cover / water / grain in 2013. Full observed cover is ASSIMILATION,
 * a diagnostic upper-input comparison, never a preseason forecast.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {config} from './lirf-replay.mjs';
import {planWater} from '../lib/seasonal/engine.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
Date.now=()=>Date.parse('2026-11-10T12:00:00Z');
const folder='research-data/alternative-models/2026-11-11/canopy';await mkdir(folder,{recursive:true});
const data=JSON.parse(gunzipSync(await readFile('research-data/lirf/2026-11-10/adapter.json.gz')));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const metrics=rows=>{const v=rows.filter(r=>r.every(x=>typeof x==='number'&&Number.isFinite(x)));if(!v.length)return {n:0,mae:null,rmse:null,bias:null,nrmsePercent:null};const e=v.map(([p,o])=>p-o),rmse=Math.sqrt(mean(e.map(x=>x*x)));return {n:v.length,mae:mean(e.map(Math.abs)),rmse,bias:mean(e),nrmsePercent:100*rmse/mean(v.map(r=>r[1]))};};
await writeFile(folder+'/protocol-before-fit.json',JSON.stringify({version:'canopy-hypothesis-2026-11-11.1',soilWaterMethod:'layered-recharge-diagnostic',sources:['FAO AquaCrop reference manual ch.3 canopy/transpiration','official v7.3_typofix global.f90 CalculateETpot'],structure:'Reduced exponential canopy expansion/senescence; soil-depletion stress memory; Kcb=KcTrX*clip(1.72CC-CC²+.30CC³)',freeCoverParameters:['CGC in [.08,.10,.12,.14]','senescence onset fraction of season [.75,.85]','CDC in [.05,.10,.15]'],coverFit:'2012 measured cover aggregated by treatment-date, 24 candidate profiles, no grain objective',fixedHypotheses:{maxCover:.96,initialCover:.0052,emergence2012:14,emergence2013:8,KcTrX:1.1,expansionLower:.14,expansionUpper:.72,senescenceThreshold:.69,stressDeclineRateDay:.10},biomassFit:'One common WP on 2012 biomass only',grainFit:'One common HI on 2012 dry grain only',evaluation:'2013 cover, estimated ET, reserve and grain, already explored year: not blind',fullCoverAssimilation:'Complete daily interpolated field cover receives future observations in retrospective mode; NOT an operational forecast',noUniversalProfile:true},null,2)+'\n');
function make(row,mode,profile){
 const c=config(row,true);delete c.growth;
 c.soilWaterModel={version:'profile-recharge-1',usage:'diagnostic',acceptedHypothesis:true,availableOn:'2012-01-01',source:'Explicit structural recharge diagnostic; never a national forecast profile'};
 if(mode!=='legacy')c.waterModel.transpiration={method:'canopy-cover',maxCoefficient:1.1,source:'FAO AquaCrop canopy-transpiration relation; reduced hypothesis, no full-model claim',availableOn:'2012-01-01'};
 if(mode==='dynamic')c.waterModel.canopyDynamics={version:'canopy-state-1',source:'LIRF 2012 cover-only fit, other quantities are explicit transferred/assumed inputs',availableOn:'2013-01-01',initialCover:.0052,maxCover:.96,emergenceDay:row.year===2012?14:8,senescenceDay:Math.round(profile.senescenceFraction*row.weather.length),growthRateDay:profile.growthRateDay,declineRateDay:profile.declineRateDay,expansionLower:.14,expansionUpper:.72,senescenceThreshold:.69,stressDeclineRateDay:.1};
 if(mode==='assimilated')c.waterModel.observedCover=row.dailyDiagnostics.filter(d=>typeof d.coverInterpolated==='number').map(d=>({date:d.date,cover:d.coverInterpolated,availableOn:d.date,source:'LIRF interpolated daily treatment cover; full future trajectory supplied only for retrospective assimilation diagnostic'}));
 return c;
}
function measuredCover(row,p){const grouped=new Map();for(const o of row.coverObservations){const v=grouped.get(o.date)??[];v.push(o.cover);grouped.set(o.date,v);}return [...grouped].flatMap(([date,vs])=>{const d=p.days.find(d=>d.date===date);return d?[[d.dualKc.cover,mean(vs)]]:[];});}
const candidates=[];
for(const growthRateDay of [.08,.10,.12,.14])for(const senescenceFraction of [.75,.85])for(const declineRateDay of [.05,.10,.15]){
 const profile={growthRateDay,senescenceFraction,declineRateDay},rows=[];
 for(const row of data.cases.filter(r=>r.year===2012)){const c=make(row,'dynamic',profile),p=planWater(c,row.events.map(e=>({...e,landSelection:c.landSelection})));if(!p.complete)throw Error(JSON.stringify(p.missing));rows.push(...measuredCover(row,p));}
 candidates.push({...profile,cover:metrics(rows)});
}
const frozen=candidates.toSorted((a,b)=>a.cover.rmse-b.cover.rmse)[0];
await writeFile(folder+'/cover-profile-frozen-before-grain.json',JSON.stringify({frozen,candidates},null,2)+'\n');
const results=[];
for(const mode of ['legacy','linked-profile','dynamic','assimilated']){
 const records=[];
 for(const row of data.cases){
  const c=make(row,mode,frozen),p=planWater(c,row.events.map(e=>({...e,landSelection:c.landSelection})));
  if(!p.complete)throw Error(JSON.stringify(p.missing));
  const normTr=p.days.reduce((n,d,i)=>n+(row.weather[i].et0Mm>0?d.dualKc.transpirationMm/row.weather[i].et0Mm:0),0)*10;
  const grain=row.annualObservations.map(o=>o.grainKgHa).filter(v=>typeof v==='number'),bio=row.annualObservations.map(o=>o.biomassKgHa).filter(v=>typeof v==='number');
  records.push({id:row.id,year:row.year,treatment:row.treatment,observedGrainKgHa:mean(grain),observedBiomassKgHa:bio.length?mean(bio):null,normTr,
   predictedEtMm:p.totals.actualEtMm,fieldEtMm:mean(row.annualObservations.map(o=>o.etMm).filter(v=>typeof v==='number')),
   coverRows:measuredCover(row,p),etRows:p.days.map((d,i)=>[d.actualEtMm,row.dailyDiagnostics[i].etFieldBalanceMm]),
   reserveRows:p.days.flatMap((d,i)=>row.dailyDiagnostics[i].deficit105Mm!==null&&Math.abs(d.rootM-1.05)<1e-8?[[d.depletionMm,row.dailyDiagnostics[i].deficit105Mm]]:[]),
   maxBalanceResidualMm:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm)))});
 }
 const train=records.filter(r=>r.year===2012),wp=train.reduce((n,r)=>n+r.normTr*r.observedBiomassKgHa,0)/train.reduce((n,r)=>n+r.normTr*r.normTr,0);
 const hi=train.reduce((n,r)=>n+r.normTr*wp*r.observedGrainKgHa*.845,0)/train.reduce((n,r)=>n+(r.normTr*wp)**2,0);
 for(const r of records){r.predictedBiomassKgHa=r.normTr*wp;r.predictedGrainKgHa=r.predictedBiomassKgHa*hi/.845;}
 const years=Object.fromEntries([2012,2013].map(y=>{const rs=records.filter(r=>r.year===y);return [y,{grain:metrics(rs.map(r=>[r.predictedGrainKgHa,r.observedGrainKgHa])),biomass:metrics(rs.map(r=>[r.predictedBiomassKgHa,r.observedBiomassKgHa])),et:metrics(rs.map(r=>[r.predictedEtMm,r.fieldEtMm])),cover:metrics(rs.flatMap(r=>r.coverRows)),dailyEt:metrics(rs.flatMap(r=>r.etRows)),reserve105:metrics(rs.flatMap(r=>r.reserveRows)),treatmentContrasts:rs.map(r=>({treatment:r.treatment,observed:r.observedGrainKgHa/rs[0].observedGrainKgHa,predicted:r.predictedGrainKgHa/rs[0].predictedGrainKgHa}))}];}));
 results.push({mode,wp,hi,years,records:records.map(({coverRows,etRows,reserveRows,...r})=>r)});
 console.log(mode,JSON.stringify({wp,hi,years}));
}
await writeFile(folder+'/results.json',JSON.stringify({soilWaterMethod:'layered-recharge-diagnostic',frozenCover:frozen,models:results},null,2)+'\n');
