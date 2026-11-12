import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {exampleCampaign} from '../lib/seasonal/example.ts';

const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const bundle=await wr('esbuild').build({entryPoints:['components/agri/quick-simulation.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const parcelBundle=await wr('esbuild').build({entryPoints:['components/agri/parcel-explorer.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic',plugins:[{name:'parcel-map-test-stub',setup(b){b.onResolve({filter:/\.\/parcel-map$/},()=>({path:'parcel-map',namespace:'test-map'}));b.onLoad({filter:/.*/,namespace:'test-map'},()=>({contents:'export function countryBounds(){return []} export default function ParcelMap(){return null}',loader:'js'}));}}]});
const parcelCompiled={exports:{}};new Function('require','module','exports',parcelBundle.outputFiles[0].text)(require,parcelCompiled,parcelCompiled.exports);

test('campaign workspace exposes direct result destinations without a repeated instruction banner',async()=>{
 const config=exampleCampaign('2026-11-01');
 config.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let mapOpened=false;
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{config,plan:null,stale:false,onChange:()=>{},onMap:()=>{mapOpened=true;},onAdvanced:()=>{},onSave:()=>{},canSave:false,events:[],paused:true})));
  assert.equal(host.querySelector('[aria-label="Comment obtenir mes résultats"]'),null);
  assert.equal(host.querySelector('#field-tab-yield'),null,'technical tabs stay closed until requested');
  const details=[...host.querySelectorAll('button')].find(button=>/Voir les détails du rendement/.test(button.textContent));assert.ok(details);
  await act(async()=>details.click());
  const tabs=['yield','water','fertilizer','images','settings'];
  for(const id of tabs){const tab=host.querySelector('#field-tab-'+id);assert.ok(tab,`Onglet ${id} présent`);await act(async()=>tab.click());assert.equal(tab.getAttribute('aria-selected'),'true');}
  assert.match(host.textContent,/Rendement & production/);
  assert.match(host.querySelector('#field-tab-water').textContent,/Eau/);
  assert.equal(mapOpened,false,'the result workspace does not navigate away from the campaign');
  const parcelConfig=exampleCampaign('2026-11-01');parcelConfig.parcelGeometry=null;parcelConfig.areaM2=null;
  const parcelHtml=renderToStaticMarkup(React.createElement(parcelCompiled.exports.default,{config:parcelConfig,plan:null,locked:false,canSearch:false,onParcel:()=>{},onPrepare:()=>{},onScenario:()=>{},onCalendar:()=>{},onName:()=>{},onDirty:()=>{},onWaterCondition:()=>{}}));
  assert.match(parcelHtml,/aria-current="step" class="current"><b>01<\/b><span>Parcelle<\/span>/,'the active parcel step is announced to assistive technology');
 }finally{await act(async()=>root.unmount());host.remove();await window.happyDOM.close();}
});
