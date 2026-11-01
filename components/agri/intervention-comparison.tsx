'use client';
import {useState,useEffect,useRef} from 'react';
import type {SeasonalConfig,WaterEvent} from '../../lib/seasonal/types';
import type {comparePlannedProducts} from '../../lib/seasonal/intervention-outcome';
const fmt=(n:number|null)=>n===null?'Inconnu':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
export default function InterventionComparison({config,events}:{config:SeasonalConfig;events:WaterEvent[]}){
 const [resultKey,setResultKey]=useState('');
 const [result,setResult]=useState<ReturnType<typeof comparePlannedProducts>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),key=JSON.stringify([config,events]);
 useEffect(()=>{controller.current?.abort();setResult(null);setError('');setBusy(false);return()=>controller.current?.abort();},[key]);
 async function compare(){controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');setResult(null);
  try{const response=await fetch('/api/seasonal',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,body:JSON.stringify({action:'compare-interventions',config,events})});const data=await response.json() as ReturnType<typeof comparePlannedProducts>&{error?:string};if(!response.ok)throw new Error(data.error??'Comparaison indisponible');if(!data||!Array.isArray(data.scenarios))throw new Error('Réponse de comparaison invalide');if(controller.current===request&&!request.signal.aborted){setResultKey(key);setResult(data);}}
  catch(e){if(controller.current===request&&!request.signal.aborted)setError((e as Error).message);}
  finally{if(controller.current===request&&!request.signal.aborted)setBusy(false);}
 }
 return <details><summary>Comparer mes apports prévus</summary><p>Les apports réalisés sont conservés. Les masses apportées sont calculables ; leur effet sur le rendement exige un modèle local qualifié.</p><button className="btn secondary" disabled={busy} onClick={compare}>{busy?'Calcul serveur en cours…':'Comparer les scénarios'}</button>{error&&<p role="alert">{error}</p>}{result&&resultKey===key&&<><div className="table-wrap"><table className="data-table"><thead><tr><th>Scénario</th><th>N total apporté (kg/ha)</th><th>Réponse du rendement aux engrais</th></tr></thead><tbody>{result.scenarios.map(s=><tr key={s.id}><td>{s.label}</td><td>{fmt(s.totalNitrogenKgHa)}</td><td>Non calculée</td></tr>)}</tbody></table></div><p>Le N total inclut les formes minérales et organiques ; il n’est pas entièrement disponible pendant le cycle. Aucun apport optimal n’est recommandé sans objectif, coûts et contraintes documentés.</p></>}</details>;
}
