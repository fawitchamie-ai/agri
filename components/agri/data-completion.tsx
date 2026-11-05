'use client';
import { HelpParagraph } from './help-dialog';
import {seasonalRequest} from '../../lib/seasonal/request';
import {useEffect,useRef,useState} from 'react';
import type {SeasonalConfig,WaterEvent} from '../../lib/seasonal/types';

export default function DataCompletion({config,events,onChange}:{config:SeasonalConfig;events:WaterEvent[];onChange:(c:SeasonalConfig)=>void}){
 const [audit,setAudit]=useState<any>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=JSON.stringify([config,events]),latest=useRef(key);latest.current=key;
 async function call(action:string,extra:Record<string,unknown>={},signal?:AbortSignal){
  return seasonalRequest<any>({action,config,events,...extra},signal);
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
  <HelpParagraph>Les données historiques de maille complètent les sources existantes. Elles ne constituent pas une mesure de votre champ ni une prévision de la saison future.</HelpParagraph>
  <details><summary>Compléter l’historique météo avec NASA POWER</summary>
   <HelpParagraph>Pluie, températures minimale/maximale, humidité, vent à 2 m et rayonnement. ET0 calculée avec Penman–Monteith FAO56. Les valeurs locales mesurées et les valeurs manuellement modifiées sont conservées.</HelpParagraph>
   <button className="btn secondary" disabled={busy||config.sowingDate>end||config.asOfDate!==today} onClick={acquire}>Récupérer les jours passés du cycle</button>
   <HelpParagraph>Les jours récents peuvent manquer. Aucune donnée future n’est créée. Enregistrez la campagne pour conserver l’acquisition et sa provenance.</HelpParagraph>
  </details>
  <details><summary>Scénario de salinité isolée · FAO56</summary>
   <HelpParagraph>Calcul séparé du déficit d’eau, pour une unité homogène. Nécessite un Ym indépendant sans stress salin/hydrique, une ECe représentative du cycle et de toute la racine, et des autres facteurs non limitants. Aucune mesure de surface ou EC 1:5 n’est convertie automatiquement.</HelpParagraph>
   <HelpParagraph>Courbes disponibles : maïs et sorgho (grain), soja, arachide et niébé (seed), oignon (bulb). Les autres cultures restent indisponibles pour ce calcul.</HelpParagraph>
   <div className="form-grid">{(['ecDsM','depthM','source','product','availableOn'] as const).map(k=><label className="field" key={k}>
    <span>{({ecDsM:'ECe pâte saturée à 25 °C (dS/m)',depthM:'Profondeur représentée (m)',source:'Source / hypothèse représentative',product:'Produit FAO : grain, seed ou bulb',availableOn:'Donnée / hypothèse disponible depuis'})[k]}</span>
    <input disabled={busy} type={k==='availableOn'?'date':'text'} value={parameters[k]} onChange={e=>setParameters({...parameters,[k]:e.target.value})}/>
   </label>)}</div>
   <label><input type="checkbox" disabled={busy} checked={parameters.rootzoneSeasonAverage} onChange={e=>setParameters({...parameters,rootzoneSeasonAverage:e.target.checked})}/> ECe représentative du cycle du {config.sowingDate} au {cycleEnd} et de toute la zone racinaire (déclaration / hypothèse)</label>
   <label><input type="checkbox" disabled={busy} checked={parameters.noOtherLimitation} onChange={e=>setParameters({...parameters,noOtherLimitation:e.target.checked})}/> Autres facteurs non limitants, dont eau et nutrition, par hypothèse</label>
   <button className="btn secondary" disabled={busy||!parameters.ecDsM.trim()||!parameters.depthM.trim()||!parameters.source.trim()} onClick={simulateSalinity}>Appliquer et calculer ce scénario isolé</button>
   {config.salinity&&<button className="btn secondary" disabled={busy} onClick={()=>onChange({...config,salinity:undefined})}>Retirer ce scénario</button>}
   {result?.status==='conditional_unvalidated'&&<>
    <HelpParagraph>Dernier scénario appliqué : {(result.sownM2/10000).toLocaleString('fr-FR')} ha semés · {(result.yieldKgHaSown/1000).toLocaleString('fr-FR')} t/ha semé · {(result.productionKg/1000).toLocaleString('fr-FR')} t. Irrigation : eau supposée non limitante. Simulation conditionnelle non validée.</HelpParagraph>
    {result.limits.map((l:string)=><HelpParagraph key={l}>{l}</HelpParagraph>)}
    <HelpParagraph>Enregistrez la campagne pour conserver les paramètres et le résultat recalculé par le serveur dans sa révision et son export JSON.</HelpParagraph>
   </>}
   {result?.status==='unavailable'&&result.missing.map((l:string)=><HelpParagraph className="notice warning" key={l}>{l}</HelpParagraph>)}
  </details>
  <details><summary>Référence historique nationale · FAOSTAT</summary>
   {audit?.historicalNational?<>
    <HelpParagraph>Contexte national 2020–2024 par hectare récolté. Ces statistiques regroupent des exploitations et ne constituent pas un rendement potentiel de votre parcelle.</HelpParagraph>
    <HelpParagraph>{audit.historicalNational.product?.name} · {audit.historicalNational.product?.scope}</HelpParagraph>
    {audit.historicalNational.missing&&<HelpParagraph className="notice warning">{audit.historicalNational.missing}</HelpParagraph>}
    {!!audit.historicalNational.rows.length&&<table><thead><tr><th>Année</th><th>Surface récoltée (ha)</th><th>Production (t)</th><th>Rendement (t/ha récolté)</th></tr></thead><tbody>{audit.historicalNational.rows.map((r:any)=><tr key={r.year}><td>{r.year}{r.warnings.length?' · à vérifier':''}</td>{(['areaHa','productionT','yieldKgHaHarvested'] as const).map(k=><td key={k} title={r[k]?.note??''}>{r[k]?.value==null?'Non disponible':(r[k].value/(k==='yieldKgHaHarvested'?1000:1)).toLocaleString('fr-FR',{maximumFractionDigits:3})}{r[k]?.flag&&' ['+r[k].flag+']'}</td>)}</tr>)}</tbody></table>}
    <HelpParagraph>A : chiffre officiel · E : estimation · I : imputation · X : source externe · M : donnée manquante. Les flags et notes originales sont dans l’export.</HelpParagraph>
    {audit.historicalNational.rows.flatMap((r:any)=>r.warnings.map((w:string)=><HelpParagraph className="notice warning" key={r.year+w}>{r.year} : {w}</HelpParagraph>))}
    <HelpParagraph>Archive acquise le {audit.historicalNational.acquiredAt.slice(0,10)} · CC-BY-4.0 · aucune valeur de cette table n’est injectée automatiquement dans Ym.</HelpParagraph>
    <button className="btn secondary" onClick={download}>Exporter la référence et ses sources</button>
   </>:<HelpParagraph>Audit en cours…</HelpParagraph>}
  </details>
  <details><summary>Essais disponibles sur le sol et les engrais</summary>{audit?.experimentalEvidence?<>
   <HelpParagraph><strong>Aucun modèle sol–engrais n’est encore calibré pour votre parcelle.</strong> Voici les données réellement acquises pour préparer ce travail. Elles ne modifient pas votre rendement simulé.</HelpParagraph>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Pays</th><th>Parcelles × campagnes acquises</th><th>Sites d’essai</th><th>Fonctions externes OFRA</th></tr></thead><tbody>{audit.experimentalEvidence.coverage.map((r:any)=><tr key={r.country+r.crop}><td>{r.countryName} · {r.cropName}</td><td>{r.experimentalPlotSeasons.toLocaleString('fr-FR')}{r.experimentalPlotSeasons?' · recherche NC-SA':''}</td><td>{r.experimentalSites}</td><td>{r.externalFittedFunctions} · contexte</td></tr>)}</tbody></table></div>
   <HelpParagraph>Une parcelle suivie plusieurs années n’est pas autant de sites indépendants. Les historiques administratifs et les fonctions déjà ajustées ne sont pas des répétitions d’essai.</HelpParagraph>
   <HelpParagraph>Pilote de recherche retenu : maïs H507 à Gagnoa (Côte d’Ivoire), premier cycle {audit.experimentalEvidence.pilot.fromYear}–{audit.experimentalEvidence.pilot.toYear}, {audit.experimentalEvidence.pilot.plotSeasons} parcelles × campagnes. Les doses, surfaces et méthodes doivent encore être qualifiées. Les jeux CIRAD sont sous licence de recherche non commerciale.</HelpParagraph>
   <details><summary>Sources acquises, restrictions et données manquantes</summary>{audit.experimentalEvidence.sources.map((s:any)=><div key={s.id}><HelpParagraph><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.fileChecked?'Fichier contrôlé':s.fileAcquired?'Fichier acquis':'Notice / accès à qualifier'} · {s.licence}</HelpParagraph>{s.missing.slice(0,3).map((m:string)=><HelpParagraph key={m}>{m}</HelpParagraph>)}</div>)}<HelpParagraph>Inventaire vérifié le {audit.experimentalEvidence.checkedOn}. Les cartes de Kara restent des classes sur 0–20 cm ; aucun milieu de classe n’est ajouté comme analyse de sol.</HelpParagraph></details>
   <button className="btn secondary" onClick={download}>Exporter l’inventaire et les données manquantes</button>
  </>:<HelpParagraph>Inventaire en cours de chargement…</HelpParagraph>}</details>
  <details><summary>Ce qui manque encore pour cette parcelle</summary>{audit?<>
   <HelpParagraph>{audit.country} · {audit.crop}. Rendement : {audit.yield.status==='conditional'?'simulation conditionnelle':'indisponible'}. La disponibilité cartographique n’établit pas la validité agronomique.</HelpParagraph>
   {[...new Set<string>(audit.yield.missing)].slice(0,6).map(m=><HelpParagraph className="notice warning" key={m}>{m}</HelpParagraph>)}
   {audit.remaining.map((r:any)=><div key={r.feature}><strong>{r.feature}</strong><ul>{r.required.map((x:string)=><li key={x}>{x}</li>)}</ul></div>)}
   <HelpParagraph>{audit.review}</HelpParagraph><ul>{audit.sources.map((s:any)=><li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : {s.role}{s.missing&&' — '+s.missing}</li>)}</ul>
   <button className="btn secondary" onClick={download}>Exporter les sources et la liste des manques</button>
  </>:<HelpParagraph>Audit en cours…</HelpParagraph>}</details>
  {busy&&<HelpParagraph role="status">Acquisition ou calcul en cours…</HelpParagraph>}{error&&<HelpParagraph className="notice warning" role="alert">{error}</HelpParagraph>}
 </section>;
}
