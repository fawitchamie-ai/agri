import type {SeasonalConfig} from './types.ts';
import type {Environment} from './environment.ts';
import {migrateInputs,environmentContext,geometryIdentity,missingEvidence,valueEvidence} from './provenance.ts';
import {applyCropProfile,cropById,CATALOG_VERSION} from './catalog.ts';

/** Explicit starting assumptions keep the first calculation usable, never measured. */
export function automaticCampaign(c:SeasonalConfig,cropId=c.cropProfile?.id??'maize',date=c.sowingDate):SeasonalConfig{
 const next={...c,name:c.name.trim()||'Mon champ',territory:c.territory.trim()||'Parcelle GPS',sowingDate:date,asOfDate:new Date().toISOString().slice(0,10),
 soil:{...c.soil,source:c.soil.layers.some(l=>l.initialTheta===null)?'Hypothèse hydrique modifiable : capacité 0,30, flétrissement 0,15 et réserve initiale à 60 % ; non mesurée':c.soil.source,layers:c.soil.layers.map(l=>({...l,initialTheta:l.initialTheta??l.thetaWP+.6*(l.thetaFC-l.thetaWP)}))},
 system:{...c.system,name:'Arrosage simulé',source:'Hypothèses modifiables : efficacité 75 %, transport sans perte ; disponibilité non vérifiée',applicationEfficiency:c.system.applicationEfficiency??.75,transportEfficiency:c.system.transportEfficiency??1},fallback:null};
 // A newly supplied default must replace its old null evidence, while keeping
 // the explicit scenario gate. Never relabel failed automatic acquisitions.
 const prepared=migrateInputs(next);
 const defaults:[string,number|null,string][]=[...prepared.soil.layers.map((l,i)=>[`soil.layers.${i}.initialTheta`,l.initialTheta,'m³/m³'] as [string,number|null,string]),['system.applicationEfficiency',prepared.system.applicationEfficiency,'fraction'],['system.transportEfficiency',prepared.system.transportEfficiency,'fraction']];
 for(const [path,value,unit] of defaults){
  const old=prepared.inputs!.values[path];
  if(value!==null&&old?.origin==='default'&&old.status==='missing')prepared.inputs!.values[path]=valueEvidence(value,unit,prepared.inputs!.scope.id,{origin:'default',status:'assumed',method:'Hypothèse initiale de scénario, modifiable',acquiredAt:new Date().toISOString(),replacementReason:'Valeur proposée par le logiciel ; acceptation explicite nécessaire.'});
 }
 const profile=cropById(cropId);
 if(profile?.water?.durationIssue)return migrateInputs({...prepared,crop:profile.name,cropProfile:{id:cropId,version:CATALOG_VERSION,mode:'reference'},stages:[],nutritionReference:undefined,parameterSource:'Durées spécifiques à compléter avec une référence locale'});
 return migrateInputs(applyCropProfile(prepared,cropId));
}
export function mergeEnvironment(input:SeasonalConfig,e:Environment):SeasonalConfig{
 const c=migrateInputs(input),id=c.inputs!.scope.id;
 if(e.scope && c.parcelGeometry && (e.scope.id!==id || geometryIdentity(e.scope.geometry)!==geometryIdentity(c.parcelGeometry)))return c;
 if(e.context&&e.context!==environmentContext(c))return c;
 const s=e.soil,date=e.retrievedAt.slice(0,10),values={...c.inputs!.values};
 for(const [key,v] of Object.entries(s.provenance??{}))values[`source.soil.${key}`]=v.value===null?missingEvidence(values[`source.soil.${key}`],v.unit,id,v.replacementReason??'Source absente',!!c.inputPolicy?.allowStale):{...v,scopeId:id};
 const specs=[['pH',s.ph,'pH','water','ph'],['organicC',s.organicC,'g/kg','SoilGrids','organicC'],['totalN',s.totalN,'g/kg','SoilGrids','totalN'],['CEC',s.cec,'cmol(+)/kg','SoilGrids','cec']] as const;
 const manual=(c.soilAnalyses??[]).flatMap((a,i)=>{
  const measurements=a.measurements.filter((m,j)=>values[`soilAnalyses.${i}.measurements.${j}.value`]?.status!=='missing'&&(values[`soilAnalyses.${i}.measurements.${j}.value`]?.origin==='manual'||a.status==='measured'||a.status==='declared'));
  return measurements.length?[{...a,measurements}]:[];
 });
 const protectedParameters=new Set(manual.flatMap(a=>a.measurements.map(m=>m.parameter)));
 const automatic=specs.filter(([parameter,value])=>value!==null&&!protectedParameters.has(parameter)).map(([parameter,value,unit,method,key])=>({parameter,value:value!,unit,method,key}));
 const analyses=[...manual,...(automatic.length?[{source:s.source,date:null,availableOn:date,topCm:5,bottomCm:15,status:'estimated' as const,measurements:automatic.map(({key,...m})=>m)}]:[])];
 // Retention of a failed acquisition is opt-in, with its original timestamp.
 if(c.inputPolicy?.allowStale){
  for(const [i,a] of (c.soilAnalyses??[]).entries())for(const [j,m] of a.measurements.entries()){
   const old=values[`soilAnalyses.${i}.measurements.${j}.value`];
   if(old?.origin==='automatic'&&old.acquiredAt&&!analyses.some(a=>a.measurements.some(n=>n.parameter===m.parameter))){
    analyses.push({...a,measurements:[m]});
   }
  }
 }
 const old=c.soil.layers,allowHydraulic=old.every((_,i)=>['automatic','default'].includes(values[`soil.layers.${i}.thetaFC`]?.origin??'legacy'));
 let soil=c.soil;
 if(allowHydraulic&&s.hydraulicLayers){
  soil={...c.soil,source:'ISRIC SoilGrids : rétention estimée ; état initial et infiltration à vérifier',layers:s.hydraulicLayers.map((l,i)=>old.length===s.hydraulicLayers!.length&&values[`soil.layers.${i}.initialTheta`]?.origin==='manual'&&old[i].initialTheta!==null&&old[i].initialTheta!>=l.thetaWP&&old[i].initialTheta!<=l.thetaFC?{...l,initialTheta:old[i].initialTheta}:l)};
  for(const [i,l] of soil.layers.entries())for(const k of ['thicknessM','thetaFC','thetaWP','initialTheta'] as const){
   if(k==='initialTheta'&&values[`soil.layers.${i}.initialTheta`]?.origin==='manual'&&values[`soil.layers.${i}.initialTheta`].value===l.initialTheta)continue;
   const incoming=s.provenance?.[`layers.${i}.${k}`];
   values[`soil.layers.${i}.${k}`]=incoming?{...incoming,scopeId:id}:valueEvidence(l[k],k==='thicknessM'?'m':'m³/m³',id,{origin:k==='initialTheta'?'default':'automatic',status:k==='initialTheta'?'assumed':'estimated',acquiredAt:e.retrievedAt,replacementReason:k==='initialTheta'?'Réserve initiale supposée à 60 %, non mesurée.':null});
  }
 }else if(allowHydraulic){
  for(let i=0;i<old.length;i++)for(const k of ['thetaFC','thetaWP'] as const){
   const path=`soil.layers.${i}.${k}`,prior=values[path];
   if(prior?.origin==='automatic')values[path]=missingEvidence(prior,'m³/m³',id,'Rétention non récupérée lors de cette actualisation.',!!c.inputPolicy?.allowStale);
  }
 }
 const end=Date.parse(c.sowingDate)+(c.stages.reduce((s,l)=>s+l.days,0)-1)*86400000;
 const weather=new Map<string,SeasonalConfig['weather'][number]>();
 for(const w of e.weather)if(w.date>=c.sowingDate&&Date.parse(w.date)<=end)weather.set(w.date,w);
 for(const w of c.weather){
  if(w.date<c.sowingDate||Date.parse(w.date)>end)continue;
  const evidence=values[`weather.${w.date}.rainMm`];
  if(w.status==='observed'||evidence?.origin==='manual'){
   const incoming=weather.get(w.date),selected={...(incoming??w),provenance:{...(incoming?.provenance??{})}};
   for(const k of ['rainMm','et0Mm','temperatureMeanC','temperatureMinC','temperatureMaxC','humidityPercent','wind2mMs','radiationMj'] as const){
    const ev=values[`weather.${w.date}.${k}`];
    if(w[k]!==null&&w[k]!==undefined&&ev?.status!=='missing'&&(ev?.origin==='manual'||ev?.status==='measured')){selected[k]=w[k];if(ev)selected.provenance[k]=ev;}
   }
   if(w.status==='observed')selected.status='observed';
   weather.set(w.date,selected);
  }
  else if(!weather.has(w.date)&&c.inputPolicy?.allowStale&&evidence?.origin==='automatic'&&evidence.acquiredAt){
   weather.set(w.date,w);
   for(const k of ['rainMm','et0Mm','temperatureMeanC','temperatureMinC','temperatureMaxC','humidityPercent','wind2mMs','radiationMj']){const p=`weather.${w.date}.${k}`;if(values[p])values[p]={...values[p],retention:'stale_authorized',replacementReason:'Nouvelle acquisition indisponible ; conservation explicitement autorisée.'};}
  }
 }
 for(const [i,a] of analyses.entries())for(const [j,m] of a.measurements.entries()){
  const path=`soilAnalyses.${i}.measurements.${j}.value`,spec=specs.find(x=>x[0]===m.parameter);
  const manualOld=(c.soilAnalyses??[]).flatMap((a,ai)=>a.measurements.map((n,mi)=>({n,sourceStatus:a.status,ev:c.inputs!.values[`soilAnalyses.${ai}.measurements.${mi}.value`]}))).find(x=>x.n.parameter===m.parameter&&x.ev?.status!=='missing'&&(x.ev?.origin==='manual'||['measured','declared'].includes(x.sourceStatus)));
  const priorAutomatic=(c.soilAnalyses??[]).flatMap((a,ai)=>a.measurements.map((n,mi)=>({n,ev:c.inputs!.values[`soilAnalyses.${ai}.measurements.${mi}.value`]}))).find(x=>x.n.parameter===m.parameter&&x.ev?.origin==='automatic');
  values[path]=manualOld?.ev??(spec&&spec[1]===null&&priorAutomatic?.ev?{...priorAutomatic.ev,retention:'stale_authorized',replacementReason:'Acquisition indisponible ; ancienne estimation conservée sur choix explicite.'}:spec&&s.provenance?.[spec[4]]?{...s.provenance[spec[4]],scopeId:id}:valueEvidence(m.value,m.unit,id,{origin:'automatic',status:'estimated',acquiredAt:e.retrievedAt,depthCm:[5,15],provider:'ISRIC',product:'SoilGrids',productVersion:'2.0'}));
 }
 for(const w of weather.values())for(const k of ['rainMm','et0Mm','temperatureMeanC','temperatureMinC','temperatureMaxC','humidityPercent','wind2mMs','radiationMj'])if(w.provenance?.[k])values[`weather.${w.date}.${k}`]={...w.provenance[k],scopeId:id};
 return migrateInputs({...c,soil,soilAnalyses:analyses,asOfDate:date,weather:[...weather.values()].map(w=>({...w,...(w.provenance?{provenance:Object.fromEntries(Object.entries(w.provenance).map(([k,v])=>[k,{...v,scopeId:id}]))}:{})})).sort((a,b)=>a.date.localeCompare(b.date)),inputs:{...c.inputs!,values},landAssessment:e.landAssessment??c.landAssessment});
}
export function phSuitability(ph:number|null,optimal:number[]|null|undefined,absolute:number[]|null|undefined):number|null{
 if(ph===null||!optimal||!absolute)return null;
 if(ph>=optimal[0]&&ph<=optimal[1])return 100;
 if(ph<=absolute[0]||ph>=absolute[1])return 0;
 return Math.round(ph<optimal[0]?100*(ph-absolute[0])/(optimal[0]-absolute[0]):100*(absolute[1]-ph)/(absolute[1]-optimal[1]));
}
