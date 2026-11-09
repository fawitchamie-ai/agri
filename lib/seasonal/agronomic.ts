import {planSeason} from './yield.ts';
import {validateConfig,addDays,InputError} from './validation.ts';
import {declareScenario,reconcileInputs,geometryIdentity} from './provenance.ts';
import type {SeasonalConfig,WaterEvent} from './types.ts';
export const AGRONOMIC_VERSION='agronomic-1';
export type AgronomicConfig={version:'agronomic-1';geometryId:string;system:'single'|'associated'|'succession'|'multiple';season:{from:string;to:string;source:string}|null;observations:{parameter:string;value:number|string|null;unit:string;method:string;source:string;depthCm:[number,number]|null;availableOn:string}[]};
const groups:Record<string,string[]>={
 'Géométrie et paysage':['Contour','Surface prévue à semer','Surface effectivement semée','Surface récoltée','Occupation du sol','Pente','Relief','Position topographique','Érosion','Ombrage','Incertitude des frontières','Connexion hydraulique'],
 'Sol physique':['Texture','Profondeur exploitable','Cailloux','Densité apparente','Compaction','Croûte de battance','Infiltration','Conductivité hydraulique','Capacité au champ','Flétrissement','Réserve utile','Humidité initiale','Humidité à 10 kPa','Nappe','Drainage'],
 'Chimie et biologie':['pH','Carbone organique','Densité de carbone organique','Stock de carbone organique','Matière organique','Azote total','Azote minéral','Phosphore assimilable','Potassium échangeable','CEC','Salinité','Sodicité','Acidité','Toxicités','Biologie du sol'],
 'Climat':['Pluie journalière','Distribution des pluies','Épisodes secs','Pluies intenses','Température moyenne','Température minimale','Température maximale','Rayonnement','Humidité relative','Vent','ET0','Début de saison','Fin de saison'],
 'Culture':['Espèce','Variété','Photopériode','Temps thermique','Semis','Levée','Stades','Densité','Enracinement','Durée du cycle','NDVI/EVI','Biomasse','Indice de récolte','Réponse au déficit hydrique','Tolérance à la submersion','Tolérance à la chaleur','Tolérance à la salinité','Ym indépendant'],
 'Conduite et ressources':['Qualité des semences','Irrigation réalisée','Irrigation proposée','Débit','Quota','Efficacité','Énergie','Fertilisation','Rotations','Précédent cultural','Résidus','Travail du sol','Paillage','Adventices','Ravageurs','Maladies','Accès aux interventions','Cultures associées','Récoltes multiples'],
 'Produit et récolte':['Organe récolté','Produit frais ou sec','Humidité de référence','Production biologique','Récolte observée','Qualité commercialisable','Pertes de récolte']};
const paths:Record<string,RegExp>={
 'Texture':/^source\.soil\.(sand|silt|clay)$/,'Cailloux':/^source\.soil\.coarseFragments$/,'Densité apparente':/^source\.soil\.bulkDensity$/,
 'pH':/^source\.soil\.ph$/,'Carbone organique':/^source\.soil\.organicC$/,'Densité de carbone organique':/^source\.soil\.organicCarbonDensity$/,'Stock de carbone organique':/^source\.soil\.organicCarbonStock$/,'Azote total':/^source\.soil\.totalN$/,'CEC':/^source\.soil\.cec$/,'Humidité à 10 kPa':/^source\.soil\.waterContent10kPa$/,
 'Capacité au champ':/^soil\.layers.*thetaFC$/,'Flétrissement':/^soil\.layers.*thetaWP$/,'Humidité initiale':/^soil\.layers.*initialTheta$/,'Infiltration':/^soil\.infiltrationMmDay$/,'Enracinement':/^stages.*root/,'Stades':/^stages.*days$/,'Pluie journalière':/^weather.*rainMm$/,'ET0':/^weather.*et0Mm$/,'Température moyenne':/^weather.*temperatureMeanC$/,'Température minimale':/^weather.*temperatureMinC$/,'Température maximale':/^weather.*temperatureMaxC$/,'Humidité relative':/^weather.*humidityPercent$/,'Vent':/^weather.*wind2mMs$/,'Rayonnement':/^weather.*radiationMj$/,'Débit':/^system.sourceFlowM3h$/,'Quota':/^system.sourceBudgetM3$/,'Efficacité':/^system.*Efficiency$/,'Semis':/^sowingDate$/,'Espèce':/^crop$/,'Variété':/^variety$/};
const chemistry:Record<string,string>={'pH':'pH','Carbone organique':'organicC','Matière organique':'organicMatter','Azote total':'totalN','Azote minéral':'mineralN','Phosphore assimilable':'availableP','Potassium échangeable':'exchangeableK','CEC':'CEC','Salinité':'EC'};
function modelRole(parameter:string,c:SeasonalConfig):string{
 const growth=!!c.growth,crop=c.cropProfile?.id??'';
 const direct:Record<string,string>={
  'Contour':'Utilisé pour borner la parcelle, les surfaces terrestres et les calculs spatiaux.',
  'Surface prévue à semer':'Utilisée avant semis comme surface de production du scénario.',
  'Surface effectivement semée':'Utilisée après semis comme dénominateur de production.',
  'Surface récoltée':'Utilisée seulement quand une référence est exprimée par hectare récolté.',
  'Occupation du sol':'Utilisée pour exclure les classes cartographiées incompatibles avec la surface terrestre candidate.',
  'Capacité au champ':'Utilisée directement dans le stockage d’eau des horizons racinés.',
  'Flétrissement':'Utilisé directement comme limite basse de l’eau disponible par horizon.',
  'Réserve utile':'Dérivée de la capacité au champ moins le flétrissement, pondérée par les racines actives.',
  'Humidité initiale':'Utilisée directement comme stock de départ ; une valeur supposée reste une hypothèse.',
  'Infiltration':'Utilisée pour limiter l’infiltration journalière et estimer le ruissellement.',
  'Enracinement':'Utilisé via les profondeurs racinaires déclarées par stade ; aucune profondeur de sol n’est déduite de la carte.',
  'Stades':'Utilisés pour répartir les durées, coefficients hydriques et racines du cycle.',
  'Pluie journalière':'Utilisée à sa date dans le bilan d’eau ; sa distribution quotidienne est conservée.',
  'ET0':'Utilisée dans la demande ETc avec les coefficients culturaux du profil hydrique.',
  'Semis':'Utilisé pour aligner météo, apports, stades et durée du cycle.',
  'Espèce':'Utilisée pour choisir la fiche culturale et les coefficients hydriques disponibles.',
  'Débit':'Utilisé pour vérifier la durée des apports proposés.',
  'Quota':'Utilisé pour borner le volume d’irrigation proposé sur le cycle.',
  'Efficacité':'Utilisée pour convertir le besoin net en volume au champ et à la source.',
  'Ym indépendant':'Utilisé comme référence seulement si sa source, son produit et son dénominateur sont déclarés compatibles.',
  'Récolte observée':'Utilisée pour un diagnostic post-récolte ou, si un jeu compatible est fourni, l’ajustement séparé de l’indice de récolte.',
 };
 if(direct[parameter])return direct[parameter];
 if(['Température moyenne','Température minimale','Température maximale','Rayonnement'].includes(parameter))return growth?'Utilisés dans la croissance journalière exploratoire via la courbe thermique et la biomasse par rayonnement intercepté.':'Stockés lorsqu’ils sont disponibles, mais absents du rendement hydrique standard ; utilisés uniquement si la croissance intégrée exploratoire est activée.';
 if(parameter==='Azote minéral'||parameter==='Phosphore assimilable'||parameter==='Potassium échangeable'||parameter==='Fertilisation')return growth?'Utilisés uniquement lorsqu’ils sont convertis en stock accessible ou apport complet dans le profil de croissance déclaré ; aucune analyse brute n’est convertie automatiquement.':'Comptabilisés ou diagnostiqués, sans effet automatique sur le rendement standard.';
 if(parameter==='pH')return 'Diagnostic seulement : le pH et les bornes EcoCrop ne sont pas convertis en multiplicateur de rendement ni en fourniture N/P/K.';
 if(parameter==='Carbone organique'||parameter==='Densité de carbone organique'||parameter==='Stock de carbone organique'||parameter==='Matière organique'||parameter==='Azote total'||parameter==='CEC')return 'Récupéré ou saisi pour le diagnostic ; pas converti en nutriment disponible ou en réponse de rendement.';
 if(parameter==='Texture'||parameter==='Cailloux'||parameter==='Densité apparente'||parameter==='Humidité à 10 kPa')return 'Récupéré pour décrire le sol ; pas utilisé directement. Le bilan utilise les estimations de rétention aux tensions dédiées (33 et 1500 kPa).';
 if(parameter==='Réponse au déficit hydrique')return crop==='maize'||crop==='sorghum'?'Utilisée dans le scénario hydrique FAO-56 séparé via Ky saisonnier ; le moteur journalier intégré emploie sa propre sensibilité déclarée.':'Utilisée dans le bilan journalier d’eau ; aucun Ky saisonnier qualifié pour cette culture.';
 if(parameter==='Tolérance à la salinité')return 'Scénario FAO-56 isolé seulement pour les couples culture/produit paramétrés ; pas combiné au rendement hydrique ou au moteur de croissance.';
 if(parameter==='Variété')return 'Utilisée comme clé de portée de la calibration déclarée ; aucun coefficient variétal n’est choisi automatiquement.';
 if(parameter==='Rayonnement'||parameter==='Biomasse'||parameter==='Indice de récolte'||parameter==='Production biologique')return growth?'Utilisé dans le scénario de croissance intégré, avec paramètres explicitement déclarés et non calibrés localement.':'Non utilisé par le rendement hydrique standard.';
 if(parameter==='NDVI/EVI'||parameter==='Vigueur satellite')return growth&&c.growth?.satellite?'Utilisé seulement si les observations NDVI/EVI qualifiées sont importées dans le profil actif.':'Les mosaïques affichées ne sont pas assimilées automatiquement comme mesure numérique de couvert.';
 if(parameter==='Irrigation réalisée'||parameter==='Irrigation proposée')return 'Utilisée dans le bilan d’eau si elle est saisie comme événement réalisé ou planifié à la bonne date et sur la bonne surface.';
 if(parameter==='Salinité')return 'Analyse diagnostique ; réponse quantitative uniquement dans le scénario salinité isolé, si méthode, profondeur, période et culture sont compatibles.';
 if(parameter==='Humidité relative'||parameter==='Vent')return 'Conservés comme variables météo ; l’ET0 fournie est utilisée, ces variables brutes ne sont pas un multiplicateur distinct.';
 if(parameter==='Distribution des pluies'||parameter==='Épisodes secs'||parameter==='Pluies intenses')return 'Pas de facteur distinct : les pluies datées entrent déjà dans le bilan hydrique journalier.';
 if(parameter==='Durée du cycle')return 'Dérivée de la somme des jours de stades et utilisée pour fixer l’horizon du calcul.';
 return 'Indicatif ou non modélisé : aucun effet chiffré n’est appliqué dans le moteur actuel.';
}
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
  const planned=c.yieldEstimation?.areaBasis==='planned';
  const derived:Record<string,unknown>={'Contour':c.parcelGeometry?'GeoJSON complet':null,'Surface prévue à semer':planned?c.yieldEstimation?.units.map(u=>u.sownAreaM2)??null:null,'Surface effectivement semée':!planned?c.yieldEstimation?.units.map(u=>u.sownAreaM2)??null:null,'Surface récoltée':c.yieldEstimation?.units.map(u=>u.harvestedAreaM2)??null,'Occupation du sol':c.landAssessment?.fractions??null,'Ym indépendant':c.yieldEstimation?.units.map(u=>u.reference)??null,'Durée du cycle':c.stages.reduce((n,s)=>n+s.days,0)};
  const role=modelRole(parameter,c),used=/^Utilis[ée]/.test(role);
  return {parameter,group,status:available.length?'récupéré ou saisi':derived[parameter]!=null?'dérivé':observations.length?'déclaré':'manquant',role,used,unit:evidence[0]?.unit??observations[0]?.unit??(parameter.includes('Surface')?'m²':'à documenter'),evidence:evidence.slice(0,6),availableValues:available.length,totalValues:evidence.length,observations,derived:derived[parameter]??null,missing:available.length===0&&observations.length===0&&derived[parameter]==null,compatibility:'Culture, variété, profondeur et système à confirmer ; une donnée récupérée n’est pas un modèle de réponse.'};
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
