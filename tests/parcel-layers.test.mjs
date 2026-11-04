import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {exampleCampaign} from '../lib/seasonal/example.ts';import {assessLandGeometry} from '../lib/seasonal/land.ts';import {COUNTRIES} from '../lib/seasonal/types.ts';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/parcel-layers.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic',loader:{'.css':'empty'}}),compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);const Layers=compiled.exports.default;
const shape={type:'Polygon',coordinates:[[[1,8],[1.002,8],[1.002,8.002],[1,8.002],[1,8]]]};
const cell=value=>({id:'worldcover',status:'available',provider:'Synthetic test',product:'Test land',version:'test',referencePeriod:null,observedAt:'2026-10-01',acquiredAt:'2026-10-02',resolutionM:10,crs:'EPSG:4326',cells:[{id:'one',geometry:shape,value}],reason:null,assets:[],limitations:[]});
test('water is visible as water in each country, native sources and area stay explicit',()=>{
 for(const country of Object.keys(COUNTRIES)){
  const config={...exampleCampaign('2026-11-02'),country,parcelGeometry:shape},assessment=assessLandGeometry(shape,[cell(80)]);
  const html=renderToStaticMarkup(React.createElement(Layers,{config,assessment,onMap:()=>{}}));
  assert.match(html,/Eau permanente · 100 %/);assert.match(html,/Terre potentielle · 0 %/);assert.match(html,/#3679c2/);assert.match(html,/Test land/);assert.match(html,/Stress possible/);assert.doesNotMatch(html,/class="parcel-raster-image"/,'external images require visitor action');
 }
});
test('unknown areas remain hatched, old geometry does not color a new field as known land',()=>{
 const config={...exampleCampaign('2026-11-02'),parcelGeometry:shape};const old={...shape,coordinates:[[[2,8],[2.002,8],[2.002,8.002],[2,8.002],[2,8]]]};
 const html=renderToStaticMarkup(React.createElement(Layers,{config,assessment:assessLandGeometry(old,[{...cell(40),cells:[{id:'other',geometry:old,value:40}]}]),onMap:()=>{}}));
 assert.match(html,/Analyse terre\/eau en préparation/);assert.match(html,/<pattern/);assert.doesNotMatch(html,/Terre potentielle · 100 %/);
});
