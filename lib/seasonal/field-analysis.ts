import type {SeasonalConfig,WeatherDay} from './types.ts';
import {geometryIdentity} from './provenance.ts';
import {fieldMonitoringScope,zoneGrid,type ZoneSeasonRead} from './field-zones.ts';
import {satelliteMonitoringScope} from './satellite.ts';

export const dayAfter=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
/** Keep old campaigns on their own season; recent sowing needs a useful look-back. */
export function fieldImagePeriod(c:SeasonalConfig){
 const archived=fieldImageArchive(c);
 if(archived.length&&!c.stages.length)return {from:archived[0].season.startDate,to:archived.at(-1)!.season.startDate};
 const end=dayAfter(c.sowingDate,Math.max(1,c.stages.reduce((n,s)=>n+s.days,0))-1);
 const to=c.sowingDate<c.asOfDate&&end<c.asOfDate?end:c.asOfDate;
 const from=c.sowingDate<=dayAfter(to,-30)?c.sowingDate:dayAfter(to,-90);
 return {from:[from,dayAfter(to,-240),'2017-01-01'].sort().at(-1)!,to};
}
/** Explicit vegetation palette; the contrast view uses the image's numeric range. */
export function fieldNdviColor(value:number,min:number,max:number){
 const stops=[[165,0,38],[244,109,67],[254,224,139],[217,239,139],[102,189,99],[0,104,55]],t=max-min<1e-6?.5:Math.max(0,Math.min(1,(value-min)/(max-min))),at=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(at)),f=at-i;
 return 'rgb('+stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f)).join(',')+')';
}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
/** Seasonal composites must never be presented as a dated acquisition. */
export function fieldImageArchive(c:SeasonalConfig){
 if(!c.parcelGeometry||c.fieldMonitoring?.scope!==fieldMonitoringScope(c))return [];
 const grid=zoneGrid(c.parcelGeometry),m=c.fieldMonitoring,dates=new Map<string,ZoneSeasonRead>();
 for(const r of [...(m.datedObservations??[]),...(m.currentObservation?[m.currentObservation]:[])]){
  const date=r.scenes[0]?.date;
  if(r.geometryId!==geometryIdentity(c.parcelGeometry)||r.gridM!==grid.gridM||r.scenes.length!==1||!date||r.season.startDate!==date||r.season.endDate!==date||r.retrievedOn>c.asOfDate||date>c.asOfDate)continue;
  dates.set(date,r);
 }
 return [...dates.values()].sort((a,b)=>a.season.startDate.localeCompare(b.season.startDate));
}
/** Mean/quantiles of cell medians, weighted by qualified cell area. This area
 * differs from the native clear-pixel fraction recorded in read.scenes. */
export function fieldImageSummary(grid:ReturnType<typeof zoneGrid>,read?:ZoneSeasonRead){
 const values=new Map((read?.cells??[]).filter(v=>v[2]===1&&finite(v[1])&&v[1]>=-1&&v[1]<=1).map(([id,value])=>[id,value]));
 const cells=grid.cells.filter(c=>values.has(c.id)),areaM2=cells.reduce((s,c)=>s+c.areaM2,0);
 const ordered=cells.map(c=>({value:values.get(c.id)!,area:c.areaM2})).sort((a,b)=>a.value-b.value);
 const quantile=(p:number)=>{let area=0;for(const v of ordered){area+=v.area;if(area>=areaM2*p)return v.value;}return null;};
 return {values,cells:cells.length,areaM2,coverage:Math.min(1,areaM2/grid.areaM2),mean:areaM2?cells.reduce((s,c)=>s+values.get(c.id)!*c.areaM2,0)/areaM2:null,minimum:ordered[0]?.value??null,maximum:ordered.at(-1)?.value??null,median:quantile(.5),p10:quantile(.1),p90:quantile(.9)};
}
/** Change in absolute NDVI on identical support; never compare stretched colours. */
export function compareFieldImages(grid:ReturnType<typeof zoneGrid>,a?:ZoneSeasonRead,b?:ZoneSeasonRead){
 const left=fieldImageSummary(grid,a).values,right=fieldImageSummary(grid,b).values,cells=grid.cells.filter(c=>left.has(c.id)&&right.has(c.id)),area=cells.reduce((s,c)=>s+c.areaM2,0),coverage=Math.min(1,area/grid.areaM2);
 return {coverage,cells:cells.length,delta:a&&b&&cells.length>=12&&coverage>=.6?cells.reduce((s,c)=>s+(right.get(c.id)!-left.get(c.id)!)*c.areaM2,0)/area:null};
}
export function fieldIndexEvolution(c:SeasonalConfig){
 const m=c.satelliteMonitoring;
 if(m?.scope===satelliteMonitoringScope(c)&&m.retrievedOn<=c.asOfDate&&m.observations.length){
  return {method:'Médianes des pixels Sentinel-2',ndviLabel:'NDVI médian',points:m.observations.filter(o=>o.date<=c.asOfDate&&o.availableOn<=c.asOfDate).sort((a,b)=>a.date.localeCompare(b.date)).map(o=>({date:o.date,ndvi:o.quality==='usable'?o.ndviMedian:null,evi:o.quality==='usable'?o.eviMedian:null,coverage:o.clearFraction}))};
 }
 const grid=c.parcelGeometry?zoneGrid(c.parcelGeometry):null;
 return {method:'Moyennes des médianes de cellules, pondérées par leur surface',ndviLabel:'NDVI moyen (grille)',points:grid?fieldImageArchive(c).map(r=>{const s=fieldImageSummary(grid,r);return {date:r.season.startDate,ndvi:s.cells>=12&&s.coverage>=.6?s.mean:null,evi:null,coverage:s.coverage};}):[]};
}
/** No forecast, scenario or fallback weather is presented as realised rain.
 * Missing or duplicate days remain unknown, including in cumulative curves. */
export function fieldWeatherEvolution(c:SeasonalConfig,from:string,to:string,baseC:number|null){
 const end=to<c.asOfDate?to:c.asOfDate,days=new Map<string,WeatherDay>(),duplicates=new Set<string>();
 for(const w of c.weather){if(days.has(w.date))duplicates.add(w.date);days.set(w.date,w);}
 const points:{date:string;rain:number|null;rainCumulative:number|null;gdd:number|null;gddCumulative:number|null;status:WeatherDay['status']|null}[]=[];
 let rainTotal=0,gddTotal=0,rainDays=0,temperatureDays=0;
 const valid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(from)||!valid(end)||from>end)return {points,rainTotal,rainDays,gddTotal,temperatureDays,days:0,sources:[]};
 const count=Math.min(366,Math.floor((Date.parse(end)-Date.parse(from))/86400000)+1),sources=new Set<string>();
 for(let i=0;i<count;i++){
  const date=dayAfter(from,i),candidate=days.get(date),w=candidate&&!duplicates.has(date)&&candidate.availableAt.slice(0,10)<=c.asOfDate&&['observed','estimated'].includes(candidate.status)?candidate:undefined;
  const rain=w&&finite(w.rainMm)&&w.rainMm>=0?w.rainMm:null;
  const temp=w&&finite(w.temperatureMeanC)?w.temperatureMeanC:w&&finite(w.temperatureMinC)&&finite(w.temperatureMaxC)?(w.temperatureMinC+w.temperatureMaxC)/2:null;
  const gdd=temp!==null&&baseC!==null&&finite(baseC)?Math.max(0,temp-baseC):null;
  if(rain!==null){rainTotal+=rain;rainDays++;}if(gdd!==null){gddTotal+=gdd;temperatureDays++;}if(w)sources.add(w.source);
  points.push({date,rain,rainCumulative:rain===null?null:rainTotal,gdd,gddCumulative:gdd===null?null:gddTotal,status:w?.status??null});
 }
 return {points,rainTotal,rainDays,gddTotal,temperatureDays,days:count,sources:[...sources]};
}
export function datedLineSegments(points:{date:string;value:number|null}[],maxGapDays=20){
 const segments:{date:string;value:number}[][]=[];let segment:{date:string;value:number}[]=[];
 for(const p of points){
  if(p.value===null||!finite(p.value)){if(segment.length)segments.push(segment);segment=[];continue;}
  if(segment.length&&(Date.parse(p.date)-Date.parse(segment.at(-1)!.date))/86400000>maxGapDays){segments.push(segment);segment=[];}
  segment.push({date:p.date,value:p.value});
 }if(segment.length)segments.push(segment);return segments;
}
const csv=(v:string|number|null)=>v===null?'':typeof v==='number'?String(v):'"'+(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replaceAll('"','""')+'"';
export function fieldEvolutionCsv(c:SeasonalConfig,from:string,to:string,baseC:number|null){
 const index=fieldIndexEvolution(c),weather=fieldWeatherEvolution(c,from,to,baseC),values=new Map(index.points.filter(p=>p.date>=from&&p.date<=to).map(p=>[p.date,p]));
 const rows=weather.points.map(p=>[p.date,values.get(p.date)?.ndvi??null,values.get(p.date)?.evi??null,values.get(p.date)?.coverage??null,p.rain,p.rainCumulative,p.gdd,p.gddCumulative,p.status,baseC,index.ndviLabel]);
 return '\uFEFF'+[['date','ndvi','evi','fraction_claire_ou_grille_qualifiee','pluie_mm','cumul_pluie_renseignee_mm','degres_jours','cumul_degres_jours_renseignes','statut_meteo','base_thermique_c','statistique_ndvi'],...rows].map(r=>r.map(v=>csv(v as string|number|null)).join(';')).join('\r\n');
}
