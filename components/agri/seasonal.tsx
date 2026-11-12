'use client';
import { HelpParagraph } from './help-dialog';
import './parcel-experience.css';
import SowingWorkspace from './sowing-workspace';
import {seasonalRequest} from '../../lib/seasonal/request';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { COUNTRIES, type SeasonalConfig, type WaterEvent, type WaterPlan, type Campaign, type WaterPeriod } from '../../lib/seasonal/types';
import { planWater, waterPlanCsv } from '../../lib/seasonal/engine';
import { emptyCampaign, exampleCampaign } from '../../lib/seasonal/example';
import { nutrientBalance } from '../../lib/seasonal/agronomy';
import { addDays,validateConfig,validateEvents } from '../../lib/seasonal/validation';
import type { Bootstrap, Science } from '../../lib/contracts';
import { CropReference } from './crop-reference';
import ParcelExplorer, {MapIcon} from './parcel-explorer';
import {parcelMetrics,type ParcelPolygon} from '../../lib/seasonal/parcel';
import {applyCropProfile,cropById,CATALOG_VERSION} from '../../lib/seasonal/catalog';
import QuickSimulation from './quick-simulation';
import {ProductBrand,ProductIcon} from './product-ui';
import {migrateInputs,reconcileInputs,geometryIdentity} from '../../lib/seasonal/provenance';
import {automaticCampaign} from '../../lib/seasonal/automatic';
import {rebaseManagementPlan,rebasePlannedEvents} from '../../lib/seasonal/management';
import { seasonalCapabilities } from '../../lib/seasonal/capabilities';

const fmt = (v: number | null | undefined, digits = 1) => v === null || v === undefined ? 'Indisponible' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(v);
const nullable = (s: string) => s.trim() === '' ? null : Number(s);
const newId = () => { const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''); };
const today = () => new Date().toISOString().slice(0,10);
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function NumberField({ label, value, onChange, min = 0, max, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; hint?: string }) { return <Field label={label} hint={hint}><input type="number" step="any" min={min} max={max} value={value ?? ''} onChange={e => onChange(nullable(e.target.value))}/></Field>; }
async function api(path: string, body?: unknown) { if(body&&path==='/api/seasonal')return seasonalRequest<any>(body); const res = await fetch(path, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}); let data:any;try{data=await res.json();}catch{throw new Error(res.status===401?'Ouvrez votre espace de travail pour continuer.':'Réponse du service indisponible. Votre saisie est conservée.');} if (!res.ok) throw new Error(data.error || 'Action indisponible. Votre saisie est conservée.'); return data; }
function download(name: string, content: string, type: string) { const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
type QueueItem = { campaignId: string; expectedRevision: number; event: WaterEvent };

export default function Seasonal({ workspace, science, campaignsRequest=0, onHome=()=>{}, onMenu=()=>{}, menuOpen=false }: { workspace: Bootstrap | null; science: Science | null; campaignsRequest?:number; onHome?:()=>void; onMenu?:()=>void; menuOpen?:boolean }) {
  const [config,setConfig] = useState<SeasonalConfig>(()=>emptyCampaign());
  const [events,setEvents] = useState<WaterEvent[]>([]);
  const [simulationError,setSimulationError]=useState('');
  const [simulationRetry,setSimulationRetry]=useState(0);
  const [landProgress,setLandProgress]=useState<import('../../lib/seasonal/request').LandProgress|null>(null);
  const [lastPlan,setPlan] = useState<WaterPlan|null>(null);
  const [draftId,setDraftId]=useState(newId);
  const [active,setActive] = useState<{ id:string; revision:number }|null>(null);
  const [list,setList] = useState<{id:string;name:string;country:keyof typeof COUNTRIES;crop:string;revision:number}[]>([]);
  const [history,setHistory] = useState<{revision:number;reason:string;created_at:string}[]>([]);
  const [tab,setTab] = useState('simulation');
  const previousTab=useRef(tab);
  const handledCampaignsRequest=useRef(0);
  const [startAtYield,setStartAtYield]=useState(false);
  const [libraryOpen,setLibraryOpen]=useState(false);
  useEffect(()=>{if(campaignsRequest>handledCampaignsRequest.current){handledCampaignsRequest.current=campaignsRequest;setLibraryOpen(true);setTab('simulation');}},[campaignsRequest]);
  const isMapping=tab==='carte';
  useEffect(()=>{if(previousTab.current!==tab){if(tab==='carte')document.getElementById('seasonal-panel-carte')?.focus();else if(previousTab.current==='carte'&&tab==='simulation'&&!startAtYield)document.getElementById('field-tab-overview')?.focus();previousTab.current=tab;}},[tab,startAtYield]);
  const [error,setError] = useState(''), [notice,setNotice] = useState(''), [busy,setBusy]=useState(false), [dirty,setDirty]=useState(true);
  const [planPending,setPlanStale]=useState(true);
  const [resultInputKey,setResultInputKey]=useState('');
  const simulationSequence=useRef(0);
  const simulationDebounce=useRef(350);
  const [parcelDraft,setParcelDraft]=useState(false);
  const [period,setPeriod]=useState('weeks'), [allDays,setAllDays]=useState(false);
  const [weatherText,setWeatherText]=useState('');
  const [event,setEvent]=useState<WaterEvent>(()=>({id:newId(),date:today(),kind:'rain',amount:0,unit:'mm',point:'field',status:'measured',source:'',recordedAt:new Date().toISOString()}));
  const [queue,setQueue]=useState<QueueItem[]>([]);

  const scope = workspace ? `${workspace.session.coopId}:${workspace.session.userId}` : 'visitor';
  const [loadedScope,setLoadedScope]=useState(scope);
  // Bind every visible result to the complete input snapshot, even before effects run.
  const inputKey=JSON.stringify([scope,config,events]);
  const planStale=planPending||resultInputKey!==inputKey||parcelDraft||!!simulationError;
  const plan=planStale?null:lastPlan;
  const queueKey = `agri-water-queue:${scope}`;
  const draftKey = `agri-water-draft:${scope}`;
  const [keepDraft,setKeepDraft]=useState(false);
  const [nutrients,setNutrients]=useState({source:'',target:['','',''],already:['','',''],name:'',dose:'',composition:['','','']});
  const [nutrientResult,setNutrientResult]=useState<ReturnType<typeof nutrientBalance>|null>(null);
  const capabilities = seasonalCapabilities(config.country, config.cropProfile?.id);
  const terrainIdentity=JSON.stringify(config.parcelGeometry??null);
  const terrainKey=JSON.stringify([scope,simulationRetry,terrainIdentity]);
  const preparedTerrain=useRef('');
  useEffect(()=>{
    if(loadedScope!==scope||!config.parcelGeometry||parcelDraft)return;
    preparedTerrain.current='';setSimulationError('');setPlanStale(true);
    const geometry=config.parcelGeometry,controller=new AbortController();let alive=true;
    seasonalRequest<{assessment:NonNullable<SeasonalConfig['landAssessment']>}>({action:'land',geometry,refresh:simulationRetry>0},controller.signal,90_000,fetch,{onLandProgress:p=>{if(alive)setLandProgress(p);}})
      .then(r=>{if(alive&&r.assessment){preparedTerrain.current=terrainKey;setConfig(old=>JSON.stringify(old.parcelGeometry)===JSON.stringify(geometry)?{...old,landAssessment:r.assessment}:old);}})
      .catch(e=>{if(alive&&e.name!=='AbortError'){setSimulationError(e.message);setPlanStale(true);}});
    return()=>{alive=false;preparedTerrain.current='';controller.abort();};
  },[terrainIdentity,parcelDraft,simulationRetry,scope,loadedScope]);
  useEffect(()=>{
    if(loadedScope!==scope||!config.parcelGeometry||parcelDraft||!config.stages.length){setPlan(null);setPlanStale(false);setSimulationError('');return;}
    if(isMapping){setPlanStale(true);return;}
    // The terrain effect prepares authoritative evidence first. Starting both
    // operations together doubled the initial raster work, and the terrain
    // response then cancelled and restarted the still-running simulation.
    if(preparedTerrain.current!==terrainKey||!config.landAssessment||geometryIdentity(config.landAssessment.geometry)!==geometryIdentity(config.parcelGeometry)){
      setPlan(null);setPlanStale(true);return;
    }
    setPlanStale(true);setSimulationError('');
    const controller=new AbortController();let alive=true;const requestId=String(++simulationSequence.current);
    const timer=setTimeout(async()=>{try{
      // Editing can temporarily leave a required field empty. Explain that
      // locally instead of sending a known-invalid automatic request (400).
      const checked=validateConfig(config);validateEvents(events,checked);
      const result=await seasonalRequest<{plan:WaterPlan;requestId:string}>({action:'simulate',config,events,requestId},controller.signal,90_000,fetch,{onLandProgress:p=>{if(alive)setLandProgress(p);}});
      if(result.requestId!==requestId||!result.plan)throw new Error('Réponse de calcul incomplète. Relancez le calcul ; vos saisies sont conservées.');
      if(alive&&requestId===String(simulationSequence.current)){setPlan(result.plan);setResultInputKey(inputKey);setPlanStale(false);setSimulationError('');}
    }catch(e){if(alive&&requestId===String(simulationSequence.current)){setPlanStale(true);setSimulationError((e as Error).message);}}},simulationDebounce.current);
    return()=>{alive=false;clearTimeout(timer);controller.abort();};
  },[config,events,parcelDraft,simulationRetry,scope,loadedScope,isMapping]);

  useEffect(()=>{
    simulationSequence.current++;setLandProgress(null);setLoadedScope(scope);setDraftId(newId());setActive(null);setEvents([]);setPlan(null);setNutrientResult(null);setConfig(emptyCampaign());setDirty(true);setHistory([]);setKeepDraft(false);setList([]);setError('');setNotice('');
    try { setQueue(JSON.parse(localStorage.getItem(queueKey)||'[]')); } catch { setQueue([]); }
    if(workspace) api('/api/seasonal').then(r=>setList(r.campaigns)).catch(e=>setError(e.message));
  },[scope]); // changing account never exposes the previous account's draft
  useEffect(()=>{ if(keepDraft&&loadedScope===scope) { try { localStorage.setItem(draftKey,JSON.stringify({config,events,active})); } catch { setError('Brouillon non conservé : stockage de cet appareil indisponible. Exportez votre campagne.'); } } },[config,events,active,keepDraft,draftKey,loadedScope,scope]);
  function edit(next: SeasonalConfig) { const updated=next.inputs&&next.inputs!==config.inputs?migrateInputs(next):reconcileInputs(config,next);const withoutIrrigation=(c:SeasonalConfig)=>JSON.stringify({...c,managementPlan:c.managementPlan?{...c.managementPlan,irrigation:null}:c.managementPlan});const irrigationOnly=JSON.stringify(config.managementPlan?.irrigation)!==JSON.stringify(updated.managementPlan?.irrigation)&&withoutIrrigation(config)===withoutIrrigation(updated);simulationDebounce.current=irrigationOnly?1000:350;simulationSequence.current++;setNutrientResult(null);setConfig(updated);setDirty(true);setPlanStale(true); }
  function change<K extends keyof SeasonalConfig>(key:K,value:SeasonalConfig[K]) {
    if(key==='crop'){edit({...config,crop:String(value),cropProfile:undefined,nutritionReference:undefined,stages:[],parameterSource:''});return;}
    if(key==='sowingDate'){
      const nextSowingDate=String(value),deltaDays=Math.round((Date.parse(nextSowingDate)-Date.parse(config.sowingDate))/86400000);
      if(!Number.isFinite(deltaDays)){setError('Date de semis invalide.');return;}
      if(config.managementPlan?.products.some(p=>p.status==='declared')){
        setError('Cette campagne contient des apports réalisés liés au cycle actuel. Créez une nouvelle campagne pour modifier la date du semis.');
        return;
      }
      const cycleDays=config.stages.reduce((n,s)=>n+s.days,0),nextEnd=addDays(nextSowingDate,Math.max(0,cycleDays-1));
      const recordedOutside=events.some(e=>['measured','declared'].includes(e.status)&&(e.date<nextSowingDate||e.date>nextEnd));
      if(recordedOutside){
        setError('La nouvelle date placerait un apport réalisé hors du cycle. Conservez la date actuelle ou créez une nouvelle campagne.');
        return;
      }
      setError('');
      if(deltaDays!==0){
        const previous=config.managementPlan;
        const managementPlan=rebaseManagementPlan(previous,deltaDays);
        setEvents(current=>rebasePlannedEvents(current,deltaDays));
        const shifted=(previous?.irrigation.applications.length??0)+(previous?.products.filter(p=>p.status==='planned').length??0)+events.filter(e=>e.status==='planned'||e.status==='cancelled').length;
        if(shifted)setNotice(`Date de semis modifiée : ${shifted} élément(s) du calendrier décalé(s) de ${Math.abs(deltaDays)} jour(s). Vérifiez le calendrier avant de l’utiliser.`);
        edit({...config,sowingDate:nextSowingDate,...(managementPlan?{managementPlan}:{})});
        return;
      }
    }
    edit({...config,[key]:value,...(['country','territory','variety','systemDomain'].includes(key)?{nutritionReference:undefined}:{}),...(key==='stages'&&config.cropProfile?{cropProfile:{...config.cropProfile,mode:'custom' as const}}:{})});
  }
  function sys<K extends keyof SeasonalConfig['system']>(key:K,value:SeasonalConfig['system'][K]) { edit({...config,system:{...config.system,[key]:value}}); }
  function adopt(c:Campaign) { setLandProgress(null);setNutrientResult(null); setActive({id:c.id,revision:c.revision});setConfig(migrateInputs(c.config));setEvents(c.events);setPlan(null);setDirty(false);setPlanStale(true); }
  async function open(id:string) { if(dirty&&config.parcelGeometry&&active?.id!==id&&!window.confirm('Ouvrir cette campagne remplacera les modifications non enregistrées. Continuer ?'))return;setLibraryOpen(false);setStartAtYield(false);setTab('simulation');setBusy(true);setError('');try {const r=await api('/api/seasonal?id='+encodeURIComponent(id));adopt(r.campaign);setHistory(r.history);setNotice('Campagne chargée.');}catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  function compute() { setError('');if(parcelDraft){setError('Confirmez le contour de la parcelle avant de simuler.');setTab('carte');return;}setTab('plan');edit({...config}); }
  async function save() {if(parcelDraft){setError('Confirmez le contour de la parcelle avant de l’enregistrer.');setTab('carte');return;}setBusy(true);setError('');try {const id=active?.id||draftId;const r=await api('/api/seasonal',{action:'save',id,expectedRevision:active?.revision||0,config,events:active?undefined:events});adopt(r.campaign);setHistory([]);setNotice('Campagne et plan enregistrés. Les révisions antérieures sont conservées.');setList((await api('/api/seasonal')).campaigns);}catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  function persistQueue(next: QueueItem[]) { localStorage.setItem(queueKey,JSON.stringify(next));setQueue(next); }
  async function recordEvent(e:WaterEvent) {
    setError('');
    if(!active) {setError('Enregistrez d’abord la campagne pour conserver les observations et leurs corrections.');return;}
    if(dirty) {setError('Enregistrez les paramètres modifiés avant une observation.');return;}
    const item={campaignId:active.id,expectedRevision:active.revision,event:e};
    if(!navigator.onLine) {try {persistQueue([...queue.filter(q=>q.event.id!==e.id),item]);setNotice('Saisie conservée sur cet appareil. Utilisez « Synchroniser » après reconnexion.');}catch{setError('Stockage local indisponible : exportez votre saisie avant de fermer.');}return;}
    setBusy(true);try {const r=await api('/api/seasonal',{action:'event',id:active.id,expectedRevision:active.revision,event:e});adopt(r.campaign);setHistory([]);setNotice(r.unchanged?'Cette observation était déjà enregistrée.':'Observation enregistrée. Le bilan et les prochaines interventions sont recalculés.');setEvent({...e,id:newId(),source:'',amount:0});}catch(err){setError((err as Error).message);}finally{setBusy(false);}
  }
  async function synchronize() {
    setBusy(true);setError('');let pending=[...queue];
    try {
      const revisions=new Map<string,number>();
      for(const q of queue) {
        const expected=revisions.get(q.campaignId)??q.expectedRevision;
        const r=await api('/api/seasonal',{action:'event',id:q.campaignId,expectedRevision:expected,event:q.event});
        revisions.set(q.campaignId,r.campaign.revision);
        if(active?.id===q.campaignId)adopt(r.campaign);
        pending=pending.filter(p=>p.event.id!==q.event.id);persistQueue(pending);
      }
      setNotice('Observations synchronisées et calendriers recalculés.');
    }catch(e){setError((e as Error).message+' Les saisies restantes sont conservées sur cet appareil ; rechargez et examinez les conflits avant de les reprendre.');}finally{setBusy(false);}
  }
  function newCampaign() {setDraftId(newId());setActive(null);setConfig(emptyCampaign());setEvents([]);setPlan(null);setHistory([]);setDirty(true);setStartAtYield(false);setTab('carte');}
  function loadExample() {setDraftId(newId());setActive(null);setConfig(exampleCampaign());setEvents([]);setPlan(null);setHistory([]);setDirty(true);setStartAtYield(false);setTab('carte');setNotice('Exemple synthétique chargé. Remplacez les hypothèses avant un usage sur votre champ.');}
  function restoreDraft() {try{const d=JSON.parse(localStorage.getItem(draftKey)||'null');if(!d)throw new Error('Aucun brouillon enregistré sur cet appareil.');setConfig(migrateInputs(d.config));setEvents(d.events);setActive(d.active);setPlan(null);setDirty(true);setNotice('Brouillon restauré : recalculez puis vérifiez la révision avant enregistrement.');}catch(e){setError((e as Error).message);}}
  function importWeather() {try {
    const rows=weatherText.trim().split(/\r?\n/).filter(Boolean).map((l,i)=>{
      const p=l.split(';').map(s=>s.trim());if(p.length!==5)throw new Error(`Ligne ${i+1} : date;pluie_mm;et0_mm;statut;source attendus.`);
      return {date:p[0],rainMm:nullable(p[1]),et0Mm:nullable(p[2]),status:p[3] as 'observed'|'forecast'|'scenario',source:p[4],availableAt:config.asOfDate+'T00:00:00Z'};
    });
    const merged=new Map(config.weather.map(w=>[w.date,w]));rows.forEach(w=>merged.set(w.date,w));
    const next={...config,weather:[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date))};
    planWater(next,events);edit(next);setNotice('Météo ajoutée ; une ligne remplace la source précédente de la même date. Recalculez le plan.');
  }catch(e){setError((e as Error).message);} }
  async function fetchWeather() {setBusy(true);setError('');try {
    const r=await api('/api/seasonal',{action:'weather',latitude:config.latitude,longitude:config.longitude,country:config.country});
    const end=addDays(config.sowingDate,config.stages.reduce((s,x)=>s+x.days,0)-1);
    const merged=new Map(config.weather.map(w=>[w.date,w]));
    for(const w of r.weather)if(w.date>=config.sowingDate&&w.date<=end&&merged.get(w.date)?.status!=='observed')merged.set(w.date,w);
    edit({...config,asOfDate:today(),weather:[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date))});setNotice(r.attribution+' Recalculez le plan.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  function defineParcel(shape:ParcelPolygon|null,country:SeasonalConfig['country']) {
    const metrics=shape?parcelMetrics(shape):null;
    const changed=geometryIdentity(config.parcelGeometry)!==geometryIdentity(shape);
    if(changed){
      setLandProgress(null);setEvents([]);
      if(active){setDraftId(newId());setActive(null);setHistory([]);setNotice('Nouveau contour : une nouvelle campagne est préparée. Les observations de l’ancienne parcelle restent dans sa campagne.');}
    }
    const next={...config,...(changed?{agronomic:undefined,yieldEstimation:undefined,fieldTrials:undefined,salinity:undefined}:{}),country,parcelGeometry:shape??undefined,areaM2:metrics?.areaM2??null,longitude:metrics?.point[0]??null,latitude:metrics?.point[1]??null,weather:[],soil:emptyCampaign().soil,soilAnalyses:[],inputs:emptyCampaign().inputs,landAssessment:undefined,inputPolicy:{allowAssumptions:false,allowStale:false},nutritionReference:undefined,sowingPlan:undefined,managementPlan:undefined};
    edit(shape?automaticCampaign(next):next);
    if(shape)setParcelDraft(false);
  }
  function prepareParcel(cropId:string,date:string) {
    try{edit(automaticCampaign(config,cropId,date));setStartAtYield(true);setTab('simulation');setError('');}catch(e){setError((e as Error).message);}
  }
  function exploreScenario(cropId:string,date:string) {
    setError('');try{
      if(!config.parcelGeometry)throw new Error('Confirmez la parcelle avant de simuler.');
      const base=exampleCampaign(today());
      const scenario=applyCropProfile({...base,waterCondition:config.waterCondition,country:config.country,parcelGeometry:config.parcelGeometry,name:config.name.trim()||'Mon champ — scénario',territory:config.territory.trim()||'Localité à confirmer',sowingDate:date,areaM2:config.areaM2,latitude:config.latitude,longitude:config.longitude,system:{...base.system,name:'Installation hypothétique du scénario',source:'Efficacité 75 %, transport sans perte ; débit et disponibilité non mesurés',sourceFlowM3h:null,hoursPerDay:null,sourceBudgetM3:null}},cropId);
      const result=planWater(scenario,[]);setConfig(scenario);setPlan(result);setEvents([]);if(active)setDraftId(newId());setActive(null);setHistory([]);setDirty(true);setPlanStale(true);setNotice('Scénario exploratoire créé sur votre contour. Le sol et la météo utilisés sont des exemples, pas des mesures de votre champ.');
    }catch(e){setError((e as Error).message);}
  }
  function startNew(){
    if(dirty&&config.parcelGeometry&&!window.confirm('Créer une simulation remplacera le brouillon non enregistré. Continuer ?'))return;
    setConfig(emptyCampaign());setEvents([]);setPlan(null);setActive(null);setDraftId(newId());setDirty(true);setHistory([]);setSimulationError('');setLibraryOpen(false);setStartAtYield(false);setTab('carte');
  }
  const advancedLabels:Record<string,string>={parcelle:'Culture et cycle',sol:'Sol et irrigation',meteo:'Météo',plan:'Calendrier',suivi:'Carnet d’eau',conseils:'Dates de semis',fichiers:'Fichiers'};
  const groups = plan ? plan[period as 'weeks'|'decades'|'stages'] : [];
  const forecasts = config.country === 'TGO' ? science?.forecasts.filter(f=>f.territory===config.territory&&f.crop===({Maïs:'Maize',Riz:'Rice',Mil:'Millet',Sorgho:'Sorghum'} as Record<string,string>)[config.crop]&&f.year===new Date(config.sowingDate).getUTCFullYear()) ?? [] : [];
  const duration=config.stages.reduce((s,x)=>s+x.days,0);

  if(loadedScope!==scope)return <div className="card" role="status">Chargement de votre espace de campagne…</div>;
  return <div className="seasonal-tool is-campaign-workspace">
    <header className="farmer-app-bar no-print"><ProductBrand onClick={onHome}/><div className="farmer-app-location"><span>MA CAMPAGNE</span><strong>{libraryOpen?'Mes campagnes':config.parcelGeometry?config.name||'Mon champ':tab==='carte'?'Choisir mon champ':'Nouvelle campagne'}</strong></div><button className="farmer-header-menu" aria-label="Ouvrir les autres outils" aria-expanded={menuOpen} onClick={onMenu}><ProductIcon name="menu" size={19}/><span>Autres outils</span></button><button className="farmer-header-campaigns" onClick={()=>{setLibraryOpen(!libraryOpen);setTab('simulation');}} aria-expanded={libraryOpen}><ProductIcon name="file" size={18}/><span>Mes campagnes</span>{list.length>0&&<b>{list.length}</b>}</button>{config.parcelGeometry&&workspace&&<button className="farmer-header-save" disabled={busy||parcelDraft} onClick={save}><ProductIcon name="save" size={18}/><span>{busy?'Enregistrement…':'Enregistrer'}</span></button>}<button className="farmer-header-new" onClick={startNew}><ProductIcon name="plus" size={18}/><span>Nouveau champ</span></button></header>
    {tab!=='simulation'&&<button className="simulation-back" onClick={()=>{setLibraryOpen(false);setTab('simulation');}}><ProductIcon name="back" size={16}/> Revenir à la simulation</button>}
    {libraryOpen&&<section className="simulation-library" id="simulation-library" aria-label="Simulations enregistrées">{list.length?<div className="campaign-grid">{list.map(c=><button className="campaign-card" key={c.id} onClick={()=>open(c.id)}><span><ProductIcon name="leaf"/><small>{COUNTRIES[c.country]?.name}</small></span><strong>{c.name}</strong><HelpParagraph>{c.crop} · révision {c.revision}</HelpParagraph><em>Reprendre la simulation <ProductIcon name="arrow" size={16}/></em></button>)}</div>:<div className="library-empty"><ProductIcon name="file" size={30}/><h2>Vos campagnes apparaîtront ici.</h2><HelpParagraph>Créez votre première simulation, puis enregistrez-la dans votre espace.</HelpParagraph><button className="btn primary" onClick={startNew}>Créer une simulation <ProductIcon name="plus" size={16}/></button></div>}<div className="library-tools"><button className="qs-text-button" onClick={restoreDraft}>Restaurer mon brouillon local</button><button className="qs-text-button" onClick={()=>{setLibraryOpen(false);setTab('fichiers');}}>Importer une campagne →</button></div></section>}
    <div hidden={tab!=='simulation'||libraryOpen}>{loadedScope===scope&&<QuickSimulation key={scope+':'+(active?.id??draftId)} config={config} plan={plan} stale={planStale} initialSection={startAtYield?'yield':undefined} landProgress={landProgress?.assessment?.scopeId===config.inputs?.scope.id||landProgress?.status!=='complete'?landProgress:null} calculationError={simulationError} onRetry={()=>setSimulationRetry(n=>n+1)} onChange={edit} onMap={()=>{setStartAtYield(false);setTab('carte');}} onAdvanced={setTab} onSave={save} canSave={!!workspace&&!busy} events={events} paused={isMapping}/>}</div>
    {tab!=='simulation'&&simulationError&&<div className="notice warning" role="alert"><strong>{tab==='carte'?'Analyse du terrain indisponible.':'Calcul interrompu.'}</strong> {simulationError}{plan&&planStale&&<> Le dernier calcul réussi est conservé, mais correspond aux paramètres précédents.</>} <button className="btn secondary small" onClick={()=>setSimulationRetry(n=>n+1)}>Relancer le calcul</button></div>}
    {error&&<div className="notice warning" role="alert">{error}</div>}
    {notice&&<div className="notice info" role="status">{notice}</div>}
    {queue.length>0&&<div className="notice warning no-print"><div><strong>{queue.length} saisie(s) en attente sur cet appareil</strong><HelpParagraph>Les conflits de révision interrompent la synchronisation pour préserver les corrections faites ailleurs.</HelpParagraph><button className="btn secondary" disabled={busy} onClick={synchronize}>Synchroniser</button>{active&&queue.some(q=>q.campaignId===active.id&&q.expectedRevision!==active.revision)&&<button className="btn secondary" onClick={()=>{persistQueue(queue.map(q=>q.campaignId===active.id?{...q,expectedRevision:active.revision}:q));setNotice('Saisies en attente reprises sur la révision affichée. Vérifiez leurs quantités avant de synchroniser.');}}>Reprendre les saisies sur cette révision après examen</button>}<button className="btn secondary" onClick={()=>download('observations-en-attente.json',JSON.stringify(queue,null,2),'application/json')}>Exporter les saisies en attente</button></div></div>}
    {!libraryOpen&&tab==='simulation'&&!config.parcelGeometry&&list.length>0&&<section className="recent-campaigns"><div className="overview-card-header"><h3>Ou reprendre une campagne</h3><button onClick={()=>setLibraryOpen(true)}>Tout voir <ProductIcon name="arrow" size={15}/></button></div><div className="campaign-grid">{list.slice(0,3).map(c=><button className="campaign-card" key={c.id} onClick={()=>open(c.id)}><span><ProductIcon name="leaf"/><small>{COUNTRIES[c.country]?.name}</small></span><strong>{c.name}</strong><HelpParagraph>{c.crop}</HelpParagraph><em>Reprendre <ProductIcon name="arrow" size={16}/></em></button>)}</div></section>}
    {tab!=='simulation'&&tab!=='carte'&&<div className="qs-secondary-nav no-print" role="tablist" aria-label="Réglages et suivi">{Object.entries(advancedLabels).map(([id,label])=><button key={id} id={'seasonal-tab-'+id} role="tab" aria-selected={tab===id} aria-controls={'seasonal-panel-'+id} onClick={()=>setTab(id)}>{label}</button>)}</div>}
    <div hidden={tab!=='carte'} role="tabpanel" id="seasonal-panel-carte" aria-label="Mon champ sur la carte" tabIndex={-1}><ParcelExplorer key={'map-'+(active?.id??draftId)} config={config} plan={planStale?null:plan} locked={events.some(e=>['measured','declared'].includes(e.status))} canSearch={!!workspace} simple onParcel={defineParcel} onPrepare={prepareParcel} onScenario={exploreScenario} onCalendar={()=>setTab('simulation')} onName={name=>change('name',name)} onDirty={setParcelDraft} onLandSelection={value=>change('landSelection',value)} onWaterCondition={value=>change('waterCondition',value)}/></div>
    {tab!=='simulation'&&tab!=='carte'&&config.parcelGeometry&&<div className="field-parcel-summary"><span><MapIcon name="draw"/>{config.name||'Mon champ'} <b>{fmt(config.areaM2! /10000,3)} ha</b> · {COUNTRIES[config.country].name}</span><button onClick={()=>setTab('carte')}>Revoir ma parcelle <MapIcon name="arrow" size={15}/></button></div>}

    {tab==='parcelle'&&<><CropReference mode="crop" config={config} onChange={edit}/><section className="card" role="tabpanel" id="seasonal-panel-parcelle" aria-labelledby="seasonal-tab-parcelle"><h2>Identifier la parcelle et le cycle</h2><div className="form-grid">
      <Field label="Nom de la parcelle"><input value={config.name} maxLength={120} onChange={e=>change('name',e.target.value)}/></Field>
      <Field label="Pays"><select value={config.country} onChange={e=>change('country',e.target.value as SeasonalConfig['country'])}>{Object.entries(COUNTRIES).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</select></Field>
      <Field label="Commune / préfecture / localité"><input value={config.territory} onChange={e=>change('territory',e.target.value)}/></Field>
      <Field label="Culture"><input value={config.crop} readOnly={!!config.cropProfile} onChange={e=>change('crop',e.target.value)}/></Field>
      <Field label="Variété"><input value={config.variety} onChange={e=>change('variety',e.target.value)}/></Field>
      {config.parcelGeometry?<Field label="Surface du contour (m²)"><input readOnly value={fmt(config.areaM2,2)}/><small>Le calcul couvre tout le contour dessiné. Pour un secteur arrosé séparément, dessinez ce secteur dans une autre campagne.</small></Field>:<NumberField label="Surface effectivement arrosée (m²)" value={config.areaM2} onChange={v=>change('areaM2',v)} hint="Dessinez votre champ sur la carte pour calculer sa surface automatiquement."/>}
      <Field label="Date du semis"><input type="date" value={config.sowingDate} onChange={e=>change('sowingDate',e.target.value)}/></Field>
      <Field label="Date du conseil"><input type="date" value={config.asOfDate} onChange={e=>change('asOfDate',e.target.value)}/></Field>
      {config.parcelGeometry?<><Field label="Latitude de la parcelle"><input readOnly value={fmt(config.latitude,6)}/></Field><Field label="Longitude de la parcelle"><input readOnly value={fmt(config.longitude,6)}/><small>Point représentatif calculé depuis le contour. Modifiez ses sommets dans « Mon champ ».</small></Field></>:<><NumberField label="Latitude (facultative)" value={config.latitude} min={-90} max={90} onChange={v=>change('latitude',v)}/><NumberField label="Longitude (facultative)" value={config.longitude} min={-180} max={180} onChange={v=>change('longitude',v)}/></>}
      <Field label="État actuel du champ face à l’excès d’eau"><select value={config.waterCondition??'unknown'} onChange={e=>change('waterCondition',e.target.value as SeasonalConfig['waterCondition'])}><option value="unknown">Non vérifié</option><option value="drained">Pas d’eau stagnante observée</option><option value="waterlogged">Sol engorgé / eau stagnante</option><option value="submerged">Plantes submergées</option></select><small>Engorgement ou submersion : le calendrier est bloqué. Le moteur ne calcule ni la survie ni la baisse de rendement.</small></Field>
      <Field label="Système cultural"><select value={config.systemDomain} onChange={e=>change('systemDomain',e.target.value as SeasonalConfig['systemDomain'])}><option value="upland">Sol non submergé, nappe profonde</option><option value="flooded_rice">Rizière submergée — module spécifique requis</option><option value="shallow_water_table">Nappe proche — module spécifique requis</option></select></Field>
    </div><details><summary>Données et conseils disponibles pour {capabilities.countryName}</summary><HelpParagraph>{capabilities.historicalData.observations === null ? capabilities.historicalData.note : `${fmt(capabilities.historicalData.observations,0)} observations territoriales retenues dans les archives auditées, toutes cultures retenues confondues ; dernière année ${capabilities.historicalData.lastYear}. ${capabilities.historicalData.note}`}</HelpParagraph><HelpParagraph>{capabilities.nutritionReferences.count} référence(s) de fertilisation à examiner dans le domaine choisi. {capabilities.nutritionReferences.reason}</HelpParagraph><HelpParagraph>La prévision saisonnière de rendement et la dose d’engrais personnalisée nécessitent encore des données et une validation locale. Les informations historiques ne mesurent pas le rendement de votre parcelle.</HelpParagraph></details><HelpParagraph className="notice info">Choisissez la fiche de votre culture puis appliquez ses hypothèses, ou renseignez des paramètres locaux sourcés. Toute modification de culture exige ses propres paramètres.</HelpParagraph>
    <details><summary>Paramètres culturaux avancés : stades, coefficients et enracinement</summary><HelpParagraph>{duration} jours jusqu’à la récolte estimée. Adaptez les durées à la variété et aux stades observés. Racines en mètres ; coefficients sans unité.</HelpParagraph>
    <div className="table-wrap"><table className="data-table seasonal-input-table"><thead><tr>{['Stade','Jours','Kc début','Kc fin','Racines début (m)','Racines fin (m)','Fraction avant stress','Action'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{config.stages.map((s,i)=><tr key={i}><td><input aria-label={`Nom du stade ${i+1}`} value={s.name} onChange={e=>change('stages',config.stages.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/></td>{(['days','kcStart','kcEnd','rootStartM','rootEndM','depletionFraction'] as const).map(k=><td key={k}><input aria-label={`${s.name} ${k}`} type="number" step="any" value={s[k]} onChange={e=>change('stages',config.stages.map((x,j)=>i===j?{...x,[k]:e.target.value===''?NaN:Number(e.target.value)}:x))}/></td>)}<td><button className="btn secondary small" disabled={config.stages.length===1} onClick={()=>change('stages',config.stages.filter((_,j)=>i!==j))}>Retirer</button></td></tr>)}</tbody></table></div>
    <div className="form-actions"><button className="btn secondary" disabled={config.stages.length>=16} onClick={()=>change('stages',[...config.stages,{...(config.stages.at(-1)??{kcStart:0,kcEnd:0,rootEndM:.1,depletionFraction:.5}),name:'Stade à renseigner',days:10,rootStartM:config.stages.at(-1)?.rootEndM??.1}])}>Ajouter un stade</button></div>
    <label className="seasonal-check"><input type="checkbox" checked={config.adjustDepletionToEtc??false} onChange={e=>change('adjustDepletionToEtc',e.target.checked)}/>Ajuster le seuil p à ETc selon FAO56 (équation 83).</label><Field label="Source et statut des paramètres culturaux"><textarea value={config.parameterSource} onChange={e=>change('parameterSource',e.target.value)}/></Field></details>
    </section></>}

    {tab==='sol'&&<><CropReference mode="chemistry" config={config} onChange={edit}/><section className="card" role="tabpanel" id="seasonal-panel-sol" aria-labelledby="seasonal-tab-sol"><h2>Le sol et sa réserve d’eau</h2><HelpParagraph>Les teneurs en eau sont volumiques : 0,30 signifie 30 %. Une estimation de texture ne remplace pas une analyse. L’humidité initiale est indispensable, ou doit être choisie explicitement comme hypothèse.</HelpParagraph>
    <div className="table-wrap"><table className="data-table seasonal-input-table"><thead><tr>{['Horizon','Épaisseur (m)','Capacité au champ','Point de flétrissement','Humidité initiale','Action'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{config.soil.layers.map((l,i)=><tr key={i}><td>{i+1}</td>{(['thicknessM','thetaFC','thetaWP','initialTheta'] as const).map(k=><td key={k}><input type="number" step="any" aria-label={`Horizon ${i+1} ${k}`} value={l[k]??''} onChange={e=>change('soil',{...config.soil,layers:config.soil.layers.map((x,j)=>j===i?{...x,[k]:nullable(e.target.value)}:x)})}/></td>)}<td><button className="btn secondary small" disabled={config.soil.layers.length===1} onClick={()=>change('soil',{...config.soil,layers:config.soil.layers.filter((_,j)=>j!==i)})}>Retirer</button></td></tr>)}</tbody></table></div>
    <div className="form-actions"><button className="btn secondary" disabled={config.soil.layers.length>=12} onClick={()=>change('soil',{...config.soil,layers:[...config.soil.layers,{thicknessM:.3,thetaFC:.3,thetaWP:.15,initialTheta:null}]})}>Ajouter un horizon hypothétique</button></div>
    <div className="form-grid"><NumberField label="Infiltration maximale par jour (mm/j)" value={config.soil.infiltrationMmDay} onChange={v=>change('soil',{...config.soil,infiltrationMmDay:v})} hint="Ce plafond journalier ne décrit pas l’intensité horaire d’une pluie ni le débit d’un asperseur."/><Field label="Origine du profil et date de mesure"><textarea value={config.soil.source} onChange={e=>change('soil',{...config.soil,source:e.target.value})}/></Field></div>
    </section><section className="card"><h2>Installation et accès à l’eau</h2><div className="form-grid">
      <Field label="Système d’irrigation"><input value={config.system.name} onChange={e=>sys('name',e.target.value)} placeholder="Arrosoir, goutte-à-goutte, aspersion…"/></Field>
      <NumberField label="Efficacité d’application (0 à 1)" value={config.system.applicationEfficiency} max={1} onChange={v=>sys('applicationEfficiency',v)}/>
      <NumberField label="Efficacité de transport (0 à 1)" value={config.system.transportEfficiency} max={1} onChange={v=>sys('transportEfficiency',v)} hint="Saisir 1 seulement si aucune perte entre source et champ n’est retenue."/>
      <NumberField label="Débit total à la source (m³/h)" value={config.system.sourceFlowM3h} onChange={v=>sys('sourceFlowM3h',v)}/>
      <NumberField label="Heures d’accès à l’eau par jour" value={config.system.hoursPerDay} max={24} onChange={v=>sys('hoursPerDay',v)}/>
      <NumberField label="Quota disponible à la source sur tout le cycle (m³)" value={config.system.sourceBudgetM3} onChange={v=>sys('sourceBudgetM3',v)} hint="Inclut l’eau déjà prélevée ; vide signifie disponibilité inconnue, 0 signifie absence d’eau."/>
      <NumberField label="Apport net maximal par jour (mm)" value={config.system.maxNetMmPerDay} onChange={v=>sys('maxNetMmPerDay',v)}/>
      <NumberField label="Intervalle minimal entre arrosages (jours)" value={config.system.minIntervalDays} min={1} max={60} onChange={v=>sys('minIntervalDays',v??NaN)}/>
      <NumberField label="Déficit cible après irrigation (fraction de réserve utile)" value={config.system.targetDepletionFraction} max={.9} onChange={v=>sys('targetDepletionFraction',v??NaN)} hint="Doit rester inférieur au seuil de stress de tous les stades."/>
      <Field label="Source des caractéristiques et contraintes"><textarea value={config.system.source} onChange={e=>sys('source',e.target.value)}/></Field>
    </div><fieldset className="seasonal-weekdays"><legend>Jours d’accès à l’eau</legend>{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'].map((d,i)=><label key={d}><input type="checkbox" checked={config.system.allowedWeekdays.includes(i)} onChange={e=>sys('allowedWeekdays',e.target.checked?[...config.system.allowedWeekdays,i]:config.system.allowedWeekdays.filter(x=>x!==i))}/>{d}</label>)}</fieldset>
    <details><summary>Limiter l’eau disponible à certaines dates</summary><HelpParagraph>Valeurs à la source. Une valeur de 0 représente une interruption. Les autres dates suivent les contraintes générales.</HelpParagraph>{config.system.dailySourceLimits.map((d,i)=><div className="seasonal-toolbar" key={i}><input aria-label="Date de disponibilité" type="date" value={d.date} onChange={e=>sys('dailySourceLimits',config.system.dailySourceLimits.map((x,j)=>i===j?{...x,date:e.target.value}:x))}/><NumberField label="Volume accessible (m³)" value={d.m3} onChange={v=>sys('dailySourceLimits',config.system.dailySourceLimits.map((x,j)=>i===j?{...x,m3:v??NaN}:x))}/><button className="btn secondary small" onClick={()=>sys('dailySourceLimits',config.system.dailySourceLimits.filter((_,j)=>i!==j))}>Retirer</button></div>)}<button className="btn secondary" onClick={()=>sys('dailySourceLimits',[...config.system.dailySourceLimits,{date:config.asOfDate,m3:0}])}>Ajouter une date</button></details>
    </section></>}

    {tab==='meteo'&&<section className="card" role="tabpanel" id="seasonal-panel-meteo" aria-labelledby="seasonal-tab-meteo"><h2>Météo disponible et scénario pour la suite</h2><HelpParagraph>Les prévisions proches aident à actualiser le calendrier. Les dates lointaines restent conditionnelles. Les jours sans pluie renseignée ne sont jamais assimilés silencieusement à zéro.</HelpParagraph>
    <div className="form-actions"><button className="btn secondary" disabled={busy||!workspace||config.latitude===null||config.longitude===null} onClick={fetchWeather}>Charger la prévision météo disponible (16 jours au maximum)</button></div><HelpParagraph className="source-note">Open-Meteo : données de modèles, ET0 FAO. Le chargement transmet les coordonnées de la parcelle à ce fournisseur ; source non qualifiée localement. Aucune prévision n’est présentée comme une mesure de pluie sur votre champ. <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Attribution et conditions</a>.</HelpParagraph>
    <label className="seasonal-check"><input type="checkbox" checked={config.fallback!==null} onChange={e=>change('fallback',e.target.checked?{label:'Scénario sec hypothétique sans pluie, ET0 à confirmer',et0MmDay:5,rainMmDay:0}:null)}/>Autoriser un scénario explicite pour les jours incomplets ou au-delà de l’horizon météo</label>
    {config.fallback&&<div className="form-grid"><Field label="Nom et hypothèses du scénario"><input value={config.fallback.label} onChange={e=>change('fallback',{...config.fallback!,label:e.target.value})}/></Field><NumberField label="ET0 hypothétique (mm/j)" value={config.fallback.et0MmDay} onChange={v=>change('fallback',{...config.fallback!,et0MmDay:v??NaN})}/><NumberField label="Pluie hypothétique (mm/j)" value={config.fallback.rainMmDay} onChange={v=>change('fallback',{...config.fallback!,rainMmDay:v??NaN})}/></div>}
    <details open><summary>Saisir ou importer les données quotidiennes</summary><HelpParagraph>Une ligne par date, sans en-tête : <code>AAAA-MM-JJ;pluie_mm;et0_mm;statut;source</code>. Statut : observed, forecast ou scenario. Laisser une mesure inconnue vide. Toutes les lignes doivent avoir été disponibles à la date du conseil.</HelpParagraph><Field label="Données quotidiennes"><textarea rows={7} value={weatherText} onChange={e=>setWeatherText(e.target.value)} placeholder="2026-10-29;12;4.5;observed;Pluviomètre et station locale"/></Field><div className="form-actions"><button className="btn secondary" onClick={importWeather}>Vérifier et ajouter les lignes</button></div></details>
    <HelpParagraph>{config.weather.length} journée(s) renseignée(s). Les observations de pluie du suivi auront priorité sur ces lignes.</HelpParagraph>
    {!!config.weather.length&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Pluie (mm)</th><th>ET0 (mm)</th><th>Statut</th><th>Source</th><th>Action</th></tr></thead><tbody>{config.weather.map(w=><tr key={w.date}><td>{w.date}</td><td>{fmt(w.rainMm)}</td><td>{fmt(w.et0Mm)}</td><td>{w.status==='forecast'?'Prévision':w.status==='scenario'?'Scénario':w.status==='estimated'?'Estimé par modèle':'Observation'}</td><td>{w.source}</td><td><button className="btn secondary small" onClick={()=>change('weather',config.weather.filter(x=>x.date!==w.date))}>Retirer</button></td></tr>)}</tbody></table></div>}
    </section>}

    {tab==='plan'&&<div role="tabpanel" id="seasonal-panel-plan" aria-labelledby="seasonal-tab-plan">
      {!plan?<section className="card empty-state"><h2>Votre calendrier attend ses paramètres</h2><HelpParagraph>Renseignez le sol, les stades et une météo ou un scénario explicite, puis lancez le calcul.</HelpParagraph><button className="btn primary" onClick={compute}>Calculer le plan</button></section>:<>
      {planStale&&<div className="notice warning">Les paramètres ont changé : les nombres ci-dessous correspondent au dernier calcul. Recalculez avant de les utiliser.</div>}
      {plan.missing.length>0&&<section className="notice warning" role="alert"><div><strong>Calcul incomplet : informations nécessaires</strong><ul>{plan.missing.map(x=><li key={x}>{x}</li>)}</ul><HelpParagraph>Les cumuls partiels ne représentent pas un besoin sur le cycle complet.</HelpParagraph></div></section>}
      <div className="seasonal-kpis"><article><span>Besoin sans stress {plan.complete?'sur le cycle':'sur la partie calculée'}</span><strong>{fmt(plan.totals.demandMm)} <small>mm</small></strong><HelpParagraph>Demande de la culture et évaporation du sol</HelpParagraph></article><article><span>Volume brut prévisionnel à la source</span><strong>{fmt(plan.totals.sourceM3)} <small>{plan.totals.sourceM3===null?'':'m³'}</small></strong><HelpParagraph>{fmt(plan.totals.recordedSourceM3)} m³ réalisés + {fmt(plan.totals.remainingSourceM3)} m³ restant prévus</HelpParagraph></article><article><span>Déficit de consommation estimé</span><strong>{fmt(plan.totals.unmetEtMm)} <small>mm</small></strong><HelpParagraph>Stress simulé ; aucun effet certain sur le rendement déduit</HelpParagraph></article><article><span>Fin de cycle estimée</span><strong className="seasonal-date">{plan.horizonEnd}</strong><HelpParagraph>{plan.intervalDays?`Intervalles proposés : ${fmt(plan.intervalDays.min,0)} à ${fmt(plan.intervalDays.max,0)} jours`:'Fréquence insuffisamment établie'}</HelpParagraph></article></div>
      <section className="card"><div className="card-header"><div><span className="eyebrow">À CONFIRMER AVANT INTERVENTION</span><h2>Prochains arrosages proposés</h2></div><span className="badge warning">Scénario conditionnel</span></div>
      {!plan.nextWindows.length?<HelpParagraph>Aucune intervention réalisable proposée dans la partie calculée. Vérifiez les données manquantes, le stock du sol et les contraintes d’eau.</HelpParagraph>:<div className="seasonal-windows">{plan.nextWindows.slice(0,4).map(w=><article key={w.from}><span>{w.from}</span><strong>{fmt(w.volume.fieldM3)} m³ au champ</strong><HelpParagraph>{fmt(w.volume.netMm)} mm nets · {fmt(w.volume.fieldMm)} mm bruts<br/>{fmt(w.volume.fieldLitres,0)} litres au champ<br/>{fmt(w.volume.sourceM3)} m³ à la source · {fmt(w.volume.durationHours)} h</HelpParagraph>{w.reasons.map(x=><small key={x}>{x}</small>)}</article>)}</div>}
      <HelpParagraph className="source-note">Les dates sont des fenêtres d’un jour issues du scénario. Pluie récente, état du sol et disponibilité d’eau doivent être revérifiés. Les interventions passées non enregistrées ne sont pas supposées réalisées.</HelpParagraph></section>
      <section className="card"><div className="card-header"><h2>Besoins et contributions sur le cycle</h2><Field label="Regroupement"><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="weeks">Semaines depuis le semis</option><option value="decades">Décades depuis le semis</option><option value="stages">Stades culturaux</option></select></Field></div>
      <WaterChart periods={groups}/><div className="table-wrap"><table className="data-table"><thead><tr>{['Période','Dates','Besoin (mm)','Pluie retenue (mm)','Réserve début → fin (mm)','Minimum net / apport (mm)','Volume champ (m³)','Volume source (m³)','Déficit (mm)'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{groups.map((p,i)=><tr key={i}><td>{p.label}</td><td>{p.from} → {p.to}</td><td>{fmt(p.demandMm)}</td><td>{fmt(p.rainRetainedMm)}</td><td>{fmt(p.stockStartMm)} → {fmt(p.stockEndMm)}</td><td>{fmt(p.requiredNetMm)} / {fmt(p.netMm)}</td><td>{fmt(p.fieldM3)}</td><td>{fmt(p.sourceM3)}</td><td>{fmt(p.unmetEtMm)}</td></tr>)}</tbody></table></div><HelpParagraph className="source-note">La réserve est un stock, les pluies et irrigations sont des flux. Le minimum net vise à éviter le stress journalier ; le plan peut apporter davantage pour reconstituer une réserve. Ses répétitions sous déficit ne sont pas un volume unique à rattraper. Le détail exporté inclut croissance racinaire, corrections de capteur, ruissellement et drainage pour expliquer les variations.</HelpParagraph></section>
      <section className="card"><h2>Calendrier détaillé et quantités par intervention</h2><div className="table-wrap"><table className="data-table"><thead><tr>{['Date / stade','Besoin / consommé (mm)','Pluie retenue (mm)','Réserve fin (mm)','Net / brut (mm)','Litres champ','m³ champ / source','Durée (h)','État et contraintes'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{plan.days.filter(d=>allDays||d.intervention).map(d=><tr key={d.date}><td>{d.date}<small className="seasonal-block">{d.stage}</small></td><td>{fmt(d.demandMm)} / {fmt(d.actualEtMm)}</td><td>{fmt(d.rainRetainedMm)}</td><td>{fmt(d.stockEndMm)}</td><td>{d.intervention?`${fmt(d.intervention.netMm)} / ${fmt(d.intervention.fieldMm)}`:'—'}</td><td>{d.intervention?fmt(d.intervention.fieldLitres,0):'—'}</td><td>{d.intervention?`${fmt(d.intervention.fieldM3)} / ${fmt(d.intervention.sourceM3)}`:'—'}</td><td>{d.intervention?fmt(d.intervention.durationHours):'—'}</td><td>{d.intervention?.type==='recorded'?'Réalisé enregistré':d.intervention?'Proposé · à confirmer':d.weatherStatus==='scenario'?'Scénario':'Météo renseignée'}{d.intervention?.reasons.map(r=><small className="seasonal-block" key={r}>{r}</small>)}</td></tr>)}</tbody></table></div><label className="seasonal-check"><input type="checkbox" checked={allDays} onChange={e=>setAllDays(e.target.checked)}/>Afficher tous les jours, y compris sans intervention</label></section>
      <section className="card"><h2>Hypothèses et traçabilité du calcul</h2><ul>{plan.assumptions.map(a=><li key={a}>{a}</li>)}</ul><HelpParagraph>Version du moteur : {plan.engineVersion}. Source spatiale et qualité d’un conseil ne deviennent pas plus précises parce que la surface est saisie au m².</HelpParagraph><div className="form-actions no-print"><button className="btn secondary" disabled={planStale} onClick={()=>download('plan-irrigation.csv',waterPlanCsv(plan),'text/csv;charset=utf-8')}>Exporter le calendrier</button><button className="btn secondary" disabled={planStale} onClick={()=>download('campagne-agri.json',JSON.stringify({config,events,plan},null,2),'application/json')}>Exporter la campagne et les hypothèses</button><button className="btn secondary" onClick={()=>window.print()}>Imprimer la fiche / PDF</button></div></section>
      </>}
    </div>}

    {tab==='suivi'&&<section className="card" role="tabpanel" id="seasonal-panel-suivi" aria-labelledby="seasonal-tab-suivi"><h2>Ce qui s’est réellement passé</h2><HelpParagraph>Une pluie remplace la valeur météo du même jour. Un arrosage n’entre au bilan que s’il est déclaré ou mesuré. Une correction d’humidité ajuste le stock sans inventer une pluie. Les quantités d’irrigation concernent toute la surface arrosée renseignée.</HelpParagraph><form onSubmit={e=>{e.preventDefault();recordEvent(event)}}><div className="form-grid">
      {config.landSelection==='potentialLand'&&<HelpParagraph>Cette observation concerne uniquement la partie terrestre sélectionnée, hors eau et surfaces inconnues.</HelpParagraph>}
      <Field label="Type d’observation"><select value={event.kind} onChange={e=>setEvent({...event,kind:e.target.value as WaterEvent['kind'],unit:e.target.value==='soil'?'fraction':'mm'})}><option value="rain">Pluie quotidienne</option><option value="irrigation">Irrigation</option><option value="soil">Humidité de toute la zone racinaire</option></select></Field>
      <Field label="Date réelle de l’événement"><input type="date" required min={config.sowingDate} max={today()} value={event.date} onChange={e=>setEvent({...event,date:e.target.value})}/></Field>
      <NumberField label={event.kind==='soil'?'Humidité volumique (fraction)':'Quantité'} value={event.amount} onChange={v=>setEvent({...event,amount:v??NaN})}/>
      <Field label="Unité"><select value={event.unit} onChange={e=>setEvent({...event,unit:e.target.value as WaterEvent['unit']})}>{(event.kind==='soil'?['fraction']:event.kind==='rain'?['mm']:['mm','L','m3']).map(u=><option key={u} value={u}>{u==='m3'?'m³':u==='fraction'?'Fraction (0 à 1)':u}</option>)}</select></Field>
      {event.kind==='irrigation'&&<Field label="Point de mesure"><select value={event.point} onChange={e=>setEvent({...event,point:e.target.value as WaterEvent['point']})}><option value="field">Volume brut arrivé au champ</option><option value="source">Volume brut prélevé à la source</option><option value="net">Eau utile nette dans la zone racinaire</option></select></Field>}
      <Field label="État"><select value={event.status} onChange={e=>setEvent({...event,status:e.target.value as WaterEvent['status']})}><option value="measured">Mesuré</option><option value="declared">Déclaré réalisé</option><option value="planned">Seulement prévu (ignoré dans le réalisé)</option><option value="cancelled">Annulé</option></select></Field>
      <Field label="Méthode, source ou commentaire"><input required value={event.source} onChange={e=>setEvent({...event,source:e.target.value})} placeholder="Pluviomètre, compteur, carnet de l’exploitant…"/></Field>
    </div><div className="form-actions"><button className="btn primary" disabled={busy||!active}>Enregistrer et actualiser le calendrier</button><button className="btn secondary" type="button" onClick={()=>setEvent({...event,id:newId(),source:'',amount:0})}>Nouvelle observation</button></div></form>
    {!active&&<HelpParagraph className="notice info">Enregistrez la campagne dans votre espace avant d’ajouter une observation. Un exemple d’arrosage n’est pas une mesure réelle.</HelpParagraph>}
    <h3>Observations enregistrées</h3>{!events.length?<HelpParagraph>Aucune observation réelle enregistrée.</HelpParagraph>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Événement</th><th>Quantité</th><th>Statut</th><th>Source</th><th>Action</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.kind==='rain'?'Pluie':e.kind==='soil'?'Humidité':'Irrigation'}</td><td>{fmt(e.amount)} {e.unit}</td><td>{e.status}</td><td>{e.source}</td><td><button className="btn secondary small" onClick={()=>{setEvent(e);setNotice('Observation reprise : la même identité sera conservée pour la correction.')}}>Corriger</button><button className="btn secondary small" disabled={busy||dirty} onClick={()=>recordEvent({...e,status:'cancelled'})}>Annuler</button></td></tr>)}</tbody></table></div>}
    {!!active&&<details><summary>Historique des plans conservés</summary><button className="btn secondary small" disabled={busy} onClick={()=>open(active.id)}>Charger l’historique et la dernière révision</button>{history.map(h=><HelpParagraph key={h.revision}>Révision {h.revision} · {h.created_at} · {h.reason} <a href={'/api/seasonal?id='+encodeURIComponent(active.id)+'&revision='+h.revision} download>Télécharger cette révision</a></HelpParagraph>)}</details>}
    </section>}

    {tab==='conseils'&&<div role="tabpanel" id="seasonal-panel-conseils" aria-labelledby="seasonal-tab-conseils"><SowingWorkspace config={config} events={events} onBack={()=>setTab('simulation')}><section className="card"><h2>Estimer la récolte à partir d’une référence existante</h2>{forecasts.length?<><HelpParagraph>Référence territoriale historique disponible pour cette culture, localité et année. Elle n’est pas actualisée par l’irrigation et ne valide pas le rendement de votre champ.</HelpParagraph>{forecasts.slice(0,3).map(f=><HelpParagraph key={f.id}><strong>{fmt(f.yield,3)} t/ha</strong> · {f.territory} · {f.year} · {f.version}</HelpParagraph>)}</>:<HelpParagraph>Aucune référence de rendement du dépôt ne correspond exactement au pays, à la culture, à la localité et à l’année saisis. Consultez l’atlas pour les références disponibles. Le moteur ne reprend pas le rendement d’un pays voisin.</HelpParagraph>}</section>
    <CropReference key={`nutrition-${active?.id??draftId}-${config.country}-${config.cropProfile?.id}`} mode="nutrition" config={config} onChange={edit}/><section className="card"><h2>Vérifier les quantités d’engrais d’un plan documenté</h2><HelpParagraph>Renseignez un besoin cible N–P₂O₅–K₂O établi par une méthode locale et les apports déjà effectués. Ce bilan ne détermine pas le besoin à partir du seul pH ou de l’azote total du sol.</HelpParagraph><Field label="Référence locale justifiant le besoin cible"><input value={nutrients.source} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,source:e.target.value});}}/></Field>
    <div className="form-grid">{['N','P₂O₅','K₂O'].map((label,i)=><div key={label}><Field label={`Besoin cible ${label} (kg/ha)`}><input type="number" min="0" step="any" value={nutrients.target[i]} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,target:nutrients.target.map((x,j)=>i===j?e.target.value:x)});}}/></Field><Field label={`Déjà fourni ${label} (kg/ha)`}><input type="number" min="0" step="any" value={nutrients.already[i]} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,already:nutrients.already.map((x,j)=>i===j?e.target.value:x)});}}/></Field><Field label={`Teneur du produit en ${label} (%)`}><input type="number" min="0" max="100" step="any" value={nutrients.composition[i]} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,composition:nutrients.composition.map((x,j)=>i===j?e.target.value:x)});}}/></Field></div>)}</div><div className="form-grid"><Field label="Nom exact du produit"><input value={nutrients.name} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,name:e.target.value});}}/></Field><Field label="Dose envisagée de ce produit (kg/ha)"><input type="number" min="0" step="any" value={nutrients.dose} onChange={e=>{setNutrientResult(null);setNutrients({...nutrients,dose:e.target.value});}}/></Field></div>
    <button className="btn secondary" onClick={()=>{try{if(!nutrients.source.trim()||[...nutrients.target,...nutrients.already,...nutrients.composition,nutrients.dose].some(x=>x.trim()===''))throw new Error('Renseignez la référence, les trois besoins, les apports, les teneurs et la dose ; une valeur inconnue ne vaut pas zéro.');if(config.areaM2===null)throw new Error('Surface requise pour les quantités d’engrais de la parcelle.');setNutrientResult(nutrientBalance(config.areaM2,nutrients.target.map(Number),[{name:nutrients.name,kgHa:Number(nutrients.dose),compositionPercent:nutrients.composition.map(Number),pricePerKg:null}],nutrients.already.map(Number)));}catch(e){setError((e as Error).message);}}}>Calculer le bilan et la quantité pour la parcelle</button>
    {nutrientResult&&<div className="notice info"><div><HelpParagraph>{nutrientResult.quantities.map(p=>`${p.name} : ${fmt(p.kg,2)} kg pour la parcelle`).join(' ; ')}</HelpParagraph><HelpParagraph>Éléments restant à couvrir (kg/ha, N–P₂O₅–K₂O) : {nutrientResult.remainingKgHa.map(x=>fmt(x)).join(' / ')}.</HelpParagraph><HelpParagraph>Excédents (kg/ha) : {nutrientResult.excessKgHa.map(x=>fmt(x)).join(' / ')}.</HelpParagraph><HelpParagraph>{nutrientResult.caveat}</HelpParagraph></div></div>}
    </section><section className="card"><h2>Ravageurs et traitements</h2><HelpParagraph>Enregistrez le stade, les symptômes et leur fréquence, puis faites confirmer le diagnostic et le seuil d’intervention par un conseiller. Prévention, observation et lutte intégrée précèdent le choix d’un produit.</HelpParagraph><HelpParagraph>Le dépôt ne contient pas de registre phytosanitaire courant qualifié pour les six pays. Aucun pesticide ni dose de traitement n’est donc généré automatiquement. Un produit exige une autorisation actuelle pour le pays, la culture et l’usage, ainsi qu’une étiquette vérifiée.</HelpParagraph></section></SowingWorkspace></div>}

    {tab==='fichiers'&&<section className="card files-workspace" role="tabpanel" id="seasonal-panel-fichiers" aria-labelledby="seasonal-tab-fichiers"><div className="module-intro"><h2>Conserver et retrouver ma campagne</h2><HelpParagraph>Le fichier contient vos paramètres et vos observations. Une importation crée un nouveau brouillon.</HelpParagraph></div><div className="file-actions"><article><ProductIcon name="file" size={27}/><h3>Exporter cette simulation</h3><HelpParagraph>Gardez une copie complète au format JSON.</HelpParagraph><button className="btn secondary" disabled={!config.parcelGeometry} onClick={()=>download('campagne-agri.json',JSON.stringify({config,events,plan:planStale?null:plan},null,2),'application/json')}>Exporter la campagne</button></article><article><ProductIcon name="plus" size={27}/><h3>Importer une campagne</h3><HelpParagraph>Ouvrez un fichier exporté depuis AgriPrévision.</HelpParagraph><Field label="Fichier de campagne JSON"><input type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2e6)throw new Error('Fichier trop volumineux.');if(dirty&&config.parcelGeometry&&!window.confirm('L’import remplacera les modifications non enregistrées. Continuer ?'))return;const data=JSON.parse(await file.text());planWater(data.config,data.events??[]);setConfig(data.config);setEvents(data.events??[]);setPlan(null);setPlanStale(true);setDraftId(newId());setActive(null);setDirty(true);setHistory([]);setTab('simulation');setNotice('Campagne importée localement. Enregistrez pour la conserver dans votre espace.');}catch(err){setError((err as Error).message);}}}/></Field></article></div><label className="seasonal-check"><input type="checkbox" checked={keepDraft} onChange={e=>{setKeepDraft(e.target.checked);if(!e.target.checked)localStorage.removeItem(draftKey)}}/>Conserver aussi un brouillon sur cet appareil personnel</label><button className="qs-text-button" onClick={restoreDraft}>Restaurer le brouillon local</button>{!workspace&&<HelpParagraph>Ouvrez votre espace connecté pour enregistrer vos campagnes.</HelpParagraph>}</section>}
    {tab!=='simulation'&&tab!=='carte'&&tab!=='fichiers'&&<div className="advanced-footer"><span>Les changements sont repris automatiquement dans la simulation.</span><button className="btn primary" disabled={busy} onClick={compute}>Voir le calendrier actualisé <ProductIcon name="arrow" size={16}/></button></div>}

  </div>;
}

function WaterChart({periods}:{periods:WaterPeriod[]}) {
  if(!periods.length)return null;
  const max=Math.max(1,...periods.flatMap(p=>[p.demandMm,p.netMm,p.rainRetainedMm]));
  return <div className="seasonal-chart" aria-label="Besoins, pluie retenue et irrigation nette par période ; valeurs exactes dans le tableau suivant"><div className="seasonal-chart-legend"><span>■ Besoin sans stress</span><span>■ Pluie retenue</span><span>■ Irrigation nette</span></div><svg viewBox={`0 0 ${Math.max(600,periods.length*55)} 230`} role="img"><title>Comparaison des besoins hydriques et apports par période, en millimètres</title>{periods.map((p,i)=><g key={i} transform={`translate(${i*55+25},0)`}>{[p.demandMm,p.rainRetainedMm,p.netMm].map((v,j)=><rect key={j} x={j*11} y={180-v/max*150} width="9" height={v/max*150} rx="2" fill={['#213c60','#5d91ab','#2975cf'][j]}><title>{p.label} : {['besoin','pluie retenue','irrigation nette'][j]} {fmt(v)} mm</title></rect>)}<text x="12" y="202" textAnchor="middle" fontSize="10" fill="#4c5a6e">{i+1}</text></g>)}</svg></div>;
}
