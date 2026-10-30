'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ParcelMap,{countryBounds,type CountriesGeo,type MapController} from './parcel-map';
import {COUNTRIES,type Country,type SeasonalConfig,type WaterPlan} from '../../lib/seasonal/types';
import {containsPoint,COUNTRY_VIEWS,parcelMetrics,polygonFromPoints,validateParcel,type Position,type ParcelPolygon} from '../../lib/seasonal/parcel';
import {CROPS} from '../../lib/seasonal/catalog';
import type {Place} from '../../lib/seasonal/places';

export function MapIcon({name,size=20}:{name:string;size?:number}){
 const paths:Record<string,React.ReactNode>={
  expand:<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></>,
  globe:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
  draw:<><path d="m5 5 13-1 2 14-12 3-3-16Z"/><path d="M5 5h0M18 4h0M20 18h0M8 21h0" strokeWidth="5" strokeLinecap="round"/></>,
  leaf:<><path d="M19 4C8 1 2 7 5 14c7 7 16-1 14-10Z"/><path d="M3 21 15 9"/></>,
  arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
  target:<><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></>,
  undo:<><path d="M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12"/></>,
  search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  check:<path d="m5 12 4 4L19 6"/>,
  pin:<><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/></>,
  drop:<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/></>,
  plus:<path d="M12 4v16M4 12h16"/>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.leaf}</svg>;
}
const fmt=(v:number,digits=0)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(v);
function exportShape(shape:ParcelPolygon,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify({type:'Feature',properties:{name,source:'Contour dessiné par l’utilisateur, non cadastral'},geometry:shape},null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='ma-parcelle.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function atCountry(geo:CountriesGeo|undefined,point:Position){return geo?.features.find(f=>{
 const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 return polygons.some((rings:Position[][])=>containsPoint(rings[0],point)&&!rings.slice(1).some(h=>containsPoint(h,point)));
});}
type Props={config:SeasonalConfig;plan:WaterPlan|null;locked:boolean;canSearch:boolean;onParcel:(shape:ParcelPolygon|null,country:Country)=>void;onPrepare:(crop:string,date:string)=>void;onScenario:(crop:string,date:string)=>void;onCalendar:()=>void;onName:(name:string)=>void;onDirty:(dirty:boolean)=>void;onWaterCondition:(value:SeasonalConfig['waterCondition'])=>void};
export default function ParcelExplorer({config,plan,locked,canSearch,onParcel,onPrepare,onScenario,onCalendar,onName,onDirty,onWaterCondition}:Props){
 const initial=config.parcelGeometry?.coordinates[0].slice(0,-1)??[];
 const [points,setPoints]=useState<Position[]>(initial),[closed,setClosed]=useState(!!config.parcelGeometry),[drawing,setDrawing]=useState(false);
 const [basemap,setBasemap]=useState<'satellite'|'plan'>('satellite'),[selected,setSelected]=useState<string>(config.country),[countries,setCountries]=useState<CountriesGeo>();
 const [query,setQuery]=useState(''),[places,setPlaces]=useState<Place[]>([]),[searching,setSearching]=useState(false),[message,setMessage]=useState('');
 const [lat,setLat]=useState(''),[lng,setLng]=useState(''),[coordinateOpen,setCoordinateOpen]=useState(false),[locationConfirmed,setLocationConfirmed]=useState(false);
 const [crop,setCrop]=useState(config.cropProfile?.id??'maize'),[date,setDate]=useState(config.sowingDate),[scenarioAck,setScenarioAck]=useState(false);
 const m=useRef<MapController|null>(null);
 const [drawMode,setDrawMode]=useState<'center'|'tap'>('center'),[mapReady,setMapReady]=useState(false),[mapZoom,setMapZoom]=useState(6);
 const viewportChanged=useCallback((_:Position,zoom:number)=>setMapZoom(zoom),[]);
 const readyMap=useCallback((map:MapController)=>{m.current=map;setMapReady(true);const pts=config.parcelGeometry?.coordinates[0];if(pts?.length)map.fitBounds([[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1]))],[Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]],{padding:60,maxZoom:18});},[]);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{if(!expanded)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[expanded]);
 const {geometry,metrics,geometryError}=useMemo(()=>{
  if(points.length<3)return {geometry:null,metrics:null,geometryError:''};
  try{const geometry=polygonFromPoints(points);return {geometry,metrics:parcelMetrics(geometry),geometryError:''};}
  catch(e){return {geometry:null,metrics:null,geometryError:(e as Error).message};}
 },[points]);
 const detected=useMemo(()=>metrics?atCountry(countries,metrics.point):null,[countries,metrics]);
 const countryId=detected?.properties.iso3??selected;
 const supported=Object.hasOwn(COUNTRIES,countryId),country=countryId as Country;
 const applied=!!config.parcelGeometry&&closed&&JSON.stringify(geometry)===JSON.stringify(config.parcelGeometry);
 useEffect(()=>{if(applied)setSelected(config.country);},[applied,config.country]);
 useEffect(()=>onDirty(points.length>0&&!applied),[points.length,applied,onDirty]);
 useEffect(()=>{setCrop(config.cropProfile?.id??'maize');setDate(config.sowingDate);setScenarioAck(false);},[config.cropProfile?.id,config.sowingDate]);
 const selectedCrop=CROPS.find(c=>c.id===crop);
 const fit=(pts:Position[])=>{if(!m.current||!pts.length)return;const west=Math.min(...pts.map(p=>p[0])),east=Math.max(...pts.map(p=>p[0])),south=Math.min(...pts.map(p=>p[1])),north=Math.max(...pts.map(p=>p[1]));m.current.fitBounds([[west,south],[east,north]],{padding:75,maxZoom:18,duration:1000});};
 function countryView(iso:string){setSelected(iso);setMessage('');setPlaces([]);const feature=countries?.features.find(f=>f.properties.iso3===iso);const view=COUNTRY_VIEWS[iso as keyof typeof COUNTRY_VIEWS];if(feature)m.current?.fitBounds(countryBounds(feature),{padding:65,duration:1200,maxZoom:8});else if(view)m.current?.flyTo({center:view.center,zoom:view.zoom,duration:1200});}
 function add(point:Position){if(locked)return;if(points.length>=200){setMessage('La parcelle est limitée à 200 coins.');return;}
  setPoints(p=>p.length>=200||p.some(v=>v[0]===point[0]&&v[1]===point[1])?p:[...p,point]);setClosed(false);setLocationConfirmed(false);setMessage('');}
 function startDrawing(){setDrawing(true);setClosed(false);setMessage('');}
 function placeCenter(){const at=m.current?.getCenter();if(!at||locked)return;if(m.current!.getZoom()<14){m.current!.flyTo({center:[at.lng,at.lat],zoom:16,duration:450});return;}add([Number(at.lng.toFixed(8)),Number(at.lat.toFixed(8))]);}
 function undo(){setPoints(p=>p.slice(0,-1));setClosed(false);setDrawing(true);setLocationConfirmed(false);setMessage('');}

 function finish(){if(!geometry){setMessage(geometryError||'Placez au moins trois points autour de votre champ.');return;}setClosed(true);setDrawing(false);setMessage(JSON.stringify(geometry)===JSON.stringify(config.parcelGeometry)?'Le contour confirmé est conservé. Vous pouvez préparer votre simulation.':'Le contour est prêt. Vérifiez-le puis confirmez votre parcelle.');}
 async function search(e:React.FormEvent){e.preventDefault();if(!canSearch){setMessage('Ouvrez votre espace de travail pour rechercher un village. La carte et la saisie GPS restent disponibles.');return;}setSearching(true);setPlaces([]);setMessage('');try{const r=await fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'places',query})});const data=await r.json() as {error?:string;places:Place[]};if(!r.ok)throw new Error(data.error||'Recherche indisponible.');setPlaces(data.places);if(!data.places.length)setMessage('Aucun lieu trouvé. Essayez une ville voisine ou des coordonnées GPS.');}catch(e){setMessage((e as Error).message);}finally{setSearching(false);}}
 function locate(){if(!navigator.geolocation){setMessage('La localisation n’est pas disponible. Cherchez un village ou saisissez les coordonnées.');return;}setMessage('Recherche de votre position…');navigator.geolocation.getCurrentPosition(p=>{m.current?.flyTo({center:[p.coords.longitude,p.coords.latitude],zoom:16,duration:1200});setMessage(`Position repérée, précision annoncée : environ ${Math.round(p.coords.accuracy)} m. Vérifiez le contour du champ.`);},()=>setMessage('Position non obtenue. Vous pouvez continuer avec la carte ou les coordonnées GPS.'),{enableHighAccuracy:true,timeout:12000,maximumAge:60000});}
 function useParcel(){if(!geometry||!supported)return;onParcel(geometry,country);setDrawing(false);setClosed(true);setMessage('Votre parcelle est définie. Passons à ce que vous voulez y cultiver !');}
 async function importShape(file:File){try{if(locked)throw new Error('Créez une nouvelle campagne pour changer une parcelle suivie.');if(file.size>150000)throw new Error('Le fichier doit contenir une seule petite parcelle (150 ko maximum).');let v=JSON.parse(await file.text());if(v.type==='FeatureCollection'){if(v.features?.length!==1)throw new Error('Importez une seule parcelle à la fois.');v=v.features[0];}const shape=validateParcel(v.type==='Feature'?v.geometry:v);setPoints(shape.coordinates[0].slice(0,-1));setClosed(true);setDrawing(false);fit(shape.coordinates[0]);setMessage('Contour importé. Vérifiez le pays et confirmez la parcelle.');}catch(e){setMessage((e as Error).message);}}
 const allCountries=useMemo(()=>countries?.features.slice().sort((a,b)=>a.properties.name.localeCompare(b.properties.name,'fr')),[countries]);
 return <section className={'parcel-experience'+(expanded?' is-expanded':'')} aria-label="Dessiner ma parcelle et préparer une simulation">
  <ol className="parcel-progress" aria-label="Les étapes du tracé"><li aria-current={!drawing&&!closed?'step':undefined}><b>1</b>Trouver mon champ</li><li aria-current={drawing?'step':undefined}><b>2</b>Poser les coins</li><li aria-current={closed?'step':undefined}><b>3</b>Confirmer la surface</li></ol>
  <div className="parcel-workbench">
   <div className="parcel-map-stage">
    <ParcelMap points={points} closed={closed||locked} drawing={drawing&&!locked} drawMode={drawMode} basemap={basemap} selected={selected} onCountries={setCountries} onReady={readyMap} onViewport={viewportChanged} onCountry={countryView} onAdd={add} onMove={(i,p)=>{if(!locked){setPoints(all=>all.map((v,j)=>i===j?p:v));setClosed(false);setLocationConfirmed(false);}}} onClose={finish}/>
    <div className="map-top-tools">
     <form className="map-search" onSubmit={search}><MapIcon name="search" size={19}/><input aria-label="Chercher un village ou une ville" placeholder="Un village, une ville…" value={query} onChange={e=>setQuery(e.target.value)} minLength={3} maxLength={120}/><button type="submit" disabled={searching} aria-label="Rechercher le lieu">{searching?'…':<MapIcon name="arrow" size={18}/>}</button>
      {!!places.length&&<ul className="map-place-results">{places.map((p,i)=><li key={i}><button type="button" onClick={()=>{m.current?.flyTo({center:[p.longitude,p.latitude],zoom:15,duration:1300});setPlaces([]);setQuery(p.name);setBasemap('satellite');}}><MapIcon name="pin"/><span><strong>{p.name}</strong><small>{[p.region,p.country].filter(Boolean).join(' · ')}</small></span></button></li>)}<li><small><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · complément Open-Meteo</small></li></ul>}
     </form>
     <div className="map-view-toggle" aria-label="Fond de carte"><button type="button" aria-pressed={basemap==='satellite'} onClick={()=>setBasemap('satellite')}><MapIcon name="globe" size={16}/>Satellite</button><button type="button" aria-pressed={basemap==='plan'} onClick={()=>setBasemap('plan')}>Plan</button><button type="button" aria-label={expanded?'Réduire la carte':'Agrandir la carte'} title={expanded?'Réduire la carte':'Agrandir la carte'} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}><MapIcon name="expand" size={16}/></button></div>
    </div>
    {drawing&&<div className="map-draw-options" role="group" aria-label="Méthode de tracé"><button type="button" aria-pressed={drawMode==='center'} onClick={()=>setDrawMode('center')}><MapIcon name="target" size={16}/>Repère au centre</button><button type="button" aria-pressed={drawMode==='tap'} onClick={()=>setDrawMode('tap')}><MapIcon name="pin" size={16}/>Clic sur la carte</button></div>}
    {drawing&&drawMode==='center'&&<div className="map-center-target" aria-hidden="true"><i/><span>Coin {points.length+1}</span></div>}
    {!drawing&&!points.length&&<div className="map-welcome-card"><span className="map-live-dot"/>Retrouvons votre champ.<small>Cherchez votre village en haut, puis zoomez jusqu’à voir votre terrain.</small><button type="button" onClick={locate}><MapIcon name="target" size={17}/>Utiliser ma position</button></div>}
    <div className="map-utility-tools"><button type="button" onClick={locate} aria-label="Me situer" title="Me situer"><MapIcon name="target"/></button><button type="button" onClick={()=>points.length?fit(points):m.current?.flyTo({center:[18,5],zoom:3,duration:500})} aria-label={points.length?'Revoir tout mon champ':'Voir l’Afrique'} title={points.length?'Revoir tout mon champ':'Voir l’Afrique'}><MapIcon name="globe"/></button></div>
    <div className="map-trace-card">
     <div className="map-trace-instruction" role="status"><strong>{drawing?(drawMode==='center'?'Déplacez la carte sous le repère':'Cliquez sur les coins du champ'):closed?'Votre contour est prêt':'Commencez par trouver votre terrain'}</strong><span>{drawing?`${points.length} coin${points.length>1?'s':''} posé${points.length>1?'s':''} · ${points.length<3?'3 minimum pour terminer':metrics?fmt(metrics.areaM2)+' m²':'corrigez le contour'}`:closed?(metrics?`${fmt(metrics.areaM2)} m² · ${fmt(metrics.areaM2/10000,3)} ha`:'Vérifiez les limites'): 'Satellite pour voir le terrain · Plan pour les routes'}</span></div>
     <div className="map-trace-actions">
      {drawing?<><button type="button" className="trace-undo" disabled={!points.length||locked} onClick={undo} aria-label="Annuler le dernier coin" title="Annuler le dernier coin"><MapIcon name="undo"/></button>{drawMode==='center'?<button type="button" className="trace-place" disabled={!mapReady||locked||points.length>=200} onClick={placeCenter}><MapIcon name={mapZoom<14?'search':'plus'} size={19}/>{mapZoom<14?'Rapprocher ici':`Poser le coin ${points.length+1}`}</button>:<button type="button" className="trace-place" onClick={()=>{setDrawing(false);setMessage('Tracé en pause. Vous pouvez déplacer la carte sans poser de coin.');}}>Pause du tracé</button>}<button type="button" className="trace-finish" disabled={!geometry||locked} onClick={finish}><MapIcon name="check" size={18}/>Terminer</button></>:<button type="button" className="trace-place" disabled={!mapReady||locked} onClick={startDrawing}><MapIcon name="draw" size={19}/>{closed?'Ajuster les coins':'Dessiner mon champ'}</button>}
     </div>
     {drawing&&<span className="map-trace-tip">{mapZoom<14?'Zoomez pour distinguer les limites du terrain.':drawMode==='center'?'La carte se déplace librement. Seul le bouton pose un coin.':'Glissez pour déplacer la carte, cliquez pour poser un coin.'}</span>}
    </div>

   </div>
   <aside className="parcel-sidepanel">
    <div className="parcel-panel-title"><span className="parcel-sprout"><MapIcon name="leaf" size={25}/></span><div><span className="eyebrow">C’EST ICI QUE TOUT COMMENCE</span><h2>Mon coin de terre</h2></div><span className="step-circle">01</span></div>
    <label className="field country-select"><span>Où se trouve votre champ ?</span><select aria-label="Explorer un pays d’Afrique" value={selected} onChange={e=>countryView(e.target.value)}>{allCountries?.length?allCountries.map(f=><option key={f.properties.iso3} value={f.properties.iso3}>{f.properties.name}{Object.hasOwn(COUNTRIES,f.properties.iso3)?' · simulations':''}</option>):Object.entries(COUNTRIES).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</select></label>
    {!points.length?<div className="parcel-gentle-guide"><div><b>1</b><p><strong>Trouvez votre village</strong><span>Zoomez ou utilisez la recherche sur la carte.</span></p></div><div><b>2</b><p><strong>Faites le tour du champ</strong><span>Déplacez la carte sous le repère, puis appuyez sur « Poser le coin ».</span></p></div><div><b>3</b><p><strong>Et voilà, votre parcelle !</strong><span>Sa surface et ses coordonnées se calculent toutes seules.</span></p></div><button className="parcel-main-button" type="button" disabled={locked||!mapReady} onClick={startDrawing}>Commencer le tracé <MapIcon name="arrow"/></button></div>:<>
     <div className="parcel-status"><span className={applied?'dot-ready':'dot-draft'}/>{applied?'Parcelle confirmée':closed?'Contour prêt à confirmer':'Posez les coins, puis terminez'}<span>{points.length} points</span></div>
     <div className="parcel-area"><span>Surface du champ</span><strong>{metrics?fmt(metrics.areaM2/10000,3):'—'}<small>ha</small></strong><p>{metrics?`${fmt(metrics.areaM2)} m² · ${fmt(metrics.perimeterM)} m de contour`:'Au moins trois points sans croisement'}</p></div>
     {detected&&<p className="parcel-country-detected"><MapIcon name="pin" size={15}/>{detected.properties.name} · repère cartographique</p>}
     {!!geometryError&&<p className="parcel-message" role="alert">{geometryError}</p>}
     {!supported&&<p className="parcel-message">Vous pouvez explorer ce pays et exporter le tracé. Les simulations sont actuellement proposées au Togo, Bénin, Ghana, Burkina Faso, Sénégal et en Côte d’Ivoire.</p>}
     {metrics&&!detected&&<label className="parcel-check"><input type="checkbox" checked={locationConfirmed} onChange={e=>setLocationConfirmed(e.target.checked)}/>Je confirme que cette parcelle se trouve dans le pays sélectionné. Le contour indicatif des pays ne permet pas de le déterminer.</label>}
     {!applied&&<button type="button" className="parcel-main-button" disabled={!closed||!geometry||!supported||locked||(!detected&&!locationConfirmed)} onClick={useParcel}>Confirmer cette parcelle <MapIcon name="check"/></button>}
     {applied&&<div className="parcel-quick-simulation"><div className="parcel-mini-heading"><span className="step-circle">02</span><h3>Qu’allons-nous cultiver ?</h3></div><label className="field"><span>Nom du champ</span><input aria-label="Nom de mon champ" value={config.name} onChange={e=>onName(e.target.value)} placeholder="Le champ derrière la maison" maxLength={120}/></label><label className="field"><span>Ma culture</span><select aria-label="Culture à explorer" value={crop} onChange={e=>{setCrop(e.target.value);setScenarioAck(false);}}>{CROPS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field"><span>Date de semis envisagée</span><input aria-label="Date de semis envisagée" type="date" value={date} onInput={e=>{setDate(e.currentTarget.value);setScenarioAck(false);}} onChange={e=>{setDate(e.target.value);setScenarioAck(false);}}/></label>
      {plan&&crop===config.cropProfile?.id&&date===config.sowingDate?<div className="parcel-result"><span>VOTRE SCÉNARIO D’EAU</span><strong>{plan.totals.fieldM3===null?'—':fmt(plan.totals.fieldM3)}<small> m³ au champ</small></strong><p>Sur {plan.days.length} jours · avec les hypothèses de ce scénario</p><button type="button" onClick={onCalendar}>Voir mon calendrier <MapIcon name="arrow" size={17}/></button></div>:null}
      <label className="field"><span>L’eau s’évacue-t-elle de votre champ ?</span><select aria-label="État d’eau de mon champ" value={config.waterCondition??'unknown'} onChange={e=>onWaterCondition(e.target.value as SeasonalConfig['waterCondition'])}><option value="unknown">Je ne sais pas encore</option><option value="drained">Oui, pas d’eau stagnante</option><option value="waterlogged">Non, le sol reste engorgé</option><option value="submerged">Les plantes sont sous l’eau</option></select></label>
      <p className="parcel-water-limit">{['waterlogged','submerged'].includes(config.waterCondition??'')?'Le calendrier d’arrosage est suspendu. La survie et la perte de récolte nécessitent un diagnostic adapté à la culture.':'Le scénario calcule les besoins en eau. Il ne calcule pas la mortalité des plantes ni les pertes de récolte après inondation.'}</p>
      <button type="button" className="parcel-main-button" onClick={()=>onPrepare(crop,date)}>Préparer avec mes données <MapIcon name="arrow"/></button>
      <details className="parcel-scenario"><summary>Explorer avec un exemple de sol et de météo</summary><p>Pour comprendre les quantités d’eau sur ce champ : sol fictif, ET0 de 5 mm/j, aucune pluie, efficacité d’application de 75 %, transport sans perte et eau supposée disponible. Aucune de ces hypothèses n’est une mesure sur votre champ.</p><label className="parcel-check"><input type="checkbox" checked={scenarioAck} onChange={e=>setScenarioAck(e.target.checked)}/>J’utilise ces hypothèses pour un scénario exploratoire.</label>{!selectedCrop?.water?.automaticExample&&<p>Les durées de cette culture doivent être renseignées et sourcées avant la simulation. Continuez avec vos données.</p>}<button className="parcel-main-button warm" type="button" disabled={!scenarioAck||!selectedCrop?.water?.automaticExample||locked||!date||['waterlogged','submerged'].includes(config.waterCondition??'')} onClick={()=>onScenario(crop,date)}>Explorer ce scénario <MapIcon name="arrow"/></button></details>
     </div>}
    </>}
    {message&&<p className="parcel-message" role="status">{message}</p>}
    {locked&&<p className="parcel-message">Cette campagne a déjà des observations. Son contour est conservé : créez une nouvelle campagne pour un autre champ.</p>}
    <details className="parcel-coordinate-tools" open={coordinateOpen} onToggle={e=>setCoordinateOpen(e.currentTarget.open)}><summary>Points GPS, import et export</summary>
     <p>Alternative au dessin tactile : ajoutez les coordonnées des coins dans l’ordre. Latitude puis longitude à l’écran ; longitude puis latitude dans le fichier GeoJSON.</p>
     {!locked&&<><div className="parcel-coordinate-inputs"><label className="field"><span>Latitude</span><input aria-label="Latitude du nouveau point" inputMode="decimal" value={lat} onChange={e=>setLat(e.target.value)} placeholder="6.20000"/></label><label className="field"><span>Longitude</span><input aria-label="Longitude du nouveau point" inputMode="decimal" value={lng} onChange={e=>setLng(e.target.value)} placeholder="1.20000"/></label></div><button type="button" className="parcel-text-button" onClick={()=>{const a=Number(lat.replace(',','.')),o=Number(lng.replace(',','.'));if(!lat.trim()||!lng.trim()||!Number.isFinite(a)||!Number.isFinite(o)||Math.abs(a)>85||Math.abs(o)>180){setMessage('Vérifiez la latitude (−85 à 85) et la longitude (−180 à 180).');return;}add([o,a]);m.current?.flyTo({center:[o,a],zoom:17,duration:900});setLat('');setLng('');}}><MapIcon name="plus" size={17}/>Ajouter ce point</button></>}
     {!!points.length&&<ol className="parcel-points">{points.map((p,i)=><li key={i}><b>{i+1}</b><label>Latitude<input aria-label={`Latitude du sommet ${i+1}`} type="number" step="any" value={p[1]} disabled={locked} onChange={e=>{if(e.target.value==='')return;const v=Number(e.target.value);if(Number.isFinite(v)&&Math.abs(v)<=85){setPoints(ps=>ps.map((q,j)=>i===j?[q[0],v]:q));setClosed(false);}}}/></label><label>Longitude<input aria-label={`Longitude du sommet ${i+1}`} type="number" step="any" value={p[0]} disabled={locked} onChange={e=>{if(e.target.value==='')return;const v=Number(e.target.value);if(Number.isFinite(v)&&Math.abs(v)<=180){setPoints(ps=>ps.map((q,j)=>i===j?[v,q[1]]:q));setClosed(false);}}}/></label>{!locked&&<button type="button" aria-label={`Retirer le sommet ${i+1}`} onClick={()=>{setPoints(ps=>ps.filter((_,j)=>i!==j));setClosed(false);}}>×</button>}</li>)}</ol>}
     {!!geometry&&<button type="button" className="parcel-text-button" onClick={()=>exportShape(geometry,config.name||'Ma parcelle')}>Exporter mon contour GeoJSON</button>}
     {!locked&&<><label className="field"><span>Importer un contour GeoJSON</span><input type="file" accept=".json,.geojson,application/geo+json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void importShape(file);e.target.value='';}}/></label>{!!points.length&&<button type="button" className="parcel-text-button danger" onClick={()=>{setPoints([]);setClosed(false);setDrawing(false);onParcel(null,config.country);}}>Effacer le tracé</button>}</>}
    </details>
    <p className="parcel-map-note">Surface estimée d’après votre tracé, sans valeur cadastrale. Les images satellite peuvent être anciennes ou décalées. Vérifiez les limites sur le terrain ; changez de fond avec Satellite / Plan. <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">Plan OpenFreeMap / OpenMapTiles / OpenStreetMap</a></p>
   </aside>
  </div>
  <div className="parcel-benefit-strip"><span><MapIcon name="draw"/>Un champ dessiné, une surface calculée</span><span><MapIcon name="drop"/>Des volumes adaptés à sa taille</span><span><MapIcon name="calendar"/>Un calendrier qui suit vos observations</span></div>
 </section>;
}
