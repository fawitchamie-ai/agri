'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import {CROPS} from '../../lib/seasonal/catalog';
import {pointInField,type FieldVisitTarget} from '../../lib/seasonal/agronomic';
import type {Position} from '../../lib/seasonal/parcel';
import {bbox} from '../../lib/seasonal/land';
import {MINIMUM_FIELD_IMAGE_COVERAGE} from '../../lib/seasonal/sentinel-quality';
import {zoneGrid,analyzeFieldZones,fieldMonitoringScope,FIELD_ZONES_VERSION,ZONE_COLORS,MAX_CACHED_FIELD_IMAGES} from '../../lib/seasonal/field-zones';
import {fieldImageArchive,fieldImageChoices,fieldImageSummary,meetsFieldImageTarget,compareFieldImages,fieldIndexEvolution,fieldWeatherEvolution,fieldEvolutionCsv,fieldImagePeriod,dayAfter,currentFieldImageSearch,fieldComparisonBaseline,fieldCropStage,fieldVisitTarget,FIELD_CHANGE_RULE,type FieldMapFocus} from '../../lib/seasonal/field-analysis';
import type {ZoneSeasonRead,FieldMonitoring,FieldImageCheck} from '../../lib/seasonal/field-zones';
import FieldAnalysisMap,{ANALYSIS_LAYERS,dateLabel,type AnalysisLayer} from './field-analysis-map';
import FieldAnalysisChart from './field-analysis-chart';
import {ProductIcon} from './product-ui';
import './field-analysis.css';

const fmt=(n:number|null|undefined,d=2)=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
function mapBounds(c:SeasonalConfig,zoom:number){const [w,s,e,n]=bbox(c.parcelGeometry!),cos=Math.cos((s+n)/2*Math.PI/180),width=Math.max((e-w)*cos*1.35,(n-s)*1.35*1.6,.0006)/zoom,height=width/1.6;return [(w+e)/2-width/cos/2,(s+n)/2-height/2,(w+e)/2+width/cos/2,(s+n)/2+height/2] as [number,number,number,number];}
function download(body:string){const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='evolution-du-champ.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

type Props={
 config:SeasonalConfig;focus?:FieldMapFocus;initialCompare?:boolean;consent:boolean;onConsent:(value:boolean)=>void;
 onVisit:(target:FieldVisitTarget)=>void;onChange:(c:SeasonalConfig)=>void;
 onHistory:()=>void;onLayers:()=>void;onMap:()=>void;onWeather:()=>void;onNotes:()=>void;
};
export default function FieldAnalysis({config:c,focus,initialCompare=false,consent,onConsent,onVisit,onChange,onHistory,onLayers,onMap,onWeather,onNotes}:Props){
 const focusDates=focus?.dates??[];
 const scope=fieldMonitoringScope(c),grid=useMemo(()=>zoneGrid(c.parcelGeometry),[c.parcelGeometry]),history=useMemo(()=>analyzeFieldZones(c),[c]);
 const archive=useMemo(()=>fieldImageArchive(c,grid),[c,grid]),index=useMemo(()=>fieldIndexEvolution(c),[c]);
 const [layer,setLayer]=useState<AnalysisLayer>(focus?'ndvi':'contrast'),[rightLayer,setRightLayer]=useState<AnalysisLayer>('ndvi'),[compare,setCompare]=useState(initialCompare||focusDates.length===2),[expanded,setExpanded]=useState(false),[photo,setPhoto]=useState(false),[zoom,setZoom]=useState(1),[cell,setCell]=useState<number|null>(null);
 const [selected,setSelected]=useState(focusDates[0]??''),[rightDate,setRightDate]=useState(focusDates[1]??''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [zoneId,setZoneId]=useState(focus?.zone?.id??''),[pins,setPins]=useState(focus),[cropId,setCropId]=useState(''),[sowingDate,setSowingDate]=useState('');
 const [pointToMove,setPointToMove]=useState<'planned'|'comparison'|null>(null);
 const period=useMemo(()=>fieldImagePeriod(c),[c]);
 const [from,setFrom]=useState(period.from),[to,setTo]=useState(period.to),[base,setBase]=useState(''),[panel,setPanel]=useState('maps'),[showLoader,setShowLoader]=useState(!archive.length&&!consent),[manualDate,setManualDate]=useState('');
 const latest=useRef(c),controller=useRef<AbortController|null>(null),container=useRef<HTMLDivElement>(null),loader=useRef<HTMLDivElement>(null);
 latest.current=c;useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{
  if(!expanded)return;const before=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';container.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false);if(e.key==='Tab'){const nodes=[...(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')??[])],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===container.current)){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);before?.focus();};
 },[expanded]);
 const choices=useMemo(()=>fieldImageChoices(c,grid,archive),[c,grid,archive]);
 const dates=[...new Set([...choices.map(v=>v.date),...focusDates])].sort();
 const search=c.fieldMonitoring?.scope===scope&&c.fieldMonitoring.imagerySearch?currentFieldImageSearch(c.fieldMonitoring.imagerySearch):undefined;
 const date=dates.includes(selected)?selected:dates.at(-1)??'',second=dates.includes(rightDate)?rightDate:dates.filter(d=>d!==date).at(-1)??date;
 const leftChoice=choices.find(v=>v.date===date),rightChoice=choices.find(v=>v.date===second);
 const cachedRead=(day:string,itemId?:string)=>archive.find(r=>r.season.startDate===day&&(!itemId||r.scenes[0].itemId===itemId));
 const read=cachedRead(date,leftChoice?.itemId),right=cachedRead(second,rightChoice?.itemId);
 const summary=useMemo(()=>fieldImageSummary(grid,read),[grid,read]);
 const difference=useMemo(()=>compareFieldImages(grid,read,right,{archive,stageAt:day=>fieldCropStage(c,day)}),[grid,read,right,archive,c]);
 const bounds=mapBounds(c,zoom);
 const leftStage=fieldCropStage(c,date),rightStage=fieldCropStage(c,second);
 const selectedZone=difference.zones.find(zone=>zone.id===zoneId);
 const savedZone=pins?.zone&&pins.dates.includes(date)&&pins.dates.includes(second)&&date!==second&&pins.zone.gridM===grid.gridM?pins.zone:undefined;
 const suggestedVisit=useMemo(()=>selectedZone?fieldVisitTarget(grid,difference,selectedZone):undefined,[grid,difference,selectedZone]);
 const activeVisit=savedZone&&pins
  ?pins.fromNote?pins:{...suggestedVisit,...pins,zone:suggestedVisit?.zone??pins.zone,comparison:pins.comparison??suggestedVisit?.comparison}
  :suggestedVisit;
 const zones=savedZone?[savedZone,...difference.zones.filter(z=>z.id!==savedZone.id)]:difference.zones;
 const dateOption=(day:string)=>{
  const coverage=choices.find(v=>v.date===day)?.clearFraction;
  return coverage===undefined?'exploitable : inconnu':fmt(coverage*100,0)+' % exploitable';
 };
 const activeCheck=search?.entries.find(e=>e.date===date),displayedMean=read?summary.mean:activeCheck?.ndviMean??null,displayedCoverage=read?summary.coverage:activeCheck?.gridCoverage??null;
 const baseC=base.trim()!==''&&Number.isFinite(Number(base))&&Number(base)>=-20&&Number(base)<=50?Number(base):null;
 const weather=useMemo(()=>fieldWeatherEvolution(c,from,to,baseC),[c,from,to,baseC]),points=index.points.filter(p=>p.date>=from&&p.date<=to),canRead=c.asOfDate===new Date().toISOString().slice(0,10);
 function openLoader(day?:string){if(day)setManualDate(day);setShowLoader(true);setPanel('maps');window.requestAnimationFrame(()=>loader.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'}));}
 function updateMonitoring(transform:(m:FieldMonitoring)=>FieldMonitoring){
  if(fieldMonitoringScope(latest.current)!==scope||controller.current?.signal.aborted)return;
  const current=latest.current,m=current.fieldMonitoring?.scope===scope?current.fieldMonitoring:{version:FIELD_ZONES_VERSION,scope,cultivatedContour:false,comparableManagement:false,seasons:[]};
  const next={...current,fieldMonitoring:transform(m)};latest.current=next;onChange(next);
 }
 function retainCheck(check:FieldImageCheck){updateMonitoring(m=>!m.imagerySearch||check.date<m.imagerySearch.from||check.date>m.imagerySearch.to?m:{...m,imagerySearch:{...m.imagerySearch,entries:[...m.imagerySearch.entries.filter(e=>e.date!==check.date),check].sort((a,b)=>a.date.localeCompare(b.date))}});}
 function retainRead(r:ZoneSeasonRead,usable:boolean){
  if(!usable)return;
  updateMonitoring(m=>({...m,currentObservation:m.currentObservation&&meetsFieldImageTarget(grid,m.currentObservation)&&m.currentObservation.season.startDate>r.season.startDate?m.currentObservation:r,
   datedObservations:[...(m.datedObservations??[]).filter(v=>v.season.startDate!==r.season.startDate),r].slice(-MAX_CACHED_FIELD_IMAGES),...(m.prescription?{prescription:{...m.prescription,confirmed:false}}:{})}));
 }
 async function acquire(day:string,side='left',permitted=consent){
  if(!permitted||busy||!canRead||!day)return;const ctrl=new AbortController();controller.current=ctrl;setBusy(true);setError('');setNotice('');setProgress('Lecture du NDVI · '+dateLabel(day));
  try{const {readZoneSeason}=await import('../../lib/seasonal/field-zones-provider'),{verifiedImageCatalog}=await import('../../lib/seasonal/field-image-loader');
   const fetcher:typeof fetch=(input,init={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([ctrl.signal,init.signal]):ctrl.signal}),catalog=await verifiedImageCatalog(bbox(c.parcelGeometry!),day,day,fetcher);
   const r=await readZoneSeason(c.parcelGeometry,{id:'observation-'+day,startDate:day,endDate:day,cropId:'unknown',comparable:false},fetcher,undefined,ctrl.signal,undefined,{catalog,minimumClearFraction:MINIMUM_FIELD_IMAGE_COVERAGE});
   if(ctrl.signal.aborted||fieldMonitoringScope(latest.current)!==scope)return;
   const usable=meetsFieldImageTarget(grid,r);
   retainRead(r,usable);const s=fieldImageSummary(grid,r);retainCheck({date:day,status:usable?'usable':'insufficient',itemId:r.scenes[0].itemId,clearFraction:r.scenes[0].clearFraction,gridCoverage:s.coverage,cells:s.cells,ndviMean:s.mean});
   if(usable){if(side==='left')setSelected(day);else setRightDate(day);}
   setNotice(usable?'Observation chargée avec au moins 20 % de couverture exploitable. Enregistrez la campagne pour conserver les cartes.':'Date écartée : '+fmt(r.scenes[0].clearFraction*100,1)+' % de sol clair, sous l’objectif de 20 %. Les images qualifiées restent sélectionnées.');
  }catch(e){if(!ctrl.signal.aborted)setError((e as Error).message);}finally{if(controller.current===ctrl)controller.current=null;setBusy(false);setProgress('');}
 }
 async function findDates(permitted=consent){
  if(!permitted||busy||!canRead||!from||!to||from>to)return;const ctrl=new AbortController();controller.current=ctrl;setBusy(true);setError('');setNotice('');setProgress('Recherche des acquisitions du champ…');
  const fetcher:typeof fetch=(input,init={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([ctrl.signal,init.signal]):ctrl.signal});
  try{const {verifiedImageCatalog,loadUsableFieldImage,fieldImageFailureMessage}=await import('../../lib/seasonal/field-image-loader');
   const catalog=await verifiedImageCatalog(bbox(c.parcelGeometry!),from,to,fetcher),found=catalog.dates;
   if(ctrl.signal.aborted||fieldMonitoringScope(latest.current)!==scope)return;
   const previousSearch=latest.current.fieldMonitoring?.scope===scope?latest.current.fieldMonitoring.imagerySearch:undefined;
   updateMonitoring(m=>({...m,imagerySearch:{from,to,minimumCoverage:MINIMUM_FIELD_IMAGE_COVERAGE,retrievedOn:c.asOfDate,complete:false,officialVerified:catalog.officialVerified,sources:catalog.sources,warnings:catalog.warnings,entries:found.map(date=>({date,status:'pending'}))}}));
   const result=await loadUsableFieldImage(c.parcelGeometry,found,{signal:ctrl.signal,fetcher,catalog,previousSearch,cachedReads:archive,onRead:retainRead,onCheck:retainCheck,onProgress:(day,i,total)=>setProgress('Vérification du champ · '+dateLabel(day)+' · '+i+'/'+total)});
   if(ctrl.signal.aborted||fieldMonitoringScope(latest.current)!==scope)return;
   updateMonitoring(m=>({...m,imagerySearch:{...m.imagerySearch!,complete:true}}));
   if(result.read){if(!focusDates.length)setSelected(result.read.season.startDate);setNotice(result.usableCount+' images exploitables sur '+result.attempts+' dates examinées · '+result.readFailures+' lectures en erreur. '+(catalog.officialVerified?'Calendrier comparé à Copernicus.':'Contrôle Copernicus indisponible : calendrier à revérifier.')+' Enregistrez la campagne pour conserver toutes les dates qualifiées.');}
   else if(result.readFailures)setError(fieldImageFailureMessage(result));else setNotice(fieldImageFailureMessage(result));
  }catch(e){if(!ctrl.signal.aborted)setError((e as Error).message);else setNotice('Vérification interrompue. Les dates déjà qualifiées sont conservées ; relancez pour reprendre.');}finally{if(controller.current===ctrl)controller.current=null;setBusy(false);setProgress('');}
 }
 function selectDate(day:string,side='left'){
  if(side==='left')setSelected(day);else{setSelected(date);setRightDate(day);}
  setCell(null);setZoneId('');setPins(undefined);setPointToMove(null);
  const choice=choices.find(v=>v.date===day);
  if(consent&&choice&&!cachedRead(day,choice.itemId))void acquire(day,side);
 }
 function toggleComparison(){
  if(!compare){
   const before=fieldComparisonBaseline(c,grid,archive,date)?.season.startDate??dates.filter(d=>d<date).at(-1);
   if(before){setSelected(before);setRightDate(date);}
   else setRightDate(dates.find(d=>d>date)??'');
   setLayer('ndvi');setRightLayer('ndvi');
  }else if(second>date)setSelected(second);
  setCompare(!compare);setZoneId('');setPins(undefined);setPointToMove(null);setPanel('maps');
 }
 function changeConsent(value:boolean){
  onConsent(value);
  if(value&&!choices.length&&!manualDate&&!(search?.complete&&search.from===from&&search.to===to))void findDates(true);
  if(value&&leftChoice&&!read)void acquire(date,'left',true);
  else if(value&&compare&&rightChoice&&!right)void acquire(second,'right',true);
 }
 function openVisit(){
  setExpanded(false);
  if(!activeVisit){onVisit({dates:date?[date]:[]});return;}
  const {dates:visitDates,zone,planned,comparison}=activeVisit;
  onVisit({dates:visitDates,zone,planned,comparison});
 }
 function saveCropContext(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(cropId&&sowingDate&&sowingDate<=c.asOfDate)updateMonitoring(m=>({...m,cropContext:{cropId,sowingDate}}));
 }
 function selectZone(id:string){
  setZoneId(id);setPointToMove(null);
  if(id!==savedZone?.id)setPins(undefined);
 }
 function movePoint(point:Position){
  if(!activeVisit||!pointToMove||!pointInField(grid.shape,point))return;
  setPins({...activeVisit,[pointToMove]:point});setPointToMove(null);
 }
 const mapProps={config:c,grid,history,photo,bounds,selected:cell,onSelect:setCell,onHistory,onTerrain:onMap,
  zones:compare?zones:[],selectedZone:zoneId,onSelectZone:selectZone,pins:activeVisit??pins,onPlace:pointToMove?movePoint:undefined};
 return <div className={'field-analysis'+(expanded?' fa-expanded':'')} ref={container} tabIndex={expanded?-1:undefined} role={expanded?'dialog':undefined} aria-modal={expanded?true:undefined} aria-label="Analyse visuelle du champ">
  <div className="fa-topline"><div><span className="product-eyebrow">ÉTAT DU CHAMP</span><h3>{c.name||'Mon champ'}</h3><p>{fmt(grid.areaM2/10000,3)} ha{leftStage&&<> · {leftStage.crop} · {leftStage.name} (stade indicatif)</>}</p></div><div className="fa-top-actions"><button className="btn secondary small" onClick={toggleComparison} aria-pressed={compare}><ProductIcon name="grid" size={16}/>{compare?'Vue simple':'Comparer'}</button><button className="btn secondary small" onClick={()=>setExpanded(v=>!v)}>{expanded?'Fermer le plein écran':'Plein écran'}</button></div></div>
  <nav className="fa-panel-tabs" aria-label="Vues d’analyse"><button aria-pressed={panel==='maps'} onClick={()=>setPanel('maps')}>Cartes du champ</button><button aria-pressed={panel==='evolution'} onClick={()=>setPanel('evolution')}>Évolution et météo</button><button aria-pressed={panel==='report'} onClick={()=>setPanel('report')}>Rapport du champ</button></nav>
  {panel==='maps'&&<>
   {compare&&<section className="fa-comparison-result" aria-label="Variation générale de végétation">
    <h4>Tendance générale du champ</h4>
    <strong>{difference.delta===null?'Variation indisponible':(Math.abs(difference.delta)<.0005?'Stable':difference.delta<0?'Baisse':'Hausse')+' · variation médiane du NDVI '+fmt(difference.delta,3)}</strong>
    <p>{dateLabel(date)} → {dateLabel(second)} · {fmt(difference.coverage*100,1)} % de surface commune · {fmt(difference.areaM2/10000,3)} ha · grille de {difference.gridM} m.</p>
    {difference.delta===null?<p>Il faut deux images distinctes avec au moins {FIELD_CHANGE_RULE.minimumCoverage*100} % du contour et {FIELD_CHANGE_RULE.minimumCells} cellules claires communes.</p>:<p>Médiane des variations de NDVI, pondérée par la surface des cellules claires communes.</p>}
    {consent&&!busy&&leftChoice&&!read&&<button className="qs-text-button" onClick={()=>acquire(date)}>Charger la grille du {dateLabel(date)}</button>}
    {consent&&!busy&&rightChoice&&!right&&second!==date&&<button className="qs-text-button" onClick={()=>acquire(second,'right')}>Charger la grille du {dateLabel(second)}</button>}
   </section>}
   <div className="fa-explorer"><aside className="fa-layers"><span className="fa-section-label">COUCHES DU CHAMP</span>{ANALYSIS_LAYERS.map(l=><button key={l.id} aria-pressed={layer===l.id} onClick={()=>{setLayer(l.id);setCell(null);}}><ProductIcon name={l.icon} size={19}/><span><strong>{l.name}</strong><small>{l.detail}</small></span></button>)}<button className="fa-more-layers" onClick={onLayers}>Autres vues <ProductIcon name="arrow" size={15}/></button><p className="fa-layer-note">{layer==='contrast'?'Le contraste accentue les différences dans cette image.':'La carte aide à choisir les endroits à vérifier sur le terrain.'}</p></aside>
    <div className="fa-map-workspace"><div className="fa-date-toolbar"><div className="fa-date-picker"><button aria-label="Image précédente" disabled={busy||dates.indexOf(date)<=0} onClick={()=>selectDate(dates[dates.indexOf(date)-1])}>‹</button><label><span>Date de l’image</span><select aria-label="Date analysée" value={date} disabled={busy||!dates.length} onChange={e=>selectDate(e.target.value)}>{!dates.length?<option value="">Aucune date chargée</option>:dates.map(d=><option key={d} value={d}>{dateLabel(d)} · {dateOption(d)}</option>)}</select></label><button aria-label="Image suivante" disabled={busy||!date||dates.indexOf(date)>=dates.length-1} onClick={()=>selectDate(dates[dates.indexOf(date)+1])}>›</button></div><div className="fa-map-tools"><button aria-label="Réduire la carte" disabled={zoom<=.5} onClick={()=>setZoom(v=>Math.max(.5,v/1.4))}>−</button><button aria-label="Agrandir la carte" disabled={zoom>=4} onClick={()=>setZoom(v=>Math.min(4,v*1.4))}>+</button><button onClick={()=>setZoom(1)}>Recentrer</button></div></div>
     {compare&&<div className="fa-comparison-controls"><strong>Comparer à</strong><label><span>Date de comparaison</span><select aria-label="Date de comparaison" value={second} disabled={busy||!dates.length} onChange={e=>selectDate(e.target.value,'right')}>{!dates.length?<option value="">Aucune date chargée</option>:dates.map(d=><option key={d} value={d}>{dateLabel(d)} · {dateOption(d)}</option>)}</select></label><label><span>Couche de comparaison</span><select aria-label="Couche de comparaison" value={rightLayer} onChange={e=>setRightLayer(e.target.value as AnalysisLayer)}>{ANALYSIS_LAYERS.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>}
     {!!dates.length&&<div className="fa-timeline" aria-label="Dates des acquisitions">{dates.map(d=><button key={d} disabled={busy} aria-pressed={date===d} onClick={()=>selectDate(d)}><time dateTime={d}>{new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</time><small>{dateOption(d)}</small></button>)}</div>}
     {compare&&activeVisit&&<div className="fa-visit-actions">
      {activeVisit.planned&&<button className="btn secondary small" aria-pressed={pointToMove==='planned'} onClick={()=>setPointToMove(pointToMove==='planned'?null:'planned')}>Déplacer le point prévu</button>}
      {activeVisit.comparison&&<button className="btn secondary small" aria-pressed={pointToMove==='comparison'} onClick={()=>setPointToMove(pointToMove==='comparison'?null:'comparison')}>Déplacer le point de comparaison</button>}
      {pointToMove&&<span role="status">Touchez un nouvel endroit dans le contour.</span>}
     </div>}
     <div className={'fa-maps'+(compare?' fa-split':'')}><FieldAnalysisMap {...mapProps} onLayer={setLayer} onLoad={()=>openLoader(leftChoice?undefined:date)} layer={layer} read={read} date={date} allowed={consent} available={!!leftChoice} itemId={leftChoice?.itemId}/>{compare&&<FieldAnalysisMap {...mapProps} onLayer={setRightLayer} onLoad={()=>openLoader(rightChoice?undefined:second)} layer={rightLayer} read={right} date={second} allowed={consent} available={!!rightChoice} itemId={rightChoice?.itemId}/>}</div>
     <div className="fa-map-footer"><label><input type="checkbox" checked={photo} disabled={!consent} onChange={e=>setPhoto(e.target.checked)}/> Fond photo de repérage</label><span>Carte NDVI : 10 m · statistiques en grille {grid.gridM} m · {choices.length} dates exploitables · {archive.length} grilles en cache</span><button className="qs-text-button" onClick={()=>openLoader()}>Charger des images</button></div>
    </div>
   </div>
   {compare&&difference.delta!==null&&<section className="fa-comparison-result" aria-label="Écarts locaux">
    {!!difference.zones.length&&<>
     <h4>Zones à vérifier</h4>
     <p>Seuil à valider sur le terrain. Variation de NDVI qui s’écarte d’au moins {fmt(FIELD_CHANGE_RULE.residual,2)} de la variation typique du champ, sur {FIELD_CHANGE_RULE.minimumZoneCells} cellules voisines par un côté et au moins {FIELD_CHANGE_RULE.minimumZoneM2} m².</p>
     <ul className="fa-change-zones">
      {difference.zones.map(zone=><li key={zone.id}>
       <button type="button" className="btn secondary small" aria-pressed={zone.id===zoneId} onClick={()=>selectZone(zone.id)}>
        {zone.direction==='lower'?'Variation plus faible':'Variation plus forte'} · {fmt(zone.areaM2,0)} m²
       </button>
       <small>{zone.repeatedOn?'Écart retrouvé avec l’image du '+dateLabel(zone.repeatedOn):'Point à surveiller'} · écart médian au champ {fmt(zone.residual,3)} {difference.delta!==null&&<>· variation NDVI de la zone {fmt(difference.delta+zone.residual,3)}</>}</small>
      </li>)}
     </ul>
     <details><summary>Comment vérifier la répétition ?</summary><p>Une autre image doit être à {FIELD_CHANGE_RULE.persistenceDays} jours au plus de la date la plus récente et au même stade de référence. L’écart doit se retrouver dans le même sens sur au moins la moitié de la zone avec la même surface minimale.</p></details>
     {c.agronomic&&c.agronomic.system!=='single'?<p>Le système cultural déclaré mélange des cultures ou des cycles. Le stade commun aux zones reste indéterminé.</p>:!leftStage||!rightStage?<form className="fa-stage-form" onSubmit={saveCropContext}>
      <p>Indiquez la culture et le semis observé pour vérifier si une autre image est au même stade.</p>
      <label className="field"><span>Culture observée sur le champ</span><select required value={cropId} onChange={e=>setCropId(e.target.value)}>
       <option value="">Choisir la culture</option>{CROPS.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}
      </select></label>
      <label className="field"><span>Date de semis observée</span><input required type="date" max={c.asOfDate} value={sowingDate} onChange={e=>setSowingDate(e.target.value)}/></label>
      <button className="btn secondary small" type="submit">Confirmer culture et semis</button>
     </form>:<p>{!difference.comparableStage?'Les dates correspondent à des stades de référence différents.':difference.persistenceDates===0?'Aucune autre date au même stade et suffisamment claire en cache.':difference.zones.some(zone=>!zone.repeatedOn)?'L’écart des autres zones ne se répète pas sur les dates comparables vérifiées.':leftStage.crop+' · '+leftStage.name+' (stade indicatif).'}</p>}
    </>}
    {!difference.zones.length&&<p>Aucune zone ne dépasse le seuil et la surface minimale.</p>}
   </section>}
   <div className="fa-visit-actions">
    {compare&&(selectedZone||savedZone)&&<button className="btn primary small" onClick={openVisit}>Vérifier sur place</button>}
    <button className="btn secondary small" onClick={()=>{setExpanded(false);onVisit({dates:date?[date]:[]});}}>Faire une visite libre</button>
   </div>
   <div className="fa-stat-row"><article><span>NDVI moyen (grille)</span><strong>{fmt(displayedMean,3)}</strong><small>{date?dateLabel(date):'Observation à charger'}</small></article><article><span>Surface analysable (grille)</span><strong>{fmt(displayedCoverage===null?null:displayedCoverage*100,1)} <em>%</em></strong><small>{fmt(displayedCoverage===null?null:grid.areaM2*displayedCoverage/10000)} ha · {leftChoice?fmt(leftChoice.clearFraction*100,0)+' % de pixels clairs':'Couverture native inconnue'}</small></article><article><span>Variation dans le champ</span><strong>{summary.p10===null?'—':fmt(summary.p10)+' à '+fmt(summary.p90)}</strong><small>NDVI P10–P90 · pondéré par la surface</small></article><article><span>Stabilité historique</span><strong>{history.reads.length>=3?fmt(history.stableFraction*100,0)+' %':'À étudier'}</strong><small>{history.reads.length} saisons retenues</small></article></div>
   {read&&<p className="fa-reading-note"><strong>{fmt(read.scenes[0].clearFraction*100,1)} % de surface exploitable pour le NDVI.</strong>{read.scenes[0].mask&&<> Nuages et cirrus : {fmt(read.scenes[0].mask.cloud*100,1)} % · ombres : {fmt(read.scenes[0].mask.shadow*100,1)} % · eau : {fmt(read.scenes[0].mask.water*100,1)} % · classification incertaine : {fmt(read.scenes[0].mask.uncertain*100,1)} % · sans donnée : {fmt(read.scenes[0].mask.noData*100,1)} %.</>} L’image satellite datée montre aussi les nuages et les ombres ; leur présence ne garantit pas un pixel de sol exploitable. <button className="qs-text-button" onClick={()=>setLayer('classification')}>Voir le masque nuages et ombres</button></p>}
   {showLoader&&<div className="fa-loader" ref={loader}><div><strong>Images et période à consulter</strong><button className="qs-text-button" onClick={()=>setShowLoader(false)}>Masquer</button></div><p>Toutes les acquisitions publiées pendant la période sont recherchées et vérifiées. Seules les images couvrant au moins 20 % du champ sont proposées dans la liste.</p><p>Copernicus, Digital Earth Africa et Earth Search recevront l’emprise du champ ; le fond photo Esri recevra son emprise. Les notes et récoltes ne sont pas envoyées à ces fournisseurs.</p><label className="fa-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>changeConsent(e.target.checked)}/> Autoriser le chargement pour ce champ</label><div className="fa-loader-controls"><label>Du<input type="date" aria-label="Début des images" min="2017-01-01" max={to} value={from} disabled={busy} onInput={e=>setFrom(e.currentTarget.value)} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input type="date" aria-label="Fin des images" min={from} max={c.asOfDate} value={to} disabled={busy} onInput={e=>setTo(e.currentTarget.value)} onChange={e=>setTo(e.target.value)}/></label><button className="btn secondary" disabled={!consent||busy||!canRead||!from||!to||from>to} onClick={()=>findDates()}>Chercher les images exploitables</button><label>Date à charger<input type="date" aria-label="Date à charger" min="2017-01-01" max={c.asOfDate} value={manualDate||date} disabled={busy} onInput={e=>setManualDate(e.currentTarget.value)} onChange={e=>setManualDate(e.target.value)}/></label><button className="btn primary" disabled={!consent||busy||!canRead||!(manualDate||date)} onClick={()=>acquire(manualDate||date)}>Charger la date choisie</button></div>{!canRead&&<p>Actualisez la date d’analyse au jour courant avant de récupérer de nouvelles observations.</p>}{busy&&<p role="status">{progress} <button className="qs-text-button" onClick={()=>controller.current?.abort()}>Annuler</button></p>}</div>}
   {search&&<details className="fa-acquisition-audit"><summary>Vérification des acquisitions · {search.entries.filter(e=>e.status==='usable').length} exploitables / {search.entries.length} dates · {search.complete?'période parcourue':'vérification à reprendre'}</summary><p>{search.officialVerified?'Calendrier officiel Copernicus consulté.':'Calendrier officiel Copernicus non vérifié ; des acquisitions peuvent manquer.'} Les dates écartées ne sont pas chargées dans la carte.</p><table><thead><tr><th>Date</th><th>État</th><th>Pixels NDVI exploitables</th><th>Grille qualifiée</th><th>Détail</th></tr></thead><tbody>{search.entries.map(e=><tr key={e.date}><td>{dateLabel(e.date)}</td><td>{{pending:'À vérifier',usable:'Exploitable',insufficient:'Écartée',error:'Lecture à reprendre',unavailable:'Bandes indisponibles'}[e.status]}</td><td>{e.clearFraction===undefined?'—':fmt(e.clearFraction*100,1)+' %'}</td><td>{e.gridCoverage===undefined?'—':fmt(e.gridCoverage*100,1)+' %'}</td><td>{e.reason??e.itemId??'Vérification en attente'}</td></tr>)}</tbody></table>{search.warnings.length>0&&<p>Sources à revérifier : {search.warnings.join(' ; ')}</p>}</details>}
   <p className="fa-reading-note">{layer==='contrast'?'Le contraste étire les couleurs, même lorsque les écarts sont faibles. ':''}Le NDVI décrit la végétation observée. Vérifiez les différences sur le terrain avant de choisir une intervention.</p>
  </>}
  {panel==='evolution'&&<section className="fa-evolution"><div className="fa-section-heading"><div><h3>Évolution de la campagne</h3><p>Végétation, pluie renseignée et chaleur accumulée.</p></div><button className="btn secondary small" onClick={onWeather}>Prévisions météo</button><button className="btn secondary small" onClick={()=>download(fieldEvolutionCsv(c,from,to,baseC))}>Exporter CSV</button></div><div className="fa-period-controls"><label>Du<input aria-label="Début des courbes" type="date" min={dayAfter(c.asOfDate,-365)} value={from} max={to} onInput={e=>setFrom(e.currentTarget.value)} onChange={e=>setFrom(e.target.value)}/></label><label>Au<input aria-label="Fin des courbes" type="date" value={to} min={from} max={c.asOfDate} onInput={e=>setTo(e.currentTarget.value)} onChange={e=>setTo(e.target.value)}/></label><label>Base thermique (°C)<input aria-label="Base thermique" type="number" min="-20" max="50" step="0.5" placeholder="À renseigner" value={base} onChange={e=>setBase(e.target.value)}/></label></div><div className="fa-chart-grid"><FieldAnalysisChart title="Végétation observée" unit="indice" fixedDomain={[-1,1]} onDate={d=>{setSelected(d);setPanel('maps');}} series={[{label:index.ndviLabel,color:'#246da3',points:points.map(p=>({date:p.date,value:p.ndvi}))},...(points.some(p=>p.evi!==null)?[{label:'EVI médian',color:'#ae7a30',points:points.map(p=>({date:p.date,value:p.evi}))}]:[])]}/><FieldAnalysisChart title="Pluie cumulée renseignée" unit="mm" series={[{label:'Cumul disponible',color:'#398abd',points:weather.points.map(p=>({date:p.date,value:p.rainCumulative}))}]}/><FieldAnalysisChart title="Degrés-jours cumulés" unit="°C·jour" series={[{label:'Base '+fmt(baseC)+' °C',color:'#ba883d',points:weather.points.map(p=>({date:p.date,value:p.gddCumulative}))}]}/></div><div className="fa-chart-context"><p>{index.method}. Les valeurs manquantes et les intervalles de plus de 20 jours restent interrompus sur les courbes.</p><p><strong>Pluie renseignée : {fmt(weather.rainTotal,1)} mm sur {weather.rainDays}/{weather.days} jours.</strong> {weather.rainDays<weather.days?'Cumul partiel : les journées absentes ne sont pas remplacées par zéro.':'Toutes les journées sont renseignées.'} Les prévisions et scénarios sont exclus.</p><p>{baseC===null?'Renseignez une base thermique adaptée à la culture pour afficher les degrés-jours.':'Degrés-jours : max(0, température moyenne − '+fmt(baseC)+' °C), sans plafond thermique ; '+weather.temperatureDays+'/'+weather.days+' jours renseignés. La base est une hypothèse de consultation.'}</p></div></section>}
  {panel==='report'&&<section className="fa-report"><div className="fa-section-heading"><div><span className="product-eyebrow">SYNTHÈSE DES OBSERVATIONS</span><h3>Rapport du champ</h3></div><button className="btn secondary small" onClick={onMap}>Vérifier le contour</button></div><div className="fa-report-grid"><article><span className="fa-section-label">OBSERVATION SATELLITE</span><h4>{read?dateLabel(date):'Image à charger'}</h4><p>{read?fmt(summary.coverage*100,1)+' % du champ analysable · NDVI moyen de grille '+fmt(summary.mean,3):'Chargez une image pour connaître la vigueur et la couverture du champ.'}</p><button className="qs-text-button" onClick={()=>{setPanel('maps');if(!read)openLoader();}}>Examiner la carte →</button></article><article><span className="fa-section-label">HISTORIQUE DU CHAMP</span><h4>{history.reads.length} saisons retenues</h4><p>{history.reads.length>=3?fmt(history.stableFraction*100,1)+' % du contour au classement stable.':'Complétez les saisons pour étudier la persistance des zones.'}</p><button className="qs-text-button" onClick={onHistory}>Examiner les saisons →</button></article><article><span className="fa-section-label">POINTS À VÉRIFIER</span><h4>{summary.p90!==null&&summary.p10!==null&&summary.p90-summary.p10>=.1?'Des différences à explorer':'À confronter au terrain'}</h4><p>Comparez les dates et relevez les levées irrégulières, les zones humides ou les différences de conduite.</p><p>Le relief et la brillance du sol ne sont pas encore raccordés à cette analyse.</p><button className="qs-text-button" onClick={onNotes}>Noter une observation →</button></article></div><div className="fa-report-zones"><h4>Répartition des zones historiques</h4>{history.zones.filter(z=>z.areaM2>0).map(z=><div key={z.id}><span><i style={{background:ZONE_COLORS[z.id]}}/>{z.label}</span><span>{fmt(z.areaM2/10000,3)} ha · {fmt(z.areaM2/grid.areaM2*100,1)} %</span></div>)}</div><details className="fa-sources"><summary>Sources, dates et interprétation</summary><p>{read?.source??'Aucune acquisition datée chargée.'}</p><p>Grille de {grid.gridM} m découpée au contour. Moyennes et quantiles des médianes de cellules, pondérés par leur surface. Chaque cellule retenue comporte au moins 60 % de pixels clairs. La surface analysable diffère de la fraction de pixels clairs.</p><p>Une couleur ne fournit ni un diagnostic de carence, ni une dose optimale, ni une récolte en tonnes.</p><p>Météo : {weather.sources.join(' · ')||'aucune donnée passée disponible'}.</p></details></section>}
  {error&&<p className="notice warning" role="alert">{error}</p>}{notice&&<p className="fa-notice" role="status">{notice}</p>}
 </div>;
}
