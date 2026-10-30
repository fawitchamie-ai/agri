'use client';
import {memo,useEffect,useRef,useState} from 'react';
import type * as L from 'leaflet';
import {COUNTRY_VIEWS,type Position} from '../../lib/seasonal/parcel';
import type {ParcelMapProps,MapController,CountriesGeo} from './parcel-map';
import 'leaflet/dist/leaflet.css';

/** Leaflet owns the moving map. React only receives settled viewport changes.
 * Paths and markers are retained: adding a corner never rebuilds the basemap. */
export default memo(function ParcelMapLight(props:ParcelMapProps){
 const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),latest=useRef(props);latest.current=props;
 const lib=useRef<typeof L|null>(null),markers=useRef<L.Marker[]>([]),line=useRef<L.Polyline|null>(null),fill=useRef<L.Polygon|null>(null);
 const bases=useRef<{satellite?:L.TileLayer;plan?:L.GridLayer;loading?:boolean}>({});
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[viewport,setViewport]=useState({center:[1.1,8.65] as Position,zoom:6});
 const changeBase=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let disposed=false,resize:ResizeObserver|undefined,resizeFrame=0;
  const abort=new AbortController();
  import('leaflet').then(module=>{
   if(disposed||!host.current)return;
   const l=module.default??module;lib.current=l;
   const view=COUNTRY_VIEWS[latest.current.selected as keyof typeof COUNTRY_VIEWS]??COUNTRY_VIEWS.TGO;
   const m=l.map(host.current,{center:[view.center[1],view.center[0]],zoom:Math.round(view.zoom),minZoom:2,maxZoom:20,zoomControl:false,attributionControl:false,worldCopyJump:true,zoomAnimation:true,markerZoomAnimation:false,fadeAnimation:false,doubleClickZoom:false,tapTolerance:12});map.current=m;
   l.control.zoom({position:'topright',zoomInTitle:'Rapprocher la carte',zoomOutTitle:'Éloigner la carte'}).addTo(m);
   l.control.scale({position:'bottomleft',imperial:false}).addTo(m);
   l.control.attribution({position:'bottomright',prefix:false}).addTo(m);
   bases.current.satellite=l.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:19,maxZoom:20,keepBuffer:1,updateWhenIdle:true,attribution:'Imagerie : Esri, Vantor, Earthstar Geographics, GIS User Community'});
   bases.current.satellite.on('tileerror',()=>{if(latest.current.basemap==='satellite')setError('Image satellite indisponible ici. Essayez « Plan » : vos coins sont conservés.');});
   changeBase.current=()=>{
    if(disposed)return;
    const name=latest.current.basemap,b=bases.current;
    const chosen=b[name],other=name==='satellite'?b.plan:b.satellite;
    if(chosen){if(other&&m.hasLayer(other))m.removeLayer(other);if(!m.hasLayer(chosen))chosen.addTo(m);return;}
    if(name==='plan'&&!b.loading){
     b.loading=true;
     import('./vector-basemap').then(v=>v.createVectorBasemap(l,abort.signal)).then(layer=>{
      if(disposed)return;b.plan=layer;
      layer.on('tileerror',()=>{if(latest.current.basemap==='plan')setError('Certaines tuiles du plan manquent. Vous pouvez continuer le tracé ou revenir au satellite.');});
      changeBase.current();
     }).catch(()=>{if(!disposed)setError('Le plan est indisponible. La vue satellite et les coordonnées restent utilisables.');}).finally(()=>{b.loading=false;});
    }
   };
   changeBase.current();
   fill.current=l.polygon([],{color:'#f2ffc3',weight:0,fillColor:'#b9ee66',fillOpacity:.22,interactive:false}).addTo(m);
   line.current=l.polyline([],{color:'#f2ffc3',weight:3,interactive:false}).addTo(m);
   const settled=()=>{const c=m.getCenter(),center:Position=[c.lng,c.lat],zoom=m.getZoom();setViewport({center,zoom});latest.current.onViewport?.(center,zoom);};
   m.on('moveend',settled);
   m.on('click',(e:L.LeafletMouseEvent)=>{
    const p=latest.current;
    if(!p.drawing||p.drawMode!=='tap')return;
    if(m.getZoom()<14){setError('Rapprochez la carte avec + avant de placer les coins.');return;}
    // A second click of a double-click is not a second corner. Panning is
    // already distinguished from clicking by Leaflet's drag handler.
    if(e.originalEvent.detail>1)return;
    setError('');p.onAdd([Number(e.latlng.lng.toFixed(8)),Number(e.latlng.lat.toFixed(8))]);
   });
   const controller:MapController={getZoom:()=>m.getZoom(),getCenter:()=>{const c=m.getCenter();return{lng:c.lng,lat:c.lat};},flyTo:options=>{
    m.stop();m.flyTo([options.center[1],options.center[0]],options.zoom,{duration:(options.duration??500)/1000,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});
   },fitBounds:(bounds,options)=>{m.stop();m.fitBounds([[bounds[0][1],bounds[0][0]],[bounds[1][1],bounds[1][0]]],{padding:[options?.padding??45,options?.padding??45],maxZoom:options?.maxZoom??18,animate:false});}};
   resize=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(!disposed&&host.current?.clientWidth)m.invalidateSize({pan:true,animate:false});});});resize.observe(host.current);
   latest.current.onReady(controller);setReady(true);settled();
   fetch('/maps/africa-countries.geojson',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<CountriesGeo>;}).then(geo=>{
    if(disposed)return;latest.current.onCountries(geo);
    const pane=m.createPane('country-boundaries');pane.style.pointerEvents='none';pane.style.zIndex='250';
    l.geoJSON(geo as any,{pane:'country-boundaries',interactive:false,style:{color:'#e5edc2',weight:1,fill:false,opacity:.65}}).addTo(m);
    const show=()=>{pane.style.display=m.getZoom()>10?'none':'';};m.on('zoomend',show);show();
   }).catch(()=>{if(!disposed)setError('Contours des pays indisponibles. Le dessin et la saisie GPS restent possibles.');});
  }).catch(()=>{if(!disposed)setError('La carte ne peut pas être chargée. Utilisez les points GPS ci-dessous.');});
  return()=>{disposed=true;abort.abort();resize?.disconnect();cancelAnimationFrame(resizeFrame);changeBase.current=()=>{};map.current?.remove();map.current=null;markers.current=[];line.current=null;fill.current=null;bases.current={};};
 },[]);
 useEffect(()=>{if(ready){setError('');changeBase.current();}},[props.basemap,ready]);
 useEffect(()=>{
  const m=map.current,l=lib.current;if(!ready||!m||!l)return;
  const coords=props.points.map(p=>[p[1],p[0]] as L.LatLngTuple);
  const outline=props.closed&&coords.length? [...coords,coords[0]]:coords;
  line.current?.setLatLngs(outline);line.current?.setStyle({dashArray:props.closed?undefined:'7 5'});
  fill.current?.setLatLngs(coords.length>=3?coords:[]);
  while(markers.current.length>coords.length)markers.current.pop()!.remove();
  coords.forEach((point,i)=>{
   let marker=markers.current[i];
   if(!marker){
    const button=document.createElement('span');button.className='parcel-vertex';button.textContent=String(i+1);button.title=`Coin ${i+1} : faites-le glisser pour le corriger`;button.setAttribute('aria-hidden','true');
    // No click-to-close on a vertex: close only with the explicit finish action.
    marker=l.marker(point,{icon:l.divIcon({html:button,className:'parcel-marker-light',iconSize:[44,44],iconAnchor:[22,22]}),draggable:true,autoPan:true,bubblingMouseEvents:false}).addTo(m);
    marker.getElement()?.setAttribute('aria-label',`Coin ${i+1}, déplaçable`);
    const current=marker;
    current.on('drag',()=>{const at=current.getLatLng(),points=latest.current.points.map((p,j)=>i===j?[at.lat,at.lng] as L.LatLngTuple:[p[1],p[0]] as L.LatLngTuple);line.current?.setLatLngs(points);fill.current?.setLatLngs(points.length>=3?points:[]);});
    current.on('dragend',()=>{const at=current.getLatLng();latest.current.onMove(i,[Number(at.lng.toFixed(8)),Number(at.lat.toFixed(8))]);});
    markers.current.push(current);
   }else if(!marker.getLatLng().equals(point))marker.setLatLng(point);
   if(props.closed)marker.dragging?.disable();else marker.dragging?.enable();
  });
  m.getContainer().style.cursor=props.drawing&&props.drawMode==='tap'?'crosshair':'';
 },[props.points,props.closed,props.drawing,props.drawMode,ready]);
 return <div className="parcel-canvas-wrap map-light"><div ref={host} className="parcel-canvas" aria-label="Carte interactive du champ. Déplacez la carte, puis posez les coins avec le bouton."/>{!ready&&!error&&<div className="map-loading" role="status"><span className="map-loader"/>La carte arrive…</div>}{error&&<div className="map-service-message" role="status">{error}<button type="button" aria-label="Fermer le message de carte" onClick={()=>setError('')}>×</button></div>}<div className="map-coordinate-readout" aria-live="off">{Math.abs(viewport.center[1]).toFixed(5)}° {viewport.center[1]>=0?'N':'S'} · {Math.abs(viewport.center[0]).toFixed(5)}° {viewport.center[0]>=0?'E':'O'} <span>Zoom {viewport.zoom.toFixed(0)}</span></div></div>;
});
