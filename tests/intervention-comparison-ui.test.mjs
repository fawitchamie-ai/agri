import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import React,{act} from 'react';import {Window} from 'happy-dom';import {exampleCampaign} from '../lib/seasonal/example.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');const b=await build({entryPoints:['components/agri/intervention-comparison.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const Component=m.exports.default;
test('actual UI rejects late responses and exposes unavailable fertilizer effects without invented yields',async()=>{
 const requests=[],original=globalThis.fetch;globalThis.fetch=(_url,init)=>new Promise(resolve=>requests.push({init,resolve}));const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let config=exampleCampaign();
 const render=async()=>act(async()=>root.render(React.createElement(Component,{config,events:[]})));
 const click=async()=>act(async()=>host.querySelector('button').click());
 try{await render();await click();assert.equal(requests.length,1);config={...config,name:'Changed input'};await render();assert.equal(requests[0].init.signal.aborted,true);
  await act(async()=>requests[0].resolve(Response.json({scenarios:[{id:'old',label:'OBSOLETE_RESPONSE',totalNitrogenKgHa:0}]})));assert.doesNotMatch(host.textContent,/OBSOLETE_RESPONSE/);
  await click();await act(async()=>requests[1].resolve(Response.json({scenarios:[{id:'new',label:'CURRENT_INPUT_RESPONSE',totalNitrogenKgHa:null}]})));assert.match(host.textContent,/CURRENT_INPUT_RESPONSE/);assert.match(host.textContent,/Non calculée/);assert.match(host.textContent,/Inconnu/);
 }finally{await act(async()=>root.unmount());host.remove();globalThis.fetch=original;await window.happyDOM.close();}
});
