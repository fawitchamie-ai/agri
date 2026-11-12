import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {exampleCampaign} from '../lib/seasonal/example.ts';

const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const bundle=await wr('esbuild').build({entryPoints:['components/agri/quick-simulation.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,loader:{'.css':'empty'},jsx:'automatic'});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);

test('campaign guide opens the requested step without implying an automatic yield',async()=>{
 const config=exampleCampaign('2026-11-01');
 config.parcelGeometry={type:'Polygon',coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let mapOpened=false;
 try{
  await act(async()=>root.render(React.createElement(compiled.exports.default,{config,plan:null,stale:false,onChange:()=>{},onMap:()=>{mapOpened=true;},onAdvanced:()=>{},onSave:()=>{},canSave:false,events:[],paused:true})));
  const guide=host.querySelector('[aria-label="Comment obtenir mes résultats"]');assert.ok(guide);
  assert.match(guide.textContent,/rendement automatique de votre parcelle n’est pas toujours disponible/);
  const click=async(label)=>{const b=[...host.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,`Bouton absent : ${label}`);await act(async()=>b.click());};
  await click('Revoir la carte');assert.equal(mapOpened,true);
  await click('Voir le bilan d’eau');assert.equal(host.querySelector('#field-tab-water').getAttribute('aria-selected'),'true');
  await click('Ouvrir le rendement');assert.equal(host.querySelector('#field-tab-yield').getAttribute('aria-selected'),'true');
  await click('Vérifier l’eau de ma campagne →');assert.equal(host.querySelector('#field-tab-water').getAttribute('aria-selected'),'true');
  await click('Ouvrir le rendement');
  const configure=[...host.querySelectorAll('button')].find(x=>x.textContent.includes('Vérifier les paramètres'));assert.ok(configure,'Le raccourci vers les données doit être présent');
  await act(async()=>configure.click());assert.equal(host.querySelector('#field-tab-settings').getAttribute('aria-selected'),'true');
 }finally{await act(async()=>root.unmount());host.remove();await window.happyDOM.close();}
});
