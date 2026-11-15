import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('field home loads saved parcels; map entry and navigation preserve the campaign draft',async()=>{
 const built=await build({entryPoints:['app/page.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'isolate-product-navigation',setup(b){
  b.onLoad({filter:/\/components\/agri\/seasonal\.tsx$/},()=>({contents:`import React,{useState,useEffect} from 'react';export default function TestSeasonal({onHome}){const[d,setD]=useState('Initial');useEffect(()=>{globalThis.__draftMounts=(globalThis.__draftMounts??0)+1;return()=>{globalThis.__draftUnmounts=(globalThis.__draftUnmounts??0)+1}},[]);return <section><button onClick={()=>setD('Modifié')}>Modifier le brouillon de test</button><button onClick={onHome}>Retour à l’accueil de test</button><p id="test-draft">{d}</p></section>}`,loader:'tsx'}));
  b.onLoad({filter:/\/components\/agri\/field-overview-map\.tsx$/},()=>({contents:`export default function FieldOverviewMap(){return <div className="field-overview-map" aria-label="Carte simulée"/>}`,loader:'tsx'}));
  b.onLoad({filter:/\/components\/agri\/workbench\.tsx$/},()=>({contents:'export const Dashboard=()=>null,Atlas=()=>null,Models=()=>null,Lineage=()=>null,Quality=()=>null,PracticalGuide=()=>null;',loader:'js'}));
  b.onLoad({filter:/\/components\/agri\/explorer\.tsx$/},()=>({contents:'export default ()=>null',loader:'js'}));
 }}]});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const App=module.exports.default,window=new Window({url:'http://agri.test'}),previous=new Map();
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const originalFetch=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{const path=String(url);calls.push(path);if(path==='/api/science')return Response.json({forecasts:[],observations:[],comparisons:[],meta:{version:'test'}});if(path==='/api/seasonal')return Response.json({campaigns:[{id:'field-1',name:'Parcelle témoin',country:'TGO',crop:'Maize',revision:1,areaM2:12000,sowingDate:'2026-11-12',geometry:{type:'Polygon',coordinates:[[[1.2,9.5],[1.2004,9.5],[1.2004,9.5004],[1.2,9.5004],[1.2,9.5]]]}}]});return Response.json({session:{coopId:'test-coop',userId:'test-owner',role:'responsable',name:'Utilisateur de test'},records:[]});};
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);
 async function click(text){const button=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));assert.ok(button,'Visible button: '+text);await act(async()=>button.click());}
 try{
  await act(async()=>root.render(React.createElement(App)));
  assert.deepEqual(calls,['/api/workspace','/api/seasonal']);assert.ok(host.querySelector('.home-search input'));
  assert.match(host.querySelector('.welcome-page').textContent,/Mes champs/);
  assert.match(host.querySelector('.welcome-page').textContent,/Parcelle témoin/);
  assert.match(host.querySelector('.welcome-page').textContent,/Contour enregistré/);
  assert.doesNotMatch(host.querySelector('.welcome-page').textContent,/Je cultive|Je suis agronome/i);
  assert.ok(host.querySelector('.field-overview-map'));assert.equal(host.querySelector('.home-coverage-map'),null);
  await click('Ouvrir le suivi');assert.equal(window.location.hash,'#seasonal?section=images&monitor=satellite');assert.equal(globalThis.__draftMounts,1);
  await click('Retour à l’accueil de test');
  await click('Ajouter un champ');assert.deepEqual(calls,['/api/workspace','/api/seasonal','/api/science','/api/workspace']);
  assert.equal(window.location.hash,'#seasonal?section=map');assert.equal(globalThis.__draftMounts,1);await click('Modifier le brouillon de test');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');
  await click('Récoltes réelles');assert.match(host.querySelector('.harvest-purpose').textContent,/distinctes des estimations et des simulations/);
  assert.equal(host.querySelector('.harvest-purpose + .split-grid').hidden,true,'Harvest entry is opened deliberately');
  await click('Ajouter une récolte');assert.equal(host.querySelector('.harvest-purpose + .split-grid').hidden,false);
  await click('Parcelle et campagne');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');assert.equal(globalThis.__draftMounts,1);
  await click('Retour à l’accueil de test');assert.ok(host.querySelector('.welcome-page'));assert.equal(globalThis.__draftUnmounts??0,0);
  await click('Ajouter un champ');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');assert.equal(calls.length,4,'Returning to a loaded workspace does not reload its data');
  assert.equal(globalThis.__draftMounts,1);
 }finally{
  await act(async()=>root.unmount());globalThis.fetch=originalFetch;delete globalThis.__draftMounts;delete globalThis.__draftUnmounts;
  for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  await window.happyDOM.close();
 }
});
