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
const bundle=await build({entryPoints:['components/agri/yield-attribution.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);

test('the yield result shows isolated water and fertilizer contributions in t/ha and tonnes',async()=>{
 const config=applyCropProfile(exampleCampaign(),'maize');
 config.managementPlan={products:[
  {id:'fert-real',kind:'fertilizer',status:'declared',dose:40},
  {id:'fert-plan',kind:'fertilizer',status:'planned',dose:20},
 ]};
 const scenario=(id,label,yieldKgHa,productionKg,irrigationNetMm)=>({id,label,yieldKgHa,productionKg,water:{irrigationNetMm,etaMm:0,etmMm:0}});
 const growth={status:'scenario',scenarios:[
  scenario('rainfed','Sans irrigation ajoutée',920,2193,0),
  scenario('recorded','Avec les apports réalisés',1200,2860,35),
  scenario('proposed','Avec les apports réalisés et prévus',1680,4005,70),
  scenario('without-planned-fertilizer','Même eau proposée, sans engrais prévu',1600,3814,70),
 ],counterfactuals:{recordedWithoutFertilizer:{yieldKgHa:1120,productionKg:2667}}};
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{growth,config,mode:'proposed'})));
  assert.match(host.textContent,/Qu’est-ce qui fait varier ce rendement/);
  assert.match(host.textContent,/Avec les apports réalisés et prévus, soit 1,68 t\/ha/);
  assert.match(host.textContent,/Arrosages réalisés/);
  assert.match(host.textContent,/\+0,28 t\/ha/);
  assert.match(host.textContent,/Plan d’arrosage/);
  assert.match(host.textContent,/\+0,40 t\/ha/);
  assert.match(host.textContent,/Engrais déclarés réalisés/);
  assert.match(host.textContent,/\+0,08 t\/ha/);
  assert.match(host.textContent,/Engrais prévus/);
  assert.match(host.textContent,/\+0,08 t\/ha/);
  assert.match(host.textContent,/\+0,67 t sur le champ/);
  assert.match(host.textContent,/Les stocks N\/P\/K de base du profil restent présents/);
 }finally{
  await act(async()=>root.unmount());
  await window.happyDOM.close();
 }
});
