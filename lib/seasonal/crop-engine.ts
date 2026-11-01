import {InputError} from './validation.ts';
export const CROP_ENGINE_VERSION='soil-water-nitrogen-1';
export const DAILY_MODEL='Wofost81_NWLP_MLWB_SNOMIN';
/** All values describe this exact model, not the whole PCSE suite. */
export function cropEngineManifest(){return {
 version:CROP_ENGINE_VERSION,selected:{model:DAILY_MODEL,runtime:'Python 3.12 / PCSE 6.0.13',license:'EUPL-1.2',role:'research_scenario',validatedCountries:[],operationalForecast:false},
 reference:{model:'declared-scenario / FAO56 seasonal Ky',role:'existing_conditional_reference',coupledToDailyModel:false},
 seasonalNpk:{model:'QUEFTS',status:'not_enabled',reason:'Fournitures NPK, paramètres culturaux et calibration de domaine non établis. Aucune réponse aux dates intra-cycle.'},
 effects:[
  {effect:'Eau et racines par horizon',daily:'simulated',worker:'existing_daily_water_balance',unit:'cm, cm³/cm³'},
  {effect:'NH₄-N, NO₃-N, minéralisation / immobilisation, nitrification, absorption, transport, dénitrification',daily:'simulated',worker:'not_modelled',unit:'stocks et flux natifs kg N/m², sorties converties kg N/ha'},
  {effect:'Apports organiques',daily:'conditional_SNOMIN_profile',worker:'total_mass_only',unit:'kg produit/ha ; fractions massiques'},
  {effect:'Urée / hydrolyse et volatilisation NH₃',daily:'not_modelled',worker:'not_modelled',unit:null},
  {effect:'Fixation biologique des légumineuses',daily:'not_enabled',worker:'not_modelled',unit:null},
  {effect:'P, K : stocks, transformations, absorption, carence',daily:'not_modelled',worker:'applied_mass_only',unit:'kg élément/ha pour les apports uniquement'},
  {effect:'pH',daily:'fixed_input_for_CN_processes_no_daily_evolution',worker:'diagnostic_only',unit:'méthode analytique à conserver'},
  {effect:'Déficit d’oxygène',daily:'crop_parameter_IOX_required_not_flood_mortality',worker:'no_quantified_yield_loss',unit:null},
  {effect:'Salinité, toxicité, verse, ravageurs',daily:'not_modelled',worker:'separate_diagnostics_only',unit:null},
  {effect:'Chaulage, structure, réserve utile après compost, biochar, biostimulants',daily:'no_automatic_effect',worker:'no_automatic_effect',unit:null},
 ],
 required:['Paramètres complets du cultivar et leur source/licence','Horizons : épaisseurs, courbes hydriques et conductivités, densités, C/N, matière organique, pH','États initiaux eau, NH₄ et NO₃ par horizon et paramètres SNOMIN','Météo journalière complète IRRAD/TMIN/TMAX/VAP/RAIN/WIND/E0/ES0/ET0, avec unités PCSE','Dates et profils compatibles des apports','Scénario explicite P et K non limitants ; aucun rendement NPK complet','Surface semée et produit sec de stockage, distinct du produit frais ou commercialisable'],
 coupling:'Le résultat journalier conserve son propre bilan hydrique. Aucun facteur FAO, pH, nutrition ou proximité d’eau ne lui est appliqué une seconde fois.',
 spatial:'Un appel par unité homogène disjointe, géométries et surfaces contrôlées par le moteur spatial existant. Pas de mesure au m² déduite de 250 m.',
 sources:['https://pcse.readthedocs.io/en/stable/_modules/pcse/models.html','https://pcse.readthedocs.io/en/stable/_modules/pcse/soil/snomin.html','https://github.com/ajwdewit/pcse','https://doi.org/10.1016/j.eja.2024.127099'],
};}

/** Concentration inventory conversion only. Never a soil-supply or uptake function. */
export function concentrationInventory(v:{mgKg:number;thicknessM:number;bulkDensityKgM3:number;fineEarthFraction:number;source:string;densityBasis:'whole-soil';fractionBasis:'fine-earth-mass'}){
 if(!v||![v.mgKg,v.thicknessM,v.bulkDensityKgM3,v.fineEarthFraction].every(Number.isFinite)||v.mgKg<0||v.thicknessM<=0||v.thicknessM>10||v.bulkDensityKgM3<=0||v.bulkDensityKgM3>3000||v.fineEarthFraction<0||v.fineEarthFraction>1||!v.source?.trim()||v.densityBasis!=='whole-soil'||v.fractionBasis!=='fine-earth-mass')throw new InputError('Concentration, épaisseur, densité du sol entier et fraction massique de terre fine documentées requises.');
 return {inventoryKgHa:v.mgKg*1e-6*v.thicknessM*10000*v.bulkDensityKgM3*v.fineEarthFraction,supplyToCropKgHa:null,source:v.source,interpretation:'Inventaire de la fraction analysée dans cette couche. Une extraction P ou K ne mesure ni stock total ni fourniture à la plante. Aucune extension vers d’autres horizons.'};
}
