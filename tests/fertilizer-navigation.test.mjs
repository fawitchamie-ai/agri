import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';

const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const bundle=await wr('esbuild').build({entryPoints:['components/agri/quick-simulation.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);

test('fertilizer scenario returns to the product editor instead of sowing dates',async()=>{
 const config=applyCropProfile(exampleCampaign('2026-11-01'),'maize');
 config.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),advanced=[];
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({});
 const find=(pattern)=>[...host.querySelectorAll('button')].find(b=>pattern.test(b.textContent));
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{config,plan:null,stale:false,onChange:()=>{},onMap:()=>{},onAdvanced:v=>advanced.push(v),onSave:()=>{},canSave:false,events:[],paused:true})));
  const detail=find(/Pourquoi pas de rendement/);assert.ok(detail);await act(async()=>detail.click());
  await act(async()=>host.querySelector('#field-tab-fertilizer').click());
  const effect=find(/2\. Effet sur le rendement/);assert.ok(effect);await act(async()=>effect.click());
  const edit=find(/Renseigner ou modifier mes produits et doses/);assert.ok(edit);await act(async()=>edit.click());
  assert.equal(find(/1\. Mes apports/).getAttribute('aria-pressed'),'true');
  assert.ok(host.querySelector('.fertilizer-next'),'the product editor is visible');
  assert.deepEqual(advanced,[],'the action must not navigate to Dates de semis');
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=oldFetch;await window.happyDOM.close();}
});
