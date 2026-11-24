'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {framePoint} from '../../lib/seasonal/imagery-display';
import type {ParcelPolygon} from '../../lib/seasonal/parcel';
import type {readSatelliteVisual} from '../../lib/seasonal/satellite-visual';
import {cacheNativeSatelliteImage,getCachedNativeSatelliteImage,nativeSatelliteImageCacheKey} from '../../lib/seasonal/native-image-cache';
export {cacheNativeSatelliteImage,getCachedNativeSatelliteImage,hasCachedNativeSatelliteImage,nativeSatelliteImageCacheKey} from '../../lib/seasonal/native-image-cache';

type NativeLayer='rgb'|'classification'|'ndvi'|'contrast';
type NativeImage=Awaited<ReturnType<typeof readSatelliteVisual>>;
export default function NativeSatelliteImage({date,layer,bounds,geometry,itemId,onLoad,onError}:{date:string;layer:'rgb'|'classification'|'ndvi'|'contrast';bounds:number[];geometry:ParcelPolygon;itemId?:string;onLoad:(image:Awaited<ReturnType<typeof readSatelliteVisual>>)=>void;onError:(message:string)=>void}){
 const request={layer,date,bounds,geometry,itemId},requestKey=nativeSatelliteImageCacheKey(request);
 const [loaded,setImage]=useState<{key:string;image:Awaited<ReturnType<typeof readSatelliteVisual>>}|null>(()=>{const cached=getCachedNativeSatelliteImage(request);return cached?{key:requestKey,image:cached}:null;}),callbacks=useRef({onLoad,onError});
 useEffect(()=>{callbacks.current={onLoad,onError};},[onLoad,onError]);
 const image=loaded?.key===requestKey?loaded.image:null;
 useEffect(()=>{
  const cached=getCachedNativeSatelliteImage(request);
  if(cached){setImage({key:requestKey,image:cached});callbacks.current.onLoad(cached);return;}
  const ctrl=new AbortController();let alive=true;
  import('../../lib/seasonal/satellite-visual').then(m=>m.readSatelliteVisual(bounds,date,layer,fetch,ctrl.signal,undefined,itemId,geometry)).then(r=>{if(alive){cacheNativeSatelliteImage(request,r);setImage({key:requestKey,image:r});callbacks.current.onLoad(r);}}).catch(e=>{if(alive)callbacks.current.onError((e as Error).message);});
  return()=>{alive=false;ctrl.abort();};
 // Bounds, date and layer cancel any earlier scene before it can paint.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[requestKey]);
 return image?<NativeSatellitePixels image={image} date={date} layer={layer} bounds={bounds} geometry={geometry}/>:null;
}

/** The clipping path and native footprints use the same geographic frame.
 * Even-odd clipping preserves holes without subdividing or resampling pixels. */
export function NativeSatellitePixels({image,date,layer,bounds,geometry}:{image:NativeImage;date:string;layer:NativeLayer;bounds:number[];geometry:ParcelPolygon}){
 const clipId='sentinel-field-'+useId().replace(/[^a-zA-Z0-9_-]/g,''),index=layer==='ndvi'||layer==='contrast';
 const outline=geometry.coordinates.map(r=>'M'+r.map(v=>framePoint(v,bounds).join(',')).join('L')+'Z').join(' ');
 // The shared raster class has an opaque no-data checkerboard. NDVI must keep
 // its full SVG viewport transparent so the basemap remains visible outside
 // the clipped field (and in holes); clipping the pixel group cannot clip CSS.
 return <svg className="parcel-raster-image" style={index?{background:'transparent'}:undefined} viewBox="0 0 640 400" role="img" data-resolution-m={image.resolutionM} aria-label={index?`${layer==='contrast'?'NDVI contrasté':'NDVI'} Sentinel-2 · pixels natifs à ${Math.round(image.resolutionM)} m · ${date}`:(layer==='rgb'?'Couleurs naturelles':'Nuages, sol et eau')+' Sentinel-2 · '+date}>
  {index&&<defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={outline} clipRule="evenodd" fillRule="evenodd"/></clipPath></defs>}
  <g clipPath={index?'url(#'+clipId+')':undefined}>
  {image.pixels.map((p,i)=>{const label=(layer==='ndvi'||layer==='contrast')&&p.value!==null?`NDVI ${p.value.toFixed(3)} · pixel source ${Math.round(image.resolutionM)} m`:undefined;return <path key={i} d={'M'+p.geometry.coordinates[0].map(v=>framePoint(v,bounds).join(',')).join('L')+'Z'} fill={p.color} stroke={p.color} strokeWidth=".15" aria-label={label}>{label&&<title>{label}</title>}</path>;})}
  </g>
 </svg>;
}
