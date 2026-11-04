import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/yield-summary.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
test('effects are the primary flow; arithmetic cannot be selected and references remain optional',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let config=applyCropProfile(exampleCampaign(),'maize'),opened=false,stale=false;
 const render=()=>root.render(React.createElement(compiled.exports.default,{config,plan:null,stale,onFertilizer:()=>{opened=true;},onChange:next=>{config=next;render();}}));
 try{
  await act(async()=>render());
  assert.equal(host.querySelector('option[value=declared-scenario]'),null);
  assert.match(host.textContent,/Aucun rendement à saisir/);assert.match(host.textContent,/Effet simulé des engrais/);
  const reference=host.querySelector('input[type=checkbox]');assert.ok(reference);assert.equal(reference.checked,false);
  assert.equal(reference.closest('details').open,false);
  const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Comparer avec et sans engrais'));
  await act(async()=>button.click());assert.equal(opened,true);
  stale=true;await act(async()=>render());assert.match(host.textContent,/Recalcul de l’effet hydrique/);
 }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});
