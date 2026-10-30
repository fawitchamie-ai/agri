'use client';
/** SVG/tile fallback for devices without WebGL. Same shape/events as the globe. */
import {useEffect,useRef,useState} from 'react';
import type * as L from 'leaflet';
import {COUNTRIES} from '../../lib/seasonal/types';
import {COUNTRY_VIEWS,type Position} from '../../lib/seasonal/parcel';
import type {ParcelMapProps,MapController,CountriesGeo} from './parcel-map';
import 'leaflet/dist/leaflet.css';
import {createVectorBasemap} from './vector-basemap';
export default function ParcelMapLight(props:ParcelMapProps){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),latest=useRef(props);latest.current=props;
 const vectors=useRef<L.LayerGroup|null>(null),boundaries=useRef<L.GeoJSON|null>(null),earth=useRef<L.TileLayer|null>(null),plan=useRef<L.GridLayer|null>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[center,setCenter]=useState<Position>([18,5]),[zoom,setZoom]=useState(2);
 useEffect(()=>{
  let disposed=false;
  import('leaflet').then(lib=>{
   if(disposed||!host.current)return;const l=lib.default??lib;
   const m=l.map(host.current,{center:[5,18],zoom:2,minZoom:1,maxZoom:20,zoomControl:false,attributionControl:false,worldCopyJump:true});map.current=m;
   l.control.zoom({position:'topright',zoomInTitle:'Rapprocher la carte',zoomOutTitle:'Éloigner la carte'}).addTo(m);
   l.control.scale({position:'bottomleft',imperial:false}).addTo(m);
   l.control.attribution({position:'bottomright',prefix:false}).addAttribution('Frontières : Natural Earth').addTo(m);
   earth.current=l.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',{maxNativeZoom:8,maxZoom:20,attribution:'Vue Terre : NASA GIBS Blue Marble'});
   earth.current.on('tileerror',()=>setError('Vue Terre non chargée. Passez au plan ou utilisez les coordonnées.'));

   const changeBase=()=>{const useEarth=latest.current.basemap==='earth'&&m.getZoom()<9;const current=useEarth?earth.current:plan.current,other=useEarth?plan.current:earth.current;if(other&&m.hasLayer(other))m.removeLayer(other);if(current&&!m.hasLayer(current))current.addTo(m);};
   changeBase();m.on('zoomend',changeBase);
   createVectorBasemap(l).then(layer=>{if(disposed)return;plan.current=layer;layer.on('tileerror',()=>setError('Le plan détaillé est momentanément indisponible. Vos points GPS restent conservés.'));changeBase();}).catch(()=>setError('Le plan détaillé est indisponible. La vue Terre et les coordonnées restent utilisables.'));
   vectors.current=l.layerGroup().addTo(m);
   m.on('moveend',()=>{const c=m.getCenter();setCenter([c.lng,c.lat]);setZoom(m.getZoom());});
   m.on('click',(e:L.LeafletMouseEvent)=>{const p=latest.current;if(!p.drawing)return;if(m.getZoom()<12){setError('Rapprochez-vous du champ pour placer ses coins, ou saisissez ses coordonnées GPS.');return;}setError('');if(p.points.length>=3){const first=m.latLngToContainerPoint([p.points[0][1],p.points[0][0]]);if(first.distanceTo(e.containerPoint)<18){p.onClose();return;}}p.onAdd([Number(e.latlng.lng.toFixed(8)),Number(e.latlng.lat.toFixed(8))]);});
   const controller:MapController={getCenter:()=>{const c=m.getCenter();return{lng:c.lng,lat:c.lat};},flyTo:options=>{m.flyTo([options.center[1],options.center[0]],options.zoom,{duration:(options.duration??1000)/1000,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});},fitBounds:(bounds,options)=>{m.fitBounds([[bounds[0][1],bounds[0][0]],[bounds[1][1],bounds[1][0]]],{padding:[options?.padding??50,options?.padding??50],maxZoom:options?.maxZoom??18,animate:false});}};
   const resize=new ResizeObserver(()=>m.invalidateSize({pan:true,animate:false}));resize.observe(host.current);m.on('unload',()=>resize.disconnect());
   latest.current.onReady(controller);setReady(true);
   fetch('/maps/africa-countries.geojson').then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<CountriesGeo>;}).then(geo=>{
    if(disposed)return;latest.current.onCountries(geo);
    boundaries.current=l.geoJSON(geo as any,{style:f=>({color:'#e8edbd',weight:1,fillColor:Object.hasOwn(COUNTRIES,f?.properties.iso3)?'#d0df96':'#b9cba8',fillOpacity:.07,opacity:.65}),onEachFeature:(f,layer)=>layer.on('click',(e:L.LeafletMouseEvent)=>{if(!latest.current.drawing&&!latest.current.points.length){l.DomEvent.stopPropagation(e);latest.current.onCountry(f.properties.iso3);}})}).addTo(m);
    const updateBounds=()=>{boundaries.current?.setStyle({opacity:m.getZoom()>10?0:.65,fillOpacity:m.getZoom()>10?0:.07});};m.on('zoomend',updateBounds);updateBounds();
    for(const[id,view]of Object.entries(COUNTRY_VIEWS)){
     const button=document.createElement('button');button.type='button';button.className='country-map-label';button.textContent=COUNTRIES[id as keyof typeof COUNTRIES].name;button.setAttribute('aria-label','Explorer '+button.textContent);button.onclick=e=>{e.stopPropagation();latest.current.onCountry(id);};
     const label=l.marker([view.center[1],view.center[0]],{icon:l.divIcon({html:button,className:'country-marker-light',iconSize:[75,28],iconAnchor:[37,14]}),interactive:true}).addTo(m);
     const show=()=>{const el=label.getElement();if(el)el.style.display=(m.getZoom()>=4&&id===latest.current.selected||m.getZoom()>=6)&&m.getZoom()<8?'':'none';};m.on('zoomend',show);show();
    }
   }).catch(()=>setError('Les contours indicatifs des pays ne sont pas chargés. La carte et les points GPS restent utilisables.'));
  }).catch(()=>setError('La carte ne peut pas être chargée. Utilisez la saisie GPS pour définir votre champ.'));
  return()=>{disposed=true;map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;setError('');const useEarth=props.basemap==='earth'&&m.getZoom()<9;const chosen=useEarth?earth.current:plan.current,other=useEarth?plan.current:earth.current;if(other&&m.hasLayer(other))m.removeLayer(other);if(chosen&&!m.hasLayer(chosen))chosen.addTo(m);},[props.basemap,ready]);
 useEffect(()=>{if(!ready||!map.current||!vectors.current)return;const m=map.current,group=vectors.current;group.clearLayers();let cancelled=false;
  import('leaflet').then(lib=>{if(cancelled||!map.current)return;const l=lib.default??lib;const coords=props.points.map(p=>[p[1],p[0]] as L.LatLngTuple);
   if(coords.length>=3)l.polygon(coords,{color:'#e7f3ae',weight:3,fillColor:'#b9ee66',fillOpacity:.28,dashArray:'7 4',interactive:false}).addTo(group);
   else if(coords.length>=2)l.polyline(coords,{color:'#e7f3ae',weight:3,dashArray:'7 4',interactive:false}).addTo(group);
   coords.forEach((p,i)=>{const button=document.createElement('button');button.type='button';button.className='parcel-vertex';button.textContent=String(i+1);button.setAttribute('aria-label',`Sommet ${i+1}, déplaçable`);button.onclick=e=>{e.stopPropagation();if(i===0&&latest.current.drawing&&latest.current.points.length>=3)latest.current.onClose();};
    const h=l.marker(p,{icon:l.divIcon({html:button,className:'parcel-marker-light',iconSize:[28,28],iconAnchor:[14,14]}),draggable:!props.closed}).addTo(group);h.on('dragend',()=>{const at=h.getLatLng();latest.current.onMove(i,[Number(at.lng.toFixed(8)),Number(at.lat.toFixed(8))]);});
   });
   m.getContainer().style.cursor=props.drawing?'crosshair':'';
  });
  return()=>{cancelled=true;};
 },[props.points,props.closed,props.drawing,ready]);
 return <div className="parcel-canvas-wrap map-light"><div ref={host} className="parcel-canvas" aria-label="Carte interactive légère de l’Afrique. Zoomez et placez les coins du champ."/><span className="map-light-label">Mode léger · sans 3D</span>{!ready&&!error&&<div className="map-loading" role="status"><span className="map-loader"/>La carte arrive…</div>}{error&&<div className="map-service-message" role="status">{error}<button type="button" aria-label="Fermer le message de carte" onClick={()=>setError('')}>×</button></div>}<div className="map-coordinate-readout">{Math.abs(center[1]).toFixed(5)}° {center[1]>=0?'N':'S'} · {Math.abs(center[0]).toFixed(5)}° {center[0]>=0?'E':'O'} <span>Zoom {zoom.toFixed(1)}</span></div></div>;
}
