import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Window} from 'happy-dom';import React,{act} from 'react';
import {fieldObservationFixture} from './support/field-zones-fixture.ts';import {dayAfter} from '../lib/seasonal/field-analysis.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client'),require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/field-monitoring.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
test('field analysis connects dated maps, comparison, keyboard inspection, charts and report without automatic network requests',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let c=fieldObservationFixture(),calls=0;
 const old=structuredClone(c.fieldMonitoring.currentObservation),date=dayAfter(c.asOfDate,-10);old.season={...old.season,id:'older',startDate:date,endDate:date};old.scenes[0].date=date;old.cells=old.cells.map(([id,v,n])=>[id,v-.05,n]);c.fieldMonitoring.datedObservations=[old];
 c.weather=[{date:c.asOfDate,rainMm:12,temperatureMeanC:25,et0Mm:null,status:'observed',source:'Synthetic software test',availableAt:c.asOfDate+'T00:00:00Z'}];
 const before=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('No automatic external requests permitted');};
 const render=()=>root.render(React.createElement(compiled.exports.default,{config:c,onChange:next=>{c=next;render();},onMap:()=>{},onWeather:()=>{}}));
 const button=t=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
 try{
  await act(async()=>render());assert.equal(calls,0);assert.match(host.textContent,/NDVI moyen \(grille\)/);assert.match(host.textContent,/100 %/);
  await act(async()=>button('NDVI contrastéDifférences dans le champ').click());assert.match(host.textContent,/Échelle adaptée à cette image/);
  const cell=host.querySelector('path[role=button]');await act(async()=>cell.focus());assert.match(host.textContent,/Cellule 0/);
  await act(async()=>cell.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));assert.match(host.textContent,/Cellule 1/);
  await act(async()=>button('Comparer').click());assert.equal(host.querySelectorAll('.fa-map').length,2);assert.match(host.textContent,/Écart de NDVI, droite − gauche : [-−]?0,05/);
  const comparison=host.querySelector('[aria-label="Couche de comparaison"]');await act(async()=>{comparison.value='history';comparison.dispatchEvent(new window.Event('change',{bubbles:true}));});assert.match(host.textContent,/Historique à compléter/);
  await act(async()=>button('Plein écran').click());assert.ok(host.querySelector('[role=dialog][aria-modal=true]'));assert.equal(document.body.style.overflow,'hidden');await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(host.querySelector('[role=dialog]'),null);assert.equal(document.body.style.overflow,'');
  await act(async()=>button('Évolution et météo').click());assert.match(host.textContent,/Végétation observée/);assert.match(host.textContent,/Pluie renseignée : 12 mm/);assert.match(host.textContent,/Renseignez une base thermique/);
  await act(async()=>button('Rapport du champ').click());assert.match(host.textContent,/Rapport du champ/);assert.match(host.textContent,/brillance du sol ne sont pas encore raccordés/);
  await act(async()=>button('Cartes du champ').click());await act(async()=>button('Charger des images').click());assert.equal(button('Chercher les dates').disabled,true);assert.equal(calls,0);
  await act(async()=>button('Zones historiques').click());await act(async()=>button('Appliquer les confirmations sans recharger').click());assert.equal(c.fieldMonitoring.datedObservations.length,1,'Updating seasonal settings preserves date archives');assert.ok(c.fieldMonitoring.currentObservation);assert.equal(c.fieldMonitoring.prescription,undefined,'No invalid empty dose draft is saved');
  c.fieldMonitoring.currentObservation.cells=[];await act(async()=>render());await act(async()=>button('Analyse du champ').click());assert.equal(host.querySelector('[aria-label="Date analysée"]').value,date,'The default uses the latest useful image while cloudy dates remain selectable');assert.equal(host.querySelector('[aria-label="Date analysée"]').options.length,2);assert.equal(calls,0);
  // Date inputs can emit input before their deferred change/blur event. The
  // typed date must survive a consent render instead of reverting to the map.
  await act(async()=>button('Charger des images').click());
  const chosen=dayAfter(c.asOfDate,-7),manual=host.querySelector('[aria-label="Date à charger"]');
  await act(async()=>{manual.value=chosen;manual.dispatchEvent(new window.Event('input',{bubbles:true}));});
  const consent=[...host.querySelectorAll('input[type=checkbox]')].find(el=>el.parentElement.textContent.includes('Autoriser le chargement'));
  await act(async()=>consent.click());
  assert.equal(host.querySelector('[aria-label="Date à charger"]').value,chosen,'Use the date actually typed, including before blur');
  assert.equal(button('Charger la date choisie').disabled,false);assert.equal(calls,0);
 }finally{globalThis.fetch=before;await act(async()=>root.unmount());await window.happyDOM.close();}
});
