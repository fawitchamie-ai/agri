// Reproduction with the three facts reported by the user only: country,
// crop/date and approximate contour area. Geometry and terrain class below are
// synthetic technical fixtures, not the user's parcel or soil observations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Window} from 'happy-dom';
import {emptyCampaign,exampleCampaign} from '../lib/seasonal/example.ts';
import {automaticCampaign} from '../lib/seasonal/automatic.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {geometryIdentity} from '../lib/seasonal/provenance.ts';
import {landFixture} from './support/land-fixtures.mjs';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const b=await build({entryPoints:['components/agri/field-workspace.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const moduleObject={exports:{}};
new Function('require','module','exports',b.outputFiles[0].text)(require,moduleObject,moduleObject.exports);
const {FieldOverview}=moduleObject.exports;

function reproduction(){
 const shape=d=>({type:'Polygon',coordinates:[[[1,8],[1+d,8],[1+d,8+d],[1,8+d],[1,8]]]});
 let low=0,high=.01;
 for(let i=0;i<35;i++){const middle=(low+high)/2;if(parcelMetrics(shape(middle)).areaM2>39820)high=middle;else low=middle;}
 const geometry=shape((low+high)/2),c=automaticCampaign(emptyCampaign('2026-11-12'),'maize','2026-11-12');
 c.country='TGO';c.name='Mon champ';c.parcelGeometry=geometry;c.areaM2=parcelMetrics(geometry).areaM2;
 // A synthetic land result permits the calculation to reach its usual
 // preparation gate. No rainfall, soil measurement or yield is supplied.
 c.landAssessment=landFixture(geometry);
 return c;
}

test('3.982 ha maize reproduction keeps missing evidence and never invents production',()=>{
 const c=reproduction();assert.ok(Math.abs(c.areaM2-39820)<.01);assert.equal(c.crop,'Maïs');
 const p=planSeason(c,[],{requireGeometry:true});
 assert.equal(p.status,'blocked');assert.match(p.missing.join(' '),/hypothétiques.*acceptés explicitement/i);
 assert.ok(!p.yieldEstimation||p.yieldEstimation.scenarios.every(s=>s.totals===null),'a national statistic cannot become a parcel harvest');
 assert.ok(!p.growth||p.growth.status==='unavailable','the absence of evidence cannot produce a growth estimate');
});

test('campaign summary exposes actual missing assumptions without claiming everything was completed',()=>{
 const c=reproduction(),p=planSeason(c,[],{requireGeometry:true});
 const html=renderToStaticMarkup(React.createElement(FieldOverview,{config:c,plan:p,events:[],stale:false,loading:false,simple:true,onAction:()=>{}}));
 const window=new Window(),document=window.document;document.body.innerHTML=html;
 const summary=document.querySelector('[aria-label="Résultat de la campagne"]');assert.ok(summary);
 assert.doesNotMatch(summary.textContent,/Vous n’avez rien oublié/i);
 assert.match(summary.textContent,/hypothèses|hypothétiques/i,'the real calculation blocker must be explained');
 window.happyDOM.close();
});

test('fully hypothetical FAO reference illustrates yield to total conversion on 3.982 ha',()=>{
 const geometry=reproduction().parcelGeometry;
 const c=applyCropProfile(exampleCampaign('2026-11-12'),'maize');
 c.parcelGeometry=geometry;c.areaM2=parcelMetrics(geometry).areaM2;c.landAssessment=landFixture(geometry);
 c.waterCondition='drained';c.fallback={label:'Pluie entièrement hypothétique, test uniquement',et0MmDay:4,rainMmDay:5};
 c.yieldEstimation={version:'yield-input-1',method:'fao-seasonal',areaBasis:'planned',scopeGeometryId:geometryIdentity(geometry),homogeneityAssumption:'Hypothèse fictive de parcelle homogène pour test uniquement',units:[{id:'field',sownAreaM2:c.landAssessment.candidateAreaM2,harvestedAreaM2:null,areaSource:'Hypothèse fictive : 3,982 ha prévus',reference:{kind:'scenario',kgHa:4000,denominator:'sown',source:'Valeur hypothétique pour test ; aucune mesure réelle',availableOn:c.asOfDate,context:'Test informatique ; ne correspond pas au champ utilisateur',cropId:'maize',independentYm:true}}]};
 const estimate=planSeason(c).yieldEstimation,scenario=estimate.scenarios.find(s=>s.id==='rainfed');
 assert.equal(scenario.status,'conditional');assert.ok(scenario.totals);
 assert.ok(Math.abs(scenario.totals.yieldKgHaSown/1000-4)<1e-8);
 assert.ok(Math.abs(scenario.totals.productionKg/1000-15.928)<.0001);
 assert.ok(Math.abs(scenario.totals.productionKg/1000-(scenario.totals.yieldKgHaSown/1000)*(c.landAssessment.candidateAreaM2/10000))<1e-8);
});
