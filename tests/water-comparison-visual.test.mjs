import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/water-impact-summary.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const Component=module.exports.default;
const plan={waterImpact:{method:'seasonal',status:'conditional',missing:[],version:'test',source:'https://example.test',areaBasis:'planned',areaM2:null,scenarios:[
 {id:'rainfed',label:'Sans arrosage ajouté',relativeYieldPercent:65,deltaPointsVsRainfed:0,etaMm:130,etmMm:200,missing:[]},
 {id:'recorded',label:'Avec apports réalisés',relativeYieldPercent:null,deltaPointsVsRainfed:null,etaMm:null,etmMm:null,missing:['Données manquantes']},
 {id:'proposed',label:'Avec plan proposé',relativeYieldPercent:82.5,deltaPointsVsRainfed:17.5,etaMm:165,etmMm:200,missing:[]},
]}};
test('comparison renders calculated scores and reports an unavailable scenario without inventing zero',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,{plan,stale:false}));
 assert.match(html,/Score hydrique selon le scénario/);
 assert.match(html,/65 \/ 100/);assert.match(html,/82,5 \/ 100/);
 assert.match(html,/Non calculable/);assert.match(html,/Données manquantes/);
 assert.doesNotMatch(html,/water-comparison-bar water-comparison-recorded/);
 assert.match(html,/ne représentent pas des tonnes récoltées/);
});
test('stale comparison does not expose scores from the previous calculation',()=>{
 const html=renderToStaticMarkup(React.createElement(Component,{plan,stale:true}));
 assert.match(html,/Recalcul de l’effet hydrique/);
 assert.doesNotMatch(html,/Score hydrique selon le scénario|82,5/);
});
