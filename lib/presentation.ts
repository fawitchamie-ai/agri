/** Public-facing terminology; source identifiers and downloadable records remain unchanged. */
export function versionLabel(value:string|undefined|null):string {
 return !value?'Non renseignée':value.startsWith('v24')?'Référence historique · origine 2015':value;
}
export function readableText(value:unknown):string {
 return String(value??'')
 .replace(/Réexécution exacte du protocole v24 — CSV conforme à l’empreinte du notebook/g,'Calcul historique documenté, avec contrôle d’intégrité des résultats')
 .replace(/CSV conforme à l’empreinte du notebook exécuté/g,'Résultats conservés et contrôlés par une empreinte d’intégrité')
 .replace(/notebook v24/gi,'documentation de la méthode de référence')
 .replace(/notebook exécuté/gi,'calcul de référence archivé')
 .replace(/notebook/gi,'documentation technique')
 .replace(/\bCSV\b/g,'tableau téléchargeable')
 .replace(/\bv24\b/g,'de référence')
 .replace(/du mémoire/g,'de l’observatoire')
 .replace(/travail scientifique/g,'ensemble des données de référence');
}
const datasetTitles:Record<string,string>={canonical_panel:'Observations harmonisées',source_candidates:'Observations retenues et écartées',source_exclusions:'Motifs des exclusions',administrative_correspondence_audit:'Correspondances entre territoires',fews_linked_indicators:'Indicateurs agricoles FEWS NET',forecast_input_lineage:'Sources utilisées pour les estimations',predictions_2016_2027:'Estimations des campagnes 2016 à 2027',candidates_all_forecasts:'Estimations de toutes les méthodes',backtest_predictions:'Estimations évaluées sur les campagnes passées',national_history:'Historique national FAOSTAT',official_observations_with_provenance:'Statistiques officielles et références',model_comparison:'Comparaison des performances',nested_validation:'Contrôles de sélection des méthodes',evaluation_audit:'Bilan de l’évaluation',forecast_protocol:'Conditions de calcul des estimations',forecast_model_selection:'Choix des méthodes',forecast_freeze_sha256:'Registre d’intégrité des résultats',historical_error_sensitivity:'Sensibilité aux erreurs historiques',metrics_by_crop_year_horizon:'Performances par culture et campagne',metrics_diagnostic_non_official:'Comparaisons complémentaires',model_sensitivity:'Sensibilité au choix de méthode',national_selected_comparison:'Estimations et observations nationales',observation_availability:'Disponibilité des observations',official_data_manifest:'Références des statistiques officielles',panel_manifest:'Couverture des observations harmonisées',source_comparability_audit:'Comparabilité des sources',validation_feasibility:'Possibilités d’évaluation',hvstat_africa_data_v1:'Statistiques agricoles HarvestStat',crop_data:'Statistiques agricoles FEWS NET'};
export function datasetLabel(filename:string,fallback?:string):string {
 const stem=filename.replace(/\.(csv|json|geojson)$/i,'');
 if(datasetTitles[stem])return datasetTitles[stem];
 if(stem.startsWith('FAOSTAT'))return 'FAOSTAT · statistiques agricoles nationales';
 if(stem.startsWith('hvstat_africa_data'))return 'Statistiques agricoles HarvestStat — archive source';
 if(stem.includes('prefectures_actuelles'))return 'Limites administratives — référentiel à 39 unités';
 if(stem.includes('prefectures_modele'))return 'Limites administratives — grille historique à 35 unités';
 return readableText(fallback||stem).replace(/\bnotebook\b/gi,'documentation').replace(/[_]/g,' ').replace(/\bv\d+(?:\.\d+)*\b/g,'').replace(/\.(csv|json|ipynb)/gi,'').replace(/\s+/g,' ').trim();
}
export function statusLabel(value:string):string {return ({exploratoire:'Estimation indicative',evalue_retrosp:'Évalué sur des campagnes passées'} as Record<string,string>)[value]||readableText(value)}
export function methodLabel(value:string):string {return ({ridge_log_alpha10:'Régression logarithmique régularisée (niveau 10)',ridge_log_alpha100:'Régression logarithmique régularisée (niveau 100)',recent_mean5:'Moyenne des observations récentes',last_observation:'Dernière observation disponible',national_pref_shrink:'Référence nationale ajustée au territoire',random_forest:'Ensemble d’arbres de décision',extratrees:'Ensemble d’arbres aléatoires',prefecture_climatology:'Moyenne historique du territoire',damped_logtrend:'Tendance historique amortie',loglinear_ridge:'Tendance logarithmique régularisée',ar1:'Évolution autorégressive',regional_shrink:'Référence régionale ajustée'} as Record<string,string>)[value]||value;}
export function areaLabel(value:string):string {return ({cropped_area_reported_harvested_vs_planted_unresolved:'Superficie déclarée ; distinction semée/récoltée non établie',planted_available_harvested_unavailable:'Superficie semée ; superficie récoltée indisponible',FAOSTAT_YIELD_DEFINITION_national:'Définition nationale du rendement FAOSTAT',mixed_source_area_definitions:'Définitions de superficie différentes selon les sources'} as Record<string,string>)[value]||value;}
