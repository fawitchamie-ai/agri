import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import React,{act} from 'react';import {Window} from 'happy-dom';
import {fixture} from './support/field-trial-fixture.ts';
import {fertilizerScope,fertilizerScenario} from '../lib/seasonal/fertilizer-scenario.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const b=await build({entryPoints:['components/agri/fertilizer-simulator.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),m={exports:{}};
new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const Component=m.exports.default;
test('actual simulator UI leaves ceiling empty, labels transfer, hides stale outcomes and invalidates changed scope',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let config=fixture(),plan=null,stale=false;
 const render=()=>act(async()=>root.render(React.createElement(Component,{config,plan,stale,onChange:c=>{config=c;},onAdvanced:()=>{}})));
 try{
  await render();assert.equal(host.querySelector('input[type=number]').value,'');assert.match(host.textContent,/transférés du Nigeria/);
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Calculer avec mes apports').click());assert.match(host.querySelector('[role=alert]').textContent,/Acceptez/);assert.equal(config.fertilizerScenario,undefined);
  config.waterCondition='drained';config.fertilizerScenario={version:'quefts-scenario-1',scope:fertilizerScope(config),acceptedTransfer:true,ceilingKgHa:6000,ceilingSource:'Synthetic UI fixture',availableOn:config.asOfDate,control:null};
  plan={fertilizerScenario:fertilizerScenario(config,{})};await render();assert.match(host.textContent,/Sans nouvel apport prévu/);assert.match(host.textContent,/pas un intervalle de confiance/);
  stale=true;await render();assert.doesNotMatch(host.textContent,/Sans nouvel apport prévu/);assert.match(host.textContent,/Recalcul/);
  stale=false;config={...config,variety:'Different context'};await render();assert.doesNotMatch(host.textContent,/Sans nouvel apport prévu/);assert.match(host.textContent,/contexte a changé/);
  config={...config,cropProfile:{...config.cropProfile,id:'sorghum'}};await render();assert.doesNotMatch(host.textContent,/Calculer avec mes apports/);assert.match(host.textContent,/autres cultures restent à qualifier/);
 }finally{await act(async()=>root.unmount());host.remove();await window.happyDOM.close();}
});
