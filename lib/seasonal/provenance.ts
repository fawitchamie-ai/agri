import type { SeasonalConfig } from './types.ts';
import type { ParcelPolygon } from './parcel.ts';

export const PROVENANCE_VERSION = 'inputs-1' as const;
export type EvidenceStatus = 'measured'|'estimated'|'forecast'|'scenario'|'assumed'|'missing';
export type InputValue = {
  version: typeof PROVENANCE_VERSION;
  value: number|string|boolean|number[]|null;
  rawValue: number|string|boolean|number[]|null;
  unit: string; rawUnit: string; method: string|null;
  depthCm: [number,number]|null;
  interval: {from:string;to:string}|null;
  provider: string|null; product: string|null; productVersion: string|null;
  observedAt: string|null; referencePeriod: {from:string;to:string}|null;
  acquiredAt: string|null; model: string|null; runAt: string|null;
  spatial: {point:[number,number]|null;cell:string|null;resolutionM:number|null;crs:string|null};
  uncertainty: {lower:number;upper:number;level:number;method:string}|null;
  status: EvidenceStatus; origin:'automatic'|'manual'|'default'|'catalog'|'legacy';
  scopeId:string; validUntil:string|null; replacementReason:string|null;
  retention:'fresh'|'stale_authorized'|'missing';
};
export type InputLedger = {
  version: typeof PROVENANCE_VERSION; migratedFrom:'unversioned'|null;
  scope:{id:string;geometry:ParcelPolygon|null;point:[number,number]|null};
  values:Record<string,InputValue>;
};

/** Full geometry is retained alongside the compact identifier; it is not a survey. */
export function geometryIdentity(shape:ParcelPolygon|undefined|null):string { return JSON.stringify(shape??null); }
export function environmentContext(c:Pick<SeasonalConfig,'parcelGeometry'|'country'|'sowingDate'|'stages'>):string{return JSON.stringify([c.parcelGeometry??null,c.country,c.sowingDate,c.stages.reduce((s,d)=>s+d.days,0)]);}
export function scopeId(shape:ParcelPolygon|undefined|null,point?:[number,number]|null):string {
  const key=shape?geometryIdentity(shape):JSON.stringify(point??null);
  let a=2166136261,b=2246822519;
  for(let i=0;i<key.length;i++){a=Math.imul(a^key.charCodeAt(i),16777619);b=Math.imul(b^key.charCodeAt(i),3266489917);}
  return 'geometry-1:'+ (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function valueEvidence(value:InputValue['value'],unit:string,scope:string,options:Partial<InputValue>={}):InputValue {
  return {version:PROVENANCE_VERSION,value,rawValue:value,unit,rawUnit:unit,method:null,depthCm:null,interval:null,
    provider:null,product:null,productVersion:null,observedAt:null,referencePeriod:null,acquiredAt:null,
    model:null,runAt:null,spatial:{point:null,cell:null,resolutionM:null,crs:null},uncertainty:null,
    status:value===null?'missing':'assumed',origin:'legacy',scopeId:scope,validUntil:null,
    replacementReason:'Origine historique non documentée ; aucune mesure déduite du libellé.',retention:value===null?'missing':'fresh',...options};
}
export function parseInputLedger(input:unknown):InputLedger|undefined {
  if(input===undefined)return undefined;
  const v=input as InputLedger;
  if(!v||v.version!==PROVENANCE_VERSION||!v.scope||typeof v.scope.id!=='string'||!v.values||typeof v.values!=='object'||Array.isArray(v.values)||Object.keys(v.values).length>6000)throw new Error('Provenance des entrées invalide.');
  const statuses=['measured','estimated','forecast','scenario','assumed','missing'],origins=['automatic','manual','default','catalog','legacy'];
  const scalar=(x:unknown)=>x===null||typeof x==='string'&&x.length<=1200||typeof x==='number'&&Number.isFinite(x)||typeof x==='boolean'||Array.isArray(x)&&x.length<=366&&x.every(n=>typeof n==='number'&&Number.isFinite(n));
  for(const [key,p] of Object.entries(v.values)){
    if(!/^[a-zA-Z0-9_.-]{1,160}$/.test(key)||!p||p.version!==PROVENANCE_VERSION||!statuses.includes(p.status)||!origins.includes(p.origin)||!scalar(p.value)||!scalar(p.rawValue)||typeof p.unit!=='string'||p.unit.length>100||typeof p.rawUnit!=='string'||p.rawUnit.length>100||!p.spatial||!['fresh','stale_authorized','missing'].includes(p.retention))throw new Error('Valeur de provenance invalide.');
    for(const k of ['method','provider','product','productVersion','model','replacementReason','scopeId'] as const)if(p[k]!==null&&(typeof p[k]!=='string'||p[k]!.length>1200))throw new Error('Métadonnée de provenance invalide.');
    for(const k of ['observedAt','acquiredAt','runAt','validUntil'] as const)if(p[k]!==null&&(typeof p[k]!=='string'||!Number.isFinite(Date.parse(p[k]!))))throw new Error('Date de provenance invalide.');
    if(p.scopeId!==v.scope.id)throw new Error('Portée de provenance incohérente.');
    if(p.depthCm!==null&&(!Array.isArray(p.depthCm)||p.depthCm.length!==2||!p.depthCm.every(n=>typeof n==='number'&&Number.isFinite(n))||p.depthCm[0]<0||p.depthCm[1]<=p.depthCm[0]))throw new Error('Profondeur de provenance invalide.');
    for(const interval of [p.interval,p.referencePeriod])if(interval!==null&&(!interval||!Number.isFinite(Date.parse(interval.from))||!Number.isFinite(Date.parse(interval.to))||interval.to<interval.from))throw new Error('Période de provenance invalide.');
    if(p.spatial.point!==null&&(!Array.isArray(p.spatial.point)||p.spatial.point.length!==2||!p.spatial.point.every(n=>typeof n==='number'&&Number.isFinite(n))||Math.abs(p.spatial.point[0])>180||Math.abs(p.spatial.point[1])>90))throw new Error('Position de provenance invalide.');
    if(p.spatial.resolutionM!==null&&(!Number.isFinite(p.spatial.resolutionM)||p.spatial.resolutionM<=0))throw new Error('Résolution de provenance invalide.');
    for(const s of [p.spatial.cell,p.spatial.crs])if(s!==null&&(typeof s!=='string'||s.length>1200))throw new Error('Cellule ou projection invalide.');
    if(p.uncertainty!==null&&(!p.uncertainty||![p.uncertainty.lower,p.uncertainty.upper,p.uncertainty.level].every(Number.isFinite)||p.uncertainty.lower>p.uncertainty.upper||p.uncertainty.level<=0||p.uncertainty.level>1||typeof p.uncertainty.method!=='string'))throw new Error('Incertitude de provenance invalide.');
    if(p.status==='missing'&&p.value!==null)throw new Error('Une entrée manquante ne peut pas porter de valeur.');
  }
  return structuredClone(v);
}
const unitFor=(key:string)=>key==='thetaFC'||key==='thetaWP'||key==='initialTheta'?'m³/m³':key==='thicknessM'||key.startsWith('root')?'m':key.endsWith('Mm')||key==='infiltrationMmDay'?'mm':key.endsWith('M3')?'m³':key==='areaM2'?'m²':key.endsWith('M3h')?'m³/h':key.includes('Efficiency')||key.includes('Fraction')?'fraction':key==='temperatureMeanC'?'°C':key==='days'||key==='minIntervalDays'?'day':key==='hoursPerDay'?'h/day':'1';
export function inputInventory(c:SeasonalConfig):{path:string;value:InputValue['value'];unit:string}[] {
  const result:{path:string;value:InputValue['value'];unit:string}[]=[];
  const add=(path:string,value:InputValue['value']|undefined,unit=unitFor(path.split('.').at(-1)!))=>result.push({path,value:value??null,unit});
  for(const k of ['country','crop','variety','sowingDate','asOfDate','systemDomain','waterCondition','areaM2','latitude','longitude'] as const)add(k,c[k]);
  add('adjustDepletionToEtc',c.adjustDepletionToEtc??false,'boolean');
  if(c.nutritionReference){add('nutritionReference.id',c.nutritionReference.id);c.nutritionReference.alreadyKgHa.forEach((v,i)=>add(`nutritionReference.alreadyKgHa.${i}`,v,'kg/ha'));}
  c.soil.layers.forEach((l,i)=>Object.entries(l).forEach(([k,v])=>add(`soil.layers.${i}.${k}`,v)));
  add('soil.infiltrationMmDay',c.soil.infiltrationMmDay,'mm/day');
  Object.entries(c.system).forEach(([k,v])=>{if(k==='source'||k==='name')return;if(k==='dailySourceLimits'){c.system.dailySourceLimits.forEach((l,i)=>{add(`system.dailySourceLimits.${i}.date`,l.date,'date');add(`system.dailySourceLimits.${i}.m3`,l.m3,'m³');});}else add(`system.${k}`,v as InputValue['value']);});
  c.stages.forEach((s,i)=>Object.entries(s).forEach(([k,v])=>add(`stages.${i}.${k}`,v)));
  c.weather.forEach(w=>{for(const k of ['rainMm','et0Mm','temperatureMeanC'] as const)add(`weather.${w.date}.${k}`,w[k]);});
  c.soilAnalyses?.forEach((a,i)=>a.measurements.forEach((m,j)=>add(`soilAnalyses.${i}.measurements.${j}.value`,m.value,m.unit)));
  if(c.fallback){add('fallback.rainMmDay',c.fallback.rainMmDay,'mm/day');add('fallback.et0MmDay',c.fallback.et0MmDay,'mm/day');}
  for(const [path,v] of Object.entries(c.inputs?.values??{}))if(path.startsWith('source.soil.'))add(path,v.value,v.unit);
  return result;
}
const sameValue=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function migrateInputs(c:SeasonalConfig):SeasonalConfig {
  const point=c.longitude!==null&&c.latitude!==null?[c.longitude,c.latitude] as [number,number]:null;
  const id=scopeId(c.parcelGeometry,point),previous=c.inputs;
  const matching=previous?.version===PROVENANCE_VERSION&&previous.scope.id===id&&geometryIdentity(previous.scope.geometry)===geometryIdentity(c.parcelGeometry);
  if(previous?.version===PROVENANCE_VERSION&&!matching&&(previous.scope.geometry||previous.scope.point)){
    c={...c,soilAnalyses:[],weather:[],landAssessment:undefined,inputPolicy:{allowAssumptions:false,allowStale:false},inputs:{...previous,values:Object.fromEntries(Object.entries(previous.values).filter(([k])=>!k.startsWith('source.soil.')))}};
  }
  const values:Record<string,InputValue>={};
  for(const item of inputInventory(c)){
    const candidate=previous?.version===PROVENANCE_VERSION?previous.values[item.path]:undefined;
    const prior=matching?candidate:candidate?.origin==='default'?{...candidate,scopeId:id}:undefined;
    values[item.path]=prior&&prior.unit===item.unit&&(sameValue(prior.value,item.value)||prior.status==='missing')?prior:valueEvidence(item.value,item.unit,id);
    if(!prior&&c.parcelGeometry&&['areaM2','latitude','longitude'].includes(item.path))values[item.path]={...values[item.path],origin:'automatic',status:'estimated',provider:'Contour dessiné',product:'Géométrie GeoJSON',productVersion:'geometry-1',method:'Aire sphérique R=6371008,8 m et point représentatif ; pas une mesure cadastrale',replacementReason:'Dérivé du contour ; date de relevé des sommets inconnue.'};
    if(prior?.validUntil&&Date.parse(prior.validUntil)<Date.parse(c.asOfDate+'T00:00:00Z'))values[item.path]={...prior,value:null,status:'missing',retention:'missing',replacementReason:'Validité déclarée expirée à la date du conseil.'};
    if(!prior&&item.path.startsWith('stages.')&&c.cropProfile)values[item.path]={...values[item.path],origin:'catalog',product:`Profil cultural ${c.cropProfile.id}`,productVersion:c.cropProfile.version,method:c.parameterSource,status:'assumed',replacementReason:'Paramètre de référence, pas une calibration de la variété au champ.'};
  }
  // Legacy classifications are deliberately conservative. Text labels never grant
  // measured/automatic status, an acquisition date or permission to reuse data.
  const soilAnalyses=c.soilAnalyses?.map((a,i)=>{
    a.measurements.forEach((m,j)=>{
      const k=`soilAnalyses.${i}.measurements.${j}.value`;
      if(matching&&previous.values[k]&&sameValue(previous.values[k].value,m.value))return;
      values[k]=valueEvidence(m.value,m.unit,id,{origin:'legacy',status:a.status==='measured'?'measured':a.status==='declared'?'scenario':'estimated',
        provider:a.status==='measured'||a.status==='declared'?a.source:null,method:m.method,depthCm:[a.topCm,a.bottomCm],
        observedAt:a.status==='estimated'?null:a.date,acquiredAt:null,replacementReason:'Migration : date de collecte inconnue ; le libellé de source n’est pas une preuve.'});
    });
    return a.status==='estimated'?{...a,date:null}:a;
  });
  c.weather.forEach(w=>{
    for(const k of ['rainMm','et0Mm','temperatureMeanC'] as const){
      const path=`weather.${w.date}.${k}`,old=matching?previous.values[path]:undefined;
      if(old&&sameValue(old.value,w[k]??null))continue;
      values[path]=w.provenance?.[k]&&sameValue(w.provenance[k].value,w[k]??null)?{...w.provenance[k],scopeId:id}:valueEvidence(w[k]??null,unitFor(k),id,{
        status:w[k]==null?'missing':w.status==='observed'?'measured':w.status,origin:'legacy',interval:{from:w.date,to:w.date},
        observedAt:w.status==='observed'?w.date:null,acquiredAt:null,replacementReason:'Migration : disponibilité connue, date d’acquisition et modèle non établis.'});
    }
  });
  return {...c,soilAnalyses,weather:c.weather.map(({provenance,...weather})=>{void provenance;return weather;}),inputs:{version:PROVENANCE_VERSION,migratedFrom:previous?.migratedFrom??(previous?null:'unversioned'),scope:{id,geometry:c.parcelGeometry??null,point},values},
    inputPolicy:c.inputPolicy??{allowAssumptions:false,allowStale:false}};
}

export function declareScenario(c:SeasonalConfig,now=new Date().toISOString()):SeasonalConfig {
  const next=migrateInputs(c);
  for(const [path,item] of Object.entries(next.inputs!.values)){
    if(item.origin==='legacy'&&item.status==='assumed')next.inputs!.values[path]={...item,origin:'default',method:'Hypothèse explicite de scénario',acquiredAt:now,replacementReason:'Valeur issue du profil initial, sans observation de terrain.'};
  }
  return {...next,inputPolicy:{...next.inputPolicy!,allowAssumptions:true}};
}

/** Reconcile edits by value, never by a display label. Unchanged metadata survives. */
export function reconcileInputs(previous:SeasonalConfig,next:SeasonalConfig,now=new Date().toISOString()):SeasonalConfig {
  if(geometryIdentity(previous.parcelGeometry)!==geometryIdentity(next.parcelGeometry)||previous.latitude!==next.latitude||previous.longitude!==next.longitude){
    return invalidateParcel(next);
  }
  const old=migrateInputs(previous),result=migrateInputs({...next,inputs:old.inputs});
  const oldValues=new Map(inputInventory(previous).map(i=>[i.path,i.value]));
  for(const entry of inputInventory(next)){
    if(sameValue(oldValues.get(entry.path),entry.value))continue;
    result.inputs!.values[entry.path]=valueEvidence(entry.value,entry.unit,result.inputs!.scope.id,{origin:'manual',status:entry.value===null?'missing':'scenario',acquiredAt:now,method:'Saisie utilisateur, non vérifiée',replacementReason:'Paramètre modifié explicitement par l’utilisateur.'});
    if(entry.path.startsWith('soilAnalyses.')){
      const i=Number(entry.path.split('.')[1]),j=Number(entry.path.split('.')[3]),analysis=next.soilAnalyses?.[i],m=analysis?.measurements[j];
      if(analysis&&m)result.inputs!.values[entry.path]={...result.inputs!.values[entry.path],provider:analysis.source,method:m.method,depthCm:[analysis.topCm,analysis.bottomCm],observedAt:analysis.status==='estimated'?null:analysis.date,status:analysis.status==='measured'?'measured':analysis.status==='estimated'?'estimated':'scenario'};
    }
    if(entry.path.startsWith('weather.')){
      const date=entry.path.split('.')[1],weather=next.weather.find(w=>w.date===date);
      if(weather)result.inputs!.values[entry.path]={...result.inputs!.values[entry.path],provider:weather.source,interval:{from:date,to:date},observedAt:weather.status==='observed'?date:null,status:entry.value===null?'missing':weather.status==='observed'?'measured':'scenario'};
      const incoming=weather?.provenance?.[entry.path.split('.')[2]];
      if(incoming?.version===PROVENANCE_VERSION&&incoming.origin==='automatic'&&sameValue(incoming.value,entry.value))result.inputs!.values[entry.path]={...incoming,scopeId:result.inputs!.scope.id};
    }
  }
  return result;
}

export function invalidateParcel(c:SeasonalConfig):SeasonalConfig {
  // Historical and manual inputs remain in archived revisions, not the new field.
  const next={...c,inputs:undefined,landAssessment:undefined,weather:[],soilAnalyses:[],inputPolicy:{allowAssumptions:false,allowStale:false},
    soil:{...c.soil,layers:c.soil.layers.map(l=>({...l,initialTheta:null}))}};
  return migrateInputs(next);
}

/** Reuse requires an explicit policy and the original dates are never rewritten. */
export function missingEvidence(old:InputValue|undefined,unit:string,scope:string,reason:string,allowStale:boolean):InputValue {
  if(allowStale&&old&&old.origin==='automatic'&&old.value!==null&&old.acquiredAt&&old.scopeId===scope&&(!old.validUntil||Date.parse(old.validUntil)>=Date.now()))return {...old,retention:'stale_authorized',replacementReason:reason};
  return valueEvidence(null,unit,scope,{origin:'automatic',status:'missing',retention:'missing',replacementReason:reason});
}

export function inputWarnings(c:SeasonalConfig):string[] {
  const ledger=migrateInputs(c).inputs!;
  const assumed=Object.entries(ledger.values).filter(([,v])=>v.status==='assumed');
  const missing=Object.entries(ledger.values).filter(([k,v])=>v.status==='missing'&&(k.startsWith('soil.layers.')||k.startsWith('weather.')&&!k.endsWith('temperatureMeanC')));
  return [...(!c.inputPolicy?.allowAssumptions&&assumed.length?['Les paramètres hypothétiques doivent être acceptés explicitement : sol initial, infiltration, irrigation et calendrier.']:[]),
    ...missing.map(([k])=>`Entrée indisponible : ${k}.`)];
}
