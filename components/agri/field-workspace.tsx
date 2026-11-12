'use client';
import { HelpParagraph } from './help-dialog';
import {useState} from 'react';
import {fertilizerScope} from '../../lib/seasonal/fertilizer-scenario';
import {ProductIcon,ParcelFootprint,Disclosure} from './product-ui';
import {addFieldNote,fieldBrief,fieldNotes,NOTE_PARAMETERS,weatherLabel,type FieldAction} from '../../lib/seasonal/field-intelligence';
import {COUNTRIES,type SeasonalConfig,type WaterPlan,type WaterEvent} from '../../lib/seasonal/types';
import {seasonalCapabilities} from '../../lib/seasonal/capabilities';
import AgronomistBrief from './agronomist-brief';
const fmt=(n:number|null|undefined,d=1)=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const date=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
type Props={config:SeasonalConfig;plan:WaterPlan|null;events:WaterEvent[];stale:boolean;loading:boolean;failed?:boolean;simple?:boolean;advisor?:boolean;onDetails?:()=>void;onAction:(target:FieldAction['target'])=>void};
export function FieldOverview({config:c,plan,events,stale,loading,failed=false,simple=false,advisor=false,onDetails,onAction}:Props){
 const b=fieldBrief(c,failed?null:plan,events,stale&&!failed,loading&&!failed);
 const stageGrain=!!c.yieldEstimation?.responseCalendar&&['fao-stages','fao-seasonal'].includes(c.yieldEstimation.method);
 const integrated=!!c.growth&&!stageGrain,growth=b.growth;
 const sown=integrated?plan?.growth?.areaM2:b.estimate?.surface.simulationM2??b.estimate?.surface.sownM2;
 const water=!failed&&!stale&&!loading?plan?.waterImpact?.scenarios.find(s=>s.id===b.mode):undefined;
 const canShowHarvest=!failed&&!stale&&!loading;
 const relative=canShowHarvest&&!integrated&&!b.result&&water?.relativeYieldPercent!=null;
 const fertilizer=!stageGrain&&!integrated&&!failed&&!stale&&!loading&&c.fertilizerScenario?.scope===fertilizerScope(c)&&plan?.fertilizerScenario?.status==='exploratory_transfer'?plan.fertilizerScenario.results:null;
 const capability=seasonalCapabilities(c.country,c.cropProfile?.id);
 const calculating=!failed&&(stale||loading);
 const automaticUnavailable=!c.yieldEstimation||c.yieldEstimation.method==='automatic';
 const yieldMode=c.yieldScenario??(c.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded');
 const modelMissing=[...(plan?.growth?.status==='unavailable'?plan.growth.missing:[]),...(plan?.yieldEstimation?.missing??[]),...(plan?.yieldEstimation?.scenarios.find(s=>s.id===yieldMode)?.missing??[])].find(Boolean);
 const unavailableReason=integrated?'La simulation de croissance ne produit pas de rendement pour ce scénario. Consultez les données et les options indiquées dans les résultats.'
  :automaticUnavailable?'Le calcul automatique du rendement parcellaire n’est pas encore raccordé. Consultez les possibilités conditionnelles et les informations nécessaires à leur utilisation.'
  :['fao-seasonal','fao-stages'].includes(c.yieldEstimation?.method??'')?'La réponse hydrique ne produit pas de rendement pour ce scénario. Consultez les informations manquantes et les limites de cette méthode dans les résultats.'
  :'Ce scénario ne fournit pas de rendement actuel. Consultez les méthodes disponibles et leurs limites dans les résultats.';
 const hasYield=canShowHarvest&&(integrated?!!growth:fertilizer?true:b.result?.yieldKgHaSown!=null);
 const hasProduction=canShowHarvest&&(integrated?!!growth:fertilizer?fertilizer.productionWithKg!==null:b.result?.productionKg!=null);
 const resultMeaning=failed
  ?'Le dernier calcul n’a pas abouti. Consultez le message d’erreur de la campagne et relancez le calcul.'
  :calculating?'Les données sont en cours de traitement. Les résultats précédents ne sont pas présentés comme actuels.'
  :integrated&&growth
  ?'Ce rendement vient d’un scénario de croissance intégré. Les paramètres et les interactions ne sont pas validés localement pour cette culture et cette zone.'
  :fertilizer
   ?'L’effet des engrais est exploratoire et transféré de profils de culture hors de votre zone. Il ne constitue pas une recommandation locale et ne s’ajoute pas au calcul de l’eau.'
   :relative
    ?'Ce score sur 100 exprime uniquement l’effet simulé du manque d’eau par rapport à une référence sans déficit. Ce n’est pas un rendement en tonnes.'
    :b.result
     ?'Le rendement en t/ha dépend d’une référence indépendante et du stress hydrique simulé. Les effets des nutriments et des autres contraintes ne sont pas intégrés.'
     :unavailableReason;
 const span=(v:[number,number]|null)=>v?`${fmt(v[0]/1000,2)} – ${fmt(v[1]/1000,2)}`:'—';
 const waterStatus=failed?'À relancer':calculating?'Calcul en cours':b.usable?'Bilan disponible':'À vérifier';
 const harvestStatus=failed?'Calcul interrompu':calculating?'Résultats en cours de mise à jour':relative?'Indice hydrique disponible ; rendement et production non calculables':hasYield&&!hasProduction?'Rendement calculé ; production totale indisponible':'Rendement et production non calculables';
 const harvestMessage=failed
  ?'Consultez le message d’erreur en haut de la page puis relancez le calcul. Vos paramètres restent conservés.'
  :calculating?'Cette page s’actualisera dès que le bilan sera terminé.'
  :relative?'Un indice hydrique est disponible, mais il mesure seulement l’effet relatif de l’eau. Il ne donne ni rendement en t/ha ni production en tonnes.'
  :fertilizer&&!hasProduction?'Le scénario d’engrais ne peut pas calculer la production sans surface prévue ou semée.'
  :integrated&&modelMissing?`La simulation intégrée reste indisponible pour cette campagne : ${modelMissing}`
  :automaticUnavailable?'Le calcul automatique du rendement parcellaire n’est pas raccordé. Le champ, la culture et le bilan d’eau ne suffisent pas à produire des tonnes : une méthode et une référence agronomique justifiées sont nécessaires.'
  :modelMissing?`Le calcul ne peut pas produire de rendement ou de production pour cette campagne : ${modelMissing}`
  :hasYield&&!hasProduction?'Le rendement est disponible, mais le calcul ne fournit pas la production totale. Vérifiez la surface associée à la méthode.'
  :unavailableReason;
 if(simple)return <section className="farmer-harvest-card" aria-label="Résultat de la campagne">
  <div className="farmer-harvest-heading"><span className="farmer-simple-kicker">VOTRE RÉSULTAT</span><h2>Rendement et production · {c.crop}</h2><p>{failed?'Le calcul a été interrompu.':calculating?'Les informations du champ sont en cours de calcul.':hasYield||hasProduction?`Résultat conditionnel pour votre campagne en ${COUNTRIES[c.country].name}.`:'Le rendement en tonnes n’est pas encore calculable pour cette campagne.'}</p></div>
  <div className="farmer-harvest-values">
   {(hasYield||relative)?<article className="farmer-harvest-value"><span>{relative&&!fertilizer?'Effet estimé de l’eau':integrated?'Rendement du scénario':fertilizer?'Rendement avec les apports prévus':'Rendement estimé'}</span><strong>{integrated?fmt(growth!.yieldKgHa/1000,2):fertilizer?span(fertilizer.yieldWithKgHa):relative?fmt(water!.relativeYieldPercent):fmt(b.result!.yieldKgHaSown!/1000,2)} <small>{relative&&!fertilizer?'sur 100':'t/ha'}</small></strong><em>{relative&&!fertilizer?'Cet indice décrit l’effet de l’eau. Ce n’est pas un rendement.':integrated||fertilizer?'Scénario exploratoire, à vérifier avec un conseiller.':'Estimation liée au bilan d’eau et à la référence utilisée.'}</em></article>:<article className="farmer-harvest-value is-unavailable"><span>Rendement en tonnes</span><strong>{calculating?'Calcul en cours':'Pas encore calculable'}</strong><em>{failed?'Relancez le calcul ou demandez l’aide d’un conseiller.':automaticUnavailable?'Le calcul automatique des tonnes n’est pas disponible pour cette campagne. Ouvrez les détails pour voir les méthodes et données manquantes.':'Une méthode ou une donnée nécessaire manque. Ouvrez les détails pour savoir laquelle.'}</em></article>}
   {hasProduction?<article className="farmer-harvest-value"><span>Récolte totale estimée</span><strong>{integrated?fmt(growth!.productionKg/1000,2):fertilizer?span(fertilizer.productionWithKg):fmt(b.result!.productionKg/1000,2)} <small>tonnes</small></strong><em>Pour {fmt(sown==null?null:sown/10000,3)} ha {plan?.yieldEstimation?.surface?.areaBasis==='planned'?'prévus':'semés'}.</em></article>:<article className="farmer-harvest-value is-unavailable"><span>Récolte totale estimée</span><strong>Pas encore calculable</strong><em>Une surface adaptée et un rendement calculé sont nécessaires.</em></article>}
  </div>
  <div className="farmer-water-note"><span className="farmer-water-symbol" aria-hidden="true">≈</span><div><strong>{b.usable&&plan?`${fmt(plan.totals.unmetEtMm)} mm de besoin en eau non couvert dans le calcul`:'Bilan d’eau à vérifier'}</strong><p>{b.usable?'C’est un repère de calcul, pas une mesure directe de la plante.':'Le bilan dépend des informations météo, du sol et des arrosages disponibles.'}</p></div></div>
  <button className="farmer-more-details" onClick={onDetails}>Voir les détails du rendement <ProductIcon name="arrow" size={17}/></button>
 </section>;
 return <section className="field-overview product-overview" aria-label="Synthèse de la parcelle">
  <div className="overview-heading"><div><span className="product-eyebrow">VOTRE CAMPAGNE EN UN COUP D’ŒIL</span><h2>Rendement et production</h2><p>Chaque résultat dépend du modèle et des données disponibles pour votre campagne.</p></div><span>Au {date(c.asOfDate)}</span></div>
  {(!hasYield||!hasProduction)&&<section className={'harvest-result-card'+(failed?' is-error':'')} aria-label="État du rendement et de la production">
   <div className="harvest-result-copy"><span className="product-eyebrow">ÉTAT DU CALCUL</span><h3 role="status" aria-live="polite" aria-atomic="true">{harvestStatus}</h3><p>{harvestMessage}</p></div>
   <button className="btn primary" onClick={()=>onAction('yield')}>Voir les méthodes et données disponibles <ProductIcon name="arrow" size={17}/></button>
   <details><summary>Pourquoi ce résultat a-t-il ce statut ?</summary><div><p><strong>Lieu et culture :</strong> {COUNTRIES[c.country].name} · {c.crop}.</p><p><strong>Bilan d’eau :</strong> {capability.waterSimulation.reason}</p><p><strong>Prévision de rendement :</strong> {capability.seasonalYieldForecast.reason}</p><p><strong>Engrais :</strong> {capability.personalizedFertilization.reason}</p></div></details>
  </section>}
  <div className={`result-metrics metrics-${Number(hasYield||relative)+Number(hasProduction)+1}`}>
   {(hasYield||relative)&&<button onClick={()=>onAction(fertilizer?'fertilizer':'yield')}><span><ProductIcon name="chart" size={17}/>{integrated?'RENDEMENT INTÉGRÉ SIMULÉ':fertilizer?'RENDEMENT AVEC ENGRAIS PRÉVUS':relative?'INDICE HYDRIQUE':'RENDEMENT HYDRIQUE'}</span><strong>{integrated?fmt(growth!.yieldKgHa/1000,2):fertilizer?span(fertilizer.yieldWithKgHa):relative?fmt(water!.relativeYieldPercent):fmt(b.result!.yieldKgHaSown!/1000,2)} <small>{relative&&!fertilizer?'/ 100':'t/ha'}</small></strong><em>{integrated?'Croissance journalière · non validée':fertilizer?'Exploratoire · non validé localement':relative?'Effet de l’eau seulement':'Selon le déficit d’eau'} <ProductIcon name="arrow" size={14}/></em></button>}
   {hasProduction&&<button onClick={()=>onAction(fertilizer?'fertilizer':'yield')}><span><ProductIcon name="basket" size={17}/>{fertilizer?'RÉCOLTE AVEC ENGRAIS PRÉVUS':'PRODUCTION SIMULÉE'}</span><strong>{integrated?fmt(growth!.productionKg/1000,2):fertilizer?span(fertilizer.productionWithKg):fmt(b.result!.productionKg/1000,2)} <small>tonnes</small></strong><em>{integrated?`${fmt(sown==null?null:sown/10000,3)} ha · produit à ${plan?.growth?.moisturePercent} % d’humidité`:fertilizer?fertilizer.areaM2===null?'Surface à confirmer':`${fmt(fertilizer.areaM2/10000,3)} ha ${fertilizer.areaBasis==='planned'?'prévus':'semés'}`:`${fmt(sown==null?null:sown/10000,3)} ha ${b.estimate?.surface.areaBasis==='planned'?'prévus':'semés'}`} <ProductIcon name="arrow" size={14}/></em></button>}
   <button onClick={()=>onAction('water')}><span><ProductIcon name="water" size={17}/>BILAN D’EAU</span>{b.usable&&plan?.totals.remainingSourceM3!=null?<strong>{fmt(plan.totals.remainingSourceM3,0)} <small>m³</small></strong>:<strong className="metric-unavailable">{waterStatus}</strong>}<em>{b.usable&&plan?.totals.remainingSourceM3!=null?'Volume restant proposé à la source':failed?'Consulter l’erreur de calcul':calculating?'Actualisation en cours':'Ouvrir le bilan et voir les données requises'} <ProductIcon name="arrow" size={14}/></em></button>
  </div>
  {(hasYield||hasProduction)&&<section className="result-explainer" aria-label="Comment interpréter les résultats">
   <div className="result-explainer-heading"><span>À RETENIR POUR VOTRE CAMPAGNE</span><strong>{failed?'Calcul interrompu':calculating?'Calcul en cours':hasYield||hasProduction?'Simulation conditionnelle':'Résultat non disponible'}</strong></div>
   <p>{resultMeaning}</p>
   <details><summary>Pourquoi ce résultat a-t-il ce statut ?</summary><div><p><strong>Lieu et culture :</strong> {COUNTRIES[c.country].name} · {c.crop}.</p><p><strong>Bilan d’eau :</strong> {capability.waterSimulation.reason}</p><p><strong>Prévision de rendement :</strong> {capability.seasonalYieldForecast.reason}</p><p><strong>Engrais :</strong> {capability.personalizedFertilization.reason}</p></div></details>
  </section>}
  {fertilizer&&<section className="fertilizer-overview"><div><span>Sans nouvel apport prévu</span><strong>{span(fertilizer.yieldWithoutKgHa)} <small>t/ha</small></strong></div><div><span>Supplément simulé</span><strong>+ {span(fertilizer.deltaKgHa)} <small>t/ha</small></strong></div><div><HelpParagraph>Deux profils nigérians, sans intervalle prédictif ni validation locale.</HelpParagraph><button onClick={()=>onAction('fertilizer')}>Voir la comparaison <ProductIcon name="arrow" size={15}/></button></div></section>}
  <div className="overview-grid">
   <section className="overview-parcel"><div className="overview-card-header"><h3>Ma parcelle</h3><button onClick={()=>onAction('map')}>Ouvrir la carte <ProductIcon name="arrow" size={15}/></button></div><button className="overview-map" onClick={()=>onAction('map')} aria-label="Ouvrir la carte de ma parcelle"><ParcelFootprint geometry={c.parcelGeometry}/><span>Contour dessiné · {fmt(c.areaM2==null?null:c.areaM2/10000,3)} ha</span></button><div className="overview-parcel-bottom"><span><i/>{COUNTRIES[c.country].name}</span><span>{c.crop}</span><span>Semis le {date(c.sowingDate)}</span></div></section>
   <section className="overview-actions"><div className="overview-card-header"><h3>À vérifier maintenant</h3><span>{b.actions.length} point{b.actions.length>1?'s':''}</span></div>{b.actions.length?<ol>{b.actions.slice(0,2).map((a,i)=><li key={a.id}><span className={'action-number '+a.level}>{String(i+1).padStart(2,'0')}</span><div><button onClick={()=>onAction(a.target)}>{a.title} <ProductIcon name="arrow" size={14}/></button><HelpParagraph>{a.reason}</HelpParagraph><details><summary>Voir le repère</summary><HelpParagraph>{a.source}</HelpParagraph></details></div></li>)}</ol>:<div className="overview-no-action"><ProductIcon name="check" size={25}/><HelpParagraph>Aucun point automatique prioritaire.<br/>Continuez vos observations au champ.</HelpParagraph></div>}{b.actions.length>2&&<Disclosure title={`${b.actions.length-2} autres points à vérifier`}>{b.actions.slice(2).map(a=><div className="overview-other-action" key={a.id}><button onClick={()=>onAction(a.target)}>{a.title} →</button><HelpParagraph>{a.reason}</HelpParagraph><small>{a.source}</small></div>)}</Disclosure>}</section>
  </div>
  <section className="overview-cycle"><div><h3>Du semis à la récolte</h3><span>{b.stage} · cycle de référence de {b.duration} jours</span></div><div className="field-stage-track">{b.stages.map((s,i)=><div key={i} className={s.state} style={{flex:s.days}}><b>{s.name}</b><small>{date(s.from)} – {date(s.to)}</small><span aria-hidden="true"/></div>)}</div><HelpParagraph>Dates indicatives selon le cycle de référence ; levée et maturité à vérifier au champ.</HelpParagraph></section>
  <Disclosure title="La météo des 7 prochains jours" description={`${b.covered}/7 jours renseignés hors scénarios personnels${b.rain!==null?` · ${fmt(b.rain)} mm cumulés`:''}`}><div className="field-weather-days">{b.weather.map(({date:d,day:w})=><article key={d}><time dateTime={d}>{new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})}</time><ProductIcon name="sun"/><strong>{fmt(w?.rainMm)} <small>mm</small></strong><span>{w?.temperatureMinC!=null&&w?.temperatureMaxC!=null?`${fmt(w.temperatureMinC)}° / ${fmt(w.temperatureMaxC)}°`:w?.temperatureMeanC!=null?`${fmt(w.temperatureMeanC)} °C moy.`:'Temp. indisponible'}</span><em>{weatherLabel(w)}</em></article>)}</div><details><summary>Sources et portée</summary>{b.sources.map(s=><HelpParagraph key={s}>{s}</HelpParagraph>)}<HelpParagraph>Une donnée sur une maille ne mesure pas la pluie exacte de la parcelle. Les cases vides restent inconnues.</HelpParagraph></details></Disclosure>
  {advisor&&<AgronomistBrief config={c} plan={failed?null:plan} events={events} stale={stale} loading={loading}/>}
 </section>;
}
export function FieldNotebook({config:c,onChange}:{config:SeasonalConfig;onChange:(c:SeasonalConfig)=>void}){
 const [n,setN]=useState({parameter:'Levée',date:c.asOfDate,note:'',observer:''}),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const notes=fieldNotes(c);
 function exportNotes(){const u=URL.createObjectURL(new Blob([JSON.stringify({parcel:c.name,country:c.country,geometry:c.parcelGeometry,asOfDate:c.asOfDate,observations:notes},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='carnet-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 return <section className="qs-card field-notebook"><div className="field-panel-title"><div><span className="qs-eyebrow">OBSERVER · COMPRENDRE · AGIR</span><h2>Mon carnet de terrain</h2></div><button className="btn secondary small" disabled={!notes.length} onClick={exportNotes}>Exporter le carnet</button></div><HelpParagraph>Gardez une trace de ce que vous voyez. Une observation visuelle aide à préparer une vérification ; elle ne constitue pas un diagnostic de maladie.</HelpParagraph>
  <form onSubmit={e=>{e.preventDefault();try{onChange(addFieldNote(c,n));setN({...n,note:''});setError('');setNotice('Note ajoutée à la campagne. Cliquez sur Enregistrer pour la conserver dans votre espace.');}catch(e){setError((e as Error).message);}}}><div className="form-grid"><label className="field"><span>Ce que j’observe</span><select value={n.parameter} onChange={e=>setN({...n,parameter:e.target.value})}>{NOTE_PARAMETERS.map(v=><option key={v}>{v}</option>)}</select></label><label className="field"><span>Date de l’observation</span><input required type="date" max={c.asOfDate} value={n.date} onChange={e=>setN({...n,date:e.target.value})}/></label><label className="field"><span>Observateur / source</span><input required maxLength={600} placeholder="Nom, conseiller ou carnet de suivi" value={n.observer} onChange={e=>setN({...n,observer:e.target.value})}/></label></div><label className="field"><span>Où, quoi et quelle étendue ?</span><textarea required maxLength={1200} rows={3} placeholder="Ex. : au bord nord, des feuilles jaunissent ; environ une plante sur dix. Cause à vérifier." value={n.note} onChange={e=>setN({...n,note:e.target.value})}/></label><button className="btn primary" type="submit">Ajouter l’observation</button></form>{error&&<HelpParagraph role="alert">{error}</HelpParagraph>}{notice&&<HelpParagraph role="status">{notice}</HelpParagraph>}
  <div className="field-note-list">{notes.length?notes.map((o,i)=><article key={i}><div><strong>{o.parameter}</strong><time dateTime={o.availableOn}>{date(o.availableOn)}</time></div><HelpParagraph>{String(o.value)}</HelpParagraph><small>{o.source} · observation déclarée, sans effet automatique sur le rendement</small></article>):<HelpParagraph>Aucune note pour ce contour. Commencez par observer la levée et l’état du champ.</HelpParagraph>}</div>
 </section>;
}
