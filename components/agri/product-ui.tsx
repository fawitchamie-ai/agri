'use client';
import {useState,type ReactNode} from 'react';
import type {ParcelPolygon} from '../../lib/seasonal/parcel';
export function ProductIcon({name,size=20}:{name:string;size?:number}){
 const shapes:Record<string,ReactNode>={
  leaf:<><path d="M20 3C9 2 3 7 4 14c1 7 12 8 15-2 1-3 1-6 1-9Z"/><path d="m3 22 12-13"/></>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  map:<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15m6-12v15"/></>,
  chart:<><path d="M4 3v17h17M8 15l4-5 4 3 5-8"/></>,
  water:<><path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/></>,
  basket:<><path d="m7 9 5-6 5 6M3 10h18l-2 10H5zM9 13v4m6-4v4"/></>,
  book:<><path d="M12 5C9 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1v16Z"/></>,
  people:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></>,
  settings:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/></>,
  arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,back:<path d="M20 12H4m6-6-6 6 6 6"/>,plus:<path d="M12 4v16M4 12h16"/>,
  save:<><path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h9V3M7 21v-7h10v7"/></>,
  file:<><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h8"/></>,
  close:<path d="m5 5 14 14M5 19 19 5"/>,check:<path d="m4 12 5 5L20 6"/>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  satellite:<><path d="m9 9 6 6m-4-9 7 7-5 5-7-7zM3 4l4 4-3 3-4-4zm14 13 4 4 3-3-4-4zM4 16a4 4 0 0 1 4 4m-7-5a8 8 0 0 1 8 8"/></>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]??shapes.leaf}</svg>;
}
export function ProductBrand({onClick}:{onClick:()=>void}){return <button className="product-brand" onClick={onClick} aria-label="AgriPrévision, accueil"><span className="product-brand-symbol"><ProductIcon name="leaf" size={25}/></span><span>Agri<span className="brand-light">Prévision</span><small>TERRES D’AFRIQUE</small></span></button>;}
export function Disclosure({title,description,children,initialOpen=false}:{title:string;description?:string;children:ReactNode;initialOpen?:boolean}){
 const [open,setOpen]=useState(initialOpen);
 return <details className="product-disclosure" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary><span>{title}{description&&<small>{description}</small>}</span><span aria-hidden="true">+</span></summary>{open&&<div className="disclosure-body">{children}</div>}</details>;
}
export function ParcelFootprint({geometry,label='Contour de la parcelle'}:{geometry?:ParcelPolygon;label?:string}){
 const rings=geometry?.coordinates??[[[0,0],[5,1],[6,4],[2,5],[-1,3],[0,0]]];
 const points=rings.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys),middle=(south+north)/2;
 const k=Math.cos(middle*Math.PI/180),width=(east-west)*k,height=north-south,scale=Math.min(300/(width||1),230/(height||1));
 const project=([x,y]:number[])=>`${200+(x-(west+east)/2)*k*scale},${155-(y-(south+north)/2)*scale}`;
 return <svg className="parcel-footprint" viewBox="0 0 400 310" role="img" aria-label={label}><defs><pattern id="field-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0v28" fill="none" stroke="currentColor" strokeOpacity=".07"/></pattern><pattern id="field-rows" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0v9" stroke="#3d7756" strokeOpacity=".2" strokeWidth="3"/></pattern></defs><rect width="400" height="310" fill="#eef3ec"/><rect width="400" height="310" fill="url(#field-grid)"/><path d={rings.map(r=>'M'+r.map(project).join('L')+'Z').join('')} fill="#c9dfb5" fillRule="evenodd" stroke="#367654" strokeWidth="2"/><path d={rings.map(r=>'M'+r.map(project).join('L')+'Z').join('')} fill="url(#field-rows)" fillRule="evenodd"/>{rings[0].slice(0,-1).map((p,i)=><circle key={i} cx={project(p).split(',')[0]} cy={project(p).split(',')[1]} r="3" fill="white" stroke="#367654" strokeWidth="1.5"/>)}<text x="370" y="27" fontSize="11" fill="#50745c">N ↑</text></svg>;
}
