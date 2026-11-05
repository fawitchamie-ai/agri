'use client';
import { HelpParagraph } from './help-dialog';
import {useState} from 'react';
import {createTrialLayout,parseFieldTrials,summarizeTrial,type FieldTrial,type TrialPlot} from '../../lib/seasonal/field-trials';
import {geometryIdentity} from '../../lib/seasonal/provenance';
import type {SeasonalConfig} from '../../lib/seasonal/types';
const fmt=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');

export default function FieldTrials({config,onChange}:{config:SeasonalConfig;onChange:(c:SeasonalConfig)=>void}){
 const [open,setOpen]=useState(false),[error,setError]=useState(''),[blocks,setBlocks]=useState(''),[usual,setUsual]=useState(false);
 const [text,setText]=useState({question:'',control:'',alternative:'',usual:'',protocol:'',buffers:'',review:''});
 function create(e:React.FormEvent){e.preventDefault();setError('');try{
  if(!config.parcelGeometry||!config.cropProfile)throw new Error('Choisissez une parcelle et une culture avant l’essai.');
  const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;
  const trial:FieldTrial={version:'field-trial-1',id:newId(),geometryId:geometryIdentity(config.parcelGeometry),cropId:config.cropProfile.id,createdOn:config.asOfDate,
   question:text.question,protocol:text.protocol,buffers:text.buffers,agronomicReview:text.review||null,assignment:'randomized',seed,
   arms:{control:text.control,alternative:text.alternative,...(usual?{usual:text.usual}:{})},plots:createTrialLayout(Number(blocks),usual,seed)};
  const fieldTrials=parseFieldTrials([...(config.fieldTrials??[]),trial],config);onChange({...config,fieldTrials});setOpen(false);
 }catch(e){setError((e as Error).message);}}
 return <details className="qs-card"><summary>Essai volontaire dans mon champ · facultatif</summary>
  <HelpParagraph>Préparez le protocole avant les apports. Avec un agronome, choisissez des blocs comparables, le nombre de répétitions et les surfaces selon l’hétérogénéité et la précision recherchée. Le tirage attribue les options au hasard dans chaque bloc ; il doit être suivi sur le terrain et ne constitue pas une preuve de réalisation.</HelpParagraph>
  <HelpParagraph>Le témoin est sans le complément étudié ; conservez les autres facteurs comparables et décrivez l’historique de fertilisation. Ne créez pas de surdose pour cet essai. Les observations restent déclarées et n’entraînent aucun modèle automatiquement.</HelpParagraph>
  {(config.fieldTrials??[]).map(t=><TrialEditor key={t.id} trial={t} config={config} onChange={onChange}/>)}
  <button className="btn secondary" disabled={!config.parcelGeometry||!config.cropProfile} onClick={()=>setOpen(!open)}>{open?'Fermer la préparation':'Préparer un essai'}</button>
  {open&&<form onSubmit={create}><div className="form-grid">{Object.entries({question:'Complément et question étudiés',control:'Témoin : conduite sans le complément étudié',alternative:'Alternative : produit, dose et calendrier justifiés',...(usual?{usual:'Pratique habituelle : produit, dose et calendrier'}:{}),protocol:'Protocole : variété, historique, conduite identique, surfaces et précision recherchée',buffers:'Zones tampons et prévention des transferts entre unités',review:'Référence de revue agronomique (facultatif)'}).map(([key,label])=><label className="field" key={key}><span>{label}</span><textarea required={key!=='review'} maxLength={key==='protocol'?4000:1200} value={text[key as keyof typeof text]} onChange={e=>setText({...text,[key]:e.target.value})}/></label>)}
   <label className="field"><span>Nombre de blocs défini avec l’expérimentateur</span><input type="number" required min="1" max="50" step="1" value={blocks} onChange={e=>setBlocks(e.target.value)}/></label></div>
   <label><input type="checkbox" checked={usual} onChange={e=>setUsual(e.target.checked)}/> Ajouter un bras « pratique habituelle » distinct du témoin.</label><HelpParagraph>Un seul bloc ne permet pas d’évaluer la variabilité entre blocs. Aucun nombre affiché ici n’est une recommandation de dimensionnement.</HelpParagraph><button className="btn secondary" type="submit">Créer le tirage et l’ajouter à ma campagne</button></form>}
  {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}<HelpParagraph>Utilisez « Enregistrer » pour conserver l’essai et ses révisions avec la campagne. Aucune observation de terrain n’est créée par le tirage.</HelpParagraph>
 </details>;
}

function TrialEditor({trial,config,onChange}:{trial:FieldTrial;config:SeasonalConfig;onChange:(c:SeasonalConfig)=>void}){
 const initial=Object.fromEntries(trial.plots.map(p=>[p.id,{area:p.areaM2?.toString()??'',kg:p.harvest?.kg.toString()??'',moisture:p.harvest?.moisturePercent.toString()??'',date:p.harvest?.date??config.asOfDate,source:p.harvest?.source??'',applications:JSON.stringify(p.applications,null,2)}]));
 const [draft,setDraft]=useState(initial),[reason,setReason]=useState(''),[error,setError]=useState('');
 const summary=summarizeTrial(trial);
 function apply(){setError('');try{
  const plots:TrialPlot[]=trial.plots.map(p=>{const d=draft[p.id];if(d.kg!==''&&(d.moisture===''||!d.source.trim()))throw new Error('Humidité et source de pesée requises pour chaque récolte.');return {...p,areaM2:d.area===''?null:Number(d.area),applications:JSON.parse(d.applications),harvest:d.kg===''?null:{kg:Number(d.kg),moisturePercent:Number(d.moisture),date:d.date,source:d.source}};});
  const next={...trial,plots,...(reason.trim()?{correction:{id:newId(),reason:reason.trim()}}:{})};
  const fieldTrials=parseFieldTrials(config.fieldTrials!.map(t=>t.id===trial.id?next:t),config);onChange({...config,fieldTrials});
 }catch(e){setError((e as Error).message);}}
 return <details><summary>{trial.question} · {summary.completeBlocks} bloc(s) récolté(s)</summary>
  <HelpParagraph>Tirage du {trial.createdOn}. Protocole : {trial.protocol}. Zones tampons : {trial.buffers}. {trial.agronomicReview?`Revue déclarée : ${trial.agronomicReview}`:'Revue agronomique à organiser.'}</HelpParagraph>
  <HelpParagraph>Témoin : {trial.arms.control}. Alternative : {trial.arms.alternative}. {trial.arms.usual&&`Pratique habituelle : ${trial.arms.usual}.`}</HelpParagraph>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>Position tirée</th><th>Option</th><th>Surface nette récoltée (m²)</th><th>Masse récoltée (kg)</th><th>Humidité (%)</th><th>Date</th><th>Source de pesée et d’humidité</th></tr></thead><tbody>{trial.plots.map(p=><tr key={p.id}><td>{p.block} · position {p.position}</td><td>{({control:'Témoin',usual:'Habituelle',alternative:'Alternative'})[p.arm]}</td>{(['area','kg','moisture','date','source'] as const).map(k=><td key={k}><input aria-label={`${p.id} ${k}`} type={k==='date'?'date':k==='source'?'text':'number'} min={k==='area'?'.001':k==='kg'||k==='moisture'?'0':undefined} step="any" value={draft[p.id][k]} onChange={e=>setDraft({...draft,[p.id]:{...draft[p.id],[k]:e.target.value}})}/></td>)}</tr>)}</tbody></table></div>
  <details><summary>Enregistrer les produits, doses et dates réellement appliqués à chaque unité</summary><HelpParagraph>Liste JSON par unité : date, product, kgHa et source. Dose en kg de produit par hectare, pas en kg de nutriment. Conservez les analyses du produit dans la source.</HelpParagraph>{trial.plots.map(p=><label className="field" key={p.id}><span>{p.id} · {p.arm}</span><textarea rows={4} value={draft[p.id].applications} placeholder={'[{"date":"AAAA-MM-JJ","product":"Produit","kgHa":0,"source":"Étiquette et mesure"}]'} onChange={e=>setDraft({...draft,[p.id]:{...draft[p.id],applications:e.target.value}})}/></label>)}</details>
  <label className="field"><span>Motif si vous corrigez une observation déjà enregistrée</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="btn secondary" onClick={apply}>Appliquer les observations à ma campagne</button>{error&&<HelpParagraph role="alert">{error}</HelpParagraph>}
  {summary.contrasts.map(r=><HelpParagraph key={r.block+r.arm}>{r.block} · {r.arm==='usual'?'Pratique habituelle':'Alternative'} − témoin : {fmt(r.deltaDryKgHa/1000)} t de matière sèche/ha net récolté. Observation déclarée, contrôle qualité à réaliser.</HelpParagraph>)}
  {summary.limitations.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}
  {!trial.plots.some(p=>p.harvest||p.applications.length)&&<button className="btn secondary" onClick={()=>onChange({...config,fieldTrials:config.fieldTrials?.filter(t=>t.id!==trial.id)})}>Retirer cet essai préparé sans observation</button>}
 </details>;
}
