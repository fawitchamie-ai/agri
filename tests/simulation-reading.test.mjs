import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {applyCropProfile} from '../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {declareScenario,migrateInputs} from '../lib/seasonal/provenance.ts';
import {fertilizerScope} from '../lib/seasonal/fertilizer-scenario.ts';
// Compile the actual client component for SSR; no browser, identity or remote sources mocked here.
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/quick-simulation.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const Quick=compiled.exports.default;
async function component(path){const b=await build({entryPoints:[path],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports.default;}
const Sowing=await component('components/agri/sowing-summary.tsx'),WaterChart=await component('components/agri/water-chart.tsx'),Fertilizer=await component('components/agri/fertilizer-panel.tsx');
function fixture(){
 const c=applyCropProfile(exampleCampaign('2026-11-01'),'maize');
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.0006,8],[1.0006,8.0006],[1,8.0006],[1,8]]]};
 c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;c.waterCondition='drained';
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-01T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 return migrateInputs(c);
}
const render=(config,stale=false,initialSection)=>renderToStaticMarkup(React.createElement(Quick,{config,plan:planSeason(config),stale,onChange:()=>{},onSave:()=>{},onMap:()=>{},onAdvanced:()=>{},canSave:true,events:[],initialSection}));
test('ready simulation explains conditional water, exposes weekly readings and does not invent harvest inputs',()=>{
 const c=declareScenario(fixture()),plan=planSeason(c);
 const html=render(c)+render(c,false,'yield')+renderToStaticMarkup(React.createElement(Sowing,{config:c,plan,stale:false,onChange:()=>{}}))+renderToStaticMarkup(React.createElement(WaterChart,{config:c,plan}));
 assert.match(render(c),/Rendement et production/);
 assert.match(render(c),/id="field-tab-overview"[^>]*role="tab"[^>]*aria-selected="true"/);
 assert.match(render(c),/id="field-tab-water"[^>]*role="tab"/);
 assert.match(render(c),/id="field-tab-fertilizer"[^>]*role="tab"/);
 const expert=render(c,false,'settings');
 assert.match(render(c),/id="field-tab-images"[^>]*role="tab"/);
 assert.doesNotMatch(render(c),/id="field-tab-notes"[^>]*role="tab"/);
 assert.match(render(c,false,'images'),/Images du champ/);
 assert.match(expert,/class="expert-subnav"/);
 assert.match(expert,/Carnet et essais/);
 assert.match(expert,/Images du champ/);
 assert.doesNotMatch(render(c),/besoins couverts si le plan est réalisé/,'method details stay on demand');
 assert.match(render(c),/Sources et limites de cette simulation/);
 assert.match(html,/SEMENCES À PRÉVOIR/);
 assert.match(html,/Modifier ma culture/);
 assert.match(html,/Modifier date de semis/);
 assert.match(html,/Modifier dose de semences/);
 assert.match(html,/Les arrosages à prévoir/);
 assert.match(html,/La pluie face aux besoins/);
 assert.doesNotMatch(html,/Aucune dose de semis référencée/);
 assert.match(render(c),/EAU À PRÉVOIR SUR LE CYCLE/);
 assert.match(html,/Comment obtenir un rendement et une production/);
 assert.match(html,/Choisir une semaine pour lire les quantités/);
 assert.match(html,/<title>[^<]+ : besoin [0-9]/);
 assert.doesNotMatch(html,/<title><\/title>/);
 assert.doesNotMatch(html,/Plus loin du centre|100 \/ 100|Provenance de toutes les entrées/);
 assert.match(html,/Surface prévue \(m²\)<\/span><input[^>]*value=""/);
 assert.match(html,/Référence indépendante sans déficit d’eau \(t\/ha\)<\/span><input[^>]*value=""/);
 assert.doesNotMatch(html,/<details open=""/,'expert panels start collapsed');
});
test('the first campaign guides the user from country to parcel and results',()=>{
 const config=fixture();config.parcelGeometry=null;config.areaM2=null;
 const empty=renderToStaticMarkup(React.createElement(Quick,{config,plan:null,stale:false,onChange:()=>{},onSave:()=>{},onMap:()=>{},onAdvanced:()=>{},canSave:false,events:[]}));assert.match(empty,/ÉTAPE 1 SUR 3/);assert.match(empty,/Pays de la parcelle/);assert.match(empty,/Dessiner ma parcelle/);assert.match(empty,/Préparer ma campagne/);assert.match(empty,/Comprendre mes résultats/);
 const started=render(declareScenario(fixture()));assert.match(started,/Voir le rendement et la production/);assert.match(started,/Rendement &amp; production/);
});
test('blocked and stale simulations display the action needed without showing a new water percentage',()=>{
 const c=fixture();c.inputPolicy={allowAssumptions:false,allowStale:false};
 const blocked=render(c);assert.match(blocked,/Confirmer les hypothèses/);assert.doesNotMatch(blocked,/besoins couverts si le plan est réalisé/);
 const stale=render(declareScenario(c),true);assert.match(stale,/Recalcul en cours/);assert.doesNotMatch(stale,/besoins couverts si le plan est réalisé/);
});
test('overview displays the opted-in fertilizer range and hides it during recalculation',()=>{
 const c=declareScenario(fixture());c.asOfDate='2026-11-02';
 c.fertilizerScenario={version:'quefts-scenario-1',scope:fertilizerScope(c),acceptedTransfer:true,ceilingKgHa:6000,ceilingSource:'Synthetic UI ceiling',availableOn:c.asOfDate,control:null};
 const html=render(c);assert.match(html,/RENDEMENT AVEC ENGRAIS PRÉVUS/);assert.match(html,/Sans nouvel apport prévu/);assert.match(html,/sans intervalle prédictif ni validation locale/);
 assert.doesNotMatch(render(c,true),/RENDEMENT AVEC ENGRAIS PRÉVUS|Sans nouvel apport prévu/);
});
test('failed recalculation exposes retry and fertilizer references instead of an endless spinner',()=>{
 const config=declareScenario(fixture());
 const html=renderToStaticMarkup(React.createElement(Quick,{config,plan:null,stale:true,calculationError:'Connexion interrompue. Vos saisies sont conservées.',onRetry:()=>{},onChange:()=>{},onSave:()=>{},onMap:()=>{},onAdvanced:()=>{},canSave:true,events:[]}));
 assert.match(html,/Calcul interrompu/);assert.match(html,/Relancer le calcul/);
 assert.doesNotMatch(html,/Recalcul en cours…|Recalcul du bilan d’eau en cours/);
 assert.match(html,/id="field-tab-fertilizer"[^>]*role="tab"/);
 const fertilizerHtml=renderToStaticMarkup(React.createElement(Fertilizer,{config,plan:null,stale:false,onChange:()=>{},onAdvanced:()=>{}}));
 assert.match(fertilizerHtml,/Voir les références et le bilan d’engrais/);
 assert.match(render(config,false,'yield'),/Aucun rendement à saisir/);
 assert.doesNotMatch(render(config,false,'yield'),/option value="declared-scenario"/);
 assert.match(fertilizerHtml,/prévision parcellaire validée et la dose optimale restent indisponibles/);
 assert.match(fertilizerHtml,/Scénario exploratoire/);
});
test('unknown contour area is not presented as zero hectares',()=>{
 const config=declareScenario(fixture());config.areaM2=null;
 const html=renderToStaticMarkup(React.createElement(Quick,{config,plan:null,stale:false,onChange:()=>{},onSave:()=>{},onMap:()=>{},onAdvanced:()=>{},canSave:true,events:[]}));
 assert.match(html,/Surface du contour indisponible/);
 assert.doesNotMatch(html,/0 ha de contour/);
});
