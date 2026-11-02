import {geometryIdentity} from './provenance.ts';
import {waterIndicator} from './water-indicator.ts';
import type {SeasonalConfig,WaterPlan,WaterEvent,WeatherDay} from './types.ts';

const DAY=86400000;
const shift=(d:string,n:number)=>new Date(Date.parse(d)+n*DAY).toISOString().slice(0,10);
export type FieldAction={id:string;level:'urgent'|'check'|'planned';title:string;reason:string;source:string;target:'map'|'water'|'yield'|'notes'|'soil'};
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
 const mode=c.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded';
 const estimate=current?.yieldEstimation;
 const result=estimate?.scenarios.find(s=>s.id===mode)?.totals??null;
 const actions:FieldAction[]=[];
 if(flooded)actions.push({id:'flood',level:'urgent',title:'Vérifier l’eau stagnante',reason:'Arrosage suspendu. Relevez la durée et l’étendue de l’engorgement ; faites vérifier le drainage et l’état des plantes.',source:'État du champ déclaré par vous ; mortalité et perte de rendement non calculées.',target:'soil'});
 const land=c.landAssessment;
 if(!land||land.unknownAreaM2>1e-6||geometryIdentity(land.geometry)!==geometryIdentity(c.parcelGeometry))actions.push({id:'terrain',level:'check',title:'Vérifier la surface terrestre',reason:'Le contour ne suffit pas à connaître la surface cultivable et réellement semée.',source:'Analyse d’occupation du sol absente ou incomplète.',target:'map'});
 else if(c.landSelection!=='potentialLand'&&(land.fractions.potentialLand.fraction??1)<1-1e-7)actions.push({id:'mixed',level:'check',title:'Séparer terre et surfaces exclues',reason:'Confirmez la partie terrestre avant d’estimer les volumes de la parcelle.',source:'Occupation du sol cartographiée ; aptitude agricole à confirmer.',target:'map'});
 const indicator=waterIndicator(c,p,stale,loading);
 if(!flooded&&indicator.kind!=='ready')actions.push({id:'water-inputs',level:'check',title:stale||loading?'Actualisation des calculs':'Compléter le bilan d’eau',reason:indicator.message,source:'État du moteur de bilan hydrique.',target:'water'});
 const next=current?.nextWindows.find(w=>w.from>=c.asOfDate);
 if(!flooded&&next)actions.push({id:'irrigate',level:'planned',title:`Arrosage proposé le ${next.from}`,reason:next.volume.fieldM3===null?'Quantité non disponible. Vérifiez les contraintes d’accès à l’eau.':`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(next.volume.fieldM3)} m³ au champ. Vérifiez la pluie réelle et l’humidité avant l’intervention.`,source:'Scénario hydrique conditionnel ; intervention non réalisée.',target:'water'});
 if(!result&&!stale&&!loading)actions.push({id:'yield',level:'check',title:'Documenter la récolte attendue',reason:'Une référence de rendement et une surface semée compatibles sont nécessaires.',source:'Aucun rendement parcellaire validé automatiquement.',target:'yield'});
 const notes=fieldNotes(c);
 if(!notes.length)actions.push({id:'scout',level:'check',title:'Faire un premier tour du champ',reason:'Observez la levée, les adventices, les symptômes et l’eau stagnante, puis gardez une note datée.',source:'Aucune observation visuelle enregistrée dans cette campagne.',target:'notes'});
 const measured=c.soilAnalyses?.some(a=>a.status==='measured')??false;
 return {stage,stages,elapsed,duration,progress:duration?Math.min(100,Math.max(0,elapsed/duration*100)):0,weather,sources,covered,rain,result,estimate,mode,actions,notes,measured,recordedEvents:events.filter(e=>e.status==='measured'||e.status==='declared').length,usable:!!current};
}
export const NOTE_METHOD='Observation visuelle au champ';
export const NOTE_PARAMETERS=['Levée','Adventices','Ravageurs','Maladies','Drainage','Stades'] as const;
export function fieldNotes(c:SeasonalConfig){return c.agronomic?.geometryId===geometryIdentity(c.parcelGeometry)?c.agronomic.observations.filter(o=>o.method===NOTE_METHOD).slice().sort((a,b)=>b.availableOn.localeCompare(a.availableOn)):[];}
export function addFieldNote(c:SeasonalConfig,n:{parameter:string;date:string;note:string;observer:string}):SeasonalConfig{
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(n.date)&&Number.isFinite(Date.parse(n.date))&&new Date(n.date).toISOString().slice(0,10)===n.date;
 if(!c.parcelGeometry||!NOTE_PARAMETERS.includes(n.parameter as typeof NOTE_PARAMETERS[number])||!validDate||n.date>c.asOfDate||!n.note.trim()||n.note.trim().length>1200||!n.observer.trim()||n.observer.trim().length>600)throw new Error('Renseignez une observation, son auteur et une date valide au plus tard à la date de la simulation.');
 const a=c.agronomic??{version:'agronomic-1' as const,geometryId:geometryIdentity(c.parcelGeometry),system:'single' as const,season:null,observations:[]};
 if(a.geometryId!==geometryIdentity(c.parcelGeometry))throw new Error('Le carnet concerne un ancien contour. Reprenez la campagne correspondante.');
 if(a.observations.length>=100)throw new Error('Cette campagne contient déjà 100 observations. Exportez le carnet avant de poursuivre.');
 return {...c,agronomic:{...a,observations:[...a.observations,{parameter:n.parameter,value:n.note.trim(),unit:'observation',method:NOTE_METHOD,source:n.observer.trim(),depthCm:null,availableOn:n.date}]}};
}
export const weatherLabel=(w:WeatherDay|null)=>!w?'Indisponible':({observed:'Observation',estimated:'Estimation',forecast:'Prévision',scenario:'Scénario personnel'})[w.status];
