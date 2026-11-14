import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {Window} from 'happy-dom';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('imagery requires consent for each geometry; HD skips observation metadata and public indices avoid simulation CPU',async()=>{
 const built=await build({entryPoints:['components/agri/parcel-layers.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'}});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const Layers=module.exports.default,window=new Window({url:'https://agri.test'}),previous=new Map(),calls=[],fetchBefore=globalThis.fetch;
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 globalThis.fetch=async(input)=>{const u=String(input);calls.push(u);return u.includes('GetCapabilities')?new Response('<WMS_Capabilities><Capability><Layer><Layer><Name>s2_l2a</Name><Dimension name="time"></Dimension><Style><Name>ndvi</Name></Style></Layer></Layer></Capability></WMS_Capabilities>'):Response.json({features:[]});};
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);
 const config=offset=>({asOfDate:'2026-10-13',parcelGeometry:{type:'Polygon',coordinates:[[[1+offset,9],[1.005+offset,9],[1.005+offset,9.004],[1+offset,9.004],[1+offset,9]]]}});
 const render=offset=>React.createElement(Layers,{config:config(offset),onMap(){}});
 const click=async text=>{const button=[...host.querySelectorAll('button')].find(el=>el.textContent===text);assert.ok(button,text);await act(async()=>button.click());};
 try{
  await act(async()=>root.render(render(0)));await click('Satellite');assert.equal(calls.length,0);
  assert.equal(host.querySelectorAll('img').length,0,'No provider image before consent');
  await click('Charger les images de cette parcelle');assert.equal(calls.length,0,'Undated HD does not request the catalogue or scene geometry');
  const tiles=[...host.querySelectorAll('.basemap-mosaic img')];assert.ok(tiles.length>0&&tiles.length<=30);
  assert.ok(tiles.every(t=>t.src.startsWith('https://services.arcgisonline.com/')&&t.src.includes('/tile/')&&!t.src.includes('/export')),'HD uses existing public image tiles instead of the failing export endpoint');
  await click('Vigueur');assert.equal(calls.length,4);assert.ok(calls.some(u=>u.startsWith('https://ows.digitalearth.africa/')));assert.ok(calls.some(u=>u.startsWith('https://explorer.digitalearth.africa/')));assert.ok(calls.some(u=>u.startsWith('https://earth-search.aws.element84.com/')));assert.ok(calls.some(u=>u.startsWith('/api/seasonal')),'The authenticated application proxy retrieves the chosen image after consent');
  await act(async()=>root.render(render(.01)));assert.equal(calls.length,4,'A new geometry never inherits consent, including during the first effects pass');assert.equal(host.querySelectorAll('img').length,0);
  await click('Vigueur');assert.ok(host.textContent.includes('Charger les images de cette parcelle'));assert.equal(calls.length,4);
 }finally{
  await act(async()=>root.unmount());globalThis.fetch=fetchBefore;for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];await window.happyDOM.close();
 }
});
