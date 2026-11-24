import type {WaterPlan} from '../../lib/seasonal/types';

const fmt=(n:number|null,d=1)=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:d});
const score=(n:number|null)=>n===null?'—':`${fmt(n)} / 100`;
const difference=(n:number|null)=>n===null?'—':`${n>0?'+':''}${fmt(n)} pts`;
const waterCoverage=(eta:number|null,etm:number|null)=>eta===null||etm===null||etm<=0?'—':`${fmt(eta/etm*100,2)} %`;
const reason=(s:NonNullable<WaterPlan['waterImpact']>['scenarios'][number],method:string|undefined)=>method==='seasonal'&&s.etaMm!==null&&s.etmMm!==null&&s.etmMm>0&&s.etaMm/s.etmMm<.5
 ?`Comparaison non calculable : ${waterCoverage(s.etaMm,s.etmMm)} des besoins couverts, sous le seuil de 50 % de cette approximation. Ce n’est pas un effet nul.`
 :s.missing.join(' ');

export default function WaterImpactSummary({plan,stale}:{plan:WaterPlan|null;stale:boolean}){
 const impact=stale?undefined:plan?.waterImpact;
 const incomplete=!!impact?.missing.length;

 return <section className="water-impact-panel" aria-labelledby="water-impact-title">
  <header className="water-impact-heading">
   <span className="water-impact-eyebrow">INDICATEUR HYDRIQUE · PAS UN RENDEMENT</span>
   <h3 id="water-impact-title">Couverture et score hydriques</h3>
   <p>Ce panneau affiche un score d’eau relatif, pas une variation de rendement en t/ha. Pour lire les écarts de rendement utilisés par la simulation principale, consultez le tableau « Qu’est-ce qui fait varier ce rendement ? » ci-dessus.</p>
  </header>

  <div className="water-impact-reading">
   <div className="water-impact-reference">
    <strong>100</strong>
    <span>référence sans déficit d’eau</span>
   </div>
   <p><strong>Un score de 80 signifie 80 % de la référence hydrique du modèle.</strong><br/>
    Le taux ci-dessous rapporte l’évapotranspiration réelle au besoin saisonnier (ETa/ETm). Aucun de ces nombres n’est un rendement en tonnes.</p>
  </div>

  {stale?<p className="water-impact-status" role="status">Recalcul de l’effet hydrique…</p>
   :incomplete?<div className="water-impact-warning" role="status">
     <strong>Comparaison indisponible pour le moment</strong>
     <p>Vérifiez les éléments suivants pour lancer le calcul :</p>
     <ul>{impact!.missing.map((item,i)=><li key={i}>{item}</li>)}</ul>
    </div>
   :impact?.scenarios.length?<>
     <figure className="water-comparison-chart" aria-labelledby="water-comparison-title">
      <figcaption id="water-comparison-title"><strong>Score hydrique selon le scénario</strong><span>Sur une échelle de 0 à 100 · 100 = référence sans déficit d’eau</span></figcaption>
      <div className="water-comparison-scale" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
      <div className="water-comparison-rows">{impact.scenarios.map(s=><div className="water-comparison-row" key={s.id}>
       <div className="water-comparison-label"><strong>{s.label}</strong><span>{s.relativeYieldPercent===null?'Non calculable':`${fmt(s.relativeYieldPercent)} / 100`}</span></div>
       <div className="water-comparison-track" aria-hidden="true">{s.relativeYieldPercent!==null&&<span className={`water-comparison-bar water-comparison-${s.id}`} style={{width:`${Math.max(0,Math.min(100,s.relativeYieldPercent))}%`}}/>}</div>
       {s.relativeYieldPercent===null&&s.missing.length>0&&<small>{reason(s,impact.method)}</small>}
      </div>)}</div>
      <p>Ces scores comparent uniquement l’effet simulé de l’eau, pour la même météo et le même sol. Ils ne représentent pas des tonnes récoltées.</p>
     </figure>
     <p className="water-impact-caption">L’écart est calculé par rapport au scénario sans irrigation ajoutée.</p>
     <div className="water-impact-table-wrap">
      <table className="data-table water-impact-table">
       <thead><tr><th>Situation</th><th>Besoins en eau couverts</th><th>Score hydrique</th><th>Écart du score vs pluvial</th></tr></thead>
       <tbody>{impact.scenarios.map(s=><tr key={s.id} className={s.id==='rainfed'?'water-impact-reference-row':undefined}>
        <td><strong>{s.label}</strong>{s.missing.length>0&&<span className="water-impact-row-note">{reason(s,impact.method)}</span>}</td>
        <td>{waterCoverage(s.etaMm,s.etmMm)}</td>
        <td><span className="water-impact-score">{score(s.relativeYieldPercent)}</span></td>
        <td>{difference(s.deltaPointsVsRainfed)}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </>
   :<p className="water-impact-status">Complétez le bilan d’eau pour afficher la comparaison.</p>}

  <details className="water-impact-method">
   <summary>Comment lire le résultat et quelles sont ses limites</summary>
   <div className="water-impact-method-content">
    <ul>
     <li><strong>Le score isole l’effet de l’eau.</strong> Il ne calcule pas un rendement en t/ha.</li>
     <li><strong>{impact?.method==='stage-product'?'Réponse calculée séparément par stade.':'Le modèle suit FAO56 sur la saison.'}</strong> {impact?.method==='stage-product'?'Produit des réponses linéaires avec les Ky maïs de FAO33, hypothèse expérimentale.':'Il n’est pas calibré localement.'}</li>
     <li><strong>Les hypothèses restent les mêmes</strong> pour le sol, la météo et les apports déjà réalisés. Les arrosages prévus sont des hypothèses.</li>
     <li><strong>Domaine limité :</strong> une culture seule, sol drainé, cycle complet{impact?.method==='stage-product'?' et calendrier des phases documenté':' et ETa/ETm ≥ 0,5'}. Les interactions avec la nutrition, le pH, les ravageurs et la salinité ne sont pas calculées.</li>
     <li><strong>Incertitude :</strong> aucun intervalle prédictif à 95 % n’est disponible.</li>
    </ul>
    {impact?.method==='stage-product'&&impact.scenarios.filter(s=>s.stageResponse).map(s=><details key={s.id}><summary>Déficit et réponse par phase · {s.label}</summary><div className="table-wrap"><table className="data-table"><thead><tr><th>Phase</th><th>Dates</th><th>Ky</th><th>ETa / ETm</th><th>Facteur du grain</th></tr></thead><tbody>{s.stageResponse!.phases.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.from} → {p.to}</td><td>{fmt(p.ky,2)}</td><td>{waterCoverage(p.etaMm,p.etmMm)}</td><td>{p.factor===null?'Hors domaine':fmt(p.factor,3)}</td></tr>)}</tbody></table></div>{s.stageResponse!.warnings.map(w=><p key={w}>{w}</p>)}</details>)}
    {impact&&<p className="water-impact-source">Source : <a href={impact.source} target="_blank" rel="noreferrer">{impact.method==='stage-product'?'FAO33, sensibilités par stade':'FAO56, équation90'}</a> · {impact.version} · surface {impact.areaBasis==='planned'?'prévue':'semée'} : {impact.areaM2===null?'non renseignée':`${fmt(impact.areaM2/10000,2)} ha`}.</p>}
    <p><a href="/scientific/togo-stage-replay.html" target="_blank" rel="noreferrer">Ouvrir le rejeu interactif de l’essai togolais →</a></p>
   </div>
  </details>
 </section>;
}
