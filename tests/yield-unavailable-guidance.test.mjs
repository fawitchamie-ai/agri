import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React, {act} from 'react';
import {Window} from 'happy-dom';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {declareScenario, geometryIdentity, migrateInputs} from '../lib/seasonal/provenance.ts';

const window = new Window({url:'https://agri.test', settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
window.HTMLElement.prototype.scrollIntoView=function(){};
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
async function component(path){const b=await build({entryPoints:[path],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {FieldOverview}=await component('components/agri/field-workspace.tsx');
const {default:YieldSummary}=await component('components/agri/yield-summary.tsx');
const {default:QuickSimulation}=await component('components/agri/quick-simulation.tsx');
function fixture(){
 let c=applyCropProfile(exampleCampaign('2026-11-01'),'maize');
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.0006,8],[1.0006,8.0006],[1,8.0006],[1,8]]]};
 c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;c.waterCondition='drained';
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-01T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 return declareScenario(migrateInputs(c));
}
async function mount(element){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(element));return {host,root,async close(){await act(async()=>root.unmount());host.remove();}};}
const button=(host,pattern)=>[...host.querySelectorAll('button')].find(b=>pattern.test(b.textContent));

test('unavailable yield cards open actual yield guidance without fabricating output',async()=>{
 const c=fixture(),plan=planSeason(c),targets=[];
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,onAction:t=>targets.push(t)}));
 try {
  const yieldCard=button(m.host,/RENDEMENT HYDRIQUE/),productionCard=button(m.host,/PRODUCTION SIMULÉE/);
  assert.ok(yieldCard);assert.ok(productionCard);
  assert.match(yieldCard.textContent,/Indisponible/i);assert.match(productionCard.textContent,/Indisponible/i);
  await act(async()=>yieldCard.click());await act(async()=>productionCard.click());
  assert.deepEqual(targets,['yield','yield']);
 } finally {await m.close();}
});

test('from the actual campaign overview, the unavailable card leads to yield guidance and then to water',async()=>{
 const c=fixture(),plan=planSeason(c),changes=[];
 const m=await mount(React.createElement(QuickSimulation,{config:c,plan,stale:false,events:[],paused:true,onChange:next=>changes.push(next),onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false}));
 try {
  const yieldCard=button(m.host,/RENDEMENT HYDRIQUE/);assert.ok(yieldCard);assert.match(yieldCard.textContent,/Indisponible/i);
  await act(async()=>yieldCard.click());
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  const water=button(guidance,/Vérifier l’eau de ma campagne/i);assert.ok(water);
  await act(async()=>water.click());
  assert.equal(m.host.querySelector('#field-tab-water').getAttribute('aria-selected'),'true');
  assert.equal(changes.length,0,'navigation does not change the simulated campaign');
 } finally {await m.close();}
});

test('water and growth options lead to their destinations without enabling a model or changing inputs',async()=>{
 const c=fixture(),plan=planSeason(c),actions=[],changes=[];
 const m=await mount(React.createElement(YieldSummary,{config:c,plan,stale:false,onChange:next=>changes.push(next),onWater:()=>actions.push('water'),onConfigure:()=>actions.push('configure')}));
 try {
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.match(guidance.textContent,/automatique n’est pas encore raccordé/i);
  assert.match(guidance.textContent,/ne saisissez pas de valeur au hasard/i);
  const water=button(guidance,/Vérifier l’eau de ma campagne/i),settings=button(guidance,/Vérifier les paramètres/i),growth=button(guidance,/Explorer le modèle de croissance/i);
  assert.ok(water);assert.ok(settings);assert.ok(growth);
  await act(async()=>water.click());await act(async()=>settings.click());
  assert.deepEqual(actions,['water','configure']);
  await act(async()=>growth.click());
  const growthDetails=m.host.querySelector('#yield-growth-details');assert.ok(growthDetails);assert.equal(growthDetails.open,true);
  assert.equal(changes.length,0,'exploring must not silently enable a model or alter the campaign');
 } finally {await m.close();}
});

test('invalid campaign shows a clear error when opening growth configuration',async()=>{
 const c=fixture();c.system.sourceFlowM3h=-1;const changes=[];
 const m=await mount(React.createElement(YieldSummary,{config:c,plan:null,stale:false,onChange:next=>changes.push(next)}));
 try {
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');
  await act(async()=>button(guidance,/Explorer le modèle de croissance/i).click());
  const configure=button(m.host,/Configurer la simulation intégrée/i);assert.ok(configure);
  await act(async()=>configure.click());
  assert.match(m.host.textContent,/Impossible d’ouvrir le modèle/i);
  assert.equal(changes.length,0,'an invalid campaign must not enable the model');
 } finally {await m.close();}
});

test('missing independent reference is visible and opening its form does not invent a value',async()=>{
 const c=fixture();c.yieldEstimation={version:'yield-input-1',method:'fao-seasonal',areaBasis:'planned',scopeGeometryId:geometryIdentity(c.parcelGeometry),homogeneityAssumption:'Test uniquement',units:[{id:'champ',sownAreaM2:c.landAssessment.candidateAreaM2,harvestedAreaM2:null,areaSource:'Test uniquement',reference:null}]};
 const plan=planSeason(c),changes=[];
 assert.match(plan.yieldEstimation.scenarios[0].missing.join(' '),/référence de rendement absente/);
 const m=await mount(React.createElement(YieldSummary,{config:c,plan,stale:false,onChange:next=>changes.push(next)}));
 try {
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.match(guidance.textContent,/référence/i);
  const open=button(guidance,/Je dispose d’une référence fiable/i);assert.ok(open);
  await act(async()=>open.click());
  const input=[...m.host.querySelectorAll('input')].find(i=>i.closest('label')?.textContent.includes('Référence indépendante sans déficit'));
  assert.ok(input);assert.equal(input.value,'');assert.equal(input.closest('details').open,true);
  assert.equal(changes.length,0,'opening a form must not create a reference or a result');
 } finally {await m.close();}
});
