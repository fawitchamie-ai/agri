'use client';
import {useEffect,useId,useMemo,useState} from 'react';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import type {ZoneSeasonRead} from '../../lib/seasonal/field-zones';
import {zoneGrid,analyzeFieldZones,ZONE_COLORS,ZONE_NAMES} from '../../lib/seasonal/field-zones';
import {fieldImageSummary} from '../../lib/seasonal/field-analysis';
import {framePoint,imageScale} from '../../lib/seasonal/imagery-display';
import {geometryIdentity} from '../../lib/seasonal/provenance';
import {LAND_COLORS,LAND_NAMES} from '../../lib/seasonal/land-display';
import BasemapMosaic from './basemap-mosaic';
import SatelliteMosaic from './satellite-mosaic';
import {ProductIcon} from './product-ui';

export type AnalysisLayer='ndvi'|'contrast'|'rgb'|'history'|'terrain'|'photo';
export const ANALYSIS_LAYERS=[
 {id:'ndvi',name:'NDVI',detail:'Échelle fixe · −1 à 1',icon:'leaf'},
 {id:'contrast',name:'NDVI contrasté',detail:'Différences dans le champ',icon:'settings'},
 {id:'rgb',name:'Satellite daté',detail:'Couleurs naturelles · 10 m',icon:'satellite'},
 {id:'history',name:'Zones historiques',detail:'Vigueur et stabilité',icon:'grid'},
 {id:'terrain',name:'Terre et eau',detail:'Occupation cartographiée',icon:'water'},
 {id:'photo',name:'Photo de repérage',detail:'Esri · date inconnue',icon:'map'},
] as const;
const fmt=(n:number|null|undefined,d=2)=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
export const dateLabel=(d:string)=>d?new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'Date à choisir';
const colour=(v:number,min:number,max:number)=>{const t=max-min<1e-6?.5:Math.max(0,Math.min(1,(v-min)/(max-min)));return `rgb(${Math.round(221-203*t)},${Math.round(237-175*t)},${Math.round(249-144*t)})`;};

export default function FieldAnalysisMap({config:c,grid,history,read,date,layer,allowed,photo,bounds,selected,onSelect,onHistory,onLoad,onTerrain}:{config:SeasonalConfig;grid:ReturnType<typeof zoneGrid>;history:ReturnType<typeof analyzeFieldZones>;read?:ZoneSeasonRead;date:string;layer:AnalysisLayer;allowed:boolean;photo:boolean;bounds:number[];selected:number|null;onSelect:(id:number)=>void;onHistory:()=>void;onLoad:()=>void;onTerrain:()=>void}){
 const key=useId().replaceAll(':',''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const data=useMemo(()=>fieldImageSummary(grid,read),[grid,read]),byId=new Map(history.cells.map(v=>[v.id,v]));
 const path=(coordinates:number[][][][])=>coordinates.map(p=>p.map(r=>'M'+r.map(v=>framePoint(v,bounds).join(',')).join('L')+'Z').join(' ')).join(' ');
 const outline=path([c.parcelGeometry!.coordinates]),land=c.landAssessment&&geometryIdentity(c.landAssessment.geometry)===geometryIdentity(c.parcelGeometry)?c.landAssessment:undefined;
 const min=layer==='contrast'?data.minimum??-1:-1,max=layer==='contrast'?data.maximum??1:1;
 const raster=layer==='rgb'||layer==='photo',empty=layer==='history'?history.status==='insufficient':layer==='terrain'?!land:!raster&&!data.cells;
 const scale=imageScale(bounds),cell=grid.cells.find(v=>v.id===selected),value=selected===null?null:data.values.get(selected)??null;
 useEffect(()=>{setError('');setLoading(allowed&&(layer==='photo'||layer==='rgb'&&!!date));},[layer,allowed,date,bounds.join(',')]);
 return <figure className="fa-map" aria-label={ANALYSIS_LAYERS.find(v=>v.id===layer)!.name+' du champ'}>
  <div className="fa-map-surface">
   <svg viewBox="0 0 640 400" aria-hidden="true"><defs><pattern id={key+'grid'} width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#6b8eaa" strokeOpacity=".1"/></pattern><pattern id={key+'missing'} width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#e6edf3"/><path d="M0 9 9 0" stroke="#aebfce" strokeWidth="1"/></pattern></defs><rect width="640" height="400" fill="#edf3f7"/><rect width="640" height="400" fill={'url(#'+key+'grid)'}/></svg>
   {allowed&&(photo||layer==='photo')&&<BasemapMosaic key={'base:'+bounds.join(',')} bounds={bounds} onLoad={()=>{if(layer==='photo')setLoading(false);}} onError={()=>{if(layer==='photo')setLoading(false);setError('Photo de repérage indisponible.');}}/>}
   {allowed&&layer==='rgb'&&date&&<div className="fa-dated-raster"><SatelliteMosaic key={date+':'+bounds.join(',')} layer="rgb" date={date} bounds={bounds} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setError('Image Sentinel-2 indisponible à cette date. Les valeurs NDVI archivées restent distinctes.');}}/></div>}
   <svg className="fa-map-values" viewBox="0 0 640 400" aria-label="Cellules et contour du champ">
    {!raster&&layer!=='terrain'&&grid.cells.map(v=>{
     const ndvi=data.values.get(v.id),zone=byId.get(v.id)?.zone??'unknown';
     const fill=layer==='history'?zone==='unknown'?'url(#'+key+'missing)':ZONE_COLORS[zone]:ndvi===undefined?'url(#'+key+'missing)':colour(ndvi,min,max);
     const label=layer==='history'?ZONE_NAMES[zone]:ndvi===undefined?'Sans observation':'NDVI '+fmt(ndvi,3);
     return <path key={v.id} data-cell={v.id} d={path(v.geometry.coordinates)} fill={fill} fillRule="evenodd" stroke={selected===v.id?'#bc7a22':'#ffffff44'} strokeWidth={selected===v.id?2:.35} tabIndex={v.id===(selected??grid.cells[0]?.id)?0:-1} role="button" aria-label={label+' · cellule '+v.id} onMouseEnter={()=>onSelect(v.id)} onFocus={()=>onSelect(v.id)} onClick={()=>onSelect(v.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(v.id);}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=grid.cells[grid.cells.indexOf(v)+(e.key==='ArrowRight'?1:-1)];if(next){onSelect(next.id);e.currentTarget.ownerSVGElement?.querySelector<SVGElement>('[data-cell="'+next.id+'"]')?.focus();}}}}><title>{label} · {fmt(v.areaM2)} m²</title></path>;
    })}
    {layer==='terrain'&&(land?Object.entries(land.fractions).map(([id,v])=><path key={id} d={path(v.geometry.coordinates)} fill={LAND_COLORS[id as keyof typeof LAND_COLORS]??'#dce5ef'} fillRule="evenodd"><title>{LAND_NAMES[id as keyof typeof LAND_NAMES]} · {fmt(v.areaM2/10000)} ha</title></path>):<path d={outline} fill={'url(#'+key+'missing)'} fillRule="evenodd"/>)}
    <path d={outline} fill="none" stroke="#fff" strokeWidth="4"/><path d={outline} fill="none" stroke="#193b5b" strokeWidth="1.3"/>
    <text x="604" y="30" fill="#183e62" fontSize="13" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">N ↑</text><path d={'M24 369h'+scale.pixels} stroke="#fff" strokeWidth="4"/><path d={'M24 369h'+scale.pixels} stroke="#153a5f" strokeWidth="1.5"/><text x="24" y="355" fontSize="11" fill="#153a5f" stroke="#fff" strokeWidth="3" paintOrder="stroke">{scale.meters>=1000?fmt(scale.meters/1000)+' km':scale.meters+' m'}</text>
   </svg>
   {raster&&!allowed?<div className="fa-map-empty"><ProductIcon name="satellite" size={28}/><strong>Charger les images du champ</strong><span>Autorisez le chargement pour voir cette couche.</span><button className="btn secondary small" onClick={onLoad}>Choisir les images</button></div>:empty?<div className="fa-map-empty"><ProductIcon name="map" size={28}/><strong>{layer==='history'?'Historique à compléter':layer==='terrain'?'Terrain non renseigné':'Votre champ, prêt à observer'}</strong><span>{layer==='history'?'Chargez plusieurs saisons comparables.':layer==='terrain'?'Préparez l’analyse terre et eau depuis la carte.':'Chargez une date pour afficher le NDVI du champ.'}</span><button className="btn secondary small" onClick={layer==='history'?onHistory:layer==='terrain'?onTerrain:onLoad}>{layer==='history'?'Préparer les saisons':layer==='terrain'?'Vérifier le terrain':'Charger une observation'}</button></div>:null}
   {allowed&&layer==='rgb'&&!date&&<div className="fa-map-empty"><strong>Choisissez une acquisition datée</strong><button className="btn secondary small" onClick={onLoad}>Charger une date</button></div>}
   {loading&&<span className="fa-image-status" role="status">Chargement de l’image…</span>}{error&&<span className="fa-image-error" role="alert">{error}</span>}
   <span className="fa-map-stamp">{layer==='photo'?'Esri · date inconnue':layer==='history'?history.reads.length+' saisons':layer==='terrain'?'Classes du terrain':date?dateLabel(date):'Aucune observation'}</span>
  </div>
  <figcaption>{layer==='ndvi'||layer==='contrast'?<><div className="fa-scale"><span>{fmt(min)}</span><i/><span>{fmt(max)}</span></div><span>{layer==='contrast'?'Échelle adaptée à cette image':'Échelle NDVI fixe · comparable entre dates'} · hachures : sans donnée</span><strong>{cell?'Cellule '+cell.id+' · '+fmt(cell.areaM2)+' m² · NDVI '+fmt(value,3):'Survolez ou sélectionnez une cellule pour lire sa valeur'}</strong></>:layer==='history'?<div className="fa-zone-key">{Object.entries(ZONE_NAMES).map(([z,label])=><span key={z}><i style={{background:ZONE_COLORS[z as keyof typeof ZONE_COLORS]}}/>{label}</span>)}</div>:<span>{layer==='photo'?'Fond de repérage : date de prise de vue inconnue.':layer==='rgb'?'Sentinel-2 daté · les nuages peuvent masquer le champ.':'Occupation cartographiée ; à confirmer sur le terrain.'}</span>}</figcaption>
 </figure>;
}
