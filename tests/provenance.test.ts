import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCampaign,exampleCampaign} from '../lib/seasonal/example.ts';
import {automaticCampaign,mergeEnvironment} from '../lib/seasonal/automatic.ts';
import {migrateInputs,reconcileInputs,declareScenario,valueEvidence,scopeId,environmentContext} from '../lib/seasonal/provenance.ts';
import {planWater} from '../lib/seasonal/engine.ts';
import {loadEnvironment,type Environment} from '../lib/seasonal/environment.ts';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
const now='2026-10-31T08:00:00Z';
function environment(c:ReturnType<typeof emptyCampaign>,fc=.24):Environment {
 const id=c.inputs!.scope.id;
 return {scope:{id,geometry:c.parcelGeometry??null},context:environmentContext(c),soil:{ph:6.3,organicC:10,totalN:1,cec:12,sand:60,clay:20,source:'ISRIC SoilGrids',depth:'5–15 cm',resolutionM:250,retrievedAt:now,
 hydraulicLayers:[{thicknessM:1.2,thetaFC:fc,thetaWP:.11,initialTheta:.11+.6*(fc-.11)}],provenance:{ph:valueEvidence(6.3,'pH',id,{origin:'automatic',status:'estimated',rawValue:63,rawUnit:'pH × 10',acquiredAt:now,provider:'ISRIC',product:'SoilGrids',productVersion:'2.0',depthCm:[5,15]})}},weather:[],temperatures:[],warnings:[],retrievedAt:now,historicalYears:'2023–2025'};
}
test('Migration : valeurs anciennes conservées, dates de téléchargement jamais promues en mesures',()=>{
 const old=exampleCampaign('2026-10-31');delete old.inputPolicy;
 old.soilAnalyses=[{source:'ISRIC SoilGrids old label',date:'2026-10-30',availableOn:'2026-10-30',topCm:5,bottomCm:15,status:'estimated',measurements:[{parameter:'pH',value:6,unit:'pH',method:'water'}]}];
 const archived=JSON.stringify(old),c=migrateInputs(old);assert.equal(JSON.stringify(old),archived);assert.equal(c.soil.layers[0].thetaFC,.3);assert.equal(c.soilAnalyses![0].date,null);assert.equal(c.inputs!.values['soilAnalyses.0.measurements.0.value'].observedAt,null);assert.equal(c.inputs!.values['soilAnalyses.0.measurements.0.value'].acquiredAt,null);assert.equal(c.inputPolicy!.allowAssumptions,false);
 assert.deepEqual(migrateInputs(c),c);
});
test('Rafraîchissement : estimations hydriques remplacées sans dépendre d’un libellé',()=>{
 let c=automaticCampaign(emptyCampaign('2026-10-31'));c=mergeEnvironment(c,environment(c));
 assert.equal(c.soil.layers[0].thetaFC,.24);c.soil.source='Une étiquette quelconque';
 c=mergeEnvironment(c,environment(c,.35));assert.equal(c.soil.layers[0].thetaFC,.35);assert.equal(c.soilAnalyses![0].date,null);
});
test('Perte de source : effacement automatique, conservation ancienne uniquement après choix explicite',()=>{
 let c=automaticCampaign(emptyCampaign('2026-10-31'));c=mergeEnvironment(c,environment(c));
 const failed={...environment(c),soil:{...environment(c).soil,ph:null,hydraulicLayers:undefined,provenance:{}}};
 const missing=mergeEnvironment(c,failed);assert.equal(missing.soilAnalyses!.flatMap(a=>a.measurements).some(m=>m.parameter==='pH'),false);assert.equal(missing.inputs!.values['soil.layers.0.thetaFC'].status,'missing');assert.equal(planWater({...missing,inputPolicy:{allowAssumptions:true,allowStale:false}}).status,'blocked');
 const retained=mergeEnvironment({...c,inputPolicy:{allowAssumptions:true,allowStale:true}},failed);
 assert.equal(retained.soilAnalyses!.flatMap(a=>a.measurements).find(m=>m.parameter==='pH')!.value,6.3);
 assert.equal(retained.inputs!.values['soilAnalyses.1.measurements.0.value'].retention,'stale_authorized');assert.equal(retained.inputs!.values['soil.layers.0.thetaFC'].retention,'stale_authorized');assert.equal(retained.inputs!.values['soil.layers.0.thetaFC'].acquiredAt,now);
});
test('Mesures et saisies : priorité au champ et modifications limitées aux valeurs changées',()=>{
 let c=automaticCampaign(emptyCampaign('2026-10-31'));c=mergeEnvironment(c,environment(c));
 const modified=reconcileInputs(c,{...c,soil:{...c.soil,layers:c.soil.layers.map(l=>({...l,thetaFC:.4}))}},now);
 const refreshed=mergeEnvironment(modified,environment(modified,.35));assert.equal(refreshed.soil.layers[0].thetaFC,.4);assert.equal(refreshed.inputs!.values['soil.layers.0.thetaFC'].origin,'manual');
 const same=reconcileInputs(modified,{...modified,name:'Champ renommé'},now);assert.deepEqual(same.inputs!.values['soil.layers.0.thetaFC'],modified.inputs!.values['soil.layers.0.thetaFC']);
});
test('Contour et contexte : invalider l’ancien sol et ignorer les réponses tardives',()=>{
 let c=automaticCampaign({...emptyCampaign('2026-10-31'),parcelGeometry:testParcel});c=migrateInputs(c);
 const e=environment(c);const different={...testParcel,coordinates:testParcel.coordinates.map(r=>r.map(([x,y]:number[])=>[x+.01,y] as [number,number]))};
 const next=reconcileInputs(c,{...c,parcelGeometry:different});assert.equal(next.soilAnalyses!.length,0);assert.equal(next.weather.length,0);assert.equal(next.landAssessment,undefined);assert.equal(next.inputPolicy!.allowAssumptions,false);
 assert.deepEqual(mergeEnvironment(next,e),next);
 const shifted={...c,sowingDate:'2026-11-01'};assert.deepEqual(mergeEnvironment(shifted,e),migrateInputs(shifted));
});
test('Hypothèses : acceptance explicite, seuils affichables et contrôle géographique non contourné',()=>{
 let c=automaticCampaign({...emptyCampaign('2026-10-31'),parcelGeometry:testParcel});c.landAssessment=landFixture(testParcel,80);
 const accepted=declareScenario(c,now);assert.equal(accepted.inputPolicy!.allowAssumptions,true);assert.equal(accepted.soil.infiltrationMmDay,30);assert.equal(accepted.system.applicationEfficiency,.75);
 assert.match(planWater(accepted).missing[0],/eau permanente|incompatible/);
});
