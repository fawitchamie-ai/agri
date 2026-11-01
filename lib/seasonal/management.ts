import type {SeasonalConfig,WaterPlan} from './types.ts';
import {landBlockReason} from './land.ts';
import {geometryIdentity} from './provenance.ts';
import {addDays,isoDate,InputError} from './validation.ts';
import {convertApplication,parseComposition,type ProductComposition} from './products.ts';
export const MANAGEMENT_VERSION='management-1.0.0';
export type PlannedIrrigation={date:string;fieldM3Ha:number};
export type ProductApplication={id:string;date:string;kind:'fertilizer'|'pesticide'|'other';product:string;dose:number;unit:'kg/ha'|'L/ha';status:'planned'|'declared';source:string;npkPercent:[number|null,number|null,number|null];composition?:ProductComposition;applicationMode?:string};
export type ManagementPlan={version:typeof MANAGEMENT_VERSION;geometryId:string;cropId:string;irrigation:{mode:'automatic'|'manual';applications:PlannedIrrigation[]};products:ProductApplication[]};
export function emptyManagement(c:SeasonalConfig):ManagementPlan{return {version:MANAGEMENT_VERSION,geometryId:geometryIdentity(c.parcelGeometry),cropId:c.cropProfile?.id??'',irrigation:{mode:'automatic',applications:[]},products:[]};}
export function parseManagement(input:unknown,c:SeasonalConfig):ManagementPlan|undefined{
 if(input===undefined)return undefined;
 const p=input as ManagementPlan,end=addDays(c.sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
 if(!p||p.version!==MANAGEMENT_VERSION||p.geometryId!==geometryIdentity(c.parcelGeometry)||p.cropId!==(c.cropProfile?.id??''))throw new InputError('Calendrier d’apports incompatible avec la culture ou le contour.');
 const list=(a:unknown,max:number)=>{if(!Array.isArray(a)||a.length>max)throw new InputError('Trop d’apports ou liste invalide.');return a;};
 const date=(s:unknown)=>{const d=isoDate(s,'Date de l’apport');if(d<c.sowingDate||d>end)throw new InputError('Chaque apport doit appartenir au cycle de culture.');return d;};
 const finite=(n:unknown,max:number,label:string)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>max)throw new InputError(label+' invalide.');return n;};
 const text=(v:unknown,label:string,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new InputError(label+' requis.');return v.trim();};
 if(!p.irrigation||!['automatic','manual'].includes(p.irrigation.mode))throw new InputError('Mode du calendrier d’arrosage invalide.');
 const applications=list(p.irrigation.applications,366).map((a:any)=>({date:date(a?.date),fieldM3Ha:finite(a?.fieldM3Ha,20000,'Dose d’arrosage en m³/ha au champ')}));
 if(new Set(applications.map(a=>a.date)).size!==applications.length)throw new InputError('Regroupez les arrosages prévus à la même date.');
 if(p.irrigation.mode==='automatic'&&applications.length)throw new InputError('Un calendrier personnalisé doit être en mode manuel.');
 const products:ProductApplication[]=list(p.products,200).map((a:any)=>{
  if(!a||!['fertilizer','pesticide','other'].includes(a.kind)||!['kg/ha','L/ha'].includes(a.unit)||!['planned','declared'].includes(a.status))throw new InputError('Type, unité ou statut d’apport invalide.');
  const d=date(a.date);if(a.status==='declared'&&d>c.asOfDate)throw new InputError('Un apport déclaré réalisé ne peut pas être futur.');
  const npk=list(a.npkPercent,3);if(npk.length!==3)throw new InputError('Composition N–P₂O₅–K₂O attendue.');
  const npkPercent=npk.map(n=>n===null?null:finite(n,100,'Pourcentage massique')) as ProductApplication['npkPercent'];
  const composition=a.composition===undefined?undefined:parseComposition(a.composition);
  if(composition){
   if(npkPercent.some(n=>n!==null))throw new InputError('Utilisez le profil analytique ou les anciennes garanties N–P₂O₅–K₂O, sans double saisie.');
   if(a.kind==='pesticide'&&composition.kind!=='pesticide'||a.kind==='fertilizer'&&!['mineral','organic'].includes(composition.kind)||a.kind==='other'&&['mineral','organic','pesticide'].includes(composition.kind))throw new InputError('Nature du produit incompatible avec son profil.');
  }
  return {id:text(a.id,'Identifiant',100),date:d,kind:a.kind,product:text(a.product,'Nom du produit',160),dose:finite(a.dose,1000000,'Dose de produit commercial'),unit:a.unit,status:a.status,source:text(a.source,'Source de la dose',600),npkPercent,...(composition?{composition,applicationMode:text(a.applicationMode,'Mode d’application',200)}:{})};
 });
 if(new Set(products.map(a=>a.id)).size!==products.length)throw new InputError('Identifiant d’apport dupliqué.');
 return {version:MANAGEMENT_VERSION,geometryId:p.geometryId,cropId:p.cropId,irrigation:{mode:p.irrigation.mode,applications:applications.sort((a,b)=>a.date.localeCompare(b.date))},products:products.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))};
}
export function editableIrrigation(c:SeasonalConfig,p:WaterPlan|null):PlannedIrrigation[]{
 if(c.managementPlan?.irrigation.mode==='manual')return c.managementPlan.irrigation.applications;
 return (p?.days??[]).filter(d=>d.date>=c.asOfDate&&d.intervention?.type==='proposed'&&d.intervention.fieldMm!==null&&d.intervention.fieldMm>0).map(d=>({date:d.date,fieldM3Ha:d.intervention!.fieldMm!*10}));
}
export function managementSummary(c:SeasonalConfig,plan:WaterPlan){
 const p=c.managementPlan!,areaKnown=!landBlockReason(c)&&(!plan.yieldEstimation||plan.yieldEstimation.coverage.complete);
 const areaM2=areaKnown?(plan.yieldEstimation?.surface.sownM2??plan.calculationArea?.areaM2??null):null;
 return {version:MANAGEMENT_VERSION,areaM2,irrigationMode:p.irrigation.mode,irrigation:p.irrigation.applications.map(a=>{const d=plan.days.find(d=>d.date===a.date);return {...a,requestedFieldM3:areaM2===null?null:a.fieldM3Ha*areaM2/10000,simulatedFieldM3Ha:d?.intervention?.type==='proposed'&&d.intervention.fieldMm!==null?d.intervention.fieldMm*10:null,status:d?.intervention?.type==='recorded'?'recorded_takes_precedence':a.date<c.asOfDate?'past_unrealized':'proposed',reasons:d?.intervention?.reasons??[]};}),products:p.products.map(a=>{
  const nutrients=applicationNutrients(a);
  return {...a,totalProduct:areaM2===null?null:a.dose*areaM2/10000,totalUnit:a.unit==='kg/ha'?'kg':'L',npkKgHa:nutrients?[nutrients.oxideKgHa.N,nutrients.oxideKgHa.P2O5,nutrients.oxideKgHa.K2O]:[null,null,null],nutrients,yieldEffect:'not_modelled'};
 }),limits:['Arrosages futurs proposés, distincts des apports réalisés. Les contraintes déclarées bornent l’eau simulée.','Engrais, produits phytosanitaires et autres apports sont documentés ; aucun effet quantitatif sur le rendement n’est calibré ici.','Doses de produits commerciaux saisies, sans validation d’homologation ni prescription automatique. Un produit en L/ha sans masse volumique ne donne pas de kg de nutriments.']};
}
/** Legacy percentages remain declared fresh-product oxide guarantees, never become analyses. */
export function applicationNutrients(a:ProductApplication){
 if(a.kind!=='fertilizer')return null;
 const composition=a.composition??{version:'product-composition-1',id:a.id,kind:'mineral',name:a.product,manufacturer:null,source:a.source,lot:null,analysisDate:null,evidence:'declared',scenario:null,convention:'N-P2O5-K2O',basis:'fresh',percent:a.npkPercent,nForms:{urea:null,ammonium:null,nitrate:null,organic:null},moisturePercent:null,densityKgL:null,organic:null,uncertainty:'Ancienne saisie : garanties massiques déclarées sur produit tel qu’appliqué ; formes et base à confirmer.'} satisfies ProductComposition;
 return convertApplication({id:a.id,date:a.date,dose:a.dose,unit:a.unit,status:a.status,mode:a.applicationMode??'Non renseigné dans l’ancien calendrier',composition});
}
export function managementCsv(p:ManagementPlan){
 const q=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const rows:unknown[][]=[['version','type','date','produit','dose','unite','statut','source','N_pct_masse','P2O5_pct_masse','K2O_pct_masse','effet_rendement','N_kg_ha','P_element_kg_ha','K_element_kg_ha','profil_json','disponibilite_cycle']];
 for(const a of p.irrigation.applications)rows.push([p.version,'irrigation',a.date,'Eau au champ',a.fieldM3Ha,'m3/ha','planned','Calendrier modifié par l’utilisateur','','','','conditionnel_selon_methode_hydrique','','','','','']);
 for(const a of p.products){const n=applicationNutrients(a);rows.push([p.version,a.kind,a.date,a.product,a.dose,a.unit,a.status,a.source,...a.npkPercent,'non_modelise',n?.elementalKgHa.N,n?.elementalKgHa.P,n?.elementalKgHa.K,a.composition?JSON.stringify(a.composition):'','non_modelisee']);}
 return '\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n');
}
