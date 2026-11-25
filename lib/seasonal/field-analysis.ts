import type {SeasonalConfig,WeatherDay} from './types.ts';
import {geometryIdentity} from './provenance.ts';
import {fieldMonitoringScope,zoneGrid,type ZoneSeasonRead,type FieldImageSearch} from './field-zones.ts';
import {MINIMUM_FIELD_IMAGE_COVERAGE} from './sentinel-quality.ts';
import {cropById, applyCropProfile} from './catalog.ts';
import {containsPoint,distanceM,parcelMetrics,type Position} from './parcel.ts';
import type {FieldVisitTarget} from './agronomic.ts';
import {satelliteMonitoringScope} from './satellite.ts';

export const dayAfter=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
/** Keep old campaigns on their own season; recent sowing needs a useful look-back. */
export function fieldImagePeriod(c:SeasonalConfig){
 const search=c.fieldMonitoring?.scope===fieldMonitoringScope(c)?c.fieldMonitoring.imagerySearch:undefined;
 if(search&&search.retrievedOn<=c.asOfDate)return {from:search.from,to:search.to};
 const archived=fieldImageArchive(c);
 if(archived.length&&!c.stages.length)return {from:archived[0].season.startDate,to:archived.at(-1)!.season.startDate};
 if(!c.stages.length||c.inputs?.values.sowingDate?.origin==='default'&&c.sowingDate===c.asOfDate)return {from:dayAfter(c.asOfDate,-90)<'2017-01-01'?'2017-01-01':dayAfter(c.asOfDate,-90),to:c.asOfDate};
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
export function fieldImageArchive(c:SeasonalConfig,preparedGrid?:ReturnType<typeof zoneGrid>){
 if(!c.parcelGeometry||c.fieldMonitoring?.scope!==fieldMonitoringScope(c))return [];
 const grid=preparedGrid??zoneGrid(c.parcelGeometry),m=c.fieldMonitoring,dates=new Map<string,ZoneSeasonRead>();
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
export const FIELD_IMAGE_CLEAR_TARGET=MINIMUM_FIELD_IMAGE_COVERAGE;
/** Date availability is measured on native NDVI surface. Statistical summary
 * cells remain a separate support and cannot hide a usable native image. */
export function meetsFieldImageTarget(grid:ReturnType<typeof zoneGrid>,read:ZoneSeasonRead,target=FIELD_IMAGE_CLEAR_TARGET){
 void grid;return read.scenes.length===1&&read.scenes[0].clearFraction>=target-1e-8;
}
/** Old 80% exclusions with measured NDVI can be qualified immediately. A date
 * whose reflectance bands were skipped needs a fresh read, not an invented NDVI. */
export function currentFieldImageSearch(q:FieldImageSearch):FieldImageSearch{
 if(q.minimumCoverage===FIELD_IMAGE_CLEAR_TARGET)return q;
 const entries=q.entries.map(e=>{
  if(e.status!=='insufficient'||e.clearFraction===undefined)return e;
  if(e.clearFraction<FIELD_IMAGE_CLEAR_TARGET-1e-8)return {...e,reason:'Surface NDVI native exploitable '+Math.round(e.clearFraction*100)+' % ; minimum 20 %.'};
  if((e.cells??0)>0&&e.itemId)return {...e,status:'usable' as const,reason:undefined};
  return {...e,status:'pending' as const,reason:'Nouveau seuil de 20 % : lecture des bandes NDVI à reprendre.'};
 });
 return {...q,entries,complete:q.complete&&!entries.some(e=>e.status==='pending')};
}
/** The main picker contains only qualified dates. Compact verified calendar
 * entries keep older dates visible even when their detailed grid is not cached. */
export function fieldImageChoices(c:SeasonalConfig,preparedGrid?:ReturnType<typeof zoneGrid>,archive?:ZoneSeasonRead[]){
 if(!c.parcelGeometry)return [];
 const grid=preparedGrid??zoneGrid(c.parcelGeometry),choices=new Map<string,{date:string;itemId:string;clearFraction:number}>();
 const search=c.fieldMonitoring?.scope===fieldMonitoringScope(c)?c.fieldMonitoring.imagerySearch:undefined;
 if(search&&search.retrievedOn<=c.asOfDate)for(const e of currentFieldImageSearch(search).entries)if(e.status==='usable'&&e.itemId&&e.clearFraction!==undefined&&e.clearFraction>=FIELD_IMAGE_CLEAR_TARGET-1e-8&&e.date<=c.asOfDate)choices.set(e.date,{date:e.date,itemId:e.itemId,clearFraction:e.clearFraction});
 for(const r of archive??fieldImageArchive(c,grid)){
  const date=r.season.startDate;
  if(meetsFieldImageTarget(grid,r))choices.set(date,{date,itemId:r.scenes[0].itemId,clearFraction:r.scenes[0].clearFraction});
  else if(choices.get(date)?.itemId===r.scenes[0].itemId)choices.delete(date);
 }
 return [...choices.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export const FIELD_CHANGE_RULE={minimumCoverage:.60,minimumCells:12,residual:.10,minimumZoneM2:400,minimumZoneCells:2,persistenceDays:20} as const;
type Grid=ReturnType<typeof zoneGrid>;
type ChangeCell={id:number;areaM2:number;delta:number;residual:number};
export type FieldChangeZone={
 id:string;cellIds:number[];areaM2:number;direction:'lower'|'higher';residual:number;repeatedOn:string|null;
};
export type FieldMapFocus=FieldVisitTarget&{observed?:Position;fromNote?:boolean};

/** A declared sowing date anchors the reference calendar. The simulation's
 * starter values and a site's image history cannot identify the crop stage. */
export function fieldCropStage(c:SeasonalConfig,date:string){
 if(!date||c.agronomic&&c.agronomic.system!=='single')return null;
 const saved=c.fieldMonitoring?.scope===fieldMonitoringScope(c)?c.fieldMonitoring.cropContext:undefined;
 const sowing=c.inputs?.values.sowingDate;
 const context=saved??(sowing?.origin==='manual'&&sowing.value===c.sowingDate&&c.cropProfile?{cropId:c.cropProfile.id,sowingDate:c.sowingDate}:undefined);
 if(!context)return null;
 const profile=cropById(context.cropId);
 if(!profile)return null;
 const useCampaignCycle=c.cropProfile?.id===context.cropId&&c.sowingDate===context.sowingDate&&c.stages.length>0;
 if(!useCampaignCycle&&(!profile.water||profile.water.durationIssue))return null;
 const stages=useCampaignCycle?c.stages:applyCropProfile(c,context.cropId).stages;
 const elapsed=(Date.parse(date)-Date.parse(context.sowingDate))/86400000;
 let end=0;
 for(const [index,stage] of stages.entries()){
  const start=end;end+=stage.days;
  if(elapsed>=start&&elapsed<end)return {key:context.cropId+':'+context.sowingDate+':'+index,crop:profile.name,name:stage.name};
 }
 return null;
}

function weightedMedian(values:{value:number;areaM2:number}[]){
 const sorted=[...values].sort((a,b)=>a.value-b.value);
 const half=sorted.reduce((sum,v)=>sum+v.areaM2,0)/2;
 let area=0;
 for(const [i,v] of sorted.entries()){
  area+=v.areaM2;
  if(Math.abs(area-half)<1e-8&&sorted[i+1])return (v.value+sorted[i+1].value)/2;
  if(area>=half)return v.value;
 }
 return null;
}
function qualifiedRead(grid:Grid,read?:ZoneSeasonRead){
 const date=read?.scenes[0]?.date;
 return !!read&&read.gridM===grid.gridM&&read.geometryId===geometryIdentity(grid.shape)&&
  !!date&&read.season.startDate===date&&read.season.endDate===date&&meetsFieldImageTarget(grid,read);
}
/** When the cache has three clear dates at one stage, reserve a distinct
 * follow-up for checking the spatial pattern from the same baseline. */
export function fieldComparisonBaseline(c:SeasonalConfig,grid:Grid,archive:ZoneSeasonRead[],date:string){
 const previous=archive.filter(r=>r.season.startDate<date&&qualifiedRead(grid,r));
 const stage=fieldCropStage(c,date);
 const comparable=stage?previous.filter(r=>r.season.startDate>=dayAfter(date,-FIELD_CHANGE_RULE.persistenceDays)&&
  fieldCropStage(c,r.season.startDate)?.key===stage.key):[];
 return comparable.at(-2)??previous.at(-1);
}
function pairedChange(grid:Grid,a?:ZoneSeasonRead,b?:ZoneSeasonRead,third?:Map<number,number>){
 const validA=qualifiedRead(grid,a),validB=qualifiedRead(grid,b);
 const left=fieldImageSummary(grid,validA?a:undefined).values,right=fieldImageSummary(grid,validB?b:undefined).values;
 const shared=grid.cells.filter(c=>left.has(c.id)&&right.has(c.id)&&(!third||third.has(c.id)));
 const areaM2=shared.reduce((sum,c)=>sum+c.areaM2,0),coverage=Math.min(1,areaM2/grid.areaM2);
 const qualified=validA&&validB&&a!.season.startDate!==b!.season.startDate&&
  shared.length>=FIELD_CHANGE_RULE.minimumCells&&coverage>=FIELD_CHANGE_RULE.minimumCoverage;
 const changes=shared.map(c=>({id:c.id,areaM2:c.areaM2,value:right.get(c.id)!-left.get(c.id)!}));
 const delta=qualified?weightedMedian(changes):null;
 const cells:ChangeCell[]=delta===null?[]:changes.map(c=>({id:c.id,areaM2:c.areaM2,delta:c.value,residual:c.value-delta}));
 return {coverage,areaM2,cells:shared.length,delta,changes:cells};
}
function changeZones(grid:Grid,changes:ChangeCell[]):FieldChangeZone[]{
 const [west,south,,north]=grid.bounds;
 const dx=grid.gridM/(111320*Math.max(.2,Math.cos((south+north)/2*Math.PI/180))),dy=grid.gridM/111320;
 const positions=new Map(grid.cells.map(c=>[c.id,[Math.floor((c.center[0]-west)/dx),Math.floor((c.center[1]-south)/dy)]]));
 const outliers=new Map(changes.filter(c=>Math.abs(c.residual)>=FIELD_CHANGE_RULE.residual-1e-10).map(c=>[positions.get(c.id)!.join(':'),c]));
 const zones:FieldChangeZone[]=[];
 for(const [key,first] of outliers){
  const group=[first];outliers.delete(key);
  for(const c of group){
   const [x,y]=positions.get(c.id)!;
   for(const neighbor of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const id=neighbor.join(':'),cell=outliers.get(id);
    if(cell&&Math.sign(cell.residual)===Math.sign(first.residual)){outliers.delete(id);group.push(cell);}
   }
  }
  const areaM2=group.reduce((sum,c)=>sum+c.areaM2,0);
  if(group.length<FIELD_CHANGE_RULE.minimumZoneCells||areaM2<FIELD_CHANGE_RULE.minimumZoneM2)continue;
  const cellIds=group.map(c=>c.id).sort((a,b)=>a-b);
  zones.push({id:'ndvi-'+cellIds[0],cellIds,areaM2,direction:first.residual<0?'lower':'higher',
   residual:weightedMedian(group.map(c=>({areaM2:c.areaM2,value:c.residual})))!,repeatedOn:null});
 }
 return zones.sort((a,b)=>b.areaM2-a.areaM2||a.cellIds[0]-b.cellIds[0]);
}

/** Compare numeric NDVI on the same cells. Confirm a spatial pattern only
 * when a third image at the same reference stage reproduces it on common support. */
export function compareFieldImages(grid:Grid,a?:ZoneSeasonRead,b?:ZoneSeasonRead,options?:{
 archive:ZoneSeasonRead[];stageAt:(date:string)=>{key:string}|null;
}){
 const pair=pairedChange(grid,a,b),zones=changeZones(grid,pair.changes);
 const leftDate=a?.season.startDate??null,rightDate=b?.season.startDate??null;
 const stage=rightDate?options?.stageAt(rightDate):null;
 const comparableStage=!!stage&&!!leftDate&&options?.stageAt(leftDate)?.key===stage.key;
 let persistenceDates=0;
 if(zones.length&&comparableStage&&leftDate&&rightDate&&options){
  const forward=leftDate<rightDate,baseline=forward?a:b,followup=forward?b:a;
  const start=forward?leftDate:rightDate,end=forward?rightDate:leftDate;
  const candidates=options.archive.filter(r=>{
   const date=r.season.startDate;
   return date!==start&&date!==end&&Math.abs(Date.parse(date)-Date.parse(end))/86400000<=FIELD_CHANGE_RULE.persistenceDays&&
    options.stageAt(date)?.key===stage!.key&&qualifiedRead(grid,r);
  }).sort((x,y)=>Math.abs(Date.parse(x.season.startDate)-Date.parse(end))-Math.abs(Date.parse(y.season.startDate)-Date.parse(end)));
  for(const other of candidates){
   const first=pairedChange(grid,baseline,followup,fieldImageSummary(grid,other).values);
   if(first.delta===null)continue;
   const second=other.season.startDate>start
    ?pairedChange(grid,baseline,other,fieldImageSummary(grid,followup).values)
    :pairedChange(grid,other,baseline,fieldImageSummary(grid,followup).values);
   persistenceDates++;
   const firstById=new Map(first.changes.map(c=>[c.id,c])),secondZones=changeZones(grid,second.changes);
   for(const zone of zones.filter(z=>!z.repeatedOn)){
    const sign=(zone.direction==='lower'?-1:1)*(forward?1:-1);
    const support=new Set(zone.cellIds);
    const repeats=secondZones.some(z=>{
     const overlap=z.cellIds.map(id=>firstById.get(id)!).filter(c=>support.has(c.id)&&c.residual*sign>=FIELD_CHANGE_RULE.residual-1e-10);
     return Math.sign(z.residual)===sign&&overlap.length>=FIELD_CHANGE_RULE.minimumZoneCells&&
      overlap.reduce((sum,c)=>sum+c.areaM2,0)>=Math.max(FIELD_CHANGE_RULE.minimumZoneM2,zone.areaM2*.5);
    });
    if(repeats)zone.repeatedOn=other.season.startDate;
   }
   if(zones.every(z=>z.repeatedOn))break;
  }
 }
 zones.sort((a,b)=>Number(!!b.repeatedOn)-Number(!!a.repeatedOn)||b.areaM2-a.areaM2);
 return {...pair,leftDate,rightDate,gridM:grid.gridM,zones,comparableStage,persistenceDates};
}

function pointInCell(cell:Grid['cells'][number]):Position|null{
 for(const coordinates of cell.geometry.coordinates){
  const inside=(p:Position)=>containsPoint(coordinates[0],p)&&!coordinates.slice(1).some(r=>containsPoint(r,p));
  if(inside(cell.center))return cell.center;
  const centroid=parcelMetrics({type:'Polygon',coordinates});
  if(centroid.pointIsCentroid&&inside(centroid.point))return centroid.point;
  // Find an interior interval even when the centroid falls in a hole or a concavity.
  const rows=[...new Set(coordinates.flatMap(r=>r.map(p=>p[1])))].sort((a,b)=>a-b);
  for(let i=1;i<rows.length;i++){
   const y=(rows[i-1]+rows[i])/2,xs:number[]=[];
   for(const ring of coordinates)for(let j=1;j<ring.length;j++){
    const [a,b]=[ring[j-1],ring[j]];
    if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   xs.sort((a,b)=>a-b);
   if(xs.length>=2)return [(xs[0]+xs[1])/2,y];
  }
 }
 return null;
}

export function fieldVisitTarget(grid:Grid,change:ReturnType<typeof compareFieldImages>,zone?:FieldChangeZone):FieldVisitTarget{
 const dates=[change.leftDate,change.rightDate].filter((d):d is string=>!!d).sort();
 if(!zone)return {dates:[...new Set(dates)]};
 const ids=new Set(zone.cellIds),cells=grid.cells.filter(c=>ids.has(c.id)).sort((a,b)=>b.areaM2-a.areaM2);
 const planned=cells.length?pointInCell(cells[0]):null;
 const comparisonIds=new Set(change.changes.filter(c=>Math.abs(c.residual)<FIELD_CHANGE_RULE.residual/2).map(c=>c.id));
 const comparison=planned&&change.comparableStage?grid.cells.filter(c=>comparisonIds.has(c.id)&&c.areaM2>=grid.gridM**2*.5)
  .map(pointInCell).filter((p):p is Position=>p!==null)
  .map(point=>({point,distance:distanceM(planned,point)})).filter(c=>c.distance>=grid.gridM)
  .sort((a,b)=>a.distance-b.distance)[0]?.point:null;
 return {dates,zone:{id:zone.id,cellIds:zone.cellIds,areaM2:zone.areaM2,gridM:grid.gridM,...(zone.repeatedOn?{repeatedOn:zone.repeatedOn}:{})},
  ...(planned?{planned}:{}),...(comparison?{comparison}:{})};
}
export function fieldIndexEvolution(c:SeasonalConfig){
 const m=c.satelliteMonitoring;
 const verified=c.fieldMonitoring?.scope===fieldMonitoringScope(c)?c.fieldMonitoring.imagerySearch:undefined;
 if(verified&&verified.retrievedOn<=c.asOfDate){
  const native=m?.scope===satelliteMonitoringScope(c)&&m.retrievedOn<=c.asOfDate?m.observations:[];
  return {method:'Moyennes des médianes de cellules, pondérées par leur surface',ndviLabel:'NDVI moyen (grille)',points:currentFieldImageSearch(verified).entries.filter(e=>e.date<=c.asOfDate).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({date:e.date,ndvi:e.status==='usable'?e.ndviMean??null:null,evi:native.find(o=>o.date===e.date&&o.availableOn<=c.asOfDate&&o.clearFraction>=FIELD_IMAGE_CLEAR_TARGET&&o.quality==='usable')?.eviMedian??null,coverage:e.gridCoverage??0}))};
 }
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
