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
import {ProductIcon} from './product-ui';
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

export default function Seasonal({ workspace, science }: { workspace: Bootstrap | null; science: Science | null }) {
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
  const [startAtYield,setStartAtYield]=useState(false);
  const [libraryOpen,setLibraryOpen]=useState(false);
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
      if(result.requestId!==requestId||!result.plan)throw new Error('Réponse de calcul incomplète. Relancez le calcul ; vos su羻����k�w��}</tbody></table></div>}
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
