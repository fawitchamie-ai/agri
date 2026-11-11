import profile from './profiles/togo-tzee-stage-replay.json' with {type:'json'};
import {geometryIdentity} from './provenance.ts';
import {waterStageScope} from './water-stages.ts';
import {InputError} from './validation.ts';
import type {SeasonalConfig} from './types.ts';
import type {YieldInput} from './yield.ts';
export const TOGO_STAGE_REPLAY_PROFILE=profile;
/** Deliberately confined to the original retrospective trial, not a country default. */
export function canReplayTogoStages(c:SeasonalConfig):boolean{
 if(c.country!==profile.country||c.cropProfile?.id!==profile.crop||!/^TZEE[ -]?W\b/i.test(c.variety??'')||c.sowingDate!==profile.sowingDate||c.stages.reduce((n,s)=>n+s.days,0)!==profile.cycleDays||c.asOfDate<profile.availableOn||!c.parcelGeometry)return false;
 const points=c.parcelGeometry.coordinates.flat();
 const x=points.reduce((n,p)=>n+p[0],0)/points.length,y=points.reduce((n,p)=>n+p[1],0)/points.length;
 const dx=(x-profile.site.longitude)*111.32*Math.cos(y*Math.PI/180),dy=(y-profile.site.latitude)*111.32;
 return Math.hypot(dx,dy)<=profile.site.radiusKm;
}
export function togoStageReplayInput(c:SeasonalConfig):YieldInput{
 if(!canReplayTogoStages(c))throw new InputError('Profil de rejeu limité au maïs TZEE-W, site de Dapaong, semis16/12/2017 et cycle111jours ; aucun transfert automatique.');
 const previous=c.yieldEstimation;
 if(previous&&previous.units.length!==1)throw new InputError('Le rejeu documentaire requiert une seule unité homogène.');
 return {version:'yield-input-1',method:'fao-stages',areaBasis:previous?.areaBasis??'planned',scopeGeometryId:geometryIdentity(c.parcelGeometry),
  responseCalendar:{version:'maize-water-stages-1',acceptedHypothesis:true,scope:waterStageScope(c),source:'Thèse de Gadédjisso-Tossou2020, pp99–100 ; découpage des phases explicite. '+profile.sources.calendar,availableOn:profile.availableOn,...profile.calendar},
  homogeneityAssumption:'Rejeu rétrospectif homogène, sans géométrie réelle des neuf parcelles expérimentales.',
  units:[{id:previous?.units[0].id??'champ',sownAreaM2:previous?.units[0].sownAreaM2??c.sowingPlan?.areaM2??c.landAssessment?.candidateAreaM2??null,harvestedAreaM2:null,
   ...(previous?.units[0].geometry?{geometry:previous.units[0].geometry}:{}),areaSource:'Surface de la simulation ; contour de démonstration distinct des parcelles expérimentales.',
   reference:{kind:'attainable',kgHa:profile.reference.capacityKgHa,denominator:'sown',cropId:'maize',availableOn:profile.availableOn,independentYm:true,moisturePercent:13,
    source:'Capacité effective ajustée sur FI seul ; 2200,4kg/ha ÷0,9954793044. '+profile.sources.trial,
    context:'Rejeu intra-essai2017–2018 ; référence disponible après récolte, indépendante des deux récoltes déficitaires pour cet ajustement. FI est un proxy de référence sans déficit, pas un potentiel physiologique. Grain à13% (hypothèse12–14%). Aucun usage en prévision avant campagne.'}}]};
}
