import {SEASONAL_KY,YIELD_VERSION} from './yield.ts';
/** Capabilities derived from the audited archives and the active engine.
 * These states remain independent: a working calculator is not a validated
 * forecast, and an informational crop sheet is not a fertilizer prescription.
 */
import { CROPS, cropById } from './catalog.ts';
import { NUTRITION_REFERENCES } from './nutrition.ts';
import { COUNTRIES, type Country } from './types.ts';
import countryAudit from '../../docs/refonte/AUDIT_PAYS.json' with { type: 'json' };

export function seasonalCapabilities(country: Country, cropId?: string) {
  const crop = cropId ? cropById(cropId) : undefined;
  const audit = countryAudit.find(a => a.country === country);
  const references = NUTRITION_REFERENCES.filter(r => r.country === country && (!cropId || r.cropId === cropId));
  return {
    country, countryName: COUNTRIES[country].name,
    cropId: crop?.id ?? null,
    cropSheets: CROPS.length,
    historicalData: country === 'TGO'
      ? {status: 'audited_archive', observations: audit?.rows_selected ?? null, territories: audit?.selected_territories ?? null, lastYear: audit?.last_year ?? null,
         note: 'Panel v24 historique ; les correspondances géographiques après 2015 restent à qualifier. Les 1 092 projections ont une origine fixe en 2015.'}
      : audit
        ? {status: 'audited_archive', observations: audit.rows_selected, territories: audit.selected_territories,
           lastYear: audit.last_year, note: 'Statistiques territoriales auditées ; frontières actuelles et dates historiques de publication non établies. Aucun rendement de parcelle.'}
        : {status: 'missing', observations: null, territories: null, lastYear: null,
           note: 'Aucun jeu de rendements ivoirien acquis dans cet audit.'},
    waterSimulation: crop
      ? crop.water && crop.id !== 'rice-flooded'
        ? {status: 'conditional', reason: 'Paramètres de référence à adapter localement ; sol, météo et accès à l’eau requis.'}
        : {status: 'blocked', reason: crop.id === 'rice-flooded' ? 'Bilan de rizière spécifique requis.' : 'Paramètres hydriques de cette culture non acquis ; une référence locale reste nécessaire.'}
      : {status: 'requires_input', reason: 'Choisir une culture et un système.'},
    nutritionReferences: {status: references.length ? 'conditional_reference' : 'missing', count: references.length,
      reason: references.length ? 'Périmètre de chaque fiche à vérifier : pays, territoire, variété et système. Les analyses saisies ne personnalisent pas la dose.' : 'Aucune recette chiffrée qualifiée pour ce pays et cette culture.'},
    personalizedFertilization: {status: 'blocked', reason: 'Relation locale sol–culture, fournitures, eau, apports antérieurs et réponse aux nutriments à qualifier.'},
    conditionalYieldSimulation:{status:cropId&&SEASONAL_KY[cropId]!==undefined?'requires_reference':'declared_scenario_only',version:YIELD_VERSION,reason:'Surface semée et référence explicites ; approximation FAO limitée aux cultures paramétrées, cycle complet et Ym indépendant. Aucune validation parcellaire.'},
    seasonalYieldForecast: {status: 'blocked', reason: 'Jeu disponible à date, paramètres et évaluation saisonnière/parcellaire absents.'},
    chemicalCropProtection: {status: 'blocked', reason: 'Diagnostic et autorisations/étiquettes qualifiés pour le pays, l’usage et la date absents.'},
    prospectiveValidation: {status: 'not_started', reason: 'Observations de terrain et récoltes prospectives requises.'},
  };
}
