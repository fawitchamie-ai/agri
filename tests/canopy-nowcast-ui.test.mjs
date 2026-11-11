import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {Window} from 'happy-dom';import React,{act} from 'react';import {canopyFixture} from './support/canopy-fixture.ts';import {planSeason} from '../lib/seasonal/yield.ts';
const window=new Window({url:'https://agri.test',settings:{enableJavaScriptEvaluation:false}});Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/canopy-nowcast-panel.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
test('the actual canopy panel renders the calculated field result, uncertainty failure and stale-state suppression',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let config=canopyFixture(),stale=false;
 const render=()=>root.render(React.createElement(compiled.exports.default,{config,plan:planSeason(config),stale,onChange:next=>{config=next;render();}}));
 try{await act(async()=>render());assert.match(host.textContent,/GRAIN ESTIMÉ PAR LE COUVERT/);assert.match(host.textContent,/70 %/);assert.match(host.textContent,/Humidité de référence non précisée/);
 stale=true;await act(async()=>render());assert.ok(!host.textContent.includes('GRAIN ESTIMÉ PAR LE COUVERT'));assert.match(host.textContent,/Recalcul/);
 stale=false;await act(async()=>render());const remove=[...host.querySelectorAll('button')].find(b=>b.textContent==='Retirer ce suivi expérimental');await act(async()=>remove.click());assert.equal(config.canopyNowcast,undefined);assert.ok(!host.textContent.includes('GRAIN ESTIMÉ PAR LE COUVERT'));
 }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});
