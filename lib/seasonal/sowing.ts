import type {SeasonalConfig} from './types.ts';
import {geometryIdentity} from './provenance.ts';
import {InputError} from './validation.ts';
export const SOWING_VERSION='sowing-1.0.0';
export type SowingInput={version:'sowing-input-1';geometryId:string;cropId:string;areaM2:number|null;seedRateKgHa:number|null;source:string};
export type SeedReference={id:string;cropId:string;rangeKgHa:[number,number];defaultKgHa:number;title:string;url:string;context:string;checkedOn:string};
const smallGrains='https://propas.iita.org/en/solutions/varieties-for-better-nutrition-and-stress-resistance/113/details/';
/** Regional planning references, never a measured optimum or a yield-response coefficient.
 * Defaults are explicitly chosen within the published ranges, not fitted to the parcel. */
export const SEED_REFERENCES:Record<string,SeedReference>={
 maize:{id:'seedco-ng-maize-2026',cropId:'maize',rangeKgHa:[20,25],defaultKgHa:25,title:'Seed Co Nigeria · Good agronomic practices for maize farming',url:'https://seedcogroup.com/ng/fieldcrops/good-agronomics-practices-for-maize-farming/',context:'Maïs grain hybride au Nigeria, culture pure. 20–25 kg/ha selon la taille des graines. Repère choisi : 25 kg/ha ; adapter à la variété, à la germination et aux conditions locales.',checkedOn:'2026-11-01'},
 soybean:{id:'naerls-soybean-2024',cropId:'soybean',rangeKgHa:[50,70],defaultKgHa:60,title:'NAERLS · National Farmers’ Helpline · Seed Rate SC-SL01',url:'https://nfhl.naerls.gov.ng/index.php?action=faq&artlang=en&cat=182&id=83',context:'Soja au Nigeria : 50–70 kg/ha, taille des graines variable. Milieu de plage choisi : 60 kg/ha. Référence de conduite à adapter localement.',checkedOn:'2026-11-01'},
 sorghum:{id:'iita-propas-sorghum',cropId:'sorghum',rangeKgHa:[8,12],defaultKgHa:10,title:'IITA / PROPaS · Varieties for Better Nutrition and Stress Resistance',url:smallGrains,context:'Sorgho amélioré des zones sèches et savanes : 8–12 kg/ha. Milieu de plage choisi : 10 kg/ha. Adapter aux variétés et aux zones.',checkedOn:'2026-11-01'},
 millet:{id:'iita-propas-pearl-millet',cropId:'millet',rangeKgHa:[5,8],defaultKgHa:6.5,title:'IITA / PROPaS · Varieties for Better Nutrition and Stress Resistance',url:smallGrains,context:'Mil perlé amélioré des zones sèches : 5–8 kg/ha selon les zones. Milieu de plage choisi : 6,5 kg/ha ; pas une prescription universelle.',checkedOn:'2026-11-01'},
};
export function parseSowingInput(value:unknown,c:SeasonalConfig):SowingInput|undefined{
 if(value===undefined)return undefined;
 const v=value as SowingInput;
 if(!v||v.version!=='sowing-input-1'||v.geometryId!==geometryIdentity(c.parcelGeometry)||v.cropId!==c.cropProfile?.id)throw new InputError('Plan de semis incompatible avec le contour ou la culture.');
 for(const [n,x,max] of [['Surface prévue',v.areaM2,c.areaM2??0],['Dose de semences',v.seedRateKgHa,10000]] as const)if(x!==null&&(typeof x!=='number'||!Number.isFinite(x)||x<0||x>max))throw new InputError(`${n} invalide.`);
 if(typeof v.source!=='string'||v.source.length>600||v.seedRateKgHa!==null&&!v.source.trim())throw new InputError('Documentez la dose de semis saisie.');
 return {version:'sowing-input-1',geometryId:v.geometryId,cropId:v.cropId,areaM2:v.areaM2,seedRateKgHa:v.seedRateKgHa,source:v.source.trim()};
}
export type SowingEstimate={version:typeof SOWING_VERSION;status:'indicative'|'unavailable';cropId:string;areaM2:number|null;areaBasis:'mapped-scenario'|'declared-plan'|'sown-declaration';seedRateKgHa:number|null;seedKg:number|null;rangeKg:[number,number]|null;reference:SeedReference|null;rateBasis:'reference'|'manual';source:string;missing:string[];limits:string[]};
export function estimateSowing(c:SeasonalConfig):SowingEstimate{
 const cropId=c.cropProfile?.id??'',ref=SEED_REFERENCES[cropId]??null,input=c.sowingPlan;
 const compatibleLand=c.parcelGeometry&&c.landAssessment&&geometryIdentity(c.parcelGeometry)===geometryIdentity(c.landAssessment.geometry)?c.landAssessment:null;
 const declared=c.yieldEstimation?.scopeGeometryId===geometryIdentity(c.parcelGeometry)&&c.yieldEstimation.units.every(u=>u.sownAreaM2!==null)?c.yieldEstimation.units.reduce((n,u)=>n+u.sownAreaM2!,0):null;
 const candidate=compatibleLand?.candidateAreaM2??null;
 const areaM2=declared??input?.areaM2??candidate;
 const rate=input?.seedRateKgHa??ref?.defaultKgHa??null;
 const missing:string[]=[];
 if(candidate===null||compatibleLand?.status==='unknown')missing.push('La cartographie terrestre de ce contour doit être disponible.');
 if(areaM2===null)missing.push('Surface prévue pour le semis manquante.');
 if(areaM2!==null&&candidate!==null&&areaM2>candidate+Math.max(.01,candidate*1e-7))missing.push('La surface prévue dépasse la terre cartographiée disponible.');
 if(areaM2===0)missing.push('Aucune surface terrestre prévue pour le semis.');
 if(input?.seedRateKgHa==null&&ref&&c.asOfDate<ref.checkedOn)missing.push('Ce repère de semis a été acquis après la date du scénario ; actualisez la date du conseil ou documentez votre dose.');
 if(rate===null)missing.push('Aucune dose de semis référencée pour cette culture : renseignez une référence locale.');
 if(c.systemDomain!=='upland'||c.waterCondition==='waterlogged'||c.waterCondition==='submerged')missing.push('État hydrique incompatible avec le plan de semis terrestre standard.');
 if(c.agronomic?.system&&c.agronomic.system!=='single')missing.push('La dose automatique concerne une culture pure.');
 const seedKg=missing.length||areaM2===null||rate===null?null:areaM2/10000*rate;
 return {version:SOWING_VERSION,status:seedKg===null?'unavailable':'indicative',cropId,areaM2,areaBasis:declared!==null?'sown-declaration':input?.areaM2!==null&&input?.areaM2!==undefined?'declared-plan':'mapped-scenario',seedRateKgHa:rate,seedKg,rangeKg:seedKg!==null&&ref&&input?.seedRateKgHa==null?[areaM2!/10000*ref.rangeKgHa[0],areaM2!/10000*ref.rangeKgHa[1]]:null,reference:ref,rateBasis:input?.seedRateKgHa==null?'reference':'manual',source:input?.seedRateKgHa!=null?input.source:ref?.title??'',missing,limits:['Estimation de quantité pour préparer un semis en culture pure ; pas un optimum calculé pour la parcelle.','La surface proposée suppose l’usage de la terre cartographiée ; ni semis effectué, ni aptitude, ni autorisation de cultiver établis.','La variété, le poids des graines et la germination sont à vérifier. Aucune réserve supplémentaire pour pertes n’est ajoutée automatiquement.','La dose de semences ne modifie pas le rendement dans les modèles actuels.']};
}
export function sowingCsv(e:SowingEstimate){
 const q=(v:unknown)=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[['version','statut','culture_id','surface_prevue_m2','origine_surface','dose_kg_ha','semences_kg','reference','source','limites'],[e.version,e.status,e.cropId,e.areaM2,e.areaBasis,e.seedRateKgHa,e.seedKg,e.reference?.id,e.source,[...e.missing,...e.limits].join(' | ')]].map(r=>r.map(q).join(';')).join('\r\n');
}
