import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {testParcel,landFixture} from './support/land-fixtures.mjs';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler'));
const {build}=wr('esbuild');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('seasonal effects wait for terrain on restored parcels and retries; invalid edits make no API call',async()=>{
 const built=await build({entryPoints:['components/agri/seasonal.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'view-only-stubs',setup(b){
  b.onLoad({filter:/\/components\/agri\/quick-simulation\.tsx$/},()=>({contents:'export default function View(props){globalThis.__seasonalView=props;return null}',loader:'js'}));
  b.onLoad({filter:/\/components\/agri\/(parcel-explorer|crop-reference)\.tsx$/},args=>({contents:args.path.includes('parcel-explorer')?'export const MapIcon=()=>null;export default function View(props){globalThis.__parcelView=props;return null;}':'export const CropReference=()=>null;export default ()=>null;',loader:'js'}));
 }}]});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const Seasonal=module.exports.default,window=new Window({url:'http://agri.test'}),previous=new Map();
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const originalFetch=globalThis.fetch,lands=[],simulations=[],held=[];let hold=false;
 globalThis.fetch=async(_url,options)=>{
  if(!options?.body)return Response.json({campaigns:[]});
  const body=JSON.parse(options.body);
  if(body.action==='land')return new Promise(resolve=>lands.push({resolve,body}));
  assert.equal(body.action,'simulate');simulations.push(body);
  const response=()=>Response.json({plan:planSeason({...body.config,landAssessment:landFixture(testParcel,40)},body.events),requestId:body.requestId});
  if(hold)return new Promise(resolve=>held.push(()=>resolve(response())));
  return response();
 };
 const {createRoot}=await import('react-dom/client'),element=window.document.createElement('div');window.document.body.append(element);
 const root=createRoot(element),view=()=>globalThis.__seasonalView;
 try{
  await act(async()=>root.render(React.createElement(Seasonal,{workspace:{session:{coopId:'test-coop',userId:'test-user'}},science:null})));
  const config={...exampleCampaign(),parcelGeometry:testParcel,landAssessment:landFixture(testParcel,40)};
  await act(async()=>view().onChange(config));
  await act(async()=>wait(400));assert.equal(lands.length,1);assert.equal(simulations.length,0,'A restored client assessment must not skip server preparation');
  await act(async()=>lands[0].resolve(Response.json({assessment:landFixture(testParcel,40)})));
  await act(async()=>wait(400));assert.equal(simulations.length,1);
  await act(async()=>view().onRetry());
  await act(async()=>wait(400));assert.equal(lands.length,2);assert.equal(lands[1].body.refresh,true);assert.equal(simulations.length,1,'Retry must wait for the refreshed terrain');
  await act(async()=>lands[1].resolve(Response.json({assessment:landFixture(testParcel,40)})));
  await act(async()=>wait(400));assert.equal(simulations.length,2);
  await act(async()=>view().onMap());assert.equal(view().paused,true,'Drawing suspends automatic acquisition');assert.equal(window.document.activeElement?.id,'seasonal-panel-carte','focus follows navigation to the parcel map');
  await act(async()=>wait(400));assert.equal(simulations.length,2);
  await act(async()=>globalThis.__parcelView.onPrepare('sorghum',config.sowingDate));
  assert.equal(view().paused,false);assert.equal(view().config.cropProfile.id,'sorghum');
  await act(async()=>wait(400));assert.equal(view().config.stages.length,0);assert.equal(simulations.length,2,'An unparameterised crop must not invent a cycle');
  await act(async()=>view().onMap());
  const chosenDate=new Date(Date.parse(config.sowingDate)+7*86400000).toISOString().slice(0,10);
  await act(async()=>globalThis.__parcelView.onPrepare('maize',chosenDate));
  assert.equal(view().config.sowingDate,chosenDate);assert.equal(view().paused,false);
  assert.equal(view().initialSection,'yield','the completed parcel flow opens the result view');
  await act(async()=>wait(400));assert.equal(simulations.length,3,'Preparing a parameterised crop resumes the calculation: '+view().calculationError);
  await act(async()=>view().onChange({...view().config,system:{...view().config.system,minIntervalDays:0}}));
  await act(async()=>wait(400));assert.equal(simulations.length,3);assert.match(view().calculationError,/Intervalle/);
  // A provider ignoring cancellation must never publish its superseded response.
  hold=true;
  await act(async()=>view().onChange({...view().config,system:{...view().config.system,minIntervalDays:1},fallback:{label:'First scenario',rainMmDay:1,et0MmDay:4}}));
  await act(async()=>wait(400));assert.equal(held.length,1);assert.equal(view().plan,null);
  await act(async()=>view().onChange({...view().config,fallback:{label:'Second scenario',rainMmDay:8,et0MmDay:4}}));
  await act(async()=>wait(400));assert.equal(held.length,2);
  await act(async()=>held[1]());assert.equal(view().stale,false);const newest=JSON.stringify(view().plan);
  await act(async()=>held[0]());assert.equal(JSON.stringify(view().plan),newest);
  await act(async()=>view().onRetry());
  await act(async()=>wait(400));assert.equal(view().plan,null);
  await act(async()=>lands.at(-1).resolve(Response.json({error:'Terrain unavailable'},{status:503})));
  assert.equal(view().stale,true);assert.equal(view().plan,null);assert.match(view().calculationError,/Terrain unavailable/);

 }finally{
  await act(async()=>root.unmount());globalThis.fetch=originalFetch;delete globalThis.__seasonalView;delete globalThis.__parcelView;
  for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  await window.happyDOM.close();
 }
});
