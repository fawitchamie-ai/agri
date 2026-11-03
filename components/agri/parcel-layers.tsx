'use client';
import {useEffect,useId,useState} from 'react';
import SatelliteMosaic from './satellite-mosaic';
import {seasonalRequest} from '../../lib/seasonal/request';
import {geometryIdentity} from '../../lib/seasonal/provenance';
import {satelliteBounds,satelliteBasemapUrl,SATELLITE_LAYERS,type SatelliteLayer,satelliteCatalog,satelliteScenes} from '../../lib/seasonal/satellite';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import type {LandAssessment} from '../../lib/seasonal/land';
import {LAND_COLORS,LAND_NAMES} from '../../lib/seasonal/land-display';
const fmt=(n:number,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const titles:[('terrain'|SatelliteLayer),string][]=[['terrain','Terre / eau'],['rgb','Satellite'],['ndvi','Vigueur'],['anomaly','Stress possible'],['classification','Nuages / eau']];
type Catalog=Awaited<ReturnType<typeof satelliteCatalog>>;
export default function ParcelLayers({config:c,assessment,onMap}:{config:SeasonalConfig;assessment?:LandAssessment;onMap:()=>void}){
 const [layer,setLayer]=useState<'terrain'|SatelliteLayer>('terrain'),[allowedFor,setAllowedFor]=useState(''),[catalog,setCatalog]=useState<Catalog|null>(null),[date,setDate]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[imageState,setImageState]=useState('');
 const [rgbSource,setRgbSource]=useState<'hd'|'dated'>('hd'),[wide,setWide]=useState(true),[hdWidth,setHdWidth]=useState<1600|1024|640>(1600);
 const [forceBasemap,setForceBasemap]=useState(false),[attempted,setAttempted]=useState<string[]>([]);
 const [scenes,setScenes]=useState<Awaited<ReturnType<typeof satelliteScenes>>|null>(null),[sceneWarning,setSceneWarning]=useState('');
 const id=useId().replace(/:/g,''),identity=geometryIdentity(c.parcelGeometry),shape=c.parcelGeometry;
 const allowed=allowedFor===identity;
 const observations=layer!=='terrain'&&(layer!=='rgb'||rgbSource==='dated');
 const land=assessment&&geometryIdentity(assessment.geometry)===identity?assessment:undefined;
 useEffect(()=>{setHdWidth(1600);setAllowedFor('');setCatalog(null);setScenes(null);setSceneWarning('');setError('');setImageState('');setLayer('terrain');},[identity]);
 useEffect(()=>{if(!allowed||!shape||!observations){setLoading(false);return;}const ctrl=new AbortController();setLoading(true);setError('');setScenes(null);setSceneWarning('');
  // Public imagery metadata is read directly after consent: it need not consume
  // the simulation Worker's CPU. Keep the authenticated route as a CORS/network fallback.
  const catalogTask=satelliteCatalog(c.asOfDate).catch(reason=>{if(ctrl.signal.aborted)throw reason;return seasonalRequest<Catalog>({action:'satellite-catalog',asOfDate:c.asOfDate},ctrl.signal).catch(()=>{throw reason;});});
  const scenesTask=satelliteScenes(shape,c.asOfDate).catch(reason=>{if(ctrl.signal.aborted)throw reason;return seasonalRequest<Awaited<ReturnType<typeof satelliteScenes>>>({action:'satellite-scenes',geometry:shape,asOfDate:c.asOfDate},ctrl.signal).catch(()=>{throw reason;});});
  Promise.allSettled([catalogTask,scenesTask])
   .then(([catalogResult,sceneResult])=>{if(ctrl.signal.aborted)return;if(catalogResult.status==='fulfilled')setCatalog(catalogResult.value);else setError(catalogResult.reason instanceof TypeError?'Le fournisseur d’images est injoignable depuis ce réseau. Réessayez plus tard, ou ouvrez le fond de repérage dans « Satellite ».':catalogResult.reason.message);if(sceneResult.status==='fulfilled')setScenes(sceneResult.value);else setSceneWarning('Les dates propres au champ sont indisponibles ; les dates régionales restent proposées, avec couverture locale à vérifier.');})
   .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});return()=>ctrl.abort();
 },[allowed,c.asOfDate,identity,observations]);
 useEffect(()=>{setForceBasemap(false);setAttempted([]);},[identity,layer,c.asOfDate]);
 const publishedDates=layer==='terrain'?[]:catalog?.layers[layer]?.dates??[];
 const daily=layer!=='terrain'&&SATELLITE_LAYERS[layer].period==='day';
 const matchedDates=daily&&scenes?publishedDates.filter(d=>scenes.dates.some(s=>s.date===d)):[];
 const regionalFallback=daily&&!!scenes&&!matchedDates.length;
 const dates=daily&&scenes&&matchedDates.length?matchedDates:publishedDates;
 const selected=dates.includes(date)?date:(daily&&scenes?dates.find(d=>{const s=scenes.dates.find(s=>s.date===d);return s?.sceneCloudMax!=null&&s.sceneCloudMax<=30;}):undefined)??dates[0]??'';
 const native=layer==='terrain'?10:SATELLITE_LAYERS[layer].resolutionM;
 const rawBounds=shape?satelliteBounds(shape,layer!=='terrain'&&layer!=='rgb'&&wide?native*100:200):[0,0,1,1];
 // ArcGIS export preserves its image aspect in the requested CRS. Match that extent for the contour.
 const hd=layer==='rgb'&&(rgbSource==='hd'||forceBasemap||!loading&&!selected),cx=(rawBounds[0]+rawBounds[2])/2,cy=(rawBounds[1]+rawBounds[3])/2;
 const bw=Math.max(rawBounds[2]-rawBounds[0],(rawBounds[3]-rawBounds[1])*1.6),bh=bw/1.6;
 const bounds=hd?[cx-bw/2,cy-bh/2,cx+bw/2,cy+bh/2]:rawBounds;
 const xy=(p:number[])=>[(p[0]-bounds[0])/(bounds[2]-bounds[0])*640,400-(p[1]-bounds[1])/(bounds[3]-bounds[1])*400];
 const path=(rings:number[][][])=>rings.map(r=>r.map((p,i)=>`${i?'L':'M'} ${xy(p).join(' ')}`).join(' ')+' Z').join(' ');
 const outline=shape?path(shape.coordinates):'';
 const basemap=layer==='rgb'&&allowed&&(rgbSource==='hd'||!loading&&(!selected||forceBasemap));
 const src=shape&&allowed&&layer!=='terrain'?(basemap?satelliteBasemapUrl(bounds,hdWidth):selected?'/api/seasonal?'+new URLSearchParams({satellite:'image',layer,date:selected,bbox:bounds.join(',')}):''):'';
 const [received,setReceived]=useState('');
 useEffect(()=>{setImageState('');setReceived('');},[src]);
 function inspectImage(img:HTMLImageElement|HTMLCanvasElement){
  if(!shape)return;if(basemap){setError('');setReceived(src);setImageState('Fond satellite Esri chargé ; date de prise de vue non documentée, sans indice de végétation.');return;}try{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const context=canvas.getContext('2d');if(!context)return;context.drawImage(img,0,0,640,400);const pixels=context.getImageData(0,0,640,400).data,mask=new Path2D(outline);let inside=0,visible=0;for(let y=2;y<400;y+=4)for(let x=2;x<640;x+=4)if(context.isPointInPath(mask,x,y,'evenodd')){inside++;if(pixels[(y*640+x)*4+3]>0)visible++;}if(inside>0&&visible===0){const tried=[...attempted,selected],next=dates.find(d=>!tried.includes(d));if(next&&tried.length<4){setAttempted(tried);setDate(next);return;}if(layer==='rgb'){setForceBasemap(true);return;}}setReceived(src);setImageState(inside===0?'Contour trop petit pour qualifier la couverture de pixels ; agrandissez la carte.':visible===0?'Aucune donnée visible sur le contour à cette date. Choisissez une autre date.':visible<inside*.95?'Image partiellement renseignée sur le contour ; les zones transparentes restent inconnues.':'Image reçue. Vérifiez les nuages dans « Nuages / eau » avant interprétation.');}catch{setReceived(src);setImageState('Image reçue ; couverture et nuages à vérifier.');}
 }
 return <section className="field-map-card parcel-layer-card" aria-label="Images et classes du terrain"><div className="field-panel-title"><h3>Mon champ en images</h3><button className="qs-text-button" onClick={onMap}>Agrandir la carte ↗</button></div><div className="parcel-layer-tabs" aria-label="Choisir une couche du champ">{titles.map(([id,title])=><button key={id} aria-pressed={layer===id} onClick={()=>{setLayer(id);setDate('');setError('');}}>{title}</button>)}</div>
  {layer!=='terrain'&&!allowed?<div className="satellite-consent"><strong>Images de la parcelle</strong><p>Digital Earth Africa et le fond satellite Esri recevront l’emprise géographique de ce champ pour afficher leurs images publiques. Aucune donnée de compte, note ou récolte ne lui sera transmise.</p><button className="btn secondary" onClick={()=>setAllowedFor(identity)}>Charger les images de cette parcelle</button></div>:<>
   {layer!=='terrain'&&<div className="satellite-controls">{layer==='rgb'&&<label>Type d’image<select aria-label="Type d’image satellite" value={rgbSource} onChange={e=>setRgbSource(e.target.value as 'hd'|'dated')}><option value="hd">Repérage haute définition</option><option value="dated">Observation Sentinel datée · 10 m</option></select></label>}{!basemap&&<label>Date disponible<select aria-label="Date de l’image satellite" disabled={!dates.length||loading} value={selected} onChange={e=>setDate(e.target.value)}>{dates.length?dates.map(d=><option key={d} value={d}>{new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',layer==='anomaly'?{month:'long',year:'numeric'}:{day:'numeric',month:'short',year:'numeric'})}</option>):<option>{loading?'Chargement des dates…':'Aucune date disponible'}</option>}</select></label>}{!basemap&&layer!=='rgb'&&<button className="btn secondary" aria-pressed={wide} onClick={()=>setWide(!wide)}>{wide?'Vue de contexte':'Vue rapprochée'} ↔</button>}{<small>{basemap?`${fmt(hdWidth,0)} × ${fmt(hdWidth/1.6,0)} px · meilleur détail disponible localement`:`${native} m par maille · 1 024 × 640 px affichés`}</small>}</div>}
   <div className="parcel-raster-frame"><svg viewBox="0 0 640 400" role="img" aria-label={layer==='terrain'?'Classes cartographiées dans le contour de la parcelle':basemap?'Fond satellite de repérage Esri':`${SATELLITE_LAYERS[layer].label}, ${selected||'date en attente'}`}><defs><filter id="satellite-blue-palette" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values=".46 .274 .15 0 .035  .46 .274 .15 0 .09  .43 .256 .14 0 .19  0 0 0 1 0"/></filter><pattern id={id+'unknown'} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#d3dfee"/><path d="M 0 12 L 12 0" stroke="#a2b5cb" strokeWidth="1"/></pattern></defs><rect width="640" height="400" fill="#edf0f3"/>{layer==='terrain'?land?Object.entries(land.fractions).map(([cls,v])=><g key={cls}>{v.geometry.coordinates.map((r,i)=><path key={i} d={path(r)} fill={cls==='unknown'?`url(#${id}unknown)`:LAND_COLORS[cls as keyof typeof LAND_COLORS]} stroke="none" fillRule="evenodd"/>)}</g>):<path d={outline} fill={`url(#${id}unknown)`} fillRule="evenodd"/>:null}<path d={outline} fill="none" stroke={layer==='terrain'?'#243853':'#fff'} strokeWidth="3"/><text x="600" y="28" fill="#38536a" fontSize="16">N ↑</text></svg>{src&&(basemap?<img key={src} className="parcel-raster-image" src={src} alt="Fond satellite haute définition Esri ; date de prise de vue non documentée" onLoad={e=>inspectImage(e.currentTarget)} onError={()=>{if(hdWidth===1600){setHdWidth(1024);return;}if(hdWidth===1024){setHdWidth(640);return;}setReceived(src);setError('Fond détaillé indisponible. Essayez l’observation Sentinel datée.');}}/>:<SatelliteMosaic key={src} layer={layer as SatelliteLayer} date={selected} bounds={bounds} onLoad={inspectImage} onError={()=>{setReceived(src);if(layer==='rgb')setForceBasemap(true);else setError('Image indisponible à cette date. Choisissez une autre observation.');}}/>)}{src&&<svg className="parcel-raster-outline" viewBox="0 0 640 400" aria-hidden="true"><path d={outline} fill="none" stroke="#fff" strokeWidth="3"/><path d={outline} fill="none" stroke="#163b54" strokeWidth="1" strokeDasharray="5 4"/></svg>}{layer!=='terrain'&&(!basemap&&loading||src&&received!==src)&&<span className="satellite-loading" role="status">Chargement de l’image…</span>}</div>
   {layer==='terrain'?<>
    <div className="parcel-class-legend">{Object.entries(LAND_NAMES).map(([cls,name])=>{const value=land?.fractions[cls as keyof typeof LAND_NAMES];return <span key={cls}><i style={{background:LAND_COLORS[cls as keyof typeof LAND_COLORS]}}/>{name}{value?` · ${fmt(value.fraction*100)} %`:''}</span>;})}</div>
    <p className="satellite-note">{land?`Terre potentielle : ${fmt(land.candidateAreaM2/10000,3)} ha sur ${fmt(land.areaM2/10000,3)} ha de contour. `:'Analyse terre/eau en préparation. '}Les zones inconnues restent inconnues ; une terre cartographiée n’est pas automatiquement cultivable.</p>
    <details><summary>Sources et dates du terrain</summary>{land?.sources.map(s=><p key={s.id}>{s.provider} · {s.product} · {s.version} · {s.resolutionM??'—'} m · {s.observedAt??s.referencePeriod?.from??'date non documentée'} · {s.status==='available'?'récupéré':'indisponible'}{s.reason?` : ${s.reason}`:''}</p>)}</details>
   </>:<>
    <p className="satellite-note" role="status">{imageState}</p>
    {basemap?<small className="satellite-credit">Fond de repérage · date non documentée. Esri, Vantor, Earthstar Geographics, GIS User Community. Les indices utilisent des observations datées séparées.</small>:<>
     {!loading&&!dates.length&&<p className="satellite-note">Aucune date exploitable dans la réponse du fournisseur. Rechargez le catalogue ; cela ne signifie pas une absence de végétation.</p>}
     {layer!=='rgb'&&<img className="satellite-legend analytical-raster" src={`https://ows.digitalearth.africa/legend/${SATELLITE_LAYERS[layer].name}/${SATELLITE_LAYERS[layer].style}/legend.png`} alt="Légende du fournisseur, recolorée avec la même palette bleue que l’image" onError={e=>{e.currentTarget.style.display='none';}}/>}
     <details className="satellite-reading"><summary>Lire cette image et retrouver sa source</summary>
      <p className="satellite-note">{layer==='rgb'?'Observation en couleurs naturelles ; 10 m par pixel source.':layer==='anomaly'?'Une anomalie négative indique un couvert moins vigoureux que sa référence historique pour ce mois. Elle ne détermine pas la cause du stress ni une dose d’engrais.':layer==='classification'?'La classification SCL distingue les nuages, ombres, sol et eau ; elle ne remplace pas le contrôle des inondations au champ.':'Le NDVI décrit la végétation, sans diagnostiquer une carence, une maladie ou un manque d’eau.'} Nuages et pixels mixtes peuvent masquer de petites parcelles.</p>
      {layer!=='rgb'&&<p className="satellite-note">Palette bleue de présentation, appliquée aussi à la légende. Le lissage des indices n’ajoute aucune mesure ; les classes nuages/eau gardent leurs mailles distinctes.</p>}
      {regionalFallback&&<p className="satellite-note">Pas de correspondance dans le catalogue de scènes : dates régionales proposées ; la couverture du contour est vérifiée à l’affichage.</p>}
      {daily&&scenes&&<p className="satellite-note">{scenes.dates.find(s=>s.date===selected)?.sceneCloudMax!=null?`Nuages sur la scène entière : jusqu’à ${fmt(scenes.dates.find(s=>s.date===selected)!.sceneCloudMax!)} %. `:''}{scenes.scope}</p>}
      {sceneWarning&&<p className="satellite-note">{sceneWarning}</p>}
      <small className="satellite-credit">Digital Earth Africa · Copernicus Sentinel-2{layer==='anomaly'||layer==='clear'?' et Landsat':''} · <a href={layer==='anomaly'||layer==='clear'?'https://docs.digitalearthafrica.org/en/latest/data_specs/NDVI_Anomaly_specs.html':'https://docs.digitalearthafrica.org/en/latest/data_specs/Sentinel-2_Level-2A_specs.html'} target="_blank" rel="noreferrer">Source et limites ↗</a></small>
     </details>
     {layer==='anomaly'&&<button className="qs-text-button" onClick={()=>setLayer('clear')}>Vérifier les observations claires du mois →</button>}
    </>}
   </>}
  </>}{error&&<p className="notice warning" role="alert">{error}<button className="qs-text-button" onClick={()=>{setCatalog(null);setAllowedFor('');}}>Recharger les images</button></p>}
 </section>;
}
