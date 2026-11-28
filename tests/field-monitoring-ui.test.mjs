import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Window} from 'happy-dom';import React,{act} from 'react';import {fieldZonesFixture} from './support/field-zones-fixture.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client'),require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/field-monitoring.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
test('monitoring navigation shows historical data, conditional projection, dose validation and terrain notes without automatic network calls',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let config=fieldZonesFixture(),calls=0;
 const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected automatic network request');};
 const render=()=>root.render(React.createElement(compiled.exports.default,{config,onMap:()=>{},onWeather:()=>{},onChange:next=>{config=next;render();}}));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 try{await act(async()=>render());assert.ok(host.textContent.includes('Suivi du champ'));assert.equal(calls,0);
  await act(async()=>button('Zones historiques').click());assert.match(host.textContent,/Hypothèse de persistance disponible/);assert.match(host.textContent,/100 % de surface au même niveau/);assert.ok(host.querySelectorAll('svg path').length>20);
  await act(async()=>button('Cartes de doses').click());assert.equal(button('Conserver la carte').disabled,true);assert.match(host.textContent,/Définissez explicitement|Confirmez les doses/);
  await act(async()=>button('Carnet terrain').click());assert.match(host.textContent,/Mon carnet de terrain/);assert.ok(host.querySelector('textarea'));
  assert.equal(calls,0);
 }finally{globalThis.fetch=old;await act(async()=>root.unmount());}
});

test('a weather refresh failure clears stale figures and allows a new fetch',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const date=new Date().toISOString().slice(0,10);
 const day={date,availableAt:date+'T00:00:00Z',rainMm:42,temperatureMinC:20,temperatureMaxC:30,et0Mm:4,source:'Test uniquement',status:'forecast'};
 const config={...fieldZonesFixture(),asOfDate:date,weather:[day]};
 const originalFetch=globalThis.fetch;
 let resolve;
 globalThis.fetch=()=>new Promise(r=>{resolve=r;});
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{config,initialView:'weather',onMap:()=>{},onWeather:()=>{},onChange:()=>{}})));
  const panel=host.querySelector('.monitor-weather');
  assert.match(panel.querySelector('article').textContent,/42/);
  const refresh=panel.querySelector('button');
  await act(async()=>refresh.click());
  assert.equal(panel.querySelectorAll('article').length,0);
  await act(async()=>resolve(Response.json({error:'Prévisions indisponibles'},{status:503})));
  assert.match(panel.querySelector('[role=alert]').textContent,/Prévisions indisponibles/);
  assert.equal(panel.querySelectorAll('article').length,0);
  await act(async()=>refresh.click());
  await act(async()=>resolve(Response.json({weather:[{...day,rainMm:7}],attribution:'Test uniquement',retrievedAt:date})));
  assert.match(panel.querySelector('article').textContent,/7/);
  assert.equal(panel.querySelector('[role=alert]'),null);
 }finally{globalThis.fetch=originalFetch;await act(async()=>root.unmount());host.remove();await window.happyDOM.close();}
});
