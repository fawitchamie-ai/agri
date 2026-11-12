import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const bundle=await build({entryPoints:['components/agri/fertilizer-response-chart.tsx'],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,jsx:'automatic'}),compiled={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
const Chart=compiled.exports.default;
test('fertilizer graph shows paired results for each actual profile, without inventing an average',()=>{
 const html=renderToStaticMarkup(React.createElement(Chart,{profiles:[{id:'a',label:'Profil A',withoutKgHa:2660,withKgHa:3260},{id:'b',label:'Profil B',withoutKgHa:990,withKgHa:1770}]}));
 assert.match(html,/2,66 → 3,26 t\/ha/);assert.match(html,/0,99 → 1,77 t\/ha/);assert.match(html,/non validée localement/);assert.match(html,/ne constituent pas un intervalle de confiance/);assert.match(html,/role="img"/);assert.equal((html.match(/<circle/g)||[]).length,2);assert.equal((html.match(/<rect/g)||[]).length,2);
});
test('missing or non-finite results never render an invented graph',()=>{
 assert.equal(renderToStaticMarkup(React.createElement(Chart,{profiles:[]})),'');
 assert.equal(renderToStaticMarkup(React.createElement(Chart,{profiles:[{id:'a',label:'A',withoutKgHa:NaN,withKgHa:1000}]})),'');
});
