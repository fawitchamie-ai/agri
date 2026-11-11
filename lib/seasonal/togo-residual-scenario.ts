import {canReplayTogoStages,togoStageReplayInput} from './togo-stage-replay.ts';
import {InputError,addDays} from './validation.ts';
import type {SeasonalConfig} from './types.ts';
import profile from './profiles/togo-residual-v1.json' with {type:'json'};
/** Local retrospective scenario only. This changes reconstructed forcing,
 * not NASA observations or country defaults. Never mutate the caller. */
export function togoResidualScenario(input:SeasonalConfig):SeasonalConfig{
 if(!canReplayTogoStages(input))throw new InputError('Scénario résiduel limité au rejeu togolais documenté.');
 const c=structuredClone(input);
 if(c.stages.length!==4||c.stages.some((s,i)=>s.days!==profile.stageDays[i]))throw new InputError('Découpage incompatible avec le tableau 4.');
 const weather=new Map(c.weather.map(w=>[w.date,w]));let offset=0;
 for(const [j,s]of c.stages.entries()){
  const rows=Array.from({length:s.days},(_,i)=>weather.get(addDays(c.sowingDate,offset+i)));
  if(rows.some(w=>!w||w.et0Mm===null||!Number.isFinite(w.et0Mm)))throw new InputError('Météo quotidienne complète requise pour le scénario publié.');
  const demand=rows.reduce((n,w,i)=>n+w!.et0Mm!*(s.kcStart+(s.kcEnd-s.kcStart)*i/(s.days-1)),0);
  if(!(demand>0))throw new InputError('Demande positive requise pour le scénario publié.');
  for(const w of rows){w!.et0Mm!*=profile.publishedDemandMm[j]/demand;w!.source+=' ; reconstitution ET0 redimensionnée pour retrouver ETc du tableau 4, pas météo mesurée';}
  offset+=s.days;
 }
 c.system.applicationEfficiency=profile.effectiveEfficiency;
 c.system.source='Efficacité effective ajustée sur FI + 80%, non mesurée ; confondue avec le calendrier inconnu.';
 c.yieldEstimation=togoStageReplayInput(c);
 for(const unit of c.yieldEstimation.units){unit.reference!.kgHa=profile.capacityKgHa;unit.reference!.source='Profil '+profile.id+' : capacité FI, efficacité effective FI + 80%, ETc tableau 4.';unit.reference!.context='Évaluation interne sur 60% déjà connu historiquement ; aucune validation indépendante. Ne prédit pas biomasse/couvert/NPK.';}
 return c;
}
