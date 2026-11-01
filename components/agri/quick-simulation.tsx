'use client';
import {useEffect,useRef,useState} from 'react';
import {CROPS} from '../../lib/seasonal/catalog';
import {automaticCampaign,mergeEnvironment} from '../../lib/seasonal/automatic';
import type {Environment} from '../../lib/seasonal/environment';
import type {SeasonalConfig,WaterPlan,WaterEvent} from '../../lib/seasonal/types';
import './quick-simulation.css';
import WaterChart from './water-chart';
import EditableValue,{Pencil} from './editable-value';
import SowingSummary from './sowing-summary';
import {waterOverview} from '../../lib/seasonal/overview';
import DataCompletion from './data-completion';
import AgronomicPanel from './agronomic-panel';
import YieldSummary from './yield-summary';
import InputStatus from './input-status';
import {waterIndicator} from '../../lib/seasonal/water-indicator';
import {declareScenario} from '../../lib/seasonal/provenance';
import {geometryIdentity,environmentContext} from '../../lib/seasonal/provenance';
const fmt=(v:number|null|undefined,d=0)=>v==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
const date=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
type Props={config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;onMap:()=>void;onAdvanced:(tab:string)=>void;onSave:()=>void;canSave:boolean;events:WaterEvent[]};
export default function QuickSimulation({config,plan,stale,onChange,onMap,onAdvanced,onSave,canSave,events}:Props){
 const [environment,setEnvironment]=useState<Environment|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[adjust,setAdjust]=useState(false),[sectorJob,setSectorJob]=useState<any>(null),[sectorRunning,setSectorRunning]=useState(false);
 const [terrainOpened,setTerrainOpened]=useState(false),[sourcesOpened,setSourcesOpened]=useState(false),[agronomyOpened,setAgronomyOpened]=useState(false);
 const jobRun=useRef(false);
 const latest=useRef(config);latest.current=config;
 const duration=config.stages.reduce((s,x)=>s+x.days,0);
 const key=config.parcelGeometry?JSON.stringify([geometryIdentity(config.parcelGeometry),config.country,config.sowingDate,duration]):'';
 const parcelKey=config.parcelGeometry?JSON.stringify(config.parcelGeometry):'';
 const previousParcel=useRef(parcelKey),refreshKey=useRef<string|null>(null);
 function refreshData(){refreshKey.current=key;setRetry(x=>x+1);}
 useEffect(()=>{if(previousParcel.current!==parcelKey){previousParcel.current=parcelKey;setEnvironment(null);setSectorJob(null);jobRun.current=false;setSectorRunning(false);setError('');}},[parcelKey]);
 useEffect(()=>{
  if(!key||!duration){setLoading(false);return;}
  if((config.areaM2??0)>=1_000_000&&!sectorJob?.assessment){setLoading(false);return;}
  const refresh=refreshKey.current===key;refreshKey.current=null;
  const controller=new AbortController();let alive=true;setLoading(true);setError('');
  fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'environment',latitude:config.latitude,longitude:config.longitude,country:config.country,start:config.sowingDate,days:duration,geometry:config.parcelGeometry,refresh})})
   .then(async r=>{let d:any;try{d=await r.json();}catch{throw new Error(`Actualisation des données interrompue (HTTP ${r.status}). Vos saisies sont conservées.`);}if(!r.ok)throw new Error(`Actualisation interrompue (HTTP ${r.status}). ${d.error||'Vos saisies sont conservées.'}`);return d as Environment;})
   .then(d=>{if(!alive||environmentContext(latest.current)!==environmentContext(config))return;setEnvironment(d);onChange(mergeEnvironment(latest.current,d));})
   .catch(e=>{if(alive)setError(e.message==='Failed to fetch'?'Connexion indisponible. Réessayez ou ajustez les hypothèses.':e.message);})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;controller.abort();};
 },[key,retry,sectorJob?.status]); // edits to a value never trigger a new network request
 const phAnalysis=config.soilAnalyses?.find(a=>a.measurements.some(m=>m.parameter==='pH'));
 const ph=phAnalysis?.measurements.find(m=>m.parameter==='pH')?.value??null;
 const chemistry=(parameter:string)=>config.soilAnalyses?.flatMap((a,i)=>a.measurements.map((m,j)=>({m,ev:config.inputs?.values[`soilAnalyses.${i}.measurements.${j}.value`]}))).find(x=>x.m.parameter===parameter&&x.ev?.status!=='missing')?.m.value??null;
 const sourceLabel=(parameter:string)=>{const item=config.soilAnalyses?.flatMap((a,i)=>a.measurements.map((m,j)=>({m,ev:config.inputs?.values[`soilAnalyses.${i}.measurements.${j}.value`]}))).find(x=>x.m.parameter===parameter);return item?.ev?.status==='missing'?'Indisponible':item?.ev?.status==='measured'?'Analyse mesurée · source saisie':item?.ev?.origin==='manual'?'Valeur saisie · à confirmer':item?.ev?.origin==='automatic'?'SoilGrids · estimé':item?'Origine historique à qualifier':'Indisponible';};
 const weatherCoverage=Math.round(100*config.weather.filter(w=>w.rainMm!==null&&w.et0Mm!==null).length/Math.max(1,duration));
 const indicator=waterIndicator(config,plan,stale,loading);
 const usable=indicator.kind==='ready'&&plan;
 const unavailableLabel=loading||stale?'Calcul en préparation':plan?.status==='blocked'?'Calcul suspendu : voir les informations manquantes':'Simulation à compléter';
 const overview=waterOverview(config,usable?plan:null);
 const reservePercent=config.soil.layers.some(l=>l.initialTheta===null)?null:Math.round(100*config.soil.layers.reduce((n,l)=>n+l.thicknessM*(l.initialTheta!-l.thetaWP),0)/Math.max(.00001,config.soil.layers.reduce((n,l)=>n+l.thicknessM*(l.thetaFC-l.thetaWP),0)));
 const fieldFlooded=config.waterCondition==='waterlogged'||config.waterCondition==='submerged';
 const mixedLand=config.landSelection!=='potentialLand'&&(config.landAssessment?.candidateAreaM2??0)>0&&(config.landAssessment?.fractions.potentialLand.fraction??1)<1-1e-7;
 const latestAuto=environment?new Date(environment.retrievedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):null;
 function selectCrop(id:string){try{onChange(automaticCampaign({...config,weather:[]},id));setError('');}catch(e){setError((e as Error).message);}}
 function setPh(value:string){const n=value===''?null:Number(value);const analyses=(config.soilAnalyses??[]).map(a=>({...a,measurements:a.measurements.filter(m=>m.parameter!=='pH')})).filter(a=>a.measurements.length);onChange({...config,soilAnalyses:[...analyses,...(n!==null?[{source:'Valeur saisie par l’utilisateur',date:config.asOfDate,availableOn:config.asOfDate,topCm:5,bottomCm:15,status:'declared' as const,measurements:[{parameter:'pH' as const,value:n,unit:'pH',method:'water'}]}]:[])]});}
 function climateChange(key:'rainMm'|'et0Mm',factor:number){onChange({...config,weather:config.weather.map(w=>({...w,[key]:w[key]===null?null:w[key]!*factor,status:'scenario',source:'Ajustement utilisateur — '+w.source.replace(/^Ajustement utilisateur — /,'')}))});}
 async function runSectors(){
  if(jobRun.current)return;jobRun.current=true;setSectorRunning(true);setError('');
  const geometry=config.parcelGeometry,identity=geometryIdentity(geometry);
  const call=async(action:string,id?:string)=>{const r=await fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,geometry,id})});const data=await r.json() as any;if(!r.ok)throw new Error(data.error||'Traitement indisponible');return data;};
  try{let job=await call('land-job-start');
   while(jobRun.current&&geometryIdentity(latest.current.parcelGeometry)===identity){
    setSectorJob(job);if(job.assessment){onChange({...latest.current,landAssessment:job.assessment});setRetry(x=>x+1);break;}
    const before=job.completed;job=await call('land-job-step',job.id);
    if(job.completed===before&&job.status!=='complete'&&!job.errors?.length)await new Promise(resolve=>setTimeout(resolve,2000));
    if(job.errors?.length){setSectorJob(job);throw new Error(job.errors[0].error);}
   }
  }catch(e){setError((e as Error).message);}finally{jobRun.current=false;setSectorRunning(false);}
 }
 useEffect(()=>()=>{jobRun.current=false;},[]);
 return <div className="quick-sim qs-dashboard" aria-busy={stale||loading}>
  <div className="qs-title"><div><span className="qs-eyebrow">MA SAISON AGRICOLE</span><h1>Ma simulation</h1><p>Préparer le semis. Prévoir l’eau. Suivre la récolte.</p></div><div className="qs-title-actions"><button className="btn secondary" onClick={()=>onAdvanced('suivi')}>Ajouter une pluie ou un arrosage</button><button className="btn primary" disabled={!canSave||stale||!plan} onClick={onSave}>Enregistrer</button></div></div>
  <section className="qs-context" aria-label="Ma parcelle, ma culture et ma date de semis">
   <div className="qs-editable"><div className="qs-editable-label"><span>Ma parcelle</span><button className="qs-edit-button" onClick={onMap} aria-label="Modifier ma parcelle" title="Modifier ma parcelle"><Pencil/></button></div><div className="qs-editable-value">{config.parcelGeometry?config.name:'Choisir mon champ'}</div><small>{config.parcelGeometry?`${fmt(config.areaM2!/10000,3)} ha de contour · ${fmt(config.areaM2)} m²`:'Dessinez votre champ sur la carte.'}</small></div>
   <EditableValue label="Ma culture" value={config.crop} hint="Culture utilisée pour cette simulation"><label className="field"><span>Culture de la simulation</span><select autoFocus value={config.cropProfile?.id??'maize'} onChange={e=>selectCrop(e.target.value)}>{CROPS.map(c=><option key={c.id} value={c.id}>{c.name}{!c.water?.automaticExample?' · cycle à préciser':''}</option>)}</select></label></EditableValue>
   <EditableValue label="Date de semis" value={new Date(config.sowingDate+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})} hint={duration?`Cycle de référence : ${duration} jours`:'Durée du cycle à préciser'}><label className="field"><span>Date de semis de la simulation</span><input autoFocus type="date" value={config.sowingDate} onChange={e=>{if(e.target.value)onChange({...config,sowingDate:e.target.value,weather:[]});}}/></label></EditableValue>
  </section>
  <div className="qs-live" role="status"><span><i className={loading?'loading':''}/>{!config.parcelGeometry?'Commencez par votre parcelle':loading?'Récupération du sol et de la météo…':stale?'Recalcul en cours…':latestAuto?`Données actualisées à ${latestAuto}`:'Scénario de votre campagne'}</span>{config.parcelGeometry&&<button onClick={refreshData} disabled={loading}>Actualiser les données ↻</button>}</div>
  {error&&<div className="notice warning" role="alert">{error}<button className="btn secondary small" onClick={refreshData}>Réessayer</button></div>}
  {!config.parcelGeometry?<section className="qs-start"><div className="qs-start-icon" aria-hidden="true">⌖</div><h2>Où se trouve votre champ ?</h2><p>Dessinez la parcelle. Nous récupérons le terrain, le sol et la météo disponibles.</p><button className="btn primary" onClick={onMap}>Dessiner ma parcelle →</button></section>:<>
  {(config.areaM2??0)>=1_000_000&&<section className="qs-card qs-job"><h2>Analyse par secteurs</h2><p>{sectorJob?`${sectorJob.completed} / ${sectorJob.total} secteurs · ${fmt(sectorJob.processedM2)} / ${fmt(sectorJob.totalM2)} m² analysés`:'Le grand contour sera analysé progressivement. Le traitement peut reprendre après une interruption.'}</p>{sectorJob&&<progress aria-label="Couverture traitée" value={sectorJob.completed} max={sectorJob.total}/>}<button className="btn secondary" disabled={sectorRunning} onClick={runSectors}>{sectorJob?'Reprendre le traitement':'Analyser le terrain'}</button>{sectorRunning&&<button className="btn secondary" onClick={()=>{jobRun.current=false;}}>Pause après ce secteur</button>}<small>Le résultat global attend la couverture complète.</small></section>}
  {(fieldFlooded||mixedLand||!usable)&&<section className="qs-action-banner" aria-labelledby="next-action-title"><div><h2 id="next-action-title">{fieldFlooded?'Vérifier l’eau stagnante':mixedLand?'Utiliser la partie terrestre':indicator.kind==='assumptions'?'Confirmer les hypothèses':stale||loading?'Préparation de votre calendrier…':'Une information manque au calcul'}</h2><p>{fieldFlooded?'L’arrosage est suspendu : vérifiez le drainage du champ.':mixedLand?'L’eau, les zones humides, le bâti et les zones inconnues restent hors du système terrestre.':indicator.kind==='assumptions'?'Le sol initial et l’arrosage sont préremplis avec des hypothèses modifiables.':indicator.message}</p></div><div className="qs-action-buttons">{fieldFlooded?<button className="btn secondary" onClick={()=>onAdvanced('sol')}><Pencil/> Vérifier le sol</button>:mixedLand?<button className="btn primary" onClick={()=>onChange({...config,landSelection:'potentialLand'})}>Utiliser {fmt(config.landAssessment!.candidateAreaM2)} m² terrestres</button>:indicator.kind==='assumptions'?<><button className="btn primary" onClick={()=>onChange(declareScenario(config))}>Calculer avec ces hypothèses</button><button className="btn secondary" onClick={()=>onAdvanced('sol')}><Pencil/> Vérifier</button></>:!stale&&!loading?<button className="btn secondary" onClick={()=>onAdvanced('sol')}>Voir ce qui manque</button>:null}</div></section>}
  <div className="qs-overview-grid">
   <SowingSummary config={config} plan={plan} stale={stale} onChange={onChange} areaLocked={events.some(e=>['measured','declared'].includes(e.status))}/>
   <section className="qs-card qs-water-summary" aria-labelledby="water-summary-title"><div className="qs-card-heading"><div><span className="qs-eyebrow">02 · ARROSER</span><h2 id="water-summary-title">Mon prochain apport</h2></div><button className="qs-edit-button" aria-label="Modifier les réglages d’arrosage" onClick={()=>onAdvanced('sol')}><Pencil/></button></div>
    <div className="qs-next-water"><strong>{usable&&plan.nextWindows[0]?<>{fmt(plan.nextWindows[0].volume.fieldM3)} <small>m³ au champ</small></>:usable?'Aucun proposé':'En préparation'}</strong><span>{usable&&plan.nextWindows[0]?`Proposé le ${date(plan.nextWindows[0].from)}`:usable?'Selon les données de ce scénario':unavailableLabel}</span></div>
    <p className="qs-one-line-note">Vérifiez la pluie réelle et votre accès à l’eau avant d’arroser.</p>
    <div className="qs-water-totals"><div><span>Surface du bilan d’eau</span><b>{usable?fmt(overview.areaM2===null?null:overview.areaM2/10000,3):'—'} ha</b></div><div><span>À prévoir sur tout le cycle</span><b>{usable?fmt(overview.proposed.fieldM3):'—'} m³</b></div><div><span>Fin de cycle indicative</span><b>{usable?date(plan.horizonEnd):'—'}</b></div></div>
    {usable&&<p className="qs-water-split">{overview.proposed.count} apports proposés · total à répartir, pas à apporter en une fois.</p>}
    <button className="qs-text-button" onClick={()=>onAdvanced('plan')}>Ouvrir le calendrier détaillé →</button>
   </section>
  </div>
  {usable?<WaterChart config={config} plan={plan}/>:<section className="qs-card qs-chart-placeholder"><span className="qs-eyebrow">ÉVOLUTION SUR LE CYCLE</span><h2>Vos graphiques apparaîtront ici</h2><p>{indicator.message}</p></section>}
  <YieldSummary config={config} plan={plan} stale={stale} onChange={onChange}/>
  <details className="qs-settings" id="simulation-settings"><summary><span><Pencil/> Réglages et données</span><small>Sol, météo, sources et méthodes</small></summary><div className="qs-settings-content">
   <details onToggle={e=>{if(e.currentTarget.open)setTerrainOpened(true);}}><summary>Vérifier le terrain, le sol et les réglages d’arrosage</summary>{terrainOpened&&<><InputStatus config={config} onChange={onChange}/>
  <section className="qs-card qs-data-card"><div className="qs-card-heading"><div><span className="qs-eyebrow">PRÉREMPLI POUR VOUS</span><h2>Sol estimé et réglages d’arrosage</h2></div><button className="btn secondary small" aria-expanded={adjust} onClick={()=>setAdjust(!adjust)}>{adjust?'Fermer les réglages':'Ajuster les paramètres'} ⇄</button></div><div className="qs-data-grid">{[['pH du sol',fmt(ph,1),sourceLabel('pH')],['Carbone organique',`${fmt(chemistry('organicC'),1)} g/kg`,sourceLabel('organicC')],['Azote total',`${fmt(chemistry('totalN'),2)} g/kg`,chemistry('totalN')!==null?'Hors azote assimilable':'Indisponible'],['CEC',`${fmt(chemistry('CEC'),1)} cmol(+)/kg`,sourceLabel('CEC')],['Pluie du cycle',config.weather.length?`${fmt(config.weather.reduce((s,w)=>s+(w.rainMm??0),0))} mm`:'—',`${weatherCoverage} % du cycle renseigné`],['Réserve utile du sol',`${fmt(config.soil.layers.reduce((s,l)=>s+l.thicknessM*(l.thetaFC-l.thetaWP)*1000,0))} mm`,config.inputs?.values['soil.layers.0.thetaFC']?.origin==='automatic'?'Rétention estimée · réserve initiale supposée':'Hypothèses modifiables']].map(([label,value,source])=><div key={label}><small>{label}</small><strong>{value}</strong><span>{source}</span></div>)}</div>
   {adjust&&<div className="qs-adjust"><p>Modifiez une valeur : les graphiques et le plan se recalculent automatiquement.</p><div className="form-grid"><label className="field"><span>pH eau (5–15 cm)</span><input type="number" min="0" max="14" step="0.1" value={ph??''} onChange={e=>setPh(e.target.value)}/></label><label className="field"><span>Réserve initiale du sol : {fmt(reservePercent)} %</span><input type="range" min="0" max="100" value={reservePercent??60} onChange={e=>onChange({...config,soil:{...config.soil,source:config.soil.source.replace(/ ; réserve initiale ajustée.*$/,'')+' ; réserve initiale ajustée par l’utilisateur',layers:config.soil.layers.map(l=>({...l,initialTheta:l.thetaWP+Number(e.target.value)/100*(l.thetaFC-l.thetaWP)}))}})}/></label><label className="field"><span>Efficacité d’arrosage : {fmt((config.system.applicationEfficiency??.75)*100)} %</span><input type="range" min="10" max="100" value={(config.system.applicationEfficiency??.75)*100} onChange={e=>onChange({...config,system:{...config.system,applicationEfficiency:Number(e.target.value)/100,source:'Efficacité ajustée par l’utilisateur, scénario'}})}/></label><label className="field"><span>État du champ</span><select value={config.waterCondition??'unknown'} onChange={e=>onChange({...config,waterCondition:e.target.value as SeasonalConfig['waterCondition']})}><option value="unknown">À vérifier au champ</option><option value="drained">Sans eau stagnante</option><option value="waterlogged">Sol engorgé</option><option value="submerged">Plantes sous l’eau</option></select></label></div><div className="qs-scenario-actions"><span>Tester une autre météo</span><button className="btn secondary small" disabled={!config.weather.length} onClick={()=>climateChange('rainMm',.8)}>Pluie −20 %</button><button className="btn secondary small" disabled={!config.weather.length} onClick={()=>climateChange('rainMm',1.2)}>Pluie +20 %</button><button className="btn secondary small" disabled={!config.weather.length} onClick={()=>climateChange('et0Mm',1.1)}>Évaporation +10 %</button><button className="btn secondary small" onClick={()=>{onChange({...config,weather:config.weather.filter(w=>w.status==='observed')});refreshData();}} disabled={loading}>Revenir aux données météo</button></div><div className="form-actions"><button className="btn secondary small" onClick={()=>onAdvanced('sol')}>Tous les paramètres du sol et de l’eau →</button><button className="btn secondary small" onClick={()=>onAdvanced('sol')}>Chimie et analyses →</button><button className="btn secondary small" onClick={()=>onAdvanced('parcelle')}>Stades et variété →</button><button className="btn secondary small" onClick={()=>onAdvanced('meteo')}>Détail météo →</button></div></div>}
   {plan?.calculationArea?.selection==='potentialLand'&&<p><strong>Surface utilisée pour les volumes : {fmt(plan.calculationArea.areaM2,1)} m² de terre cartographiée.</strong> Le contour dessiné reste conservé.</p>}
   <details><summary>Sources et données manquantes</summary><p>Sol : ISRIC SoilGrids 2.0, maille 250 m, horizon 5–15 cm, point représentatif de la parcelle. Ces estimations ne sont pas une analyse de laboratoire ni une moyenne de tout le contour. Texture : sable {fmt(environment?.soil.sand,1)} %, argile {fmt(environment?.soil.clay,1)} %.</p><p>Hydraulique : {config.soil.source}. Efficacité d’arrosage et réserve initiale : hypothèses modifiables. Météo : Open-Meteo, modèles et repère des trois années complètes précédentes. Pas une prévision fiable de la pluie de toute la saison. P et K assimilables, salinité, pesticides et dose d’engrais : non déterminés automatiquement.</p>{environment?.warnings.map(w=><p key={w}>{w}</p>)}<a href="https://docs.isric.org/globaldata/soilgrids/" target="_blank" rel="noreferrer">ISRIC</a> · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo · CC BY 4.0</a></details>
  </section>
   </>}</details>
   <details onToggle={e=>{if(e.currentTarget.open)setSourcesOpened(true);}}><summary>Consulter les références nationales et compléter les données</summary>{sourcesOpened&&<DataCompletion config={config} events={events} onChange={onChange}/>}</details>
   <details onToggle={e=>{if(e.currentTarget.open)setAgronomyOpened(true);}}><summary>Comparer des scénarios ou ajouter des observations de terrain</summary>{agronomyOpened&&<AgronomicPanel config={config} events={events} onChange={onChange}/>}</details>

   {usable&&<div className="qs-model-note"><p>Surface utilisée pour ce bilan : <b>{fmt(overview.areaM2===null?null:overview.areaM2/10000,3)} ha</b> ({fmt(overview.areaM2)} m²).</p><p><b>{indicator.percent} % des besoins couverts si le plan est réalisé.</b> Consommation simulée après les arrosages proposés ; ce n’est ni un constat d’arrosage, ni une note de qualité de la récolte.</p>{overview.recorded.count>0&&<p>Apports déjà enregistrés : {fmt(overview.recorded.fieldM3)} m³ au champ, séparés des volumes proposés.</p>}</div>}
  </div></details>
  {usable&&plan.totals.unmetEtMm>1e-7&&<p className="qs-inline-warning">Une partie du besoin en eau reste non couverte. Consultez les contraintes dans le calendrier détaillé.</p>}
  {plan?.missing.length&&indicator.kind!=='assumptions'?<details className="qs-subtle-details qs-missing"><summary>Informations à vérifier ({plan.missing.length})</summary><ul>{plan.missing.map((m,i)=><li key={i}>{m}</li>)}</ul></details>:null}
  <footer className="qs-footer"><span>Scénario indicatif · à vérifier au champ. Mortalité et dégâts d’inondation non calculés.</span><button className="qs-text-button" onClick={()=>onAdvanced('suivi')}>Noter ce qui s’est passé au champ →</button></footer>
  </>}
 </div>;
}
