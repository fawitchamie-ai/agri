import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {Window} from 'happy-dom';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('public replay executes the application model; changed irrigation recalculates grain and suppresses invalid accuracy comparisons',async()=>{
 const html=readFileSync('public/scientific/togo-stage-replay.html','utf8'),window=new Window({url:'https://agri.test/scientific/togo-stage-replay.html',settings:{enableJavaScriptEvaluation:false}});
 window.document.write(html);Object.assign(globalThis,{window,document:window.document});
 try{
  const b=await build({entryPoints:['scripts/togo-stage-lab.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,define:{__AGRI_BENCH_COMMIT__:'"synthetic-build"'}});
  const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
  const rowText=()=>window.document.getElementById('results').textContent;
  assert.match(rowText(),/2,200/);assert.match(rowText(),/2,156/);assert.match(rowText(),/1,405/);assert.equal(window.document.getElementById('rmse').textContent,'0,331 t/ha');
  const before=rowText(),slider=window.document.getElementById('dose-2');slider.value='.8';slider.dispatchEvent(new window.Event('input'));
  assert.notEqual(rowText(),before);assert.equal(window.document.getElementById('rmse').textContent,'—');assert.match(window.document.getElementById('comparison-status').textContent,/aucune récolte observée correspondante/);
  window.document.getElementById('reset').click();assert.equal(rowText(),before);assert.equal(window.document.getElementById('served-commit').textContent,'synthetic-build');
 }finally{await window.happyDOM.close();}
});
