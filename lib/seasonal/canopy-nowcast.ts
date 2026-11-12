import profile from './profiles/ghana-canopy-2021.json' with {type:'json'};
import {InputError,isoDate,addDays} from './validation.ts';
import {geometryIdentity} from './provenance.ts';
import {landBlockReason} from './land.ts';
import type {SeasonalConfig,WaterPlan} from './types.ts';
export const CANOPY_NOWCAST_VERSION='canopy-nowcast-1.0.0';
export const CANOPY_NOWCAST_PROFILE=profile;
export type CanopyNowcastInput={version:'canopy-nowcast-1';acceptedHypothesis:true;scope:string;monitoringStart:string;initialStage:'vegetative'|'flowering';
 observations:{date:string;availableOn:string;laiSamples:number[];method:'field-green-lai';source:string}[]};
export const canopyNowcastScope=(c:SeasonalConfig)=>JSON.stringify([c.country,geometryIdentity(c.parcelGeometry),c.cropProfile?.id,c.variety,c.sowingDate]);
export function parseCanopyNowcast(value:unknown,c:SeasonalConfig):CanopyNowcastInput|undefined{
 if(value===undefined)return undefined;
 const v=structuredClone(value) as CanopyNowcastInput;
 if(!v||v.version!=='canopy-nowcast-1'||v.acceptedHypothesis!==true||typeof v.scope!=='string'||!v.scope||v.scope.length>300000||!['vegetative','flowering'].includes(v.initialStage)||!Array.isArray(v.observations)||v.observations.length>60)throw new InputError('Suivi du couvert : profil, accord explicite et observations invalides.');
 const maturity=addDays(c.sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
 isoDate(v.monitoringStart);if(v.monitoringStart<c.sowingDate||v.monitoringStart>c.asOfDate||addDays(v.monitoringStart,profile.monitoringDays)>maturity)throw new InputError('Suivi hors cycle cultural ou futur.');
 for(const o of v.observations){
  if(!o||o.method!=='field-green-lai'||!Array.isArray(o.laiSamples)||o.laiSamples.length<3||o.laiSamples.length>20||o.laiSamples.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>10)||typeof o.source!=='string'||!o.source.trim()||o.source.length>600)throw new InputError('Suivi du couvert : 3 à 20 mesures de LAI vert au champ, méthode et source requises par visite.');
  isoDate(o.date);isoDate(o.availableOn);if(o.date<v.monitoringStart||o.date>c.asOfDate||o.date>maturity||o.availableOn<o.date||o.availableOn>c.asOfDate)throw new InputError('LAI observé futur, hors cycle ou indisponible à la date du calcul.');
 }
 if(new Set(v.observations.map(o=>o.date)).size!==v.observations.length)throw new InputError('Une visite de LAI par date ; regroupez les points du même champ.');
 v.observations.sort((a,b)=>a.date.localeCompare(b.date));return v;
}
export type CanopyNowcastResult={version:string;profileId:string;status:'experimental_nowcast'|'unavailable';forecastValidated:false;missing:string[];limits:string[];
 yieldKgHa:number|null;productionKg:number|null;areaM2:number|null;areaBasis:'planned'|'sown'|null;moisturePercent:null;peakLai:number|null;issueDate:string|null;lastObservation:string|null;
 interval90KgHa:[number,number]|null;test:typeof profile.test;inputVisits:number;laterVisitsExcluded:number};
/** A distinct inference from observed crop state. No FAO, RUE, QUEFTS or nutrient
 * ceiling multiplies this output; it cannot identify counterfactual interventions. */
export function canopyNowcast(c:SeasonalConfig,plan:WaterPlan):CanopyNowcastResult{
 const v=c.canopyNowcast;
 const out:CanopyNowcastResult={version:CANOPY_NOWCAST_VERSION,profileId:profile.id,status:'unavailable',forecastValidated:false,missing:[],limits:[...profile.limits,'Évaluation rétrospective sur les champs réservés de 2021, après développement ; aucune saison ultérieure ni autre pays validé.','Intervalle nominal à 90 % évalué sur un petit échantillon local ; sa couverture future n’est pas établie.'],yieldKgHa:null,productionKg:null,areaM2:null,areaBasis:null,moisturePercent:null,peakLai:null,issueDate:null,lastObservation:null,interval90KgHa:null,test:profile.test,inputVisits:0,laterVisitsExcluded:0};
 if(!v){out.missing.push('Deux semaines de mesures de LAI vert au champ et acceptation de l’hypothèse requises.');return out;}
 if(v.scope!==canopyNowcastScope(c))out.missing.push('Le champ, la culture, la variété ou le semis ont changé : réexaminer les observations.');
 if(c.asOfDate<profile.availableOn)out.missing.push('Profil expérimental encore indisponible à la date du calcul.');
 if(c.country!==profile.country||c.cropProfile?.id!==profile.crop)out.missing.push('Profil limité au maïs du site ghanéen étudié ; aucun transfert automatique dans les autres pays.');
 const [west,south,east,north]=profile.bbox;
 if(c.latitude===null||c.longitude===null||c.latitude<south||c.latitude>north||c.longitude<west||c.longitude>east)out.missing.push('Champ hors de l’enveloppe géographique des observations ghanéennes.');
 if(c.systemDomain!=='upland'||c.waterCondition!=='drained'||c.agronomic&&c.agronomic.system!=='single')out.missing.push('Maïs en culture pure et sol drainé requis ; engorgement et associations hors domaine.');
 const end=addDays(v.monitoringStart,profile.monitoringDays);out.issueDate=end;
 if(c.asOfDate<end||c.asOfDate>addDays(end,profile.maxIssueDelayDays))out.missing.push('Estimation possible entre le 14e et le 21e jour après le début du suivi ; reprendre un protocole adapté au-delà.');
 // Even an available later measurement cannot leak into the frozen issue date.
 const visits=v.observations.filter(o=>o.date<=end&&o.availableOn<=end);
 out.inputVisits=visits.length;out.laterVisitsExcluded=v.observations.length-visits.length;
 if(visits.length<profile.minVisits||!visits.some(o=>o.date===v.monitoringStart))out.missing.push('Au moins deux visites disponibles avant l’échéance, dont celle du début du suivi, sont requises.');
 if(visits.length&&Date.parse(visits.at(-1)!.date)-Date.parse(visits[0].date)<5*86400000)out.missing.push('Les visites de LAI doivent être espacées d’au moins cinq jours.');
 if(visits.length){out.lastObservation=visits.at(-1)!.date;out.peakLai=Math.max(...visits.map(o=>o.laiSamples.reduce((n,x)=>n+x,0)/o.laiSamples.length));
  if(out.peakLai<profile.laiRange[0]||out.peakLai>profile.laiRange[1])out.missing.push('LAI hors de la plage d’apprentissage : extrapolation suspendue.');}
 if(out.missing.length)return out;
 out.yieldKgHa=Math.max(0,profile.coefficients.interceptKgHa+profile.coefficients.slopeKgHaPerLai*out.peakLai!);
 out.interval90KgHa=[Math.max(0,out.yieldKgHa-profile.interval.halfWidthKgHa),out.yieldKgHa+profile.interval.halfWidthKgHa];
 // Spatial safety is independent of meteorological completeness for this method.
 const units=c.yieldEstimation?.units,areaBasis=c.yieldEstimation?.areaBasis??(c.yieldEstimation?'sown':'planned');
 out.areaBasis=areaBasis;
 const unit=units?.length===1&&c.yieldEstimation?.scopeGeometryId===geometryIdentity(c.parcelGeometry)?units[0]:null;
 const area=units?(unit?(areaBasis==='planned'?unit.sownAreaM2??c.sowingPlan?.areaM2:unit.sownAreaM2):null):c.sowingPlan?.areaM2;
 const spatialIssue=landBlockReason(c);
 if(!spatialIssue&&area!=null&&area>0&&area<=(c.landAssessment?.candidateAreaM2??0)+.01){out.areaM2=area;out.productionKg=area/10000*out.yieldKgHa;}
 else out.limits.push('Production totale indisponible : surface prévue ou semée sur terre cartographiée à confirmer.');
 out.status='experimental_nowcast';return out;
}
