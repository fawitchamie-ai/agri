import {InputError,isoDate} from './validation.ts';
import type {SeasonalConfig} from './types.ts';
export const SALINITY_VERSION='FAO56-table23-equation89-1';
export const SALINITY_SOURCE='https://www.fao.org/4/x0490e/x0490e0e.htm';
export type SalinityInput={ecDsM:number;depthM:number;source:string;product:string;noOtherLimitation:boolean;rootzoneSeasonAverage:boolean;method:'saturated_paste_25C';availableOn:string;period:{from:string;to:string}};
export function parseSalinityInput(v:unknown):SalinityInput|undefined{
 if(v===undefined)return undefined;
 const p=v as SalinityInput;
 if(!p||typeof p.ecDsM!=='number'||!Number.isFinite(p.ecDsM)||p.ecDsM<0||p.ecDsM>100||typeof p.depthM!=='number'||!Number.isFinite(p.depthM)||p.depthM<=0||p.depthM>10||typeof p.source!=='string'||!p.source.trim()||p.source.length>1200||!['grain','seed','bulb'].includes(p.product)||typeof p.noOtherLimitation!=='boolean'||typeof p.rootzoneSeasonAverage!=='boolean'||p.method!=='saturated_paste_25C'||!p.period)throw new InputError('Paramètres et provenance du scénario de salinité invalides.');
 const from=isoDate(p.period.from),to=isoDate(p.period.to),availableOn=isoDate(p.availableOn);if(from>to)throw new InputError('Période de salinité inversée.');
 return {ecDsM:p.ecDsM,depthM:p.depthM,source:p.source.trim(),product:p.product,noOtherLimitation:p.noOtherLimitation,rootzoneSeasonAverage:p.rootzoneSeasonAverage,method:p.method,availableOn,period:{from,to}};
}
/** Only unambiguous point coefficients; ranges and rice's water conductivity deliberately excluded. */
export const SALINITY_PROFILES:Record<string,{threshold:number;slope:number;product:string}>={maize:{threshold:1.7,slope:12,product:'grain'},sorghum:{threshold:6.8,slope:16,product:'grain'},soybean:{threshold:5,slope:20,product:'seed'},groundnut:{threshold:3.2,slope:29,product:'seed'},onion:{threshold:1.2,slope:16,product:'bulb'},cowpea:{threshold:4.9,slope:12,product:'seed'}};
export function salinityScenario(config:SeasonalConfig,input:unknown){
 const request=parseSalinityInput(input);if(!request)throw new InputError('Paramètres de salinité requis.');
 const c={...config,...config.yieldEstimation?.units[0]?.conditions};
 const profile=SALINITY_PROFILES[c.cropProfile?.id??''];if(!profile)throw new InputError('Courbe de salinité non paramétrée pour cette culture/ce produit.');
 const y=c.yieldEstimation;if(!y||y.units.length!==1||!y.units[0].reference)throw new InputError('Une unité et une référence indépendante de rendement sont requises.');
 const unit=y.units[0],reference=unit.reference!;
 if(!reference.independentYm||reference.denominator!=='sown'||reference.cropId!==c.cropProfile?.id)throw new InputError('Ym indépendant, sans stress salin ni hydrique, par hectare semé et pour la culture choisie requis.');
 if(c.waterCondition!=='drained'||c.systemDomain!=='upland'||request.noOtherLimitation!==true||request.rootzoneSeasonAverage!==true||request.product!==profile.product)throw new InputError('Scénario isolé de salinité : drainage confirmé, autres facteurs non limitants, produit compatible et ECe représentative de la saison/zone racinaire requis.');
 const ec=request.ecDsM,depth=request.depthM,maxRoot=Math.max(...c.stages.map(s=>s.rootEndM));
 if(typeof ec!=='number'||!Number.isFinite(ec)||ec<0||typeof depth!=='number'||!Number.isFinite(depth)||depth<maxRoot||request.method!=='saturated_paste_25C'||typeof request.source!=='string'||!request.source.trim())throw new InputError('ECe de pâte saturée à 25 °C, profondeur couvrant les racines et source requises.');
 if(isoDate(request.availableOn)>c.asOfDate)throw new InputError('Analyse non disponible à la date du conseil.');
 const period=request.period;if(!period||isoDate(period.from)>c.sowingDate||isoDate(period.to)<new Date(Date.parse(c.sowingDate)+(c.stages.reduce((n,s)=>n+s.days,0)-1)*86400000).toISOString().slice(0,10))throw new InputError('La représentativité déclarée doit couvrir le cycle entier.');
 // Conservative application domain, not an extrapolated mortality prediction.
 if(ec>=profile.threshold+50/profile.slope)throw new InputError('Salinité trop élevée pour le domaine conservateur retenu ; modèle spécifique requis.');
 const factor=1-profile.slope*Math.max(0,ec-profile.threshold)/100,kgHaSown=reference.kgHa*factor;
 if(unit.sownAreaM2===null)throw new InputError('Surface semée requise.');
 return {version:SALINITY_VERSION,source:SALINITY_SOURCE,profile,ecDsM:ec,depthM:depth,period,method:'FAO56 équation 89, salinité seule, autres facteurs non limitants',status:'conditional_unvalidated' as const,yieldKgHaSown:kgHaSown,productionKg:kgHaSown*unit.sownAreaM2/10000,productionKgHaContour:c.areaM2?kgHaSown*unit.sownAreaM2/c.areaM2:null,sownM2:unit.sownAreaM2,relativeYield:factor,inputSource:request.source,availableOn:request.availableOn,limits:['Scénario isolé, pas combiné au stress hydrique : aucune multiplication de pertes ni double pénalisation.','Une mesure de surface ou une EC 1:5 ne représente pas l’ECe saisonnière de toute la racine.','Coefficients généraux, non calibrés pour chaque variété/pays. Toxicités ioniques et mortalité non simulées.','Aucun dessalement, besoin de lessivage ni effet d’un engrais déduit.']};
}
