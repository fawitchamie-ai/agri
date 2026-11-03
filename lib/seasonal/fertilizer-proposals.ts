import {NUTRITION_REFERENCES} from './nutrition.ts';
import {AGRONOMY_SOURCES} from './sources.ts';
import {cropById} from './catalog.ts';
import {addDays} from './validation.ts';
import type {SeasonalConfig} from './types.ts';
const SOURCE='https://agriculture.gouv.tg/recommandations-des-doses-dengrais-mineraux-et-periodes-depandage-pour-les-principales-cultures-vivrieres/';
export type FertilizerProposal={id:string;name:string;dose:[number,number];npk:(number|null)[];country:string;scope:string;source:string;timing:string;days:[number,number]|null;transferred:boolean};
/** Ministry/ICAT, 27 July 2022; these historical rates remain editable examples.
 * Country/crop and production system are explicit; no maize rates for legumes. */
export function fertilizerProposals(c:SeasonalConfig):FertilizerProposal[]{
 const crop=c.cropProfile?.id;
 const doses:Record<string,{npk:[number,number];urea:[number,number][];windows:[number,number][]}>={
  maize:{npk:[200,200],urea:[[100,100]],windows:[[10,15],[30,45]]},
  'rice-upland':{npk:[150,150],urea:[[25,25],[25,25]],windows:[[15,21],[35,40],[55,60]]},
  'rice-flooded':{npk:[200,200],urea:[[50,50],[50,50]],windows:[[15,21],[35,40],[55,60]]},
  sorghum:{npk:[150,150],urea:[[50,50]],windows:[[10,15],[40,60]]},
 };
 const recipe=doses[crop??''];
 const first:FertilizerProposal[]=recipe?[[recipe.npk,[15,15,15],'NPK 15-15-15'],...recipe.urea.map(d=>[d,[46,0,0],'Urée 46 % N'])].map((row,i)=>({id:`icat-2022-${crop}-${i}`,name:row[2] as string,dose:row[0] as [number,number],npk:row[1] as number[],country:'TGO',scope:crop==='sorghum'?'Togo, sorgho local à haute taille, référence ICAT 2022':'Togo, référence ministère / ICAT du 27 juillet 2022 ; calendrier après semis, non repiquage',source:SOURCE,timing:`${recipe.windows[i][0]}–${recipe.windows[i][1]} jours après semis`,days:recipe.windows[i],transferred:c.country!=='TGO'})):[];
 const existing=NUTRITION_REFERENCES.filter(r=>r.cropId===crop&&r.system===c.systemDomain).flatMap(r=>r.products.map((p,i)=>{
  const match=p.timing.match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?jours/),days:[number,number]|null=/Au semis/i.test(p.timing)?[0,0]:match?[Number(match[1]),Number(match[2]??match[1])]:null;
  return {id:r.id+'-'+i,name:p.name,dose:p.kgHa as [number,number],npk:p.npkPercent,country:r.country,scope:r.scope,source:AGRONOMY_SOURCES.find(s=>s.id===r.sourceId)?.url??'',timing:p.timing,days,transferred:r.country!==c.country||!!r.territories&&!r.territories.some(t=>t.toLowerCase()===c.territory.toLowerCase())};
 }));
 return [...first,...existing].sort((a,b)=>Number(a.transferred)-Number(b.transferred));
}
export function proposalDraft(c:SeasonalConfig,p:FertilizerProposal){
 const first=c.asOfDate>c.sowingDate?c.asOfDate:c.sowingDate,end=addDays(c.sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
 const from=p.days?addDays(c.sowingDate,p.days[0]):first,to=p.days?addDays(c.sowingDate,p.days[1]):end;
 const date=from<first?first:from;
 return {date,dose:p.dose[0],product:p.name,npk:p.npk,source:p.source+' ; '+p.scope+' ; '+p.timing,
  expired:to<first||date>end,needsDateConfirmation:p.days===null,transferred:p.transferred,
  note:p.transferred?'Exemple transféré : vérifier sa pertinence dans votre pays et votre sol.':'Référence publiée historique, à adapter au sol, à la variété et aux apports déjà réalisés.'};
}
export function cropNutritionHint(c:SeasonalConfig){return cropById(c.cropProfile?.id??'')?.nutrition??'Choisissez une culture pour afficher ses besoins et références.';}
