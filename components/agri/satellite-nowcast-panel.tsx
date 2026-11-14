'use client';
import {useCallback,useState} from 'react';
import {HelpParagraph} from './help-dialog';
import {seasonalRequest} from '../../lib/seasonal/request';
import {SATELLITE_INDEX_VERSION,satelliteMonitoringScope,type SatelliteIndexMonitoring} from '../../lib/seasonal/satellite';
import type {SeasonalConfig} from '../../lib/seasonal/types';

const fmt=(v:number|null|undefined,d=2)=>v==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
type Result=Pick<SatelliteIndexMonitoring,'version'|'source'|'retrievedOn'|'observations'> & {coverageNote:string;issues:string[]};

/** Collects field-masked Sentinel indices as evidence for later local calibration. */
export default function SatelliteNowcastPanel({config:c,onChange}:{config:SeasonalConfig;onChange:(c:SeasonalConfig)=>void}){
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState('');
 const today=new Date().toISOString().slice(0,10),stored=c.satelliteMonitoring,scope=satelliteMonitoringScope(c),current=stored?.scope===scope;
 const cycleEnd=new Date(Date.parse(c.sowingDate)+(c.stages.reduce((n,s)=>n+s.days,0)-1)*86400000).toISOString().slice(0,10);
 const cutoff=new Date(Date.parse(today)-240*86400000).toISOString().slice(0,10),requestStart=c.sowingDate<cutoff?cutoff:c.sowingDate,requestEnd=cycleEnd<today?cycleEnd:today;
 const canFetch=!!c.parcelGeometry&&c.sowingDate<=today&&c.asOfDate===today&&requestStart<=requestEnd;
 const refresh=useCallback(async()=>{
  if(!canFetch){setError(c.sowingDate>today?'Les observations Sentinel‑2 commencent après le semis.':c.asOfDate!==today?'Actualisez la date d’analyse de la campagne avant de récupérer de nouvelles images.':'Ce cycle est hors de la fenêtre Sentinel‑2 de 240 jours.');return;}
  setLoading(true);setError('');
  try{
   const result=await seasonalRequest<Result>({action:'satellite-index-series',geometry:c.parcelGeometry!,startDate:requestStart,asOfDate:requestEnd});
   const base=current?stored!.observations:[],byDate=new Map([...base,...result.observations].map(o=>[o.date,o]));
   const observations=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-120);
   onChange({...c,satelliteMonitoring:{version:SATELLITE_INDEX_VERSION,scope,source:result.source,retrievedOn:result.retrievedOn,observations}});setError('');setWarning(result.issues.length?`${result.issues.length} acquisition(s) ignorée(s) car une bande manque ou ne peut pas être lue.`:'');
  }catch(e){setError((e as Error).message||'Lecture Sentinel‑2 impossible.');}
  finally{setLoading(false);}
 },[canFetch,c,onChange,requestEnd,requestStart,scope,stored,today,current]);
 if(!c.parcelGeometry)return null;
 const observations=current?stored?.observations??[]:[];
 const chartObservations=observations.filter(o=>o.quality==='usable'&&o.date<=c.asOfDate&&o.availableOn<=c.asOfDate&&o.ndviMedian!==null&&o.eviMedian!==null).slice(-12);
 const chartX=(index:number)=>chartObservations.length<2?280:40+index/(chartObservations.length-1)*480;
 const chartY=(value:number)=>95-value*66;
 const linePoints=(key:'ndviMedian'|'eviMedian')=>chartObservations.map((o,i)=>`${chartX(i)},${chartY(o[key]!)}`).join(' ');
 const ticks=[...new Set([0,Math.floor((chartObservations.length-1)/2),chartObservations.length-1])].filter(i=>i>=0);
 return <section className="qs-card" aria-label="Suivi satellite automatique de la parcelle"><details open={!!observations.length}>
  <summary>Suivi satellite automatique · NDVI / EVI</summary>
  <HelpParagraph>Les images sont cherchées à partir du contour de la parcelle : aucune préfecture n’est à choisir. Le service calcule les médianes des pixels Sentinel‑2 à l’intérieur du champ et écarte les nuages, leurs ombres, l’eau et les pixels sans donnée.</HelpParagraph>
  <HelpParagraph>Pour trouver les scènes, l’application transmet l’emprise géographique à Digital Earth Africa ou, si son catalogue est indisponible, à Earth Search. Les coordonnées sont nécessaires à la recherche ; les identifiants du compte ne sont pas joints à ces requêtes. Jusqu’à six dates sont retenues par récupération pour limiter les lectures raster.</HelpParagraph>
  <HelpParagraph>NDVI et EVI décrivent l’évolution de la végétation après le semis. Ils aident à suivre la vigueur et à constituer des observations pour calibrer le nowcast. Ils ne sont pas encore convertis en tonnes par hectare et ne modifient pas le rendement affiché : cette conversion doit être testée sur des parcelles récoltées indépendantes.</HelpParagraph>
  <button className="btn secondary" type="button" disabled={loading||!canFetch} onClick={refresh}>{loading?'Lecture des scènes Sentinel‑2…':observations.length?'Actualiser les observations du champ':'Récupérer les observations du champ'}</button>
  {!canFetch&&<HelpParagraph>{c.sowingDate>today?'Aucune observation du couvert de la culture n’existe avant le semis.':c.asOfDate!==today?'Mettez la date d’analyse au jour courant pour enregistrer la disponibilité réelle des images.':'Ce cycle est hors de la fenêtre Sentinel‑2 de 240 jours.'}</HelpParagraph>}
  {c.sowingDate<cutoff&&<HelpParagraph>La recherche couvre les 240 derniers jours ; le début de ce cycle est antérieur à cette fenêtre.</HelpParagraph>}
  {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}
  {warning&&<HelpParagraph>{warning}</HelpParagraph>}
  {stored&&!current&&<HelpParagraph>Les images enregistrées sont liées à un ancien contour, une autre culture ou une autre date de semis. Elles ne sont pas affichées pour cette parcelle.</HelpParagraph>}
  {!!observations.length&&<>
   <p>{observations.length} observations archivées · dernière récupération le {stored?.retrievedOn}.</p>
   {chartObservations.length>0&&<div className="satellite-index-chart-wrap"><div className="advisor-chart-legend"><span><i className="satellite-legend-ndvi"/>NDVI</span><span><i className="satellite-legend-evi"/>EVI</span></div><svg className="satellite-index-chart" viewBox="0 0 560 190" role="img" aria-label="Évolution des médianes NDVI et EVI sur les observations Sentinel-2 exploitables du contour">
    {[1,0,-1].map(value=><g key={value}><line x1="35" x2="530" y1={chartY(value)} y2={chartY(value)} stroke="#e1e8ef" strokeWidth="1"/><text x="4" y={chartY(value)+3} fill="#718198" fontSize="9">{fmt(value,0)}</text></g>)}
    <polyline points={linePoints('ndviMedian')} fill="none" stroke="#246f9c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points={linePoints('eviMedian')} fill="none" stroke="#c07b24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {chartObservations.map((o,i)=><g key={o.date}><circle cx={chartX(i)} cy={chartY(o.ndviMedian!)} r="3.2" fill="#246f9c"/><circle cx={chartX(i)} cy={chartY(o.eviMedian!)} r="3.2" fill="#c07b24"/></g>)}
    {ticks.map(i=><text key={i} x={chartX(i)} y="180" textAnchor={i===0?'start':i===chartObservations.length-1?'end':'middle'} fill="#718198" fontSize="9">{chartObservations[i].date}</text>)}
   </svg><HelpParagraph>Échelle fixe de −1 à 1. Les trous de couverture nuageuse ne sont pas interpolés. La courbe décrit les indices observés, sans convertir leur variation en stress ou en rendement.</HelpParagraph></div>}
   <div className="table-scroll"><table><thead><tr><th>Date</th><th>NDVI médian</th><th>EVI médian</th><th>Pixels clairs</th><th>Couverture claire</th><th>Qualité</th></tr></thead><tbody>
    {[...observations].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(o=><tr key={o.date}><td>{o.date}</td><td>{fmt(o.ndviMedian)}</td><td>{fmt(o.eviMedian)}</td><td>{o.validPixels} / {o.parcelPixels}</td><td>{fmt(o.clearFraction*100,0)} %</td><td>{o.quality==='usable'?'Qualité raster suffisante':o.quality==='low-coverage'?'Couverture claire faible':'Trop peu de pixels clairs'}</td></tr>)}
   </tbody></table></div>
   {observations.some(o=>o.sceneCloudPercent!==null)&&<HelpParagraph>La couverture nuageuse indiquée par le catalogue concerne toute la scène ; la colonne « couverture claire » est calculée sur le contour du champ.</HelpParagraph>}
   {observations.some(o=>o.availableOn>c.asOfDate)&&<HelpParagraph>Des images ont été récupérées après la date d’analyse de cette révision. Elles sont conservées comme suivi, mais ne sont pas admissibles dans un rejeu historique à cette date.</HelpParagraph>}
  </>}
  <details><summary>Comment ces valeurs pourront alimenter le nowcast ?</summary><HelpParagraph>Les valeurs et leur qualité sont conservées avec la campagne, la date d’acquisition, la date de récupération et la géométrie de référence. Elles pourront être jointes aux récoltes mesurées pour tester l’apport réel des indices. Tant que cette validation n’a pas été faite hors échantillon, le moteur de rendement ne les utilise pas.</HelpParagraph></details>
 </details></section>;
}
