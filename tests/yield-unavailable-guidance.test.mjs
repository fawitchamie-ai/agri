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
import {canopyFixture} from './support/canopy-fixture.ts';

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
  assert.ok(harvest);assert.match(harvest.textContent,/Modèle automatique de rendement indisponible/);
  assert.match(harvest.textContent,/ne produit pas encore de prévision automatique du rendement parcellaire/i);
  assert.doesNotMatch(m.host.textContent,/\bN\/A\b|Rendement hydrique.*Indisponible|Production simulée.*Indisponible/i);
  const open=button(harvest,/Voir les méthodes et données disponibles/i),water=button(m.host,/BILAN D’EAU/);
  assert.ok(open);assert.ok(water);
  const overview=m.host.querySelector('.field-overview'),harvestIndex=[...overview.children].indexOf(m.host.querySelector('.harvest-result-card')),metricsIndex=[...overview.children].indexOf(m.host.querySelector('.result-metrics'));
  assert.ok(harvestIndex>=0&&harvestIndex<metricsIndex,'the harvest state comes before water indicators');
  await act(async()=>open.click());await act(async()=>water.click());
  assert.deepEqual(targets,['yield','water']);
 } finally {await m.close();}
});

test('the campaign overview shows a qualified Ghana maize nowcast when LAI data are present',async()=>{
 const c=canopyFixture(),plan=planSeason(c);
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,simple:true,onAction:()=>{}}));
 try {
  assert.match(m.host.textContent,/Nowcast local expérimental/);
  assert.match(m.host.textContent,/Grain estimé par le couvert/);
  assert.match(m.host.textContent,/Production selon le couvert/);
  assert.match(m.host.textContent,/LAI mesuré · humidité du grain non précisée/);
  assert.doesNotMatch(m.host.textContent,/Rendement du champPas simulé|Production totalePas estimée/);
 }finally{await m.close();}
});

test('the Ghana maize yield guide opens the experimental LAI follow-up without entering a fake yield',async()=>{
 const c=canopyFixture();c.canopyNowcast=undefined;const plan=planSeason(c);
 const m=await mount(React.createElement(YieldSummary,{config:c,plan,stale:false,onChange:()=>{}}));
 try {
  const open=button(m.host,/Ouvrir le suivi expérimental du couvert/i);assert.ok(open);
  await act(async()=>open.click());
  const panel=m.host.querySelector('#canopy-nowcast-panel');assert.ok(panel);
  assert.equal(panel.querySelector('details')?.open,true);
  assert.match(panel.textContent,/LAI est la surface de feuilles vertes/);
  assert.match(panel.textContent,/Ce n’est pas une prévision/i);
  assert.doesNotMatch(m.host.querySelector('.yield-overview-hero')?.textContent??'',/t\/ha/);
 }finally{await m.close();}
});

test('simple campaign states that no yield is simulated and keeps the national statistic out of the result cards',async()=>{
 const c=fixture();c.inputPolicy={allowAssumptions:false,allowStale:false};const plan=planSeason(c),actions=[];
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,simple:true,onDetails:()=>actions.push('yield'),onAction:target=>actions.push(target)}));
 try{
  assert.match(m.host.textContent,/La récolte en tonnes ne peut pas encore être simulée automatiquement/);
  assert.doesNotMatch(m.host.textContent,/Votre champ est bien enregistré|la date sont enregistrés/,'the result must not claim that a draft was saved');
  assert.match(m.host.textContent,/Rendement du champPas simulé/);assert.match(m.host.textContent,/Production totalePas estimée/);
  assert.match(m.host.textContent,/Pourquoi ce résultat manque/);assert.match(m.host.textContent,/ne crée pas de prévision automatique en tonnes/);
  assert.match(m.host.textContent,/Voir le repère statistique national · FAOSTAT 2022/);assert.match(m.host.textContent,/1,25 t\/ha/);
  assert.equal(m.host.querySelector('.farmer-reference-details').open,false,'national context stays collapsed');
  assert.doesNotMatch(m.host.textContent,/Exemple de volume|0,55 tonnes/);
  await act(async()=>button(m.host,/Pourquoi pas de rendement/i).click());
  await act(async()=>button(m.host,/Vérifier les hypothèses/i).click());assert.deepEqual(actions,['yield','water']);
 } finally {await m.close();}
});

test('an unavailable growth scenario shows its own missing reason rather than the automatic-mode message',async()=>{
 const c=fixture(),plan=planSeason(c);c.growth={};
 plan.growth={status:'unavailable',missing:['Rayonnement du cycle incomplet.']};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,simple:true,onDetails:()=>{},onAction:()=>{}}));
 try{
  assert.match(m.host.textContent,/Rayonnement du cycle incomplet/);
  assert.doesNotMatch(m.host.textContent,/Aucun modèle automatique ne calcule|Vous n’avez rien oublié/);
  assert.doesNotMatch(m.host.textContent,/Production totalePas estimée/,'an unavailable configured scenario must not be mislabeled as the default automatic mode');
 }finally{await m.close();}
});

test('growth production uses the growth surface and states that a planned surface is not already sown',async()=>{
 const c=fixture(),plan=planSeason(c);c.growth={};c.inputPolicy={allowAssumptions:true,allowStale:false};
 plan.status='ready';plan.complete=true;plan.days=[{}];plan.totals={...plan.totals,demandMm:10,actualEtMm:8};
 plan.growth={status:'scenario',areaM2:10000,areaBasis:'planned',moisturePercent:15,scenarios:[{id:'recorded',yieldKgHa:2000,productionKg:2000}]};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,simple:true,onDetails:()=>{},onAction:()=>{}}));
 try{
  const production=[...m.host.querySelectorAll('.farmer-harvest-value')].find(el=>el.textContent.includes('Production totale estimée'));
  assert.ok(production);assert.match(production.textContent,/2 tonnes/);assert.match(production.textContent,/Pour 1 ha prévus/);
  assert.doesNotMatch(production.textContent,/semés/);
 }finally{await m.close();}
});

test('an interrupted calculation is not presented as an ordinary unavailable automatic forecast',async()=>{
 const c=fixture();const m=await mount(React.createElement(FieldOverview,{config:c,plan:null,events:[],stale:false,loading:false,failed:true,simple:true,onDetails:()=>{},onAction:()=>{}}));
 try{
  const cards=[...m.host.querySelectorAll('.farmer-harvest-value')];
  assert.equal(cards.length,2);
  for(const card of cards)assert.match(card.textContent,/Calcul interrompu/);
  assert.doesNotMatch(m.host.textContent,/Votre champ est bien enregistré|la date sont enregistrés/);
 }finally{await m.close();}
});

test('missing seed-rate references never create a production estimate from a national average',async()=>{
 const c=fixture(),plan=planSeason(c);plan.sowingPlan.status='unavailable';plan.sowingPlan.missing=['Aucune dose de semis référencée pour cette culture : renseignez une référence locale.'];
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,simple:true,onAction:()=>{}}));
 try{
  assert.match(m.host.textContent,/Production totalePas estimée/);
  assert.doesNotMatch(m.host.textContent,/Exemple de volume|0,55 tonnes/);
 }finally{await m.close();}
});

test('an available water index is not presented as a partial harvest',async()=>{
 const c=fixture(),plan=planSeason(c);plan.waterImpact={scenarios:[{id:'recorded',relativeYieldPercent:82}]};
 const m=await mount(React.createElement(FieldOverview,{config:c,plan,events:[],stale:false,loading:false,onAction:()=>{}}));
 try{
  const harvest=m.host.querySelector('.harvest-result-card');assert.ok(harvest);
  assert.match(harvest.textContent,/Indice hydrique disponible ; rendement non simulé/);
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

test('from the simple campaign summary, details lead to yield guidance and then to water',async()=>{
 const c=fixture(),plan=planSeason(c),changes=[];
 const m=await mount(React.createElement(QuickSimulation,{config:c,plan,stale:false,events:[],paused:true,onChange:next=>changes.push(next),onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false}));
 try {
  const harvest=button(m.host,/Pourquoi pas de rendement/i);assert.ok(harvest);
  await act(async()=>harvest.click());
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  const water=button(guidance,/Voir les périodes d’eau/i);assert.ok(water);
  await act(async()=>water.click());
  assert.equal(m.host.querySelector('#field-tab-water').getAttribute('aria-selected'),'true');
  assert.ok(button(m.host,/Comprendre le rendement/i));
  await act(async()=>button(m.host,/Comprendre le rendement/i).click());
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  assert.equal(changes.length,0,'navigation does not change the simulated campaign');
 } finally {await m.close();}
});

test('the simple water action actually opens the detailed water screen',async()=>{
 const c=fixture(),plan=planSeason(c);
 const m=await mount(React.createElement(QuickSimulation,{config:c,plan,stale:false,events:[],paused:true,onChange:()=>{},onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false}));
 try{
  const openWater=m.host.querySelector('.farmer-water-action');assert.ok(openWater);
  await act(async()=>openWater.click());
  assert.equal(m.host.querySelector('#field-tab-water')?.getAttribute('aria-selected'),'true');
  assert.ok(button(m.host,/Comprendre le rendement/i));
  const reminder=m.host.querySelector('[aria-label="État du rendement"]');assert.ok(reminder);
  assert.match(reminder.textContent,/Pas simulé pour cette campagne/);
  assert.match(reminder.textContent,/ne calculent pas les tonnes/);
  await act(async()=>button(reminder,/Voir pourquoi/i).click());
  assert.equal(m.host.querySelector('#field-tab-yield')?.getAttribute('aria-selected'),'true','the water screen gives a direct route to the reason');
 }finally{await m.close();}
});

test('a mounted campaign opens the requested results tab after the parcel flow',async()=>{
 const c=fixture(),plan=planSeason(c);
 const props={config:c,plan,stale:false,events:[],paused:true,onChange:()=>{},onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false};
 const m=await mount(React.createElement(QuickSimulation,{...props,initialSection:undefined}));
 try{
  assert.equal(m.host.querySelector('#field-tab-overview'),null,'technical tabs are hidden in the simple summary');
  await act(async()=>button(m.host,/Pourquoi pas de rendement/i).click());
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  await act(async()=>m.root.render(React.createElement(QuickSimulation,{...props,initialSection:'yield'})));
  assert.equal(m.host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  assert.match(m.host.querySelector('#field-panel-yield').textContent,/Rendement et production/);
  assert.equal(m.host.ownerDocument.activeElement?.id,'field-tab-yield','focus follows the newly opened result tab');
 }finally{await m.close();}
});

test('the results heading receives focus when returning from parcel selection in simple mode',async()=>{
 const c=fixture(),plan=planSeason(c),props={config:c,plan,stale:false,events:[],paused:true,onChange:()=>{},onMap:()=>{},onAdvanced:()=>{},onSave:()=>{},canSave:false,initialSection:'yield'};
 const m=await mount(React.createElement(QuickSimulation,props));
 try{
  assert.ok(m.host.querySelector('#farmer-harvest-card'));
  assert.equal(m.host.querySelector('#field-tab-yield'),null,'technical tabs remain closed by default');
  assert.equal(m.host.ownerDocument.activeElement?.id,'farmer-harvest-card','focus lands on the result after parcel setup');
 }finally{await m.close();}
});

test('water and expert options lead to their destinations without enabling a model or changing inputs',async()=>{
 const c=fixture(),plan=planSeason(c),actions=[],changes=[];
 const m=await mount(React.createElement(YieldSummary,{config:c,plan,stale:false,onChange:next=>changes.push(next),onWater:()=>actions.push('water'),onConfigure:()=>actions.push('configure')}));
 try {
  const guidance=m.host.querySelector('[aria-label="Comprendre pourquoi le rendement est indisponible"]');assert.ok(guidance);
  assert.match(guidance.textContent,/ne produit pas une prévision automatique en tonnes/i);
  assert.match(guidance.textContent,/ne produit pas une prévision automatique en tonnes/i);
  assert.match(guidance.textContent,/estimation conditionnelle/i);
  const water=button(guidance,/Voir les périodes d’eau/i),expert=guidance.querySelector('.yield-guide-expert-options');
  assert.ok(water);assert.ok(expert);assert.equal(expert.open,false);
  await act(async()=>water.click());assert.deepEqual(actions,['water']);
  await act(async()=>expert.querySelector('summary').click());
  const settings=button(expert,/Documenter une référence locale/i),growth=button(expert,/Ouvrir les scénarios expérimentaux/i);
  assert.ok(settings);assert.ok(growth);
  await act(async()=>settings.click());assert.deepEqual(actions,['water']);
  assert.equal(m.host.querySelector('#yield-advanced-settings').open,true,'expert reference fields are opened only on request');
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
  const expert=guidance.querySelector('.yield-guide-expert-options');await act(async()=>expert.querySelector('summary').click());
  await act(async()=>button(expert,/Ouvrir les scénarios expérimentaux/i).click());
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
