import type {SeasonalConfig,WaterPlan} from './types.ts';
import {InputError,isoDate} from './validation.ts';
import {geometryIdentity} from './provenance.ts';
import {applicationNutrients} from './management.ts';
import {landBlockReason} from './land.ts';
import {QUEFTS_PROFILES,QUEFTS_SOURCE,anchorSupply,queftsYield,type NPK} from './quefts.ts';

export type FertilizerCalibration='benin-microdose-aggregate-v1';
export type FertilizerScenarioInput={version:'quefts-scenario-1';scope:string;acceptedTransfer:true;calibration?:FertilizerCalibration;
 ceilingKgHa:number;ceilingSource:string;availableOn:string;
 control:null|{kgHa:number;source:string;moisturePercent:15;withoutFertilizer:true;denominator:'sown'};
};
export const fertilizerScope=(c:SeasonalConfig)=>JSON.stringify([c.country,geometryIdentity(c.parcelGeometry),c.cropProfile?.id,c.variety,c.sowingDate]);
export function parseFertilizerScenario(value:unknown):FertilizerScenarioInput|undefined{
 if(value===undefined)return undefined;
 const v=value as FertilizerScenarioInput;
 const text=(x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=1200;
 if(!v||v.version!=='quefts-scenario-1'||v.acceptedTransfer!==true||!text(v.scope)||!text(v.ceilingSource)||typeof v.ceilingKgHa!=='number'||!Number.isFinite(v.ceilingKgHa)||v.ceilingKgHa<=0||v.ceilingKgHa>10000||(v.calibration!==undefined&&v.calibration!=='benin-microdose-aggregate-v1'))throw new InputError('Scénario QUEFTS : accord, plafond explicite entre 0 et 10 t/ha et source requis.');
 const availableOn=isoDate(v.availableOn,'Disponibilité des hypothèses');
 let control:FertilizerScenarioInput['control']=null;
 if(v.control!==null){const a=v.control;if(!a||typeof a.kgHa!=='number'||!Number.isFinite(a.kgHa)||a.kgHa<=0||a.kgHa>=v.ceilingKgHa||!text(a.source)||a.moisturePercent!==15||a.withoutFertilizer!==true||a.denominator!=='sown')throw new InputError('Ancre : rendement témoin positif inférieur au plafond, sans aucun engrais, grain à 15 %, par hectare semé et source requis.');control={kgHa:a.kgHa,source:a.source.trim(),moisturePercent:15,withoutFertilizer:true,denominator:'sown'};}
 if(v.calibration==='benin-microdose-aggregate-v1'&&(v.ceilingKgHa!==10000||control===null))throw new InputError('Le pilote Bénin exige le plafond expérimental fixe de 10 t/ha et un témoin local comparable sans engrais.');
 return {version:v.version,scope:v.scope,acceptedTransfer:true,...(v.calibration?{calibration:v.calibration}:{}),ceilingKgHa:v.ceilingKgHa,ceilingSource:v.ceilingSource.trim(),availableOn,control};
}
const range=(v:number[]):[number,number]=>[Math.min(...v),Math.max(...v)];
export function fertilizerScenario(c:SeasonalConfig,plan:WaterPlan){
 const v=c.fertilizerScenario;
 const beninPilot=v?.calibration==='benin-microdose-aggregate-v1';
 const limits=[
  'Simulation exploratoire de transfert depuis deux profils maïs du Nigeria ; aucun des six pays n’est validé localement.',
  'Plage entre deux hypothèses de sol et d’efficacité, pas un intervalle prédictif à 95 %. Elle ne couvre pas tous les risques : une absence de réponse ou une perte reste possible.',
  'Plafond déclaré pour le contexte hydrique envisagé. Aucun couplage dynamique eau–azote ni seconde pénalité hydrique ; FAOSTAT n’est pas un témoin.',
  'Récupérations saisonnières constantes. Dates affichées mais effet du fractionnement, sécheresse, pertes, toxicité, ravageurs et autres carences non calculés.',
  'Continuum de doses issu des équations, pas une courbe locale validée. Aucune dose optimale ni recommandation économique.',
 ];
 const beninLimits=[
  'Pilote expérimental maïs · Ina, nord du Bénin · variété DMR-ESR · essais pluviaux de 2014–2015 ; aucun transfert national qualifié.',
  'Ajustement sur deux moyennes de traitements en 2014 et contrôle sur deux moyennes en 2015. Les résultats ne sont pas quatre validations de parcelles : les rendements individuels ne sont pas disponibles.',
  'Le résultat est conditionné par un rendement témoin local saisi par l’utilisateur, sans engrais, à 15 % d’humidité et par hectare semé. Il ne prédit pas automatiquement ce rendement de base.',
  'Les coefficients candidats ne sont évalués qu’aux deux doses publiées MD1 et MD2. Autres doses, compost, autres sites/saisons, sécheresse, ravageurs et interactions hydriques restent hors domaine.',
  'Les deux profils QUEFTS sont conservés comme plage de sensibilité ; ce n’est pas un intervalle de confiance à 95 %, une recommandation de dose ou une validation parcellaire.',
 ];
 const base={version:'quefts-scenario-1',validated:false,predictiveInterval95:null,optimalDose:null,source:beninPilot?'https://doi.org/10.1016/j.fcr.2018.10.018':QUEFTS_SOURCE,limits:beninPilot?beninLimits:limits};
 const missing:string[]=[];
 if(!v)return {...base,status:'disabled' as const,missing:['Activer explicitement le scénario de transfert.'],results:null};
 if(v.scope!==fertilizerScope(c))missing.push('Culture, variété, pays, semis ou contour modifié : réexaminer et réactiver le scénario.');
 if(c.cropProfile?.id!=='maize')missing.push('Seul le maïs grain dispose ici de paramètres de transfert.');
 if(beninPilot&&c.country!=='BEN')missing.push('Le pilote ajusté sur les moyennes du nord du Bénin est limité aux campagnes déclarées au Bénin.');
 if(beninPilot&&(!v.control||v.ceilingKgHa!==10000))missing.push('Le pilote Bénin exige un témoin local comparable sans engrais et le plafond fixe de 10 t/ha du protocole.');
 if(c.systemDomain!=='upland'||c.waterCondition!=='drained')missing.push('Un système terrestre et un sol déclaré drainé sont requis.');
 if(c.agronomic&&c.agronomic.system!=='single')missing.push('Cultures associées et successions hors domaine.');
 if(c.salinity||(c.soilAnalyses??[]).some(a=>a.measurements.some(m=>m.parameter==='EC'&&m.method==='saturated_paste'&&m.value>1.7)))missing.push('Salinité : interaction avec la nutrition non qualifiée.');
 if(c.asOfDate<'2026-11-02'||v.availableOn>c.asOfDate)missing.push('Hypothèses non disponibles à la date de simulation.');
 const realized:NPK=[0,0,0],planned:NPK=[0,0,0];
 const products=c.managementPlan?.products.filter(p=>p.kind==='fertilizer')??[];
 for(const p of products){
  if(p.composition&&p.composition.kind!=='mineral'){missing.push(`${p.product} : libération des nutriments organiques non modélisée.`);continue;}
  if(p.status==='planned'&&p.date<c.asOfDate){missing.push(`${p.product} : apport prévu dans le passé ; renseigner son statut réel.`);continue;}
  const mass=applicationNutrients(p)?.elementalKgHa;
  if(!mass||[mass.N,mass.P,mass.K].some(x=>x==null)){missing.push(`${p.product} : composition N/P/K ou conversion de masse incomplète.`);continue;}
  const target=p.status==='declared'?realized:planned;
  [mass.N!,mass.P!,mass.K!].forEach((x,i)=>{target[i]+=x;});
 }
 const total=realized.map((n,i)=>n+planned[i]) as NPK;
 if(beninPilot){
  if(realized.some(n=>n>1e-8))missing.push('Le pilote Bénin compare un témoin sans engrais aux doses microdose prévues ; des apports minéraux déjà réalisés sont hors protocole.');
  const publishedDoses:NPK[]=[[23.8,4.1,7.8],[33.1,8.2,15.6]];
  const matchesPublishedDose=(dose:NPK)=>publishedDoses.some(target=>target.every((value,i)=>Math.abs(dose[i]-value)<=Math.max(.15,value*.02)));
  if(total.some(n=>n>1e-8)&&!matchesPublishedDose(total))missing.push('Le pilote Bénin ne couvre que les deux doses publiées MD1 (23,8/4,1/7,8) ou MD2 (33,1/8,2/15,6 kg N/P/K élémentaires par hectare, tolérance 2 %.');
 }
 // Common support of BOTH transferred profiles. Full source maxima are returned.
 if(total.some((n,i)=>n>Math.min(...QUEFTS_PROFILES.map(p=>p.maxDose[i]))+1e-8))missing.push('Dose totale hors domaine commun étudié : maximum 120 kg N, 40 kg P et 40 kg K élémentaires/ha, apports réalisés inclus.');
 if(missing.length)return {...base,status:'unavailable' as const,missing,results:null};
 const candidateRecovery:Record<string,NPK>={NGS:[.7777777777777777,.2962962962962963,1],SS:[.8249427027027026,.20623567567567566,.9538399999999999]};
 const sourceProfiles=QUEFTS_PROFILES.map(p=>beninPilot?{...p,label:`${p.label} · candidat ajusté au Bénin`,recovery:candidateRecovery[p.id]}:p);
 const profiles=sourceProfiles.map(p=>{
  const anchor=v.control?anchorSupply(v.control.kgHa,v.ceilingKgHa,p):{supply:p.soilSupply,scale:1};
  const without=queftsYield(anchor.supply,realized,v.ceilingKgHa,p),withInput=queftsYield(anchor.supply,total,v.ceilingKgHa,p);
  return {id:p.id,label:p.label,supplyKgHa:anchor.supply,supplyScale:anchor.scale,recovery:p.recovery,withoutKgHa:without.yieldKgHa,withKgHa:withInput.yieldKgHa,deltaKgHa:withInput.yieldKgHa-without.yieldKgHa,uptakeWithKgHa:withInput.uptake};
 });
 const y=plan.yieldEstimation;
 // Multi-unit nutrient heterogeneity is not collapsed into a single response.
 const areaM2=!landBlockReason(c)&&y?.coverage.complete&&(c.yieldEstimation?.units.length??0)===1?(y.surface.simulationM2??y.surface.sownM2):null;
 const yieldWithout=range(profiles.map(p=>p.withoutKgHa)),yieldWith=range(profiles.map(p=>p.withKgHa)),delta=range(profiles.map(p=>p.deltaKgHa));
 const production=(r:[number,number])=>areaM2===null?null:r.map(n=>n*areaM2/10000) as [number,number];
 return {...base,status:'exploratory_transfer' as const,missing:[],results:{
  country:c.country,cropId:'maize',moisturePercent:15,denominator:y?.surface.areaBasis==='planned'?'planned':'sown',areaBasis:y?.surface.areaBasis??'sown',ceilingKgHa:v.ceilingKgHa,ceilingSource:v.ceilingSource,...(beninPilot?{calibration:v.calibration}:{}),
  soilMethod:v.control?'control_anchor_fixed_ratios':'published_mean_soil_analogs',control:v.control,
  profiles,realizedKgHa:realized,plannedKgHa:planned,areaM2,
  yieldWithoutKgHa:yieldWithout,yieldWithKgHa:yieldWith,deltaKgHa:delta,
  productionWithoutKg:production(yieldWithout),productionWithKg:production(yieldWith),extraProductionKg:production(delta),
  calendar:products.map(p=>({id:p.id,date:p.date,product:p.product,dose:p.dose,unit:p.unit,status:p.status,totalProduct:areaM2===null?null:p.dose*areaM2/10000})),
  anchorWarning:v.control?'Un rendement témoin ne détermine pas séparément N/P/K. Deux ratios de fourniture restent imposés ; ce n’est pas une validation.':null,
  areaWarning:areaM2===null?'Production totale indisponible : renseigner une seule unité prévue ou semée avec couverture spatiale vérifiée.':null,
 }};
}
