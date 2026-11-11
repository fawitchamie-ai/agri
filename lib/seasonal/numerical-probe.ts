import {planWater} from './engine.ts';
import {exampleCampaign} from './example.ts';
import {biomassFromTranspiration,GROWTH_ENGINE_VERSION} from './growth.ts';
import {ENGINE_VERSION} from './types.ts';
import {canopyNowcast,canopyNowcastScope,CANOPY_NOWCAST_VERSION} from './canopy-nowcast.ts';
/** Read-only, deterministic software probes, no field data or persistence.
 * Public checks establish which equations actually execute, NOT crop accuracy. */
export function numericalProbe(){
 const c=exampleCampaign('2026-01-01');c.asOfDate='2026-01-01';c.stages=[{name:'Probe',days:1,kcStart:.6,kcEnd:.6,rootStartM:1,rootEndM:1,depletionFraction:.5}];
 c.soil.layers=[{thicknessM:1,thetaFC:.3,thetaWP:.15,initialTheta:.3}];c.system.sourceBudgetM3=0;
 c.waterModel={version:'fao56-dual-1',source:'Deterministic software probe, not field observations',availableOn:c.asOfDate,totalEvaporableMm:20,readilyEvaporableMm:8,initialDepletionMm:20,wettedFraction:.3,kcMax:1.25,stages:[{kcbStart:.6,kcbEnd:.6,coverStart:.6,coverEnd:.6}]};
 const p=planWater(c),d=p.days[0],tr=d?.dualKc?.transpirationMm,evap=d?.dualKc?.evaporationMm;
 if(!p.complete||tr!==3||evap!==0||Math.abs(d.balanceResidualMm)>1e-8)throw new Error('Échec du contrôle numérique évaporation/transpiration.');
 const biomassKgHa=biomassFromTranspiration(25,tr,5);if(biomassKgHa!==150)throw new Error('Échec du contrôle numérique de biomasse.');
 const recharge=exampleCampaign('2026-01-01');recharge.asOfDate='2026-01-02';recharge.system.sourceBudgetM3=0;
 recharge.soilWaterModel={version:'profile-recharge-1',usage:'diagnostic',acceptedHypothesis:true,source:'Software conservation fixture, not an accepted forecast profile',availableOn:'2026-01-01'};
 recharge.stages=[{name:'Root expansion probe',days:2,kcStart:0,kcEnd:0,rootStartM:.1,rootEndM:.5,depletionFraction:.5}];
 recharge.soil.layers=[.1,.4,.5].map(thicknessM=>({thicknessM,thetaFC:.3,thetaWP:.15,initialTheta:.15}));
 recharge.fallback={label:'Zero ET conservation fixture',et0MmDay:0,rainMmDay:0};recharge.weather=[];
 const rp=planWater(recharge,[{id:'pulse',date:'2026-01-01',kind:'irrigation',amount:60,unit:'mm',point:'net',status:'measured',source:'Synthetic software test',recordedAt:'2026-01-01T00:00:00Z'}]);
 const gain=rp.days[1]?.rootGainMm;
 if(!rp.complete||Math.abs(gain-45)>1e-8||Math.abs(rp.days[1].stockEndMm-60)>1e-8||rp.days.some(d=>Math.abs(d.profileBalanceResidualMm!)>1e-8))throw new Error('Échec du contrôle de recharge sous les racines.');
 const nc=exampleCampaign('2026-09-01');nc.country='GHA';nc.latitude=9.5;nc.longitude=-.5;nc.waterCondition='drained';nc.cropProfile={id:'maize',version:'probe',mode:'reference'};nc.asOfDate='2026-11-11';
 nc.canopyNowcast={version:'canopy-nowcast-1',acceptedHypothesis:true,scope:canopyNowcastScope(nc),monitoringStart:'2026-10-28',initialStage:'vegetative',observations:[{date:'2026-10-28',availableOn:'2026-10-28',laiSamples:[1,1,1],source:'Synthetic LAI fixture',method:'field-green-lai'},{date:'2026-11-04',availableOn:'2026-11-04',laiSamples:[1.5,1.5,1.5],source:'Synthetic LAI fixture',method:'field-green-lai'}]};
 const nr=canopyNowcast(nc,p);if(nr.status!=='experimental_nowcast'||!Number.isFinite(nr.yieldKgHa))throw new Error('Échec de la sonde du suivi LAI.');
 return {engine:GROWTH_ENGINE_VERSION,waterEngine:ENGINE_VERSION,transpirationMm:tr,evaporationMm:evap,biomassKgHa,status:'pass',
  profileRecharge:{initialPulseMm:60,waterEncounteredByNewRootsMm:gain,stockAfterRootExpansionMm:rp.days[1].stockEndMm,deepDrainageMm:rp.days[0].deepDrainageMm},
  canopyNowcast:{version:CANOPY_NOWCAST_VERSION,peakLai:1.5,yieldKgHa:nr.yieldKgHa,scope:'synthetic field-state check; no observed farm prediction'},
  scope:'Deterministic numerical checks only; no authenticated user journey or field-accuracy claim'};
}
