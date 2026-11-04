'use client';
import {useEffect,useId,useRef,useState} from 'react';
import SatelliteMosaic from './satellite-mosaic';
import BasemapMosaic from './basemap-mosaic';
import {seasonalRequest} from '../../lib/seasonal/request';
import {geometryIdentity} from '../../lib/seasonal/provenance';
import {satelliteBounds,SATELLITE_LAYERS,type SatelliteLayer,satelliteCatalog,satelliteScenes} from '../../lib/seasonal/satellite';
import {framePoint,imageScale,parcelImageCoverage} from '../../lib/seasonal/imagery-display';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import type {LandAssessment} from '../../lib/seasonal/land';
import {LAND_COLORS,LAND_NAMES} from '../../lib/seasonal/land-display';
import './parcel-imagery.css';
const fmt=(n:number,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const titles:[('terrain'|SatelliteLayer),string][]=[['terrain','Terre / eau'],['rgb','Satellite'],['ndvi','Vigueur'],['anomaly','Stress possible'],['classification','Nuages / eau']];
type Catalog=Awaited<ReturnType<typeof satelliteCatalog>>;
type Coverage={key:string;percent:number|null};
export default function ParcelLayers({config:c,assessment,onMap}:{config:SeasonalConfig;assessment?:LandAssessment;onMap:()=>void}){
 const [layer,setLayer]=useState<'terrain'|SatelliteLayer>('terrain'),[allowedFor,setAllowedFor]=useState(''),[catalog,setCatalog]=useState<Catalog|null>(null),[date,setDate]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[imageState,setImageState]=useState('');
 const [rgbSource,setRgbSource]=useState<'hd'|'dated'>('hd'),[wide,setWide]=useState(false),[retry,setRetry]=useState(0),[baseError,setBaseError]=useState(''),[opacity,setOpacity]=useState(85),[photo,setPhoto]=useState(true);
 const [scenes,setScenes]=useState<Awaited<ReturnType<typeof satelliteScenes>>|null>(null),[sceneWarning,setSceneWarning]=useState(''),[received,setReceived]=useState(''),[coverage,setCoverage]=useState<Coverage|null>(null);
 const search=useRef<{done:boolean;tried:string[];best:{date:string;percent:number}|null}>({done:false,tried:[],best:null});
 const id=useId().replace(/:/g,''),identity=geometryIdentity(c.parcelGeometry),shape=c.parcelGeometry;
 const allowed=allowedFor===identity,basemap=layer==='rgb'&&rgbSource==='hd';
 const observations=layer!=='terrain'&&!basemap;
 const land=assessment&&geometryIdentity(assessment.geometry)===identity?assessment:undefined;
 useEffect(()=>{setAllowedFor('');setCatalog(null);setScenes(null);setSceneWarning('');setError('');setBaseError('');setImageState('');setLayer('terrain');setCoverage(null);},[identity]);
 useEffect(()=>{
  if(!allowed||!shape||!observations){setLoading(false);return;}
  const ctrl=new AbortController();setLoading(true);setError('');setSceneWarning('');
  const catalogTask=satelliteCatalog(c.asOfDate).catch(reason=>{if(ctrl.signal.aborted)throw reason;return seasonalRequest<Catalog>({action:'satellite-catalog',asOfDate:c.asOfDate},ctrl.signal).catch(()=>{throw reason;});});
  const scenesTask=satelliteScenes(shape,c.asOfDate).catch(reason=>{if(ctrl.signal.aborted)throw reason;return seasonalRequest<Awaited<ReturnType<typeof satelliteScenes>>>({action:'satellite-scenes',geometry:shape,asOfDate:c.asOfDate},ctrl.signal).catch(()=>{throw reason;});});
  Promise.allSettled([catalogTask,scenesTask]).then(([a,b])=>{if(ctrl.signal.aborted)return;if(a.status==='fulfilled')setCatalog(a.value);else setError('Catalogue d’images indisponible. Le fond photo reste accessible dans Satellite.');if(b.status==='fulfilled')setScenes(b.value);else setSceneWarning('Dates régionales : couverture du champ à vérifier.');}).finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
  return()=>ctrl.abort();
 },[allowed,c.asOfDate,identity,observations,retry]);
 useEffect(()=>{search.current={done:false,tried:[],best:null};setCoverage(null);},[identity,layer,c.asOfDate,wide,retry,rgbSource]);
 const daily=layer!=='terrain'&&SATELLITE_LAYERS[layer].period==='day';
 const published=layer==='terrain'?[]:catalog?.layers[layer]?.dates??[];
 const matched=daily&&scenes?published.filter(d=>scenes.dates.some(s=>s.date===d)):[];
 const dates=matched.length?matched:published;
 const ranked=daily?[...dates].sort((a,b)=>{const score=(d:string)=>scenes?.dates.find(s=>s.date===d)?.sceneCloudMax??101;return score(a)-score(b)||b.localeCompare(a);}):dates;
 const selected=dates.includes(date)?date:ranked[0]??'';
 const native=layer==='terrain'?10:SATELLITE_LAYERS[layer].resolutionM;
 const bounds=shape?satelliteBounds(shape,basemap?350:wide?Math.max(1000,native*50):Math.max(350,native*18)):[0,0,1,1];
 const xy=(p:number[])=>framePoint(p,bounds);
 const path=(rings:number[][][])=>rings.map(r=>r.map((p,i)=>(i?'L':'M')+' '+xy(p).join(' ')).join(' ')+' Z').join(' ');
 const outline=shape?path(shape.coordinates):'',scale=imageScale(bounds);
 const src=shape&&allowed&&layer!=='terrain'?(basemap?'esri-tiles:'+bounds.join(',')+':'+retry:selected?layer+':'+selected+':'+bounds.join(',')+':'+retry:''):'';
 const displayedCoverage=coverage?.key===src?coverage.percent:null;
 const area=c.areaM2??land?.areaM2??null;
 useEffect(()=>{setImageState('');setReceived('');setBaseError('');},[src]);
 function chooseDate(value:string){search.current={done:true,tried:[],best:null};setDate(value);setError('');}
 function inspectImage(img:HTMLCanvasElement){
  if(!shape)return;
  let percent:number|null=null;
  try{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const ctx=canvas.getContext('2d');
   if(ctx){ctx.drawImage(img,0,0,640,400);percent=parcelImageCoverage(ctx.getImageData(0,0,640,400).data,640,400,shape.coordinates.map(r=>r.map(xy))).percent;}
  }catch{percent=null;}
  const s=search.current;
  if(percent!==null&&!s.done){
   if(!s.tried.includes(selected))s.tried.push(selected);
   if(!s.best||percent>s.best.percent)s.best={date:selected,percent};
   const next=ranked.find(d=>!s.tried.includes(d));
   if(percent<80&&s.tried.length<4&&next){setDate(next);return;}
   s.done=true;
   if(percent<80&&s.best&&s.best.percent>percent&&s.best.date!==selected){setDate(s.best.date);return;}
  }
  setCoverage({key:src,percent});setReceived(src);
  setImageState(percent===null?'Couverture du contour non quantifiable : vérifiez l’image et les nuages.':percent<20?'Trop peu de pixels affichés sur votre contour pour interpréter cette couche.':percent<95?'Image partielle : les zones hachurées restent sans donnée affichée.':'Pixels affichés sur le contour : vérifiez les nuages avant toute interprétation.');
 }
 function showPhoto(){setRgbSource('hd');setLayer('rgb');setError('');}
 return <section className="field-map-card parcel-layer-card" aria-label="Images et classes du terrain">
  <div className="field-panel-title"><h3>Observer mon champ</h3><button className="qs-text-button" onClick={onMap}>Ouvrir la carte ↗</button></div>
  <div className="parcel-layer-tabs" aria-label="Choisir une couche du champ">{titles.map(([name,title])=><button key={name} aria-pressed={layer===name} onClick={()=>{setLayer(name);setDate('');setError('');}}>{title}</button>)}</div>
  {layer!=='terrain'&&!allowed?<div className="satellite-consent"><strong>Images de la parcelle</strong><p>Digital Earth Africa et le fond satellite Esri recevront l’emprise géographique de ce champ pour afficher leurs images publiques. Aucune donnée de compte, note ou récolte ne lui sera transmise.</p><button className="btn secondary" onClick={()=>setAllowedFor(identity)}>Charger les images de cette parcelle</button></div>:<>
   {layer!=='terrain'&&<>
    <div className="satellite-controls">
     {layer==='rgb'&&<label>Type d’image<select aria-label="Type d’image satellite" value={rgbSource} onChange={e=>{setRgbSource(e.target.value as 'hd'|'dated');setDate('');}}><option value="hd">Photo de repérage · Esri</option><option value="dated">Observation Sentinel datée · 10 m</option></select></label>}
     {!basemap&&<label>Date de l’observation<select aria-label="Date de l’image satellite" disabled={!dates.length||loading} value={selected} onChange={e=>chooseDate(e.target.value)}>{dates.length?dates.map(d=><option key={d} value={d}>{new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',layer==='anomaly'?{month:'long',year:'numeric'}:{day:'numeric',month:'short',year:'numeric'})}</option>):<option>{loading?'Chargement des dates…':'Aucune date disponible'}</option>}</select></label>}
     {!basemap&&<div className="imagery-view-switch" aria-label="Cadrage de l’image"><button aria-pressed={!wide} onClick={()=>setWide(false)}>Vue parcelle</button><button aria-pressed={wide} onClick={()=>setWide(true)}>Vue de contexte</button></div>}
     <button className="qs-text-button" onClick={()=>{setRetry(x=>x+1);setError('');setBaseError('');}}>Actualiser l’image ↻</button>
    </div>
    <div className="imagery-resolution"><strong>{basemap?'Photo pour repérer les détails du terrain':native+' m par pixel source'}</strong><span>{basemap?'Date de prise de vue non documentée':area!==null?'Surface du contour ≈ '+fmt(area/(native*native),0)+' pixels en équivalent de surface · avant nuages et bordures':'Agrandir l’affichage n’ajoute pas de détails au capteur.'}</span></div>
   </>}
   <div className="parcel-raster-frame">
    <svg viewBox="0 0 640 400" role="img" aria-label={layer==='terrain'?'Classes cartographiées du contour':basemap?'Photo de repérage Esri':SATELLITE_LAYERS[layer].label+', '+(selected||'date en attente')}>
     <defs><pattern id={id+'unknown'} width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#e6e9e7"/><path d="M0 10 10 0" stroke="#a7b0b2" strokeWidth=".7"/></pattern></defs><rect width="640" height="400" fill="#e7ecec"/>
     {layer==='terrain'?(land?Object.entries(land.fractions).map(([cls,v])=><g key={cls}>{v.geometry.coordinates.map((r,i)=><path key={i} d={path(r)} fill={cls==='unknown'?'url(#'+id+'unknown)':LAND_COLORS[cls as keyof typeof LAND_COLORS]} fillRule="evenodd"/>)}</g>):<path d={outline} fill={'url(#'+id+'unknown)'} fillRule="evenodd"/>):null}
    </svg>
    {shape&&allowed&&layer!=='terrain'&&(basemap||photo)&&<BasemapMosaic key={'base:'+bounds.join(',')+':'+retry} bounds={bounds} onLoad={()=>{setBaseError('');if(basemap){setReceived(src);setImageState('Fond photo chargé par tuiles. Date de prise de vue et résolution effective non documentées.');}}} onError={()=>{setBaseError('Fond photo indisponible depuis ce réseau. Les observations datées restent séparées.');if(basemap)setReceived(src);}}/>}
    {src&&!basemap&&<><div className="imagery-nodata-pattern" aria-hidden="true"/><div className="imagery-index-layer" style={{opacity:displayedCoverage!==null&&displayedCoverage<20?0:opacity/100}}><SatelliteMosaic key={src} layer={layer as SatelliteLayer} date={selected} bounds={bounds} onLoad={inspectImage} onError={()=>{setReceived(src);setError('Observation indisponible à cette date. Choisissez une autre date ou la photo de repérage.');}}/></div></>}
    <svg className="parcel-raster-outline" viewBox="0 0 640 400" aria-hidden="true"><path d={outline} fill="none" stroke="#fff" strokeWidth="4"/><path d={outline} fill="none" stroke="#14364f" strokeWidth="1.4"/><path d={'M22 374h'+scale.pixels+'m-'+scale.pixels+' -4v8m'+scale.pixels+' -8v8'} stroke="#fff" strokeWidth="4" fill="none"/><path d={'M22 374h'+scale.pixels} stroke="#15364a" strokeWidth="1.5"/><text x="22" y="361" fill="#fff" stroke="#17364b" paintOrder="stroke" strokeWidth="3" fontSize="10">≈ {scale.meters>=1000?fmt(scale.meters/1000)+' km':scale.meters+' m'}</text><text x="602" y="27" fill="#fff" stroke="#163a51" paintOrder="stroke" strokeWidth="3" fontSize="13">N ↑</text></svg>
    {layer!=='terrain'&&(loading&&!basemap||src&&received!==src)&&<span className="satellite-loading" role="status">{search.current.tried.length?'Recherche d’une observation mieux renseignée…':'Chargement de l’image…'}</span>}
    {!basemap&&displayedCoverage!==null&&displayedCoverage<20&&<div className="imagery-empty"><strong>Couverture insuffisante sur le champ</strong><p>{displayedCoverage} % du contour comporte des pixels affichés à cette date.</p><button className="btn secondary" onClick={showPhoto}>Voir la photo de repérage</button></div>}
    {observations&&allowed&&!loading&&!selected&&<div className="imagery-empty"><strong>Observation datée indisponible</strong><p>Aucune date exploitable dans la réponse reçue. Le fond photo sert uniquement au repérage.</p><button className="btn secondary" onClick={showPhoto}>Ouvrir la photo de repérage</button></div>}
   </div>
   {layer==='terrain'?<>
    <div className="parcel-class-legend">{Object.entries(LAND_NAMES).map(([cls,name])=>{const v=land?.fractions[cls as keyof typeof LAND_NAMES];return <span key={cls}><i style={{background:LAND_COLORS[cls as keyof typeof LAND_COLORS]}}/>{name}{v?' · '+fmt(v.fraction*100)+' %':''}</span>;})}</div>
    <p className="satellite-note">{land?'Terre potentielle : '+fmt(land.candidateAreaM2/10000,3)+' ha sur '+fmt(land.areaM2/10000,3)+' ha de contour. ':'Analyse terre/eau en préparation. '}Une terre cartographiée n’est pas automatiquement cultivable.</p><details><summary>Sources et dates du terrain</summary>{land?.sources.map(s=><p key={s.id}>{s.provider} · {s.product} · {s.version} · {s.resolutionM??'—'} m · {s.observedAt??s.referencePeriod?.from??'date non documentée'}</p>)}</details>
   </>:<>
    {!basemap&&<div className="imagery-overlay-controls"><label><input type="checkbox" checked={photo} onChange={e=>setPhoto(e.target.checked)}/> Fond photo</label><label>Opacité des couleurs <input type="range" min="25" max="100" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/>{opacity} %</label><span>{displayedCoverage!==null?'Pixels affichés : '+displayedCoverage+' % du contour':'Couverture à vérifier'}</span></div>}
    <p className="satellite-note" role="status">{imageState}</p>
    {basemap?<small className="satellite-credit">Esri, Vantor, Earthstar Geographics, GIS User Community · fond photo non daté ; il ne mesure ni la vigueur ni le stress actuel.</small>:<>
     <p className="imagery-reading-note">Les hachures indiquent les zones sans donnée affichée. Une grande image de 1 024 pixels ne transforme pas les mailles de {native} m en photo détaillée.</p>
     {layer!=='rgb'&&<img className="satellite-legend" src={'https://ows.digitalearth.africa/legend/'+SATELLITE_LAYERS[layer].name+'/'+SATELLITE_LAYERS[layer].style+'/legend.png'} alt="Légende et couleurs du fournisseur" onError={e=>{e.currentTarget.style.display='none';}}/>}
     <details className="satellite-reading"><summary>Lire cette couche et retrouver sa source</summary><p className="satellite-note">{layer==='rgb'?'Observation datée en couleurs naturelles.':layer==='anomaly'?'Écart de végétation à la référence mensuelle historique ; il ne détermine pas la cause d’un stress ni une dose d’engrais.':layer==='classification'?'La classification distingue nuages, ombres, sol et eau. Une couleur grise n’est pas une photo du sol.':'Le NDVI décrit la végétation, sans diagnostiquer une carence, une maladie ou un manque d’eau.'} Les pixels peuvent mélanger votre champ, des arbres et des parcelles voisines.</p><p className="satellite-note">La couverture affichée est calculée sur la transparence des pixels, pas sur leur qualité agronomique ni sur l’absence de nuages.</p>{sceneWarning&&<p>{sceneWarning}</p>}{daily&&scenes&&<p>{scenes.scope}</p>}<a href={layer==='anomaly'||layer==='clear'?'https://docs.digitalearthafrica.org/en/latest/data_specs/NDVI_Anomaly_specs.html':'https://docs.digitalearthafrica.org/en/latest/data_specs/Sentinel-2_Level-2A_specs.html'} target="_blank" rel="noreferrer">Digital Earth Africa / Copernicus · sources et limites ↗</a></details>
     {layer==='anomaly'&&<button className="qs-text-button" onClick={()=>setLayer('clear')}>Vérifier les observations claires du mois →</button>}
    </>}
   </>}
  </>}
  {baseError&&<p className="satellite-note">{baseError} <button className="qs-text-button" onClick={()=>setRetry(x=>x+1)}>Réessayer le fond photo</button></p>}
  {error&&<p className="notice warning" role="alert">{error} <button className="qs-text-button" onClick={()=>{setRetry(x=>x+1);setError('');}}>Recharger les images</button></p>}
 </section>;
}
