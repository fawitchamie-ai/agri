import type {WaterPlan} from '../../lib/seasonal/types';

const fmt=(n:number|null,d=1)=>n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:d});
const score=(n:number|null)=>n===null?'—':`${fmt(n)} / 100`;
const difference=(n:number|null)=>n===null?'—':`${n>0?'+':''}${fmt(n)} pts`;

export default function WaterImpactSummary({plan,stale}:{plan:WaterPlan|null;stale:boolean}){
 const impact=stale?undefined:plan?.waterImpact;
 const incomplete=!!impact?.missing.length;

 return <section className="water-impact-panel" aria-labelledby="water-impact-title">
  <header className="water-impact-heading">
   <span className="water-impact-eyebrow">EFFET DE L’EAU SUR LE RENDEMENT</span>
   <h3 id="water-impact-title">Que change l’arrosage ?</h3>
   <p>Compare les scénarios sans arrosage ajouté, avec les apports réalisés et avec le plan proposé, pour le même champ, le même sol et la même météo. Aucun rendement à saisir. Après un changement d’irrigation, le score hydrique est recalculé ici.</p>
  </header>

  <div className="water-impact-reading">
   <div className="water-impact-reference">
    <strong>100</strong>
    <span>référence sans déficit d’eau</span>
   </div>
   <p><strong>Ce score n’est pas un rendement en tonnes.</strong><br/>
    Un score de 80 signifie que le modèle estime 80 % de la référence hydrique.</p>
  </div>

  {stale?<p className="water-impact-status" role="status">Recalcul de l’effet hydrique…</p>
   :incomplete?<div className="water-impact-warning" role="status">
     <strong>Comparaison indisponible pour le moment</strong>
     <p>Vérifie les éléments suivants pour lancer le calcul :</p>
     <ul>{impact!.missing.map((item,i)=><li key={i}>{item}</li>)}</ul>
    </div>
   :impact?.scenarios.length?<>
     <p className="water-impact-caption">Compare les 3 scénarios ci-dessous. L’écart est calculé par rapport au cas sans irrigation ajoutée.</p>
     <div className="water-impact-table-wrap">
      <table className="data-table water-impact-table">
       <thead><tr><th>Situation</th><th>Score hydrique</th><th>Écart vs sans irrigation</th></tr></thead>
       <tbody>{impact.scenarios.map(s=><tr key={s.id} className={s.id==='rainfed'?'water-impact-reference-row':undefined}>
        <td><strong>{s.label}</strong>{s.missing.length>0&&<span className="water-impact-row-note">{s.missing.join(' ')}</span>}</td>
        <td><span className="water-impact-score">{score(s.relativeYieldPercent)}</span></td>
        <td>{difference(s.deltaPointsVsRainfed)}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </>
   :<p className="water-impact-status">Complète le bilan d’eau pour afficher la comparaison.</p>}

  <details className="water-impact-method">
   <summary>Comment lire le résultat et quelles sont ses limites</summary>
   <div className="water-impact-method-content">
    <ul>
     <li><strong>Le score isole l’effet de l’eau.</strong> Il ne calcule pas un rendement en t/ha.</li>
     <li><strong>Le modèle suit FAO56 sur la saison.</strong> Il n’est pas calibré localement.</li>
     <li><strong>Les hypothèses restent les mêmes</strong> pour le sol, la météo et les apports déjà réalisés. Les arrosages prévus sont des hypothèses.</li>
     <li><strong>Domaine limité :</strong> une culture seule, sol drainé, cycle complet et ETa/ETm ≥ 0,5. Les interactions avec la nutrition, le pH, les ravageurs et la salinité ne sont pas calculées.</li>
     <li><strong>Incertitude :</strong> aucun intervalle prédictif à 95 % n’est disponible.</li>
    </ul>
    {impact&&<p className="water-impact-source">Source : <a href={impact.source} target="_blank" rel="noreferrer">FAO56, équation 90</a> · {impact.version} · surface {impact.areaBasis==='planned'?'prévue':'semée'} : {impact.areaM2===null?'non renseignée':`${fmt(impact.areaM2/10000,2)} ha`}.</p>}
   </div>
  </details>
 </section>;
}
