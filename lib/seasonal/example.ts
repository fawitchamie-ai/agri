import type { SeasonalConfig } from './types.ts';

/** Synthetic demonstration only. No claim of local measurements or validation. */
export function exampleCampaign(date = new Date().toISOString().slice(0, 10)): SeasonalConfig {
  return {
    country: 'TGO', name: 'Parcelle de démonstration', territory: 'Localité fictive', crop: 'Maïs', variety: 'Non renseignée — démonstration', sowingDate: date, asOfDate: date, areaM2: 1000, latitude: null, longitude: null,
    soil: { source: 'Profil synthétique de démonstration, aucune analyse réelle', layers: [{ thicknessM: 1.2, thetaFC: .3, thetaWP: .15, initialTheta: .24 }], infiltrationMmDay: 30 },
    parameterSource: 'Hypothèses de démonstration inspirées de la structure FAO 56 ; durées et coefficients non calibrés localement',
    stages: [
      { name: 'Implantation', days: 20, kcStart: .3, kcEnd: .3, rootStartM: .2, rootEndM: .3, depletionFraction: .5 },
      { name: 'Croissance', days: 35, kcStart: .3, kcEnd: 1.2, rootStartM: .3, rootEndM: .9, depletionFraction: .5 },
      { name: 'Floraison et formation du grain', days: 40, kcStart: 1.2, kcEnd: 1.2, rootStartM: .9, rootEndM: .9, depletionFraction: .5 },
      { name: 'Maturation', days: 30, kcStart: 1.2, kcEnd: .6, rootStartM: .9, rootEndM: .9, depletionFraction: .5 },
    ],
    system: { name: 'Installation de démonstration', source: 'Hypothèses synthétiques à remplacer par les caractéristiques réelles', applicationEfficiency: .75, transportEfficiency: 1, sourceFlowM3h: 4, hoursPerDay: 6, sourceBudgetM3: 900, maxNetMmPerDay: 25, minIntervalDays: 1, allowedWeekdays: [0,1,2,3,4,5,6], targetDepletionFraction: .1, dailySourceLimits: [] },
    weather: [], fallback: { label: 'Scénario sec hypothétique, sans pluie ; aucune prévision météo', et0MmDay: 5, rainMmDay: 0 }, systemDomain: 'upland',
  };
}
export function emptyCampaign(date = new Date().toISOString().slice(0, 10)): SeasonalConfig {
  const c = exampleCampaign(date);
  return { ...c, name: '', territory: '', variety: 'Non renseignée', areaM2: null,
    soil: { ...c.soil, source: 'Propriétés hypothétiques à confirmer par mesure ou référence locale', layers: c.soil.layers.map(l => ({ ...l, initialTheta: null })) },
    system: { ...c.system, name: 'À renseigner', source: 'Caractéristiques à renseigner', applicationEfficiency: null, transportEfficiency: null, sourceFlowM3h: null, hoursPerDay: null, sourceBudgetM3: null }, fallback: null,
  };
}
