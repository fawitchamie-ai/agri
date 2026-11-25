import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {addDays} from '../lib/seasonal/validation.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/sowing-workspace.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const today=new Date().toISOString().slice(0,10);
const weather=(start,days)=>Array.from({length:days},(_,i)=>({date:addDays(start,i),rainMm:3,et0Mm:4,status:'scenario',source:'Synthetic weather',availableAt:today+'T00:00:00Z'}));
function fixture(){const c=applyCropProfile(exampleCampaign(today),'maize');c.waterCondition='drained';c.fallback=null;c.system.sourceBudgetM3=1e6;
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:new Date().toISOString(),resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);c.weather=weather(today,c.stages.reduce((n,s)=>n+s.days,0));return c;}
async function mount(config){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let back=false,applied=null,variety=null;
 const render=c=>root.render(React.createElement(compiled.exports.default,{config:c,events:[],onBack:()=>{back=true;},onSowingDateChange:date=>{applied=date;},onVarietyChange:value=>{variety=value;},onCheckSoil:()=>{}},React.createElement('div',{className:'expert-target'},'Besoin cible N (kg/ha)')));
 await act(async()=>render(config));return {host,get back(){return back;},get applied(){return applied;},get variety(){return variety;},render,async close(){await act(async()=>root.unmount());host.remove();}};}
const compareButton=host=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Actualiser la météo'));
test('date comparison fetches the missing tail, explains next steps and keeps technical forms collapsed',async()=>{
 const oldFetch=globalThis.fetch,c=fixture(),before=JSON.stringify(c),calls=[];
 globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b);return Response.json({weather:weather(b.start,b.days)});};
 const m=await mount(c);
 try{
  assert.equal(m.host.querySelector('.expert-target').closest('details').open,false);
  assert.match(m.host.textContent,/aucun besoin NPK ni rendement à renseigner/);
  await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent==='Continuer ma simulation').click());assert.equal(m.back,true);
  await act(async()=>{compareButton(m.host).click();});
  assert.equal(calls.length,2);assert.equal(calls[0].action,'environment');assert.equal(calls[0].days,46);assert.equal(calls[0].start,addDays(today,-30));assert.equal(calls[1].action,'environment');assert.equal(calls[1].days,14);assert.equal(calls[1].start,addDays(today,c.weather.length));
  const comparisonTable=m.host.querySelector('table[aria-label="Comparaison des dates de semis"]');assert.equal(comparisonTable.querySelectorAll('tbody tr').length,3);assert.equal((m.host.textContent.match(/Bilan complet/g)||[]).length,3);
  const chart=m.host.querySelector('figure[aria-label="Comparaison des besoins en eau simulés par date de semis"]');
  assert.ok(chart);assert.equal(chart.querySelectorAll('strong').length,4);assert.match(chart.textContent,/ne classe pas les récoltes/);
  assert.match(m.host.textContent,/pas une prévision saisonnière/);
  await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent==='Prévisualiser').click());assert.match(m.host.textContent,/Aperçu/);assert.match(m.host.textContent,/restera dans le brouillon/);
  await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.textContent.includes('Appliquer à la campagne')).click());assert.equal(m.applied,addDays(today,7));
  assert.equal(JSON.stringify(c),before);
 }finally{globalThis.fetch=oldFetch;await m.close();}
});
test('changing the campaign while weather is loading cancels obsolete comparison results',async()=>{
 const oldFetch=globalThis.fetch;let complete;
 globalThis.fetch=()=>new Promise(resolve=>{complete=resolve;});
 const c=fixture(),m=await mount(c);
 try{
  await act(async()=>compareButton(m.host).click());assert.match(m.host.textContent,/La comparaison est en cours/);
  await act(async()=>m.render({...c,sowingDate:addDays(today,1),weather:[]}));
  await act(async()=>complete(Response.json({weather:weather(today,c.weather.length+14)})));
  assert.equal(m.host.querySelector('table'),null);assert.doesNotMatch(m.host.textContent,/La comparaison est en cours/);
 }finally{globalThis.fetch=oldFetch;await m.close();await window.happyDOM.close();}
});

test('Togo maize candidates require producer availability confirmation and retain the selected variety',async()=>{
 const c=fixture();c.country='TGO';c.crop='Maïs';const m=await mount(c);
 try{
  const card=m.host.querySelector('section[aria-label="Comparer des variétés de maïs au Togo"]');assert.ok(card);
  const tzee=m.host.querySelector('input[aria-label="Semence TZEE disponible pour moi"]');const ikenne=m.host.querySelector('input[aria-label="Semence Ikenne disponible pour moi"]');assert.ok(tzee&&ikenne);
  await act(async()=>tzee.click());await act(async()=>ikenne.click());
  const table=m.host.querySelector('table[aria-label="Calendrier indicatif des variétés sélectionnées"]');assert.ok(table);assert.equal(table.querySelectorAll('tbody tr').length,2);
  assert.match(table.textContent,/80–85 jours/);assert.match(table.textContent,/100–105 jours/);
  assert.match(m.host.textContent,/aucun calendrier local qualifié/);
  await act(async()=>[...m.host.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.includes('Retenir TZEE')).click());
  assert.equal(m.variety,'TZEE (TZEE W Pop STR QPM)');assert.match(m.host.textContent,/Ajoutée au brouillon/);
  await act(async()=>m.render({...c,country:'BEN'}));assert.match(m.host.textContent,/Aucun catalogue local de cycle vérifié/);
  assert.equal(m.host.querySelector('table[aria-label="Calendrier indicatif des variétés sélectionnées"]'),null);
 }finally{await m.close();await window.happyDOM.close();}
});
