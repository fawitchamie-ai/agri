import type {WaterPlan} from '../../lib/seasonal/types';
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
export default function WaterImpactSummary({plan,stale}:{plan:WaterPlan|null;stale:boolean}){
 const impact=stale?undefined:plan?.waterImpact;
 return <section aria-label="Impact de l’eau sur le rendement">
  <h3>Effet simulé de l’arrosage</h3>
  <p>Comparez les mêmes conditions de sol et de météo, avec et sans irrigation. Aucun rendement à saisir pour cette comparaison.</p>
  {stale?<p role="status">Recalcul de l’effet hydrique…</p>:impact?.scenarios.length?<div className="table-wrap"><table className="data-table"><thead><tr><th>Scénario</th><th>Indice hydrique / 100</th><th>Écart au pluvial (points)</th></tr></thead><tbody>{impact.scenarios.map(s=><tr key={s.id}><td>{s.label}{s.missing.length>0&&<small> · {s.missing.join(' ')}</small>}</td><td>{fmt(s.relativeYieldPercent)}</td><td>{fmt(s.deltaPointsVsRainfed)}</td></tr>)}</tbody></table></div>:<p>{impact?.missing.join(' ')||'Complétez le sol, la météo, la culture et la surface terrestre pour comparer les effets.'}</p>}
  <p>100 représente le rendement de référence sans déficit d’eau. Un indice de 80 représente 80 % de cette référence dans le modèle hydrique ; il ne signifie ni 80 t/ha, ni une prévision complète du rendement.</p>
  <details><summary>Méthode et limites de l’effet hydrique</summary>{(impact?.limits??['Réponse FAO56 saisonnière, non calibrée localement. Nutrition, pH, ravageurs et mortalité par inondation non quantifiés.']).map(l=><p key={l}>{l}</p>)}{impact&&<p>Source : <a href={impact.source} target="_blank" rel="noreferrer">FAO56, équation 90</a> · {impact.version} · surface {impact.areaBasis==='planned'?'prévue':'semée'} : {fmt(impact.areaM2)} m².</p>}</details>
 </section>;
}
