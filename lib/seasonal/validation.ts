import { COUNTRIES, type SeasonalConfig, type WaterEvent } from './types.ts';
import { referenceQuantities } from './nutrition.ts';
import { CATALOG_VERSION, cropById } from './catalog.ts';
import { SOIL_PARAMETERS, type SoilAnalysis, type SoilParameter } from './chemistry.ts';

export class InputError extends Error {}
export function isoDate(value: unknown, label = 'Date'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new InputError(`${label} invalide (AAAA-MM-JJ attendu).`);
  return value;
}
export function addDays(date: string, days: number) { return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10); }
function obj(v: unknown): Record<string, any> { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InputError('Objet attendu.'); return v as Record<string, any>; }
function str(v: unknown, label: string, max = 300): string { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new InputError(`${label} est obligatoire (${max} caractères maximum).`); return v.trim(); }
function number(v: unknown, label: string, min: number, max: number): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new InputError(`${label} doit être compris entre ${min} et ${max}.`); return v; }
function optional(v: unknown, label: string, min: number, max: number): number | null { return v === null || v === undefined ? null : number(v, label, min, max); }
function array(v: unknown, label: string, max: number): any[] { if (!Array.isArray(v) || v.length > max) throw new InputError(`${label} : liste de ${max} éléments maximum attendue.`); return v; }
export function validateConfig(input: unknown): SeasonalConfig {
  const c = obj(input), soil = obj(c.soil), system = obj(c.system);
  if (!Object.hasOwn(COUNTRIES, c.country)) throw new InputError('Pays non pris en charge.');
  if (!['upland', 'flooded_rice', 'shallow_water_table'].includes(c.systemDomain)) throw new InputError('Système cultural invalide.');
  const layers = array(soil.layers, 'Horizons de sol', 12).map((v) => {
    const l = obj(v), fc = number(l.thetaFC, 'Capacité au champ', .001, .8), wp = number(l.thetaWP, 'Flétrissement', 0, .7);
    if (fc <= wp) throw new InputError('La capacité au champ doit dépasser le point de flétrissement.');
    return { thicknessM: number(l.thicknessM, 'Épaisseur', .01, 5), thetaFC: fc, thetaWP: wp, initialTheta: optional(l.initialTheta, 'Humidité initiale', wp, fc) };
  });
  if (!layers.length) throw new InputError('Au moins un horizon de sol est nécessaire.');
  const depth = layers.reduce((s, l) => s + l.thicknessM, 0);
  let lastRoot = 0;
  const stages = array(c.stages, 'Stades', 16).map(v => {
    const s = obj(v), days = number(s.days, 'Durée du stade', 1, 366);
    if (!Number.isInteger(days)) throw new InputError('Durée en jours entiers attendue.');
    const rootStartM = number(s.rootStartM, 'Racines au début', .01, depth), rootEndM = number(s.rootEndM, 'Racines à la fin', rootStartM, depth);
    if (rootStartM + 1e-9 < lastRoot) throw new InputError('La profondeur racinaire ne peut pas décroître dans ce module.');
    lastRoot = rootEndM;
    return { name: str(s.name, 'Nom du stade', 100), days, rootStartM, rootEndM, kcStart: number(s.kcStart, 'Kc initial', 0, 2), kcEnd: number(s.kcEnd, 'Kc final', 0, 2), depletionFraction: number(s.depletionFraction, 'Fraction avant stress', .05, .95) };
  });
  const cycleDays = stages.reduce((s, x) => s + x.days, 0);
  if (!cycleDays || cycleDays > 366) throw new InputError('Le cycle doit durer de 1 à 366 jours.');
  const sowingDate = isoDate(c.sowingDate, 'Semis'), asOfDate = isoDate(c.asOfDate, 'Date du conseil');
  const end = addDays(sowingDate, cycleDays - 1);
  const weather = array(c.weather, 'Météo', 732).map(v => {
    const w = obj(v), date = isoDate(w.date);
    if (!['observed', 'forecast', 'scenario'].includes(w.status)) throw new InputError('Statut météo invalide.');
    const availableAt = str(w.availableAt, 'Date de disponibilité');
    if (!Number.isFinite(Date.parse(availableAt))) throw new InputError('Date de disponibilité invalide.');
    if (date < sowingDate || date > end) throw new InputError('La météo doit appartenir au cycle.');
    if (availableAt.slice(0, 10) > asOfDate) throw new InputError('Une donnée météo indisponible à la date du conseil ne peut pas être utilisée.');
    if (w.status === 'observed' && date > asOfDate) throw new InputError('Une observation météo ne peut pas être future.');
    return { date, rainMm: optional(w.rainMm, 'Pluie', 0, 2000), et0Mm: optional(w.et0Mm, 'ET0', 0, 30), status: w.status, source: str(w.source, 'Source météo'), availableAt };
  });
  if (new Set(weather.map(w => w.date)).size !== weather.length) throw new InputError('Une seule météo par date : choisissez la source prioritaire.');
  const weekdays = array(system.allowedWeekdays, 'Jours d’accès', 7).map(v => number(v, 'Jour de semaine', 0, 6));
  if (weekdays.some(v => !Number.isInteger(v)) || new Set(weekdays).size !== weekdays.length) throw new InputError('Jours de semaine invalides.');
  const dailySourceLimits = array(system.dailySourceLimits, 'Disponibilités quotidiennes', 366).map(v => ({ date: isoDate(obj(v).date), m3: number(v.m3, 'Eau disponible', 0, 1e9) }));
  if (new Set(dailySourceLimits.map(x => x.date)).size !== dailySourceLimits.length) throw new InputError('Disponibilité dupliquée.');
  const targetDepletionFraction = number(system.targetDepletionFraction, 'Déficit cible', 0, .9);
  if (stages.some(s => targetDepletionFraction >= s.depletionFraction)) throw new InputError('Le déficit cible doit être inférieur au seuil de stress de chaque stade.');
  const minIntervalDays = number(system.minIntervalDays, 'Intervalle minimal', 1, 60);
  if (!Number.isInteger(minIntervalDays)) throw new InputError('Intervalle entier attendu.');
  const fallback = c.fallback === null || c.fallback === undefined ? null : {
    label: str(obj(c.fallback).label, 'Nom du scénario météo'),
    et0MmDay: number(c.fallback.et0MmDay, 'ET0 du scénario', 0, 30),
    rainMmDay: number(c.fallback.rainMmDay, 'Pluie du scénario', 0, 2000),
  };
  let cropProfile: SeasonalConfig['cropProfile'];
  if(c.cropProfile!==undefined){
    const p=obj(c.cropProfile), profile=cropById(p.id);
    if(!profile || p.version!==CATALOG_VERSION || !['reference','custom'].includes(p.mode))throw new InputError('Référence culturale inconnue ou version non prise en charge.');
    if(profile.name!==c.crop)throw new InputError('La culture a changé : choisissez et appliquez sa propre fiche avant de calculer.');
    cropProfile={id:profile.id,version:p.version,mode:p.mode};
  }
  if(c.adjustDepletionToEtc!==undefined && typeof c.adjustDepletionToEtc!=='boolean')throw new InputError('Option d’ajustement du seuil hydrique invalide.');
  const soilAnalyses:SoilAnalysis[] = c.soilAnalyses===undefined?[]:array(c.soilAnalyses,'Analyses de sol',12).map(v=>{
    const a=obj(v),date=isoDate(a.date,'Date de l’analyse'),topCm=number(a.topCm,'Début de l’horizon analysé',0,500),bottomCm=number(a.bottomCm,'Fin de l’horizon analysé',.1,500);
    const availableOn=isoDate(a.availableOn,'Date de disponibilité des résultats d’analyse');
    if(bottomCm<=topCm || date>asOfDate || availableOn<date || availableOn>asOfDate)throw new InputError('Profondeur ou dates de l’analyse incompatibles avec le conseil : les résultats doivent être disponibles après la mesure et au plus tard à la date du conseil.');
    if(!['measured','declared','estimated'].includes(a.status))throw new InputError('Statut d’analyse invalide.');
    const measurements=array(a.measurements,'Mesures chimiques',16).map(v=>{
      const m=obj(v), parameter=m.parameter as SoilParameter;
      if(!Object.hasOwn(SOIL_PARAMETERS,parameter))throw new InputError('Paramètre chimique inconnu.');
      const spec=SOIL_PARAMETERS[parameter];
      if(!(spec.units as readonly string[]).includes(m.unit))throw new InputError('Unité incompatible avec le paramètre chimique.');
      const method=str(m.method,'Méthode d’analyse',100);
      if(spec.methods.length && !(spec.methods as readonly string[]).includes(method) && !((spec.methods as readonly string[]).includes('other')&&method.startsWith('other:')&&method.slice(6).trim().length>=3))throw new InputError('Méthode d’analyse non reconnue pour ce paramètre.');
      if(method==='other')throw new InputError('Précisez la méthode exacte du laboratoire après other: ; une méthode inconnue n’est pas une mesure comparable.');
      const concentration=['organicC','organicMatter','totalN'].includes(parameter);
      const value=number(m.value,spec.label,0,parameter==='pH'?14:m.unit==='%'?100:concentration&&m.unit==='g/kg'?1000:1e6);
      return {parameter,value,unit:m.unit as string,method};
    });
    if(!measurements.length || new Set(measurements.map(m=>m.parameter)).size!==measurements.length)throw new InputError('Une analyse doit contenir des paramètres distincts.');
    return {source:str(a.source,'Laboratoire ou source',600),date,availableOn,topCm,bottomCm,status:a.status,measurements};
  });
  const validated:SeasonalConfig = {
    ...(cropProfile?{cropProfile}:{}),...(c.adjustDepletionToEtc===undefined?{}:{adjustDepletionToEtc:c.adjustDepletionToEtc}),...(c.soilAnalyses===undefined?{}:{soilAnalyses}),
    country: c.country, systemDomain: c.systemDomain, name: str(c.name, 'Parcelle', 120), territory: str(c.territory, 'Localité', 160), crop: str(c.crop, 'Culture', 100), variety: str(c.variety, 'Variété ou mention inconnue', 100), sowingDate, asOfDate,
    areaM2: optional(c.areaM2, 'Surface en m²', .01, 1e9), latitude: optional(c.latitude, 'Latitude', -90, 90), longitude: optional(c.longitude, 'Longitude', -180, 180),
    parameterSource: str(c.parameterSource, 'Source des paramètres culturaux', 600),
    soil: { source: str(soil.source, 'Source du sol', 600), layers, infiltrationMmDay: optional(soil.infiltrationMmDay, 'Infiltration journalière', .01, 2000) }, stages,
    system: { name: str(system.name, 'Installation', 100), source: str(system.source, 'Source des paramètres d’irrigation', 600),
      applicationEfficiency: optional(system.applicationEfficiency, 'Efficacité d’application (fraction)', .01, 1), transportEfficiency: optional(system.transportEfficiency, 'Efficacité de transport (fraction)', .01, 1), sourceFlowM3h: optional(system.sourceFlowM3h, 'Débit à la source', .001, 1e6), hoursPerDay: optional(system.hoursPerDay, 'Heures d’accès par jour', 0, 24), sourceBudgetM3: optional(system.sourceBudgetM3, 'Quota sur tout le cycle', 0, 1e10), maxNetMmPerDay: optional(system.maxNetMmPerDay, 'Apport net maximal par jour', 0, 2000), minIntervalDays, allowedWeekdays: weekdays, targetDepletionFraction, dailySourceLimits },
    weather, fallback,
  };
  if(c.nutritionReference!==undefined){
    const n=obj(c.nutritionReference),id=str(n.id,'Référence de fertilisation',100),contextNote=str(n.contextNote,'Contexte de la fertilisation',1200);
    const alreadyKgHa=array(n.alreadyKgHa,'Apports des produits',20).map(v=>v===null?null:number(v,'Masse déjà appliquée (kg/ha)',0,1e6));
    try{referenceQuantities(id,validated,contextNote,alreadyKgHa);}catch(e){throw new InputError((e as Error).message);}
    validated.nutritionReference={id,contextNote,alreadyKgHa};
  }
  return validated;
}
export function validateEvents(input: unknown, c: SeasonalConfig): WaterEvent[] {
  const end = addDays(c.sowingDate, c.stages.reduce((s, x) => s + x.days, 0) - 1);
  const events = array(input, 'Observations', 1500).map(v => {
    const e = obj(v), date = isoDate(e.date), id = str(e.id, 'Identifiant événement', 100);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new InputError('Identifiant événement invalide.');
    if (!['rain', 'irrigation', 'soil'].includes(e.kind) || !['measured', 'declared', 'planned', 'cancelled'].includes(e.status)) throw new InputError('Type ou statut d’événement invalide.');
    if (!['mm', 'L', 'm3', 'fraction'].includes(e.unit) || !['net', 'field', 'source'].includes(e.point)) throw new InputError('Unité ou point de mesure invalide.');
    if (e.kind === 'rain' && e.unit !== 'mm' || e.kind === 'soil' && e.unit !== 'fraction' || e.kind === 'irrigation' && e.unit === 'fraction') throw new InputError('Unité incompatible avec le type d’événement.');
    if (date < c.sowingDate || date > end) throw new InputError('L’événement doit appartenir au cycle.');
    if (['measured', 'declared'].includes(e.status) && date > c.asOfDate) throw new InputError('Un apport réalisé ne peut pas être futur à la date du conseil.');
    const recordedAt = str(e.recordedAt, 'Horodatage de saisie');
    if (!Number.isFinite(Date.parse(recordedAt)) || recordedAt.slice(0, 10) > c.asOfDate) throw new InputError('Horodatage indisponible à la date du conseil.');
    const amount = number(e.amount, 'Quantité', 0, e.unit === 'fraction' ? .8 : 1e10);
    if (e.kind === 'soil' && c.soil.layers.some(l => amount < l.thetaWP || amount > l.thetaFC)) throw new InputError('Humidité hors des limites du profil.');
    return { id, date, kind: e.kind, unit: e.unit, point: e.point, status: e.status, amount, source: str(e.source, 'Source de l’observation', 600), recordedAt };
  });
  if (new Set(events.map(e => e.id)).size !== events.length) throw new InputError('Événement dupliqué : corrigez sa version au lieu de l’ajouter.');
  const rain = events.filter(e => e.kind === 'rain' && ['declared', 'measured'].includes(e.status));
  if (new Set(rain.map(e => e.date)).size !== rain.length) throw new InputError('Une pluie quotidienne prioritaire par date est autorisée. Corrigez la mesure existante.');
  const soil = events.filter(e => e.kind === 'soil' && ['declared', 'measured'].includes(e.status));
  if (new Set(soil.map(e => e.date)).size !== soil.length) throw new InputError('Une correction d’humidité par date est autorisée.');
  return events;
}
