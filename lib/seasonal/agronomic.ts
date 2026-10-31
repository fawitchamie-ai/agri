import {planSeason} from './yield.ts';
import {validateConfig,addDays,InputError} from './validation.ts';
import {declareScenario,reconcileInputs,geometryIdentity} from './provenance.ts';
import type {SeasonalConfig,WaterEvent} from './types.ts';
export const AGRONOMIC_VERSION='agronomic-1';
export type AgronomicConfig={version:'agronomic-1';geometryId:string;system:'single'|'associated'|'succession'|'multiple';season:{from:string;to:string;source:string}|null;observations:{parameter:string;value:number|string|null;unit:string;method:string;source:string;depthCm:[number,number]|null;availableOn:string}[]};
const groups:Record<string,string[]>={
 'Géométrie et paysage':['Contour','Surface semée','Surface récoltée','Occupation du sol','Pente','Relief','Position topographique','Érosion','Ombrage','Incertitude des frontières','Connexion hydraulique'],
 'Sol physique':['Texture','Profondeur exploitable','Cailloux','Densité apparente','Compaction','Croûte de battance','Infiltration','Conductivité hydraulique','Capacité au champ','Flétrissement','Réserve utile','Humidité initiale','Nappe','Drainage'],
 'Chimie et biologie':['pH','Carbone organique','Matière organique','Azote total','Azote minéral','Phosphore assimilable','Potassium échangeable','CEC','Salinité','Sodicité','Acidité','Toxicités','Biologie du sol'],
 'Climat':['Pluie journalière','Distribution des pluies','Épisodes secs','Pluies intenses','Température moyenne','Température minimale','Température maximale','Rayonnement','Humidité relative','Vent','ET0','Début de saison','Fin de saison'],
 'Culture':['Espèce','Variété','Photopériode','Temps thermique','Semis','Levée','Stades','Densité','Enracinement','Durée du cycle','Biomasse','Indice de récolte','Réponse au déficit hydrique','Tolérance à la submersion','Tolérance à la chaleur','Tolérance à la salinité','Ym indépendant'],
 'Conduite et ressources':['Qualité des semences','Irrigation réalisée','Irrigation proposée','Débit','Quota','Efficacité','Énergie','Fertilisation','Rotations','Précédent cultural','Résidus','Travail du sol','Paillage','Adventices','Ravageurs','Maladies','Accès aux interventions','Cultures associées','Récoltes multiples'],
 'Produit et récolte':['Organe récolté','Produit frais ou sec','Humidité de référence','Production biologique','Récolte observée','Qualité commercialisable','Pertes de récolte']};
const paths:Record<string,RegExp>={'Capacité au champ':/^soil.layers.*thetaFC$/,'Flétrissement':/^soil.layers.*thetaWP$/,'Humidité initiale':/^soil.layers.*initialTheta$/,'Infiltration':/^soil.infiltrationMmDay$/,'Enracinement':/^stages.*root/,'Stades':/^stages.*days$/,'Pluie journalière':/^weather.*rainMm$/,'ET0':/^weather.*et0Mm$/,'Température moyenne':/^weather.*temperatureMeanC$/,'Température minimale':/^weather.*temperatureMinC$/,'Température maximale':/^weather.*temperatureMaxC$/,'Humidité relative':/^weather.*humidityPercent$/,'Vent':/^weather.*wind2mMs$/,'Rayonnement':/^weather.*radiationMj$/,'Débit':/^system.sourceFlowM3h$/,'Quota':/^system.sourceBudgetM3$/,'Efficacité':/^system.*Efficiency$/,'Semis':/^sowingDate$/,'Espèce':/^crop$/,'Variété':/^variety$/};
const chemistry:Record<string,string>={'pH':'pH','Carbone organique':'organicC','Matière organique':'organicMatter','Azote total':'totalN','Azote minéral':'mineralN','Phosphore assimilable':'availableP','Potassium échangeable':'exchangeableK','CEC':'CEC','Salinité':'EC'};
export function parseAgronomic(v:unknown,c:SeasonalConfig):AgronomicConfig|undefined{
 if(v===undefined)return undefined;const a=v as AgronomicConfig;
 const date=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 if(!a||a.version!==AGRONOMIC_VERSION||a.geometryId!==geometryIdentity(c.parcelGeometry)||!['single','associated','succession','multiple'].includes(a.system)||!Array.isArray(a.observations)||a.observations.length>100)throw new InputError('Suivi agronomique invalide ou lié à un ancien contour.');
 if(a.season&&(!date(a.season.from)||!date(a.season.to)||a.season.from>a.season.to||!a.season.source?.trim()))throw new InputError('Fenêtre saisonnière et source requises.');
 for(const o of a.observations){if(!Object.values(groups).flat().includes(o.parameter)||!o.unit?.trim()||!o.source?.trim()||!o.method?.trim()||!date(o.availableOn)||o.availableOn>c.asOfDate||!(o.value===null||typeof o.value==='string'&&o.value.length<=1200||typeof o.value==='number'&&Number.isFinite(o.value)))throw new InputError('Observation, source, unité ou disponibilité invalide.');if(o.depthCm&&(!Array.isArray(o.depthCm)||o.depthCm.length!==2||o.depthCm.some(x=>!Number.isFinite(x)||x<0)||o.depthCm[1]<=o.depthCm[0]))throw new InputError('Profondeur analytique invalide.');if(['pH','Salinité','Phosphore assimilable'].includes(o.parameter)&&o.value!==null&&!o.depthCm)throw new InputError('Profondeur et méthode analytiques requises.');}
 return structuredClone(a);
}
export function agronomicCoverage(c:SeasonalConfig){
 const ledger=Object.entries(c.inputs?.values??{});
 const matrix=Object.entries(groups).flatMap(([group,parameters])=>parameters.map(parameter=>{
  const evidence=paths[parameter]?ledger.filter(([p])=>paths[parameter].test(p)).map(([,e])=>e):[];
  if(chemistry[parameter])for(const [i,a] of (c.soilAnalyses??[]).entries())for(const [j,m] of a.measurements.entries())if(m.parameter===chemistry[parameter]){const e=c.inputs?.values[`soilAnalyses.${i}.measurements.${j}.value`];if(e)evidence.push(e);}
  const observations=c.agronomic?.observations.filter(o=>o.parameter===parameter)??[];
  const available=evidence.filter(e=>e.value!==null&&e.status!=='missing');
  const derived:Record<string,unknown>={'Contour':c.parcelGeometry?'GeoJSON complet':null,'Surface semée':c.yieldEstimation?.units.map(u=>u.sownAreaM2)??null,'Surface récoltée':c.yieldEstimation?.units.map(u=>u.harvestedAreaM2)??null,'Occupation du sol':c.landAssessment?.fractions??null,'Ym indépendant':c.yieldEstimation?.units.map(u=>u.reference)??null,'Durée du cycle':c.stages.reduce((n,s)=>n+s.days,0)};
  const used=!!paths[parameter]&&!['Température moyenne','Température minimale','Température maximale','Humidité relative','Vent','Rayonnement','Espèce','Variété'].includes(parameter)||['Contour','Surface semée','Occupation du sol','Durée du cycle'].includes(parameter);
  return {parameter,group,status:available.length?'récupéré ou saisi':derived[parameter]!=null?'dérivé':observations.length?'déclaré':'manquant',role:used?'utilisé dans le bilan / calcul spatial':available.length||observations.length?'indicatif, sans effet chiffré sur le rendement':'non modélisé',unit:evidence[0]?.unit??observations[0]?.unit??(parameter.includes('Surface')?'m²':'à documenter'),evidence:evidence.slice(0,6),availableValues:available.length,totalValues:evidence.length,observations,derived:derived[parameter]??null,missing:available.length===0&&observations.length===0&&derived[parameter]==null,compatibility:'Culture, variété, profondeur et système à confirmer ; une donnée récupérée n’est pas un modèle de réponse.'};
 }));
 return {version:AGRONOMIC_VERSION,matrix,uncertainty:{inputs:'Résolution et quantiles des sources conservés dans les entrées ; aucune précision sous-pixel inventée.',parameters:'Ym et coefficients non calibrés pour chaque variété.',model:'Nutrition, chaleur, salinité et mortalité ne sont pas des multiplicateurs de rendement.',management:'Arrosage proposé distinct du réalisé ; ressources et énergie non vérifiées si absentes.',shared:'Des parcelles voisines peuvent partager une même maille : erreurs corrélées, pas de différence certaine.',predictiveInterval:null},review:{agronomist:'pending',fieldValidation:'not_available'},limits:['AquaCrop non activé : paramètres variétaux calibrés et validation indépendante manquants.','Associations, successions et récoltes multiples non représentées par ce modèle.','Production biologique, récolte et commercialisable restent des objets distincts.']};
}
export async function compareAgronomic(input:unknown,events:unknown,variants:unknown){
 const c=validateConfig(input);
 if(!Array.isArray(variants)||variants.length<1||variants.length>8)throw new InputError('1 à 8 scénarios documentés requis.');
 const results=variants.map(v=>{
  if(!v||typeof v.label!=='string'||!v.label.trim()||typeof v.source!=='string'||!v.source.trim())throw new InputError('Libellé et justification de scénario requis.');
  const offset=v.offset??0,rain=v.rainFactor??1,et=v.et0Factor??1;
  if(!Number.isInteger(offset)||Math.abs(offset)>60||!Number.isFinite(rain)||rain<0||rain>3||!Number.isFinite(et)||et<.1||et>3)throw new InputError('Variation de scénario hors domaine.');
  const sowingDate=addDays(c.sowingDate,offset),end=addDays(sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
  const weather=c.weather.filter(w=>w.date>=sowingDate&&w.date<=end).map(w=>({...w,rainMm:w.rainMm===null?null:w.rainMm*rain,et0Mm:w.et0Mm===null?null:w.et0Mm*et,provenance:undefined,status:'scenario' as const,source:'Scénario '+v.source}));
  const next=declareScenario(reconcileInputs(c,{...c,sowingDate,weather,yieldEstimation:c.yieldEstimation?{...c.yieldEstimation,units:c.yieldEstimation.units.map(u=>({...u,conditions:u.conditions?{...u.conditions,weather}:undefined}))}:undefined,fallback:c.fallback?{...c.fallback,label:c.fallback.label+' ; '+v.source,rainMmDay:c.fallback.rainMmDay*rain,et0MmDay:c.fallback.et0MmDay*et}:null}));
  const plan=planSeason(next,offset?[]:events as WaterEvent[]),season=c.agronomic?.season;
  return {label:v.label,source:v.source,sowingDate,cycleEnd:end,season:season?(sowingDate>=season.from&&end<=season.to?'dans la fenêtre déclarée':'hors fenêtre déclarée'):'saison non qualifiée',estimate:plan.yieldEstimation??null,waterSourceM3:plan.complete?plan.totals.sourceM3:null,missing:plan.missing,basis:weather.some(w=>w.status==='scenario')||!!c.fallback?'scénario historique ou déclaré':'météo disponible',limits:['Pluies conservées sur leurs dates ; aucune translation du cycle météo.','Semis décalé : observations d’irrigation et de sol non transférées.','Pas de fenêtre optimale garantie ni de réponse variétale/nutritionnelle calibrée.']};
 });
 const ranges=['rainfed','recorded','proposed'].map(mode=>{const values=results.map(r=>r.estimate?.scenarios.find(s=>s.id===mode)?.totals?.yieldKgHaSown??null),complete=values.every(v=>v!==null);return {mode,complete,min:complete?Math.min(...values as number[]):null,max:complete?Math.max(...values as number[]):null,probability:null};});
 return {results,ranges,interpretation:'Plage des seuls scénarios testés ; pas un intervalle prédictif calibré. Les membres indisponibles ne sont pas supprimés.'};
}
export function harvestDiagnostic(predictedKgHa:number,observedKg:number,sownM2:number,moisture:number,reference:number){
 if(![predictedKgHa,observedKg,sownM2,moisture,reference].every(Number.isFinite)||predictedKgHa<0||observedKg<0||sownM2<=0||moisture<0||moisture>=100||reference<0||reference>=100)throw new InputError('Masse, surface ou humidité hors domaine.');
 const adjustedKg=observedKg*(1-moisture/100)/(1-reference/100),observedKgHa=adjustedKg/(sownM2/10000),error=predictedKgHa-observedKgHa;
 return {adjustedKg,observedKgHa,predictedKgHa,n:1,maeKgHa:Math.abs(error),rmseKgHa:Math.abs(error),biasKgHa:error,validatedForecast:false,interpretation:'Diagnostic individuel ; aucune validation temporelle/spatiale acquise.'};
}
