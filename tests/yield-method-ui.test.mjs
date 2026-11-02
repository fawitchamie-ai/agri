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
test('water-response method is visible and opens reference documentation without inventing independent Ym',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let config=applyCropProfile(exampleCampaign('2026-11-01'),'maize');
 const render=()=>root.render(React.createElement(compiled.exports.default,{config,plan:null,stale:false,onChange:next=>{config=next;render();}}));
 try{
  await act(async()=>render());
  const select=host.querySelector('select');assert.ok(select);assert.equal(select.closest('details'),null);
  assert.match(host.textContent,/modifier l’arrosage ne change pas/);
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(select,'fao-seasonal');select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.equal(config.yieldEstimation.method,'fao-seasonal');
  assert.equal(config.yieldEstimation.units[0].reference,null);
  const checkbox=host.querySelector('input[type=checkbox]');assert.ok(checkbox);assert.equal(checkbox.checked,false);assert.equal(checkbox.closest('details').open,true);
  assert.match(host.textContent,/Un apport supplémentaire peut ne rien changer/);
 }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});
