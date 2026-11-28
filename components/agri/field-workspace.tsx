'use client';
import { HelpParagraph } from './help-dialog';
import {useEffect,useRef,useState} from 'react';
import {FIELD_VISIT_OUTCOMES,type FieldVisitTarget,type FieldVisitOutcome} from '../../lib/seasonal/agronomic';
import type {FieldMapFocus} from '../../lib/seasonal/field-analysis';
import type {Position} from '../../lib/seasonal/parcel';
import {fertilizerScope} from '../../lib/seasonal/fertilizer-scenario';
import {ProductIcon,ParcelFootprint,Disclosure} from './product-ui';
import {addFieldNote,fieldBrief,fieldNotes,NOTE_PARAMETERS,weatherLabel,type FieldAction} from '../../lib/seasonal/field-intelligence';
import {COUNTRIES,type SeasonalConfig,type WaterPlan,type WaterEvent} from '../../lib/seasonal/types';
import {seasonalCapabilities} from '../../lib/seasonal/capabilities';
import {latestOfficialYieldReference} from '../../lib/seasonal/historical-context';
import AgronomistBrief from './agronomist-brief';
const fmt=(n:number|null|undefined,d=1)=>n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const date=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
type Props={config:SeasonalConfig;plan:WaterPlan|null;events:WaterEvent[];stale:boolean;loading:boolean;failed?:boolean;simple?:boolean;advisor?:boolean;onDetails?:()=>void;onRetry?:()=>void;onAction:(target:FieldAction['target'],focus?:FieldMapFocus)=>void};
function FieldActions({actions,onAction}:{actions:FieldAction[];onAction:Props['onAction']}){
 const [primary,...other]=actions;
 function item(action:FieldAction){
  return <div className="overview-other-action">
   {action.level==='urgent'&&<strong>Urgence terrain</strong>}
   <button type="button" onClick={()=>onAction(action.target,action.focus)}>{action.title} <ProductIcon name="arrow" size={14}/></button>
   <HelpParagraph>{action.reason}</HelpParagraph>
   {action.target==='images'&&<small>
    {action.imageDate?<time dateTime={action.imageDate}>{new Date(action.imageDate+'T12:00:00Z').toLocaleDateString('fr-FR')}</time>:'Date indisponible'}
    {' · '}{action.visibleM2===undefined?'Surface visible inconnue':fmt(action.visibleM2/10000,3)+' ha visibles'}
   </small>}
   <details><summary>Voir le repère</summary><HelpParagraph>{action.source}</HelpParagraph></details>
  </div>;
 }
 return <section className="overview-actions">
  <div className="overview-card-header"><h3>À vérifier maintenant</h3></div>
  {primary?item(primary):<HelpParagraph>Aucun point automatique prioritaire.</HelpParagraph>}
  {!!other.length&&<Disclosure title={other.length===1?'Autre point à vérifier':other.length+' autres points à vérifier'}>{other.map(action=><div key={action.id}>{item(action)}</div>)}</Disclosure>}
 </section>;
}
export function FieldOverview({config:c,plan,events,stale,loading,failed=false,simple=false,advisor=false,onDetails,onRetry,onAction}:Props){
 const b=fieldBrief(c,failed?null:plan,events,stale&&!failed,loading&&!failed);
 const waterModelSelected=c.yieldEstimation?.method==='fao-stages'||c.yieldEstimation?.method==='fao-seasonal';
 const automaticRequested=!!c.automaticYield?.enabled&&!c.canopyNowcast&&(!c.yieldEstimation||c.yieldEstimation.method==='automatic');
 const integrated=(!!c.growth||!!plan?.automaticYield||automaticRequested)&&!waterModelSelected,growth=b.growth;
 const sown=integrated?plan?.growth?.areaM2:b.estimate?.surface.simulationM2??b.estimate?.surface.sownM2;
 const water=!failed&&!stale&&!loading?plan?.waterImpact?.scenarios.find(s=>s.id===b.mode):undefined;
 const canShowHarvest=!failed&&!stale&&!loading;
 const candidateNowcast=canShowHarvest&&plan?.canopyNowcast?.status==='experimental_nowcast'&&plan.canopyNowcast.yieldKgHa!==null?plan.canopyNowcast:undefined;
 const relative=canShowHarvest&&!integrated&&!b.result&&water?.relativeYieldPercent!=null;
 const fertilizer=!waterModelSelected&&!integrated&&!failed&&!stale&&!loading&&c.fertilizerScenario?.scope===fertilizerScope(c)&&plan?.fertilizerScenario?.status==='exploratory_transfer'?plan.fertilizerScenario.results:null;
 const nowcast=!waterModelSelected&&!integrated&&!b.result&&!fertilizer?candidateNowcast:undefined;
 const productionAreaM2=integrated?plan?.growth?.areaM2:nowcast?nowcast.areaM2:fertilizer?fertilizer.areaM2:sown;
 const productionAreaBasis=integrated?plan?.growth?.areaBasis:nowcast?nowcast.areaBasis:fertilizer?fertilizer.areaBasis:b.estimate?.surface.areaBasis;
 const capability=seasonalCapabilities(c.country,c.cropProfile?.id);
 const calculating=!failed&&(stale||loading);
 const needsAssumptionConfirmation=!c.inputPolicy?.allowAssumptions&&Object.values(c.inputs?.values??{}).some(v=>v.status==='assumed');
 const hasYield=canShowHarvest&&(integrated?!!growth:nowcast?nowcast.yieldKgHa!==null:fertilizer?true:b.result?.yieldKgHaSown!=null);
 const hasProduction=canShowHarvest&&(integrated?!!growth:nowcast?nowcast.productionKg!==null:fertilizer?fertilizer.productionWithKg!==null:b.result?.productionKg!=null);
 const officialYield=canShowHarvest&&!hasYield?latestOfficialYieldReference(c.country,c.cropProfile?.id??'',c.asOfDate):null;
 // A configured growth scenario has its own result and missing-data reasons.
 // Do not describe it as an unconfigured automatic forecast.
 const automaticUnavailable=(!c.yieldEstimation||c.yieldEstimation.method==='automatic')&&!integrated&&!nowcast;
 const yieldMode=c.yieldScenario??(c.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded');
 const modelMissing=[...(plan?.automaticYield?.missing??[]),...(integrated&&plan?.growth?.status==='unavailable'?plan.growth.missing:[]),...(plan?.yieldEstimation?.missing??[]),...(plan?.yieldEstimation?.scenarios.find(s=>s.id===yieldMode)?.missing??[])].find(Boolean);
 const unavailableReason=integrated?'La simulation de croissance ne produit pas de rendement pour ce scénario. Consultez les données et les options indiquées dans les résultats.'
  :automaticUnavailable?'Le calcul automatique du rendement parcellaire n’est pas encore raccordé. Consultez les possibilités conditionnelles et les informations nécessaires à leur utilisation.'
  :['fao-seasonal','fao-stages'].includes(c.yieldEstimation?.method??'')?'La réponse hydrique ne produit pas de rendement pour ce scénario. Consultez les informations manquantes et les limites de cette méthode dans les résultats.'
  :'Ce scénario ne fournit pas de rendement actuel. Consultez les méthodes disponibles et leurs limites dans les résultats.';
 const resultMeaning=failed
  ?'Le dernier calcul n’a pas abouti. Consultez le message d’erreur de la campagne et relancez le calcul.'
  :calculating?'Les données sont en cours de traitement. Les résultats précédents ne sont pas présentés comme actuels.'
  :integrated&&growth
  ?'Ce rendement vient d’un scénario de croissance intégré. Les paramètres et les interactions ne sont pas validés localement pour cette culture et cette zone.'
  :nowcast
   ?'Nowcast expérimental du maïs au nord du Ghana, après observation du LAI vert. Le test réservé de 2021 a porté sur 10 champs (RMSE 0,57 t/ha) ; aucune autre saison ou zone n’est validée, et l’humidité du grain de référence est inconnue.'
  :fertilizer
   ?fertilizer.calibration==='benin-microdose-aggregate-v1'?'Réponse aux microdoses du nord du Bénin, ancrée à un témoin sans engrais saisi. Contrôle sur deux moyennes de traitements seulement ; ce n’est pas une prévision de rendement de base validée pour votre parcelle.':'L’effet des engrais est exploratoire et transféré de profils de culture hors de votre zone. Il ne constitue pas une recommandation locale et ne s’ajoute pas au calcul de l’eau.'
   :relative
    ?'Ce score sur 100 exprime uniquement l’effet simulé du manque d’eau par rapport à une référence sans déficit. Ce n’est pas un rendement en tonnes.'
    :b.result
     ?'Simulation hydrique expérimentale non validée pour votre parcelle. Le rendement en t/ha dépend d’une référence indépendante et du stress hydrique simulé. Les effets des nutriments et des autres contraintes ne sont pas intégrés.'
     :unavailableReason;
 const span=(v:[number,number]|null)=>v?`${fmt(v[0]/1000,2)} – ${fmt(v[1]/1000,2)}`:'—';
 const waterStatus=failed?'À relancer':stale?'Recalcul en cours':loading?'Calcul en cours':b.usable?'Bilan disponible':'À vérifier';
 const harvestStatus=failed?'Calcul interrompu':calculating?'Résultats en cours de mise à jour':relative?'Indice hydrique disponible ; rendement non simulé':nowcast?'Nowcast expérimental du couvert disponible':hasYield&&!hasProduction?'Rendement calculé ; production totale indisponible':automaticUnavailable?'Modèle automatique de rendement indisponible':modelMissing?'Donnée nécessaire à vérifier':'Rendement et production non calculables';
 const harvestMessage=failed
  ?'Consultez le message d’erreur en haut de la page puis relancez le calcul. Vos paramètres restent conservés.'
  :calculating?'Cette page s’actualisera dès que le bilan sera terminé.'
  :relative?'Un indice hydrique est disponible, mais il mesure seulement l’effet relatif de l’eau. Il ne donne ni rendement en t/ha ni production en tonnes.'
  :nowcast?'Le chiffre est estimé à partir de mesures de LAI vert prises pendant deux semaines. Il s’agit d’un nowcast expérimental local, pas d’une prévision avant semis ni d’un effet simulé de l’eau ou des engrais.'
  :fertilizer&&!hasProduction?'Le scénario d’engrais ne peut pas calculer la production sans surface prévue ou semée.'
  :integrated&&modelMissing?`La simulation intégrée reste indisponible pour cette campagne : ${modelMissing}`
  :automaticUnavailable?'AgriPrévision ne produit pas encore de prévision automatique du rendement parcellaire pour cette campagne.'
  :modelMissing?`Le calcul ne peut pas produire de rendement ou de production pour cette campagne : ${modelMissing}`
  :hasYield&&!hasProduction?'Le rendement est disponible, mais le calcul ne fournit pas la production totale. Vérifiez la surface associée à la méthode.'
  :unavailableReason;
 const missingYieldAction=!hasYield&&!automaticUnavailable&&!!modelMissing;
 const nextStepTitle=failed?'Relancer le calcul':calculating?'Préparation des données':automaticUnavailable?'Rendement du champ non simulé':missingYieldAction?'Une information est à vérifier':needsAssumptionConfirmation?'Vérifier les hypothèses d’eau':hasYield&&integrated?'Comprendre la simulation indicative':b.usable?'Voir quand la culture peut manquer d’eau':'Préparer le calcul de l’eau';
 const nextStepCopy=failed?'Le calcul s’est interrompu ; vos paramètres sont conservés dans la campagne en cours.':calculating?'Le terrain, le sol et la météo sont en cours de préparation.':automaticUnavailable?'Ouvrez l’explication du rendement ; les informations sur l’eau sont consultables séparément.':missingYieldAction?'Le calcul indique : '+modelMissing+' Ouvrez le détail pour voir si cette information peut être renseignée.':needsAssumptionConfirmation?automaticRequested?'Vérifiez les hypothèses du profil, du sol et de l’arrosage avant de lancer la simulation indicative.':'Ouvrez les hypothèses du sol et de l’arrosage avant de les confirmer. Cela calcule l’eau uniquement, pas les tonnes.':hasYield&&integrated?'Consultez le profil, les hypothèses et les facteurs qui limitent la croissance.':b.usable?'Consultez les périodes où la culture peut manquer d’eau et les arrosages proposés. Ce calcul ne donne pas une prévision de récolte en tonnes.':'Ouvrez cette page pour voir les besoins en eau, la météo et les arrosages à vérifier.';
 const nextButtonLabel=failed?'Relancer le calcul':calculating?'Calcul en cours':needsAssumptionConfirmation?'Vérifier les hypothèses':hasYield&&(integrated||waterModelSelected)?'Voir le modèle et le résultat':b.usable?'Voir les périodes de manque d’eau':'Voir les besoins en eau';
 const detailsButtonLabel=automaticUnavailable?'Pourquoi pas de rendement ?':modelMissing?'Voir ce qui manque':'Voir les détails du rendement';
 function nextStepAction(){if(failed){if(onRetry)onRetry();else onDetails?.();return;}onAction(hasYield&&(integrated||waterModelSelected)?'yield':'water');}
 if(simple)return <>{!!c.parcelGeometry&&<FieldActions actions={b.actions} onAction={onAction}/>}<section id="farmer-harvest-card" tabIndex={-1} className="farmer-harvest-card" aria-label="Résultat de la campagne">
  <div className="farmer-harvest-heading">
  <div className="farmer-result-title-row"><div><span className="farmer-simple-kicker">RÉSULTATS DE LA CAMPAGNE</span><h2>Votre récolte · {c.crop}</h2><p>{failed?'Le calcul a été interrompu ; vos paramètres sont conservés dans la campagne en cours.':calculating?'Les informations du champ sont en cours de calcul.':nowcast?'Nowcast expérimental après mesures de LAI · maïs du nord du Ghana.':hasYield||hasProduction?integrated||fertilizer?'Scénario exploratoire, non validé localement.':'Simulation hydrique expérimentale, non validée pour votre parcelle.':automaticUnavailable?'La récolte en tonnes ne peut pas encore être simulée automatiquement pour votre champ.':'Le calcul ne fournit pas encore de rendement pour cette campagne.'}</p></div><span className={'farmer-result-badge'+(hasYield?' is-ready':'')}>{failed?'À relancer':calculating?'Calcul en cours':nowcast?'Nowcast local expérimental':hasYield?integrated||fertilizer?'Exploratoire':'Expérimental':relative?'Effet de l’eau seulement':automaticUnavailable?'Pas simulé':'À vérifier'}</span></div>
  </div>
  <div className="farmer-harvest-values">
   {(hasYield||relative)?<article className="farmer-harvest-value"><span>{nowcast?'Grain estimé par le couvert':relative&&!fertilizer?'Effet estimé de l’eau':integrated?'Rendement du scénario':fertilizer?'Rendement avec les apports prévus':'Rendement estimé'}</span><strong>{integrated?fmt(growth!.yieldKgHa/1000,2):nowcast?fmt(nowcast.yieldKgHa===null?null:nowcast.yieldKgHa/1000,2):fertilizer?span(fertilizer.yieldWithKgHa):relative?fmt(water!.relativeYieldPercent):fmt(b.result!.yieldKgHaSown!/1000,2)} <small>{relative&&!fertilizer?'sur 100':'t/ha'}</small></strong><em>{nowcast?'LAI mesuré · humidité du grain non précisée dans le jeu de référence.':relative&&!fertilizer?'Cet indice décrit uniquement l’effet de l’eau. Ce n’est pas un rendement.':integrated||fertilizer?'Scénario exploratoire, à vérifier avec un conseiller.':'Estimation liée au bilan d’eau et à la référence utilisée.'}</em></article>:<article className="farmer-harvest-value is-unavailable"><span>Rendement du champ</span><strong>{failed?'Calcul interrompu':calculating?'Calcul en cours':automaticUnavailable?'Pas simulé':'À vérifier'}</strong><em>{failed?'Consultez l’erreur de la campagne et relancez le calcul.':automaticUnavailable?'Aucun modèle automatique ne calcule les t/ha de ce champ dans cette version. Vous n’avez pas à saisir un chiffre au hasard.':modelMissing??unavailableReason}</em></article>}
   {hasProduction?<article className="farmer-harvest-value"><span>{nowcast?'Production selon le couvert':'Production totale estimée'}</span><strong>{integrated?fmt(growth!.productionKg/1000,2):nowcast?fmt(nowcast.productionKg===null?null:nowcast.productionKg/1000,2):fertilizer?span(fertilizer.productionWithKg):fmt(b.result!.productionKg/1000,2)} <small>tonnes</small></strong><em>{productionAreaM2==null?'Surface associée non disponible':`Pour ${fmt(productionAreaM2/10000,3)} ha ${productionAreaBasis==='planned'?'prévus':productionAreaBasis==='sown'?'semés':'de surface associée'}`}.</em></article>:<article className="farmer-harvest-value is-unavailable"><span>Production totale</span><strong>{failed?'Calcul interrompu':calculating?'Calcul en cours':automaticUnavailable?'Pas estimée':'À vérifier'}</strong><em>{failed?'La production ne peut pas être calculée tant que le calcul est interrompu.':automaticUnavailable?'Sans rendement du champ calculé, le total en tonnes ne peut pas être estimé.':modelMissing??'Une surface utilisable et un rendement calculé sont nécessaires.'}</em></article>}
  </div>
  {automaticUnavailable&&!hasYield&&!failed&&!calculating&&<div className="farmer-no-yield-notice"><span aria-hidden="true">i</span><div><strong>Pourquoi ce résultat manque ?</strong><p>Vérifier le sol ou confirmer l’eau aide à comprendre les besoins de la culture, mais ne crée pas de prévision automatique en tonnes. D’autres méthodes sont accessibles avec leurs conditions dans le détail du rendement.</p></div></div>}
  {b.usable&&<section className="farmer-water-summary" aria-label="Résumé des besoins en eau"><div className="farmer-water-summary-heading"><div><span className="farmer-simple-kicker">EAU · SCÉNARIO CONDITIONNEL</span><h3>Part estimée des besoins couverte</h3></div><strong>{Math.min(100,Math.max(0,Math.round(plan!.totals.actualEtMm/plan!.totals.demandMm*100)))}<small>%</small></strong></div><div className="farmer-water-meter" role="img" aria-label={'Part estimée des besoins en eau couverte à '+Math.min(100,Math.max(0,Math.round(plan!.totals.actualEtMm/plan!.totals.demandMm*100)))+' pour cent'}><span style={{width:Math.min(100,Math.max(0,plan!.totals.actualEtMm/plan!.totals.demandMm*100))+'%'}}/></div><p>Estimation sur le cycle à partir de la météo, du sol et des arrosages retenus. Ce pourcentage décrit l’eau, pas le rendement.</p></section>}
  {officialYield&&<details className="farmer-reference-details"><summary>Voir le repère statistique national · FAOSTAT {officialYield.year}</summary><div className="farmer-reference-value"><strong>{fmt(officialYield.kgHaHarvested/1000,2)} t/ha</strong><span>{c.crop} au {COUNTRIES[c.country].name} · {officialYield.year}</span></div><p>{officialYield.scope} Rendement observé par hectare récolté à l’échelle du pays. Ce n’est ni une mesure de votre champ ni une prévision. Il ne sert pas à calculer la récolte de cette parcelle.</p><small>Archive {officialYield.version} · acquise le {date(officialYield.acquiredAt.slice(0,10))}</small><a href={officialYield.source} target="_blank" rel="noreferrer">Consulter la source statistique</a></details>}
  <div className={'farmer-next-step'+(!hasYield&&!failed&&!calculating?' is-yield-blocked':'')}><div><span className="farmer-simple-kicker">{failed?'CALCUL À RELANCER':calculating?'PRÉPARATION':'PROCHAINE ACTION'}</span><strong>{nextStepTitle}</strong><p>{nextStepCopy}</p></div><div className="farmer-next-actions">{!hasYield&&!failed&&!calculating&&<button className="farmer-yield-details-action is-primary" onClick={onDetails}>{detailsButtonLabel} <ProductIcon name="arrow" size={16}/></button>}<button className="farmer-water-action" disabled={calculating} onClick={nextStepAction}>{nextButtonLabel} <ProductIcon name="arrow" size={16}/></button></div></div>
 </section></>;
 return <section className="field-overview product-overview" aria-label="Synthèse de la parcelle">
  <div className="overview-heading"><div><span className="product-eyebrow">VOTRE CAMPAGNE EN UN COUP D’ŒIL</span><h2>Rendement et production</h2><p>Chaque résultat dépend du modèle et des données disponibles pour votre campagne.</p></div><span>Au {date(c.asOfDate)}</span></div>
  {(!hasYield||!hasProduction)&&<section className={'harvest-result-card'+(failed?' is-error':'')} aria-label="État du rendement et de la production">
   <div className="harvest-result-copy"><span className="product-eyebrow">ÉTAT DU CALCUL</span><h3 role="status" aria-live="polite" aria-atomic="true">{harvestStatus}</h3><p>{harvestMessage}</p></div>
   <button className="btn primary" onClick={()=>onAction('yield')}>Voir les méthodes et données disponibles <ProductIcon name="arrow" size={17}/></button>
   <details><summary>Pourquoi ce résultat a-t-il ce statut ?</summary><div><p><strong>Lieu et culture :</strong> {COUNTRIES[c.country].name} · {c.crop}.</p><p><strong>Bilan d’eau :</strong> {capability.waterSimulation.reason}</p><p><strong>Prévision de rendement :</strong> {capability.seasonalYieldForecast.reason}</p><p><strong>Engrais :</strong> {capability.personalizedFertilization.reason}</p></div></details>
  </section>}
  <div className={`result-metrics metrics-${Number(hasYield||relative)+Number(hasProduction)+1}`}>
   {(hasYield||relative)&&<button onClick={()=>onAction(fertilizer?'fertilizer':'yield')}><span><ProductIcon name="chart" size={17}/>{nowcast?'NOWCAST EXPÉRIMENTAL · COUVERT':integrated?'RENDEMENT INTÉGRÉ SIMULÉ':fertilizer?'RENDEMENT AVEC ENGRAIS PRÉVUS':relative?'INDICE HYDRIQUE':'RENDEMENT HYDRIQUE'}</span><strong>{integrated?fmt(growth!.yieldKgHa/1000,2):nowcast?fmt(nowcast.yieldKgHa===null?null:nowcast.yieldKgHa/1000,2):fertilizer?span(fertilizer.yieldWithKgHa):relative?fmt(water!.relativeYieldPercent):fmt(b.result!.yieldKgHaSown!/1000,2)} <small>{relative&&!fertilizer?'/ 100':'t/ha'}</small></strong><em>{nowcast?'LAI mesuré · maïs nord Ghana · expérimental':integrated?'Croissance journalière · non validée':fertilizer?'Exploratoire · non validé localement':relative?'Effet de l’eau seulement':'Selon le déficit d’eau'} <ProductIcon name="arrow" size={14}/></em></button>}
   {hasProduction&&<button onClick={()=>onAction(fertilizer?'fertilizer':'yield')}><span><ProductIcon name="basket" size={17}/>{nowcast?'PRODUCTION · NOWCAST LOCAL':fertilizer?'RÉCOLTE AVEC ENGRAIS PRÉVUS':'PRODUCTION SIMULÉE'}</span><strong>{integrated?fmt(growth!.productionKg/1000,2):nowcast?fmt(nowcast.productionKg===null?null:nowcast.productionKg/1000,2):fertilizer?span(fertilizer.productionWithKg):fmt(b.result!.productionKg/1000,2)} <small>tonnes</small></strong><em>{nowcast?`${fmt(nowcast.areaM2==null?null:nowcast.areaM2/10000,3)} ha ${nowcast.areaBasis==='planned'?'prévus':nowcast.areaBasis==='sown'?'semés':'déclarés'}`:integrated?`${fmt(sown==null?null:sown/10000,3)} ha · produit à ${plan?.growth?.moisturePercent} % d’humidité`:fertilizer?fertilizer.areaM2===null?'Surface à confirmer':`${fmt(fertilizer.areaM2/10000,3)} ha ${fertilizer.areaBasis==='planned'?'prévus':'semés'}`:`${fmt(sown==null?null:sown/10000,3)} ha ${b.estimate?.surface.areaBasis==='planned'?'prévus':'semés'}`} <ProductIcon name="arrow" size={14}/></em></button>}
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
   <FieldActions actions={b.actions} onAction={onAction}/>
  </div>
  <section className="overview-cycle"><div><h3>Du semis à la récolte</h3><span>{b.stage} · cycle de référence de {b.duration} jours</span></div><div className="field-stage-track">{b.stages.map((s,i)=><div key={i} className={s.state} style={{flex:s.days}}><b>{s.name}</b><small>{date(s.from)} – {date(s.to)}</small><span aria-hidden="true"/></div>)}</div><HelpParagraph>Dates indicatives selon le cycle de référence ; levée et maturité à vérifier au champ.</HelpParagraph></section>
  <Disclosure title="La météo des 7 prochains jours" description={`${b.covered}/7 jours renseignés hors scénarios personnels${b.rain!==null?` · ${fmt(b.rain)} mm cumulés`:''}`}><div className="field-weather-days">{b.weather.map(({date:d,day:w})=><article key={d}><time dateTime={d}>{new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})}</time><ProductIcon name="sun"/><strong>{fmt(w?.rainMm)} <small>mm</small></strong><span>{w?.temperatureMinC!=null&&w?.temperatureMaxC!=null?`${fmt(w.temperatureMinC)}° / ${fmt(w.temperatureMaxC)}°`:w?.temperatureMeanC!=null?`${fmt(w.temperatureMeanC)} °C moy.`:'Temp. indisponible'}</span><em>{weatherLabel(w)}</em></article>)}</div><details><summary>Sources et portée</summary>{b.sources.map(s=><HelpParagraph key={s}>{s}</HelpParagraph>)}<HelpParagraph>Une donnée sur une maille ne mesure pas la pluie exacte de la parcelle. Les cases vides restent inconnues.</HelpParagraph></details></Disclosure>
  {advisor&&<AgronomistBrief config={c} plan={failed?null:plan} events={events} stale={stale} loading={loading}/>}
 </section>;
}
type PositionText={latitude:string;longitude:string};
const positionText=(p?:Position):PositionText=>({latitude:p?String(Number(p[1].toFixed(7))):'',longitude:p?String(Number(p[0].toFixed(7))):''});
function positionValue(p:PositionText):Position|undefined{
 const latitude=p.latitude.trim(),longitude=p.longitude.trim();
 if(!latitude&&!longitude)return;
 const decimal=/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
 if(!decimal.test(latitude)||!decimal.test(longitude))throw new Error('Indiquez les deux coordonnées en degrés décimaux ou laissez les deux cases vides.');
 return [Number(longitude.replace(',','.')),Number(latitude.replace(',','.'))];
}
function PositionFields({label,value,onChange}:{label:string;value:PositionText;onChange:(value:PositionText)=>void}){
 return <fieldset><legend>{label}</legend><div className="form-grid">
  {(['latitude','longitude'] as const).map(axis=><label className="field" key={axis}>
   <span>{axis==='latitude'?'Latitude':'Longitude'}</span>
   <input inputMode="decimal" maxLength={24} aria-label={label+' · '+axis} value={value[axis]} onChange={e=>onChange({...value,[axis]:e.target.value})}/>
  </label>)}
 </div></fieldset>;
}
export function FieldNotebook({config:c,campaignId,visit,onChange,onOpenMap}:{config:SeasonalConfig;campaignId?:string;visit?:FieldVisitTarget;onChange:(c:SeasonalConfig)=>void;onOpenMap?:(focus:FieldMapFocus)=>void}){
 const [n,setN]=useState({parameter:'Levée',date:c.asOfDate,note:'',observer:''}),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [planned,setPlanned]=useState(()=>positionText(visit?.planned)),[comparison,setComparison]=useState(()=>positionText(visit?.comparison)),[observed,setObserved]=useState(()=>positionText());
 const [outcome,setOutcome]=useState<FieldVisitOutcome|''>(''),[gpsStatus,setGpsStatus]=useState('');
 const title=useRef<HTMLHeadingElement>(null);
 const notes=fieldNotes(c);
 useEffect(()=>{if(visit)title.current?.focus();},[visit]);
 function exportNotes(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({parcel:c.name,country:c.country,geometry:c.parcelGeometry,asOfDate:c.asOfDate,observations:notes},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='carnet-observations.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function getPosition(){
  const fail=()=>setGpsStatus('Position GPS indisponible. Vous pouvez saisir les coordonnées à la main.');
  if(!navigator.geolocation){fail();return;}
  setGpsStatus('Recherche de votre position…');
  navigator.geolocation.getCurrentPosition(({coords})=>{
   setObserved(positionText([coords.longitude,coords.latitude]));setGpsStatus('Position GPS ajoutée. Vous pouvez la corriger.');
  },fail,{enableHighAccuracy:true,timeout:10000});
 }
 function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setNotice('');
  try{
   const fieldVisit=visit&&outcome?{...visit,campaignId,planned:positionValue(planned),comparison:positionValue(comparison),observed:positionValue(observed),outcome}:undefined;
   if(visit&&!fieldVisit)throw new Error('Choisissez le constat de la visite.');
   onChange(addFieldNote(c,{...n,parameter:visit?'Visite terrain':n.parameter,visit:fieldVisit}));
   setN({...n,note:''});setObserved(positionText());setOutcome('');setGpsStatus('');setError('');
   setNotice('Note ajoutée à la campagne. Cliquez sur Enregistrer pour la conserver dans votre espace.');
  }catch(e){setError((e as Error).message);}
 }
 return <section className="qs-card field-notebook">
  <div className="field-panel-title"><div><h2 ref={title} tabIndex={-1}>Mon carnet de terrain</h2></div><button className="btn secondary small" disabled={!notes.length} onClick={exportNotes}>Exporter le carnet</button></div>
  {visit&&<div>
   <h3>{visit.zone?'Vérifier la zone sur place':'Visite libre'}</h3>
   {!!visit.dates.length&&<p>Images du {visit.dates.map(d=>new Date(d+'T12:00:00Z').toLocaleDateString('fr-FR')).join(' et du ')}</p>}
   {visit.zone&&<p>{fmt(visit.zone.areaM2,0)} m² à vérifier · grille de {visit.zone.gridM} m.
    {visit.zone.repeatedOn&&<> Écart retrouvé avec l’image du {new Date(visit.zone.repeatedOn+'T12:00:00Z').toLocaleDateString('fr-FR')}.</>}
   </p>}
  </div>}
  <form onSubmit={submit}>
   <div className="form-grid">
    {visit?<label className="field"><span>Constat</span><select required value={outcome} onChange={e=>setOutcome(e.target.value as FieldVisitOutcome|'')}>
     <option value="">Choisir le constat</option>{Object.entries(FIELD_VISIT_OUTCOMES).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>:<label className="field"><span>Ce que j’observe</span><select value={n.parameter} onChange={e=>setN({...n,parameter:e.target.value})}>
     {NOTE_PARAMETERS.map(v=><option key={v}>{v}</option>)}
    </select></label>}
    <label className="field"><span>Date de l’observation</span><input required type="date" max={c.asOfDate} value={n.date} onChange={e=>setN({...n,date:e.target.value})}/></label>
    <label className="field"><span>Observateur / source</span><input required maxLength={600} value={n.observer} onChange={e=>setN({...n,observer:e.target.value})}/></label>
   </div>
   {visit&&<>
    {visit.zone&&<div className="field-visit-positions">
     <PositionFields label="Point prévu dans la zone" value={planned} onChange={setPlanned}/>
     <PositionFields label="Point de comparaison" value={comparison} onChange={setComparison}/>
     {!visit.comparison&&<p>Pour ajouter un point de comparaison, choisissez la même culture au même stade.</p>}
    </div>}
    <PositionFields label="Position observée (facultative)" value={observed} onChange={setObserved}/>
    <button type="button" className="btn secondary small" onClick={getPosition}>Utiliser ma position GPS</button>
    {gpsStatus&&<p role="status">{gpsStatus}</p>}
   </>}
   <label className="field"><span>{visit?'Note libre (facultative)':'Où, quoi et quelle étendue ?'}</span>
    <textarea required={!visit} maxLength={1200} rows={3} value={n.note} onChange={e=>setN({...n,note:e.target.value})}/>
   </label>
   <button className="btn primary" type="submit">Ajouter l’observation</button>
  </form>
  {error&&<HelpParagraph role="alert">{error}</HelpParagraph>}{notice&&<HelpParagraph role="status">{notice}</HelpParagraph>}
  <div className="field-note-list">
   {notes.length?notes.map((o,i)=><article key={i}>
    <div><strong>{o.visit?FIELD_VISIT_OUTCOMES[o.visit.outcome]:o.parameter}</strong><time dateTime={o.availableOn}>{date(o.availableOn)}</time></div>
    {o.value&&<HelpParagraph>{String(o.value)}</HelpParagraph>}
    <small>{o.source}</small>
    {o.visit&&<>
     {o.visit.planned&&<small>Point prévu {positionText(o.visit.planned).latitude}, {positionText(o.visit.planned).longitude}</small>}
     {o.visit.comparison&&<small>Point de comparaison {positionText(o.visit.comparison).latitude}, {positionText(o.visit.comparison).longitude}</small>}
     <small>{o.visit.observed?'Position observée '+positionText(o.visit.observed).latitude+', '+positionText(o.visit.observed).longitude:'Position observée non renseignée'}</small>
     {onOpenMap&&<button type="button" className="qs-text-button" onClick={()=>onOpenMap({...o.visit!,fromNote:true})}>Revoir sur la carte</button>}
    </>}
   </article>):<HelpParagraph>Aucune note pour ce contour.</HelpParagraph>}
  </div>
 </section>;
}
