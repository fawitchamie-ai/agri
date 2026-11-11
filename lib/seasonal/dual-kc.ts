/** FAO56 ch.7/8, equations 69, 71, 74, 75, 80, 84.
 * https://www.fao.org/4/x0490e/x0490e0c.htm
 * Surface depletion tracks a sub-store, never an additional water input.
 * Explicit profiles only; previous single-Kc campaigns remain readable.
 */
import {adjustedGreenCover,type CanopyDynamics} from './canopy.ts';
export type DualKcInput={
 version:'fao56-dual-1';source:string;availableOn:string;
 readilyEvaporableMm:number;totalEvaporableMm:number;initialDepletionMm:number;
 wettedFraction:number;kcMax:number;
 stages:{kcbStart:number;kcbEnd:number;coverStart:number;coverEnd:number}[];
 /** Explicit alternative to a prescribed Kcb: the same cover drives Tr and Ke. */
 transpiration?:{method:'canopy-cover';maxCoefficient:number;source:string;availableOn:string};
 canopyDynamics?:CanopyDynamics;
 /** Hindcast/assimilation only; future observed cover is rejected. */
 observedCover?:{date:string;availableOn:string;cover:number;source:string}[];
};
const bound=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function dualCoefficients(p:DualKcInput,stageIndex:number,fraction:number,depletionMm:number,rainMm:number,irrigationNetMm:number,observedCover?:number){
 const stage=p.stages[stageIndex];
 const cover=observedCover??(stage.coverStart+(stage.coverEnd-stage.coverStart)*fraction);
 const kcb=p.transpiration?Math.min(p.kcMax,p.transpiration.maxCoefficient*adjustedGreenCover(cover)):
  stage.kcbStart+(stage.kcbEnd-stage.kcbStart)*fraction;
 const fw=rainMm>0?1:p.wettedFraction;
 const few=Math.max(1e-9,Math.min(1-cover,fw));
 const startDepletionMm=bound(depletionMm-rainMm-irrigationNetMm/fw,0,p.totalEvaporableMm);
 const kr=startDepletionMm<=p.readilyEvaporableMm?1:bound((p.totalEvaporableMm-startDepletionMm)/(p.totalEvaporableMm-p.readilyEvaporableMm),0,1);
 const ke=Math.max(0,Math.min(kr*(p.kcMax-kcb),few*p.kcMax));
 return {kcb,cover,few,ke,kr,startDepletionMm};
}
export function endSurfaceDepletion(p:DualKcInput,start:number,evaporationMm:number,few:number){return bound(start+evaporationMm/few,0,p.totalEvaporableMm);}
