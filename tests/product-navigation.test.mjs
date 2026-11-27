import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('wrangler'))('esbuild');

test('the web root redirects to the single field workspace',async()=>{
 const result=await build({
  entryPoints:['app/page.tsx'],bundle:true,platform:'node',format:'cjs',write:false,
  plugins:[{name:'mock-next-navigation',setup(builder){
   builder.onResolve({filter:/^next\/navigation$/},()=>({path:'next-navigation',namespace:'test'}));
   builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'exports.redirect=path=>{globalThis.__agriRedirect=path;};',loader:'js'}));
  }}],
 });
 const pageModule={exports:{}};
 new Function('module','exports','require',result.outputFiles[0].text)(pageModule,pageModule.exports,require);
 delete globalThis.__agriRedirect;
 pageModule.exports.default();
 assert.equal(globalThis.__agriRedirect,'/field-workspace/');
 delete globalThis.__agriRedirect;
});
