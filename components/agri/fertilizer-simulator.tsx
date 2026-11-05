'use client';
import { HelpParagraph } from './help-dialog';
import {useState} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import {fertilizerScope,parseFertilizerScenario} from '../../lib/seasonal/fertilizer-scenario';
import {QUEFTS_SOURCE} from '../../lib/seasonal/quefts';
const fmt=(n:number,d=2)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const range=(r:[number,number]|null,divisor=1)=>r?`${fmt(r[0]/divisor)} – ${fmt(r[1]/divisor)}`:'—';
type Props={config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;onAdvanced:(s:string)=>void};
export default function FertilizerSimulator(props:Props){
 const {config}=props;
 if(config.cropProfile?.id!=='maize')return <HelpParagraph>Le simulateur mécaniste de cette version concerne le maïs. Les paramètres des autres cultures restent à qualifier.</HelpParagraph>;
 // Reinitialize edits when switching campaign scope or reopening saved parameters.
 return <SimulatorForm key={fertilizerScope(config)+JSON.stringify(config.fertilizerScenario)} {...props}/>;
}
function SimulatorForm({config,plan,stale,onChange,onAdvanced}:Props){
 const saved=config.fertilizerScenario;
 const [ceiling,setCeiling]=useState(saved?String(saved.ceilingKgHa/1000):'');
 const [source,setSource]=useState(saved?.ceilingSource??'');
 const [anchor,setAnchor]=useState(saved?.control?String(saved.control.kgHa/1000):'');
 const [anchorSource,setAnchorSource]=useState(saved?.control?.source??'');
 const [accepted,setAccepted]=useState(!!saved),[drained,setDrained]=useState(config.waterCondition==='drained'),[error,setError]=useState('');
 const result=!stale&&saved&&saved.scope===fertilizerScope(config)?plan?.fertilizerScenario:null;
 const r=result?.results;
 function apply(){try{
  if(!accepted)throw new Error('Acceptez les hypothèses de transfert pour lancer ce scénario.');
  if(!drained)throw new Error('Confirmez un sol drainé ; un sol engorgé est hors domaine.');
  const fertilizerScenario=parseFertilizerScenario({version:'quefts-scenario-1',scope:fertilizerScope(config),acceptedTransfer:true,
   ceilingKgHa:ceiling.trim()?Number(ceiling)*1000:null,ceilingSource:source,availableOn:config.asOfDate,
   control:anchor.trim()?{kgHa:Number(anchor)*1000,source:anchorSource,moisturePercent:15,withoutFertilizer:true,denominator:'sown'}:null});
  onChange({...config,waterCondition:'drained',fertilizerScenario});setError('');
 }catch(e){setError((e as Error).message);}}
 return <div className="notice info fertilizer-simulator" aria-label="Simulation exploratoire des engrais">
  <h3>Simuler l’effet de mes engrais sur le maïs</h3>
  <HelpParagraph><strong>Scénario exploratoire · paramètres transférés du Nigeria.</strong> Le calcul représente les interactions entre azote, phosphore et potassium. Un apport d’azote peut rester peu efficace si le phosphore ou le potassium limite la croissance.</HelpParagraph>
  <details><summary>Définir les hypothèses du scénario</summary>
   <HelpParagraph>Indiquez un plafond de rendement dans les conditions d’eau envisagées, avec une nutrition suffisante. Ce n’est ni une moyenne nationale ni votre rendement actuel avec engrais. Toutes les valeurs concernent le grain à 15 % d’humidité, par hectare de la surface prévue ou semée du scénario.</HelpParagraph>
   <button type="button" className="qs-text-button" onClick={()=>{setCeiling('10');setSource('Hypothèse transférée : plafond de paramétrage 10 t/ha, Shehu et al. 2019, '+QUEFTS_SOURCE+' ; à adapter au contexte hydrique local, aucune récolte garantie.');}}>Préremplir l’exemple publié du modèle (10 t/ha, Nigeria)</button>
   <HelpParagraph>Ce plafond publié est une hypothèse de potentiel du modèle, pas un rendement attendu dans votre champ. Réduisez-le si votre référence agronomique et vos conditions d’eau le justifient.</HelpParagraph>
   <div className="form-grid">
    <label className="field"><span>Plafond du scénario (t/ha, maximum 10)</span><input type="number" min="0.001" max="10" step="0.1" value={ceiling} onChange={e=>setCeiling(e.target.value)}/></label>
    <label className="field"><span>Origine et contexte de ce plafond</span><input value={source} onChange={e=>setSource(e.target.value)} placeholder="Essai comparable, avis agronomique ou hypothèse explicitée"/></label>
   </div>
   <details><summary>Facultatif : ajuster à un rendement témoin local</summary>
    <HelpParagraph>Uniquement un témoin sans aucun engrais, dans des conditions comparables. Une parcelle déjà fertilisée ne convient pas. L’ajustement conserve deux hypothèses différentes de fourniture N/P/K ; il ne prouve pas la réponse future.</HelpParagraph>
    <div className="form-grid"><label className="field"><span>Témoin sans engrais (t/ha à 15 %)</span><input type="number" min="0.001" step="0.1" value={anchor} onChange={e=>setAnchor(e.target.value)}/></label><label className="field"><span>Source du témoin et comparabilité</span><input value={anchorSource} onChange={e=>setAnchorSource(e.target.value)} placeholder="Lieu, campagne, culture, humidité et surface"/></label></div>
   </details>
   <HelpParagraph>Sans témoin, les deux fournitures du sol proviennent des sols moyens de l’étude nigériane. Elles ne décrivent pas une mesure de votre parcelle. Les fractions de récupération des engrais viennent de la même étude.</HelpParagraph>
   <label className="field"><span><input type="checkbox" checked={drained} onChange={e=>setDrained(e.target.checked)}/> Je déclare ce sol drainé pour le scénario.</span></label>
   <label className="field"><span><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> J’utilise ces hypothèses pour explorer un transfert non validé localement. Le plafond tient déjà compte du contexte hydrique envisagé.</span></label>
   <div className="button-row"><button className="btn secondary" type="button" onClick={apply}>Calculer avec mes apports</button>{saved&&<button className="btn secondary" type="button" onClick={()=>onChange({...config,fertilizerScenario:undefined})}>Désactiver ce scénario</button>}</div>
   <HelpParagraph>Enregistrez ensuite la campagne pour conserver ces hypothèses et le résultat.</HelpParagraph>
  </details>
  {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}
  {saved&&stale&&<HelpParagraph role="status">Recalcul du scénario en cours…</HelpParagraph>}
  {saved&&saved.scope!==fertilizerScope(config)&&<HelpParagraph>Le contexte a changé : réexaminez les hypothèses et relancez le calcul.</HelpParagraph>}
  {result?.missing.map(m=><HelpParagraph key={m}>{m}</HelpParagraph>)}
  {r&&<div aria-live="polite">
   <HelpParagraph><strong>Rendements simulés, grain à 15 % · plage entre deux profils.</strong> Les apports déjà réalisés sont conservés dans les deux situations.</HelpParagraph>
   <div className="table-wrap"><table className="data-table"><thead><tr><th>Situation</th><th>Rendement (t/ha du scénario)</th><th>Production (kg)</th></tr></thead><tbody>
    <tr><td>Sans nouvel apport prévu</td><td>{range(r.yieldWithoutKgHa,1000)}</td><td>{range(r.productionWithoutKg)}</td></tr>
    <tr><td>Avec les engrais prévus</td><td>{range(r.yieldWithKgHa,1000)}</td><td>{range(r.productionWithKg)}</td></tr>
    <tr><td>Supplément simulé</td><td>{range(r.deltaKgHa,1000)}</td><td>{range(r.extraProductionKg)}</td></tr>
   </tbody></table></div>
   <HelpParagraph>N–P–K élémentaires prévus : {r.plannedKgHa.map(n=>fmt(n,1)).join(' / ')} kg/ha. Déjà réalisés : {r.realizedKgHa.map(n=>fmt(n,1)).join(' / ')} kg/ha.</HelpParagraph>
   {r.areaWarning&&<HelpParagraph>{r.areaWarning}</HelpParagraph>}{r.anchorWarning&&<HelpParagraph>{r.anchorWarning}</HelpParagraph>}
   {r.areaM2!==null&&<HelpParagraph>Surface {r.areaBasis==='planned'?'prévue':'semée'} utilisée une seule fois : {fmt(r.areaM2/10000)} ha.</HelpParagraph>}
   <details><summary>Voir les profils, produits et limites</summary>
    {r.profiles.map(p=><HelpParagraph key={p.id}><strong>{p.label}</strong> : {fmt(p.withoutKgHa/1000)} → {fmt(p.withKgHa/1000)} t/ha. Fourniture du sol N/P/K : {p.supplyKgHa.map(n=>fmt(n,1)).join(' / ')} kg/ha ; récupération N/P/K : {p.recovery.map(n=>fmt(n*100,0)+' %').join(' / ')}.</HelpParagraph>)}
    {r.calendar.map(p=><HelpParagraph key={p.id}>{p.date} · {p.product} · {fmt(p.dose)} {p.unit} · {p.status==='declared'?'réalisé':'prévu'}{p.totalProduct!==null?` · total ${fmt(p.totalProduct)} ${p.unit==='kg/ha'?'kg':'L'}`:''}.</HelpParagraph>)}
    <HelpParagraph>Calendrier repris de vos saisies ; effet des dates et du fractionnement non simulé.</HelpParagraph>
   </details>
  </div>}
  <HelpParagraph>Cette plage est une analyse de sensibilité, <strong>pas un intervalle de confiance à 95 %</strong>. L’absence de réponse et les pertes ne sont pas exclues. Aucun optimum de dose n’est proposé.</HelpParagraph>
  {result&&<details><summary>Limites du calcul</summary>{result.limits.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}</details>}
  <HelpParagraph><a href={QUEFTS_SOURCE} target="_blank" rel="noreferrer">Shehu et al., 2019 · QUEFTS pour le maïs en savanes nigérianes</a></HelpParagraph>
  <button className="btn secondary" type="button" onClick={()=>onAdvanced('conseils')}>Renseigner ou modifier mes produits et doses</button>
 </div>;
}
