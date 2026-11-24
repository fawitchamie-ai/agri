'use client';
import {useState} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import {declareScenario} from '../../lib/seasonal/provenance';
import {AUTOMATIC_YIELD_INPUT_VERSION} from '../../lib/seasonal/automatic-yield';

export default function AutomaticYieldPanel({config:c,plan,stale,loading,onChange,onRefresh,onConfigure}:{config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;loading:boolean;onChange:(c:SeasonalConfig)=>void;onRefresh:()=>void;onConfigure:()=>void}){
 if(!c.parcelGeometry||c.growth||c.canopyNowcast||c.yieldEstimation&&c.yieldEstimation.method!=='automatic')return null;
 const enabled=c.automaticYield?.enabled??true,report=!stale?plan?.automaticYield:undefined,maize=c.cropProfile?.id==='maize';
 const selected=plan?.growth?.scenarios.find(s=>s.id===(c.yieldScenario??(c.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded')));
 return <section className="qs-card automatic-yield-panel" aria-label="Simulation automatique indicative du rendement">
  <header><div><span className="product-eyebrow">RENDEMENT DU CHAMP</span><h3>Simulation automatique indicative</h3></div><label><input type="checkbox" checked={enabled} onChange={e=>onChange({...c,automaticYield:{...c.automaticYield,version:AUTOMATIC_YIELD_INPUT_VERSION,enabled:e.target.checked}})}/> Activer le calcul automatique</label></header>
  <p>{enabled?maize?'Le profil maïs grain est choisi automatiquement. Le calcul utilise la météo du champ, le bilan d’eau et les apports renseignés. Les paramètres de croissance et de fertilité restent des hypothèses non calibrées localement.':'Le choix du profil dépend de la culture. Un profil documenté doit être disponible pour lancer une simulation.':'Le calcul automatique est désactivé pour cette campagne.'}</p>
  {enabled&&<>
   {c.waterCondition!=='waterlogged'&&c.waterCondition!=='submerged'&&<label className="automatic-yield-drainage"><input type="checkbox" checked={c.waterCondition==='drained'} onChange={e=>onChange({...c,waterCondition:e.target.checked?'drained':'unknown'})}/> Je confirme que le champ est terrestre et drainé, sans eau stagnante.</label>}
   {!c.inputPolicy?.allowAssumptions&&maize&&<div className="form-actions"><button className="btn primary" onClick={()=>onChange(declareScenario({...c,automaticYield:{...c.automaticYield,version:AUTOMATIC_YIELD_INPUT_VERSION,enabled:true}}))}>Lancer la simulation indicative avec ces hypothèses</button></div>}
   {(stale||loading)&&<p role="status">Préparation du profil, des données et du calcul…</p>}
   {report?.status==='blocked'&&report.missing.length>0&&<div className="automatic-yield-missing" role="status"><strong>À compléter pour calculer les tonnes</strong><ul>{report.missing.slice(0,6).map(m=><li key={m}>{m}</li>)}</ul></div>}
   {!stale&&selected?.diagnostics.atNutrientCeiling&&<p className="notice info">Le rendement atteint le plafond nutritif de ce profil. Les stocks N/P/K supposés peuvent donc produire le même chiffre malgré des changements de météo ou d’eau. Vérifiez les fournitures accessibles ci-dessous ; aucun stock réel n’est déduit de SoilGrids.</p>}
   <div className="form-actions"><button className="qs-text-button" onClick={onRefresh}>Actualiser les données du champ</button><button className="qs-text-button" onClick={onConfigure}>Voir les hypothèses et les paramètres</button></div>
   <details><summary>{report?.profileLabel??(maize?'Profil maïs grain · RUE–NPK':'Profil de culture à préparer')} · sources et hypothèses</summary>
    <p>Le profil indicatif utilise une efficacité du rayonnement de 1,5 g/MJ, un indice de récolte de 0,45 et une humidité du grain de 15 %. Les stocks N/P/K accessibles et leur libération sont des hypothèses illustratives ; SoilGrids ne les mesure pas.</p>
    {report?.assumptions.map(a=><p key={a}>{a}</p>)}
    {report&&<p>Météo complète pour la croissance : {report.weather.completeDays} / {report.weather.days} jours. {report.weather.scenarioDays} jours de scénario, {report.weather.forecastDays} jours de prévision et {report.weather.estimatedDays} jours estimés. Les jours historiques moyens ne sont pas une prévision saisonnière.</p>}
    {report?.weather.sources.map(s=><p key={s}>{s}</p>)}
    {maize&&<AutomaticNutrients key={JSON.stringify([c.parcelGeometry,c.automaticYield?.soilSupply])} config={c} onChange={onChange}/>}
    <p>Le résultat est une simulation indicative, sans validation prédictive locale ni intervalle de confiance certifié.</p>
   </details>
  </>}
 </section>;
}

function AutomaticNutrients({config:c,onChange}:{config:SeasonalConfig;onChange:(c:SeasonalConfig)=>void}){
 const initial=c.automaticYield?.soilSupply;
 const [stock,setStock]=useState((initial?.initialKgHa??[30,8,40]).map(String)),[release,setRelease]=useState((initial?.releaseKgHaDay??[.3,.02,.2]).map(String)),[source,setSource]=useState(initial?.source??'Hypothèses de scénario saisies par l’utilisateur, à confirmer localement'),[error,setError]=useState('');
 function apply(){if(!source.trim()||stock.some(v=>v.trim()===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>10000)||release.some(v=>v.trim()===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100)){setError('Renseignez trois stocks, trois libérations et leur source ; une valeur inconnue ne doit pas être remplacée par zéro.');return;}setError('');onChange({...c,automaticYield:{version:AUTOMATIC_YIELD_INPUT_VERSION,enabled:true,soilSupply:{initialKgHa:stock.map(Number) as [number,number,number],releaseKgHaDay:release.map(Number) as [number,number,number],source:source.trim()}}});}
 return <details><summary>Fournitures accessibles N/P/K du scénario</summary><p>Valeurs élémentaires disponibles pour la plante, hors engrais enregistrés. L’azote total ou les teneurs brutes du sol ne donnent pas directement ces quantités.</p><div className="form-grid">{['N','P','K'].map((n,i)=><div key={n}><label className="field"><span>Stock initial {n} accessible (kg/ha)</span><input type="number" min="0" max="10000" step="any" value={stock[i]} onChange={e=>setStock(stock.map((v,j)=>j===i?e.target.value:v))}/></label><label className="field"><span>Libération {n} (kg/ha/j)</span><input type="number" min="0" max="100" step="any" value={release[i]} onChange={e=>setRelease(release.map((v,j)=>j===i?e.target.value:v))}/></label></div>)}</div><label className="field"><span>Source ou hypothèse des fournitures</span><input value={source} onChange={e=>setSource(e.target.value)}/></label><button className="btn secondary" onClick={apply}>Appliquer les fournitures N/P/K au calcul</button>{error&&<p role="alert">{error}</p>}</details>;
}
