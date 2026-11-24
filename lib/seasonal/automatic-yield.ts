import type {SeasonalConfig} from './types.ts';
import {growthTemplate,type GrowthInput} from './growth.ts';

export const AUTOMATIC_YIELD_VERSION='automatic-indicative-yield-1';
export const AUTOMATIC_YIELD_INPUT_VERSION='automatic-yield-input-1';
export type AutomaticYieldInput={version:typeof AUTOMATIC_YIELD_INPUT_VERSION;enabled:boolean;soilSupply?:GrowthInput['soilSupply']};
export type AutomaticYieldReport={
 version:typeof AUTOMATIC_YIELD_VERSION;status:'ready'|'blocked';validated:false;
 profileId:string|null;profileLabel:string;profile:GrowthInput|null;
 assumptions:string[];missing:string[];
 weather:{days:number;completeDays:number;scenarioDays:number;forecastDays:number;estimatedDays:number;observedDays:number;sources:string[]};
};

/** A versioned software scenario, not a cultivar calibration or country model.
 * Its numerical assumptions are those of the pre-existing explicit template.
 * Other crop/profile domains must be registered rather than borrowing maize.
 */
export function prepareAutomaticGrowth(c:SeasonalConfig):{config:SeasonalConfig;report:AutomaticYieldReport}|null{
 if(!c.automaticYield?.enabled||c.growth||c.canopyNowcast||c.yieldEstimation&&c.yieldEstimation.method!=='automatic')return null;
 const days=c.stages.reduce((n,s)=>n+s.days,0),byDate=new Map(c.weather.map(w=>[w.date,w]));
 const report:AutomaticYieldReport={version:AUTOMATIC_YIELD_VERSION,status:'blocked',validated:false,profileId:null,profileLabel:'Profil de croissance à sélectionner',profile:null,assumptions:[],missing:[],weather:{days,completeDays:0,scenarioDays:0,forecastDays:0,estimatedDays:0,observedDays:0,sources:[]}};
 if(c.cropProfile?.id!=='maize')report.missing.push('Aucun profil automatique documenté pour cette culture. Le profil indicatif disponible concerne le maïs grain.');
 else{report.profileId='maize-rue-indicative-1';report.profileLabel='Maïs grain · croissance RUE–NPK indicative';}
 if(c.asOfDate<'2026-11-24')report.missing.push('Actualisez les données de la campagne : ce profil automatique est disponible depuis le 24 novembre 2026.');
 if(!c.parcelGeometry)report.missing.push('Définissez le contour du champ.');
 if(!days)report.missing.push('Renseignez le cycle et ses stades.');
 if(c.systemDomain!=='upland'||c.waterCondition!=='drained')report.missing.push('Confirmez que le champ est terrestre et drainé ; le riz submergé et l’engorgement demandent un autre modèle.');
 if(c.waterModel)report.missing.push('Un modèle hydrique avancé est actif : utilisez un profil de croissance compatible dans les options avancées.');
 if(!c.inputPolicy?.allowAssumptions)report.missing.push('Confirmez les hypothèses de la simulation indicative avant le calcul.');
 const missing:{rain:string[];et0:string[];temperature:string[];radiation:string[]}={rain:[],et0:[],temperature:[],radiation:[]},sources=new Set<string>();
 for(let i=0;i<days;i++){
  const date=new Date(Date.parse(c.sowingDate)+i*86400000).toISOString().slice(0,10),w=byDate.get(date),available=w&&w.availableAt.slice(0,10)<=c.asOfDate?w:undefined;
  const rain=available?.rainMm??c.fallback?.rainMmDay,et0=available?.et0Mm??c.fallback?.et0MmDay;
  const temperature=available?.temperatureMeanC??(available?.temperatureMinC!=null&&available.temperatureMaxC!=null?(available.temperatureMinC+available.temperatureMaxC)/2:undefined),radiation=available?.radiationMj;
  if(rain==null)missing.rain.push(date);if(et0==null)missing.et0.push(date);if(temperature==null)missing.temperature.push(date);if(radiation==null)missing.radiation.push(date);
  if(rain!=null&&et0!=null&&temperature!=null&&radiation!=null)report.weather.completeDays++;
  if(available){sources.add(available.source);if(available.status==='scenario')report.weather.scenarioDays++;else if(available.status==='forecast')report.weather.forecastDays++;else if(available.status==='estimated')report.weather.estimatedDays++;else report.weather.observedDays++;}
 }
 report.weather.sources=[...sources];
 for(const [key,label] of [['rain','Pluie'],['et0','ET0'],['temperature','Température'],['radiation','Rayonnement solaire']] as const)if(missing[key].length)report.missing.push(label+' : '+missing[key].length+' jours à compléter (dont '+missing[key].slice(0,3).join(', ')+'). Actualisez les données ou renseignez une source.');
 report.assumptions=[
  'Profil illustratif transférable pour explorer les mécanismes, sans calibration locale du cultivar ni précision prédictive garantie.',
  'RUE 1,5 g/MJ de rayonnement global intercepté ; indice de récolte 0,45 ; humidité du grain 15 %.',
  'Couvert interpolé selon les stades : les images NDVI affichées ne sont pas assimilées automatiquement.',
  'Stocks N/P/K accessibles initiaux 30/8/40 kg/ha et fourniture quotidienne 0,30/0,02/0,20 kg/ha/j : hypothèses du profil, pas une analyse de sol.',
  'Besoins N/P/K 15/2,5/15 kg par tonne de biomasse ; récupérations minérales 50/20/50 %. Les produits et dates déclarés restent distincts.',
  'La surface prévue dans le plan ou la partie terrestre retenue est une hypothèse de simulation ; elle ne prouve pas un semis réalisé.',
 ];
 if(report.weather.scenarioDays)report.assumptions.push(report.weather.scenarioDays+' jours utilisent un scénario météo, notamment les moyennes historiques disponibles ; ce ne sont pas des prévisions saisonnières.');
 if(report.profileId){
  const profile=growthTemplate(c);profile.source=report.profileLabel+' · '+report.profileId+' · hypothèses illustratives du moteur, non calibrées localement.';
  if(c.automaticYield.soilSupply){profile.soilSupply=structuredClone(c.automaticYield.soilSupply);report.assumptions[3]='Fournitures N/P/K accessibles saisies : stocks '+profile.soilSupply.initialKgHa.join('/')+' kg/ha et libérations '+profile.soilSupply.releaseKgHaDay.join('/')+' kg/ha/j. Source : '+profile.soilSupply.source;}
  report.profile=profile;
  return {config:{...c,growth:profile},report};
 }
 return {config:c,report};
}
