/** Reduced, explicit canopy hypothesis, NOT the complete AquaCrop model.
 * Sources: FAO AquaCrop calculation scheme / reference manual ch.3;
 * official v7.3_typofix CalculateETpot (micro-advection polynomial).
 * Expansion uses a continuous two-branch exponential; depletion slows expansion
 * and can cause irreversible early senescence. Parameters are profile-specific.
 * Root/thermal/fertility feedbacks and reproductive HI are not inferred here.
 */
export type CanopyDynamics={
 version:'canopy-state-1';source:string;availableOn:string;
 initialCover:number;maxCover:number;emergenceDay:number;senescenceDay:number;
 growthRateDay:number;declineRateDay:number;
 expansionLower:number;expansionUpper:number;senescenceThreshold:number;
 stressDeclineRateDay:number;
};
export type CanopyState={cover:number;senescenceAge:number;coverAtSenescence:number|null};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function adjustedGreenCover(cc:number){const c=clamp(cc);return clamp(1.72*c-c*c+.30*c*c*c);}
export function expansionFactor(depletionFraction:number,p:CanopyDynamics){return clamp((p.expansionUpper-depletionFraction)/(p.expansionUpper-p.expansionLower));}
export function advanceCanopy(previous:CanopyState,dap:number,depletionFraction:number,p:CanopyDynamics,observation?:number):CanopyState{
 if(dap<p.emergenceDay)return {cover:observation??0,senescenceAge:0,coverAtSenescence:null};
 let cover=previous.cover;
 if(dap===p.emergenceDay&&cover===0)cover=p.initialCover;
 let senescenceAge=previous.senescenceAge,coverAtSenescence=previous.coverAtSenescence;
 if(dap<p.senescenceDay){
  if(cover>0&&cover<p.maxCover){
   // Inverse of the two exponential branches, then advance the effective clock.
   const half=p.maxCover/2;
   const age=cover<=half?Math.log(cover/p.initialCover)/p.growthRateDay:
    Math.log(.25*p.maxCover*p.maxCover/(p.initialCover*Math.max(1e-12,p.maxCover-cover)))/p.growthRateDay;
   const t=age+expansionFactor(depletionFraction,p),early=p.initialCover*Math.exp(p.growthRateDay*t);
   cover=early<=half?early:p.maxCover-.25*p.maxCover*p.maxCover/p.initialCover*Math.exp(-p.growthRateDay*t);
  }
 }else{
  coverAtSenescence??=cover;senescenceAge++;
  const rate=3.33*p.declineRateDay/(p.maxCover+2.29);
  const loss=.05*coverAtSenescence*(Math.exp(rate*senescenceAge)-Math.exp(rate*(senescenceAge-1)));
  cover=Math.max(0,cover-loss);
 }
 const severe=clamp((depletionFraction-p.senescenceThreshold)/(1-p.senescenceThreshold));
 cover*=Math.exp(-p.stressDeclineRateDay*severe);
 if(observation!==undefined){cover=observation;if(dap>=p.senescenceDay){senescenceAge=0;coverAtSenescence=cover;}}
 // A qualified observation can exceed an assumed profile maximum; retain it,
 // rather than silently truncating a measurement to the model assumption.
 return {cover:clamp(cover),senescenceAge,coverAtSenescence};
}
