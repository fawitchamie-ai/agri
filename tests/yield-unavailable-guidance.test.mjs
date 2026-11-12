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

test('unavailable harvest is explained once and opens the yield view without fabricating output',async()=>{
 const c=fixture(),plan=planSeason(c),targets=[];
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,onAction:t=>targets.push(t)}));
 try {
  const harvest=m.host.querySelector('[aria-label="État du rendement et de la production"]');
  assert.ok(harvest);assert.match(harvest.textContent,/Rendement et production non calculables/);
  assert.match(harvest.textContent,/calcul automatique du rendement parcellaire n’est pas raccordé/i);
  assert.doesNotMatch(m.host.textContent,/\bN\/A\b|Rendement hydrique.*Indisponible|Production simulée.*Indisponible/i);
  const open=button(harvest,/Voir les méthodes et données disponibles/i),water=button(m.host,/BILAN D’EAU/);
  assert.ok(open);assert.ok(water);
  const overview=m.host.querySelector('.field-overview'),harvestIndex=[...overview.children].indexOf(m.host.querySelector('.harvest-result-card')),metricsIndex=[...overview.children].indexOf(m.host.querySelector('.result-metrics'));
  assert.ok(harvestIndex>=0&&harvestIndex<metricsIndex,'the harvest state comes before water indicators');
  await act(async()=>open.click());await act(async()=>water.click());
  assert.deepEqual(targets,['yield','water']);
 } finally {await m.close();}
});

test('an available water index is not presented as a partial harvest',async()=>{
 const c=fixture(),plan=planSeason(c);plan.waterImpact={scenarios:[{id:'recorded',relativeYieldPercent:82}]};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,onAction:()=>{}}));
 try{
  const harvest=m.host.querySelector('.harvest-result-card');assert.ok(harvest);
  assert.match(harvest.textContent,/Indice hydrique disponible ; rendement et production non calculables/);
  assert.match(m.host.textContent,/INDICE HYDRIQUE/);assert.match(m.host.textContent,/82/);
  assert.doesNotMatch(harvest.textContent,/Résultat partiel/);
 }finally{await m.close();}
});

test('stale plans hide old harvest numbers and show an update state',async()=>{
 const c=fixture(),plan=planSeason(c);plan.yieldEstimation={method:'fao-seasonal',missing:[],scenarios:[{id:'recorded',missing:[],totals:{yieldKgHaSown:6000,productionKg:12000}}]};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:true,loading:false,onAction:()=>{}}));
 try{
  assert.match(m.host.querySelector('.harvest-result-card').textContent,/Résultats en cours de mise à jour/);
  assert.equal(m.host.querySelectorAll('.result-metrics button').length,1,'only the water status remains while values are stale');
  assert.doesNotMatch(m.host.querySelector('.result-metrics').textContent,/6,00|12,00/);
 }finally{await m.close();}
});

test('the result message uses the model missing reason instead of guessing that surface is absent',async()=>{
 const c=fixture(),plan=planSeason(c);c.yieldEstimation={method:'fao-seasonal'};
 plan.waterImpact=undefined;plan.yieldEstimation={method:'fao-seasonal',missing:['Référence indépendante sans déficit absente.'],surface:{simulationM2:null,sownM2:null},scenarios:[{id:'recorded',missing:['Référence indépendante sans déficit absente.'],totals:null}]};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,onAction:()=>{}}));
 try{
  const harvest=m.host.querySelector('.harvest-result-card');assert.ok(harvest);
  assert.match(harvest.textContent,/Référence indépendante sans déficit absente/);
  assert.doesNotMatch(harvest.textContent,/surface nécessaire.*manque/i);
 }finally{await m.close();}
});

test('from the campaign overview, the harvest message leads to yield guidance and then to water',async()=>{
 const c=fixture(),plan=planSeason(c),changes=[];
 const m=await mount(React.createElement(QuickSimulation,{config:c,plan,stale:false,events:[],paused:true,onChange:next=>changes.push(next),onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false}));
 try {
  const harvest=button(m.host,/Voir les méthodes et données disponibles/i);assert.ok(harvest);
  await act(async()=>harvest.click());
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  const water=button(guidance,/Vérifier l’eau de ma campagne/i);assert.ok(water);
  await act(async()=>water.click());
  assert.equal(m.host.querySelector('#field-tab-water').getAttribute('aria-selected'),'true');
  assert.equal(changes.length,0,'navigation does not change the simulated campaign');
 } finally {await m.close();}
});

test('a mounted campaign opens the requested results tab after the parcel flow',async()=>{
 const c=fixture(),plan=planSeason(c);
 const props={config:c,plan,stale:false,events:[],paused:true,onChange:()=>{},onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false};
 const m=await mount(React.createElement(QuickSimulation,{...props,initialSection:undefined}));
 try{
  assert.equal(m.host.querySelector('#field-tab-overview').getAttribute('aria-selected'),'true');
  await act(async()=>m.root.render(React.createElement(QuickSimulation,{...props,initialSection:'yield'})));
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  assert.match(m.host.querySelector('#field-panel-yield').textContent,/Rendement et production/);
  assert.equal(m.host.ownerDocument.activeElement?.id,'field-tab-yield','focus follows the newly opened result tab');
 }finally{await m.close();}
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
