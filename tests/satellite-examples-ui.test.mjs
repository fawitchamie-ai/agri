import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';
import React,{act} from 'react';import {Window} from 'happy-dom';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('only the demo workspace opens each real satellite example with saved statistics and a native 10 m image consent gate',async()=>{
 const built=await build({entryPoints:['components/agri/seasonal.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'no-interactive-basemap',setup(b){b.onLoad({filter:/\/components\/agri\/parcel-explorer\.tsx$/},()=>({contents:'export const MapIcon=()=>null;export default ()=>null;',loader:'js'}));}}]});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const window=new Window({url:'http://agri.test',settings:{enableJavaScriptEvaluation:false}}),previous=new Map(),before=globalThis.fetch,calls=[];
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const payload=readFileSync(new URL('../public/examples/satellite-maps.json',import.meta.url),'utf8');
 globalThis.fetch=async(input,init)=>{const path=String(input);calls.push(path);assert.equal(init?.method,undefined,'No saved campaigns changed');if(path==='/examples/satellite-maps.json')return new Response(payload,{headers:{'content-type':'application/json'}});if(path==='/api/seasonal?includeArchived=1')return Response.json({campaigns:[]});throw new Error('Unexpected request '+path);};
 const {createRoot}=await import('react-dom/client'),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const click=async text=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(b,text);await act(async()=>b.click());};
 try{
  const render=workspace=>root.render(React.createElement(module.exports.default,{workspace,science:null,campaignsRequest:1}));
  await act(async()=>render({session:{userId:'real-user',coopId:'real-coop',demo:false}}));
  assert.doesNotMatch(host.textContent,/Voir des cartes avec de vraies images/);
  await act(async()=>render({session:{userId:'demo-user',coopId:'demo-a',demo:true}}));
  assert.match(host.textContent,/Voir des cartes avec de vraies images/);
  for(const name of ['Togo 2024','Togo 2025','Bénin 2024']){
   await click(name);assert.ok(host.querySelector('.field-analysis'),'Analysis opens directly for '+name);assert.equal(host.querySelectorAll('.fa-map-values path[data-cell]').length,0);assert.match(host.textContent,/Charger le NDVI à 10 m/);
   assert.match(host.textContent,/NDVI moyen \(grille\)/);assert.match(host.textContent,/Culture non confirmée/);assert.ok(!host.textContent.includes('semis 1 oct. 2024'),'No fictitious sowing date');
   await click('Mes campagnes');
  }
  assert.deepEqual(calls.filter(path=>path.startsWith('/examples/')),['/examples/satellite-maps.json','/examples/satellite-maps.json','/examples/satellite-maps.json']);
 }finally{await act(async()=>root.unmount());globalThis.fetch=before;for(const [k,d] of previous)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];await window.happyDOM.close();}
});
