import type {SeasonalConfig,WaterEvent,WeatherDay} from './types.ts';
import {addDays,validateConfig,InputError} from './validation.ts';
import {reconcileInputs} from './provenance.ts';
import {planSeason} from './yield.ts';

export const SOWING_OFFSETS=[0,7,14] as const;
export type SowingComparisonRow={date:string;end:string;complete:boolean;demandMm:number|null;sourceM3:number|null;missing:string[];historicalScenario:boolean};
export function sowingComparisonBlock(c:SeasonalConfig,events:WaterEvent[],today:string):string|null{
 if(!c.parcelGeometry||!c.stages.length)return 'Choisissez d’abord une parcelle, une culture et sa durée de cycle.';
 if(c.sowingDate<today)return 'Cette date de semis est passée. Préparez une nouvelle simulation avant semis pour comparer des dates futures.';
 if(events.some(e=>['measured','declared'].includes(e.status))||c.managementPlan?.products.some(p=>p.status==='declared')||c.fieldTrials?.some(t=>t.plots.some(p=>p.harvest||p.applications.length))||c.yieldEstimation?.areaBasis!=='planned'&&c.yieldEstimation?.units.some(u=>(u.sownAreaM2??0)>0))return 'Cette campagne contient déjà des observations ou un semis déclaré. Conservez son suivi et créez une nouvelle simulation avant semis pour comparer les dates.';
 return null;
}
/** Request the missing calendar, including the END of the delayed crop cycles.
 * Existing explicit fallback scenarios are retained, never silently created. */
export function comparisonWeatherRequests(c:SeasonalConfig):{start:string;days:number}[]{
 if(c.fallback)return [];
 const days=c.stages.reduce((n,s)=>n+s.days,0)+14,byDate=new Map(c.weather.map(w=>[w.date,w]));
 const gaps=Array.from({length:days},(_,i)=>addDays(c.sowingDate,i)).filter(date=>{const w=byDate.get(date);return !w||w.rainMm===null||w.et0Mm===null;});
 if(!gaps.length)return [];
 const result=[];let start=gaps[0],remaining=(Date.parse(gaps.at(-1)!)-Date.parse(start))/86400000+1;
 while(remaining>0){const length=Math.min(366,remaining);result.push({start,days:length});start=addDays(start,length);remaining-=length;}
 return result;
}
/** Preserve measured/manual/existing values; incoming data fills missing cells only. */
export function comparisonWeather(existing:WeatherDay[],incoming:WeatherDay[]):WeatherDay[]{
 const map=new Map(incoming.map(w=>[w.date,w]));
 for(const old of existing){const fresh=map.get(old.date);
  if(!fresh||old.rainMm!==null&&old.et0Mm!==null){map.set(old.date,old);continue;}
  const row={...old,provenance:{...old.provenance}},filled:string[]=[];
  for(const key of ['rainMm','et0Mm'] as const)if(row[key]===null&&fresh[key]!==null){row[key]=fresh[key];filled.push(key);if(fresh.provenance?.[key])row.provenance[key]=fresh.provenance[key];else delete row.provenance[key];}
  if(filled.length){row.availableAt=old.availableAt>fresh.availableAt?old.availableAt:fresh.availableAt;row.source='Sources par variable conservées ; valeurs manquantes complétées : '+fresh.source;row.status=fresh.status;}
  map.set(old.date,row);
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function compareSowingDates(input:SeasonalConfig,events:WaterEvent[],incoming:WeatherDay[],today:string):SowingComparisonRow[]{
 const block=sowingComparisonBlock(input,events,today);if(block)throw new InputError(block);
 const c=validateConfig(input),weather=comparisonWeather(c.weather,incoming),duration=c.stages.reduce((n,s)=>n+s.days,0);
 return SOWING_OFFSETS.map(offset=>{
  const date=addDays(c.sowingDate,offset),end=addDays(date,duration-1);
  const managementPlan=c.managementPlan?{...c.managementPlan,irrigation:{...c.managementPlan.irrigation,applications:c.managementPlan.irrigation.applications.map(a=>({...a,date:addDays(a.date,offset)}))},products:c.managementPlan.products.map(p=>({...p,date:addDays(p.date,offset)}))}:undefined;
  // Scenarios are read-only and have their own issue date. Actual observations,
  // trial protocols and transferred fertilizer assumptions are not rewritten.
  const scenario=reconcileInputs(c,{...c,sowingDate:date,asOfDate:today,weather:weather.filter(w=>w.date>=date&&w.date<=end),managementPlan,fieldTrials:undefined,fertilizerScenario:undefined,salinity:undefined});
  const p=planSeason(scenario,[]),complete=p.complete&&p.status!=='blocked';
  return {date,end,complete,demandMm:complete?p.totals.demandMm:null,sourceM3:complete?p.totals.sourceM3:null,missing:p.missing,historicalScenario:!!c.fallback||scenario.weather.some(w=>w.status==='scenario')};
 });
}
