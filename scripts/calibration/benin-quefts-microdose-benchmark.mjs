/**
 * Provisional aggregate transfer check for the app's two published QUEFTS
 * maize profiles. It deliberately does not fit or activate a parcel-yield
 * model: only published year-by-treatment means are available here.
 *
 * Run from the repository root:
 *   node --experimental-transform-types scripts/calibration/benin-quefts-microdose-benchmark.mjs
 */
import { QUEFTS_PROFILES, anchorSupply, queftsYield } from '../../lib/seasonal/quefts.ts';

const study = {
  country: 'BEN',
  domain: 'Ina district, northern Benin; rainfed maize; 2014–2015 on-farm trials',
  crop: 'maize grain, DMR-ESR, 90-day maturity',
  source: {
    title: 'Variability in maize yield and profitability following hill-placement of reduced mineral fertilizer and manure rates under smallholder farm conditions in northern Benin',
    doi: '10.1016/j.fcr.2018.10.018',
    url: 'https://doi.org/10.1016/j.fcr.2018.10.018',
    citation: 'Tovihoudji et al., Field Crops Research 230 (2019), 139–150',
  },
  reportedYieldBasis: 'grain dry matter (kg/ha)',
  modelYieldMoisturePercent: 15,
  seasons: [
    {
      year: 2014,
      controlDryKgHa: 1089,
      farmerTrials: 18,
      treatments: [
        { id: 'MD1', observedDryKgHa: 2240, doseNpkKgHa: [23.8, 4.1, 7.8] },
        { id: 'MD2', observedDryKgHa: 2330, doseNpkKgHa: [33.1, 8.2, 15.6] },
      ],
    },
    {
      year: 2015,
      controlDryKgHa: 1103,
      farmerTrials: 33,
      treatments: [
        { id: 'MD1', observedDryKgHa: 2127, doseNpkKgHa: [23.8, 4.1, 7.8] },
        { id: 'MD2', observedDryKgHa: 2262, doseNpkKgHa: [33.1, 8.2, 15.6] },
      ],
    },
  ],
  yieldCeilingKgHa: 10000,
  yieldCeilingSource: 'Shehu et al. 2019 QUEFTS maize study, potential-yield setting for the two Nigerian savanna profiles; transferred unchanged as a fixed scenario boundary.',
};

const toModelMoisture = (dryKgHa) => dryKgHa / (1 - study.modelYieldMoisturePercent / 100);
const profileAtMultiplier = (profile, multiplier) => ({
  ...profile,
  recovery: profile.recovery.map((value) => value * multiplier),
});

function score(rows) {
  const errors = rows.map((row) => row.predictedKgHaAt15Pct - row.observedKgHaAt15Pct);
  return {
    nAggregateTreatmentMeans: rows.length,
    maeKgHa: errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length,
    rmseKgHa: Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length),
    biasKgHa: errors.reduce((sum, error) => sum + error, 0) / errors.length,
    meansWithin20Percent: rows.filter((row) => Math.abs(row.relativeError) <= 0.2).length,
  };
}

function evaluate(profile, multiplier, season) {
  const adjusted = profileAtMultiplier(profile, multiplier);
  const anchor = anchorSupply(
    toModelMoisture(season.controlDryKgHa),
    study.yieldCeilingKgHa,
    adjusted,
  );
  return season.treatments.map((treatment) => {
    const observedKgHaAt15Pct = toModelMoisture(treatment.observedDryKgHa);
    const predictedKgHaAt15Pct = queftsYield(
      anchor.supply,
      treatment.doseNpkKgHa,
      study.yieldCeilingKgHa,
      adjusted,
    ).yieldKgHa;
    return {
      year: season.year,
      treatment: treatment.id,
      doseNpkKgHa: treatment.doseNpkKgHa,
      predictedKgHaAt15Pct,
      observedKgHaAt15Pct,
      errorKgHa: predictedKgHaAt15Pct - observedKgHaAt15Pct,
      relativeError: (predictedKgHaAt15Pct - observedKgHaAt15Pct) / observedKgHaAt15Pct,
    };
  });
}

function fitRecoveryMultiplier(profile, trainingSeason) {
  // Keep every adjusted recovery fraction <= 1; fit only the one declared
  // common multiplier, using the two 2014 treatment means and no 2015 values.
  const maxMultiplier = 1 / Math.max(...profile.recovery);
  const steps = 50000;
  let best = null;
  for (let i = 0; i <= steps; i += 1) {
    const multiplier = maxMultiplier * i / steps;
    const rows = evaluate(profile, multiplier, trainingSeason);
    const mae = score(rows).maeKgHa;
    if (!best || mae < best.maeKgHa) best = { multiplier, maeKgHa: mae };
  }
  return best;
}

const [trainingSeason, validationSeason] = study.seasons;
const results = QUEFTS_PROFILES.map((profile) => {
  const unadjustedValidation = evaluate(profile, 1, validationSeason);
  const fitted = fitRecoveryMultiplier(profile, trainingSeason);
  const trainingRows = evaluate(profile, fitted.multiplier, trainingSeason);
  const validationRows = evaluate(profile, fitted.multiplier, validationSeason);
  const adjusted = profileAtMultiplier(profile, fitted.multiplier);
  return {
    profile: profile.id,
    profileLabel: profile.label,
    originalRecoveryNpk: profile.recovery,
    fittedCommonRecoveryMultiplier: fitted.multiplier,
    candidateRecoveryNpk: adjusted.recovery,
    training: { season: trainingSeason.year, metrics: score(trainingRows), predictions: trainingRows },
    validation: { season: validationSeason.year, metrics: score(validationRows), predictions: validationRows },
    unadjustedValidation: { metrics: score(unadjustedValidation), predictions: unadjustedValidation },
  };
});

const result = {
  reportVersion: 'benin-quefts-microdose-aggregate-benchmark-1',
  runDate: '2026-11-14',
  purpose: 'Fit one common fertilizer-recovery multiplier on published 2014 maize treatment means; evaluate without refitting on published 2015 treatment means.',
  study,
  method: {
    candidateModels: 'Both pre-existing Nigerian QUEFTS profiles evaluated separately; neither is selected using 2015.',
    calibrationSplit: '2014 treatment means only (MD1, MD2).',
    temporalHoldout: '2015 treatment means only (MD1, MD2), from a separate season and farmer set in the same published study area.',
    conditionalAnchor: 'Each season’s observed unfertilized-control mean is used to anchor fixed-ratio soil nutrient supply. This makes the evaluation conditional on a known control yield; it is not a standalone yield forecast.',
    moistureConversion: 'The Benin article reports dry-grain yields. Convert to the model’s 15% moisture basis with dry kg/ha ÷ 0.85.',
    modelYieldCeiling: '10,000 kg/ha, held fixed for both source profiles and both seasons; this is the published QUEFTS study setting, not fitted to the Benin outcomes.',
    scoreUnit: 'Each of the two treatment means receives equal weight. The 18 and 33 underlying farmer trials are not treated as 36 or 66 parcel predictions because plot-level outcomes are unavailable.',
    uncertainty: 'Not estimable from the published means without the paired field-level values, their dispersion/covariance and prediction residuals.',
  },
  decision: {
    parcelForecastQualified: false,
    productionCalibrationApplied: false,
    productionActivation: 'blocked',
    reason: 'Two aggregate treatment means in one held-out season can only test a narrow conditional average treatment response. They do not identify field-specific baseline supply, soil/fertilizer recovery by nutrient, water interactions, or parcel prediction error.',
  },
  profiles: results,
};

console.log(JSON.stringify(result, null, 2));
