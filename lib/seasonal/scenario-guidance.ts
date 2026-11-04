import type {SeasonalConfig,WaterPlan} from './types.ts';
import {declareScenario,geometryIdentity} from './provenance.ts';
import {SEASONAL_KY} from './yield.ts';
import {QUEFTS_SOURCE} from './quefts.ts';

export const MAIZE_CEILING_SOURCE='Plafond théorique de l’exemple QUEFTS (10 t/ha), Shehu et al. 2019, '+QUEFTS_SOURCE+' ; transfert exploratoire, non validé pour la parcelle. Eau et nutrition non limitantes par hypothèse.';
export type YieldMode='rainfed'|'recorded'|'proposed';
/** Rank only comparable, complete responses from the SAME water model.
 * Never mix QUEFTS ranges, national harvested-area statistics and water outputs. */
export function scenarioComparison(c:SeasonalConfig,p:WaterPlan|null,stale=false){
 const estimate=!stale&&p?.yieldEstimation?.method==='fao-seasonal'?p.yieldEstimation:null;
 const labels:Record<YieldMode,string>={rainfed:'Sans irrigation ajoutée',recorded:'Avec mes apports réalisés',proposed:'Avec le plan d’arrosage'};
 const rows=(['rainfed','recorded','proposed'] as const).map(id=>{
  const s=estimate?.scenarios.find(s=>s.id===id);
  return {id,label:labels[id],kgHa:s?.status==='conditional'?s.totals?.yieldKgHaSown??null:null,productionKg:s?.status==='conditional'?s.totals?.productionKg??null:null,missing:s?.missing??[]};
 });
 const comparable=estimate?.method==='fao-seasonal'&&estimate.coverage.complete&&rows.every(r=>r.kgHa!==null&&Number.isFinite(r.kgHa));
 const best=comparable?rows.reduce((a,b)=>b.kgHa!>a.kgHa!+1e-6?b:a):null;
 const baseline=rows.find(r=>r.id==='recorded')!;
 return {rows,comparable,best,gainKgHa:best&&baseline.kgHa!==null?best.kgHa!-baseline.kgHa:null};
}

/** Explicit user action: assumptions are proposed, never recorded as observations.
 * Existing spatial units, references, interventions and measured inputs survive. */
export function prepareYieldHypothesis(c:SeasonalConfig,v:{kgHa:number;source:string;areaM2:number;drained:boolean}):SeasonalConfig{
 if(!c.parcelGeometry||!c.landAssessment||geometryIdentity(c.landAssessment.geometry)!==geometryIdentity(c.parcelGeometry)||c.landAssessment.unknownAreaM2>1e-6)throw new Error('Terminez l’analyse du contour avant d’utiliser sa surface.');
 if(c.yieldEstimation&&(c.yieldEstimation.units.length!==1||c.yieldEstimation.scopeGeometryId!==geometryIdentity(c.parcelGeometry)))throw new Error('Conservez vos unités spatiales : ajustez leur référence dans Rendement.');
 if(c.yieldEstimation?.units[0]?.conditions)throw new Error('Cette unité possède son propre sol ou sa propre météo. Ajustez ses hypothèses dans Rendement.');
 if(!Number.isFinite(v.kgHa)||v.kgHa<=0||v.kgHa>1e6||!v.source.trim())throw new Error('Renseignez un rendement de référence positif et sa source.');
 const available=c.landAssessment.candidateAreaM2;
 if(!Number.isFinite(v.areaM2)||v.areaM2<=0||v.areaM2>available+Math.max(.001,available*1e-7))throw new Error('La surface du scénario doit rester dans la partie terrestre cartographiée.');
 if(!v.drained||c.waterCondition==='waterlogged'||c.waterCondition==='submerged')throw new Error('Vérifiez l’absence d’engorgement au champ avant cette simulation terrestre.');
 const cropId=c.cropProfile?.id??'',old=c.yieldEstimation,u=old?.units[0],reference=u?.reference;
 if(!cropId||c.systemDomain!=='upland')throw new Error('Sélectionnez une culture et un système terrestre compatibles.');
 if(reference&&reference.cropId!==cropId)throw new Error('La référence actuelle concerne une autre culture. Vérifiez-la dans Rendement.');
 if(u?.harvestedAreaM2!=null&&v.areaM2<u.harvestedAreaM2)throw new Error('La surface du scénario ne peut pas être inférieure à la surface récoltée documentée.');
 // Historical harvested-area references are never upgraded into independent Ym.
 if(reference&&(!reference.independentYm||reference.denominator!=='sown'))throw new Error('Documentez une référence indépendante sans manque d’eau dans Rendement ; votre référence actuelle est conservée.');
 const supportsWater=SEASONAL_KY[cropId]!==undefined;
 if(!supportsWater)throw new Error('Réponse hydrique non paramétrée pour cette culture. Aucun calcul simple de remplacement.');
 return declareScenario({...c,landSelection:'potentialLand',waterCondition:'drained',yieldScenario:'proposed',yieldEstimation:{
  version:'yield-input-1',method:'fao-seasonal',areaBasis:old?.areaBasis??(u?.sownAreaM2!=null?'sown':'planned'),scopeGeometryId:geometryIdentity(c.parcelGeometry),
  homogeneityAssumption:old?.homogeneityAssumption??'Une unité supposée homogène pour la simulation ; surface semée hypothétique, non déclarée comme observation.',
  units:[{...u,id:u?.id??'champ',sownAreaM2:v.areaM2,harvestedAreaM2:u?.harvestedAreaM2??null,areaSource:u?.areaSource??'Hypothèse utilisateur : surface terrestre prévue supposée semée pour ce scénario, semis réalisé non attesté.',
   reference:reference&&reference.kgHa===v.kgHa&&reference.source===v.source.trim()?reference:{kind:'scenario',kgHa:v.kgHa,denominator:'sown',source:v.source.trim(),context:'Hypothèse indépendante du bilan hydrique : rendement sans déficit d’eau, autres facteurs supposés non limitants ; aucune validation locale.',cropId,availableOn:c.asOfDate,independentYm:supportsWater}}]
 }});
}
