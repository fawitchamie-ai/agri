/** Frozen stage-response experiment through the actual application entry point. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {planSeason} from '../lib/seasonal/yield.ts';
import {togoStageReplayInput,TOGO_STAGE_REPLAY_PROFILE as profile} from '../lib/seasonal/togo-stage-replay.ts';
import {stageWaterFactor,waterStageScope} from '../lib/seasonal/water-stages.ts';
import {seasonalWaterFactor} from '../lib/seasonal/water-response.ts';
Date.now=()=>Date.parse('2026-11-10T12:00:00Z'); // Frozen synthetic land fixture, not live land.
const folder='research-data/togo-fertility/2026-11-11';await mkdir(folder,{recursive:true});
const archive=JSON.parse(gunzipSync(await readFile('research-data/simulation-audit/2026-11-10/after.json.gz')));
const calendars=[{id:'daily',interval:1,phase:0},{id:'pulse3-start',interval:3,phase:0},{id:'pulse3-end',interval:3,phase:2},{id:'pulse7-start',interval:7,phase:0},{id:'pulse7-end',interval:7,phase:6}];
function forcing(c,index,calendar,scale=1){
 let offset=0;const events=[];
 for(const [j,s]of c.stages.entries()){
  const indices=Array.from({length:s.days},(_,i)=>i).filter(i=>i%calendar.interval===calendar.phase);
  const total=archive.published.irrigationMm[index][j]*scale;
  for(const i of indices)events.push({id:`replay-${offset+i}`,date:new Date(Date.parse(c.sowingDate)+(offset+i)*86400000).toISOString().slice(0,10),kind:'irrigation',amount:total/indices.length,unit:'mm',point:'field',status:'declared',source:'Hypothetical schedule preserving published stage totals; not measured daily irrigation',recordedAt:'2026-11-10T00:00:00Z',landSelection:c.landSelection});
  offset+=s.days;
 }
 return events;
}
function calculated(c,events){const p=planSeason(c,events),s=p.yieldEstimation?.scenarios.find(s=>s.id==='recorded');if(s?.status!=='conditional')throw Error(JSON.stringify(s?.missing??p.missing));return {p,s};}
const fi=structuredClone(archive.cases[0].config);fi.yieldEstimation=togoStageReplayInput(fi);
const initial=calculated(fi,forcing(fi,0,calendars[0]));
const capacity=archive.published.observedKgHa[0]/initial.s.units[0].stageResponse.factor;
if(Math.abs(capacity-profile.reference.capacityKgHa)>1e-7)throw Error('Frozen FI calibration changed; investigate water or date inputs, do not refit silently.');
const seasonalCapacity=archive.published.observedKgHa[0]/seasonalWaterFactor(initial.s.units[0].etaMm,initial.s.units[0].etmMm,1.25);
const records=[];
for(const phenology of ['thesis66-18-39','article54-10-42'])for(const calendar of calendars)for(let index=0;index<3;index++){
 const c=structuredClone(archive.cases[index].config);c.yieldEstimation=togoStageReplayInput(c);
 if(phenology.startsWith('article'))Object.assign(c.yieldEstimation.responseCalendar,{floweringStartDay:54,floweringDays:10,grainEndDay:95});
 const events=forcing(c,index,calendar),{p,s}=calculated(c,events),unit=s.units[0];
 const original=planSeason({...c,yieldEstimation:undefined},events).growth.scenarios.find(s=>s.id==='proposed');
 const water=p.days;
 if(water.some(d=>Math.abs(d.balanceResidualMm)>1e-8))throw Error('Water conservation failure');
 if(Math.abs(s.totals.productionKg-s.totals.yieldKgHaSown*c.yieldEstimation.units[0].sownAreaM2/10000)>1e-8)throw Error('Production area conversion failure');
 const seasonal=seasonalWaterFactor(unit.etaMm,unit.etmMm,1.25);
 records.push({phenology,calendar:calendar.id,treatment:['FI','80','60'][index],observedGrainKgHa:archive.published.observedKgHa[index],predictedGrainKgHa:s.totals.yieldKgHaSown,originalGrainKgHa:original.yieldKgHa,constantFIgrainKgHa:archive.published.observedKgHa[0],seasonalGrainKgHa:seasonal===null?null:seasonalCapacity*seasonal,
  prior2000SameMoistureKgHa:2000*unit.stageResponse.factor,prior2000StrictDryTo13KgHa:2000/.87*unit.stageResponse.factor,
  etaMm:unit.etaMm,etmMm:unit.etmMm,stages:unit.stageResponse.phases,warnings:unit.stageResponse.warnings,
  productionKg:s.totals.productionKg,areaM2:c.yieldEstimation.units[0].sownAreaM2,
  maxWaterBalanceResidualMm:Math.max(...water.map(d=>Math.abs(d.balanceResidualMm))),
  predictedCover:null,predictedBiomass:null,observedStageEt:null});
}
function metrics(rows,key){const es=rows.map(r=>r[key]-r.observedGrainKgHa),rmse=Math.sqrt(es.reduce((n,x)=>n+x*x,0)/es.length);return {n:es.length,maeKgHa:es.reduce((n,x)=>n+Math.abs(x),0)/es.length,rmseKgHa:rmse,biasKgHa:es.reduce((n,x)=>n+x,0)/es.length,nrmsePercent:100*rmse/(rows.reduce((n,r)=>n+r.observedGrainKgHa,0)/rows.length)};}
const summaries=[];
for(const phenology of [...new Set(records.map(r=>r.phenology))])for(const calendar of calendars){const rs=records.filter(r=>r.phenology===phenology&&r.calendar===calendar.id);summaries.push({phenology,calendar:calendar.id,allThreeIncludingFICalibration:metrics(rs,'predictedGrainKgHa'),deficitsOnly:metrics(rs.slice(1),'predictedGrainKgHa'),constantFIDeficitsOnly:metrics(rs.slice(1),'constantFIgrainKgHa'),originalDeficitsOnly:metrics(rs.slice(1),'originalGrainKgHa'),seasonalDeficitsOnly:metrics(rs.slice(1),'seasonalGrainKgHa'),originalAll:metrics(rs,'originalGrainKgHa'),ratios:rs.map(r=>r.predictedGrainKgHa/rs[0].predictedGrainKgHa)});}
// Same total drought moved between stages: effects follow ET, not irrigation percentage.
const synthetic=c=>c.stages.reduce((n,s)=>n+s.days,0);
const timing={};
for(const [name,start,end]of [['vegetation',21,38],['flowering',66,83],['maturation',94,111]]){
 const days=Array.from({length:synthetic(fi)},(_,i)=>({date:new Date(Date.parse(fi.sowingDate)+i*86400000).toISOString().slice(0,10),demandMm:5,actualEtMm:i+1>=start&&i+1<=end?4:5}));
 timing[name]={etLossMm:18,grainFactor:stageWaterFactor(fi,days,fi.yieldEstimation.responseCalendar).factor};
}
// Actual irrigation changes are replayed, not inferred from a dose/yield rule.
const waterSweep=[];
for(const scale of [0,.1,.2,.4,.6,.8,1,1.2]){
 const c=structuredClone(fi),p=planSeason(c,forcing(c,0,calendars[0],scale)),s=p.yieldEstimation.scenarios.find(s=>s.id==='recorded');
 waterSweep.push({scaleFIirrigation:scale,status:s.status,yieldKgHa:s.totals?.yieldKgHaSown??null,missing:s.missing,phaseFactors:s.units[0].stageResponse?.phases.map(p=>p.factor)});
}
const out={protocolSha256:createHash('sha256').update(await readFile(folder+'/STAGE_PROTOCOL.md')).digest('hex'),profileId:profile.id,
 calibration:{fittedOn:'FI grain only, daily reconstructed water',capacityKgHa:capacity,seasonalCapacityKgHa:seasonalCapacity,freeParameters:['one common effective yield capacity'],coefficientsFittedOnDeficits:[],ky:[0,.4,1.5,.5,.2],humidityPercent:13},
 primarySelection:'thesis66-18-39, daily hypothesis; not selected by lowest RMSE',summaries,records,timing,waterSweep,
 limits:['Development on an already explored single-site season, not independent or blind validation.','FI enters the one-parameter capacity fit; report deficit-only error separately.','Phenology is documented in a published recalibration that explored all treatments; no independent test claim.','Schedules remain hypothetical; pulse dispersion is scenario sensitivity, not biological variability.','No canopy/biomass mechanism is claimed by this grain-response equation. No NPK/pest effect.','Prior2000 humidity is ambiguous; neither interpretation is an operational coefficient.','No American grain-moisture conversion or parameter transfer.']};
await writeFile(folder+'/stage-summary.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({calibration:out.calibration,primary:summaries[0],primaryRows:records.slice(0,3),timing,waterSweep},null,2));
