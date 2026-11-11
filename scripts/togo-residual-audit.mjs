/** Residual attribution. No per-treatment coefficients. Public Table 4 ETc is
 * calculated from station weather (not measured ETa). 60% excluded from fitting. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {planWater} from '../lib/seasonal/engine.ts';
import {stageWaterFactor} from '../lib/seasonal/water-stages.ts';
import {togoStageReplayInput} from '../lib/seasonal/togo-stage-replay.ts';
Date.now=()=>Date.parse('2026-11-10T12:00:00Z');
const data=JSON.parse(await readFile('research-data/togo-fertility/2026-11-11/replay-input.json'));
data.config.landAssessment=JSON.parse(gunzipSync(await readFile('research-data/simulation-audit/2026-11-10/after.json.gz'))).cases[0].config.landAssessment;
const targets=[82.4,203.7,385.8,83.3];
const schedules=[[1,0],[3,0],[3,2],[7,0],[7,6]];
function config(mode,efficiency=1){
 const c=structuredClone(data.config);c.system.applicationEfficiency=efficiency;
 if(mode==='constant-kc')for(const [i,s] of c.stages.entries())s.kcStart=s.kcEnd=[.5,.85,1.2,.9][i];
 if(mode==='table4'){
  let offset=0;
  for(const [j,s] of c.stages.entries()){
   const rows=c.weather.slice(offset,offset+s.days),sum=rows.reduce((n,w,i)=>n+w.et0Mm*(s.kcStart+(s.kcEnd-s.kcStart)*i/(s.days-1)),0);
   for(const w of rows)w.et0Mm*=targets[j]/sum;
   offset+=s.days;
  }
 }
 return c;
}
function run(c,index,[interval,phase]){
 let offset=0;const events=[];
 for(const [j,s]of c.stages.entries()){
  const indices=Array.from({length:s.days},(_,i)=>i).filter(i=>i%interval===phase);
  for(const i of indices)events.push({id:`r-${offset+i}`,date:new Date(Date.parse(c.sowingDate)+(offset+i)*86400000).toISOString().slice(0,10),kind:'irrigation',amount:data.published.irrigationMm[index][j]/indices.length,unit:'mm',point:'field',status:'declared',source:'Hypothetical dates',recordedAt:'2026-11-10T00:00:00Z',landSelection:c.landSelection});
  offset+=s.days;
 }
 const p=planWater(c,events,{irrigationMode:'recorded'});
 if(!p.complete)throw Error(JSON.stringify(p.missing));
 const response=stageWaterFactor(c,p.days,togoStageReplayInput(c).responseCalendar);
 return {factor:response.factor,phases:response.phases,demand:p.stages.map(s=>s.demandMm),et:p.totals.actualEtMm,irrigation:p.totals.netMm,drainage:p.days.reduce((n,d)=>n+d.drainageMm,0),balance:Math.max(...p.days.map(d=>Math.abs(d.balanceResidualMm)))};
}
const obs=data.published.observedKgHa;
function metrics(pred,indices){const e=indices.map(i=>pred[i]-obs[i]);return {mae: e.reduce((n,x)=>n+Math.abs(x),0)/e.length,rmse:Math.sqrt(e.reduce((n,x)=>n+x*x,0)/e.length),bias:e.reduce((n,x)=>n+x,0)/e.length};}
const experiments=[];
for(const mode of ['baseline','constant-kc','table4']){
 const fi=run(config(mode),0,schedules[0]);const capacity=obs[0]/fi.factor;
 for(const schedule of schedules){const rows=[0,1,2].map(i=>run(config(mode),i,schedule));const pred=rows.map(r=>capacity*r.factor);experiments.push({mode,schedule,capacity,pred,deficits:metrics(pred,[1,2]),rows});}
}
// Profile likelihood: efficiency is an effective scenario parameter, NOT a measurement.
// Fit FI capacity + 80% only; fixed daily schedule. No lookup of 60% in selection.
const grid=[];
for(let k=60;k<=100;k++){
 const efficiency=k/100,c=config('table4',efficiency),fi=run(c,0,schedules[0]),di=run(c,1,schedules[0]);
 const capacity=obs[0]/fi.factor,p80=capacity*di.factor;
 grid.push({efficiency,capacity,p80,loss:(p80-obs[1])**2});
}
const best=grid.reduce((a,b)=>a.loss<b.loss?a:b);
const fitSchedules=schedules.map(schedule=>{const rows=[0,1,2].map(i=>run(config('table4',best.efficiency),i,schedule));const pred=rows.map(r=>best.capacity*r.factor);return {schedule,pred,training:metrics(pred,[0,1]),reserved60:metrics(pred,[2]),rows};});
const calendarFits=[];
for(const schedule of schedules){
 const candidates=[];
 for(let k=60;k<=100;k++){
  const c=config('table4',k/100),a=run(c,0,schedule),b=run(c,1,schedule),capacity=obs[0]/a.factor;
  candidates.push({efficiency:k/100,capacity,loss:(capacity*b.factor-obs[1])**2});
 }
 const fitted=candidates.reduce((a,b)=>a.loss<b.loss?a:b);
 calendarFits.push({schedule,...fitted,reserved60:fitted.capacity*run(config('table4',fitted.efficiency),2,schedule).factor});
}
const out={calendarFits,humiditySensitivity:{basis:'13% central; common conversion of all observed and predicted grain',to12Factor:.87/.88,to14Factor:.87/.86},protocol:'ET anchor on Table4 only; capacity FI only. Separate exploratory fit efficiency [0.60,1.00] step .01 on FI+80; 60 reserved internally. Bounds are sensitivity hypotheses, not measured efficiency. No national default.',units:'yield kg/ha; water mm',targets,observed:obs,experiments,grid,best,fitSchedules};
await mkdir('research-data/togo-residual/2026-11-11',{recursive:true});
await writeFile('research-data/togo-residual/2026-11-11/audit.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({experiments:experiments.map(({rows,...x})=>({...x,demand:rows[0].demand})),best,fitSchedules:fitSchedules.map(({rows,...x})=>x)},null,2));
