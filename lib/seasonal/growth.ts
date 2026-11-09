import {fitHarvestIndex,growthProfileId,type GrowthHarvestSample} from './growth-calibration.ts';
import type {SeasonalConfig,WaterPlan,WaterEvent} from './types.ts';
import {InputError,isoDate,addDays,validateConfig} from './validation.ts';
import {geometryIdentity} from './provenance.ts';
import {planWater} from './engine.ts';
import {applicationNutrients} from './management.ts';
import {landBlockReason} from './land.ts';

/** A transparent scenario model, NOT APSIM, AquaCrop, QUEFTS or a calibrated forecast.
 * RUE is above-ground dry matter per intercepted GLOBAL solar MJ (not PAR).
 * Nutrient supply is explicit plant-accessible kg ELEMENT/ha, never total soil N.
 */
export const GROWTH_VERSION='daily-rue-npk-1';
export type Triple=[number,number,number];
export type GrowthInput={
 version:typeof GROWTH_VERSION;acceptedScenario:true;scope:string;source:string;availableOn:string;
 history?:GrowthHarvestSample[];
 parameters:{rueGPerMj:number;harvestIndex:number;moisturePercent:number;temperatureC:[number,number,number,number];
  stages:{faparStart:number;faparEnd:number;waterSensitivity:number}[];
  nutrientKgPerTonneBiomass:Triple;fertilizerRecovery:Triple;
  /** Legacy field accepted for old exports, then cleared by parseGrowth. */
  phResponse:null|{analysisIndex:number;measurementIndex:number;method:string;curve:[number,number,number,number];source:string};
 };
 soilSupply:{initialKgHa:Triple;releaseKgHaDay:Triple;source:string};
 organicRelease:{productId:string;availableFraction:Triple;halfLifeDays:number;source:string}[];
 weatherScenario:null|{temperatureMeanC:number;radiationMj:number;source:string};
 satellite:null|{index:'NDVI'|'EVI';bare:number;full:number;maxAgeDays:number;source:string;
  observations:{date:string;availableOn:string;value:number;clearFraction:number;source:string}[]};
};
export const growthScope=(c:SeasonalConfig)=>JSON.stringify([c.country,geometryIdentity(c.parcelGeometry),c.cropProfile?.id,c.variety,c.sowingDate,c.stages.map(s=>[s.name,s.days,s.kcStart,s.kcEnd,s.rootStartM,s.rootEndM,s.depletionFraction])]);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function responseCurve(value:number,curve:readonly number[]){const [a,b,c,d]=curve;return value<=a||value>=d?0:value<b?(value-a)/(b-a):value<=c?1:(d-value)/(d-c);}
/** These are deliberately illustrative assumptions, not published maize coefficients.
 * Users must explicitly accept and replace them with a domain-specific parameter set.
 */
export function growthTemplate(c:SeasonalConfig):GrowthInput{
 return {version:GROWTH_VERSION,acceptedScenario:true,scope:growthScope(c),source:'Hypothèses illustratives saisies pour explorer les mécanismes ; aucun cultivar ni pays calibré.',availableOn:c.asOfDate,
 parameters:{rueGPerMj:1.5,harvestIndex:.45,moisturePercent:15,temperatureC:[8,25,32,45],
 stages:c.stages.map((_,i,a)=>({faparStart:i===0?0:i===1?.15:.85,faparEnd:i===0?.15:i===a.length-1?.1:.85,waterSensitivity:1})),
 nutrientKgPerTonneBiomass:[15,2.5,15],fertilizerRecovery:[.5,.2,.5],phResponse:null},
 soilSupply:{initialKgHa:[30,8,40],releaseKgHaDay:[.3,.02,.2],source:'Hypothèses de fourniture accessible ; aucune conversion des analyses SoilGrids.'},organicRelease:[],weatherScenario:null,satellite:null};
}
export function parseGrowth(value:unknown,c:SeasonalConfig):GrowthInput|undefined{
 if(value===undefined)return undefined;
 const v=structuredClone(value) as GrowthInput;
 const fail=(m:string):never=>{throw new InputError('Croissance intégrée : '+m);};
 const text=(x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=1200;
 const num=(x:unknown,a:number,b:number):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const triple=(x:unknown,a:number,b:number)=>Array.isArray(x)&&x.length===3&&x.every(n=>num(n,a,b));
 const curve=(x:unknown,a:number,b:number)=>Array.isArray(x)&&x.length===4&&x.every(n=>num(n,a,b))&&x[0]<x[1]&&x[1]<=x[2]&&x[2]<x[3];
 if(!v||v.version!==GROWTH_VERSION||v.acceptedScenario!==true||typeof v.scope!=='string'||v.scope.length>300000||!v.scope||!text(v.source))fail('accord explicite et provenance requis.');
 isoDate(v.availableOn);if(v.availableOn>c.asOfDate)fail('paramètres indisponibles à la date du calcul.');
 const p=v.parameters;
 if(!p||!num(p.rueGPerMj,.01,10)||!num(p.harvestIndex,.01,.9)||!num(p.moisturePercent,0,40)||!curve(p.temperatureC,-30,65)||!Array.isArray(p.stages)||p.stages.length!==c.stages.length)fail('RUE, indice de récolte, humidité, températures et stades invalides.');
 if(p.stages.some(s=>!s||!num(s.faparStart,0,1)||!num(s.faparEnd,0,1)||!num(s.waterSensitivity,.1,5)))fail('interception ou sensibilité hydrique de stade invalide.');
 if(!triple(p.nutrientKgPerTonneBiomass,.001,200)||!triple(p.fertilizerRecovery,0,1))fail('besoins N/P/K et récupération invalides.');
 if(!v.soilSupply||!triple(v.soilSupply.initialKgHa,0,10000)||!triple(v.soilSupply.releaseKgHaDay,0,100)||!text(v.soilSupply.source))fail('fourniture accessible du sol requise avec source.');
 if(p.phResponse){const h=p.phResponse;if(!Number.isInteger(h.analysisIndex)||!Number.isInteger(h.measurementIndex)||!text(h.method)||!text(h.source)||!curve(h.curve,0,14))fail('ancienne courbe pH invalide.');}
 // Retain the legacy wire field for old campaign files, but normalize it away:
 // EcoCrop suitability bounds are not a quantitative yield-response curve.
 p.phResponse=null;
 if(v.weatherScenario!==null&&(!v.weatherScenario||!num(v.weatherScenario.temperatureMeanC,-30,60)||!num(v.weatherScenario.radiationMj,0,40)||!text(v.weatherScenario.source)))fail('scénario météo explicite invalide.');
 if(!Array.isArray(v.organicRelease)||v.organicRelease.length>200)fail('profils de libération organique invalides.');
 for(const r of v.organicRelease)if(!r||!text(r.productId)||!triple(r.availableFraction,0,1)||!num(r.halfLifeDays,.1,3660)||!text(r.source))fail('fractions, demi-vie et source de libération organique requises.');
 if(new Set(v.organicRelease.map(r=>r.productId)).size!==v.organicRelease.length)fail('profil organique dupliqué.');
 if(v.satellite!==null){const s=v.satellite;if(!s||!['NDVI','EVI'].includes(s.index)||!num(s.bare,-1,1)||!num(s.full,-1,1)||s.full<=s.bare||!Number.isInteger(s.maxAgeDays)||s.maxAgeDays<0||s.maxAgeDays>30||!text(s.source)||!Array.isArray(s.observations)||s.observations.length>366)fail('transformation satellite invalide.');
 const end=addDays(c.sowingDate,c.stages.reduce((n,s)=>n+s.days,0)-1);
 for(const o of s.observations){if(!o||!num(o.value,-1,1)||!num(o.clearFraction,.8,1)||!text(o.source))fail('observation satellite ou qualité invalide.');isoDate(o.date);isoDate(o.availableOn);if(o.date<c.sowingDate||o.date>end||o.date>c.asOfDate||o.availableOn<o.date||o.availableOn>c.asOfDate)fail('observation satellite hors cycle ou indisponible à cette date.');}
 if(new Set(s.observations.map(o=>o.date)).size!==s.observations.length)fail('observation satellite dupliquée.');s.observations.sort((a,b)=>a.date.localeCompare(b.date));}
 if(v.history!==undefined)fitHarvestIndex(v.history,{country:c.country,cropId:c.cropProfile?.id??'',variety:c.variety,profileId:growthProfileId(p),asOfDate:c.asOfDate});
 return v;
}
export type GrowthDay={date:string;stage:string;fapar:number;canopySource:'parameter'|'satellite';temperatureC:number;radiationMj:number;temperatureFactor:number;waterFactor:number;nutrientFactor:number;biomassKgHa:number;incrementKgHa:number;uptakeKgHa:Triple;stockKgHa:Triple};
export type GrowthScenario={id:string;label:string;days:GrowthDay[];biomassKgHa:number;yieldDryKgHa:number;yieldKgHa:number;productionKg:number;balance:{suppliedKgHa:Triple;uptakeKgHa:Triple;remainingKgHa:Triple;residualKgHa:Triple}};
export type GrowthResult={version:typeof GROWTH_VERSION;status:'scenario'|'unavailable';validated:false;predictiveInterval95:null;missing:string[];limits:string[];areaM2:number|null;areaBasis:'planned'|'sown';moisturePercent:number|null;phFactor:number|null;calibration?:ReturnType<typeof fitHarvestIndex>;scenarios:GrowthScenario[];factors:{factor:string;role:string}[]};
export function integratedGrowth(c:SeasonalConfig,events:WaterEvent[],plan:WaterPlan):GrowthResult{
 const v=c.growth,p=v?.parameters;
 const calibration=v?.history?fitHarvestIndex(v.history,{country:c.country,cropId:c.cropProfile?.id??'',variety:c.variety,profileId:growthProfileId(p!),asOfDate:c.asOfDate}):undefined;
 const out:GrowthResult={version:GROWTH_VERSION,status:'unavailable',validated:false,predictiveInterval95:null,missing:[],areaM2:null,areaBasis:c.yieldEstimation?(c.yieldEstimation.areaBasis??'sown'):'planned',moisturePercent:p?.moisturePercent??null,phFactor:null,scenarios:[],
 limits:['Scénario journalier exploratoire, pas une prévision calibrée localement. Paramètres et fournitures accessibles à justifier.',
 'Biomasse aérienne sèche par rayonnement intercepté ; cycle et stades calendaires déclarés. Pas de phénologie thermique, racines nourries ou croissance de couvert dynamique.',
 'ET réelle/ET demandée est un proxy de stress : évaporation et transpiration ne sont pas séparées. Aucun facteur FAO Ky ni QUEFTS supplémentaire appliqué.',
 'Stocks N/P/K accessibles simplifiés ; pertes et fourniture quotidienne sont incorporées aux hypothèses. Pas de chimie du sol, toxicité, fixation biologique, ravageurs ou effet structurel du compost.',
 'L’indice de récolte est fixe : stérilité de floraison et pertes de récolte non modélisées. Le rendement de produit est corrigé à l’humidité déclarée.',
 'Couvert satellite observé utilisé uniquement de sa date à son âge maximal, sans extrapolation lointaine. Les contrefactuels conservent ce couvert observé, donc ne mesurent pas un effet causal total.'],
 factors:[{factor:'Sol physique',role:'Utilisés : eau au champ, flétrissement, humidité initiale, infiltration et enracinement alimentent le bilan hydrique. Texture, densité apparente et éléments grossiers bruts ne sont pas des pénalités autonomes.'},{factor:'Chimie du sol / pH',role:'Diagnostic seulement : pH, carbone organique, azote total, CEC et teneurs P/K ne sont pas convertis en réponse du rendement ou en nutriments disponibles.'},{factor:'Fertilité / engrais',role:'Utilisés dans ce scénario via les stocks N/P/K élémentaires, les compositions des apports et les récupérations/libérations explicitement déclarées ; ce ne sont pas des paramètres locaux calibrés.'},{factor:'Météo',role:'Pluie et ET0 alimentent le bilan d’eau. Température et rayonnement interviennent dans la croissance journalière uniquement via le profil exploratoire déclaré.'},{factor:'Culture / stades / variété',role:'La culture choisit les paramètres hydriques documentés disponibles ; stades et racines suivent le profil déclaré. La variété n’active pas automatiquement des coefficients spécifiques.'},{factor:'Vigueur satellite',role:v?.satellite?'Utilisée pour actualiser l’interception pendant les seules dates qualifiées.':'Non utilisée ; le couvert reste paramétré.'},{factor:'Récoltes passées',role:'L’indice de récolte peut être ajusté sur des biomasses archivées compatibles ; cela ne calibre pas les autres paramètres.'}]};
 if(calibration)out.calibration=calibration;
 if(v?.weatherScenario)out.limits.push('Température et rayonnement manquants complétés par le scénario explicite : '+v.weatherScenario.source);
 if(!v){out.missing.push('Activez un profil de croissance documenté dans Rendement.');return out;}
 if(v.scope!==growthScope(c))out.missing.push('Parcelle, culture, variété, semis ou stades modifiés : réexaminer le profil et le réactiver.');
 const block=landBlockReason(c);if(block)out.missing.push(block);
 if(!plan.complete||plan.status==='blocked')out.missing.push(...plan.missing,'Bilan hydrique complet requis.');
 if(!['maize','sorghum','millet','rice-upland'].includes(c.cropProfile?.id??''))out.missing.push('Profil de produit limité aux céréales grain terrestres ; autres produits à paramétrer avec un modèle adapté.');
 if(c.systemDomain!=='upland'||c.waterCondition!=='drained')out.missing.push('Sol terrestre drainé requis ; riz submergé et engorgement hors domaine.');
 if(c.agronomic&&c.agronomic.system!=='single')out.missing.push('Associations et successions hors domaine.');
 const y=c.yieldEstimation,u=y?.units[0];
 if(y&&(y.units.length!==1||!plan.yieldEstimation?.coverage.complete))out.missing.push('Une seule unité homogène et une couverture spatiale vérifiée sont requises.');
 out.areaM2=y?(plan.yieldEstimation?.surface.simulationM2??null):c.sowingPlan?.areaM2??plan.calculationArea?.areaM2??null;
 if(!(out.areaM2!>0)||!plan.calculationArea?.geometry)out.missing.push('Surface terrestre positive prévue ou semée requise.');
 if(c.salinity||(c.soilAnalyses??[]).some(a=>a.measurements.some(m=>m.parameter==='EC')))out.missing.push('Analyse de salinité présente : interaction à qualifier ; moteur intégré suspendu.');
 // Soil pH is retained as a diagnostic. EcoCrop suitability ranges do not
 // provide a measured yield-response curve, so user curves must not silently
 // alter nutrient supply or fertilizer recovery.
 out.phFactor=null;
 const products=c.managementPlan?.products.filter(a=>a.kind==='fertilizer')??[];
 for(const r of v.organicRelease)if(!products.some(a=>a.id===r.productId&&a.composition?.kind==='organic'))out.missing.push(`Profil organique ${r.productId} sans produit organique correspondant.`);
 for(const a of products){if(a.status==='planned'&&a.date<c.asOfDate)out.missing.push(`${a.product} : apport prévu dans le passé à clarifier.`);
 const n=applicationNutrients(a)?.elementalKgHa;if(!n||[n.N,n.P,n.K].some(n=>n===null))out.missing.push(`${a.product} : composition N/P/K incomplète.`);
 if(a.composition?.kind==='organic'&&!v.organicRelease.some(r=>r.productId===a.id))out.missing.push(`${a.product} : profil de libération organique sourcé requis.`);}
 const config=u?.conditions?validateConfig({...c,...u.conditions,inputs:undefined}):c;
 if(config.waterCondition!=='drained')out.missing.push('Le sol de l’unité doit être drainé.');
 // Check the actual forcing, never patch a missing day with a hidden climatology.
 const weather=new Map(config.weather.map(w=>{const copy={...w};for(const k of ['temperatureMeanC','temperatureMinC','temperatureMaxC','radiationMj'] as const)if(config.inputs?.values[`weather.${w.date}.${k}`]?.status==='missing')copy[k]=null;return [w.date,copy];}));
 for(const d of plan.days){const w=weather.get(d.date),t=w?.temperatureMeanC??(w?.temperatureMinC!=null&&w?.temperatureMaxC!=null?(w.temperatureMinC+w.temperatureMaxC)/2:undefined)??v.weatherScenario?.temperatureMeanC,r=w?.radiationMj??v.weatherScenario?.radiationMj;if(t==null||r==null)out.missing.push(`${d.date} : température moyenne et rayonnement journaliers requis ou scénario explicite.`);}
 if(out.missing.length){out.missing=[...new Set(out.missing)];return out;}
 const definitions=[['rainfed','Sans irrigation ni engrais prévus','rainfed',false],['recorded','Apports réalisés uniquement','recorded',false],['proposed','Eau et engrais prévus','proposed',true],['without-planned-fertilizer','Même eau, sans engrais prévu','proposed',false]] as const;
 for(const [id,label,irrigationMode,includePlanned] of definitions){
 const ev=events.filter(e=>irrigationMode!=='rainfed'||e.kind==='rain');
 const water=planWater(config,ev,{irrigationMode,unitAreaM2:out.areaM2!,unitGeometry:plan.calculationArea!.geometry});
 if(!water.complete||water.status==='blocked'){out.missing.push(...water.missing);continue;}
 const stock=[...v.soilSupply.initialKgHa] as Triple,supplied=[...stock] as Triple,uptake:Triple=[0,0,0];
 const used=products.filter(a=>a.status==='declared'||includePlanned).map(a=>{const n=applicationNutrients(a)!.elementalKgHa;return {date:a.date,mass:[n.N!,n.P!,n.K!],release:a.composition?.kind==='organic'?v.organicRelease.find(r=>r.productId===a.id)!:null};});
 let biomass=0;const days:GrowthDay[]=[];
 const offsets=c.stages.map((_,i)=>c.stages.slice(0,i).reduce((n,s)=>n+s.days,0));
 for(const [i,d] of water.days.entries()){
 const w=weather.get(d.date),temperatureC=w?.temperatureMeanC??(w?.temperatureMinC!=null&&w?.temperatureMaxC!=null?(w.temperatureMinC+w.temperatureMaxC)/2:undefined)??v.weatherScenario!.temperatureMeanC,radiationMj=w?.radiationMj??v.weatherScenario!.radiationMj;
 const s=p!.stages[d.stageIndex],f=(i-offsets[d.stageIndex]+.5)/c.stages[d.stageIndex].days;
 let fapar=s.faparStart+(s.faparEnd-s.faparStart)*f,canopySource:GrowthDay['canopySource']='parameter';
 const satellite=v.satellite,observation=satellite?.observations.filter(o=>o.date<=d.date&&(Date.parse(d.date)-Date.parse(o.date))/86400000<=satellite.maxAgeDays).at(-1);
 if(satellite&&observation){fapar=clamp((observation.value-satellite.bare)/(satellite.full-satellite.bare));canopySource='satellite';}
 const temperatureFactor=responseCurve(temperatureC,p!.temperatureC),waterFactor=d.demandMm>0?Math.pow(clamp(d.actualEtMm/d.demandMm),s.waterSensitivity):1;
 const potential=radiationMj*fapar*p!.rueGPerMj*10*temperatureFactor*waterFactor;
 for(let k=0;k<3;k++){let addition=v.soilSupply.releaseKgHaDay[k];
 for(const a of used){const mass=a.mass[k];if(a.release){
 const r=a.release,age=(Date.parse(d.date)-Date.parse(a.date))/86400000;if(age>=0)addition+=mass*r.availableFraction[k]*(Math.pow(.5,age/r.halfLifeDays)-Math.pow(.5,(age+1)/r.halfLifeDays));
 }else if(a.date===d.date)addition+=mass*p!.fertilizerRecovery[k];}
 stock[k]+=addition;supplied[k]+=addition;}
 const nutrientFactor=potential>0?Math.min(1,...stock.map((n,k)=>n/(potential/1000*p!.nutrientKgPerTonneBiomass[k]))):1,incrementKgHa=potential*nutrientFactor;
 for(let k=0;k<3;k++){const taken=incrementKgHa/1000*p!.nutrientKgPerTonneBiomass[k];stock[k]=Math.max(0,stock[k]-taken);uptake[k]+=taken;}
 biomass+=incrementKgHa;days.push({date:d.date,stage:d.stage,fapar,canopySource,temperatureC,radiationMj,temperatureFactor,waterFactor,nutrientFactor,incrementKgHa,biomassKgHa:biomass,uptakeKgHa:[...uptake],stockKgHa:[...stock]});
 }
 const dry=biomass*(calibration?.harvestIndex??p!.harvestIndex),yieldKgHa=dry/(1-p!.moisturePercent/100);
 out.scenarios.push({id,label,days,biomassKgHa:biomass,yieldDryKgHa:dry,yieldKgHa,productionKg:yieldKgHa*out.areaM2!/10000,balance:{suppliedKgHa:supplied,uptakeKgHa:uptake,remainingKgHa:stock,residualKgHa:supplied.map((n,k)=>n-uptake[k]-stock[k]) as Triple}});
 }
 if(out.missing.length){out.scenarios=[];return out;}
 out.status='scenario';return out;
}
