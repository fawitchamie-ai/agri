'use client';
import { HelpParagraph } from './help-dialog';
import {useEffect,useRef,useState} from 'react';
import type {SeasonalConfig,WaterEvent,WeatherDay} from '../../lib/seasonal/types';
import type {Environment} from '../../lib/seasonal/environment';
import {compareSowingDates,comparisonWeatherRequests,sowingComparisonBlock,sowingRainfallWindow,type SowingComparisonRow} from '../../lib/seasonal/sowing-comparison';
import {seasonalRequest} from '../../lib/seasonal/request';
import {addDays} from '../../lib/seasonal/validation';
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
const date=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
function DemandComparison({rows}:{rows:SowingComparisonRow[]}){
 const valid=rows.filter(r=>r.complete&&r.demandMm!==null&&Number.isFinite(r.demandMm)&&r.demandMm>=0);
 if(!valid.length)return null;
 const max=Math.max(...valid.map(r=>r.demandMm??0),1);
 return <figure aria-label="Comparaison des besoins en eau simulés par date de semis" style={{margin:'24px 0',padding:'20px',border:'1px solid #d7e3f1',borderRadius:12,background:'#f5f9ff'}}>
  <figcaption><strong>Besoins en eau sur le cycle</strong><p>Plus la barre est longue, plus le besoin simulé est élevé. Cela ne classe pas les récoltes.</p></figcaption>
  <div style={{display:'grid',gap:16}}>{rows.map(r=>{const value=r.complete&&r.demandMm!==null&&Number.isFinite(r.demandMm)&&r.demandMm>=0?r.demandMm:null;return <div key={r.date}>
   <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><span>{date(r.date)}</span><strong>{value===null?'Données incomplètes':`${fmt(value)} mm`}</strong></div>
   {value!==null&&<div aria-hidden="true" style={{height:10,background:'#e0eaf5',borderRadius:8,marginTop:6}}><div style={{height:'100%',width:`${value/max*100}%`,background:'#2163b4',borderRadius:8}}/></div>}
  </div>})}</div>
 </figure>;
}
function rainfallStatus(status:WeatherDay['status']){
 return status==='observed'?'Mesure enregistrée':status==='estimated'?'Réanalyse estimée':status==='forecast'?'Prévision météo':'Scénario historique';
}
function RainfallTimeline({days,plannedDate}:{days:WeatherDay[];plannedDate:string}){
 const known=days.filter(d=>d.rainMm!==null&&Number.isFinite(d.rainMm)),max=Math.max(1,...known.map(d=>d.rainMm??0)),width=720,height=164,left=12,top=16,plotHeight=112,step=(width-left*2)/Math.max(1,days.length),colors={observed:'#28764d',estimated:'#7b8998',forecast:'#3977cc',scenario:'#c49a39'};
 const xFor=(value:string)=>{const index=days.findIndex(d=>d.date===value);return index<0?null:left+index*step+step/2;};
 return <figure aria-label="Pluies récentes autour de la décision de semis" style={{margin:'20px 0',padding:'16px',border:'1px solid #dfe5ea',borderRadius:14,background:'#fff'}}>
  <figcaption><strong>Pluie récente et prévisions</strong><p>Les réanalyses décrivent une maille météo; elles ne sont pas des mesures dans votre champ.</p></figcaption>
  <div style={{width:'100%',overflowX:'auto'}}><svg viewBox={'0 0 '+width+' '+height} role="img" aria-label="Pluie journalière en millimètres, avec la date de semis prévue">
   <line x1={left} x2={width-left} y1={top+plotHeight} y2={top+plotHeight} stroke="#d7dde3"/>
   {days.map((day,index)=>{const x=left+index*step+step*.2,rain=day.rainMm,value=rain!==null&&Number.isFinite(rain)?rain:null,barHeight=value===null?0:value/max*(plotHeight-8);return <g key={day.date}>{value!==null&&<rect x={x} y={top+plotHeight-barHeight} width={Math.max(2,step*.6)} height={Math.max(value===0?1:0,barHeight)} rx="2" fill={colors[day.status]}><title>{date(day.date)} · {fmt(value)} mm · {rainfallStatus(day.status)} · {day.source}</title></rect>}{index%7===0&&<text x={x+step*.3} y={top+plotHeight+18} fontSize="9" fill="#66717d">{new Date(day.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</text>}</g>})}
   {[{date:plannedDate,label:'Semis prévu',color:'#182b40'}].map(mark=>{const x=xFor(mark.date);return x===null?null:<g key={mark.label}><line x1={x} x2={x} y1={top-4} y2={top+plotHeight} stroke={mark.color} strokeDasharray="4 3"/><text x={Math.min(width-left-5,Math.max(left+5,x))} y={top-7} textAnchor="middle" fontSize="9" fill={mark.color}>{mark.label}</text></g>})}
  </svg></div>
  <div style={{display:'flex',flexWrap:'wrap',gap:'8px 16px',fontSize:12,marginTop:8}}>{Object.entries(colors).map(([status,color])=><span key={status}><i style={{display:'inline-block',width:9,height:9,background:color,borderRadius:3,marginRight:6}}/>{rainfallStatus(status as WeatherDay['status'])}</span>)}</div>
  <details style={{marginTop:10}}><summary>Valeurs, sources et données manquantes</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Pluie (mm)</th><th>Statut</th><th>Source</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><td>{date(day.date)}</td><td>{day.rainMm===null?'—':fmt(day.rainMm)}</td><td>{rainfallStatus(day.status)}</td><td>{day.source}</td></tr>)}</tbody></table></div></details>
 </figure>;
}
export default function SowingComparison({config,events,onSowingDateChange,onCheckSoil}:{config:SeasonalConfig;events:WaterEvent[];onSowingDateChange?:(date:string)=>void;onCheckSoil?:()=>void}){
 const [rows,setRows]=useState<SowingComparisonRow[]>([]),[rainDays,setRainDays]=useState<WeatherDay[]>([]),[rainError,setRainError]=useState(''),[pendingDate,setPendingDate]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState('');
 const controller=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>{sequence.current++;controller.current?.abort();setRows([]);setRainDays([]);setRainError('');setPendingDate(null);setError('');setBusy(false);return()=>{sequence.current++;controller.current?.abort();};},[config,events]);
 const today=new Date().toISOString().slice(0,10),block=sowingComparisonBlock(config,events,today),plannedMoves=(config.managementPlan?.irrigation.applications.length??0)+(config.managementPlan?.products.filter(p=>p.status==='planned').length??0)+events.filter(e=>e.status==='planned'||e.status==='cancelled').length,pendingShift=pendingDate?Math.round((Date.parse(pendingDate)-Date.parse(config.sowingDate))/86400000):0;
 async function compare(){controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++sequence.current;setRows([]);setRainDays([]);setRainError('');setPendingDate(null);setError('');setBusy(true);
  try{
   const rainFrom=addDays(today,-30),rainTo=addDays(today,15);
   try{
    const context=await seasonalRequest<Environment>({action:'environment',geometry:config.parcelGeometry,country:config.country,start:rainFrom,days:46},abort.signal);
    const window=sowingRainfallWindow(context.weather,config.weather,rainFrom,rainTo);
    if(id===sequence.current&&!abort.signal.aborted)setRainDays(window);
   }catch(e){
    if(id===sequence.current&&!abort.signal.aborted){setRainDays(sowingRainfallWindow([],config.weather,rainFrom,rainTo));setRainError((e as Error).message);}
   }
   const incoming:WeatherDay[]=[];
   for(const request of comparisonWeatherRequests(config)){
    const e=await seasonalRequest<Environment>({action:'environment',geometry:config.parcelGeometry,country:config.country,...request},abort.signal);
    incoming.push(...e.weather);
   }
   const result=compareSowingDates(config,events,incoming,today);
   if(id===sequence.current&&!abort.signal.aborted){setRows(result);setIssued(today);}
  }catch(e){if(id===sequence.current&&!abort.signal.aborted)setError((e as Error).message);}finally{if(id===sequence.current)setBusy(false);}
 }
 return <section className="card" aria-label="Décider quand semer"><span className="qs-eyebrow">DÉCISION · SEMIS</span><h2>Quand semer ?</h2>
  <HelpParagraph>Comparez la date prévue au {date(config.sowingDate)} à deux options plus tardives et consultez la pluie récente autour de votre champ.</HelpParagraph>
  <HelpParagraph className="notice info">Aucune règle de démarrage du semis n’est qualifiée ici pour cette culture et cette zone. Vérifiez l’humidité du lit de semences avant de décider.</HelpParagraph>
  {onCheckSoil&&<button className="btn secondary" onClick={onCheckSoil}>Ouvrir le carnet pour vérifier le sol</button>}
  {block&&<HelpParagraph className="notice info">{block}</HelpParagraph>}
  <button className="btn primary" disabled={busy||!!block} onClick={compare}>{busy?'Chargement de la pluie et comparaison…':'Actualiser la pluie et comparer les dates'}</button>
  {busy&&<HelpParagraph role="status">Lecture de la pluie récente et comparaison des dates. La campagne reste inchangée.</HelpParagraph>}
  {rainDays.length>0&&<RainfallTimeline days={rainDays} plannedDate={config.sowingDate}/>}
  {rainError&&<HelpParagraph className="notice warning" role="alert">Pluie récente indisponible : {rainError}. Les observations déjà saisies sont conservées.</HelpParagraph>}
  {!rainDays.length&&!rainError&&!busy&&<HelpParagraph className="source-note">Actualisez pour charger la pluie récente et la prévision à court terme.</HelpParagraph>}
  <details><summary>Pauses sèches après un début de saison similaire</summary><HelpParagraph>Non calculable avec l’archive actuelle : elle fournit une moyenne quotidienne sur trois années, mais pas les saisons individuelles nécessaires pour compter ces épisodes.</HelpParagraph></details>
  {error&&<HelpParagraph className="notice warning" role="alert">{error} Réessayez ; votre campagne est conservée.</HelpParagraph>}
  {!!rows.length&&<><h3>Comparer les dates</h3><HelpParagraph>Les millimètres représentent le besoin en eau sur tout le cycle. Les m³ représentent le prélèvement simulé à la source avec vos contraintes d’arrosage. Un plus petit volume ne prouve pas une meilleure récolte.</HelpParagraph>
   <DemandComparison rows={rows}/>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Date du semis</th><th>Fin du cycle</th><th>Besoin sur le cycle (mm)</th><th>Eau à la source (m³)</th><th>Résultat</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.date}><td>{date(r.date)}</td><td>{date(r.end)}</td><td>{fmt(r.demandMm)}</td><td>{fmt(r.sourceM3)}</td><td>{r.complete?'Bilan complet':<>Comparaison impossible : données à compléter.<details><summary>Voir ce qui manque</summary>{r.missing.map(m=><HelpParagraph key={m}>{m}</HelpParagraph>)}</details></>}</td><td>{r.date!==config.sowingDate&&<button className="btn secondary small" disabled={!r.complete||!onSowingDateChange} onClick={()=>setPendingDate(r.date)}>Prévisualiser</button>}</td></tr>)}</tbody></table></div>
   {pendingDate&&<section className="notice info" role="region" aria-label="Aperçu du changement de date"><h3>Aperçu · {date(pendingDate)}</h3><HelpParagraph>Le calendrier planifié sera décalé de {Math.abs(pendingShift)} jour(s) {pendingShift>=0?'plus tard':'plus tôt'} ; {plannedMoves?`${plannedMoves} élément(s) planifié(s) seront concernés`:'aucun apport planifié à déplacer'}. Les observations enregistrées ne sont pas modifiées.</HelpParagraph><HelpParagraph>La date restera dans le brouillon jusqu’à ce que vous enregistriez la campagne.</HelpParagraph><div className="form-actions"><button className="btn primary" disabled={!onSowingDateChange} onClick={()=>{onSowingDateChange?.(pendingDate);setPendingDate(null);}}>Appliquer à la campagne</button><button className="btn secondary" onClick={()=>setPendingDate(null)}>Annuler</button></div></section>}
   {rows.some(r=>!r.complete)&&<HelpParagraph className="notice info">Une date n’a pas de résultat complet. Ses totaux restent masqués ; aucune meilleure date n’est annoncée.</HelpParagraph>}
   <details><summary>Données et hypothèses de cette comparaison</summary><HelpParagraph>Données disponibles au {date(issued)}. {rows.some(r=>r.historicalScenario)?'Une partie de la météo est un scénario historique ou une hypothèse explicite, pas une prévision saisonnière.':''}</HelpParagraph><HelpParagraph>Le même état initial du sol est supposé pour chaque date. Vos arrosages prévus sont décalés avec le semis ; les limites d’accès à l’eau restent attachées à leurs dates réelles. Aucun apport réalisé n’est transféré et aucun calendrier n’est enregistré par cette comparaison.</HelpParagraph><HelpParagraph>Le calendrier local, la variété et les conditions de levée restent à vérifier avant de changer réellement la date de semis. Cette comparaison hydrique ne classe pas le rendement agricole.</HelpParagraph></details>
  </>}
 </section>;
}
