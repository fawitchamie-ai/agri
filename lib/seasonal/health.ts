import {COUNTRIES} from './types.ts';
import {YIELD_VERSION,SEASONAL_KY} from './yield.ts';
import {NASA_VERSION} from './nasa.ts';
import {SALINITY_VERSION} from './salinity.ts';
import {historicalContext} from './historical-context.ts';
import {encodeCampaignValue,decodeCampaignValue} from './storage.ts';
import {planWater} from './engine.ts';
import {exampleCampaign} from './example.ts';
import {biomassFromTranspiration,GROWTH_ENGINE_VERSION} from './growth.ts';
/** Read-only, one-day synthetic conformance scenario; no user data or storage writes. */
export function numericalProbe(){
 const c=exampleCampaign('2026-01-01');c.asOfDate='2026-01-01';c.stages=[{name:'Probe',days:1,kcStart:.6,kcEnd:.6,rootStartM:1,rootEndM:1,depletionFraction:.5}];
 c.soil.layers=[{thicknessM:1,thetaFC:.3,thetaWP:.15,initialTheta:.3}];c.system.sourceBudgetM3=0;
 c.waterModel={version:'fao56-dual-1',source:'Deterministic software probe, not field observations',availableOn:c.asOfDate,totalEvaporableMm:20,readilyEvaporableMm:8,initialDepletionMm:20,wettedFraction:.3,kcMax:1.25,stages:[{kcbStart:.6,kcbEnd:.6,coverStart:.6,coverEnd:.6}]};
 const p=planWater(c),d=p.days[0],tr=d?.dualKc?.transpirationMm,evap=d?.dualKc?.evaporationMm;
 if(!p.complete||tr!==3||evap!==0||Math.abs(d.balanceResidualMm)>1e-8)throw new Error('Échec du contrôle numérique évaporation/transpiration.');
 const biomassKgHa=biomassFromTranspiration(25,tr,5);if(biomassKgHa!==150)throw new Error('Échec du contrôle numérique de biomasse.');
 return {engine:GROWTH_ENGINE_VERSION,transpirationMm:tr,evaporationMm:evap,biomassKgHa,status:'pass',scope:'one-day synthetic numerical check, not crop accuracy'};
}
export function seasonalHealth(){
 const reference=Object.keys(COUNTRIES).map(c=>historicalContext(c as keyof typeof COUNTRIES,'maize',new Date().toISOString().slice(0,10)));
 if(reference.some(r=>r.status!=='context_only'||!r.rows.length))throw new Error('Référence nationale saisonnière absente.');
 const sample='probe'.repeat(25000),packed=encodeCampaignValue({sample});
 if(decodeCampaignValue(packed).sample!==sample)throw new Error('Codec de sauvegarde saisonnière indisponible.');
 return {version:'source-models-2026-10-31',numericalProbe:numericalProbe(),yield:YIELD_VERSION,nasa:NASA_VERSION,salinity:SALINITY_VERSION,kyCrops:Object.keys(SEASONAL_KY).length,nationalCountries:reference.length,nationalVersion:reference[0].version,nationalArchiveSha256:reference[0].archiveSha256,storage:'ok'};
}
