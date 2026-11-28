import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {automaticYieldFixture} from './support/automatic-yield-fixture.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
async function compile(path){const result=await build({entryPoints:[path],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports;}
const Panel=(await compile('components/agri/automatic-yield-panel.tsx')).default;
const {FieldOverview}=await compile('components/agri/field-workspace.tsx');
const Summary=(await compile('components/agri/yield-summary.tsx')).default;
test.after(()=>window.happyDOM.close());
test('confirming drainage and assumptions runs the real engine and shows the same harvest in both views',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let config=automaticYieldFixture(),plan,stale=false;config.waterCondition='unknown';config.inputPolicy.allowAssumptions=false;
 const onChange=next=>{config=next;render();};
 function render(){plan=planSeason(config);root.render(React.createElement(React.Fragment,null,
  React.createElement(Panel,{config,plan,stale,loading:false,onChange,onRefresh:()=>{},onConfigure:()=>{}}),
  React.createElement(FieldOverview,{config,plan,stale,loading:false,events:[],simple:true,onAction:()=>{}}),
  React.createElement(Summary,{config,plan,stale,onChange})
 ));}
 const click=async(label)=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>button.click());};
 const change=async(input,value)=>{assert.ok(input);await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});};
 try{
  await act(async()=>render());assert.equal(plan.automaticYield.status,'blocked');assert.equal(host.querySelector('.yield-overview-hero'),null);
  const drainage=host.querySelector('.automatic-yield-drainage input');await act(async()=>drainage.click());
  await click('Lancer la simulation indicative avec ces hypothèses');
  assert.equal(plan.automaticYield.status,'ready');const original=plan.growth.scenarios.find(s=>s.id==='recorded');
  const expected=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(original.yieldKgHa/1000);
  assert.ok(host.querySelector('#farmer-harvest-card .farmer-harvest-values').textContent.includes(expected));
  assert.ok(host.querySelector('.yield-overview-hero').textContent.includes(expected));
  assert.match(host.querySelector('.yield-overview-hero').textContent,/tonnes/);assert.match(host.textContent,/sans validation prédictive locale/);
  const soilForm=host.querySelector('.automatic-yield-panel details details');
  const inputs=[...soilForm.querySelectorAll('input')];
  assert.ok(inputs.every(input=>input.value===''),'Generic assumptions do not prefill fields for declared supplies');
  await click('Appliquer les fournitures N/P/K au calcul');
  assert.equal(config.automaticYield.soilSupply,undefined);
  for (const [index,value] of ['30','.3','.1','0','40','.2','Source du test'].entries()) await change(inputs[index],value);
  await click('Appliquer les fournitures N/P/K au calcul');
  assert.equal(config.automaticYield.soilSupply.initialKgHa[1],.1);assert.ok(plan.growth.scenarios.find(s=>s.id==='recorded').yieldKgHa<original.yieldKgHa);
  stale=true;await act(async()=>render());assert.equal(host.querySelector('.yield-overview-hero'),null);assert.match(host.querySelector('#farmer-harvest-card').textContent,/Calcul en cours/);
  stale=false;await act(async()=>host.querySelector('.automatic-yield-panel header input').click());assert.equal(config.automaticYield.enabled,false);assert.equal(plan.growth,undefined);assert.equal(host.querySelector('.yield-overview-hero'),null);
 }finally{await act(async()=>root.unmount());host.remove();}
});
