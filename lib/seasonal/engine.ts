import {inputWarnings} from './provenance.ts';
import {landBlockReason} from './land.ts';
import { ENGINE_VERSION, type SeasonalConfig, type WaterEvent, type Volumes, type WaterDay, type WaterPeriod, type WaterPlan } from './types.ts';
import { addDays, validateConfig, validateEvents } from './validation.ts';
import { cropById, depletionAtDemand } from './catalog.ts';
import { referenceQuantities } from './nutrition.ts';
import { chemistryGuidance } from './chemistry.ts';

/** Aggregate application efficiency already includes expected application losses.
 * Only overflow above field capacity is charged as additional root-zone drainage.
 * Transport is applied once, at the field/source boundary. */
export function waterVolumes(netMm: number, c: SeasonalConfig): Volumes {
  const { applicationEfficiency: ea, transportEfficiency: ec, sourceFlowM3h: flow } = c.system;
  const fieldMm = ea === null ? null : netMm / ea;
  const netLitres = c.areaM2 === null ? null : netMm * c.areaM2;
  const fieldLitres = c.areaM2 === null || fieldMm === null ? null : fieldMm * c.areaM2;
  const fieldM3 = fieldLitres === null ? null : fieldLitres / 1000;
  const sourceM3 = fieldM3 === null || ec === null ? null : fieldM3 / ec;
  return { netMm, fieldMm, netLitres, netM3: netLitres === null ? null : netLitres / 1000, fieldLitres, fieldM3, sourceM3, durationHours: sourceM3 === null || flow === null ? null : sourceM3 / flow };
}
function sumKnown(values: (number | null)[]): number | null { return values.some(x => x === null) ? null : values.reduce<number>((s, x) => s + (x ?? 0), 0); }
function sum(rows: WaterDay[], key: 'demandMm' | 'actualEtMm' | 'rainMm' | 'rainRetainedMm' | 'runoffMm' | 'drainageMm' | 'rootGainMm' | 'assimilationMm' | 'unmetEtMm' | 'requiredNetMm' | 'unservedNetMm') { return rows.reduce((s, d) => s + d[key], 0); }
function period(label: string, rows: WaterDay[]): WaterPeriod {
  return { label, from: rows[0].date, to: rows[rows.length - 1].date, demandMm: sum(rows, 'demandMm'), actualEtMm: sum(rows, 'actualEtMm'), rainMm: sum(rows, 'rainMm'), rainRetainedMm: sum(rows, 'rainRetainedMm'), runoffMm: sum(rows, 'runoffMm'), drainageMm: sum(rows, 'drainageMm'), stockStartMm: rows[0].stockStartMm, stockEndMm: rows[rows.length - 1].stockEndMm, rootGainMm: sum(rows, 'rootGainMm'), assimilationMm: sum(rows, 'assimilationMm'), netMm: rows.reduce((s, d) => s + d.irrigationNetMm, 0), requiredNetMm: sum(rows,'requiredNetMm'), unservedNetMm: sum(rows,'unservedNetMm'), fieldM3: sumKnown(rows.map(d => d.intervention?.fieldM3 ?? (d.intervention ? null : 0))), sourceM3: sumKnown(rows.map(d => d.intervention?.sourceM3 ?? (d.intervention ? null : 0))), unmetEtMm: sum(rows, 'unmetEtMm') };
}
function periods(rows: WaterDay[], width: number): WaterPeriod[] { const result = []; for (let i = 0; i < rows.length; i += width) result.push(period(`${width === 7 ? 'Semaine' : 'Décade'} ${Math.floor(i / width) + 1}`, rows.slice(i, i + width))); return result; }

export function planWater(input: unknown, inputEvents: unknown = [], options:{requireGeometry?:boolean;irrigationMode?:'rainfed'|'recorded'|'proposed';unitAreaM2?:number;unitGeometry?:NonNullable<WaterPlan['calculationArea']>['geometry']}={}): WaterPlan {
  const c = validateConfig(input), events = validateEvents(inputEvents, c);
  const horizon = c.stages.reduce((s, x) => s + x.days, 0), horizonEnd = addDays(c.sowingDate, horizon - 1);
  const eventProvenance=events.flatMap(e=>e.provenance?[e.provenance]:[]);
  const selected=c.landSelection==='potentialLand',a=c.landAssessment;
  const calculationArea:NonNullable<WaterPlan['calculationArea']>={selection:selected?'potentialLand':'whole',areaM2:selected?a?.candidateAreaM2??null:c.areaM2,geometry:selected?a?.fractions.potentialLand.geometry??null:c.parcelGeometry?{type:'MultiPolygon',coordinates:[c.parcelGeometry.coordinates]}:null};
  if(options.unitAreaM2!==undefined){calculationArea.areaM2=options.unitAreaM2;calculationArea.geometry=options.unitGeometry??calculationArea.geometry;}
  const eventScopeWarning=events.some(e=>['measured','declared'].includes(e.status)&&(e.landSelection??'whole')!==(c.landSelection??'whole'))?'Observations liées à une autre surface de calcul : corrigez leur portée avant de les utiliser.':null;
  const gate=[eventScopeWarning,options.requireGeometry&&!c.parcelGeometry?'Contour complet requis pour une simulation de parcelle.':null,landBlockReason(c),...inputWarnings(c)].filter((x):x is string=>!!x);
  if(gate.length)return {calculationArea,engineVersion:ENGINE_VERSION,levelOfEvidence:'simulation_non_validee',status:'blocked',complete:false,horizonEnd,assumptions:[],missing:gate,days:[],weeks:[],decades:[],stages:[],nextWindows:[],intervalDays:null,totals:{demandMm:0,actualEtMm:0,unmetEtMm:0,netMm:0,recordedSourceM3:null,remainingSourceM3:null,sourceM3:null,fieldM3:null,remainingBudgetM3:null},...(eventProvenance.length?{eventProvenance}:{}),inputProvenance:c.inputs,...(c.landAssessment?{land:c.landAssessment}:{})};
  // Keep the drawn area in the input ledger; only volume/nutrient calculations
  // use the explicitly selected mapped terrestrial area.
  c.areaM2=calculationArea.areaM2;
  const missing: string[] = [], assumptions = [
    'Simulation conditionnelle non validée au champ ; coefficients, sols et accès à l’eau à confirmer localement.',
    'Bilan journalier : croissance des racines, correction d’humidité, pluie et drainage, irrigation et drainage, puis évapotranspiration.',
    'Coefficient cultural simple et stress hydrique agrégé ; nappe profonde supposée sans remontée capillaire. Pas de simulation chimique ni de gain de rendement déduit de l’arrosage.',
    'Les fenêtres futures supposent le suivi du plan. Aucune irrigation passée n’est présumée réalisée.',
    `Sol : ${c.soil.source}. Culture : ${c.parameterSource}. Installation : ${c.system.source}.`,
  ];
  if(selected)assumptions.push(`Calcul limité à ${calculationArea.areaM2?.toFixed(1)} m² de terre potentielle cartographiée. Eau, zones humides, bâti et inconnus exclus ; aptitude et homogénéité du sol à vérifier.`);
  if (c.fallback) assumptions.push(`Jours sans météo complète : scénario explicite « ${c.fallback.label} », ET0 ${c.fallback.et0MmDay} mm/j et pluie ${c.fallback.rainMmDay} mm/j. Il ne s’agit pas d’une prévision saisonnière calibrée.`);
  const crop = c.cropProfile ? cropById(c.cropProfile.id) : undefined;
  if(crop){
    assumptions.push(`Fiche ${crop.name}, ${c.cropProfile!.version}. ${crop.notes.join(' ')}`,...chemistryGuidance(crop.id,c.soilAnalyses));
    if(c.cropProfile!.mode==='reference' && !crop.water)missing.push('Paramètres hydriques manquants pour cette culture : renseignez une référence locale et ses stades en mode personnalisé.');
  }
  if(c.adjustDepletionToEtc)assumptions.push('Seuil hydrique p ajusté chaque jour à la demande ETc selon FAO56, équation 83 (bornes 0,10–0,80).');
  if (c.systemDomain !== 'upland' || crop?.id==='rice-flooded') missing.push('Ce module ne prend pas en charge les rizières submergées ni les nappes proches. Un bilan spécifique est nécessaire.');
  assumptions.push('Le drainage calculé suppose une évacuation libre : aucune stagnation, asphyxie racinaire, submersion, mortalité ni perte de rendement par excès d’eau n’est simulée.');
  if(!c.waterCondition||c.waterCondition==='unknown')assumptions.push('État d’engorgement inconnu : vérifiez que le sol évacue l’eau avant d’utiliser ce calendrier.');
  if(c.waterCondition==='waterlogged'||c.waterCondition==='submerged')missing.push('Parcelle '+(c.waterCondition==='submerged'?'inondée avec plantes submergées':'engorgée avec eau stagnante')+' : calendrier d’irrigation suspendu. Les pertes et la survie ne sont pas calculées ; renseignez durée, hauteur d’eau, stade et variété pour un diagnostic local.');
  if (c.soil.layers.some(l => l.initialTheta === null)) missing.push('Humidité initiale de chaque horizon (ou scénario initial explicite).');
  if (c.areaM2 === null) assumptions.push('Surface inconnue : les lames en mm restent calculables, les volumes ne le sont pas.');
  if (c.system.applicationEfficiency === null) assumptions.push('Efficacité d’application inconnue : apport net théorique seulement, volumes bruts et faisabilité non établis.');
  if (c.system.transportEfficiency === null) assumptions.push('Efficacité de transport inconnue : prélèvement à la source non établi.');
  if (c.system.sourceFlowM3h === null) assumptions.push('Débit inconnu : durée et contrainte de pompage non établies.');
  if (c.system.sourceBudgetM3 === null) assumptions.push('Quota non renseigné : disponibilité saisonnière non vérifiée.');
  if (c.soil.infiltrationMmDay === null) assumptions.push('Infiltration inconnue : ruissellement supposé nul ; intensité et fractionnement à vérifier.');

  const theta = c.soil.layers.map(l => l.initialTheta ?? l.thetaWP);
  let previousRoot = c.stages[0].rootStartM, usedSourceM3 = 0, sourceVolumeKnown = true, lastIrrigation = -10000;
  const rooted = (depth: number) => { let top = 0; return c.soil.layers.map(l => { const m = Math.max(0, Math.min(l.thicknessM, depth - top)); top += l.thicknessM; return m; }); };
  const capacity = (depth: number) => rooted(depth).reduce((s, m, i) => s + 1000 * m * (c.soil.layers[i].thetaFC - c.soil.layers[i].thetaWP), 0);
  // Keep moisture for rooted and unrooted sublayers separately. Expansion exposes
  // the remaining original water, not a freshly refilled extension of the bucket.
  let activeDepths = rooted(previousRoot);
  let activeWater = activeDepths.map((m, i) => 1000 * m * (theta[i] - c.soil.layers[i].thetaWP));
  const addWater = (mm: number) => { let remainder = mm; for (let i = 0; i < activeWater.length; i++) { const room = Math.max(0, 1000 * activeDepths[i] * (c.soil.layers[i].thetaFC - c.soil.layers[i].thetaWP) - activeWater[i]); const take = Math.min(room, remainder); activeWater[i] += take; remainder -= take; } return Math.max(0, remainder); };
  const takeWater = (mm: number) => { const total = activeWater.reduce((a, b) => a + b, 0), taken = Math.min(mm, total); if (total > 0) activeWater = activeWater.map(x => x * (1 - taken / total)); return taken; };
  const days: WaterDay[] = [], weatherMap = new Map(c.weather.map(w => [w.date, w]));
  const eventsByDate = new Map<string, WaterEvent[]>();
  for (const e of events) if (['declared','measured'].includes(e.status)) eventsByDate.set(e.date,[...(eventsByDate.get(e.date) ?? []),e]);
  let stageIndex = 0, stageStart = 0;
  if (!missing.length) for (let day = 0; day < horizon; day++) {
    while (day >= stageStart + c.stages[stageIndex].days) { stageStart += c.stages[stageIndex].days; stageIndex++; }
    const stage = c.stages[stageIndex], fraction = stage.days === 1 ? 1 : (day - stageStart) / (stage.days - 1);
    const date = addDays(c.sowingDate, day), rootM = stage.rootStartM + fraction * (stage.rootEndM - stage.rootStartM), kc = stage.kcStart + fraction * (stage.kcEnd - stage.kcStart);
    const start = activeWater.reduce((a, b) => a + b, 0), newDepths = rooted(rootM);
    let rootGainMm = 0;
    for (let i = 0; i < activeWater.length; i++) { const gain = 1000 * (newDepths[i] - activeDepths[i]) * (theta[i] - c.soil.layers[i].thetaWP); activeWater[i] += gain; rootGainMm += gain; }
    activeDepths = newDepths; 
    const tawMm = capacity(rootM);
    const todayEvents = eventsByDate.get(date) ?? [];
    let assimilationMm = 0;
    const measurement = todayEvents.find(e => e.kind === 'soil');
    if (measurement) {
      const before = activeWater.reduce((a, b) => a + b, 0);
      activeWater = activeDepths.map((m, i) => 1000 * m * (measurement.amount - c.soil.layers[i].thetaWP));
      assimilationMm = activeWater.reduce((a, b) => a + b, 0) - before;
    }
    const weather = weatherMap.get(date), rainObservation = todayEvents.find(e => e.kind === 'rain');
    const rainMm = rainObservation?.amount ?? weather?.rainMm ?? c.fallback?.rainMmDay;
    const et0 = weather?.et0Mm ?? c.fallback?.et0MmDay;
    if (rainMm === undefined || et0 === undefined) { missing.push(`Météo incomplète le ${date} : ${rainMm === undefined ? 'pluie' : 'ET0'} et scénario de repli manquants. Le bilan ne peut pas être prolongé.`); break; }
    const demandMm = kc * et0, p = c.adjustDepletionToEtc ? depletionAtDemand(stage.depletionFraction,demandMm) : stage.depletionFraction, rawMm=p*tawMm;
    const rainInfiltrated = Math.min(rainMm, c.soil.infiltrationMmDay ?? rainMm);
    const runoffMm = rainMm - rainInfiltrated, rainDrain = addWater(rainInfiltrated), rainRetainedMm = rainInfiltrated - rainDrain;
    const storedAfterRain = activeWater.reduce((a,b)=>a+b,0);
    const requiredNetMm = Math.max(0, tawMm - rawMm + demandMm - storedAfterRain);
    const actualIrrigations = todayEvents.filter(e => e.kind === 'irrigation');
    let net = 0, intervention: WaterDay['intervention'] = null;
    if (actualIrrigations.length) {
      const volumes: Volumes[] = [];
      for (const event of actualIrrigations) {
        const amountMm = event.unit === 'mm' ? event.amount : c.areaM2 === null ? null : event.amount * (event.unit === 'm3' ? 1000 : 1) / c.areaM2;
        const ec = c.system.transportEfficiency, ea = c.system.applicationEfficiency;
        if (amountMm === null || event.point !== 'net' && ea === null || event.point === 'source' && ec === null) { missing.push(`Apport ${event.id} : surface ou efficacité manquante pour convertir la mesure en eau utile.`); break; }
        const n = amountMm! * (event.point === 'net' ? 1 : ea! * (event.point === 'source' ? ec! : 1));
        volumes.push(waterVolumes(n, c)); net += n;
      }
      if (missing.length) break;
      const first = waterVolumes(net, c);
      intervention = { ...first, type: 'recorded', constrained: false, reasons: ['Apport réalisé : la quantité enregistrée est conservée, même si elle dépasse la capacité ou le quota.'] };
      const source = sumKnown(volumes.map(v => v.sourceM3));
      if (source === null) sourceVolumeKnown = false; else usedSourceM3 += source;
      lastIrrigation = day;
    } else if ((options.irrigationMode??'proposed')==='proposed' && date >= c.asOfDate && tawMm - activeWater.reduce((a, b) => a + b, 0) + demandMm >= rawMm) {
      const stored = activeWater.reduce((a, b) => a + b, 0);
      const requested = Math.min(tawMm-stored, Math.max(requiredNetMm,tawMm * (1-c.system.targetDepletionFraction) - stored));
      const reasons: string[] = [];
      let allowed = requested;
      if (!c.system.allowedWeekdays.includes(new Date(date).getUTCDay())) { allowed = 0; reasons.push('Pas d’accès à l’eau ce jour.'); }
      if (c.system.hoursPerDay === 0 || c.system.sourceBudgetM3 === 0 || c.system.dailySourceLimits.some(x=>x.date===date&&x.m3===0)) { allowed=0;reasons.push('Accès ou volume d’eau explicitement nul.'); }
      if (day - lastIrrigation < c.system.minIntervalDays) { allowed = 0; reasons.push('Intervalle minimal entre interventions.'); }
      if (c.system.maxNetMmPerDay !== null && allowed > c.system.maxNetMmPerDay) { allowed = c.system.maxNetMmPerDay; reasons.push('Dose nette journalière limitée.'); }
      if (c.soil.infiltrationMmDay !== null) { const max = Math.max(0, c.soil.infiltrationMmDay - rainInfiltrated); if (allowed > max) { allowed = max; reasons.push('Infiltration journalière limitée ; fractionnement nécessaire.'); } }
      const perMm = waterVolumes(1, c).sourceM3;
      if (perMm !== null) {
        let maxSource = Infinity;
        if (c.system.sourceBudgetM3 !== null && sourceVolumeKnown) maxSource = Math.min(maxSource, Math.max(0, c.system.sourceBudgetM3 - usedSourceM3));
        if (c.system.sourceFlowM3h !== null && c.system.hoursPerDay !== null) maxSource = Math.min(maxSource, c.system.sourceFlowM3h * c.system.hoursPerDay);
        const daily = c.system.dailySourceLimits.find(x => x.date === date);
        if (daily) maxSource = Math.min(maxSource, daily.m3);
        if (allowed * perMm > maxSource) { allowed = maxSource / perMm; reasons.push('Volume limité par le quota, le débit, le tour d’eau ou la disponibilité quotidienne.'); }
      } else if (c.system.sourceBudgetM3 !== null || c.system.hoursPerDay !== null || c.system.dailySourceLimits.length) reasons.push('Faisabilité inconnue : surface ou efficacités manquantes.');
      net = Math.max(0, allowed);
      const v = waterVolumes(net, c);
      if (v.sourceM3 === null) sourceVolumeKnown = false; else usedSourceM3 += v.sourceM3;
      intervention = { ...v, type: 'proposed', constrained: net + 1e-9 < requested || reasons.length > 0, reasons };
      if (net > 1e-9) lastIrrigation = day;
    }
    const irrigationDrain = addWater(net), drainageMm = rainDrain + irrigationDrain;
    const beforeEt = activeWater.reduce((a, b) => a + b, 0), depletionBeforeEt = tawMm - beforeEt;
    const ks = depletionBeforeEt <= rawMm ? 1 : Math.max(0, (tawMm - depletionBeforeEt) / Math.max(1e-9, tawMm - rawMm));
    const actualEtMm = takeWater(demandMm * ks), end = activeWater.reduce((a, b) => a + b, 0);
    const balanceResidualMm = end - (start + rootGainMm + assimilationMm + rainMm - runoffMm + net - drainageMm - actualEtMm);
    days.push({ date, stage: stage.name, stageIndex, rootM, kc, demandMm, actualEtMm, rainMm, rainRetainedMm, runoffMm, drainageMm, irrigationNetMm: net, requiredNetMm, unservedNetMm: Math.max(0,requiredNetMm-net), stockStartMm: start, rootGainMm, assimilationMm, stockEndMm: end, tawMm, rawMm, depletionMm: tawMm - end, unmetEtMm: Math.max(0, demandMm - actualEtMm), balanceResidualMm,
      weatherSource: `${rainObservation ? 'Pluie : ' + rainObservation.source + '. ' : ''}${weather?.source ?? ''}${weather?.rainMm === null || weather?.et0Mm === null || !weather ? ' ; scénario : ' + (c.fallback?.label ?? 'absent') : ''}`,
      weatherStatus: !weather || weather.rainMm === null || weather.et0Mm === null ? 'scenario' : weather.status, intervention });
  }
  const complete = days.length === horizon;
  const future = days.filter(d => d.intervention?.type === 'proposed'), recorded = days.filter(d => d.intervention?.type === 'recorded');
  const positive = future.filter(d => d.intervention!.netMm > 1e-9);
  const intervals = positive.slice(1).map((d, i) => (Date.parse(d.date) - Date.parse(positive[i].date)) / 86400000);
  const recordedSourceM3 = sumKnown(recorded.map(d => d.intervention!.sourceM3)), remainingSourceM3 = complete ? sumKnown(future.map(d => d.intervention!.sourceM3)) : null;
  if (days.some(d => d.unmetEtMm > .01)) assumptions.push('Des jours de stress hydrique subsistent : examiner le déficit et les contraintes. Le rendement n’est pas recalculé par ce module.');
  if(days.some(d=>d.drainageMm>.01||d.runoffMm>.01))assumptions.push('Excédent d’eau calculé : ce bilan ne prouve pas que l’eau s’est évacuée du champ. Vérifiez la stagnation et renseignez un engorgement ou une submersion si observé.');
  if (c.system.sourceBudgetM3 !== null && usedSourceM3 > c.system.sourceBudgetM3 + 1e-8) assumptions.push('Les apports déjà réalisés dépassent le quota déclaré. Le réalisé est conservé et aucun quota supplémentaire n’est inventé.');
  return {
    calculationArea,
    ...(c.nutritionReference?{nutrition:referenceQuantities(c.nutritionReference.id,c,c.nutritionReference.contextNote,c.nutritionReference.alreadyKgHa)}:{}),
    ...(eventProvenance.length?{eventProvenance}:{}),inputProvenance:c.inputs,...(c.landAssessment?{land:c.landAssessment}:{}),
    engineVersion: ENGINE_VERSION, levelOfEvidence: 'simulation_non_validee', status: missing.length ? 'blocked' : 'conditional', complete, horizonEnd, assumptions, missing,
    days, weeks: periods(days, 7), decades: periods(days, 10), stages: c.stages.map((s, i) => { const rows = days.filter(d => d.stageIndex === i); return rows.length ? period(s.name, rows) : null; }).filter((x): x is WaterPeriod => x !== null),
    nextWindows: positive.slice(0, 8).map(d => ({ from: d.date, to: d.date, conditional: true, volume: d.intervention!, reasons: d.intervention!.reasons })),
    intervalDays: intervals.length ? { min: Math.min(...intervals), max: Math.max(...intervals) } : null,
    totals: { demandMm: sum(days, 'demandMm'), actualEtMm: sum(days, 'actualEtMm'), unmetEtMm: sum(days, 'unmetEtMm'), netMm: days.reduce((s, d) => s + d.irrigationNetMm, 0), recordedSourceM3, remainingSourceM3, sourceM3: complete ? sumKnown([recordedSourceM3, remainingSourceM3]) : null, fieldM3: complete ? sumKnown(days.map(d => d.intervention?.fieldM3 ?? (d.intervention ? null : 0))) : null, remainingBudgetM3: c.system.sourceBudgetM3 === null || !sourceVolumeKnown ? null : Math.max(0, c.system.sourceBudgetM3 - usedSourceM3) },
  };
}

/** Existing events are replaced by stable ID. An identical retry changes nothing. */
export function upsertEvent(events: WaterEvent[], event: WaterEvent): WaterEvent[] { return [...events.filter(e => e.id !== event.id), event].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); }

export function waterPlanCsv(plan: WaterPlan): string {
  const headers = ['date','stade','besoin_mm','consommation_mm','pluie_mm','pluie_retenue_mm','stock_debut_mm','stock_fin_mm','croissance_racines_eau_mm','correction_etat_mm','ruissellement_mm','drainage_mm','irrigation_necessaire_nette_mm','besoin_non_couvert_mm','irrigation_nette_mm','irrigation_brute_mm','litres_bruts_champ','m3_bruts_champ','m3_source','duree_heures','deficit_et_mm','type_intervention','source_meteo','statut_meteo','surface_calcul_m2','partie_du_contour'];
  const quote = (v: unknown) => { const text=typeof v==='number'?String(v):String(v??'').replace(/^[\s]*[=+@-]/,"'$&");return `"${text.replaceAll('"','""')}"`; };
  return '\ufeff' + [headers, ...plan.days.map(d => [d.date,d.stage,d.demandMm,d.actualEtMm,d.rainMm,d.rainRetainedMm,d.stockStartMm,d.stockEndMm,d.rootGainMm,d.assimilationMm,d.runoffMm,d.drainageMm,d.requiredNetMm,d.unservedNetMm,d.irrigationNetMm,d.intervention?.fieldMm,d.intervention?.fieldLitres,d.intervention?.fieldM3,d.intervention?.sourceM3,d.intervention?.durationHours,d.unmetEtMm,d.intervention?.type,d.weatherSource,d.weatherStatus,plan.calculationArea?.areaM2,plan.calculationArea?.selection])].map(row => row.map(quote).join(';')).join('\r\n');
}
