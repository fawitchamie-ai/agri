import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {planSeason} from '../lib/seasonal/yield.ts';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/yield-summary.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const YieldSummary=compiled.exports.default;
const archive=JSON.parse(gunzipSync(readFileSync('research-data/simulation-audit/2026-11-10/after.json.gz')));
const render=(config,plan,props={})=>renderToStaticMarkup(React.createElement(YieldSummary,{config,plan,stale:false,onChange:()=>{},...props}));

test('growth result is labelled exploratory and is not said to be absent',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const config=structuredClone(archive.cases[2].config),plan=planSeason(config,archive.cases[2].reconstructionForcing);
 assert.equal(plan.growth.status,'scenario');
 const html=render(config,plan);
 assert.match(html,/Scénario exploratoire disponible/);
 assert.match(html,/Autre simulation de rendement exploratoire/);
 assert.doesNotMatch(html,/Le rendement du champ n’est pas simulé/);
 assert.doesNotMatch(html,/parcelle, votre culture et la date sont enregistrées/);
});

test('growth blocking reasons remain visible when the automatic model is unavailable',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const config=structuredClone(archive.cases[2].config),plan=planSeason(config,archive.cases[2].reconstructionForcing);
 const blocked={...plan,growth:{...plan.growth,status:'unavailable',missing:['Donnée de test manquante pour la croissance'],scenarios:[]}};
 const html=render(config,blocked);
 assert.match(html,/Simulation de croissance indisponible/);
 assert.match(html,/Donnée de test manquante pour la croissance/);
 assert.doesNotMatch(html,/Autre simulation de rendement exploratoire/);
});

test('a failed recalculation does not display the previous growth values',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-10T12:00:00Z'));
 const config=structuredClone(archive.cases[2].config),plan=planSeason(config,archive.cases[2].reconstructionForcing);
 const html=render(config,plan,{failed:true,failureMessage:'Calcul interrompu'});
 assert.match(html,/Calcul interrompu/);
 assert.doesNotMatch(html,/Autre simulation de rendement exploratoire/);
});
