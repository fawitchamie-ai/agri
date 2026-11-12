import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('presentation starts without API calls; navigation preserves the simulation draft and explains recorded harvests',async()=>{
 const built=await build({entryPoints:['app/page.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'isolate-product-navigation',setup(b){
  b.onLoad({filter:/\/components\/agri\/seasonal\.tsx$/},()=>({contents:`import React,{useState,useEffect} from 'react';export default function TestSeasonal(){const[d,setD]=useState('Initial');useEffect(()=>{globalThis.__draftMounts=(globalThis.__draftMounts??0)+1;return()=>{globalThis.__draftUnmounts=(globalThis.__draftUnmounts??0)+1}},[]);return <section><button onClick={()=>setD('Modifié')}>Modifier le brouillon de test</button><p id="test-draft">{d}</p></section>}`,loader:'tsx'}));
  b.onLoad({filter:/\/components\/agri\/workbench\.tsx$/},()=>({contents:'export const Dashboard=()=>null,Atlas=()=>null,Models=()=>null,Lineage=()=>null,Quality=()=>null,PracticalGuide=()=>null;',loader:'js'}));
  b.onLoad({filter:/\/components\/agri\/explorer\.tsx$/},()=>({contents:'export default ()=>null',loader:'js'}));
 }}]});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const App=module.exports.default,window=new Window({url:'http://agri.test'}),previous=new Map();
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const originalFetch=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return Response.json(String(url)==='/api/science'?{forecasts:[],observations:[],comparisons:[],meta:{version:'test'}}:{session:{coopId:'test-coop',userId:'test-owner',role:'responsable',name:'Utilisateur de test'},records:[]});};
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);
 async function click(text){const button=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&!b.closest('[hidden]'));assert.ok(button,'Visible button: '+text);await act(async()=>button.click());}
 try{
  await act(async()=>root.render(React.createElement(App)));
  assert.equal(calls.length,0);assert.equal(host.querySelector('.welcome-page').querySelectorAll('input,select,textarea').length,0);
  await click('Commencer une simulation');assert.deepEqual(calls,['/api/science','/api/workspace']);
  assert.equal(globalThis.__draftMounts,1);await click('Modifier le brouillon de test');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');
  await click('Récoltes réelles');assert.match(host.querySelector('.harvest-purpose').textContent,/distinctes des estimations et des simulations/);
  assert.equal(host.querySelector('.harvest-purpose + .split-grid').hidden,true,'Harvest entry is opened deliberately');
  await click('Ajouter une récolte');assert.equal(host.querySelector('.harvest-purpose + .split-grid').hidden,false);
  await click('Parcelle et campagne');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');assert.equal(globalThis.__draftMounts,1);
  await click('Présentation');assert.ok(host.querySelector('.welcome-page'));assert.equal(globalThis.__draftUnmounts??0,0);
  await click('Commencer une simulation');assert.equal(host.querySelector('#test-draft').textContent,'Modifié');assert.equal(calls.length,2,'Returning to a loaded workspace does not reload its data');
  assert.equal(globalThis.__draftMounts,1);
 }finally{
  await act(async()=>root.unmount());globalThis.fetch=originalFetch;delete globalThis.__draftMounts;delete globalThis.__draftUnmounts;
  for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  await window.happyDOM.close();
 }
});
