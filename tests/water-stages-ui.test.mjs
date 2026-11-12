import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createRequire} from 'node:module';
import {Window} from 'happy-dom';import React,{act} from 'react';import {planSeason} from '../lib/seasonal/yield.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
async function component(path){const b=await build({entryPoints:[path],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {default:YieldSummary}=await component('components/agri/yield-summary.tsx');
const {FieldOverview}=await component('components/agri/field-workspace.tsx');
test('actual product selects the stage model, displays its computed grain in the overview and hides stale output',async t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const archive=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')));
 let config=structuredClone(archive.cases[2].config),events=archive.cases[2].reconstructionForcing,stale=false;
 const host=document.createElement('div'),overview=document.createElement('div');document.body.append(host,overview);const root=createRoot(host),top=createRoot(overview);
 function render(){const plan=planSeason(config,events);root.render(React.createElement(YieldSummary,{config,plan,stale,onChange:next=>{config=next;render();}}));top.render(React.createElement(FieldOverview,{config,plan,events,stale,loading:false,onAction:()=>{}}));}
 try{
  await act(async()=>render());assert.match(overview.textContent,/RENDEMENT INTÉGRÉ SIMULÉ/);
  const growthPreview=host.querySelector('[aria-label="Autre simulation de rendement exploratoire"]');assert.ok(growthPreview);assert.match(growthPreview.textContent,/non validé localement/);assert.match(growthPreview.textContent,/t\/ha/);assert.match(growthPreview.textContent,/tonnes/);
  const button=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Tester la réponse par stades'));assert.ok(button);
  await act(async()=>button.click());assert.equal(config.yieldEstimation.method,'fao-stages');
  assert.match(host.textContent,/Modèle du grain : réponse aux déficits d’eau/);
  assert.match(host.textContent,/Déficit et réponse par phase/);
  assert.ok(!overview.textContent.includes('RENDEMENT INTÉGRÉ SIMULÉ'));assert.match(overview.textContent,/1,41/);assert.ok(!overview.textContent.includes('2,57'));
  stale=true;await act(async()=>render());assert.ok(!overview.textContent.includes('1,41'));assert.match(overview.textContent,/Recalcul/);assert.equal(host.querySelector('[aria-label="Autre simulation de rendement exploratoire"]'),null);
 }finally{await act(async()=>{root.unmount();top.unmount();});await window.happyDOM.close();}
});
