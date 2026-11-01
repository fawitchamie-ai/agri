import type {SeasonalConfig,WaterPlan} from './types.ts';
/** UI state, no additional simulation or acceptance of assumptions. */
export function waterIndicator(c:SeasonalConfig,plan:WaterPlan|null,stale=false,loading=false){
 const needsAcceptance=!c.inputPolicy?.allowAssumptions&&Object.values(c.inputs?.values??{}).some(v=>v.status==='assumed');
 if(needsAcceptance)return {kind:'assumptions' as const,percent:null,message:'Le bilan d’eau attend votre accord sur les hypothèses de sol, de réserve initiale et d’irrigation.'};
 if(stale||loading)return {kind:'computing' as const,percent:null,message:'Recalcul du bilan d’eau en cours.'};
 if(!plan||plan.status==='blocked'||!plan.complete||!plan.days.length)return {kind:'missing' as const,percent:null,message:plan?.missing[0]??'Complétez les données requises pour calculer le bilan d’eau.'};
 if(!(plan.totals.demandMm>0))return {kind:'missing' as const,percent:null,message:'La demande en eau du cycle est nulle ou inconnue ; aucun pourcentage déduit.'};
 return {kind:'ready' as const,percent:Math.round(100*plan.totals.actualEtMm/plan.totals.demandMm),message:'Consommation satisfaite après les arrosages proposés, sous les hypothèses affichées.'};
}
