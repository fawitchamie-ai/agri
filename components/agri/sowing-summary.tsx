'use client';
import {useState,useEffect} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import {geometryIdentity} from '../../lib/seasonal/provenance';
import {SEED_REFERENCES,sowingCsv,type SowingInput,type SowingEstimate} from '../../lib/seasonal/sowing';
import EditableValue from './editable-value';
const fmt=(v:number|null|undefined,d=1)=>v==null?'À calculer':v.toLocaleString('fr-FR',{maximumFractionDigits:d});
export default function SowingSummary({config,plan,stale,onChange,areaLocked=false}:{config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;areaLocked?:boolean;onChange:(c:SeasonalConfig)=>void}){
 const noCycle=!config.stages.length;
 const [areaDraft,setAreaDraft]=useState<string|null>(null),[rateDraft,setRateDraft]=useState<string|null>(null);
 const [independent,setIndependent]=useState<{key:string;estimate:SowingEstimate;land:SeasonalConfig['landAssessment']}|null>(null),[seedError,setSeedError]=useState('');
 const seedKey=JSON.stringify([config.parcelGeometry,config.cropProfile?.id,config.sowingPlan,config.waterCondition,config.systemDomain,config.yieldEstimation,config.agronomic?.system,config.asOfDate,config.country]);
 useEffect(()=>{if(!noCycle||!config.parcelGeometry){setIndependent(null);return;}const controller=new AbortController();let alive=true;setIndependent(null);setSeedError('');const timer=setTimeout(async()=>{try{const response=await fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'sowing-plan',config})});const data=await response.json() as any;if(!response.ok)throw new Error(data.error||'Plan de semis indisponible.');if(alive)setIndependent({key:seedKey,estimate:data.sowingPlan,land:data.land});}catch(e){if(alive)setSeedError((e as Error).message);}},350);return()=>{alive=false;clearTimeout(timer);controller.abort();};},[noCycle,seedKey]);
 const scoped=independent?.key===seedKey?independent:null;
 const estimate=noCycle?scoped?.estimate:stale?undefined:plan?.sowingPlan,ref=SEED_REFERENCES[config.cropProfile?.id??''],input=config.sowingPlan;
 const area=input?.areaM2??estimate?.areaM2??config.landAssessment?.candidateAreaM2??null;
 const rate=input?.seedRateKgHa??estimate?.seedRateKgHa??ref?.defaultKgHa??null;
 const land=config.landAssessment??scoped?.land??(!stale?plan?.land:undefined);
 const declared=estimate?.areaBasis==='sown-declaration';
 function change(p:Partial<SowingInput>){onChange({...config,sowingPlan:{version:'sowing-input-1',geometryId:geometryIdentity(config.parcelGeometry),cropId:config.cropProfile?.id??'',areaM2:null,seedRateKgHa:null,source:'Dose de semis déclarée par l’utilisateur ; à adapter au lot et à la variété.',...input,...p}});}
 function exportPlan(){if(!estimate)return;const url=URL.createObjectURL(new Blob([sowingCsv(estimate)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mon-plan-de-semis.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="qs-card qs-sowing" aria-labelledby="sowing-title"><div className="qs-card-heading"><div><span className="qs-eyebrow">01 · PRÉPARER</span><h2 id="sowing-title">Mon semis</h2></div><span className="qs-tag">{estimate?.status==='indicative'?'Repère prérempli':'À compléter'}</span></div><div className="qs-sowing-grid">
  <EditableValue onEditChange={()=>setAreaDraft(null)} label={declared?'Surface semée déclarée':'Surface prévue'} value={<>{fmt(estimate?.areaM2==null?null:estimate.areaM2/10000,3)} <span>ha</span></>} hint={declared?'Déclaration conservée pour le calcul de récolte.':'Partie terrestre cartographiée, proposée pour ce scénario.'}>
   {declared||areaLocked?<p>{areaLocked?'Des observations sont déjà liées à cette surface. Créez une nouvelle campagne pour changer sa portée.':'Cette surface vient de votre déclaration de semis. Modifiez-la dans « Ma récolte ».'}</p>:<><label className="field"><span>Surface prévue (m²)</span><input autoFocus type="number" min="0" max={land?.candidateAreaM2??0} step="any" value={areaDraft??area??''} onChange={e=>{setAreaDraft(e.target.value);if(e.target.value!=='')change({areaM2:Number(e.target.value)});}}/></label><button type="button" className="qs-text-button" onClick={()=>{setAreaDraft(null);change({areaM2:null});}}>Reprendre toute la partie terrestre</button></>}
  </EditableValue>
  <EditableValue onEditChange={()=>setRateDraft(null)} label="Dose de semences" value={<>{fmt(estimate?.seedRateKgHa??ref?.defaultKgHa)} <span>kg/ha</span></>} hint={input?.seedRateKgHa!=null?'Dose modifiée par vous.':ref?`Repère régional · ${fmt(ref.rangeKgHa[0])} à ${fmt(ref.rangeKgHa[1])} kg/ha`:'Référence locale nécessaire.'}>
   <label className="field"><span>Dose (kg par hectare prévu)</span><input autoFocus type="number" min="0" max="10000" step="any" value={rateDraft??rate??''} onChange={e=>{setRateDraft(e.target.value);if(e.target.value!=='')change({seedRateKgHa:Number(e.target.value)});}}/></label><label className="field"><span>Source ou indication sur le sachet</span><input value={input?.source??''} placeholder="Variété et référence du fournisseur" onChange={e=>change({source:e.target.value})}/></label>{ref&&<button type="button" className="qs-text-button" onClick={()=>{setRateDraft(null);change({seedRateKgHa:null});}}>Reprendre le repère de la culture</button>}
  </EditableValue>
  <div className="qs-seed-total"><span>SEMENCES À PRÉVOIR</span><strong>{estimate?.seedKg==null?seedError?'Indisponible':stale||noCycle?'Calcul…':'À renseigner':<>{fmt(estimate.seedKg<1?estimate.seedKg*1000:estimate.seedKg,2)} <small>{estimate.seedKg<1?'g':'kg'}</small></>}</strong><p>{estimate?.seedKg!=null?`${fmt(estimate.areaM2! /10000,3)} ha × ${fmt(estimate.seedRateKgHa)} kg/ha`:'La quantité apparaît dès que la surface et la dose sont disponibles.'}</p></div>
 </div><p className="qs-one-line-note">Quantité indicative à adapter à votre variété et au lot de semences. Le crayon permet de la modifier.</p>
 {seedError&&<p className="qs-inline-warning" role="alert">{seedError}</p>}
 {estimate?.missing.length? <p className="qs-inline-warning" role="status">{estimate.missing[0]}</p>:null}
 <details className="qs-subtle-details"><summary>Source du repère et détail du calcul</summary>{estimate?.reference&&<><p><a href={estimate.reference.url} target="_blank" rel="noreferrer">{estimate.reference.title} ↗</a></p><p>{estimate.reference.context}</p></>}{estimate?.rangeKg&&<p>La plage de référence donne {fmt(estimate.rangeKg[0],2)} à {fmt(estimate.rangeKg[1],2)} kg sur cette surface. Elle ne représente pas un intervalle de confiance.</p>}{estimate?.limits.map(s=><p key={s}>{s}</p>)}{estimate&&<button type="button" className="btn secondary small" onClick={exportPlan}>Exporter le plan de semis</button>}</details>
 </section>;
}
