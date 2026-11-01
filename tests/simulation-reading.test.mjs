import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry} from '../lib/seasonal/land.ts';
import {parcelMetrics} from '../lib/seasonal/parcel.ts';
import {declareScenario,migrateInputs} from '../lib/seasonal/provenance.ts';
// Compile the actual client component for SSR; no browser, identity or remote sources mocked here.
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/quick-simulation.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const Quick=compiled.exports.default;
function fixture(){
 const c=exampleCampaign('2026-11-01');
 c.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.0006,8],[1.0006,8.0006],[1,8.0006],[1,8]]]};
 c.areaM2=parcelMetrics(c.parcelGeometry).areaM2;c.waterCondition='drained';
 c.landAssessment=assessLandGeometry(c.parcelGeometry,[{id:'worldcover',status:'available',provider:'Synthetic',product:'Test',version:'test',referencePeriod:null,observedAt:null,acquiredAt:'2026-11-01T00:00:00Z',resolutionM:10,crs:'EPSG:4326',cells:[{id:'land',geometry:c.parcelGeometry,value:40}],reason:null,assets:[],limitations:[]}]);
 return migrateInputs(c);
}
const render=(config,stale=false)=>renderToStaticMarkup(React.createElement(Quick,{config,plan:planSeason(config),stale,onChange:()=>{},onSave:()=>{},onMap:()=>{},onAdvanced:()=>{},canSave:true,events:[]}));
test('ready simulation explains conditional water, exposes weekly readings and does not invent harvest inputs',()=>{
 const html=render(declareScenario(fixture()));
 assert.match(html,/besoins couverts si le plan est réalisé/);
 assert.match(html,/volume n’est pas à apporter en une fois/);
 assert.match(html,/La récolte n’est pas encore calculée/);
 assert.match(html,/Choisir une semaine pour lire les quantités/);
 assert.match(html,/<title>[^<]+ : besoin [0-9]/);
 assert.doesNotMatch(html,/<title><\/title>/);
 assert.doesNotMatch(html,/Plus loin du centre|100 \/ 100|Provenance de toutes les entrées/);
 assert.match(html,/Surface réellement semée \(m²\)<\/span><input[^>]*value=""/);
 assert.match(html,/placeholder="À renseigner avec une référence connue"[^>]*value=""/);
 assert.doesNotMatch(html,/<details open=""/,'expert panels start collapsed');
});
test('blocked and stale simulations display the action needed without showing a new water percentage',()=>{
 const c=fixture();c.inputPolicy={allowAssumptions:false,allowStale:false};
 const blocked=render(c);assert.match(blocked,/Confirmer les hypothèses/);assert.doesNotMatch(blocked,/besoins couverts si le plan est réalisé/);
 const stale=render(declareScenario(c),true);assert.match(stale,/Calcul en préparation/);assert.doesNotMatch(stale,/besoins couverts si le plan est réalisé/);
});
