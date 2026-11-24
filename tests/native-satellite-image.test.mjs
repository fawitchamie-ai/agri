import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Window} from 'happy-dom';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');

test('native NDVI layers clip all source pixels to the field and its holes with independent comparison masks',async()=>{
 const result=await build({entryPoints:['components/agri/native-satellite-image.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external'}),mod={exports:{}};
 new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,require);
 const Pixels=mod.exports.NativeSatellitePixels,window=new Window();
 const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[.4,.7],[0,1],[0,0]],[[.2,.2],[.3,.2],[.3,.3],[.2,.3],[.2,.2]]]},bounds=[-.5,-.5,1.5,1.5];
 const pixel={type:'Polygon',coordinates:[[[0,0],[.1,0],[.1,.1],[0,.1],[0,0]]]},image={date:'2024-10-19',itemId:'test',source:'synthetic software test',resolutionM:10,pixels:[{geometry:pixel,value:.5,color:'#00ff00'}],valueRange:[.5,.5],maskReason:null};
 try{
  window.document.body.innerHTML=renderToStaticMarkup(React.createElement('div',null,...['ndvi','contrast','rgb'].map(layer=>React.createElement(Pixels,{key:layer,layer,image,date:image.date,geometry,bounds}))));
  const svgs=[...window.document.querySelectorAll('svg')],ids=[];
  for(const svg of svgs.slice(0,2)){
   assert.equal(svg.getAttribute('data-resolution-m'),'10');assert.match(svg.getAttribute('aria-label'),/10 m/);
   assert.equal(svg.style.background,'transparent','The shared opaque raster checkerboard must not cover the Esri basemap outside the clipped NDVI pixels');
   const mask=svg.querySelector('clipPath'),path=mask.querySelector('path'),group=svg.querySelector('g');ids.push(mask.id);
   assert.equal(mask.getAttribute('clipPathUnits'),'userSpaceOnUse');assert.equal(path.getAttribute('clip-rule'),'evenodd');assert.equal(path.getAttribute('fill-rule'),'evenodd');
   assert.equal((path.getAttribute('d').match(/M/g)??[]).length,2,'Both the concave outer contour and inner hole are included');
   assert.equal(group.getAttribute('clip-path'),'url(#'+mask.id+')');assert.equal(group.querySelectorAll('path').length,1,'No subdivision creates artificial smaller pixels');
   assert.match(group.querySelector('path').getAttribute('aria-label'),/NDVI 0.500 · pixel source 10 m/);
  }
  assert.equal(new Set(ids).size,2,'Comparison views cannot borrow each other’s clip mask');
  assert.equal(svgs[2].querySelector('clipPath'),null,'RGB keeps its surrounding geographic context');
  assert.equal(svgs[2].style.background,'','RGB retains its own no-data background policy');
 }finally{await window.happyDOM.close();}
});

test('a loaded NDVI image is reused after the date view remounts and zoom does not invalidate it',async()=>{
 const result=await build({entryPoints:['components/agri/native-satellite-image.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',packages:'external'}),mod={exports:{}};
 new Function('module','exports','require',result.outputFiles[0].text)(mod,mod.exports,require);
 const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},pixel={type:'Polygon',coordinates:[[[0,0],[.1,0],[.1,.1],[0,.1],[0,0]]]},request={layer:'ndvi',date:'2026-11-23',bounds:[-.5,-.5,1.5,1.5],geometry,itemId:'sentinel-2026-11-23'};
 const image={date:request.date,itemId:request.itemId,source:'synthetic test scene',resolutionM:10,pixels:[{geometry:pixel,value:.5,color:'#00ff00'}],valueRange:[-1,1],mask:{clear:1,cloud:0,shadow:0,noData:0,water:0,uncertain:0},maskReason:null};
 assert.equal(mod.exports.cacheNativeSatelliteImage(request,image),true);
 assert.ok(mod.exports.hasCachedNativeSatelliteImage(request));
 assert.equal(mod.exports.nativeSatelliteImageCacheKey(request),mod.exports.nativeSatelliteImageCacheKey({...request,bounds:[-.2,-.2,1.2,1.2]}),'Field NDVI pixels do not depend on the map zoom rectangle');
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{...request,onLoad:()=>{},onError:()=>{}}));
 assert.match(html,/data-resolution-m="10"/,'a newly mounted date view renders the already loaded 10 m image from memory');
 assert.match(html,/NDVI Sentinel-2 · pixels natifs à 10 m · 2026-11-23/);
});
