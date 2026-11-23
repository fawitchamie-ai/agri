import {bbox,multiArea} from './land.ts';
import {intersection,union} from './geometry-ops.ts';
import {parcelMetrics,validateParcel,type ParcelPolygon,type Position} from './parcel.ts';
import {geometryIdentity} from './provenance.ts';
import type {SeasonalConfig} from './types.ts';
import type {SentinelMaskCoverage} from './sentinel-scene.ts';

export const FIELD_ZONES_VERSION='field-zones-1' as const;
export const FIELD_ZONES_VALIDATION_VERSION='field-zones-temporal-3' as const;
export const FIELD_ZONES_MIN_AGREEMENT=.65;
export const ZONE_NAMES={low:'Vigueur plus faible',medium:'Vigueur intermédiaire',high:'Vigueur plus forte',variable:'Zone variable',unknown:'Données insuffisantes'} as const;
export const ZONE_COLORS={low:'#90b8df',medium:'#497da9',high:'#173d63',variable:'#d5ae6d',unknown:'#e2e8ef'} as const;
export type ZoneClass=keyof typeof ZONE_NAMES;
export type ZoneSeason={id:string;startDate:string;endDate:string;cropId:string;comparable:boolean};
export type ZoneSeasonRead={version:typeof FIELD_ZONES_VERSION;geometryId:string;season:ZoneSeason;retrievedOn:string;source:string;
  gridM:number;scenes:{date:string;itemId:string;clearFraction:number;mask?:SentinelMaskCoverage}[];
  cells:[number,number,number][];issues:string[]}; // grid index, NDVI median, independent clear dates
export type ZoneDoseInput={kind:'seeds'|'fertilizer'|'treatment';product:string;unit:'seeds/ha'|'kg/ha'|'L/ha';
  reference:string;baseline:number;rates:Partial<Record<ZoneClass,number>>;confirmed:boolean;mapScope?:string};
export type FieldMonitoring={version:typeof FIELD_ZONES_VERSION;scope:string;cultivatedContour:boolean;comparableManagement:boolean;
  seasons:ZoneSeasonRead[];prescription?:ZoneDoseInput;currentObservation?:ZoneSeasonRead;datedObservations?:ZoneSeasonRead[]};
export type ZoneGridCell={id:number;geometry:{type:'MultiPolygon';coordinates:Position[][][]};areaM2:number;center:Position};
export const fieldMonitoringScope=(c:Pick<SeasonalConfig,'country'|'parcelGeometry'|'cropProfile'|'crop'|'sowingDate'>)=>JSON.stringify([c.country,geometryIdentity(c.parcelGeometry),c.cropProfile?.id??c.crop,c.sowingDate]);
const validDay=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function parseZoneSeason(value:unknown,today=new Date().toISOString().slice(0,10)):ZoneSeason{
 const s=value as ZoneSeason;
 if(!s||typeof s.id!=='string'||!s.id.trim()||s.id.length>80||!validDay(s.startDate)||!validDay(s.endDate)||s.startDate<'2017-01-01'||s.endDate>today||s.startDate>s.endDate||(Date.parse(s.endDate)-Date.parse(s.startDate))/86400000>120||typeof s.cropId!=='string'||s.cropId.length>80||!s.cropId||typeof s.comparable!=='boolean')throw new Error('Saison satellite invalide : dates passées, fenêtre de 120 jours maximum et culture requises.');
 return {id:s.id,startDate:s.startDate,endDate:s.endDate,cropId:s.cropId,comparable:s.comparable};
}
/** Fixed coarsened grid, clipped to the real outline (including holes).
 * The lattice is deterministic for a geometry; it never invents subpixel detail. */
export function zoneGrid(input:unknown){
 const shape=validateParcel(input),area=parcelMetrics(shape).areaM2;
 if(area>5_000_000)throw new Error('Analyse historique limitée à 500 ha par secteur. Découpez le contour.');
 const [w,s,e,n]=bbox(shape),cos=Math.max(.2,Math.cos((s+n)/2*Math.PI/180));
 let gridM=Math.max(20,Math.ceil(Math.sqrt(area/1800)/10)*10),dx=gridM/(111320*cos),dy=gridM/111320;
 while(Math.ceil((e-w)/dx)*Math.ceil((n-s)/dy)>3000){gridM+=10;dx=gridM/(111320*cos);dy=gridM/111320;}
 const cells:ZoneGridCell[]=[];
 for(let y=0;y<Math.ceil((n-s)/dy);y++)for(let x=0;x<Math.ceil((e-w)/dx);x++){
  const left=w+x*dx,bottom=s+y*dy,right=Math.min(e,left+dx),top=Math.min(n,bottom+dy);
  const ring:Position[]=[[left,bottom],[right,bottom],[right,top],[left,top],[left,bottom]];
  const cut=intersection([shape.coordinates],[[ring]]),areaM2=multiArea(cut);
  if(areaM2<=.001)continue;
  cells.push({id:cells.length,geometry:{type:'MultiPolygon',coordinates:cut},areaM2,center:[(left+right)/2,(bottom+top)/2]});
 }
 const sum=cells.reduce((n,c)=>n+c.areaM2,0);
 if(Math.abs(sum-area)>Math.max(.01,area*1e-6))throw new Error('Surfaces de la grille historique incohérentes.');
 return {shape,cells,gridM,areaM2:area,bounds:[w,s,e,n] as [number,number,number,number]};
}
export const middle=(values:number[])=>{const a=[...values].sort((a,b)=>a-b),m=a.length>>1;return a.length?a.length%2?a[m]:(a[m-1]+a[m])/2:null;};
const quantile=(a:number[],p:number)=>{const sorted=[...a].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]??0;};
const classify=(rank:number):'low'|'medium'|'high'=>rank<1/3?'low':rank>2/3?'high':'medium';
/** Area-weighted midranks, preserving ties and spatial support. */
export function spatialRanks(values:{id:number;value:number;area:number}[]){
 const sorted=[...values].sort((a,b)=>a.value-b.value),total=sorted.reduce((n,v)=>n+v.area,0),out=new Map<number,number>();let below=0;
 for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&Math.abs(sorted[j].value-sorted[i].value)<1e-6)j++;
  const weight=sorted.slice(i,j).reduce((n,v)=>n+v.area,0),rank=(below+weight/2)/total;
  for(let k=i;k<j;k++)out.set(sorted[k].id,rank);below+=weight;i=j;
 }return out;
}
export type ZonePersistenceOptions={predictor:'median'|'mean'|'recent';filter:'none'|'one-ring-mean'};
/** Fit exclusively on earlier years. Evaluation masks cannot change these ranks.
 * Alternative predictors/filters are available to the offline study only; the
 * application keeps median/none until an independent experiment qualifies one. */
export function fitZonePersistence(grid:ReturnType<typeof zoneGrid>,training:Map<number,number>[],options:ZonePersistenceOptions={predictor:'median',filter:'none'}){
 if(training.length<2)return null;
 const cells=grid.cells.filter(c=>training.every(m=>m.has(c.id))),area=cells.reduce((sum,c)=>sum+c.areaM2,0);
 if(cells.length<12||area/grid.areaM2<.6)return null;
 const ranks=training.map(m=>spatialRanks(cells.map(c=>({id:c.id,value:m.get(c.id)!,area:c.areaM2}))));
 let values=new Map(cells.map(c=>{
  const rr=ranks.map(r=>r.get(c.id)!),n=rr.length;
  const value=options.predictor==='median'?middle(rr)!:options.predictor==='mean'?rr.reduce((s,r)=>s+r,0)/n:rr.reduce((s,r,i)=>s+(i+1)*r,0)/(n*(n+1)/2);
  return [c.id,value] as const;
 }));
 if(options.filter==='one-ring-mean'){
  const previous=values,cos=Math.cos((grid.bounds[1]+grid.bounds[3])/2*Math.PI/180);
  values=new Map(cells.map(c=>{
   const near=cells.filter(p=>Math.abs(c.center[0]-p.center[0])*111320*cos<=grid.gridM*1.1&&Math.abs(c.center[1]-p.center[1])*111320<=grid.gridM*1.1);
   return [c.id,near.reduce((s,p)=>s+previous.get(p.id)!*p.areaM2,0)/near.reduce((s,p)=>s+p.areaM2,0)] as const;
  }));
 }
 return {cells,values};
}
/** Area-weighted diagnostics against unsmoothed held-year observations.
 * Pixels and the nine spatial blocks are not independent farms or trials. */
export function scoreZonePersistence(grid:ReturnType<typeof zoneGrid>,prediction:ReturnType<typeof fitZonePersistence>,target:Map<number,number>){
 if(!prediction)return null;
 const targetCells=prediction.cells.filter(c=>target.has(c.id)),area=targetCells.reduce((s,c)=>s+c.areaM2,0);
 if(targetCells.length<12||area/grid.areaM2<.6)return null;
 const actual=spatialRanks(targetCells.map(c=>({id:c.id,value:target.get(c.id)!,area:c.areaM2})));
 const classes=['low','medium','high'] as const,index=(rank:number)=>rank<1/3?0:rank>2/3?2:1;
 const matrix=Array.from({length:3},()=>[0,0,0]),blocks=new Map<string,{block:string;areaM2:number;matchedM2:number}>();let matched=0;
 const [w,s,e,n]=grid.bounds;
 for(const c of targetCells){
  const truth=index(actual.get(c.id)!),pred=index(prediction.values.get(c.id)!);matrix[truth][pred]+=c.areaM2;if(truth===pred)matched+=c.areaM2;
  const key=`${Math.min(2,Math.floor((c.center[0]-w)/(e-w)*3))}:${Math.min(2,Math.floor((c.center[1]-s)/(n-s)*3))}`;
  const b=blocks.get(key)??{block:key,areaM2:0,matchedM2:0};b.areaM2+=c.areaM2;if(truth===pred)b.matchedM2+=c.areaM2;blocks.set(key,b);
 }
 const rows=matrix.map(r=>r.reduce((a,b)=>a+b,0)),cols=[0,1,2].map(i=>matrix.reduce((sum,r)=>sum+r[i],0));
 const expected=rows.reduce((sum,v,i)=>sum+v*cols[i]/area**2,0),agreement=matched/area;
 return {version:FIELD_ZONES_VALIDATION_VERSION,agreement,
  balancedAccuracy:rows.reduce((sum,v,i)=>sum+(v?matrix[i][i]/v:0),0)/rows.filter(v=>v>0).length,
  majorityBaseline:Math.max(...rows)/area,kappa:expected>=1-1e-12?null:(agreement-expected)/(1-expected),
  coverage:area/grid.areaM2,trainingCoverage:prediction.cells.reduce((sum,c)=>sum+c.areaM2,0)/grid.areaM2,cells:targetCells.length,
  classOrder:classes,confusionHa:matrix.map(r=>r.map(v=>v/10000)),
  blocks:[...blocks.values()].map(b=>({...b,agreement:b.matchedM2/b.areaM2}))};
}
export function parseFieldMonitoring(value:unknown,c:SeasonalConfig):FieldMonitoring|undefined{
 if(value===undefined)return undefined;
 const m=value as FieldMonitoring,today=new Date().toISOString().slice(0,10);
 if(!m||m.version!==FIELD_ZONES_VERSION||typeof m.scope!=='string'||!m.scope||m.scope.length>300000||typeof m.cultivatedContour!=='boolean'||typeof m.comparableManagement!=='boolean'||!Array.isArray(m.seasons)||m.seasons.length>6)throw new Error('Suivi historique du champ invalide.');
 const parseRead=(r:ZoneSeasonRead)=>{
  if(!r||r.version!==FIELD_ZONES_VERSION||typeof r.geometryId!=='string'||r.geometryId.length>300000||!validDay(r.retrievedOn)||r.retrievedOn>today||typeof r.source!=='string'||r.source.length>1200||!Number.isInteger(r.gridM)||r.gridM<20||r.gridM>10000||!Array.isArray(r.cells)||r.cells.length>3000||!Array.isArray(r.scenes)||r.scenes.length>6||!Array.isArray(r.issues)||r.issues.length>8||r.issues.some(i=>typeof i!=='string'||i.length>600))throw new Error('Archive historique satellite invalide.');
  const season=parseZoneSeason(r.season,today);
  if(r.retrievedOn<season.endDate)throw new Error('Date de récupération antérieure à la fin des observations.');
  const scenes=r.scenes.map(o=>{
   if(!o||!validDay(o.date)||o.date<season.startDate||o.date>season.endDate||typeof o.itemId!=='string'||o.itemId.length>200||!Number.isFinite(o.clearFraction)||o.clearFraction<0||o.clearFraction>1)throw new Error('Scène historique invalide.');
   let mask:SentinelMaskCoverage|undefined;
   if(o.mask!==undefined){
    const keys=['clear','cloud','shadow','water','uncertain','noData','other'] as const;
    if(!o.mask||keys.some(k=>typeof o.mask![k]!=='number'||!Number.isFinite(o.mask![k])||o.mask![k]<0||o.mask![k]>1)||Math.abs(keys.reduce((n,k)=>n+o.mask![k],0)-1)>.001)throw new Error('Couverture du masque satellite invalide.');
    mask=Object.fromEntries(keys.map(k=>[k,o.mask![k]])) as SentinelMaskCoverage;
   }
   return {date:o.date,itemId:o.itemId,clearFraction:o.clearFraction,...(mask?{mask}:{})};
  });
  if(new Set(scenes.map(o=>o.date)).size!==scenes.length)throw new Error('Dates de scènes historiques dupliquées.');
  const cells=r.cells.map(v=>{if(!Array.isArray(v)||v.length!==3||!Number.isInteger(v[0])||v[0]<0||v[0]>=3000||!Number.isFinite(v[1])||v[1]<-1||v[1]>1||!Number.isInteger(v[2])||v[2]<1||v[2]>scenes.length)throw new Error('Pixel historique invalide.');return [v[0],v[1],v[2]] as [number,number,number];});
  if(new Set(cells.map(v=>v[0])).size!==cells.length)throw new Error('Cellule historique dupliquée.');
  return {version:FIELD_ZONES_VERSION,geometryId:r.geometryId,season,retrievedOn:r.retrievedOn,source:r.source,gridM:r.gridM,scenes,cells,issues:r.issues.slice()};
 };
 const seasons=m.seasons.map(parseRead),currentObservation=m.currentObservation===undefined?undefined:parseRead(m.currentObservation);
 if(currentObservation&&(currentObservation.season.startDate!==currentObservation.season.endDate||currentObservation.scenes.length!==1))throw new Error('Une carte datée doit correspondre à une acquisition unique.');
 if(m.datedObservations!==undefined&&(!Array.isArray(m.datedObservations)||m.datedObservations.length>12))throw new Error('Douze cartes NDVI datées maximum par campagne.');
 const datedObservations=m.datedObservations?.map(parseRead);
 if(datedObservations?.some(r=>r.season.startDate!==r.season.endDate||r.scenes.length!==1)||datedObservations&&new Set(datedObservations.map(r=>r.season.startDate)).size!==datedObservations.length)throw new Error('Les cartes archivées doivent porter sur des dates uniques et une seule acquisition.');
 if(new Set(seasons.map(r=>r.season.id)).size!==seasons.length)throw new Error('Saisons historiques dupliquées.');
 if(new Set(seasons.map(r=>r.season.startDate.slice(0,4))).size!==seasons.length)throw new Error('Choisissez une seule fenêtre comparable par année.');
 const ordered=[...seasons].sort((a,b)=>a.season.startDate.localeCompare(b.season.startDate));
 if(ordered.some((r,i)=>i>0&&r.season.startDate<=ordered[i-1].season.endDate))throw new Error('Les fenêtres historiques ne doivent pas se chevaucher.');
 let prescription:ZoneDoseInput|undefined;
 if(m.prescription){const p=m.prescription;
  if(!['seeds','fertilizer','treatment'].includes(p.kind)||!['seeds/ha','kg/ha','L/ha'].includes(p.unit)||p.kind!=='seeds'&&p.unit==='seeds/ha'||typeof p.product!=='string'||!p.product.trim()||p.product.length>160||typeof p.reference!=='string'||!p.reference.trim()||p.reference.length>600||typeof p.confirmed!=='boolean'||!Number.isFinite(p.baseline)||p.baseline<0||p.baseline>1000000||!p.rates||typeof p.rates!=='object')throw new Error('Carte de doses : produit, unité, référence et dose valides requis.');
  const rates:ZoneDoseInput['rates']={};
  for(const key of Object.keys(ZONE_NAMES) as ZoneClass[]){const n=p.rates[key];if(n===undefined)continue;if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000000)throw new Error('Dose par zone invalide.');rates[key]=n;}
  if(p.mapScope!==undefined&&(typeof p.mapScope!=='string'||!/^zone-map-1:[0-9a-f]{8}$/.test(p.mapScope)))throw new Error('Référence de carte invalide.');
  prescription={kind:p.kind,product:p.product.trim(),unit:p.unit,reference:p.reference.trim(),baseline:p.baseline,rates,confirmed:p.confirmed,...(p.mapScope?{mapScope:p.mapScope}:{})};
 }
 void c;return {version:FIELD_ZONES_VERSION,scope:m.scope,cultivatedContour:m.cultivatedContour,comparableManagement:m.comparableManagement,seasons,...(prescription?{prescription}:{}),...(currentObservation?{currentObservation}:{}),...(datedObservations?{datedObservations}:{})};
}
export type ZoneAnalysis=ReturnType<typeof analyzeFieldZones>;
/** Descriptive ranks + a genuinely withheld last-season spatial check.
 * Thresholds are explicit engineering heuristics, never calibrated crop yields. */
export function analyzeFieldZones(c:SeasonalConfig){
 if(!c.parcelGeometry)throw new Error('Tracez le contour cultivé pour analyser ses zones.');
 const grid=zoneGrid(c.parcelGeometry),saved=c.fieldMonitoring,current=saved?.scope===fieldMonitoringScope(c),all=current?saved!.seasons:[];
 const notes:string[]=[],excluded:{id:string;reason:string}[]=[],target=c.cropProfile?.id??c.crop;
 const reads=all.filter(r=>{
  const observed=new Set(r.cells.filter(v=>v[2]>=2).map(v=>v[0]));
  const area=grid.cells.filter(cell=>observed.has(cell.id)).reduce((n,cell)=>n+cell.areaM2,0);
  const repeated=all.some(other=>other!==r&&(other.season.startDate.slice(0,4)===r.season.startDate.slice(0,4)||other.season.startDate<=r.season.endDate&&r.season.startDate<=other.season.endDate));
  const reason=repeated?'Année répétée ou fenêtres qui se chevauchent':r.geometryId!==geometryIdentity(c.parcelGeometry)||r.gridM!==grid.gridM?'Contour ou grille différents':r.retrievedOn>c.asOfDate?'Images récupérées après la date d’analyse':r.season.endDate>=c.sowingDate?'Saison non antérieure au semis cible':observed.size<12?'Moins de 12 cellules observées sur deux dates':area/grid.areaM2<.6?'Moins de 60 % du champ observé sur deux dates pendant cette saison':null;
  if(reason)excluded.push({id:r.season.id,reason});return !reason;
 }).sort((a,b)=>a.season.endDate.localeCompare(b.season.endDate));
 const maps=reads.map(r=>new Map(r.cells.filter(v=>v[2]>=2).map(v=>[v[0],v[1]])));
 const common=grid.cells.filter(cell=>maps.length&&maps.every(m=>m.has(cell.id)));
 const commonArea=common.reduce((n,p)=>n+p.areaM2,0),coverage=commonArea/grid.areaM2;
 const contrasts=maps.map(m=>quantile(common.map(p=>m.get(p.id)!),.9)-quantile(common.map(p=>m.get(p.id)!),.1));
 const ranks=maps.map(m=>spatialRanks(common.map(p=>({id:p.id,value:m.get(p.id)!,area:p.areaM2}))));
 const sufficient=reads.length>=3&&new Set(reads.map(r=>r.season.startDate.slice(0,4))).size>=3&&common.length>=12&&coverage>=.6;
 const contrast=contrasts.filter(d=>d>=.1).length>=Math.ceil(reads.length*2/3);
 const cells=grid.cells.map(cell=>{
  const rr=ranks.map(m=>m.get(cell.id)).filter((v):v is number=>v!==undefined),rank=rr.length?middle(rr)!:null;
  const candidate=rank===null?'unknown':contrast?classify(rank):'medium';
  const agreement=rank===null?null:rr.filter(r=>(contrast?classify(r):'medium')===candidate).length/rr.length;
  const stable=sufficient&&agreement!==null&&agreement>=2/3;
  const zone:ZoneClass=rank===null?'unknown':!sufficient?'unknown':!stable?'variable':candidate;
  return {...cell,zone,rank,agreement,seasons:rr.length};
 });
 const stableArea=cells.filter(p=>['low','medium','high'].includes(p.zone)).reduce((n,p)=>n+p.areaM2,0);
 let backtestAgreement:number|null=null,backtest:ReturnType<typeof scoreZonePersistence>=null;
 const distinctYears=new Set(reads.map(r=>r.season.startDate.slice(0,4))).size;
 const temporalChecks:{seasonId:string;agreement:number;coverage:number}[]=[];
 for(let i=2;i<maps.length;i++){
  const training=maps.slice(0,i),model=fitZonePersistence(grid,training);
  const trainContrasts=model?training.map(m=>quantile(model.cells.map(p=>m.get(p.id)!),.9)-quantile(model.cells.map(p=>m.get(p.id)!),.1)):[];
  if(!model||trainContrasts.filter(d=>d>=.1).length<Math.ceil(training.length*2/3))continue;
  const targetValues=model.cells.filter(p=>maps[i].has(p.id)).map(p=>maps[i].get(p.id)!);
  if(quantile(targetValues,.9)-quantile(targetValues,.1)<.1)continue;
  const check=scoreZonePersistence(grid,model,maps[i]);if(check)temporalChecks.push({seasonId:reads[i].season.id,agreement:check.agreement,coverage:check.coverage});
 }
 if(sufficient&&distinctYears>=4&&contrast){
  const training=maps.slice(0,-1),model=fitZonePersistence(grid,training);
  // A held year's cloud mask must not decide which pixels normalize the
  // earlier years. Check raw training contrast before looking at its labels.
  const trainContrasts=model?training.map(m=>quantile(model.cells.map(p=>m.get(p.id)!),.9)-quantile(model.cells.map(p=>m.get(p.id)!),.1)):[];
  if(trainContrasts.filter(d=>d>=.1).length>=Math.ceil(training.length*2/3))backtest=scoreZonePersistence(grid,model,maps.at(-1)!);
  backtestAgreement=backtest?.agreement??null;
 }
 const allComparable=reads.length>0&&reads.every(r=>r.season.comparable&&r.season.cropId===target);
 const reasons:string[]=[];
 if(!sufficient)reasons.push('Au moins trois années, deux dates claires par cellule, 12 cellules et 60 % de surface commune sont nécessaires.');
 if(!contrast)reasons.push('Contraste de végétation insuffisant pour distinguer trois niveaux.');
 if(!saved?.cultivatedContour)reasons.push('Confirmez que le contour couvre uniquement la surface cultivée et reste identique.');
 if(!saved?.comparableManagement||!allComparable)reasons.push('Confirmez la même culture, un stade et une conduite comparables pour chaque saison.');
 if(distinctYears<4)reasons.push('Quatre années distinctes sont requises pour réserver la dernière au contrôle temporel.');
 else if(backtestAgreement===null)reasons.push('Le contrôle temporel demande assez de contraste et de surface observée dans les années précédentes et dans la saison réservée.');
 else if(backtestAgreement<FIELD_ZONES_MIN_AGREEMENT)reasons.push('Le classement prévu reproduit moins de 65 % de la surface de la dernière saison réservée.');
 if(distinctYears>=4&&(temporalChecks.length<2||temporalChecks.some(t=>t.agreement<FIELD_ZONES_MIN_AGREEMENT)))reasons.push('La projection demande au moins deux contrôles temporels réservés, tous à 65 % minimum.');
 if(stableArea/grid.areaM2<.4)reasons.push('Moins de 40 % du contour conserve un classement stable.');
 if(!current&&saved)notes.push('L’archive concerne un ancien contour, une autre culture ou un autre semis.');
 if(reads.length&&new Set(reads.map(r=>r.source)).size>1)notes.push('Sources satellite distinctes : transformations radiométriques vérifiées par asset, grille commune.');
 notes.push('Contrôle temporel : normalisation et prédiction ajustées sur les seules années précédentes ; masque de la dernière saison utilisé uniquement pour évaluer.');
 notes.push('Le rang de vigueur est relatif au champ. Il ne mesure ni la cause d’un stress, ni un rendement en tonnes, ni une probabilité de récolte.');
 const projection=reasons.length===0?'relative-hypothesis' as const:'unavailable' as const;
 const zones=(Object.keys(ZONE_NAMES) as ZoneClass[]).map(zone=>({id:zone,label:ZONE_NAMES[zone],areaM2:cells.filter(p=>p.zone===zone).reduce((n,p)=>n+p.areaM2,0)}));
 return {version:FIELD_ZONES_VERSION,basis:'relative_satellite_vigor_not_measured_yield' as 'relative_satellite_vigor_not_measured_yield'|'observed_satellite_vigor_not_measured_yield',mapKind:'history' as 'history'|'current-observation',observedOn:null as string|null,cultivatedContour:!!saved?.cultivatedContour,gridM:grid.gridM,areaM2:grid.areaM2,cells,zones,reads:reads.map((r,i)=>({id:r.season.id,season:r.season,scenes:r.scenes,contrast:contrasts[i],source:r.source})),coverage,stableFraction:stableArea/grid.areaM2,commonCells:common.length,
  status:!sufficient?'insufficient' as const:contrast?'mapped' as const:'homogeneous' as const,projection,reasons,notes,excluded,backtest,backtestAgreement,backtestSeason:backtestAgreement===null?null:reads.at(-1)!.season.id,temporalChecks};
}
/** A dated observation is useful without a qualifying multi-year forecast.
 * It never changes temporal controls and never becomes a yield prediction. */
export function analyzeObservationZones(c:SeasonalConfig):ZoneAnalysis|null{
 const saved=c.fieldMonitoring,r=saved?.currentObservation;
 if(!c.parcelGeometry||!r||saved!.scope!==fieldMonitoringScope(c))return null;
 const grid=zoneGrid(c.parcelGeometry),date=r.scenes[0]?.date,reasons:string[]=[];
 if(r.geometryId!==geometryIdentity(c.parcelGeometry)||r.gridM!==grid.gridM)reasons.push('Contour ou grille différents.');
 if(r.scenes.length!==1||!date||r.season.startDate!==date||r.season.endDate!==date)reasons.push('Une acquisition datée unique est requise.');
 if(!date||date>c.asOfDate||r.retrievedOn>c.asOfDate)reasons.push('Observation indisponible à la date d’analyse.');
 if(date&&(Date.parse(c.asOfDate)-Date.parse(date))/86400000>180)reasons.push('Observation de plus de 180 jours.');
 const values=new Map(r.cells.filter(v=>v[2]===1).map(([id,v])=>[id,v])),qualified=grid.cells.filter(v=>values.has(v.id)),area=qualified.reduce((n,v)=>n+v.areaM2,0);
 if(qualified.length<12||area/grid.areaM2<.6)reasons.push('Au moins 12 cellules et 60 % de surface analysable sont requis.');
 const ranks=spatialRanks(qualified.map(v=>({id:v.id,value:values.get(v.id)!,area:v.areaM2}))),contrast=quantile([...values.values()],.9)-quantile([...values.values()],.1)>=.1;
 const sufficient=!reasons.length,cells=grid.cells.map(v=>{const rank=ranks.get(v.id)??null;return {...v,rank,agreement:null,seasons:0,zone:(!sufficient||rank===null?'unknown':contrast?classify(rank):'medium') as ZoneClass};});
 return {version:FIELD_ZONES_VERSION,basis:'observed_satellite_vigor_not_measured_yield',mapKind:'current-observation',observedOn:date??null,cultivatedContour:saved!.cultivatedContour,gridM:grid.gridM,areaM2:grid.areaM2,cells,zones:(Object.keys(ZONE_NAMES) as ZoneClass[]).map(id=>({id,label:ZONE_NAMES[id],areaM2:cells.filter(v=>v.zone===id).reduce((n,v)=>n+v.areaM2,0)})),reads:[],coverage:Math.min(1,area/grid.areaM2),stableFraction:0,commonCells:qualified.length,status:!sufficient?'insufficient':contrast?'mapped':'homogeneous',projection:'unavailable',reasons,notes:['Observation satellite datée ; pas de rendement mesuré ni de prévision de récolte.'],excluded:[],backtest:null,backtestAgreement:null,backtestSeason:null,temporalChecks:[]};
}
export function chooseFieldZoneMap(history:ZoneAnalysis,current:ZoneAnalysis|null){
 if(history.projection==='relative-hypothesis')return {analysis:history,label:'Zones historiques qualifiées'};
 if(current&&current.status!=='insufficient')return {analysis:current,label:'Carte NDVI observée le '+current.observedOn};
 return {analysis:history,label:'Historique descriptif du champ'};
}
export function fieldZoneMapScope(a:ZoneAnalysis){
 const value=JSON.stringify([a.mapKind,a.observedOn,a.gridM,a.cells.map(c=>[c.id,c.zone,c.geometry])]);let hash=2166136261;
 for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return 'zone-map-1:'+(hash>>>0).toString(16).padStart(8,'0');
}
export function zonePrescription(analysis:ZoneAnalysis,input:ZoneDoseInput){
 if(analysis.status==='insufficient')throw new Error('La carte historique n’a pas assez de données pour préparer une modulation.');
 if(!analysis.cultivatedContour)throw new Error('Confirmez que le contour correspond uniquement à la surface cultivée avant de répartir des produits.');
 if(!input.confirmed||!input.reference.trim()||!input.product.trim())throw new Error('Confirmez les doses et leur référence agronomique avant l’export.');
 if(input.mapScope!==undefined&&input.mapScope!==fieldZoneMapScope(analysis)||analysis.mapKind==='current-observation'&&input.mapScope!==fieldZoneMapScope(analysis))throw new Error('La carte a changé : confirmez à nouveau les doses pour cette date et ces zones.');
 if(!['seeds/ha','kg/ha','L/ha'].includes(input.unit)||input.kind!=='seeds'&&input.unit==='seeds/ha')throw new Error('Unité de dose incompatible.');
 if(!Number.isFinite(input.baseline)||input.baseline<0||input.baseline>1000000)throw new Error('Dose uniforme invalide.');
 const rows=analysis.zones.filter(z=>z.areaM2>0).map(z=>{const dose=input.rates[z.id];if(typeof dose!=='number'||!Number.isFinite(dose)||dose<0||dose>1000000)throw new Error('Définissez explicitement la dose de chaque zone, y compris les zones variables ou sans donnée.');return {...z,dose,total:dose*z.areaM2/10000};});
 const total=rows.reduce((n,r)=>n+r.total,0),baselineTotal=input.baseline*analysis.areaM2/10000;
 return {rows,total,baselineTotal,changeTotal:total-baselineTotal,unit:input.unit,totalUnit:input.unit==='seeds/ha'?'graines':input.unit==='kg/ha'?'kg':'L'};
}
export function zonesGeoJson(analysis:ZoneAnalysis,input?:ZoneDoseInput){
 const prescription=input?zonePrescription(analysis,input):null;
 const features=analysis.zones.filter(z=>z.areaM2>0).map(z=>{
  const cells=analysis.cells.filter(p=>p.zone===z.id),geometry=union(cells[0].geometry.coordinates,...cells.slice(1).map(p=>p.geometry.coordinates));
  return {type:'Feature' as const,geometry:{type:'MultiPolygon' as const,coordinates:geometry},properties:{zone:z.id,label:z.label,area_ha:z.areaM2/10000,method:FIELD_ZONES_VERSION,grid_m:analysis.gridM,
   basis:analysis.basis,mapKind:analysis.mapKind,observedOn:analysis.observedOn,mapScope:fieldZoneMapScope(analysis),projection:analysis.projection,
   ...(input?{product:input.product,kind:input.kind,dose:prescription!.rows.find(r=>r.id===z.id)!.dose,unit:input.unit,reference:input.reference,status:'user_confirmed_scenario_not_automatic_optimum'}:{})}};
 });
 return {type:'FeatureCollection' as const,metadata:{version:FIELD_ZONES_VERSION,validationVersion:FIELD_ZONES_VALIDATION_VERSION,mapKind:analysis.mapKind,observedOn:analysis.observedOn,mapScope:fieldZoneMapScope(analysis),seasonIds:analysis.reads.map(r=>r.id),clearCommonFraction:analysis.coverage,lastSeasonSpatialAgreement:analysis.backtestAgreement,temporalValidation:analysis.backtest,forecastYieldTonnes:null,notes:analysis.notes},features};
}
export function zonePrescriptionCsv(analysis:ZoneAnalysis,input:ZoneDoseInput){
 const result=zonePrescription(analysis,input),q=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[['zone','surface_ha','produit','dose','unite','quantite_totale','source_dose','statut','type_carte','date_observation','reference_carte'],...result.rows.map(r=>[r.label,r.areaM2/10000,input.product,r.dose,input.unit,r.total,input.reference,'scenario_confirme',analysis.mapKind,analysis.observedOn,fieldZoneMapScope(analysis)])].map(r=>r.map(q).join(';')).join('\r\n');
}
