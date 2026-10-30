/** Canvas rendering of OpenMapTiles: the lightweight map needs no WebGL.
 * Only currently visible tiles are fetched; no offline prefetch or tile proxy. */
import type * as Leaflet from 'leaflet';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
const STYLE='https://tiles.openfreemap.org/styles/liberty';
export const VECTOR_ATTRIBUTION='<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>';
export async function createVectorBasemap(L:typeof Leaflet,signal?:AbortSignal){
 const styleResponse=await fetch(STYLE,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});if(!styleResponse.ok)throw new Error('Fond vectoriel indisponible.');
 const style=await styleResponse.json() as {sources:Record<string,{type:string;url?:string;tiles?:string[];maxzoom?:number}>};
 const source=Object.values(style.sources).find(s=>s.type==='vector');if(!source)throw new Error('Source vectorielle absente.');
 let meta=source;
 if(source.url){const url=new URL(source.url);if(url.hostname!=='tiles.openfreemap.org')throw new Error('Fournisseur inattendu.');const r=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Métadonnées cartographiques indisponibles.');meta=await r.json();}
 const template=meta.tiles?.[0];if(!template||new URL(template.replaceAll('{z}','0').replaceAll('{x}','0').replaceAll('{y}','0')).hostname!=='tiles.openfreemap.org')throw new Error('Tuiles non disponibles.');
 const Grid=L.GridLayer.extend({createTile(coords:Leaflet.Coords,done:Leaflet.DoneCallback){
  const tile=document.createElement('canvas');tile.width=tile.height=256;const ctx=tile.getContext('2d')!;ctx.fillStyle='#f4f3e9';ctx.fillRect(0,0,256,256);
  const controller=new AbortController();(tile as any)._abort=controller;
  const url=template.replace('{z}',String(coords.z)).replace('{x}',String(coords.x)).replace('{y}',String(coords.y));
  fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Tuile indisponible');return r.arrayBuffer();}).then(async buffer=>{
   if(controller.signal.aborted)return;
   let sliceStart=performance.now();
   const yieldToInput=async()=>{await new Promise<void>(resolve=>setTimeout(resolve,0));if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');sliceStart=performance.now();};
   const data=new VectorTile(new Pbf(new Uint8Array(buffer)));
   const layers=['landcover','landuse','park','water','waterway','building','transportation','boundary'];
   for(const name of layers){const layer=data.layers[name];if(!layer)continue;
    for(let i=0;i<Math.min(layer.length,18000);i++){
     if(i%32===0&&performance.now()-sliceStart>5)await yieldToInput();
     const f=layer.feature(i),cls=String(f.properties.class??''),rings=f.loadGeometry(),scale=256/f.extent;
     ctx.beginPath();for(const ring of rings){ring.forEach((p,j)=>j?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));if(f.type===3)ctx.closePath();}
     ctx.setLineDash([]);
     if(f.type===3){ctx.fillStyle=name==='water'?'#b7d8dd':name==='building'?'#d8d4c7':name==='park'||['wood','forest','grass'].includes(cls)?'#d9e4c6':cls==='farmland'?'#e8ebcf':'#eeede3';ctx.fill('evenodd');if(name==='building'){ctx.strokeStyle='#c6c5b7';ctx.lineWidth=.4;ctx.stroke();}}
     else if(f.type===2){ctx.strokeStyle=name==='waterway'?'#a6d2da':name==='boundary'?'#c1b6bf':['motorway','trunk','primary','secondary'].includes(cls)?'#d3bb86':'#d5d2c7';ctx.lineWidth=name==='transportation'?(['motorway','trunk','primary'].includes(cls)?3:cls==='path'?.65:1.7):.8;if(name==='boundary')ctx.setLineDash([3,3]);ctx.stroke();if(name==='transportation'&&cls!=='path'){ctx.strokeStyle=['motorway','trunk','primary','secondary'].includes(cls)?'#f4dfad':'#fffef9';ctx.lineWidth=Math.max(.7,ctx.lineWidth-1);ctx.stroke();}}
    }
   }
   for(const name of ['place','poi']){if(name==='poi'&&coords.z<14)continue;const layer=data.layers[name];if(!layer)continue;for(let i=0;i<Math.min(layer.length,name==='place'?35:12);i++){const f=layer.feature(i);if(f.type!==1)continue;const text=String(f.properties['name:fr']??f.properties.name??'');if(!text||text.length>40)continue;const point=f.loadGeometry()[0]?.[0];if(!point)continue;const x=point.x*256/f.extent,y=point.y*256/f.extent;if(x<8||y<10||x>248||y>246)continue;ctx.font=name==='place'?'600 12px Arial':'9px Arial';ctx.textAlign='center';ctx.strokeStyle='#fffef6';ctx.lineWidth=3;ctx.strokeText(text,x,y);ctx.fillStyle=name==='place'?'#51604c':'#8b8d78';ctx.fillText(text,x,y);}}
   if(!controller.signal.aborted)done(undefined,tile);
  }).catch(e=>{if(e.name!=='AbortError')done(e,tile);});
  return tile;
 }});
 const layer=new (Grid as typeof Leaflet.GridLayer)({tileSize:256,minZoom:0,maxZoom:20,maxNativeZoom:meta.maxzoom??14,attribution:VECTOR_ATTRIBUTION,keepBuffer:1,updateWhenIdle:true,noWrap:true}) as Leaflet.GridLayer;
 layer.on('tileunload',(e:Leaflet.TileEvent)=>{(e.tile as any)._abort?.abort();});return layer;
}
