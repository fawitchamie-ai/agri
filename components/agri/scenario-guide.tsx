'use client';
import WaterImpactSummary from './water-impact-summary';
import {useState} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import {cropById} from '../../lib/seasonal/catalog';
import {SEED_REFERENCES} from '../../lib/seasonal/sowing';
import {scenarioComparison,prepareYieldHypothesis} from '../../lib/seasonal/scenario-guidance';
import {ProductIcon} from './product-ui';
import './scenario-guide.css';
const fmt=(n:number|null|undefined,d=2)=>n==null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:d});
type Props={config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;onAdvanced:(tab:string)=>void;onSection:(section:string)=>void;areaLocked:boolean};
export default function ScenarioGuide(props:Props){
 const {config:c,plan,stale,onChange,onAdvanced,onSection,areaLocked}=props;
 // Reset drafts on scope changes without interrupting edits on a recalculation.
 const scope=JSON.stringify([c.country,c.parcelGeometry,c.cropProfile?.id]);
 return <ScenarioGuideForm key={scope} {...props}/>;
}
function ScenarioGuideForm({config:c,plan,stale,onChange,onAdvanced,onSection,areaLocked}:Props){
 const reference=c.yieldEstimation?.units[0]?.reference,crop=cropById(c.cropProfile?.id??'');
 const [editing,setEditing]=useState(false),[error,setError]=useState('');
 const [yieldDraft,setYieldDraft]=useState<string|null>(null),[sourceDraft,setSourceDraft]=useState<string|null>(null),[areaDraft,setAreaDraft]=useState<string|null>(null),[drained,setDrained]=useState(c.waterCondition==='drained');
 const area=c.yieldEstimation?.units[0]?.sownAreaM2??c.sowingPlan?.areaM2??c.landAssessment?.candidateAreaM2;
 const yieldValue=yieldDraft??(reference?String(reference.kgHa/1000):'');
 const source=sourceDraft??reference?.source??'';
 const comparison=scenarioComparison(c,plan,stale),seed=SEED_REFERENCES[c.cropProfile?.id??''];
 const layers=c.soil.layers,stock=layers.some(l=>l.initialTheta===null)?null:100*layers.reduce((n,l)=>n+l.thicknessM*(l.initialTheta!-l.thetaWP),0)/Math.max(1e-9,layers.reduce((n,l)=>n+l.thicknessM*(l.thetaFC-l.thetaWP),0));
 const ph=c.soilAnalyses?.flatMap(a=>a.measurements).find(m=>m.parameter==='pH')?.value;
 const multi=(c.yieldEstimation?.units.length??0)>1;
 function apply(){try{
  const next=prepareYieldHypothesis(c,{kgHa:Number(yieldValue)*1000,source,areaM2:Number(areaDraft??area),drained});
  if(areaLocked&&next.yieldEstimation?.units[0]?.sownAreaM2!==c.yieldEstimation?.units[0]?.sownAreaM2)throw new Error('Les observations existantes restent liées à leur surface. Modifiez la référence dans Rendement.');
  onChange(next);setEditing(false);setError('');
 }catch(e){setError((e as Error).message);}}
 return <section className="scenario-guide" aria-label="Améliorer les hypothèses de rendement">
  <div className="scenario-guide-heading"><div><span className="product-eyebrow">VOTRE OBJECTIF · MIEUX PRÉPARER LA RÉCOLTE</span><h2>Comparer l’impact de mes interventions.</h2><p>Comparez la réponse au manque d’eau sans saisir de rendement, puis explorez les effets des engrais.</p></div><button className="btn secondary" aria-expanded={editing} onClick={()=>setEditing(!editing)}><ProductIcon name="settings" size={17}/>{editing?'Fermer les réglages':'Ajuster mes hypothèses'}</button></div>
  <div className="scenario-assumptions">
   <button onClick={()=>onAdvanced('sol')}><span>SOL & RÉSERVE</span><strong>{ph==null?'pH à vérifier':'pH '+fmt(ph,1)} <small>· {fmt(stock,0)} % de réserve</small></strong><em>{c.soilAnalyses?.some(a=>a.status==='measured')?'Analyse renseignée':'Estimation / hypothèse modifiable'} ↗</em></button>
   <button onClick={()=>onSection('water')}><span>SEMENCES</span><strong>{fmt(c.sowingPlan?.seedRateKgHa??seed?.defaultKgHa)} <small>kg/ha</small></strong><em>{c.sowingPlan?.seedRateKgHa!=null?'Votre dose':'Repère de la culture à adapter'} ↗</em></button>
   <button onClick={()=>onAdvanced('meteo')}><span>MÉTÉO</span><strong>{c.weather.filter(w=>w.rainMm!==null&&w.et0Mm!==null).length} <small>jours renseignés</small></strong><em>{c.weather.some(w=>w.status==='scenario')?'Inclut des hypothèses climatiques':'Selon les données disponibles'} ↗</em></button>
   <button onClick={()=>setEditing(true)}><span>RÉFÉRENCE FACULTATIVE</span><strong>{reference?fmt(reference.kgHa/1000):'À confirmer'} <small>{reference?'t/ha':''}</small></strong><em>{reference?'Source et valeur modifiables':'Pour convertir la réponse en t/ha'} ↗</em></button>
  </div>
  {editing&&<div className="scenario-editor">
   <div className="scenario-editor-intro"><h3>Avec quelles hypothèses simuler ?</h3><p>La référence sans déficit d’eau est un plafond conditionnel. Le bilan estime ensuite l’effet du manque d’eau ; les autres contraintes ne sont pas toutes calculées.</p></div>
   {multi?<p>Votre parcelle comporte plusieurs unités : conservez leurs références distinctes dans <button className="qs-text-button" onClick={()=>onSection('yield')}>Rendement</button>.</p>:<>
    <div className="form-grid">
     <label className="field"><span>Référence sans manque d’eau (t/ha)</span><input type="number" min="0.001" step="0.1" value={yieldValue} onChange={e=>{setYieldDraft(e.target.value);}}/></label>
     <label className="field"><span>Surface supposée semée pour ce scénario (m²)</span><input type="number" min="0" max={c.landAssessment?.candidateAreaM2??0} step="any" disabled={areaLocked} value={areaDraft??area??''} onChange={e=>setAreaDraft(e.target.value)}/><small>Partie terrestre préremplie ; semis réalisé non attesté.</small></label>
     <label className="field"><span>Source et contexte de la référence</span><textarea rows={3} value={source} onChange={e=>setSourceDraft(e.target.value)} placeholder="Essai, variété et conditions, ou hypothèse explicite"/></label>
     <div className="scenario-check"><label><input type="checkbox" checked={drained} disabled={c.waterCondition==='waterlogged'||c.waterCondition==='submerged'} onChange={e=>setDrained(e.target.checked)}/> J’ai vérifié l’absence d’eau stagnante pour ce scénario terrestre.</label><small>Sol, météo, mesures et apports existants sont conservés.</small></div>
    </div><div className="form-actions"><button className="btn primary" onClick={apply}>Simuler avec ces hypothèses <ProductIcon name="arrow" size={17}/></button><button className="qs-text-button" onClick={()=>onSection('yield')}>Référence détaillée</button></div>
   </>}
   <div className="scenario-water-settings"><h3>Mes limites d’accès à l’eau</h3><p>Renseignez vos contraintes réelles pour éviter un scénario d’arrosage irréalisable.</p><div className="form-grid">{[['sourceBudgetM3','Volume disponible sur le cycle (m³)',0,1e10],['sourceFlowM3h','Débit à la source (m³/h)',.001,1e6],['hoursPerDay','Accès à l’eau (heures/jour)',0,24]].map(([id,label,min,max])=><label className="field" key={id}><span>{label}</span><input type="number" min={min} max={max} step="any" value={c.system[id as 'sourceBudgetM3']??''} placeholder="Non renseigné" onChange={e=>onChange({...c,system:{...c.system,[id]:e.target.value===''?null:Number(e.target.value)}})}/></label>)}</div></div>
   {crop?.ecology?.phOptimal&&<p>Repère pH pour {c.crop} : {crop.ecology.phOptimal.join(' à ')}. L’écart reste un point à examiner ; aucune correction chimique du sol n’est appliquée automatiquement.</p>}
   {error&&<p className="notice warning" role="alert">{error}</p>}
  </div>}
  <WaterImpactSummary plan={plan} stale={stale}/>
  {comparison.comparable&&<><div className="scenario-compare-heading"><div><h3>Quel scénario donne le meilleur rendement calculé ?</h3><p>Même parcelle, même culture, même référence. Seul l’arrosage change.</p></div>{!comparison.comparable&&<button className="qs-text-button" onClick={()=>reference?onSection('yield'):setEditing(true)}>{stale?'Recalcul en cours':'Préparer la comparaison'} ↗</button>}</div>
  <div className="scenario-options" aria-live="polite">{comparison.rows.map(r=><button key={r.id} className={comparison.best?.id===r.id?'scenario-best':''} aria-pressed={c.yieldScenario===r.id} disabled={r.kgHa===null} onClick={()=>onChange({...c,yieldScenario:r.id})}><span>{r.label}</span><strong>{fmt(r.kgHa===null?null:r.kgHa/1000)} <small>t/ha</small></strong><em>{comparison.best?.id===r.id?'Meilleur des scénarios calculés':r.kgHa===null?'Données ou référence à compléter':c.yieldScenario===r.id?'Affiché dans ma synthèse':'Afficher dans ma synthèse'}</em></button>)}</div>
  {comparison.best&&<p className="scenario-best-note"><ProductIcon name="check" size={17}/>{comparison.gainKgHa!>1e-6?<>Écart simulé face aux seuls apports réalisés : <strong>+{fmt(comparison.gainKgHa!/1000)} t/ha</strong>.</>:'À rendement égal, le scénario demandant le moins d’apports supplémentaires est retenu.'} {comparison.best.id==='proposed'?'Le plan d’arrosage doit être réalisable et exécuté.':''}</p>}
  {!comparison.comparable&&<p className="scenario-footnote">Le classement exige trois résultats hydriques complets et une référence indépendante sans déficit d’eau. Un simple rendement saisi ne permet pas de classer l’effet de l’arrosage.</p>}
  </>}
  <div className="scenario-shortcuts"><button onClick={()=>onAdvanced('conseils')}><ProductIcon name="clock" size={17}/>Comparer les dates de semis <span>↗</span></button><button onClick={()=>onSection('fertilizer')}><ProductIcon name="leaf" size={17}/>Ajuster les engrais <span>↗</span></button><button onClick={()=>onSection('water')}><ProductIcon name="water" size={17}/>Voir le plan d’eau <span>↗</span></button></div>
 </section>;
}
