import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {Window} from 'happy-dom';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');

test('parcel geometry is sent to satellite catalogues only after an explicit request',async()=>{
 const built=await build({entryPoints:['components/agri/satellite-nowcast-panel.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime']});
 const bundledModule={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(bundledModule,bundledModule.exports,require);
 const Panel=bundledModule.exports.default,window=new Window({url:'https://agri.test'}),previous=new Map(),calls=[],changes=[],fetchBefore=globalThis.fetch;
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),body:JSON.parse(String(init?.body??'{}'))});return Response.json({version:'sentinel-parcel-indices-1',source:'Earth Search STAC / Sentinel-2 L2A',retrievedOn:today,observations:[],coverageNote:'',issues:[]});};
 const config={country:'Togo',crop:'Maïs',cropProfile:{id:'maize'},sowingDate:yesterday,asOfDate:today,parcelGeometry:{type:'Polygon',coordinates:[[[1,9],[1.005,9],[1.005,9.004],[1,9.004],[1,9]]]},stages:[{days:90}]};
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(React.createElement(Panel,{config,onChange:value=>changes.push(value)})));
  assert.equal(calls.length,0,'Opening the panel does not send the parcel geometry');
  assert.match(host.textContent,/Digital Earth Africa|Earth Search/);
  const button=[...host.querySelectorAll('button')].find(el=>el.textContent==='Récupérer les observations du champ');assert.ok(button);
  await act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/seasonal');assert.equal(calls[0].body.action,'satellite-index-series');assert.deepEqual(calls[0].body.geometry,config.parcelGeometry);assert.equal(changes.length,1);
 }finally{
  await act(async()=>root.unmount());globalThis.fetch=fetchBefore;for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];await window.happyDOM.close();
 }
});
