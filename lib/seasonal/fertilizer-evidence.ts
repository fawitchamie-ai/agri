import evidence from '../../data/seasonal/fertilizer-evidence.json' with {type:'json'};
import {historicalContext} from './historical-context.ts';
import {COUNTRIES,type Country,type SeasonalConfig} from './types.ts';
import {cropById} from './catalog.ts';
import {InputError,isoDate} from './validation.ts';
import {applicationNutrients} from './management.ts';

/** Observations and research metrics, NEVER a callable fertilizer predictor. */
export function fertilizerEvidence(country:Country,cropId:string,asOfDate:string){
 if(!Object.hasOwn(COUNTRIES,country)||!cropById(cropId))throw new InputError('Pays ou culture inconnu.');
 isoDate(asOfDate,'Date du conseil');
 const historical=historicalContext(country,cropId,asOfDate);
 const rows=historical.rows.filter(r=>r.yieldKgHaHarvested?.value!=null).sort((a,b)=>b.year-a.year);
 const available=asOfDate>=evidence.availableOn;
 return {version:evidence.version,country,cropId,productionEnabled:false,forecastValidated:false,
  status:available?'observed_context_only':'not_available_as_of',
  attribution:evidence.attribution,source:evidence.source,license:evidence.license,
  observations:available?evidence.summaries.filter(r=>r.country===country&&r.cropId===cropId):[],
  calibration:available&&cropId==='maize'?evidence.calibration:null,
  nationalReference:rows.length?{year:rows[0].year,kgHa:rows[0].yieldKgHaHarvested!.value,flag:rows[0].yieldKgHaHarvested!.flag,
   denominator:'harvested',scope:'national',independentYm:false,source:historical.source,version:historical.version,
   availableOn:historical.acquiredAt.slice(0,10),context:historical.product?.scope??'',
   limits:['Moyenne nationale de pratiques diverses, y compris fertilisées ; pas un témoin sans engrais, pas une référence sans stress hydrique.',...historical.limits]}:null,
  limits:evidence.limits};
}

/** One explicit heuristic action. No claim to a calibrated value-of-information. */
export function nextFertilizerInformation(c:SeasonalConfig){
 const products=c.managementPlan?.products.filter(p=>p.kind==='fertilizer')??[];
 if(products.some(p=>applicationNutrients(p)===null))return {method:'heuristic',action:'Vérifiez l’étiquette, la dose et la composition du produit.',reason:'Une quantité inconnue ne permet pas de calculer les nutriments réellement apportés.'};
 if(['waterlogged','submerged'].includes(c.waterCondition??''))return {method:'heuristic',action:'Observez et renseignez le drainage du champ.',reason:'Un excès d’eau change le contexte ; la réponse nutritive de ce système n’est pas qualifiée.'};
 return {method:'heuristic',action:'Préparez un essai comparatif avec un agronome.',reason:'Le modèle de gain ne franchit pas les critères de validation. Une analyse de sol seule ne certifierait pas cette réponse. Le protocole doit isoler le complément étudié.'};
}

export type MarginalScenario={areaM2:number;deltaKgHa:number;cropPricePerKg:number;productCostPerHa:number;transportCost:number;applicationCost:number;currency:string;priceDate:string;priceSource:string};
/** Transparent sensitivity to a USER scenario, not a recommended/optimal dose. */
export function marginalScenario(v:MarginalScenario){
 if(!v||typeof v!=='object')throw new InputError('Hypothèses économiques requises.');
 for(const k of ['areaM2','cropPricePerKg','productCostPerHa','transportCost','applicationCost'] as const)if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0||v[k]>1e12)throw new InputError('Montant ou surface économique invalide.');
 if(v.areaM2<=0||v.cropPricePerKg<=0||typeof v.deltaKgHa!=='number'||!Number.isFinite(v.deltaKgHa)||Math.abs(v.deltaKgHa)>1e6)throw new InputError('Surface, prix positif et gain hypothétique requis.');
 if(typeof v.priceSource!=='string'||!v.priceSource.trim()||v.priceSource.length>600||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))throw new InputError('Source des prix et devise requises.');
 isoDate(v.priceDate,'Date des prix');
 const hectares=v.areaM2/10000,cost=v.productCostPerHa*hectares+v.transportCost+v.applicationCost,extraKg=v.deltaKgHa*hectares;
 return {status:'user_scenario',validated:false,extraKg,cost,marginalBenefit:extraKg*v.cropPricePerKg-cost,
  breakEvenDeltaKgHa:cost/(v.cropPricePerKg*hectares),
  sensitivityPer100KgHa:100*hectares*v.cropPricePerKg,currency:v.currency,priceDate:v.priceDate,priceSource:v.priceSource,
  recommendation:null,limits:['Gain de rendement hypothétique saisi, pas une prévision du modèle.','Coûts additionnels uniquement ; ce montant n’est pas le bénéfice total de la campagne.']};
}
