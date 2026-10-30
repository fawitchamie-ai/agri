'use client';
import type {Position} from '../../lib/seasonal/parcel';
import ParcelMapLight from './parcel-map-light';
export type MapCountry={type:'Feature';properties:{iso3:string;name:string;nameEn:string};geometry:{type:string;coordinates:any}};
export type CountriesGeo={type:'FeatureCollection';features:MapCountry[]};
export function countryBounds(f:MapCountry):[Position,Position]{
 const positions:Position[]=[];const walk=(v:any)=>{if(typeof v?.[0]==='number')positions.push(v);else if(Array.isArray(v))v.forEach(walk);};walk(f.geometry.coordinates);
 return [[Math.min(...positions.map(p=>p[0])),Math.min(...positions.map(p=>p[1]))],[Math.max(...positions.map(p=>p[0])),Math.max(...positions.map(p=>p[1]))]];
}
export type MapController={getCenter:()=>{lng:number;lat:number};getZoom:()=>number;flyTo:(options:{center:Position;zoom:number;duration?:number})=>void;fitBounds:(bounds:[Position,Position],options?:{padding?:number;maxZoom?:number;duration?:number})=>void};
export type ParcelMapProps={points:Position[];closed:boolean;drawing:boolean;drawMode:'center'|'tap';basemap:'satellite'|'plan';selected:string;onAdd:(p:Position)=>void;onMove:(i:number,p:Position)=>void;onClose:()=>void;onCountry:(iso:string)=>void;onReady:(m:MapController)=>void;onCountries:(c:CountriesGeo)=>void;onViewport?:(center:Position,zoom:number)=>void};
/** A single 2D interaction model on desktop and phones, including devices without WebGL. */
export default function ParcelMap(props:ParcelMapProps){return <ParcelMapLight {...props}/>;}
