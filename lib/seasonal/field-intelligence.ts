import {geometryIdentity} from './provenance.ts';
import {validateFieldVisit,type FieldVisit} from './agronomic.ts';
import {compareFieldImages,fieldComparisonBaseline,fieldCropStage,fieldImageArchive,fieldImageChoices,fieldVisitTarget,type FieldMapFocus} from './field-analysis.ts';
import {fieldMonitoringScope,zoneGrid} from './field-zones.ts';
import {waterIndicator} from './water-indicator.ts';
import type {SeasonalConfig,WaterPlan,WaterEvent,WeatherDay} from './types.ts';

const DAY=86400000;
const shift=(d:string,n:number)=>new Date(Date.parse(d)+n*DAY).toISOString().slice(0,10);
export type FieldAction={
 id:string;level:'urgent'|'check'|'planned';title:string;reason:string;source:string;
 target:'map'|'water'|'yield'|'notes'|'soil'|'fertilizer'|'images';
 due?:string;importance?:number;quality?:number;imageDate?:string;visibleM2?:number;focus?:FieldMapFocus;
};
function satelliteAction(c:SeasonalConfig):FieldAction|undefined{
 if(!c.parcelGeometry)return;
 const base={id:'satellite',level:'check',target:'images',due:c.asOfDate,importance:2} as const;
 const grid=zoneGrid(c.parcelGeometry),archive=fieldImageArchive(c,grid),choices=fieldImageChoices(c,grid,archive),latest=choices.at(-1);
 if(!latest){
  const search=c.fieldMonitoring?.scope===fieldMonitoringScope(c)?c.fieldMonitoring.imagerySearch:undefined;
  const masked=search?.retrievedOn&&search.retrievedOn<=c.asOfDate?search.entries.filter(e=>e.status==='insufficient').at(-1):undefined;
  const archived=archive.at(-1),date=masked?.date??archived?.season.startDate;
  const fraction=masked?.clearFraction??archived?.scenes[0].clearFraction;
  return {...base,quality:0,title:date?'Chercher une image plus claire':'Ouvrir les images du champ',
   reason:date?'La couverture est sous le minimum de 20 %. Cherchez une autre date ou faites une visite libre.':'Avec votre accord, recherchez la dernière image exploitable à partir du contour.',
   source:'Sentinel-2 · aucune image qualifiée dans la campagne.',imageDate:date,visibleM2:fraction===undefined?undefined:fraction*grid.areaM2};
 }
 const current=archive.find(r=>r.season.startDate===latest.date&&r.scenes[0].itemId===latest.itemId);
 const previous=fieldComparisonBaseline(c,grid,archive,latest.date);
 const change=compareFieldImages(grid,previous,current,{archive,stageAt:date=>fieldCropStage(c,date)});
 const zone=change.zones[0];
 const common={...base,imageDate:latest.date,visibleM2:latest.clearFraction*grid.areaM2};
 if(zone)return {...common,quality:zone.repeatedOn?3:2,title:zone.repeatedOn?'Vérifier la zone où l’écart se répète':'Surveiller une zone du champ',
  reason:zone.repeatedOn?'L’écart de végétation par rapport au reste du champ se retrouve sur une autre acquisition comparable.':'Cette zone évolue différemment du champ sur une paire de dates. Vérifiez-la sur place.',
  source:'NDVI numérique Sentinel-2, calculé sur les cellules claires communes.',focus:fieldVisitTarget(grid,change,zone)};
 return {...common,quality:2,title:'Voir la dernière image exploitable',reason:'Examinez la végétation visible sur l’acquisition la plus récente qualifiée.',
  source:'Sentinel-2 · couverture exploitable mesurée dans le contour.',focus:{dates:[latest.date]}};
}
/** A reading aid for existing evidence; no additional yield or diagnostic model. */
export function fieldBrief(c:SeasonalConfig,p:WaterPlan|null,events:WaterEvent[],stale=false,loading=false){
 const flooded=c.waterCondition==='waterlogged'||c.waterCondition==='submerged';
 const usable=!flooded&&waterIndicator(c,p,stale,loading).kind==='ready';
 const current=usable?p:null;
 const duration=c.stages.reduce((n,s)=>n+s.days,0);
 const elapsed=Math.floor((Date.parse(c.asOfDate)-Date.parse(c.sowingDate))/DAY);
 let start=0;
 const stages=c.stages.map(s=>{const from=start;start+=s.days;return {name:s.name,from:shift(c.sowingDate,from),to:shift(c.sowingDate,start-1),days:s.days,state:(elapsed<from?'future':elapsed>=start?'past':'current') as 'future'|'past'|'current'};});
 const stage=elapsed<0?'Semis à venir':duration===0?'Cycle à préciser':elapsed>=duration?'Fin du cycle de référence':stages.find(s=>s.state==='current')?.name??'Stade à confirmer';
 const weather=Array.from({length:7},(_,i)=>{
  const date=shift(c.asOfDate,i),w=c.weather.find(w=>w.date===date&&w.availableAt.slice(0,10)<=c.asOfDate&&!(w.status==='observed'&&date>c.asOfDate));
  return {date,day:w??null};
 });
 const sources=[...new Set(weather.flatMap(x=>x.day?[x.day.source]:[]))];
 const realWeather=weather.filter(x=>x.day&&x.day.status!=='scenario');
 const covered=realWeather.filter(x=>x.day!.rainMm!==null).length;
 const rain=covered===7?realWeather.reduce((n,x)=>n+x.day!.rainMm!,0):null;
 const mode=c.yieldScenario??(c.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded');
 const estimate=current?.yieldEstimation&&['fao-seasonal','fao-stages'].includes(current.yieldEstimation.method??'')?current.yieldEstimation:undefined;
 const result=estimate?.scenarios.find(s=>s.id===mode)?.totals??null;
 const selectedWaterModel=!!c.yieldEstimation?.responseCalendar&&['fao-stages','fao-seasonal'].includes(c.yieldEstimation.method);
 const growth=!selectedWaterModel&&current?.growth?.status==='scenario'?current.growth.scenarios.find(s=>s.id===mode):undefined;
 const actions:FieldAction[]=[];
 if(flooded)actions.push({id:'flood',level:'urgent',title:'Vérifier l’eau stagnante',reason:'Arrosage suspendu. Relevez la durée et l’étendue de l’engorgement ; faites vérifier le drainage et l’état des plantes.',source:'État du champ déclaré par vous ; mortalité et perte de rendement non calculées.',target:'soil',due:c.asOfDate,importance:3,quality:3});
 const land=(!stale&&!loading?p?.land:undefined)??c.landAssessment;
 if(!land||land.unknownAreaM2>1e-6||geometryIdentity(land.geometry)!==geometryIdentity(c.parcelGeometry))actions.push({id:'terrain',level:'check',title:'Vérifier la surface terrestre',reason:'Le contour ne suffit pas à connaître la surface cultivable et réellement semée.',source:'Analyse d’occupation du sol absente ou incomplète.',target:'map',importance:2,quality:0});
 else if(c.landSelection!=='potentialLand'&&(land.fractions.potentialLand.fraction??1)<1-1e-7)actions.push({id:'mixed',level:'check',title:'Séparer terre et surfaces exclues',reason:'Confirmez la partie terrestre avant d’estimer les volumes de la parcelle.',source:'Occupation du sol cartographiée ; aptitude agricole à confirmer.',target:'map',importance:2,quality:1});
 const indicator=waterIndicator(c,p,stale,loading);
 if(!flooded&&indicator.kind!=='ready')actions.push({id:'water-inputs',level:'check',title:stale||loading?'Actualisation des calculs':'Compléter le bilan d’eau',reason:indicator.message,source:'État du moteur de bilan hydrique.',target:'water',importance:2,quality:0});
 const next=current?.nextWindows.find(w=>w.from>=c.asOfDate);
 if(!flooded&&next)actions.push({id:'irrigate',level:'planned',title:`Arrosage proposé le ${next.from}`,reason:next.volume.fieldM3===null?'Quantité non disponible. Vérifiez les contraintes d’accès à l’eau.':`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(next.volume.fieldM3)} m³ au champ. Vérifiez la pluie réelle et l’humidité avant l’intervention.`,source:'Scénario hydrique conditionnel ; intervention non réalisée.',target:'water',due:next.from,importance:2,quality:1});
 if(!result&&!growth&&!stale&&!loading)actions.push({id:'yield',level:'check',title:'Comparer les effets des interventions',reason:'Explorez la réponse hydrique et les scénarios d’engrais disponibles pour cette culture.',source:'Aucun rendement parcellaire validé automatiquement.',target:'yield',importance:1,quality:0});
 const notes=fieldNotes(c);
 if(!notes.length)actions.push({id:'scout',level:'check',title:'Faire un premier tour du champ',reason:'Observez la levée, les adventices, les symptômes et l’eau stagnante, puis gardez une note datée.',source:'Aucune observation visuelle enregistrée dans cette campagne.',target:'notes',importance:1,quality:0});
 if(c.parcelGeometry){
  try{const satellite=satelliteAction(c);if(satellite)actions.push(satellite);}catch{/* Existing contour limits are explained in the analysis view. */}
 }
 actions.sort((a,b)=>Number(b.level==='urgent')-Number(a.level==='urgent')||
  (a.due??'9999-12-31').localeCompare(b.due??'9999-12-31')||
  (b.importance??0)-(a.importance??0)||(b.quality??0)-(a.quality??0));
 const measured=c.soilAnalyses?.some(a=>a.status==='measured')??false;
 return {stage,stages,elapsed,duration,progress:duration?Math.min(100,Math.max(0,elapsed/duration*100)):0,weather,sources,covered,rain,result,growth,estimate,mode,actions,notes,measured,recordedEvents:events.filter(e=>e.status==='measured'||e.status==='declared').length,usable:!!current};
}
export const NOTE_METHOD='Observation visuelle au champ';
export const NOTE_PARAMETERS=['Levée','Adventices','Ravageurs','Maladies','Drainage','Stades'] as const;
export function fieldNotes(c:SeasonalConfig){return c.agronomic?.geometryId===geometryIdentity(c.parcelGeometry)?c.agronomic.observations.filter(o=>o.method===NOTE_METHOD).slice().sort((a,b)=>b.availableOn.localeCompare(a.availableOn)):[];}
export function addFieldNote(c:SeasonalConfig,n:{parameter:string;date:string;note:string;observer:string;visit?:FieldVisit}):SeasonalConfig{
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(n.date)&&Number.isFinite(Date.parse(n.date))&&new Date(n.date).toISOString().slice(0,10)===n.date;
 if(!c.parcelGeometry||!(NOTE_PARAMETERS.includes(n.parameter as typeof NOTE_PARAMETERS[number])||n.visit&&n.parameter==='Visite terrain')||!validDate||n.date>c.asOfDate||(!n.visit&&!n.note.trim())||n.note.trim().length>1200||!n.observer.trim()||n.observer.trim().length>600)throw new Error('Renseignez une observation, son auteur et une date valide au plus tard à la date de la simulation.');
 if(n.visit)validateFieldVisit(n.visit,c,n.date);
 const a=c.agronomic??{version:'agronomic-1' as const,geometryId:geometryIdentity(c.parcelGeometry),system:'single' as const,season:null,observations:[]};
 if(a.geometryId!==geometryIdentity(c.parcelGeometry))throw new Error('Le carnet concerne un ancien contour. Reprenez la campagne correspondante.');
 if(a.observations.length>=100)throw new Error('Cette campagne contient déjà 100 observations. Exportez le carnet avant de poursuivre.');
 return {...c,agronomic:{...a,observations:[...a.observations,{parameter:n.parameter,value:n.note.trim(),unit:'observation',method:NOTE_METHOD,source:n.observer.trim(),depthCm:null,availableOn:n.date,...(n.visit?{visit:structuredClone(n.visit)}:{})}]}};
}
export const weatherLabel=(w:WeatherDay|null)=>!w?'Indisponible':({observed:'Observation',estimated:'Estimation',forecast:'Prévision',scenario:'Scénario personnel'})[w.status];
