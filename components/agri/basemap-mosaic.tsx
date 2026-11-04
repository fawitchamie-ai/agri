'use client';
import {useEffect,useRef,useState} from 'react';
import {basemapTilePlan} from '../../lib/seasonal/imagery-display';
/** Keep each source tile at its real geographic position; only reveal complete frames. */
export default function BasemapMosaic({bounds,onLoad,onError}:{bounds:number[];onLoad:()=>void;onError:()=>void}){
 const key=bounds.join(','),[offset,setOffset]=useState(0),[ready,setReady]=useState(false);
 const loaded=useRef(new Set<string>()),failed=useRef(false),callbacks=useRef({onLoad,onError});callbacks.current={onLoad,onError};
 const plan=basemapTilePlan(bounds,offset),generation=key+':'+offset,current=useRef(generation);current.current=generation;
 useEffect(()=>{setOffset(0);setReady(false);},[key]);
 useEffect(()=>{loaded.current.clear();failed.current=false;setReady(false);const timer=setTimeout(()=>{if(!failed.current&&!ready){failed.current=true;callbacks.current.onError();}},25000);return()=>clearTimeout(timer);},[generation]);
 function success(id:string){if(current.current!==generation||failed.current)return;loaded.current.add(id);if(loaded.current.size===plan.tiles.length){failed.current=true;setReady(true);callbacks.current.onLoad();}}
 function failure(){if(current.current!==generation||failed.current)return;failed.current=true;if(offset>-2)setOffset(x=>x-1);else callbacks.current.onError();}
 return <div className="parcel-raster-image basemap-mosaic" role="img" aria-label="Fond photo de repérage Esri, date non documentée" style={{visibility:ready?'visible':'hidden'}}>{plan.tiles.map(t=><img key={t.id} src={t.src} crossOrigin="anonymous" alt="" draggable={false} style={{left:t.left+'%',top:t.top+'%',width:t.width+'%',height:t.height+'%'}} onLoad={()=>success(t.id)} onError={failure}/>)}</div>;
}
