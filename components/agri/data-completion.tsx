'use client';
import {useEffect,useRef,useState} from 'react';
import type {SeasonalConfig,WaterEvent} from '../../lib/seasonal/types';

export default function DataCompletion({config,events,onChange}:{config:SeasonalConfig;events:WaterEvent[];onChange:(c:SeasonalConfig)=>void}){
 const [audit,setAudit]=useState<any>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=JSON.stringify([config,events]),latest=useRef(key);latest.current=key;
 async function call(action:string,extra:Record<string,unknown>={},signal?:AbortSignal){
  const response=await fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({action,config,events,...extra})});
  const d=await response.json() as any;if(!response.ok)throw new Error(d.error??'Service indisponible');return d;
 }
 useEffect(()=>{
  setAudit(undefined);setError('');const ctrl=new AbortController();let alive=true;
  const t=setTimeout(()=>call('data-readiness',{},ctrl.signal).then(d=>{if(alive)setAudit(d);}).catch(e=>{if(alive)setError(e.message);}),600);
  return()=>{alive=false;clearTimeout(t);ctrl.abort();};
 },[key]);
 const today=new Date().toISOString().slice(0,10),end=config.asOfDate<today?config.asOfDate:today;
 const cycleEnd=new Date(Date.parse(config.sowingDate)+(config.stages.reduce((n,s)=>n+s.days,0)-1)*86400000).toISOString().slice(0,10);
 const [parameters,setParameters]=useState({ecDsM:'',depthM:'',source:'',noOtherLimitation:false,rootzoneSeasonAverage:false,product:'grain',availableOn:config.asOfDate});
 const savedSalinity=JSON.stringify(config.salinity),parcelScope=JSON.stringify(config.parcelGeometry??null);
 useEffect(()=>{setParameters(config.salinity?{...config.salinity,ecDsM:String(config.salinity.ecDsM),depthM:String(config.salinity.depthM)}:{ecDsM:'',depthM:'',source:'',noOtherLimitation:false,rootzoneSeasonAverage:false,product:'grain',availableOn:config.asOfDate});},[savedSalinity,parcelScope]);
 async function acquire(){
  const requested=key;setBusy(true);setError('');
  try{const d=await call('nasa-history',{start:config.sowingDate,end:cycleEnd<end?cycleEnd:end});if(latest.current===requested)onChange(d.config);}
  catch(e){if(latest.current===requested)setError((e as Error).message);}finally{setBusy(false);}
 }
 async function simulateSalinity(){
  const requested=key;setBusy(true);setError('');
  try{const d=await call('salinity-scenario',{parameters:{...parameters,ecDsM:Number(parameters.ecDsM),depthM:Number(parameters.depthM),method:'saturated_paste_25C',period:{from:config.sowingDate,to:cycleEnd}}});if(latest.current===requested)onChange(d.config);}
  catch(e){if(latest.current===requested)setError((e as Error).message);}finally{setBusy(false);}
 }
 function download(){
  const u=URL.createObjectURL(new Blob([JSON.stringify({audit,salinityParameters:config.salinity},null,2)],{type:'application/json'}));
  const el=document.createElement('a');el.href=u;el.download='donnees-et-manques-parcelle.json';el.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 const result=audit?.salinity;
 return <section className="qs-card">
  <h2>Données disponibles et calculs complémentaires</h2>
  <p>Les données historiques de maille complètent les sources existantes. Elles ne constituent pas une mesure de votre champ ni une prévision de la saison future.</p>
  <details><summary>Compléter l’historique météo avec NASA POWER</summary>
   <p>Pluie, températures minimale/maximale, humidité, vent à 2 m et rayonnement. ET0 calculée avec Penman–Monteith FAO56. Les valeurs locales mesurées et les valeurs manuellement modifiées sont conservées.</p>
   <button className="btn secondary" disabled={busy||config.sowingDate>end||config.asOfDate!==today} onClick={acquire}>Récupérer les jours passés du cycle</button>
   <p>Les jours récents peuvent manquer. Aucune donnée future n’est créée. Enregistrez la campagne pour conserver l’acquisition et sa provenance.</p>
  </details>
  <details><summary>Scénario de salinité isolée · FAO56</summary>
   <p>Calcul séparé du déficit d’eau, pour une unité homogène. Nécessite un Ym indépendant sans stress salin/hydrique, une ECe représentative du cycle et de toute la racine, et des autres facteurs non limitants. Aucune mesure de surface ou EC 1:5 n’est convertie automatiquement.</p>
   <p>Courbes disponibles : maïs et sorgho (grain), soja, arachide et niébé (seed), oignon (bulb). Les autres cultures restent indisponibles pour ce calcul.</p>
   <div className="form-grid">{(['ecDsM','depthM','source','product','availableOn'] as const).map(k=><label className="field" key={k}>
    <span>{({ecDsM:'ECe pâte saturée à 25 °C (dS/m)',depthM:'Profondeur représentée (m)',source:'Source / hypothèse représentative',product:'Produit FAO : grain, seed ou bulb',availableOn:'Donnée / hypothèse disponible depuis'})[k]}</span>
    <input disabled={busy} type={k==='availableOn'?'date':'text'} value={parameters[k]} onChange={e=>setParameters({...parameters,[k]:e.target.value})}/>
   </label>)}</div>
   <label><input type="checkbox" disabled={busy} checked={parameters.rootzoneSeasonAverage} onChange={e=>setParameters({...parameters,rootzoneSeasonAverage:e.target.checked})}/> ECe représentative du cycle du {config.sowingDate} au {cycleEnd} et de toute la zone racinaire (déclaration / hypothèse)</label>
   <label><input type="checkbox" disabled={busy} checked={parameters.noOtherLimitation} onChange={e=>setParameters({...parameters,noOtherLimitation:e.target.checked})}/> Autres facteurs non limitants, dont eau et nutrition, par hypothèse</label>
   <button className="btn secondary" disabled={busy||!parameters.ecDsM.trim()||!parameters.depthM.trim()||!parameters.source.trim()} onClick={simulateSalinity}>Appliquer et calculer ce scénario isolé</button>
   {config.salinity&&<button className="btn secondary" disabled={busy} onClick={()=>onChange({...config,salinity:undefined})}>Retirer ce scénario</button>}
   {result?.status==='conditional_unvalidated'&&<>
    <p>Dernier scénario appliqué : {(result.sownM2/10000).toLocaleString('fr-FR')} ha semés · {(result.yieldKgHaSown/1000).toLocaleString('fr-FR')} t/ha semé · {(result.productionKg/1000).toLocaleString('fr-FR')} t. Irrigation : eau supposée non limitante. Simulation conditionnelle non validée.</p>
    {result.limits.map((l:string)=><p key={l}>{l}</p>)}
    <p>Enregistrez la campagne pour conserver les paramètres et le résultat recalculé par le serveur dans sa révision et son export JSON.</p>
   </>}
   {result?.status==='unavailable'&&result.missing.map((l:string)=><p className="notice warning" key={l}>{l}</p>)}
  </details>
  <details><summary>Référence historique nationale · FAOSTAT</summary>
   {audit?.historicalNational?<>
    <p>Contexte national 2020–2024 par hectare récolté. Ces statistiques regroupent des exploitations et ne constituent pas un rendement potentiel de votre parcelle.</p>
    <p>{audit.historicalNational.product?.name} · {audit.historicalNational.product?.scope}</p>
    {audit.historicalNational.missing&&<p className="notice warning">{audit.historicalNational.missing}</p>}
    {!!audit.historicalNational.rows.length&&<table><thead><tr><th>Année</th><th>Surface récoltée (ha)</th><th>Production (t)</th><th>Rendement (t/ha récolté)</th></tr></thead><tbody>{audit.historicalNational.rows.map((r:any)=><tr key={r.year}><td>{r.year}{r.warnings.length?' · à vérifier':''}</td>{(['areaHa','productionT','yieldKgHaHarvested'] as const).map(k=><td key={k} title={r[k]?.note??''}>{r[k]?.value==null?'Non disponible':(r[k].value/(k==='yieldKgHaHarvested'?1000:1)).toLocaleString('fr-FR',{maximumFractionDigits:3})}{r[k]?.flag&&' ['+r[k].flag+']'}</td>)}</tr>)}</tbody></table>}
    <p>A : chiffre officiel · E : estimation · I : imputation · X : source externe · M : donnée manquante. Les flags et notes originales sont dans l’export.</p>
    {audit.historicalNational.rows.flatMap((r:any)=>r.warnings.map((w:string)=><p className="notice warning" key={r.year+w}>{r.year} : {w}</p>))}
    <p>Archive acquise le {audit.historicalNational.acquiredAt.slice(0,10)} · CC-BY-4.0 · aucune valeur de cette table n’est injectée automatiquement dans Ym.</p>
    <button className="btn secondary" onClick={download}>Exporter la référence et ses sources</button>
   </>:<p>Audit en cours…</p>}
  </details>
  <details><summary>Ce qui manque encore pour cette parcelle</summary>{audit?<>
   <p>{audit.country} · {audit.crop}. Rendement : {audit.yield.status==='conditional'?'simulation conditionnelle':'indisponible'}. La disponibilité cartographique n’établit pas la validité agronomique.</p>
   {[...new Set<string>(audit.yield.missing)].slice(0,6).map(m=><p className="notice warning" key={m}>{m}</p>)}
   {audit.remaining.map((r:any)=><div key={r.feature}><strong>{r.feature}</strong><ul>{r.required.map((x:string)=><li key={x}>{x}</li>)}</ul></div>)}
   <p>{audit.review}</p><ul>{audit.sources.map((s:any)=><li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : {s.role}{s.missing&&' — '+s.missing}</li>)}</ul>
   <button className="btn secondary" onClick={download}>Exporter les sources et la liste des manques</button>
  </>:<p>Audit en cours…</p>}</details>
  {busy&&<p role="status">Acquisition ou calcul en cours…</p>}{error&&<p className="notice warning" role="alert">{error}</p>}
 </section>;
}
