'use client';
import {useState} from 'react';
import {HelpParagraph} from './help-dialog';
import {CANOPY_NOWCAST_PROFILE,canopyNowcastScope,type CanopyNowcastInput} from '../../lib/seasonal/canopy-nowcast';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
const fmt=(v:number|null,d=2)=>v===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
/** A separate crop-state estimate; changing irrigation cannot be mislabeled as
 * an observed causal yield effect in this empirical model. */
export default function CanopyNowcastPanel({config:c,plan,stale,onChange,open,onOpenChange}:{config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;open?:boolean;onOpenChange?:(open:boolean)=>void}){
 const [date,setDate]=useState(c.asOfDate),[samples,setSamples]=useState(['','','','']),[source,setSource]=useState(''),[accepted,setAccepted]=useState(false),[error,setError]=useState('');
 const [stage,setStage]=useState<'vegetative'|'flowering'>('vegetative');
 const value=c.canopyNowcast,result=stale?undefined:plan?.canopyNowcast,p=CANOPY_NOWCAST_PROFILE;
 if(!value&&(c.country!=='GHA'||c.cropProfile?.id!=='maize'))return null;
 function add(){try{
  const ns=samples.filter(s=>s.trim()!=='').map(Number);
  if(ns.length<3||ns.some(n=>!Number.isFinite(n)||n<0||n>10)||!source.trim())throw new Error('Renseignez au moins trois mesures de LAI vert et leur source.');
  if(!accepted&&!value)throw new Error('Acceptez l’hypothèse expérimentale pour ce suivi.');
  const v:CanopyNowcastInput=value??{version:'canopy-nowcast-1',acceptedHypothesis:true,scope:canopyNowcastScope(c),monitoringStart:date,initialStage:stage,observations:[]};
  if(v.observations.some(o=>o.date===date))throw new Error('Une visite existe déjà à cette date.');
  onChange({...c,canopyNowcast:{...v,observations:[...v.observations,{date,availableOn:date,laiSamples:ns,method:'field-green-lai',source:source.trim()}]}});setSamples(['','','','']);setError('');
 }catch(e){setError((e as Error).message);}}
 return <section className="qs-card" id="canopy-nowcast-panel" aria-label="Estimation expérimentale par observation du couvert"><details open={open??!!value} onToggle={e=>onOpenChange?.(e.currentTarget.open)}>
 <summary>Suivi de la culture par mesures de LAI · Ghana nord</summary>
 <HelpParagraph>Après deux semaines d’observations du couvert, ce suivi donne une estimation de grain pour le maïs du nord du Ghana. Ce n’est pas une prévision au moment où vous dessinez la parcelle. Son transfert à une autre saison reste une hypothèse ; il ne calcule pas l’effet d’un arrosage ou d’un engrais.</HelpParagraph>
 {result?.status==='experimental_nowcast'&&<><div className="qs-kpis"><article><span>GRAIN ESTIMÉ PAR LE COUVERT</span><strong>{fmt(result.yieldKgHa===null?null:result.yieldKgHa/1000)}<small> t/ha</small></strong></article><article><span>PRODUCTION SUR LA SURFACE DÉCLARÉE</span><strong>{fmt(result.productionKg===null?null:result.productionKg/1000)}<small> tonnes</small></strong></article></div><HelpParagraph>Humidité de référence non précisée dans le jeu d’apprentissage. LAI maximal moyen : {fmt(result.peakLai)} m²/m² ; {result.inputVisits} visites utilisées jusqu’au {result.issueDate}.</HelpParagraph>
 <HelpParagraph>RMSE sur {p.test.canopy.nFields} champs réservés : {fmt(p.test.canopy.rmseKgHa/1000)} t/ha, contre {fmt(p.test.constant.rmseKgHa/1000)} t/ha pour la moyenne d’apprentissage. La plage nominale à 90 % n’a couvert que {fmt(p.test.coverage90*100,0)} % de ces champs ; elle n’est pas un intervalle validé pour votre récolte.</HelpParagraph></>}
 {value&&stale&&<HelpParagraph>Recalcul du suivi en cours.</HelpParagraph>}
 {result?.missing.map(s=><HelpParagraph key={s}>{s}</HelpParagraph>)}
 <div className="form-grid"><label className="field"><span>Date de la visite</span><input type="date" min={c.sowingDate} max={c.asOfDate} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field"><span>Instrument, méthode et observateur</span><input value={source} maxLength={600} onChange={e=>setSource(e.target.value)} placeholder="Mesure du LAI vert au champ"/></label></div>
 <HelpParagraph>Le LAI est la surface de feuilles vertes par m² de sol, mesurée en plusieurs points représentatifs. Une valeur NDVI ou une appréciation visuelle ne la remplace pas. Commencez en phase végétative ou à la floraison.</HelpParagraph>
 {!value&&<label className="field"><span>Stade au début du suivi</span><select value={stage} onChange={e=>setStage(e.target.value as 'vegetative'|'flowering')}><option value="vegetative">Végétation</option><option value="flowering">Floraison</option></select></label>}
 <div className="form-grid">{samples.map((v,i)=><label className="field" key={i}><span>LAI du point {i+1} (m²/m²)</span><input type="number" step="any" min="0" max="10" value={v} onChange={e=>setSamples(samples.map((x,j)=>i===j?e.target.value:x))}/></label>)}</div>
 {!value&&<label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> J’accepte cette hypothèse locale expérimentale, limitée au maïs suivi dans la zone étudiée.</label>}
 <button className="btn secondary" type="button" onClick={add}>Enregistrer la visite de LAI</button>
 {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}
 {value&&<><p>{value.observations.length} visites enregistrées depuis le {value.monitoringStart}.</p><button className="btn secondary" type="button" onClick={()=>onChange({...c,canopyNowcast:undefined})}>Retirer ce suivi expérimental</button></>}
 <details><summary>Domaine et limites</summary><HelpParagraph>Profil {p.id} · Nord du Ghana, autour de Tamale · source <a href="https://doi.org/10.5281/zenodo.6632083" target="_blank" rel="noreferrer">Gomez-Dans et al.</a> · plage de LAI d’apprentissage {fmt(p.laiRange[0])}–{fmt(p.laiRange[1])}. Aucune activation pour les cinq autres pays.</HelpParagraph>{result?.limits.map(s=><HelpParagraph key={s}>{s}</HelpParagraph>)}</details>
 </details></section>;
}
