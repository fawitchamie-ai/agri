import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {exampleCampaign} from '../lib/seasonal/example.ts';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/agronomist-brief.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const AgronomistBrief=compiled.exports.default;

function fixture(){
 const config=exampleCampaign();
 config.yieldScenario='recorded';
 const scenario={id:'recorded',label:'Apports réalisés uniquement',biomassKgHa:4500,yieldKgHa:2100,productionKg:2100,days:[
  {stage:'Levée',date:'2026-06-02',biomassKgHa:1000,canopyCoverFraction:.25,canopyCoverSource:'profile'},
  {stage:'Floraison',date:'2026-07-02',biomassKgHa:4500,canopyCoverFraction:.7,canopyCoverSource:'simulated'},
 ],diagnostics:{waterLimitedDays:3,nutrientLimitedDays:[1,0,2]}};
 const plan={days:[],stages:[],totals:{demandMm:200,actualEtMm:160,unmetEtMm:40,rainRetainedMm:300,runoffMm:10,drainageMm:20,netMm:80},calculationArea:{areaM2:10000},engineVersion:'water-test-v1',status:'complete',complete:true,missing:[],assumptions:[],yieldEstimation:{method:'scenario-test',version:'yield-test-v1',limits:[]},automaticYield:{version:'automatic-indicative-yield-1',status:'ready',validated:false,profileId:'maize-rue-indicative-1',profileLabel:'Maïs grain · croissance RUE–NPK indicative',missing:[],assumptions:[],weather:{}},growth:{engineVersion:'daily-growth-process-1.5.0',status:'scenario',scenarios:[scenario]}};
 return {config,plan};
}

test('the detailed campaign view shows modeled biomass and cover by stage with their status',()=>{
 const {config,plan}=fixture();
 const html=renderToStaticMarkup(React.createElement(AgronomistBrief,{config,plan,events:[],stale:false,loading:false}));
 assert.match(html,/DÉTAILS AGRONOMIQUES · EXAMEN DE CAMPAGNE/);
 assert.match(html,/Biomasse aérienne sèche finale/);
 assert.match(html,/4,5 t\/ha/);
 assert.match(html,/Couvert vert/);
 assert.match(html,/Levée/);
 assert.match(html,/Floraison/);
 assert.match(html,/profil/);
 assert.match(html,/simulé/);
 assert.match(html,/aucune validation locale ni plage prédictive/);
 assert.match(html,/Méthode de rendement/);
 assert.match(html,/Maïs grain · croissance RUE–NPK indicative/);
 assert.match(html,/daily-growth-process-1\.5\.0 · maize-rue-indicative-1/);
 assert.match(html,/Simulation indicative active ; paramètres non calibrés localement/);
 assert.doesNotMatch(html,/Aucune méthode active/);
});

test('the detailed campaign view leaves biomass and cover blank when the model provides no growth output',()=>{
 const config=exampleCampaign();
 const html=renderToStaticMarkup(React.createElement(AgronomistBrief,{config,plan:null,events:[],stale:false,loading:false}));
 assert.match(html,/Biomasse et couvert non simulés/);
 assert.match(html,/Aucune valeur n’est déduite du rendement/);
 assert.doesNotMatch(html,/Biomasse aérienne sèche finale/);
 assert.match(html,/Aucune méthode active/);
});

test('the detailed campaign view identifies a blocked automatic profile without claiming it ran',()=>{
 const {config,plan}=fixture();
 plan.automaticYield={...plan.automaticYield,status:'blocked',missing:['Rayonnement solaire manquant.']};
 plan.growth={...plan.growth,status:'unavailable',missing:[],scenarios:[]};
 const html=renderToStaticMarkup(React.createElement(AgronomistBrief,{config,plan,events:[],stale:false,loading:false}));
 assert.match(html,/Maïs grain · croissance RUE–NPK indicative/);
 assert.match(html,/Profil non exécuté : Rayonnement solaire manquant/);
 assert.doesNotMatch(html,/Simulation indicative active/);
});
