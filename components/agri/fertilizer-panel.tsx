'use client';
import { HelpParagraph } from './help-dialog';
import {seasonalRequest} from '../../lib/seasonal/request';
import {useEffect,useState} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import FertilizerSimulator from './fertilizer-simulator';
import type {fertilizerEvidence,nextFertilizerInformation} from '../../lib/seasonal/fertilizer-evidence';
type Evidence=ReturnType<typeof fertilizerEvidence>;
const fmt=(v:number|null|undefined,d=2)=>v==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
async function post(body:unknown,signal?:AbortSignal){return seasonalRequest<any>(body,signal);}

export default function FertilizerPanel({config,plan,stale,onChange,onAdvanced,onProducts}:{config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;onAdvanced:(tab:string)=>void;onProducts:()=>void}){
 const [data,setData]=useState<Evidence|null>(null),[error,setError]=useState(''),[action,setAction]=useState<ReturnType<typeof nextFertilizerInformation>|null>(null);
 const cropId=config.cropProfile?.id??'';
 useEffect(()=>{setData(null);setError('');if(!cropId)return;const c=new AbortController();post({action:'fertilizer-evidence',country:config.country,cropId,asOfDate:config.asOfDate},c.signal).then(setData).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[config.country,cropId,config.asOfDate]);
 useEffect(()=>{setAction(null);if(!config.stages.length)return;const c=new AbortController();const timer=setTimeout(()=>post({action:'fertilizer-information',config},c.signal).then(setAction).catch(()=>{}),500);return()=>{clearTimeout(timer);c.abort();};},[config]);
 const ready=data?.country===config.country&&data.cropId===cropId?data:null;
 const obs=ready?.observations??[];
 const min=Math.min(0,...obs.flatMap(r=>r.deltaObserved80)),max=Math.max(1,...obs.flatMap(r=>r.deltaObserved80)),x=(n:number)=>160+(n-min)/(max-min)*360;
 return <section className="qs-card" aria-label="Engrais et preuves expérimentales"><div className="qs-card-heading"><h2>Mes engrais et leurs effets</h2><span className="qs-tag">Réponse parcellaire non validée</span></div>
  {ready?.nationalReference&&<HelpParagraph><strong>Repère national {ready.nationalReference.year} : {fmt(ready.nationalReference.kgHa!/1000)} t/ha récolté.</strong> {ready.nationalReference.context} <a href={ready.nationalReference.source} target="_blank" rel="noreferrer">Source FAOSTAT</a>. Moyenne de pratiques diverses, y compris fertilisées ; ce repère n’est ni un témoin sans engrais ni un rendement garanti pour votre champ.</HelpParagraph>}
  <HelpParagraph>Vos produits, doses et dates permettent de calculer les quantités de nutriments. Pour le maïs, vous pouvez explorer leur effet avec deux profils publiés de nutrition N–P–K. La prévision parcellaire validée et la dose optimale restent indisponibles.</HelpParagraph>
  <FertilizerSimulator config={config} plan={plan} stale={stale} onChange={onChange} onProducts={onProducts}/>
  {error&&<HelpParagraph role="alert">{error} Les références ne sont pas disponibles pour le moment.</HelpParagraph>}
  {ready&&(cropId==='maize'||!ready.extension?.observations.length)&&<details><summary>{obs.length?'Voir les comparaisons réellement observées':'Consulter les données et limites pour cette culture'}</summary>
   {!obs.length?<HelpParagraph>Aucune comparaison témoin–NPK suffisamment appariée dans la version intégrée pour ce pays et cette culture. Une absence de données ne signifie pas une absence de réponse.</HelpParagraph>:<>
    <HelpParagraph>Maïs grain : supplément NPK par rapport au témoin dans les essais publiés. Chaque point représente la médiane des différences appariées ; les traits montrent leur dispersion observée (10e–90e percentiles).</HelpParagraph>
    <svg viewBox={`0 0 600 ${obs.length*65+45}`} role="img" aria-label="Différences de rendement observées avec NPK ; dispersion descriptive, pas un intervalle prédictif" style={{width:'100%',maxWidth:700}}><title>Gain observé dans les essais, en tonnes par hectare telles que rapportées</title>
     <line x1={x(0)} x2={x(0)} y1={5} y2={obs.length*65} stroke="#8896a7" strokeDasharray="4 3"/>
     {obs.map((r,i)=><g key={r.site}><text x="4" y={i*65+30} fontSize="14" fill="currentColor">{r.location} · {r.pairs} paires</text><line x1={x(r.deltaObserved80[0])} x2={x(r.deltaObserved80[1])} y1={i*65+26} y2={i*65+26} stroke="#3875af" strokeWidth="5"/><circle cx={x(r.deltaMedianTonnesHa)} cy={i*65+26} r="6" fill="#102c4c"/><text x={x(r.deltaMedianTonnesHa)} y={i*65+49} fontSize="12" fill="currentColor" textAnchor="middle">{fmt(r.deltaMedianTonnesHa)} t/ha</text></g>)}
     <text x="160" y={obs.length*65+25} fontSize="12" fill="currentColor">{fmt(min)} t/ha</text><text x="520" y={obs.length*65+25} textAnchor="end" fontSize="12" fill="currentColor">{fmt(max)} t/ha</text>
    </svg>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Localité</th><th>Témoin médian</th><th>NPK médian</th><th>Différence appariée médiane</th><th>Différences négatives</th></tr></thead><tbody>{obs.map(r=><tr key={r.site}><td>{r.location}</td><td>{fmt(r.controlMedianTonnesHa)} t/ha</td><td>{fmt(r.treatedMedianTonnesHa)} t/ha</td><td>{fmt(r.deltaMedianTonnesHa)} t/ha</td><td>{r.negativePairs} / {r.pairs}</td></tr>)}</tbody></table></div>
    <HelpParagraph>Les médianes des deux bras ne sont pas nécessairement séparées de la médiane des différences. Les différences négatives valides restent présentes ; elles ne prouvent pas à elles seules une toxicité.</HelpParagraph>
    {obs.map(r=><HelpParagraph key={r.site}>{r.location} : N {r.doseReported.N}, P {r.doseReported.P}, K {r.doseReported.K} kg/ha tels que rapportés. Base P/K non qualifiée pour une conversion en produit commercial ; humidité, année et surface de référence non vérifiées.</HelpParagraph>)}
   </>}
   {ready.calibration&&<HelpParagraph>Évaluation de recherche sur {ready.calibration.test.pairs} paires dans {ready.calibration.test.localities} groupes de localités tenus à l’écart : MAE {fmt(ready.calibration.test.MAE)} t/ha sur le supplément, RMSE {fmt(ready.calibration.test.RMSE)} t/ha. {config.country==='TGO'&&<>Au Togo : MAE {fmt(ready.calibration.byCountry.Togo.MAE)} t/ha, sur 21 paires dans deux localités.</>} L’intervalle prédictif à 95 % reste indisponible et cet ancien modèle statistique reste désactivé. Une correction d’alias de localités a invalidé un premier découpage ; cette évaluation est un diagnostic de recherche.</HelpParagraph>}
   {ready.limits.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}<HelpParagraph>{ready.attribution} · {ready.license} · <a href={ready.source} target="_blank" rel="noreferrer">Données et citation</a>.</HelpParagraph>
  </details>}
  {ready?.extension&&<RiceEvidence extension={ready.extension}/>}
  {action&&<HelpParagraph className="notice info"><strong>Prochaine action : {action.action}</strong> {action.reason} Priorité indicative, sans calcul validé de valeur de l’information.</HelpParagraph>}
  <button className="btn secondary" onClick={()=>onAdvanced('conseils')}>Voir les références et le bilan d’engrais</button>
  <EconomicSensitivity config={config}/>
 </section>;
}

function RiceEvidence({extension}:{extension:NonNullable<Evidence['extension']>}){
 const obs=extension.observations;
 return <details><summary>{obs.length?'Comparer les modalités publiées sur le riz':'Ce qui manque pour valider l’effet des engrais dans ce pays'}</summary>
  {obs.length>0&&<>
   <HelpParagraph>Rendements mesurés dans des essais publiés. Ces valeurs décrivent leurs conditions expérimentales ; elles ne sont pas les rendements prévus de votre parcelle. Les comparaisons d’une même localité partagent des génotypes, des campagnes ou des témoins.</HelpParagraph>
   {obs.map(r=><div key={r.id}>
    <h3>{r.location} · {r.contrast==='P_environment'?'Comparaison avec/sans phosphore':'Régime NPK de longue durée'}{r.season?` · saison ${r.season==='dry'?'sèche':'humide'}`:''}</h3>
    <HelpParagraph>{r.pairs} comparaisons · {r.campaigns} campagnes · un site · {r.years.join(', ')}. {r.moisturePercent===14?'Grain à 14 % d’humidité.':'Humidité du grain non qualifiée.'}</HelpParagraph>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Modalité</th><th>N–P–K élémentaires (kg/ha)</th><th>Rendement médian observé</th></tr></thead><tbody>
     <tr><td>{r.contrast==='P_environment'?'Sans P ajouté, avec N/K':'Témoin du régime sans apport'}</td><td>{r.baselineNutrients.join(' – ')}</td><td>{fmt(r.controlMedianTonnesHa)} t/ha</td></tr>
     <tr><td>{r.contrast==='P_environment'?'Avec P, mêmes N/K':'Régime NPK répété'}</td><td>{r.treatedNutrients.join(' – ')}</td><td>{fmt(r.treatedMedianTonnesHa)} t/ha</td></tr>
    </tbody></table></div>
    <HelpParagraph>Différence appariée médiane : <strong>{fmt(r.deltaMedianTonnesHa)} t/ha</strong>. Dispersion observée (10e–90e percentiles) : {fmt(r.deltaObserved80[0])} à {fmt(r.deltaObserved80[1])} t/ha. Différences négatives : {r.negativePairs}/{r.pairs}. La différence des médianes des bras peut différer de la médiane des différences.</HelpParagraph>
    {r.limits.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}
    <HelpParagraph>{r.attribution} · {r.license} · <a href={r.source} target="_blank" rel="noreferrer">Publication et protocole</a>.</HelpParagraph>
   </div>)}
   {extension.research.map(r=><HelpParagraph key={r.sourceId+r.cropId}><strong>Diagnostic de recherche :</strong> {r.design}. MAE du supplément {fmt(r.metrics.MAE)} t/ha, RMSE {fmt(r.metrics.RMSE)}, biais {fmt(r.metrics.bias)} ; référence moyenne : MAE {fmt(r.baselineMAE)}. {r.metrics.pairs} comparaisons, {r.metrics.sites} sites, {r.metrics.campaigns} campagnes. Intervalle prédictif à 95 % indisponible ; réponse parcellaire désactivée.</HelpParagraph>)}
  </>}
  {extension.missingInformation.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}
  {extension.limits.map(l=><HelpParagraph key={l}>{l}</HelpParagraph>)}
 </details>;
}

function EconomicSensitivity({config}:{config:SeasonalConfig}){
 const [v,setV]=useState({area:'',delta:'',price:'',product:'',transport:'',application:'',source:'',date:config.asOfDate,currency:config.country==='GHA'?'GHS':'XOF'}),[result,setResult]=useState<any>(null),[error,setError]=useState('');
 function field(key:keyof typeof v,label:string,type='number'){return <label className="field"><span>{label}</span><input type={type} required step={type==='number'?'any':undefined} value={v[key]} onChange={e=>{setV({...v,[key]:e.target.value});setResult(null);}}/></label>;}
 return <details><summary>Calculer le seuil économique d’un scénario personnel</summary><HelpParagraph>Ce calcul utilise le gain que vous supposez. Il ne prédit pas l’effet de vos engrais. Renseignez des coûts additionnels, leur source et leur date.</HelpParagraph>
  <form onSubmit={async e=>{e.preventDefault();setResult(null);setError('');try{setResult(await post({action:'marginal-scenario',parameters:{areaM2:Number(v.area),deltaKgHa:Number(v.delta)*1000,cropPricePerKg:Number(v.price),productCostPerHa:Number(v.product),transportCost:Number(v.transport),applicationCost:Number(v.application),currency:v.currency,priceDate:v.date,priceSource:v.source}}));}catch(e){setError((e as Error).message);}}}>
   <div className="form-grid">{field('area','Surface effectivement fertilisée (m²)')}{field('delta','Gain hypothétique (t/ha, négatif possible)')}{field('price','Prix de vente par kg')}{field('product','Coût additionnel des produits par hectare')}{field('transport','Transport additionnel total')}{field('application','Application additionnelle totale')}{field('currency','Devise (XOF, GHS…)','text')}{field('date','Date des prix','date')}{field('source','Source des prix ou hypothèse volontaire','text')}</div><button className="btn secondary" type="submit">Calculer le seuil et la sensibilité</button>
  </form>{error&&<HelpParagraph role="alert">{error}</HelpParagraph>}{result&&<HelpParagraph>Scénario hypothétique : supplément de récolte {fmt(result.extraKg)} kg ; bénéfice marginal {fmt(result.marginalBenefit)} {result.currency}. Seuil de rentabilité : {fmt(result.breakEvenDeltaKgHa/1000)} t/ha de gain. Chaque variation de 0,1 t/ha change le bénéfice de {fmt(result.sensitivityPer100KgHa)} {result.currency}. Ce montant n’est pas le bénéfice total de la campagne.</HelpParagraph>}
 </details>;
}
