'use client';
import {useEffect,useRef,useState} from 'react';
import {satelliteTilePlan,type SatelliteLayer} from '../../lib/seasonal/satellite';

/** Assemble bounded provider images on the client, rather than stretching one 512 px request. */
export default function SatelliteMosaic({layer,date,bounds,onLoad,onError}:{layer:SatelliteLayer;date:string;bounds:number[];onLoad:(canvas:HTMLCanvasElement)=>void;onError:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),callbacks=useRef({onLoad,onError});callbacks.current={onLoad,onError};
 const [ready,setReady]=useState(false),key=`${layer}:${date}:${bounds.join(',')}`;
 useEffect(()=>{
  let active=true;const images:HTMLImageElement[]=[];setReady(false);
  const load=(src:string,direct:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
   const img=new Image();images.push(img);img.crossOrigin='anonymous';let retried=false;
   img.onload=()=>resolve(img);img.onerror=()=>{if(!active)return;if(!retried){retried=true;img.src=direct;}else reject(new Error('Image indisponible'));};img.src=src;
  });
  Promise.all(satelliteTilePlan(layer,date,bounds).map(t=>load(t.direct,t.src))).then(parts=>{
   if(!active||!canvas.current)return;const ctx=canvas.current.getContext('2d');if(!ctx)throw new Error('Affichage indisponible');
   ctx.clearRect(0,0,1024,640);parts.forEach((img,i)=>ctx.drawImage(img,(i%2)*512,Math.floor(i/2)*320,512,320));
   setReady(true);callbacks.current.onLoad(canvas.current);
  }).catch(()=>{if(active)callbacks.current.onError();});
  return()=>{active=false;images.forEach(img=>{img.onload=null;img.onerror=null;img.src='';});};
 // The key includes every extent coordinate; geometry changes cancel all previous requests.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 return <canvas ref={canvas} width={1024} height={640} className={`parcel-raster-image${layer==='rgb'?'':' analytical-raster'}${layer==='classification'?' categorical':''}`} style={{visibility:ready?'visible':'hidden'}} role="img" aria-label={`${layer}, observation du ${date}, palette bleue de présentation`}/>;
}
