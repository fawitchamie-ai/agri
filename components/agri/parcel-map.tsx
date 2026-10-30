'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as GLMap,Marker,GeoJSONSource} from 'maplibre-gl';
import type {Position} from '../../lib/seasonal/parcel';
import {COUNTRY_VIEWS} from '../../lib/seasonal/parcel';
import {COUNTRIES} from '../../lib/seasonal/types';
import 'maplibre-gl/dist/maplibre-gl.css';
import ParcelMapLight from './parcel-map-light';

export type MapCountry={type:'Feature';properties:{iso3:string;name:string;nameEn:string};geometry:{type:string;coordinates:any}};
export type CountriesGeo={type:'FeatureCollection';features:MapCountry[]};
export function countryBounds(f:MapCountry):[Position,Position]{
 const positions:Position[]=[];const walk=(v:any)=>{if(typeof v?.[0]==='number')positions.push(v);else if(Array.isArray(v))v.forEach(walk);};walk(f.geometry.coordinates);
 return [[Math.min(...positions.map(p=>p[0])),Math.min(...positions.map(p=>p[1]))],[Math.max(...positions.map(p=>p[0])),Math.max(...positions.map(p=>p[1]))]];
}
export type MapController={getCenter:()=>{lng:number;lat:number};flyTo:(options:{center:Position;zoom:number;duration?:number})=>void;fitBounds:(bounds:[Position,Position],options?:{padding?:number;maxZoom?:number;duration?:number})=>void};
export type ParcelMapProps={points:Position[];closed:boolean;drawing:boolean;basemap:'earth'|'plan';selected:string;onAdd:(p:Position)=>void;onMove:(i:number,p:Position)=>void;onClose:()=>void;onCountry:(iso:string)=>void;onReady:(m:MapController)=>void;onCountries:(c:CountriesGeo)=>void};
export default function ParcelMap(props:ParcelMapProps){
 const host=useRef<HTMLDivElement>(null),map=useRef<GLMap|null>(null),handles=useRef<Marker[]>([]),latest=useRef(props);
 latest.current=props;
 const [light,setLight]=useState(false);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[center,setCenter]=useState<Position>([18,5]),[zoom,setZoom]=useState(1.8);
 useEffect(()=>{
  let disposed=false;let labels:Marker[]=[];
  import('maplibre-gl').then(async lib=>{
   if(disposed||!host.current)return;
   const ml=lib.default??lib;
   const m=new ml.Map({container:host.current,center:[18,5],zoom:1.8,minZoom:1,maxZoom:20,attributionControl:false,renderWorldCopies:false,
    style:'https://tiles.openfreemap.org/styles/liberty',
   });
   map.current=m;const resize=new ResizeObserver(()=>m.resize());resize.observe(host.current);m.on('remove',()=>resize.disconnect());m.addControl(new ml.NavigationControl({visualizePitch:true}),'top-right');m.addControl(new ml.ScaleControl({unit:'metric'}),'bottom-left');m.addControl(new ml.AttributionControl({compact:true,customAttribution:'Frontières : Natural Earth'}),'bottom-right');
   m.on('error',e=>{if('sourceId' in e&&(e.sourceId==='earth'||e.sourceId==='plan'))setError('Le fond de carte est momentanément indisponible. Vous pouvez changer de vue ou saisir les points GPS.');});
   m.on('moveend',()=>{const c=m.getCenter();setCenter([c.lng,c.lat]);setZoom(m.getZoom());});
   m.on('click',e=>{
    const p=latest.current;
    if(p.drawing){if(m.getZoom()<12){setError('Zoomez davantage pour placer les limites du champ, ou ajoutez vos coordonnées GPS.');return;}
     setError('');const first=p.points[0];if(first&&p.points.length>=3){const px=m.project(first);if(Math.hypot(px.x-e.point.x,px.y-e.point.y)<18){p.onClose();return;}}
     p.onAdd([Number(e.lngLat.lng.toFixed(8)),Number(e.lngLat.lat.toFixed(8))]);return;
    }
    if(!p.points.length&&m.getLayer('country-fill')){const f=m.queryRenderedFeatures(e.point,{layers:['country-fill']})[0];if(f?.properties?.iso3)p.onCountry(f.properties.iso3);}
   });
   m.on('load',async()=>{
    if(disposed)return;
    m.setProjection({type:'globe'});
    m.addSource('earth',{type:'raster',tiles:['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],tileSize:256,maxzoom:8,attribution:'Vue Terre : NASA GIBS Blue Marble'});
    m.addLayer({id:'earth',type:'raster',source:'earth',paint:{'raster-opacity':latest.current.basemap==='earth'?['interpolate',['linear'],['zoom'],8,1,10,0]:0}});
    try{
     const r=await fetch('/maps/africa-countries.geojson');if(!r.ok)throw new Error();const geo=await r.json() as CountriesGeo;if(disposed)return;
     latest.current.onCountries(geo);m.addSource('countries',{type:'geojson',data:geo as any});
     m.addLayer({id:'country-fill',type:'fill',source:'countries',paint:{'fill-color':['case',['in',['get','iso3'],['literal',Object.keys(COUNTRIES)]],'#b9d279','#d4dfc8'],'fill-opacity':['interpolate',['linear'],['zoom'],1,.14,7,.08,10,0]}});
     m.addLayer({id:'country-line',type:'line',source:'countries',paint:{'line-color':'#f5f7de','line-width':.9,'line-opacity':['interpolate',['linear'],['zoom'],2,.65,8,.35,11,0]}});
    }catch{setError('Limites des pays non chargées. Le plan et la saisie GPS restent disponibles.');}
    m.addSource('parcel',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'parcel-fill',type:'fill',source:'parcel',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#b9ee66','fill-opacity':.26}});
    m.addLayer({id:'parcel-line',type:'line',source:'parcel',paint:{'line-color':'#f2ffab','line-width':3,'line-dasharray':[2,1]}});
    for(const [id,view] of Object.entries(COUNTRY_VIEWS)){
     const button=document.createElement('button');button.type='button';button.className='country-map-label';button.textContent=COUNTRIES[id as keyof typeof COUNTRIES].name;button.setAttribute('aria-label','Explorer '+button.textContent);
     button.onclick=e=>{e.stopPropagation();latest.current.onCountry(id);};const marker=new lib.Marker({element:button,anchor:'center'}).setLngLat(view.center).addTo(m);labels.push(marker);
    }
    const updateLabels=()=>labels.forEach(l=>{l.getElement().style.display=(m.getZoom()>=4&&Object.entries(COUNTRY_VIEWS)[labels.indexOf(l)]?.[0]===latest.current.selected||m.getZoom()>=6)&&m.getZoom()<8?'':'none';});m.on('zoomend',updateLabels);updateLabels();
    latest.current.onReady(m);setReady(true);
   });
  }).catch(()=>{if(!disposed)setLight(true);});
  return()=>{disposed=true;handles.current.forEach(h=>h.remove());labels.forEach(l=>l.remove());map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  m.setPaintProperty('earth','raster-opacity',props.basemap==='earth'?['interpolate',['linear'],['zoom'],8,1,10,0]:0);

 },[props.basemap,ready]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  if(m.getLayer('country-line'))m.setPaintProperty('country-line','line-color',['case',['==',['get','iso3'],props.selected],'#f4dd88','#f5f7de']);
 },[props.selected,ready]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  const points=props.points;const features:any[]=[];
  if(points.length>=3)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...points,points[0]]]}});
  else if(points.length>=2)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}});
  (m.getSource('parcel') as GeoJSONSource)?.setData({type:'FeatureCollection',features});
  handles.current.forEach(h=>h.remove());handles.current=[];
  let cancelled=false;
  import('maplibre-gl').then(lib=>{if(cancelled||map.current!==m)return;
   points.forEach((point,i)=>{const el=document.createElement('button');el.type='button';el.className='parcel-vertex';el.textContent=String(i+1);el.setAttribute('aria-label',`Sommet ${i+1}, longitude ${point[0]}, latitude ${point[1]}. Déplaçable sur la carte ou dans la liste des points.`);
    el.onclick=e=>{e.stopPropagation();if(i===0&&latest.current.drawing&&latest.current.points.length>=3)latest.current.onClose();};
    const marker=new lib.Marker({element:el,draggable:!props.closed}).setLngLat(point).addTo(m);marker.on('dragend',()=>{const p=marker.getLngLat();latest.current.onMove(i,[Number(p.lng.toFixed(8)),Number(p.lat.toFixed(8))]);});handles.current.push(marker);
   });
  });
  m.getCanvas().style.cursor=props.drawing?'crosshair':'';
  return()=>{cancelled=true;};
 },[props.points,props.closed,props.drawing,ready]);
 if(light)return <ParcelMapLight {...props}/>;
 return <div className={'parcel-canvas-wrap'+(props.drawing?' is-drawing':'')}>
  <div ref={host} className="parcel-canvas" aria-label="Carte interactive de l’Afrique. Déplacez et zoomez la carte, puis placez les sommets de votre champ."/>
  {!ready&&!error&&<div className="map-loading" role="status"><span className="map-loader"/>Votre coin de terre arrive…</div>}
  {error&&<div className="map-service-message" role="status">{error}<button type="button" aria-label="Fermer le message de carte" onClick={()=>setError('')}>×</button></div>}
  <div className="map-coordinate-readout">{Math.abs(center[1]).toFixed(5)}° {center[1]>=0?'N':'S'} · {Math.abs(center[0]).toFixed(5)}° {center[0]>=0?'E':'O'} <span>Zoom {zoom.toFixed(1)}</span></div>
 </div>;
}
