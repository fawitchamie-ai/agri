import {InputError,isoDate} from './validation.ts';
import type {DualKcInput} from './dual-kc.ts';
export type GrowthHarvestSample={id:string;site:string;season:number;split:'training'|'validation';country:string;cropId:string;variety:string;profileId:string;availableOn:string;source:string;biomassDryKgHa:number;observedYieldKgHa:number;moisturePercent:number};
export function growthProfileId(p:{rueGPerMj:number;temperatureC:unknown;stages:unknown;nutrientKgPerTonneBiomass:unknown;fertilizerRecovery:unknown;phResponse?:unknown;biomassModel?:unknown},waterModel?:DualKcInput,soilWaterModel?:{version:string}){
 // pH response curves are diagnostic-only and are excluded from the active
 // profile identity so they cannot silently change calibration eligibility.
 // The trailing null preserves the identifier shape used by earlier profiles
 // that already had phResponse:null.
 const legacy=[p.rueGPerMj,p.temperatureC,p.stages,p.nutrientKgPerTonneBiomass,p.fertilizerRecovery,null];
 const equation=p.biomassModel?[...legacy,p.biomassModel]:legacy;
 if(!waterModel?.transpiration)return JSON.stringify(soilWaterModel?[...equation,{soilWaterModel:soilWaterModel.version}]:equation);
 const d=waterModel.canopyDynamics;
 // New canopy mechanisms alter archived biomass. An HI fitted with the previous
 // prescribed-cover method must not silently carry over to a new equation.
 return JSON.stringify([...equation,{soilWaterModel:soilWaterModel?.version??null,transpiration:[waterModel.transpiration.method,waterModel.transpiration.maxCoefficient],stages:waterModel.stages,
  canopy:d?[d.initialCover,d.maxCover,d.emergenceDay,d.senescenceDay,d.growthRateDay,d.declineRateDay,d.expansionLower,d.expansionUpper,d.senescenceThreshold,d.stressDeclineRateDay]:null}]);
}
/** Fits HI only. Biomass must be from archived runs using the exact same profile.
 * Temporal and site holdouts are mandatory. No claim of complete model validation.
 */
export function fitHarvestIndex(value:unknown,domain:{country:string;cropId:string;variety:string;profileId:string;asOfDate:string}){
 const fail=(m:string):never=>{throw new InputError('Calibration : '+m);};
 if(!Array.isArray(value)||value.length<4||value.length>500)fail('4 à 500 observations documentées requises.');
 const samples=value as GrowthHarvestSample[];
 for(const s of samples){
 if(!s||![s.id,s.site,s.source].every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=1200)||!['training','validation'].includes(s.split)||!Number.isInteger(s.season)||s.season<1900||s.season>Number(domain.asOfDate.slice(0,4)))fail('identité, site, saison, source ou partition invalides.');
 isoDate(s.availableOn);if(s.availableOn>domain.asOfDate||s.season>Number(s.availableOn.slice(0,4)))fail('récolte indisponible à cette date.');
 if(s.country!==domain.country||s.cropId!==domain.cropId||s.variety!==domain.variety||s.profileId!==domain.profileId)fail('pays, culture, variété et profil doivent correspondre exactement.');
 if(typeof s.biomassDryKgHa!=='number'||!Number.isFinite(s.biomassDryKgHa)||s.biomassDryKgHa<=0||s.biomassDryKgHa>200000||typeof s.observedYieldKgHa!=='number'||!Number.isFinite(s.observedYieldKgHa)||s.observedYieldKgHa<0||s.observedYieldKgHa>200000||typeof s.moisturePercent!=='number'||!Number.isFinite(s.moisturePercent)||s.moisturePercent<0||s.moisturePercent>40)fail('biomasse sèche, rendement par hectare semé et humidité invalides.');
 }
 if(new Set(samples.map(s=>s.id)).size!==samples.length)fail('identifiants dupliqués.');
 if(new Set(samples.map(s=>JSON.stringify([s.site,s.season]))).size!==samples.length)fail('une seule observation agrégée par site et saison.');
 const train=samples.filter(s=>s.split==='training'),holdout=samples.filter(s=>s.split==='validation');
 if(train.length<2||holdout.length<2)fail('au moins deux observations dans chaque partition.');
 if(holdout.some(s=>train.some(t=>t.site===s.site))||Math.max(...train.map(s=>s.season))>=Math.min(...holdout.map(s=>s.season)))fail('validation sur sites distincts ET saisons postérieures à l’apprentissage requise.');
 const dry=(s:GrowthHarvestSample)=>s.observedYieldKgHa*(1-s.moisturePercent/100);
 const hi=train.reduce((n,s)=>n+s.biomassDryKgHa*dry(s),0)/train.reduce((n,s)=>n+s.biomassDryKgHa**2,0);
 if(hi<.01||hi>.9)fail('indice de récolte ajusté hors domaine physique autorisé ; ne pas tronquer les données.');
 const metrics=(rows:GrowthHarvestSample[])=>{const errors=rows.map(s=>s.biomassDryKgHa*hi-dry(s));return {n:rows.length,sites:new Set(rows.map(s=>s.site)).size,maeDryKgHa:errors.reduce((n,e)=>n+Math.abs(e),0)/errors.length,rmseDryKgHa:Math.sqrt(errors.reduce((n,e)=>n+e*e,0)/errors.length),biasDryKgHa:errors.reduce((n,e)=>n+e,0)/errors.length};};
 return {harvestIndex:hi,training:metrics(train),validation:metrics(holdout),forecastValidated:false as const,source:'Ajustement de l’indice de récolte uniquement, sur biomasses simulées archivées et récoltes déclarées compatibles. Sources : '+[...new Set(samples.map(s=>s.source))].join(' ; '),limits:['Fournitures NPK, RUE, température, couvert et interactions non calibrés par cet ajustement.','Biomasses et provenance des observations déclarées, non certifiées. Aucune série nationale substituée aux essais parcellaires.','Erreur de validation descriptive ; aucun intervalle prédictif ni seuil de qualification franchi automatiquement.']};
}
