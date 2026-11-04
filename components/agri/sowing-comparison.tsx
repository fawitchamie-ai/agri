'use client';
import {useEffect,useRef,useState} from 'react';
import type {SeasonalConfig,WaterEvent,WeatherDay} from '../../lib/seasonal/types';
import type {Environment} from '../../lib/seasonal/environment';
import {compareSowingDates,comparisonWeatherRequests,sowingComparisonBlock,type SowingComparisonRow} from '../../lib/seasonal/sowing-comparison';
import {seasonalRequest} from '../../lib/seasonal/request';
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
const date=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
export default function SowingComparison({config,events}:{config:SeasonalConfig;events:WaterEvent[]}){
 const [rows,setRows]=useState<SowingComparisonRow[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState('');
 const controller=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>{sequence.current++;controller.current?.abort();setRows([]);setError('');setBusy(false);return()=>{sequence.current++;controller.current?.abort();};},[config,events]);
 const today=new Date().toISOString().slice(0,10),block=sowingComparisonBlock(config,events,today);
 async function compare(){controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++sequence.current;setRows([]);setError('');setBusy(true);
  try{const incoming:WeatherDay[]=[];
   for(const request of comparisonWeatherRequests(config)){
    const e=await seasonalRequest<Environment>({action:'environment',geometry:config.parcelGeometry,country:config.country,...request},abort.signal);
    incoming.push(...e.weather);
   }
   const result=compareSowingDates(config,events,incoming,today);
   if(id===sequence.current&&!abort.signal.aborted){setRows(result);setIssued(today);}
  }catch(e){if(id===sequence.current&&!abort.signal.aborted)setError((e as Error).message);}finally{if(id===sequence.current)setBusy(false);}
 }
 return <section className="card" aria-label="Comparer mes dates de semis"><h2>Et si je semais plus tard ?</h2>
  <p>Cette étape est facultative. Votre date actuelle est le <strong>{date(config.sowingDate)}</strong>. Un clic compare cette date, puis 7 et 14 jours plus tard.</p>
  <p>Vous n’avez aucun besoin NPK ni rendement à renseigner ici. L’application cherche la météo manquante jusqu’à la fin des trois cycles.</p>
  {block&&<p className="notice info">{block}</p>}
  <button className="btn primary" disabled={busy||!!block} onClick={compare}>{busy?'Chargement de la météo et comparaison…':'Actualiser la météo et comparer les trois dates'}</button>
  {busy&&<p role="status">La comparaison est en cours. Votre campagne et votre date de semis restent conservées.</p>}
  {error&&<p className="notice warning" role="alert">{error} Réessayez ; votre campagne est conservée.</p>}
  {!!rows.length&&<><h3>Comment lire le résultat</h3><p>Les millimètres représentent le besoin en eau sur tout le cycle. Les m³ représentent le prélèvement simulé à la source avec vos contraintes d’arrosage. Un plus petit volume ne prouve pas une meilleure récolte.</p>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Date du semis</th><th>Fin du cycle</th><th>Besoin sur le cycle (mm)</th><th>Eau à la source (m³)</th><th>Résultat</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><td>{date(r.date)}</td><td>{date(r.end)}</td><td>{fmt(r.demandMm)}</td><td>{fmt(r.sourceM3)}</td><td>{r.complete?'Bilan complet':<>Comparaison impossible : données à compléter.<details><summary>Voir ce qui manque</summary>{r.missing.map(m=><p key={m}>{m}</p>)}</details></>}</td></tr>)}</tbody></table></div>
   {rows.some(r=>!r.complete)&&<p className="notice info">Une date n’a pas de résultat complet. Ses totaux restent masqués ; aucune meilleure date n’est annoncée.</p>}
   <details><summary>Données et hypothèses de cette comparaison</summary><p>Données disponibles au {date(issued)}. {rows.some(r=>r.historicalScenario)?'Une partie de la météo est un scénario historique ou une hypothèse explicite, pas une prévision saisonnière.':''}</p><p>Le même état initial du sol est supposé pour chaque date. Vos arrosages prévus sont décalés avec le semis ; les limites d’accès à l’eau restent attachées à leurs dates réelles. Aucun apport réalisé n’est transféré et aucun calendrier n’est enregistré par cette comparaison.</p><p>Le calendrier local, la variété et les conditions de levée restent à vérifier avant de changer réellement la date de semis. Cette comparaison hydrique ne classe pas le rendement agricole.</p></details>
  </>}
 </section>;
}
