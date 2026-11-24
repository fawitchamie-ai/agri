import type {GrowthResult} from '../../lib/seasonal/growth';
import type {SeasonalConfig} from '../../lib/seasonal/types';

type Props={growth:GrowthResult|undefined;config:SeasonalConfig;mode:'rainfed'|'recorded'|'proposed'};
type Row={id:string;label:string;comparison:string;deltaKgHa:number;deltaProductionKg:number;input:string;hasInput:boolean};

const fmt=(n:number,d=2)=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const signed=(kgHa:number)=>{const rounded=Math.round(kgHa/10)/100;return `${rounded>0?'+':rounded<0?'−':''}${fmt(Math.abs(rounded))} t/ha`;};
const signedTonnes=(kg:number)=>{const rounded=Math.round(kg/10)/100;return `${rounded>0?'+':rounded<0?'−':''}${fmt(Math.abs(rounded))} t sur le champ`;};
const productCount=(config:SeasonalConfig,status:'declared'|'planned')=>(config.managementPlan?.products??[]).filter(p=>p.kind==='fertilizer'&&p.status===status&&p.dose>0).length;
const countLabel=(n:number,kind:string)=>`${n} ${kind}${n>1?'s':''} ${n===1?'est enregistré':'sont enregistrés'}`;

export default function YieldAttribution({growth,config,mode}:Props){
 if(growth?.status!=='scenario')return null;
 const get=(id:string)=>growth.scenarios.find(s=>s.id===id);
 const selected=get(mode),rainfed=get('rainfed'),recorded=get('recorded'),recordedNoFertilizer=growth.counterfactuals?.recordedWithoutFertilizer,proposed=get('proposed'),proposedNoPlannedFertilizer=get('without-planned-fertilizer');
 if(!selected||!rainfed||!recorded||!recordedNoFertilizer||!proposed||!proposedNoPlannedFertilizer)return null;

 const realizedWaterMm=recorded.water?.irrigationNetMm??0;
 const plannedWaterMm=(proposed.water?.irrigationNetMm??0)-realizedWaterMm;
 const realizedFertilizerCount=productCount(config,'declared');
 const plannedFertilizerCount=productCount(config,'planned');
 const rows:Row[]=[
  {id:'realized-water',label:'Arrosages réalisés',comparison:'Avec les arrosages réalisés, comparé au même scénario sans irrigation ajoutée. Les engrais déclarés restent identiques.',deltaKgHa:recorded.yieldKgHa-rainfed.yieldKgHa,deltaProductionKg:recorded.productionKg-rainfed.productionKg,input:realizedWaterMm>.005?`${fmt(realizedWaterMm)} mm nets d’irrigation retenus.`:'Aucun arrosage réalisé retenu dans le calcul.',hasInput:realizedWaterMm>.005},
  {id:'planned-water',label:'Plan d’arrosage',comparison:'Avec le plan d’eau, comparé aux arrosages réalisés. Les engrais prévus sont exclus des deux côtés.',deltaKgHa:proposedNoPlannedFertilizer.yieldKgHa-recorded.yieldKgHa,deltaProductionKg:proposedNoPlannedFertilizer.productionKg-recorded.productionKg,input:Math.abs(plannedWaterMm)>.005?`${plannedWaterMm>0?'+':''}${fmt(plannedWaterMm)} mm nets par rapport aux arrosages réalisés.`:'Aucun volume net supplémentaire retenu par le plan.',hasInput:Math.abs(plannedWaterMm)>.005},
  {id:'realized-fertilizer',label:'Engrais déclarés réalisés',comparison:'Avec ces engrais, comparé au même scénario d’eau réalisée sans engrais déclaré.',deltaKgHa:recorded.yieldKgHa-recordedNoFertilizer.yieldKgHa,deltaProductionKg:recorded.productionKg-recordedNoFertilizer.productionKg,input:realizedFertilizerCount?countLabel(realizedFertilizerCount,'produit'):'Aucun engrais déclaré réalisé.',hasInput:realizedFertilizerCount>0},
  {id:'planned-fertilizer',label:'Engrais prévus',comparison:'Avec les engrais prévus, comparé au même plan d’eau sans engrais prévu.',deltaKgHa:proposed.yieldKgHa-proposedNoPlannedFertilizer.yieldKgHa,deltaProductionKg:proposed.productionKg-proposedNoPlannedFertilizer.productionKg,input:plannedFertilizerCount?countLabel(plannedFertilizerCount,'produit'):'Aucun engrais prévu.',hasInput:plannedFertilizerCount>0},
 ];

 return <section className="yield-effects" aria-labelledby="yield-effects-title">
  <header className="yield-effects-heading">
   <span>COMPARAISONS DANS LE MÊME MODÈLE</span>
   <h3 id="yield-effects-title">Qu’est-ce qui fait varier ce rendement ?</h3>
   <p>Le rendement affiché correspond au scénario sélectionné ci-dessus : <strong>{selected.label}</strong>, soit <strong>{fmt(selected.yieldKgHa/1000)} t/ha</strong>.</p>
  </header>
  <p className="yield-effects-intro">Chaque ligne compare deux simulations RUE–NPK avec la même météo, le même sol, la même surface et le même profil. Seul l’apport indiqué change. La variation est exprimée en t/ha.</p>
  <div className="table-wrap">
   <table className="data-table yield-effects-table">
    <thead><tr><th>Facteur comparé</th><th>Comparaison</th><th>Apports retenus</th><th>Variation simulée</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}>
     <th scope="row">{row.label}</th>
     <td>{row.comparison}</td>
     <td>{row.input}</td>
     <td><strong>{signed(row.deltaKgHa)}</strong><span className="yield-effects-row-note">{signedTonnes(row.deltaProductionKg)}</span><span className="yield-effects-row-note">{!row.hasInput?'Aucun apport à attribuer dans ce scénario.':Math.abs(row.deltaKgHa)<5?'Apport présent, mais le modèle ne montre pas de variation avec les hypothèses actuelles.':'Écart calculé entre les deux scénarios.'}</span></td>
    </tr>)}</tbody>
   </table>
  </div>
  <details className="yield-effects-method">
   <summary>Comment interpréter ces variations ?</summary>
   <ul>
    <li>Un écart de <strong>0,00 t/ha</strong> signifie qu’aucun apport correspondant n’est retenu, ou que le modèle ne prévoit pas de changement avec les paramètres actuels. Ce n’est pas une preuve que l’eau ou l’engrais n’a aucun effet réel.</li>
    <li>Les apports d’eau changent le bilan hydrique et la croissance. Les engrais saisis changent les fournitures N/P/K du scénario.</li>
    <li>Les stocks N/P/K de base du profil restent présents dans toutes les comparaisons : ce sont des hypothèses illustratives, pas une analyse du sol.</li>
    <li>Ces écarts sont exploratoires, non calibrés localement et non observés au champ. Ils expliquent les calculs du modèle, pas une réponse garantie de la parcelle.</li>
   </ul>
  </details>
 </section>;
}
