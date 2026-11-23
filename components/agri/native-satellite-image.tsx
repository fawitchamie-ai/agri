'use client';
import {useEffect,useRef,useState} from 'react';
import {framePoint} from '../../lib/seasonal/imagery-display';
import type {readSatelliteVisual} from '../../lib/seasonal/satellite-visual';

export default function NativeSatelliteImage({date,layer,bounds,onLoad,onError}:{date:string;layer:'rgb'|'classification'|'ndvi'|'contrast';bounds:number[];onLoad:(image:Awaited<ReturnType<typeof readSatelliteVisual>>)=>void;onError:(message:string)=>void}){
 const [loaded,setImage]=useState<{key:string;image:Awaited<ReturnType<typeof readSatelliteVisual>>}|null>(null),callbacks=useRef({onLoad,onError});
 useEffect(()=>{callbacks.current={onLoad,onError};},[onLoad,onError]);
 const requestKey=layer+':'+date+':'+bounds.join(',');
 const image=loaded?.key===requestKey?loaded.image:null;
 useEffect(()=>{
  const ctrl=new AbortController();let alive=true;
  import('../../lib/seasonal/satellite-visual').then(m=>m.readSatelliteVisual(bounds,date,layer,fetch,ctrl.signal)).then(r=>{if(alive){setImage({key:requestKey,image:r});callbacks.current.onLoad(r);}}).catch(e=>{if(alive)callbacks.current.onError((e as Error).message);});
  return()=>{alive=false;ctrl.abort();};
 // Bounds, date and layer cancel any earlier scene before it can paint.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[requestKey]);
 return image?<svg className="parcel-raster-image" viewBox="0 0 640 400" role="img" aria-label={layer==='ndvi'||layer==='contrast'?`${layer==='contrast'?'NDVI contrasté':'NDVI'} Sentinel-2 · pixels natifs à ${Math.round(image.resolutionM)} m · ${date}`:(layer==='rgb'?'Couleurs naturelles':'Nuages, sol et eau')+' Sentinel-2 · '+date}>
  {image.pixels.map((p,i)=>{const label=(layer==='ndvi'||layer==='contrast')&&p.value!==null?`NDVI ${p.value.toFixed(3)} · pixel source ${Math.round(image.resolutionM)} m`:undefined;return <path key={i} d={'M'+p.geometry.coordinates[0].map(v=>framePoint(v,bounds).join(',')).join('L')+'Z'} fill={p.color} stroke={p.color} strokeWidth=".15" aria-label={label}>{label&&<title>{label}</title>}</path>;})}
 </svg>:null;
}
