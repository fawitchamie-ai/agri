'use client';
import {useEffect,useRef,useState} from 'react';
import type * as L from 'leaflet';
import type {CampaignSummary} from '../../lib/seasonal/types';
import {COUNTRY_VIEWS,type ParcelPolygon} from '../../lib/seasonal/parcel';
import 'leaflet/dist/leaflet.css';

type Props={campaigns:CampaignSummary[];selectedId:string;onSelect:(id:string)=>void;visible:boolean};
type Base='satellite'|'plan';
const validGeometry=(shape?:ParcelPolygon|null):shape is ParcelPolygon=>!!shape&&shape.type==='Polygon'&&!!shape.coordinates?.[0]&&shape.coordinates[0].length>=4;

/** Field-first overview map: it only draws the saved parcel boundaries the user can access. */
export default function FieldOverviewMap({campaigns,selectedId,onSelect,visible}:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),lib=useRef<typeof L|null>(null),layers=useRef<L.LayerGroup|null>(null),bases=useRef<{satellite?:L.TileLayer;plan?:L.TileLayer}>({});
 const [ready,setReady]=useState(false),[base,setBase]=useState<Base>('satellite'),[mapError,setMapError]=useState('');
 useEffect(()=>{
  let disposed=false,resize:ResizeObserver|undefined;
  import('leaflet').then(mod=>{
   if(disposed||!host.current)return;
   const l=mod.default??mod;lib.current=l;
   const view=COUNTRY_VIEWS.TGO;
   const m=l.map(host.current,{center:[view.center[1],view.center[0]],zoom:Math.round(view.zoom),minZoom:2,maxZoom:21,zoomControl:false,attributionControl:false,worldCopyJump:true,preferCanvas:true});
   map.current=m;layers.current=l.layerGroup().addTo(m);
   l.control.zoom({position:'topright',zoomInTitle:'Rapprocher',zoomOutTitle:'Éloigner'}).addTo(m);
   l.control.scale({position:'bottomleft',imperial:false}).addTo(m);
   l.control.attribution({position:'bottomright',prefix:false}).addTo(m);
   const satellite=l.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:21,keepBuffer:2,updateWhenIdle:true,attribution:'Imagerie : Esri, Vantor, Earthstar Geographics'});
   satellite.on('tileerror',()=>{if(!disposed)setMapError('Le fond satellite est momentanément indisponible. Le plan reste accessible.');});
   const plan=l.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:2,updateWhenIdle:true,attribution:'© OpenStreetMap contributors'});
   plan.on('tileerror',()=>{if(!disposed)setMapError('Certaines tuiles du plan ne sont pas disponibles.');});
   bases.current={satellite,plan};satellite.addTo(m);
   resize=new ResizeObserver(()=>{if(!disposed&&host.current?.clientWidth)requestAnimationFrame(()=>m.invalidateSize({pan:false,animate:false}));});resize.observe(host.current);
   setReady(true);
  }).catch(()=>{if(!disposed)setMapError('La carte ne peut pas être chargée. Réessayez dans un instant.');});
  return()=>{disposed=true;resize?.disconnect();map.current?.remove();map.current=null;layers.current=null;bases.current={};};
 },[]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;const chosen=bases.current[base],other=bases.current[base==='satellite'?'plan':'satellite'];if(other&&m.hasLayer(other))m.removeLayer(other);if(chosen&&!m.hasLayer(chosen))chosen.addTo(m);},[base,ready]);
 useEffect(()=>{
  const m=map.current,l=lib.current,group=layers.current;if(!ready||!m||!l||!group)return;
  group.clearLayers();const all:L.LatLngBounds[]=[];let selectedBounds:L.LatLngBounds|undefined;
  for(const campaign of campaigns){if(!validGeometry(campaign.geometry))continue;
   const coordinates=campaign.geometry.coordinates.map(ring=>ring.map(([lng,lat])=>[lat,lng] as L.LatLngTuple));
   const isSelected=campaign.id===selectedId;
   const polygon=l.polygon(coordinates,{color:isSelected?'#0759a8':'#f7fbff',weight:isSelected?4:2.5,opacity:1,fillColor:'#2687d6',fillOpacity:isSelected ? .26 : .13,interactive:true});
   polygon.on('click',()=>onSelect(campaign.id));polygon.addTo(group);
   const bounds=polygon.getBounds();all.push(bounds);if(isSelected)selectedBounds=bounds;
  }
  if(selectedBounds)m.fitBounds(selectedBounds,{padding:[64,64],maxZoom:17,animate:false});
  else if(all.length){const bounds=all[0];for(const next of all.slice(1))bounds.extend(next);m.fitBounds(bounds,{padding:[64,64],maxZoom:13,animate:false});}
  else{const selected=campaigns.find(c=>c.id===selectedId),view=COUNTRY_VIEWS[selected?.country||'TGO']??COUNTRY_VIEWS.TGO;m.setView([view.center[1],view.center[0]],Math.round(view.zoom),{animate:false});}
 },[campaigns,selectedId,ready,onSelect]);
 useEffect(()=>{if(visible&&ready){const frame=requestAnimationFrame(()=>map.current?.invalidateSize({pan:false,animate:false}));return()=>cancelAnimationFrame(frame);}},[visible,ready]);
 return <div className="field-overview-map-wrap" hidden={!visible}>
  <div ref={host} className="field-overview-map" role="application" aria-label="Carte interactive des contours de vos champs"/>
  <div className="field-map-layer-switch" role="group" aria-label="Fond de carte">
   <button type="button" className={base==='satellite'?'active':''} aria-pressed={base==='satellite'} onClick={()=>{setBase('satellite');setMapError('')}}>Satellite</button>
   <button type="button" className={base==='plan'?'active':''} aria-pressed={base==='plan'} onClick={()=>{setBase('plan');setMapError('')}}>Plan</button>
  </div>
  {campaigns.some(c=>validGeometry(c.geometry))&&<div className="field-map-legend"><i/>Contour de parcelle enregistré</div>}
  {mapError&&<div role="status" className="field-map-error">{mapError}<button type="button" onClick={()=>setMapError('')} aria-label="Fermer">×</button></div>}
 </div>;
}
