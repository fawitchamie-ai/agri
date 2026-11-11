import {InputError,addDays,isoDate} from './validation.ts';
import {geometryIdentity} from './provenance.ts';
import type {SeasonalConfig,WaterPlan} from './types.ts';

export const WATER_STAGES_VERSION='FAO33-maize-stage-product-1.0.0';
export const WATER_STAGES_SOURCE='https://www.fao.org/4/X5647E/x5647e0e.htm';
export const STAGE_KY=[0,.4,1.5,.5,.2] as const;
export type WaterStageCalendar={version:'maize-water-stages-1';acceptedHypothesis:true;scope:string;source:string;availableOn:string;
 establishmentEndDay:number;floweringStartDay:number;floweringDays:number;grainEndDay:number};
export const waterStageScope=(c:SeasonalConfig)=>JSON.stringify([c.country,geometryIdentity(c.parcelGeometry),c.cropProfile?.id,c.variety,c.sowingDate,c.stages.map(s=>[s.name,s.days,s.kcStart,s.kcEnd,s.rootStartM,s.rootEndM,s.depletionFraction])]);

export function parseWaterStageCalendar(value:unknown,c:SeasonalConfig):WaterStageCalendar{
 const v=value as WaterStageCalendar,n=c.stages.reduce((s,r)=>s+r.days,0);
 if(!v||v.version!=='maize-water-stages-1'||v.acceptedHypothesis!==true||typeof v.scope!=='string'||!v.scope||v.scope.length>300000||typeof v.source!=='string'||!v.source.trim()||v.source.length>1600)throw new InputError('Réponse par stade : calendrier sourcé et hypothèse explicitement acceptée requis.');
 isoDate(v.availableOn);
 if(v.availableOn>c.asOfDate)throw new InputError('Calendrier de réponse indisponible à la date du calcul.');
 const ints=[v.establishmentEndDay,v.floweringStartDay,v.floweringDays,v.grainEndDay];
 if(ints.some(x=>!Number.isInteger(x)||x<1)||v.establishmentEndDay>=v.floweringStartDay||v.floweringStartDay+v.floweringDays-1>=v.grainEndDay||v.grainEndDay>=n)throw new InputError('Phases de réponse chevauchantes, vides ou hors du cycle.');
 return {version:v.version,acceptedHypothesis:true,scope:v.scope,source:v.source.trim(),availableOn:v.availableOn,establishmentEndDay:v.establishmentEndDay,floweringStartDay:v.floweringStartDay,floweringDays:v.floweringDays,grainEndDay:v.grainEndDay};
}
export type WaterStageResult={version:string;factor:number|null;missing:string[];warnings:string[];phases:{name:string;from:string;to:string;ky:number;etaMm:number;etmMm:number;ratio:number|null;factor:number|null}[]};

/** Product composition inspired by SWAP4 static-crop Eq7.2.
 * SWAP uses transpiration; here FAO33 Ky applies to total ET, explicitly.
 * This adaptation is a hypothesis, not locally fitted Ky.
 * Daily ET comes from the real water engine. No irrigation/yield equivalence.
 */
export function stageWaterFactor(c:SeasonalConfig,days:WaterPlan['days'],calendar:WaterStageCalendar):WaterStageResult{
 const out:WaterStageResult={version:WATER_STAGES_VERSION,factor:null,missing:[],warnings:[],phases:[]};
 const n=c.stages.reduce((s,r)=>s+r.days,0);
 if(c.cropProfile?.id!=='maize')out.missing.push('Réponse par stade paramétrée uniquement pour le maïs grain.');
 if(c.waterModel?.canopyDynamics)out.missing.push('Couvert déjà modifié par le stress : ETm de référence à qualifier avant cette combinaison.');
 if(calendar.scope!==waterStageScope(c))out.missing.push('Champ, variété, semis ou cycle modifié : réexaminer le calendrier de réponse.');
 if(days.length!==n||days.some((d,i)=>d.date!==addDays(c.sowingDate,i)))out.missing.push('Bilan quotidien complet et sans décalage requis.');
 if(out.missing.length)return out;
 const ends=[calendar.establishmentEndDay,calendar.floweringStartDay-1,calendar.floweringStartDay+calendar.floweringDays-1,calendar.grainEndDay,n];
 const names=['Installation','Végétation','Floraison','Formation du grain','Maturation'];
 let start=0,factor=1;
 for(let i=0;i<ends.length;i++){
  const rows=days.slice(start,ends[i]),eta=rows.reduce((s,d)=>s+d.actualEtMm,0),etm=rows.reduce((s,d)=>s+d.demandMm,0),ky=STAGE_KY[i];
  const valid=rows.length>0&&Number.isFinite(eta)&&Number.isFinite(etm)&&eta>=0&&etm>0&&eta<=etm+1e-7;
  const ratio=valid?Math.min(1,eta/etm):null,raw=ratio===null?null:1-ky*(1-ratio);
  const f=raw!==null&&raw>=0&&raw<=1?raw:null;
  out.phases.push({name:names[i],from:addDays(c.sowingDate,start),to:addDays(c.sowingDate,ends[i]-1),ky,etaMm:eta,etmMm:etm,ratio,factor:f});
  if(f===null)out.missing.push(`${names[i]} : réponse non physique ou ET incompatible ; aucune valeur négative de grain n’est masquée.`);
  else factor*=f;
  if(ratio!==null&&ratio<.5)out.warnings.push(`${names[i]} : ETa/ETm inférieur à 0,5 ; forte extrapolation, résultat exploratoire.`);
  start=ends[i];
 }
 if(!out.missing.length)out.factor=factor;
 return out;
}
