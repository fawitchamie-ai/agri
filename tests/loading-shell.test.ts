import test from 'node:test';import assert from 'node:assert/strict';
import {loadingShell} from '../worker/shell.ts';
test('build shell handles only root documents and preserves hydration content without caching identity',async()=>{
 let calls=0;const assets={async fetch(r:Request){calls++;assert.equal(new URL(r.url).pathname,'/_shell/index.html');return new Response('<html><script src="/app.js"></script></html>',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=3600'}});}};
 const r=await loadingShell(new Request('https://agri.test/?view=seasonal'),assets);assert.equal(r!.headers.get('X-Agri-Rendering'),'build-shell');assert.equal(r!.headers.get('Cache-Control'),'private, no-store');assert.match(await r!.text(),/app.js/);
 for(const req of [new Request('https://agri.test/api/workspace'),new Request('https://agri.test/',{method:'POST'}),new Request('https://agri.test/',{headers:{rsc:'1'}}),new Request('https://agri.test/?_rsc=x'),new Request('https://agri.test/',{headers:{accept:'text/x-component'}})])assert.equal(await loadingShell(req,assets),null);
 assert.equal(calls,1);assert.equal(await loadingShell(new Request('https://agri.test/')),null);
 assert.equal(await loadingShell(new Request('https://agri.test/'),{async fetch(){return new Response('',{status:404});}}),null);
});
