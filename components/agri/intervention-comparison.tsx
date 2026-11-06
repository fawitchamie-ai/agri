'use client';
import { HelpParagraph } from './help-dialog';
import {seasonalRequest} from '../../lib/seasonal/request';
import {useState,useEffect,useRef} from 'react';
import type {SeasonalConfig,WaterEvent} from '../../lib/seasonal/types';
import type {comparePlannedProducts} from '../../lib/seasonal/intervention-outcome';
const fmt=(n:number|null)=>n===null?'Inconnu':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
type Props={config:SeasonalConfig;events:WaterEvent[];scope?:'water'|'fertilizer';onOpenFertilizer?:()=>void};
export default function InterventionComparison({config,events,scope='water',onOpenFertilizer}:Props){
 const isFertilizer=scope==='fertilizer';
 const isMaize=config.cropProfile?.id==='maize';
 const [resultKey,setResultKey]=useState('');
 const [result,setResult]=useState<ReturnType<typeof comparePlannedProducts>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),key=JSON.stringify([config,events]);
 useEffect(()=>{controller.current?.abort();setResult(null);setError('');setBusy(false);return()=>controller.current?.abort();},[key]);
 async function compare(){controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');setResult(null);
  try{const data=await seasonalRequest<ReturnType<typeof comparePlannedProducts>>({action:'compare-interventions',config,events},request.signal);if(!data||!Array.isArray(data.scenarios))throw new Error('Réponse de comparaison invalide');if(controller.current===request&&!request.signal.aborted){setResultKey(key);setResult(data);}}
  catch(e){if(controller.current===request&&!request.signal.aborted)setError((e as Error).message);}
  finally{if(controller.current===request&&!request.signal.aborted)setBusy(false);}
 }
 return <details className={isFertilizer?'fertilizer-comparison':''}>
  <summary>{isFertilizer?'Comparer les apports prévus':'Comparer les interventions'}</summary>
  {isFertilizer
   ?<div className="fertilizer-comparison-note">
     <p>Ce tableau compare les quantités d’azote prévues. Les apports déjà réalisés restent inclus.</p>
     <p><strong>{config.growth?'Le rendement est simulé par le profil de croissance intégré, sans validation locale.':'Il ne calcule pas l’effet sur le rendement.'}</strong> {isMaize?<>Pour le maïs, ouvre la simulation exploratoire dans « Effet sur le rendement ».</>:<>La simulation exploratoire est actuellement disponible pour le maïs seulement.</>}</p>
    </div>
   :<HelpParagraph>Les apports réalisés sont conservés. Les masses apportées sont calculables ; leur effet sur le rendement exige un modèle local qualifié.</HelpParagraph>}
  <button className="btn secondary" disabled={busy} onClick={compare}>{busy?'Calcul serveur en cours…':'Comparer les scénarios'}</button>
  {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}
  {result&&resultKey===key&&<>
   <div className="table-wrap"><table className="data-table">
    <thead><tr><th>Scénario</th><th>N total apporté (kg/ha)</th><th>{config.growth?'Rendement intégré simulé':'Réponse du rendement aux engrais'}</th></tr></thead>
    <tbody>{result.scenarios.map(s=><tr key={s.id}><td>{s.label}</td><td>{fmt(s.totalNitrogenKgHa)}</td><td>{s.integrated?`${fmt(s.integrated.yieldKgHa/1000)} t/ha · exploratoire`:isFertilizer?'Non évalué ici':'Non calculée'}</td></tr>)}</tbody>
   </table></div>
   {isFertilizer&&isMaize
    ?<button type="button" className="btn secondary fertilizer-comparison-next" disabled={!onOpenFertilizer} onClick={onOpenFertilizer}>Voir la simulation exploratoire du maïs</button>
    :<HelpParagraph>Le N total inclut les formes minérales et organiques ; il n’est pas entièrement disponible pendant le cycle. Aucun apport optimal n’est recommandé sans objectif, coûts et contraintes documentés.</HelpParagraph>}
  </>}
 </details>;
}
