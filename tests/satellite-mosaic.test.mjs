import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {Window} from 'happy-dom';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
test('satellite mosaic waits for all four pieces, retries a failed source, and never paints a superseded date',async()=>{
 const built=await build({entryPoints:['components/agri/satellite-mosaic.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',external:['react','react/jsx-runtime']});
 const module={exports:{}};new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require);
 const Mosaic=module.exports.default,window=new Window({url:'https://agri.test'}),previous=new Map(),images=[],drawn=[],loaded=[],errors=[];
 class TestImage{constructor(){images.push(this);}crossOrigin='';onload=null;onerror=null;src='';}
 for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,Image:TestImage,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 window.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},drawImage(...args){drawn.push(args);}});
 const {createRoot}=await import('react-dom/client'),host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host);
 const render=date=>React.createElement(Mosaic,{layer:'ndvi',date,bounds:[1,9,1.01,9.01],onLoad:canvas=>loaded.push([date,canvas.width,canvas.height]),onError:()=>errors.push(date)});
 try{
  await act(async()=>root.render(render('2026-10-12')));assert.equal(images.length,4);assert.ok(images.every(i=>i.crossOrigin==='anonymous'&&i.src.startsWith('https://ows.digitalearth.africa/')));
  const obsolete=images.map(i=>i.onload);
  await act(async()=>root.render(render('2026-10-13')));assert.equal(images.length,8);assert.ok(images.slice(0,4).every(i=>i.src===''&&i.onload===null));
  await act(async()=>obsolete.forEach(resolve=>resolve()));assert.equal(drawn.length,0);assert.equal(loaded.length,0,'Old requests cannot paint over a new date');
  await act(async()=>images[4].onerror());assert.ok(images[4].src.startsWith('/api/seasonal?'),'Proxy fallback is bounded to the same layer/date/extent');
  await act(async()=>images.slice(4,7).forEach(i=>i.onload()));assert.equal(drawn.length,0,'Never show an apparently complete image with a missing quadrant');
  await act(async()=>images[7].onload());assert.equal(drawn.length,4);assert.deepEqual(loaded,[['2026-10-13',1024,640]]);assert.equal(errors.length,0);
  assert.deepEqual(drawn.map(args=>args.slice(1)),[[0,0,512,320],[512,0,512,320],[0,320,512,320],[512,320,512,320]]);
  await act(async()=>root.render(render('2026-10-14')));await act(async()=>{images[8].onerror();images[8].onerror();});assert.deepEqual(errors,['2026-10-14']);assert.equal(loaded.length,1);
 }finally{
  await act(async()=>root.unmount());for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];await window.happyDOM.close();
 }
});
