import type {SeasonalConfig,WaterEvent,WaterPlan} from './types.ts';
import {planWater} from './engine.ts';
import {validateConfig} from './validation.ts';
import {cropById} from './catalog.ts';
import {SEASONAL_KY,KY_VERSION,FAO_SOURCE,seasonalWaterFactor} from './water-response.ts';

export type WaterImpact={version:string;status:'conditional'|'unavailable';ky:number|null;source:string;areaBasis:'planned'|'sown';areaM2:number|null;missing:string[];limits:string[];scenarios:{id:'rainfed'|'recorded'|'proposed';label:string;status:'conditional'|'unavailable';etaMm:number|null;etmMm:number|null;relativeYieldPercent:number|null;deltaPointsVsRainfed:number|null;missing:string[]}[]};
/** No Ym is inferred: this reports only the model's relative water response.
 * No nutrient/pH multiplier and no combination with transferred QUEFTS outputs. */
export function waterImpact(c:SeasonalConfig,events:WaterEvent[],plan:WaterPlan):WaterImpact{
 const ky=SEASONAL_KY[c.cropProfile?.id??'']??null,u=c.yieldEstimation?.units[0];
 const out:WaterImpact={version:KY_VERSION,status:'unavailable',ky,source:FAO_SOURCE,
  areaBasis:c.yieldEstimation?(c.yieldEstimation.areaBasis??'sown'):'planned',areaM2:plan.calculationArea?.areaM2??null,missing:[],scenarios:[],
  limits:['Indice hydrique relatif : 100 correspond au rendement de référence sans déficit d’eau, pas à une récolte garantie. Aucun rendement en tonnes par hectare n’est déduit sans référence indépendante.',
   'FAO56 saisonnier, non calibré localement. Le sol et la météo interviennent par le bilan d’eau ; aucune perte due à la nutrition, au pH, aux ravageurs ou aux produits phytosanitaires n’est calculée.',
   'Les trois scénarios conservent le sol, la météo et les apports réalisés. Le scénario pluvial retire seulement l’irrigation. Les arrosages futurs restent des hypothèses.',
   'Calcul limité à une unité homogène, sol drainé, cycle complet et ETa/ETm ≥ 0,5. Aucun intervalle prédictif à 95 % établi.']};
 if(!plan.complete||plan.status==='blocked')out.missing.push(...(plan.missing.length?plan.missing:['Bilan hydrique complet requis.']));
 if(ky===null)out.missing.push('Réponse hydrique non paramétrée pour cette culture.');
 if(c.systemDomain!=='upland'||c.waterCondition!=='drained')out.missing.push('Système terrestre et absence d’engorgement à confirmer.');
 if(c.agronomic&&c.agronomic.system!=='single')out.missing.push('Cultures associées ou successions hors domaine.');
 if((c.yieldEstimation?.units.length??0)>1)out.missing.push('Comparaison globale multi-unités suspendue : allocation partagée de l’eau requise.');
 if(c.yieldEstimation&&!plan.yieldEstimation?.coverage.complete)out.missing.push(...(plan.yieldEstimation?.missing??['Couverture spatiale incomplète.']));
 if(!plan.calculationArea?.geometry||!(out.areaM2!>0))out.missing.push('Surface terrestre vérifiée requise.');
 if(c.salinity||(c.soilAnalyses??[]).some(a=>a.measurements.some(m=>m.parameter==='EC'&&m.method==='saturated_paste'&&m.value>(cropById(c.cropProfile?.id??'')?.eceThresholdDsM?.[0]??Infinity))))out.missing.push('Interaction eau–salinité à qualifier avant cette approximation.');
 if(out.missing.length)return out;
 const config=u?.conditions?validateConfig({...c,...u.conditions,inputs:undefined,yieldEstimation:undefined}):c;
 if(config.waterCondition!=='drained'){out.missing.push('Le sol de cette unité doit être drainé.');return out;}
 for(const [id,label] of [['rainfed','Sans irrigation ajoutée'],['recorded','Avec les arrosages réalisés'],['proposed','Avec le plan d’arrosage']] as const){
  const ev=events.filter(e=>id!=='rainfed'||e.kind==='rain');
  const water=planWater(config,ev,{irrigationMode:id,unitAreaM2:out.areaM2!,unitGeometry:plan.calculationArea!.geometry});
  const ready=water.complete&&water.status!=='blocked',eta=ready?water.totals.actualEtMm:null,etm=ready?water.totals.demandMm:null;
  const factor=ready?seasonalWaterFactor(eta!,etm!,ky!):null;
  const missing=ready?(factor===null?['Déficit trop sévère ou ETa/ETm incompatible pour cette approximation.']:[]):water.missing;
  out.scenarios.push({id,label,status:factor===null?'unavailable':'conditional',etaMm:eta,etmMm:etm,relativeYieldPercent:factor===null?null:factor*100,deltaPointsVsRainfed:null,missing});
 }
 const baseline=out.scenarios[0].relativeYieldPercent;
 for(const row of out.scenarios)if(baseline!==null&&row.relativeYieldPercent!==null)row.deltaPointsVsRainfed=row.relativeYieldPercent-baseline;
 out.status=out.scenarios.some(s=>s.status==='conditional')?'conditional':'unavailable';
 return out;
}
