import type {SeasonalConfig,WaterPlan,WaterDay} from './types.ts';
import {addDays} from './validation.ts';
const knownSum=(values:(number|null)[])=>values.some(v=>v===null)?null:values.reduce<number>((n,v)=>n+v!,0);
function interventions(days:WaterDay[],type:'recorded'|'proposed'){
 const rows=days.filter(d=>d.intervention?.type===type);
 return {fieldM3:knownSum(rows.map(d=>d.intervention!.fieldM3)),netMm:rows.reduce((n,d)=>n+d.irrigationNetMm,0),count:rows.filter(d=>d.irrigationNetMm>0).length};
}
/** Presentation of the server's existing balance; no extra simulation or inferred irrigation. */
export function waterOverview(c:SeasonalConfig,plan:WaterPlan|null){
 const duration=c.stages.reduce((n,s)=>n+s.days,0),end=duration?addDays(c.sowingDate,duration-1):c.sowingDate;
 const days=plan?.days??[],proposed=interventions(days,'proposed'),recorded=interventions(days,'recorded');
 const statuses=days.length?days.map(d=>d.weatherStatus):c.weather.filter(w=>w.date>=c.sowingDate&&w.date<=end&&w.rainMm!==null&&w.et0Mm!==null).map(w=>w.status);
 const coverage={forecast:statuses.filter(s=>s==='forecast').length,scenario:statuses.filter(s=>s==='scenario').length,past:statuses.filter(s=>s==='observed'||s==='estimated').length,missing:Math.max(0,duration-statuses.length),total:duration};
 const weeks=(plan?.weeks??[]).map(w=>{const rows=days.filter(d=>d.date>=w.from&&d.date<=w.to);return {...w,proposed:interventions(rows,'proposed'),recorded:interventions(rows,'recorded'),stages:[...new Set(rows.map(d=>d.stage))]};});
 return {proposed,recorded,coverage,weeks,areaM2:plan?.calculationArea?.areaM2??null};
}
