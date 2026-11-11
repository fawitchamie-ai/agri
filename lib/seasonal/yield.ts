import {integratedGrowth} from './growth.ts';
import {canopyNowcast} from './canopy-nowcast.ts';
import {waterImpact} from './water-impact.ts';
import {SEASONAL_KY,KY_VERSION,seasonalWaterFactor} from './water-response.ts';
export {SEASONAL_KY,KY_VERSION,FAO_SOURCE} from './water-response.ts';
import {interventionOutcome} from './intervention-outcome.ts';
import {fertilizerScenario} from './fertilizer-scenario.ts';
import {managementSummary} from './management.ts';
import {estimateSowing} from './sowing.ts';
import {cropById} from './catalog.ts';
import {salinityScenario} from './salinity.ts';
import * as clipping from './geometry-ops.ts';
import {multiArea,landBlockReason,type MultiShape} from './land.ts';
import {validateParcel} from './parcel.ts';
import {geometryIdentity} from './provenance.ts';
import {validateConfig,validateEvents,InputError} from './validation.ts';
import {planWater} from './engine.ts';
import type {SeasonalConfig,WaterEvent,WaterPlan} from './types.ts';

export const YIELD_VERSION='conditional-yield-2.0.0';
export type YieldReference={
  kind:'scenario'|'attainable';kgHa:number;denominator:'sown'|'harvested';source:string;
  availableOn:string;context:string;cropId:string;
  // Required only for FAO: independent Ym under non-water-limiting conditions.
  independentYm:boolean;
};
export type YieldUnit={id:string;geometry?:MultiShape;sownAreaM2:number|null;harvestedAreaM2:number|null;areaSource:string;
 reference:YieldReference|null;conditions?:Pick<SeasonalConfig,'soil'|'weather'|'waterCondition'>};
// sownAreaM2 is the legacy wire field for the calculation area. areaBasis keeps
// a planned scenario distinct from an actual sowing declaration; old inputs are sown.
export type YieldInput={version:'yield-input-1';method:'automatic'|'declared-scenario'|'fao-seasonal';areaBasis?:'planned'|'sown';scopeGeometryId:string;
 homogeneityAssumption:string;units:YieldUnit[]};
export type YieldNumbers={productionKg:number;yieldKgHaSown:number|null;productionKgHaContour:number|null};
export type YieldScenario={id:'rainfed'|'recorded'|'proposed';label:string;status:'conditional'|'unavailable';missing:string[];
 totals:YieldNumbers|null;units:{id:string;reference:YieldReference|null;sownAreaM2:number;harvestedAreaM2:number|null;productionKg:number|null;yieldKgHaSown:number|null;sourceDenominator:'sown'|'harvested'|null;sourceKgHa:number|null;etaMm:number|null;etmMm:number|null;ky:number|null}[]};
export type YieldEstimate={cropId:string|null;version:string;method:YieldInput['method']|null;status:'conditional'|'unavailable';
 surface:{drawnM2:number|null;potentialLandM2:number|null;areaBasis?:'planned'|'sown';simulationM2?:number|null;plannedM2?:number|null;sownM2:number|null;harvestedM2:number|null;notPlantedPotentialM2:number|null;fractions:Record<string,number>|null};
 coverage:{processedM2:number;requestedM2:number|null;complete:boolean};
 versions:{water:string;land:string|null;ky:string;crop:string|null};dataSources:{provider:string;product:string;version:string;acquiredAt:string}[];
 missing:string[];limits:string[];scenarios:YieldScenario[]};
export function aggregateProduction(rows:{sownAreaM2:number;productionKg:number}[],drawnM2:number):YieldNumbers{
 const sown=rows.reduce((n,r)=>n+r.sownAreaM2,0),productionKg=rows.reduce((n,r)=>n+r.productionKg,0);
 return {productionKg,yieldKgHaSown:sown>0?productionKg/(sown/10000):null,productionKgHaContour:drawnM2>0?productionKg/(drawnM2/10000):null};
}
const text=(v:unknown,max=1200)=>typeof v==='string'&&v.trim()&&v.length<=max?v.trim():null;
const area=(v:unknown):number|null=>{if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9)throw new InputError('Surface de scénario ou surface récoltée invalide en m².');return v;};
export function parseYieldInput(value:unknown,c:SeasonalConfig):YieldInput|undefined{
 if(value===undefined)return undefined;
 const v=value as YieldInput;
 if(!v||v.version!=='yield-input-1'||!['automatic','declared-scenario','fao-seasonal'].includes(v.method)||(v.areaBasis!==undefined&&!['planned','sown'].includes(v.areaBasis))||!text(v.scopeGeometryId)||!text(v.homogeneityAssumption)||!Array.isArray(v.units)||!v.units.length||v.units.length>32)throw new InputError('Paramètres du rendement invalides ; 1 à 32 unités et hypothèse spatiale requises.');
 const units=v.units.map(u=>{
  if(!u||!text(u.id,100)||!text(u.areaSource))throw new InputError('Identifiant et provenance de surface requis.');
  const sownAreaM2=area(u.sownAreaM2),harvestedAreaM2=area(u.harvestedAreaM2);
  if(v.areaBasis==='planned'&&harvestedAreaM2!==null)throw new InputError('Une campagne en prévision ne peut pas contenir une récolte. Après semis, passez en surface effectivement semée pour l’enregistrer.');
  if(harvestedAreaM2!==null&&(sownAreaM2===null||harvestedAreaM2>sownAreaM2))throw new InputError('La surface récoltée doit être documentée et ne pas dépasser la surface initialement semée.');
  let geometry:MultiShape|undefined;
  if(u.geometry){
   if(u.geometry.type!=='MultiPolygon'||!Array.isArray(u.geometry.coordinates)||!u.geometry.coordinates.length||u.geometry.coordinates.length>32)throw new InputError('Unité spatiale MultiPolygon invalide.');
   geometry={type:'MultiPolygon',coordinates:u.geometry.coordinates.map(p=>validateParcel({type:'Polygon',coordinates:p}).coordinates)};
   const summed=multiArea(geometry.coordinates),joined=clipping.union(geometry.coordinates);
   if(Math.abs(summed-multiArea(joined))>Math.max(.001,summed*1e-7))throw new InputError('Composantes spatiales superposées.');
  }else if(v.units.length>1)throw new InputError('Géométries disjointes requises pour plusieurs unités.');
  let reference:YieldReference|null=null;
  if(u.reference){
   const r=u.reference;
   if(!['scenario','attainable'].includes(r.kind)||!['sown','harvested'].includes(r.denominator)||typeof r.kgHa!=='number'||!Number.isFinite(r.kgHa)||r.kgHa<0||r.kgHa>1e6||!text(r.source)||!text(r.context)||!text(r.cropId)||typeof r.independentYm!=='boolean'||!/^\d{4}-\d{2}-\d{2}$/.test(r.availableOn)||!Number.isFinite(Date.parse(r.availableOn))||new Date(r.availableOn).toISOString().slice(0,10)!==r.availableOn||r.availableOn>c.asOfDate)throw new InputError('Référence de rendement, unités, contexte ou date de disponibilité invalides.');
   reference={kind:r.kind,kgHa:r.kgHa,denominator:r.denominator,source:r.source.trim(),context:r.context.trim(),cropId:r.cropId,availableOn:r.availableOn,independentYm:r.independentYm};
  }
  let conditions:YieldUnit['conditions'];
  if(u.conditions){
   // Reuse the same physical, temporal and provenance validation as the main campaign.
   const unit=validateConfig({...c,...u.conditions,inputs:undefined,yieldEstimation:undefined});
   conditions={soil:unit.soil,weather:unit.weather,waterCondition:unit.waterCondition};
  }
  return {id:u.id,geometry,sownAreaM2,harvestedAreaM2,areaSource:u.areaSource,reference,...(conditions?{conditions}:{})};
 });
 if(new Set(units.map(u=>u.id)).size!==units.length)throw new InputError('Unités spatiales dupliquées.');
 return {version:v.version,method:v.method,...(v.areaBasis?{areaBasis:v.areaBasis}:{}),scopeGeometryId:v.scopeGeometryId,homogeneityAssumption:v.homogeneityAssumption,units};
}
export function estimateYield(c:SeasonalConfig,events:WaterEvent[],plan:WaterPlan):YieldEstimate{
 const y=c.yieldEstimation,a=c.landAssessment,domain=plan.calculationArea?.geometry;
 const out:YieldEstimate={cropId:c.cropProfile?.id??null,version:YIELD_VERSION,method:y?.method??null,status:'unavailable',
 surface:{drawnM2:c.areaM2,potentialLandM2:a?.candidateAreaM2??null,sownM2:null,harvestedM2:null,notPlantedPotentialM2:null,fractions:a?Object.fromEntries(Object.entries(a.fractions).map(([k,v])=>[k,v.areaM2])):null},
 coverage:{processedM2:0,requestedM2:plan.calculationArea?.areaM2??null,complete:false},
 dataSources:a?.sources.map(({provider,product,version,acquiredAt})=>({provider,product,version,acquiredAt}))??[],
 versions:{water:plan.engineVersion,land:a?.version??null,ky:KY_VERSION,crop:c.cropProfile?.version??null},missing:[],
 limits:['Simulation conditionnelle non validée au champ ; aucune prévision saisonnière évaluée de rendement parcellaire.',
 'Une terre cartographiée ne prouve ni aptitude agronomique ni droit de cultiver. Les sols récupérés au point ne prouvent pas l’homogénéité du champ.',
 'Ni pH, nutrition, température, ravageurs, mortalité ni pertes par inondation ne sont quantifiés. Aucun score de ces facteurs ne multiplie le rendement.',
 'L’eau voisine n’impose aucune pénalité. La surface récoltée ne réduit pas une seconde fois un rendement déjà exprimé par hectare semé.',
 'Le scénario proposé suppose l’exécution des arrosages et leurs contraintes connues ; énergie et accès non renseignés restent à vérifier.'],scenarios:[]};
 if(c.agronomic&&c.agronomic.system!=='single'){out.missing.push('Cultures associées, successions ou récoltes multiples non prises en charge.');return out;}
 if(!y){out.missing.push('Estimation automatique indisponible : le moteur de rendement parcellaire et ses paramètres locaux ne sont pas raccordés. Aucun rendement à saisir pour poursuivre le plan de culture.');return out;}
 if(!c.parcelGeometry||y.scopeGeometryId!==geometryIdentity(c.parcelGeometry))out.missing.push('Le contour a changé : redéfinissez les surfaces et unités du rendement.');
 const block=landBlockReason(c);if(block)out.missing.push(block);
 if(!domain||!a)out.missing.push('Analyse spatiale complète requise.');
 if(c.systemDomain!=='upland'||c.cropProfile?.id==='rice-flooded')out.missing.push('Système submergé ou nappe proche non pris en charge.');
 if(y.method==='fao-seasonal'&&SEASONAL_KY[c.cropProfile?.id??'']===undefined)out.missing.push('Culture sans modèle de rendement hydrique paramétré : Ky saisonnier et paramètres culturaux compatibles requis.');
 if(out.missing.length)return out;
 if(y.method==='fao-seasonal'&&(c.soilAnalyses??[]).some(a=>a.measurements.some(m=>m.parameter==='EC'&&m.method==='saturated_paste'&&m.value>(cropById(c.cropProfile?.id??'')?.eceThresholdDsM?.[0]??Infinity)))){out.missing.push('Salinité de pâte saturée renseignée : réponse eau–salinité à qualifier avant cette approximation.');return out;}
 const tolerance=Math.max(.001,c.areaM2!*1e-7),shapes=y.units.map(u=>u.geometry??domain!);
 let joined:MultiShape['coordinates']=[];
 for(let i=0;i<shapes.length;i++){
  const shape=shapes[i].coordinates;
  if(multiArea(clipping.difference(shape,domain!.coordinates))>tolerance)throw new InputError('Une unité dépasse la surface terrestre sélectionnée.');
  if(multiArea(clipping.intersection(joined,shape))>tolerance)throw new InputError('Les unités spatiales se chevauchent.');
  joined=clipping.union(joined,shape);
  const mapped=multiArea(shape),sown=y.units[i].sownAreaM2;
  if(sown!==null&&sown>mapped+tolerance)throw new InputError(y.areaBasis==='planned'?'La surface prévue est supérieure à la surface géométrique de son unité.':'La surface effectivement semée est supérieure à la surface géométrique de son unité.');
 }
 if(multiArea(clipping.difference(domain!.coordinates,joined))>tolerance)out.missing.push(y.areaBasis==='planned'?'Partition incomplète de la surface prévue : ajoutez les secteurs du scénario manquants.':'Partition incomplète de la surface semée : ajoutez les secteurs manquants, avec une surface nulle pour les secteurs non semés.');
 const known=y.units.every(u=>u.sownAreaM2!==null),sown=known?y.units.reduce((n,u)=>n+u.sownAreaM2!,0):null;
 out.surface.areaBasis=y.areaBasis??'sown';out.surface.simulationM2=sown;
 out.surface.plannedM2=y.areaBasis==='planned'?sown:null;
 out.surface.sownM2=y.areaBasis==='planned'?null:sown;out.surface.harvestedM2=y.units.every(u=>u.harvestedAreaM2!==null)?y.units.reduce((n,u)=>n+u.harvestedAreaM2!,0):null;
 out.surface.notPlantedPotentialM2=y.areaBasis==='planned'||sown===null?null:Math.max(0,a!.candidateAreaM2-sown);
 if(!known)out.missing.push(y.areaBasis==='planned'?'Surface prévue à semer manquante ; renseignez la surface que vous envisagez pour ce scénario.':'Surface effectivement semée manquante pour le suivi après semis.');
 if(sown===0)out.missing.push(y.areaBasis==='planned'?'La surface prévue pour ce scénario est nulle.':'Aucune surface effectivement semée n’est déclarée.');
 if(out.missing.length)return out;
 out.coverage={processedM2:multiArea(joined),requestedM2:multiArea(domain!.coordinates),complete:true};
 if(y.areaBasis==='planned')out.limits.unshift('Simulation avant semis sur la surface que l’utilisateur prévoit de cultiver. C’est une hypothèse de scénario, pas une observation de semis ou de récolte ; les rendements sont exprimés par hectare prévu.');
 if(y.method==='declared-scenario'){out.missing.push('Le mode de multiplication simple a été retiré. Les anciennes références restent archivées ; utilisez la comparaison des effets de l’eau ou des engrais.');return out;}
 if(y.method==='automatic'){out.missing.push('Estimation automatique indisponible : le moteur de rendement parcellaire et ses paramètres locaux ne sont pas raccordés. Aucun rendement à saisir pour poursuivre le plan de culture.');return out;}
 const modes=[['rainfed','Pluvial, sans irrigation ajoutée'],['recorded','Apports réalisés uniquement'],['proposed','Apports réalisés et irrigation future proposée']] as const;
 for(const [id,label] of modes){
  const scenario:YieldScenario={id,label,status:'unavailable',missing:[],totals:null,units:[]};
  for(let i=0;i<y.units.length;i++){
   const u=y.units[i],r=u.reference;
   const row:YieldScenario['units'][number]={id:u.id,reference:r,sownAreaM2:u.sownAreaM2!,harvestedAreaM2:u.harvestedAreaM2,productionKg:null,yieldKgHaSown:null,sourceDenominator:r?.denominator??null,sourceKgHa:r?.kgHa??null,etaMm:null,etmMm:null,ky:null};scenario.units.push(row);
   if(u.sownAreaM2===0){row.productionKg=0;continue;}
   if(!r){scenario.missing.push(`${u.id} : référence de rendement absente.`);continue;}
   if(r.cropId!==c.cropProfile?.id){scenario.missing.push(`${u.id} : référence liée à une autre culture ; réappliquez une référence adaptée.`);continue;}
   let kgHa=r.kgHa;
   if(y.method==='fao-seasonal'){
    if(!r.independentYm||r.denominator!=='sown'){scenario.missing.push(`${u.id} : Ym indépendant sans stress hydrique, par hectare semé, requis ; aucune moyenne historique pénalisée à nouveau.`);continue;}
    if(id==='proposed'&&y.units.filter(u=>(u.sownAreaM2??0)>0).length>1){scenario.missing.push('Plan proposé multi-unités suspendu : allocation partagée des quotas, débits et tours d’eau requise. Les scénarios pluvial et réalisé restent indépendants.');continue;}
    const uc=validateConfig({...c,...u.conditions,yieldEstimation:undefined,...(u.conditions?{inputs:undefined}:{})});
    if(uc.waterCondition!=='drained'){scenario.missing.push(`${u.id} : absence d’engorgement à confirmer ; pertes et mortalité non modélisées.`);continue;}
    if(events.some(e=>e.unitId===undefined&&y.units.length>1&&e.kind!=='rain')){scenario.missing.push('Observations d’irrigation/sol à affecter explicitement à chaque unité ; répartition automatique interdite.');continue;}
    const ev=events.filter(e=>(!e.unitId||e.unitId===u.id)&&(id!=='rainfed'||e.kind!=='irrigation'));
    const water=planWater(uc,ev.map(({unitId,...event})=>event),{irrigationMode:id,unitAreaM2:u.sownAreaM2!,unitGeometry:shapes[i]});
    if(!water.complete||water.status==='blocked'){scenario.missing.push(...water.missing.map(m=>`${u.id} : ${m}`));continue;}
    const etm=water.totals.demandMm,eta=water.totals.actualEtMm,ky=SEASONAL_KY[c.cropProfile!.id];
    row.etaMm=eta;row.etmMm=etm;row.ky=ky;
    if(!Number.isFinite(etm)||!Number.isFinite(eta)||etm<=0||eta<0||eta>etm+1e-7){scenario.missing.push(`${u.id} : ETa/ETm incompatible.`);continue;}
    // Conservative declared operating range, not a claim that clipping validates extreme stress.
    const factor=seasonalWaterFactor(eta,etm,ky);
    if(factor===null){scenario.missing.push(`${u.id} : déficit trop sévère pour cette approximation (ETa/ETm < 0,5 ou réponse non physique) ; modèle spécialisé requis.`);continue;}
    kgHa*=factor;
   }
   if(r.denominator==='harvested'&&u.harvestedAreaM2===null){scenario.missing.push(`${u.id} : surface récoltée documentée requise pour la référence par hectare récolté.`);continue;}
   row.productionKg=kgHa*((r.denominator==='harvested'?u.harvestedAreaM2!:u.sownAreaM2!)/10000);
   row.yieldKgHaSown=row.productionKg/(u.sownAreaM2!/10000);
  }
  if(!scenario.missing.length){scenario.totals=aggregateProduction(scenario.units.map((r,i)=>({sownAreaM2:y.units[i].sownAreaM2!,productionKg:r.productionKg!})),c.areaM2!);scenario.status='conditional';}
  out.scenarios.push(scenario);
 }
 out.limits.unshift('FAO56 équation 90, Ky saisonnier ; ETm = somme(Kc × ET0), ETa = somme ET réelle du bilan simple. Évaporation et transpiration non séparées ; précision limitée. Domaine conservateur ETa/ETm ≥ 0,5.');
 out.limits.push(`Hypothèse spatiale : ${y.homogeneityAssumption}`);
 out.status=out.scenarios.some(s=>s.status==='conditional')?'conditional':'unavailable';return out;
}
/** One server entry point for preview, persistence and exports. Existing water calculations stay unchanged unless a planned or sown surface is explicitly supplied. */
export function planSeason(input:unknown,inputEvents:unknown=[],options:{requireGeometry?:boolean}={}):WaterPlan{
 const c=validateConfig(input),events=validateEvents(inputEvents,c),multi=(c.yieldEstimation?.units.length??0)>1;
 const plannedArea=(!c.yieldEstimation||c.yieldEstimation.units.every(u=>u.sownAreaM2===null))?c.sowingPlan?.areaM2:null;
 if(plannedArea!=null&&c.landAssessment&&c.landAssessment.status!=='unknown'&&plannedArea>c.landAssessment.candidateAreaM2+Math.max(.01,c.landAssessment.candidateAreaM2*1e-7))throw new InputError('La surface prévue dépasse la terre cartographiée disponible.');
 const plan=planWater(c,multi?[]:events,plannedArea!=null&&plannedArea>0?{...options,unitAreaM2:plannedArea,unitGeometry:c.landAssessment?.fractions.potentialLand.geometry}:options);
 if(plannedArea!=null&&plannedArea>0)plan.assumptions.push('Volumes sur la surface prévue du plan de semis ; position exacte et homogénéité de cette partie à vérifier. Ce n’est pas une déclaration de semis réalisé.');
 if(plannedArea===0){plan.status='blocked';plan.complete=false;plan.days=[];plan.weeks=[];plan.decades=[];plan.stages=[];plan.nextWindows=[];plan.totals={demandMm:0,actualEtMm:0,unmetEtMm:0,netMm:0,recordedSourceM3:null,remainingSourceM3:null,sourceM3:null,fieldM3:null,remainingBudgetM3:null};plan.missing.push('Aucune surface prévue pour le semis : aucun arrosage proposé.');}

 if(c.yieldEstimation){
  const estimate=estimateYield(c,events,plan);
  const calculationM2=estimate.surface.simulationM2??estimate.surface.sownM2;
  if(estimate.coverage.complete&&calculationM2!>0&&c.yieldEstimation.units.length===1){
   const conditions=c.yieldEstimation.units[0].conditions;
   const scoped=planWater(conditions?validateConfig({...c,...conditions,inputs:undefined}):c,events, {...options,unitAreaM2:calculationM2!,unitGeometry:c.yieldEstimation.units[0].geometry??plan.calculationArea?.geometry});
   scoped.yieldEstimation=estimate;return attachSalinity(scoped,c,events);
  }
  plan.yieldEstimation=estimate;
  if(multi||calculationM2===0){plan.status='blocked';plan.complete=false;plan.days=[];plan.weeks=[];plan.decades=[];plan.stages=[];plan.nextWindows=[];plan.totals={demandMm:0,actualEtMm:0,unmetEtMm:0,netMm:0,recordedSourceM3:null,remainingSourceM3:null,sourceM3:null,fieldM3:null,remainingBudgetM3:null};plan.missing.push(multi?'Calendrier global multi-unités indisponible : les bilans de rendement sont calculés par unité ; allocation partagée de l’eau à définir.':'Aucune surface prévue ou semée : aucun arrosage proposé.');}
 }
 return attachSalinity(plan,c,events);
}
function attachSalinity(plan:WaterPlan,c:SeasonalConfig,events:WaterEvent[]):WaterPlan{
 if(c.canopyNowcast)plan.canopyNowcast=canopyNowcast(c,plan);
 plan.waterImpact=waterImpact(c,events,plan);
 if(c.growth)plan.growth=integratedGrowth(c,events,plan);
 if(c.fertilizerScenario)plan.fertilizerScenario=fertilizerScenario(c,plan);
 if(c.yieldEstimation||c.managementPlan)plan.response=interventionOutcome(c,plan);
 plan.sowingPlan=estimateSowing(c);
 if(c.managementPlan)plan.management=managementSummary(c,plan);
 if(!c.salinity)return plan;
 // Reuse only spatial coverage checks; salinity is not a second water penalty.
 const spatial=estimateYield({...c,yieldEstimation:c.yieldEstimation?{...c.yieldEstimation,method:'automatic'}:undefined},[],plan);
 if(!spatial.coverage.complete){plan.salinity={status:'unavailable',missing:spatial.missing};return plan;}
 try{plan.salinity=salinityScenario(c,c.salinity);}catch(e){if(!(e instanceof InputError))throw e;plan.salinity={status:'unavailable',missing:[e.message]};}
 return plan;
}
export function yieldCsv(e:YieldEstimate):string{
 const q=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const header=['type_ligne','unite_id','mode','statut','surface_contour_m2','surface_semee_m2','surface_recoltee_m2','production_kg','production_t','rendement_kg_ha_seme','rendement_t_ha_seme','production_kg_ha_contour','reference_kg_ha','denominateur_reference','source_reference','disponible_depuis','methode','version_modele','version_ky','versions_donnees','couverture_complete','limites','validation_locale','effet_nutrition'];
 const rows:unknown[][]=[];
 for(const s of e.scenarios){
  const tail=[e.method,e.version,e.versions.ky,JSON.stringify(e.dataSources),e.coverage.complete,[...e.missing,...s.missing,...e.limits].join(' | '),'non_validee','non_modelise'];
  rows.push(['total','',s.id,s.status,e.surface.drawnM2,e.surface.sownM2,e.surface.harvestedM2,s.totals?.productionKg,s.totals?s.totals.productionKg/1000:null,s.totals?.yieldKgHaSown,s.totals?.yieldKgHaSown==null?null:s.totals.yieldKgHaSown/1000,s.totals?.productionKgHaContour,'','','','',...tail]);
  for(const u of s.units)rows.push(['unite',u.id,s.id,u.productionKg===null?'unavailable':'conditional',e.surface.drawnM2,u.sownAreaM2,u.harvestedAreaM2,u.productionKg,u.productionKg===null?null:u.productionKg/1000,u.yieldKgHaSown,u.yieldKgHaSown===null?null:u.yieldKgHaSown/1000,'',u.sourceKgHa,u.sourceDenominator,u.reference?.source,u.reference?.availableOn,...tail]);
 }
 if(!rows.length)rows.push(['total','','','unavailable',e.surface.drawnM2,e.surface.sownM2,e.surface.harvestedM2,'','','','','','','','','',e.method,e.version,e.versions.ky,JSON.stringify(e.dataSources),false,e.missing.join(' | ')]);
 return '\ufeff'+[header,...rows].map(r=>r.map(q).join(';')).join('\r\n');
}
