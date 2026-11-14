'use client';

import {HelpParagraph} from './help-dialog';
import {COUNTRIES,type SeasonalConfig,type WaterEvent,type WaterPlan} from '../../lib/seasonal/types';
import {satelliteMonitoringScope} from '../../lib/seasonal/satellite';

const number=(value:number|null|undefined,digits=1)=>value==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(value);
const day=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const statusLabel:Record<string,string>={measured:'Mesuré',declared:'Déclaré',observed:'Observé',estimated:'Estimé',forecast:'Prévision',scenario:'Scénario',assumed:'Hypothèse',missing:'Manquant'};
const parameterLabel:Record<string,string>={pH:'pH',EC:'Conductivité',organicC:'Carbone organique',organicMatter:'Matière organique',totalN:'Azote total',mineralN:'Azote minéral',availableP:'Phosphore assimilable',exchangeableK:'Potassium échangeable',CEC:'CEC',Ca:'Calcium',Mg:'Magnésium',Na:'Sodium',S:'Soufre',Zn:'Zinc',B:'Bore',Al:'Aluminium'};

export default function AgronomistBrief({config,plan,events,stale,loading}:{config:SeasonalConfig;plan:WaterPlan|null;events:WaterEvent[];stale:boolean;loading:boolean}){
 const days=plan?.days??[];
 const periods=(plan?.stages??[]).filter(period=>period.demandMm>0||period.actualEtMm>0);
 const maximum=Math.max(1,...periods.map(period=>period.demandMm));
 const deficitDays=days.filter(row=>row.unmetEtMm>0.05).length;
 const deficitMm=days.reduce((sum,row)=>sum+row.unmetEtMm,0);
 const actualEvents=events.filter(event=>event.status==='measured'||event.status==='declared');
 const plannedProducts=config.managementPlan?.products.filter(product=>product.status==='planned')??[];
 const realizedProducts=config.managementPlan?.products.filter(product=>product.status==='declared')??[];
 const soilCapacity=config.soil.layers.reduce((sum,layer)=>sum+layer.thicknessM*(layer.thetaFC-layer.thetaWP)*1000,0);
 const soilInitialComplete=config.soil.layers.every(layer=>layer.initialTheta!==null);
 const initialReserve=soilInitialComplete?config.soil.layers.reduce((sum,layer)=>sum+layer.thicknessM*(layer.initialTheta!-layer.thetaWP)*1000,0):null;
 const evidence=Object.values(config.inputs?.values??{}).reduce<Record<string,number>>((counts,value)=>{counts[value.status]=(counts[value.status]??0)+1;return counts;},{});
 const weatherCounts=config.weather.reduce<Record<string,number>>((counts,value)=>{counts[value.status]=(counts[value.status]??0)+1;return counts;},{});
 const totalWeather=config.weather.length;
 const incompleteWeather=config.weather.filter(value=>value.rainMm===null||value.et0Mm===null).length;
 const satelliteArchive=config.satelliteMonitoring;
 const satelliteScopeMatches=satelliteArchive?.scope===satelliteMonitoringScope(config);
 const satelliteObservations=satelliteScopeMatches?(satelliteArchive?.observations??[]).filter(o=>o.date<=config.asOfDate&&o.availableOn<=config.asOfDate&&o.quality==='usable'&&o.ndviMedian!==null&&o.eviMedian!==null).sort((a,b)=>a.date.localeCompare(b.date)):[];
 const latestSatellite=satelliteObservations.at(-1),previousSatellite=satelliteObservations.at(-2);
 const satelliteDeltaNdvi=latestSatellite&&previousSatellite?latestSatellite.ndviMedian!-previousSatellite.ndviMedian!:null;
 const satelliteDeltaEvi=latestSatellite&&previousSatellite?latestSatellite.eviMedian!-previousSatellite.eviMedian!:null;
 const areaM2=plan?.calculationArea?.areaM2??config.areaM2;
 const method=plan?.yieldEstimation?.method;
 const canShowChart=periods.length>0&&!stale&&!loading;
 const growth=plan?.growth??null;
 const growthScenarioId=config.yieldScenario??(config.managementPlan?.irrigation.mode==='manual'?'proposed':'recorded');
 const growthScenario=growth?.scenarios.find(scenario=>scenario.id===growthScenarioId)??growth?.scenarios[0];
 const growthByStage=new Map<string,{name:string;from:string;to:string;biomassKgHa:number;cover:number|null;coverSource:string|null}>();
 for(const row of growthScenario?.days??[]){
  const stage=growthByStage.get(row.stage)??{name:row.stage,from:row.date,to:row.date,biomassKgHa:row.biomassKgHa,cover:null,coverSource:null};
  stage.to=row.date;stage.biomassKgHa=row.biomassKgHa;
  if(row.canopyCoverFraction!==null){stage.cover=row.canopyCoverFraction;stage.coverSource=row.canopyCoverSource;}
  growthByStage.set(row.stage,stage);
 }
 const growthStages=[...growthByStage.values()];
 const maxStageBiomass=Math.max(1,...growthStages.map(stage=>stage.biomassKgHa));

 return <section className="agronomist-brief" aria-labelledby="agronomist-brief-title">
  <header className="agronomist-brief-header">
   <div><span className="advisor-kicker">DÉTAILS AGRONOMIQUES · EXAMEN DE CAMPAGNE</span><h2 id="agronomist-brief-title">Diagnostic de campagne</h2><p>{config.name||'Parcelle sans nom'} · {COUNTRIES[config.country].name} · mise à jour demandée au {day(config.asOfDate)}</p></div>
   <span className={'advisor-calculation-status'+(stale||loading?' is-pending':'')}>{stale||loading?'Calcul en cours':'Données et calcul à examiner'}</span>
  </header>

  <div className="advisor-context-grid">
   <article><span>PARCELLE ET UNITÉ DE CALCUL</span><strong>{number(areaM2===null?null:areaM2/10000,3)} ha</strong><p>Surface utilisée par le bilan. Contour : {number(config.areaM2===null?null:config.areaM2/10000,3)} ha.</p><small>{config.territory||'Localité non précisée'} · {config.latitude==null||config.longitude==null?'coordonnées indisponibles':`${number(config.latitude,5)}, ${number(config.longitude,5)}`}</small></article>
   <article><span>CULTURE ET CYCLE</span><strong>{config.crop}{config.variety?` · ${config.variety}`:''}</strong><p>Semis : {day(config.sowingDate)} · {config.stages.reduce((sum,stage)=>sum+stage.days,0)} jours de référence.</p><small>Profil {config.cropProfile?.id??'non sélectionné'} · {config.cropProfile?.version??'version non documentée'} · {config.cropProfile?.mode==='custom'?'personnalisé':'référence'}</small></article>
   <article><span>EAU DISPONIBLE DANS LE CALCUL</span><strong>{plan?`${number(plan.totals.demandMm)} mm demandés`:'Bilan indisponible'}</strong><p>{plan?`${number(plan.totals.actualEtMm)} mm d’ET estimée · ${number(plan.totals.unmetEtMm)} mm non couverts`:'Attendez le bilan ou consultez les données manquantes.'}</p><small>{deficitDays} jour(s) avec une demande non satisfaite · résultat hydrique, pas rendement mesuré.</small></article>
   <article><span>PRATIQUES ET OBSERVATIONS</span><strong>{actualEvents.length} apport(s) ou observation(s) réalisés</strong><p>{plannedProducts.length} produit(s) prévu(s) · {realizedProducts.length} apport(s) déclaré(s) dans la campagne.</p><small>{config.managementPlan?.irrigation.applications.length??0} irrigation(s) planifiée(s) · {actualEvents.filter(event=>event.kind==='irrigation').length} événement(s) d’eau réalisé(s).</small></article>
  </div>

  <div className="advisor-analysis-grid">
   <section className="advisor-analysis-card advisor-water-analysis">
    <div className="advisor-card-heading"><div><span className="advisor-kicker">BILAN HYDRIQUE PAR STADE</span><h3>Besoin et eau utilisée</h3></div><span className="advisor-unit">mm / stade</span></div>
    {canShowChart?<><div className="advisor-chart-legend"><span><i className="advisor-legend-demand"/>Demande calculée</span><span><i className="advisor-legend-actual"/>ET estimée</span></div><div className="advisor-water-chart" role="img" aria-label="Comparaison par stade de la demande en eau calculée et de l’évapotranspiration estimée">
     {periods.map(period=><div className="advisor-water-row" key={period.label+period.from}><div className="advisor-water-stage"><strong>{period.label}</strong><small>{day(period.from)} – {day(period.to)}</small></div><div className="advisor-bar-stack"><i className="advisor-demand-bar" style={{width:`${Math.max(2,period.demandMm/maximum*100)}%`}}/><i className="advisor-actual-bar" style={{width:`${Math.max(period.actualEtMm?2:0,period.actualEtMm/maximum*100)}%`}}/></div><div className="advisor-water-values"><span>{number(period.actualEtMm)} / {number(period.demandMm)} mm</span><small>non couvert : {number(period.unmetEtMm)} mm</small></div></div>)}
    </div><p className="advisor-chart-note">L’écart correspond au besoin évapotranspiratoire non couvert par le bilan. La demande et l’ET sont calculées ; ce graphique ne constitue pas une mesure de la plante.</p></>:<div className="advisor-data-empty"><strong>{stale||loading?'Calcul en cours':'Série non disponible'}</strong><span>{plan?.missing?.[0]??'Aucune valeur par stade disponible pour cette campagne.'}</span></div>}
    <div className="advisor-water-facts"><div><span>Pluie retenue</span><strong>{plan?`${number(days.reduce((sum,row)=>sum+row.rainRetainedMm,0))} mm`:'—'}</strong></div><div><span>Ruissellement</span><strong>{plan?`${number(days.reduce((sum,row)=>sum+row.runoffMm,0))} mm`:'—'}</strong></div><div><span>Drainage estimé</span><strong>{plan?`${number(days.reduce((sum,row)=>sum+row.drainageMm,0))} mm`:'—'}</strong></div><div><span>Réserve utile du sol</span><strong>{number(soilCapacity)} mm</strong></div><div><span>Réserve initiale renseignée</span><strong>{number(initialReserve)} mm</strong></div><div><span>Arrosage intégré au bilan</span><strong>{plan?`${number(plan.totals.netMm)} mm`:'—'}</strong></div></div>
   </section>

   <section className="advisor-analysis-card">
    <div className="advisor-card-heading"><div><span className="advisor-kicker">SOL, MÉTÉO ET QUALITÉ DES ENTRÉES</span><h3>Ce qui alimente le calcul</h3></div></div>
    <div className="advisor-source-block"><strong>Sol physique</strong><p>{config.soil.layers.length} couche(s) · {number(config.soil.layers.reduce((sum,layer)=>sum+layer.thicknessM,0)*100,0)} cm · réserve utile calculée : {number(soilCapacity)} mm · infiltration : {number(config.soil.infiltrationMmDay)} mm/j.</p><small>Source déclarée : {config.soil.source||'non documentée'}. Une réserve issue de texture ou d’un profil par défaut reste une estimation.</small></div>
    <div className="advisor-source-block"><strong>Analyses chimiques</strong>{config.soilAnalyses?.length?<ul className="advisor-soil-list">{config.soilAnalyses.map((analysis,index)=><li key={`${analysis.source}-${index}`}><b>{analysis.topCm}–{analysis.bottomCm} cm</b><span>{analysis.measurements.map(measurement=>`${parameterLabel[measurement.parameter]??measurement.parameter} ${number(measurement.value,2)} ${measurement.unit} (${measurement.method})`).join(' · ')}</span><em>{statusLabel[analysis.status]??analysis.status} · {analysis.source} · {analysis.date??'date inconnue'}</em></li>)}</ul>:<p>Aucune analyse de sol saisie. La composition chimique et la disponibilité locale des nutriments ne sont pas établies.</p>}</div>
    <div className="advisor-source-block"><strong>Météo du cycle</strong><p>{totalWeather} jour(s) disponibles · {incompleteWeather} avec pluie ou ETo manquante. {Object.entries(weatherCounts).map(([status,count])=>`${statusLabel[status]??status} : ${count}`).join(' · ')||'Aucune série journalière chargée.'}</p><small>{[...new Set(config.weather.map(value=>value.source).filter(Boolean))].slice(0,3).join(' ; ')||config.fallback?.label||'Source météo non documentée'}.</small></div>
    <div className="advisor-source-block"><strong>Sentinel‑2 · observation du couvert</strong>{latestSatellite?<><p>{satelliteObservations.length} observation(s) exploitable(s) sur le contour · dernière image {day(latestSatellite.date)} · NDVI {number(latestSatellite.ndviMedian,3)} · EVI {number(latestSatellite.eviMedian,3)} · {number(latestSatellite.clearFraction*100,0)} % de pixels clairs.</p>{previousSatellite&&satelliteDeltaNdvi!==null&&satelliteDeltaEvi!==null&&<small>Variation depuis le {day(previousSatellite.date)} : NDVI {satelliteDeltaNdvi>=0?'+':''}{number(satelliteDeltaNdvi,3)} · EVI {satelliteDeltaEvi>=0?'+':''}{number(satelliteDeltaEvi,3)}. Indices descriptifs, sans diagnostic de cause.</small>}</>:<p>{satelliteArchive&&!satelliteScopeMatches?'Les observations archivées ne correspondent plus au contour, à la culture ou au cycle actuel.':satelliteArchive?'Aucune image exploitable disponible à la date de cette analyse.':'Aucune observation Sentinel‑2 enregistrée pour ce cycle.'}</p>}<small>{satelliteArchive?.source??'Les médianes du contour seront récupérées si des images exploitables sont disponibles.'} NDVI/EVI décrivent le couvert ; ils ne mesurent ni stress précis ni rendement.</small></div>
    <div className="advisor-evidence-counts" aria-label="État de provenance des entrées">{(['measured','declared','estimated','forecast','scenario','assumed','missing'] as const).map(status=><span key={status} className={'evidence-'+status}><b>{evidence[status]??0}</b>{statusLabel[status]}</span>)}</div>
   </section>
  </div>

  <section className="advisor-analysis-card advisor-growth-card" aria-labelledby="advisor-growth-title">
   <div className="advisor-card-heading"><div><span className="advisor-kicker">CROISSANCE DE LA CULTURE</span><h3 id="advisor-growth-title">Biomasse et couvert, quand le modèle les calcule</h3></div>{growth?.engineVersion&&<span className="advisor-unit">{growth.engineVersion}</span>}</div>
   {growthScenario&&growth?.status==='scenario'?<>
    <p className="advisor-growth-qualification">Scénario exploratoire · {growthScenario.label} · aucune validation locale ni plage prédictive fournie par ce moteur.</p>
    <div className="advisor-growth-summary">
     <article><span>Biomasse aérienne sèche finale</span><strong>{number(growthScenario.biomassKgHa/1000,2)} t/ha</strong></article>
     <article><span>Rendement de ce scénario</span><strong>{number(growthScenario.yieldKgHa/1000,2)} t/ha</strong></article>
     <article><span>Production calculée</span><strong>{number(growthScenario.productionKg/1000,2)} t</strong></article>
    </div>
    <div className="advisor-growth-legend"><span><i className="advisor-legend-biomass"/>Biomasse sèche cumulée en fin de stade</span><span><i className="advisor-legend-cover"/>Couvert vert en fin de stade</span></div>
    {growthStages.length?<div className="advisor-growth-chart" role="img" aria-label={`Trajectoire du scénario ${growthScenario.label} : biomasse sèche et couvert par stade`}>
     {growthStages.map(stage=><div className="advisor-growth-row" key={stage.name+stage.from}>
      <div className="advisor-growth-stage"><strong>{stage.name}</strong><small>{day(stage.from)} – {day(stage.to)}</small></div>
      <div className="advisor-growth-series"><span>Biomasse sèche</span><div className="advisor-growth-track"><i className="advisor-biomass-bar" style={{width:`${Math.max(1,stage.biomassKgHa/maxStageBiomass*100)}%`}}/></div><strong>{number(stage.biomassKgHa/1000,2)} t/ha</strong></div>
      <div className="advisor-growth-series"><span>Couvert vert</span>{stage.cover===null?<strong>Non calculé</strong>:<><div className="advisor-growth-track"><i className="advisor-cover-bar" style={{width:`${Math.max(0,Math.min(100,stage.cover*100))}%`}}/></div><strong>{number(stage.cover*100,0)} % · {stage.coverSource==='observed'?'observé':stage.coverSource==='simulated'?'simulé':stage.coverSource==='profile'?'profil':'à vérifier'}</strong></>}</div>
     </div>)}
    </div>:<div className="advisor-data-empty"><strong>Trajectoire par stade indisponible</strong><span>Le moteur n’a fourni aucune série journalière pour ce scénario.</span></div>}
    <details className="advisor-growth-scenarios"><summary>Comparer les scénarios calculés</summary><div className="advisor-growth-table-wrap"><table><thead><tr><th>Scénario</th><th>Biomasse sèche (t/ha)</th><th>Rendement (t/ha)</th><th>Production (t)</th><th>Jours limités par l’eau</th><th>Jours limités par N/P/K</th></tr></thead><tbody>{growth.scenarios.map(scenario=><tr key={scenario.id} aria-current={scenario.id===growthScenario.id?'true':undefined}><th scope="row">{scenario.label}</th><td>{number(scenario.biomassKgHa/1000,2)}</td><td>{number(scenario.yieldKgHa/1000,2)}</td><td>{number(scenario.productionKg/1000,2)}</td><td>{scenario.diagnostics.waterLimitedDays}</td><td>{scenario.diagnostics.nutrientLimitedDays.join(' / ')}</td></tr>)}</tbody></table></div></details>
    <p className="advisor-chart-note">Le couvert est affiché uniquement si le moteur fournit une valeur. Sa source est précisée (observation, profil ou simulation) ; une trajectoire observée après la date de prévision reste un diagnostic rétrospectif.</p>
   </>:<div className="advisor-data-empty"><strong>{config.growth?'Scénario de croissance indisponible':'Biomasse et couvert non simulés'}</strong><span>{growth?.missing.join(' ')||(!config.growth?'Le calcul actif ne produit pas ces variables pour cette campagne. Aucune valeur n’est déduite du rendement.':'Le moteur n’a pas retourné de scénario exploitable.')}</span></div>}
  </section>

  <div className="advisor-analysis-grid advisor-analysis-grid-secondary">
   <section className="advisor-analysis-card">
    <div className="advisor-card-heading"><div><span className="advisor-kicker">CONDUITE</span><h3>Apports et observations à contrôler</h3></div></div>
    <div className="advisor-intervention-list">
     <div><strong>Irrigation</strong><span>{config.managementPlan?.irrigation.mode==='manual'?'Calendrier manuel':'Calcul automatique'} · {config.managementPlan?.irrigation.applications.length??0} prévu(s)</span></div>
     <div><strong>Eau observée</strong><span>{actualEvents.filter(event=>event.kind==='rain'||event.kind==='irrigation').length} entrée(s) · {events.filter(event=>event.status==='measured').length} mesurée(s), {events.filter(event=>event.status==='declared').length} déclarée(s)</span></div>
     <div><strong>Produits prévus</strong><span>{plannedProducts.length?plannedProducts.map(item=>`${item.product} · ${number(item.dose)} ${item.unit} · ${day(item.date)}`).join(' ; '):'Aucun produit prévu'}</span></div>
     <div><strong>Apports réalisés déclarés</strong><span>{realizedProducts.length?realizedProducts.map(item=>`${item.product} · ${number(item.dose)} ${item.unit} · ${day(item.date)}`).join(' ; '):'Aucun apport déclaré'}</span></div>
    </div>
    <HelpParagraph>La présence d’une analyse ou d’un apport ne prouve pas une réponse au rendement. Aucune dose optimale ni pénalité de ravageur ou de chaleur n’est déduite par cette fiche.</HelpParagraph>
   </section>
   <section className="advisor-analysis-card advisor-method-card">
    <div className="advisor-card-heading"><div><span className="advisor-kicker">MÉTHODES ET LIMITES</span><h3>Portée des résultats</h3></div></div>
    <dl><dt>Moteur hydrique</dt><dd>{plan?.engineVersion??'Pas de calcul disponible'}</dd><dt>Méthode de rendement</dt><dd>{method??'Aucune méthode active'} · {plan?.yieldEstimation?.version??'sans version'}</dd><dt>Couvert et biomasse</dt><dd>{config.growth?`${plan?.growth?.version??'simulation de croissance'} · expérimentale`:'Non simulés dans cette campagne'}</dd><dt>État du calcul</dt><dd>{plan?.status??'En attente'} · {plan?.complete?'complet':'incomplet ou à vérifier'}</dd></dl>
    {plan?.missing?.length?<><strong className="advisor-missing-title">Données ou conditions manquantes</strong><ul className="advisor-missing-list">{plan.missing.map(item=><li key={item}>{item}</li>)}</ul></>:<HelpParagraph>Aucune donnée manquante signalée par le bilan d’eau. Cela ne constitue pas une validation agronomique locale.</HelpParagraph>}
    <details><summary>Hypothèses et limites signalées par le moteur</summary><ul>{plan?.assumptions.map(item=><li key={item}>{item}</li>)}{plan?.yieldEstimation?.limits.map(item=><li key={item}>{item}</li>)}</ul></details>
   </section>
  </div>
 </section>;
}
