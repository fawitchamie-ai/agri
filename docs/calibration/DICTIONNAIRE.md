# Dictionnaire de la base expérimentale 1.0.0

Le schéma exécutable est [schema.sql](../../research-data/calibration/schema.sql). Le reconstructeur produit un CSV par table avec ces mêmes noms de colonnes et une base SQLite à clés étrangères vérifiées. Une ligne de `campaigns` correspond à une **parcelle expérimentale pendant un cycle cultural d'une année**, pas à une publication, un traitement moyen ou un sous-échantillon.

## Règles communes

- `id` est un identifiant déterministe SHA-256 tronqué (24 caractères) ou un identifiant de source explicite ; il est stable à fichiers et clés métier identiques. Un changement de version de fichier change ses identifiants de staging. Les doublons de clés métier sont refusés, les identifiants OFRA répétés sont signalés sans fusion de fonctions.
- `*_id` référence la table correspondante ; `source_row_id` remonte à la ligne originale et au fichier/version/licence. Les objets de protocole provenant d'un article citent celui-ci dans leur champ de méthode ; aucune fausse ligne de classeur ne leur est attribuée.
- `NULL` signifie absent ou non établi. Dans un export CSV, il devient une cellule vide. Un zéro n'est utilisé que lorsqu'il est fourni ou calculable à partir de valeurs connues. Les valeurs d'origine et flags restent disponibles.
- Les dates validées sont ISO `YYYY-MM-DD`. Une date partielle ou une date de publication ne remplace pas une date de prélèvement. Les dates WoSIS non complétées par des zéros sont normalisées sans changer le jour. La date d'acquisition documente la copie consultée, pas la disponibilité historique du résultat de laboratoire.
- Les valeurs sont numériques finies ; pH hors 0–14, doses négatives, masses négatives et coordonnées incohérentes sont refusés ou mis en quarantaine. Les bornes de revue conservatrices n'établissent pas la validité agronomique.
- `*_json` conserve un objet ou une liste JSON UTF-8. Les unités présentes dans ces objets font partie de la valeur ; elles ne sont pas supposées d'après le nom de produit.
- Les réponses WFS WoSIS peuvent changer d’ordre sans changer de données. Les lignes sont triées par `(profile_id, layer_id)` avant hachage canonique ; aucune valeur n’est arrondie ou modifiée. `source_snapshot_sha256` identifie cette représentation déterministe du pays. Le manifeste conserve aussi le SHA-256 des octets de la première réponse HTTP. Un changement de valeur, méthode, licence ou métadonnée nécessite une nouvelle revue.
- Les géométries de parcelles opérationnelles et leurs permissions ne sont pas dans cette base. Les coordonnées d'un site expérimental ou d'un profil ponctuel ne sont pas les coins de toutes ses parcelles. Aucun rapprochement par plus proche voisin n'est fait.

## Provenance et staging

| Table | Clé / liens | Contenu et portée |
| --- | --- | --- |
| `metadata` | `key` | `value` : version de base, finalité et liste de pays calibrés (vide). |
| `sources` | `id` | `title`, `owner`, `url`, `licence`, `version`, `published_at`, `access_state` et `details_json` : notice complète du registre, y compris données non acquises. |
| `source_files` | `id`, `source_id` | `path`, `sha256`, `bytes`, `licence`, `acquired_at`, `details_json` : copie exacte et méthode d'acquisition. La licence d'un article n'écrase jamais celle du fichier. |
| `sheets` | `id`, `file_id` | `name`, `headers_json` : feuille ou CSV et ses colonnes, sans renommer les originaux. |
| `source_rows` | `id`, `sheet_id`, unicité feuille × `source_row` | `raw_json`, `fingerprint` : numéro de ligne source, cellules brutes et empreinte du contenu. README et légendes sont conservés ; ils ne sont pas des observations expérimentales. |
| `qc_issues` | `id` | `severity`, `code`, `record_id`, `field`, `message` : erreur, limite ou demande de revue ; `record_id` peut référencer une ligne, un essai ou une campagne selon le code. Une mise en quarantaine laisse le brut intact. |

## Plan expérimental et campagnes

| Table | Champs | Sens |
| --- | --- | --- |
| `sites` | `id`, `country`, `name`, `latitude`, `longitude`, `coordinate_support`, `system`, `source_id` | Pays ISO-3 des six pays ciblés ; latitude/longitude en degrés WGS84. `coordinate_support` conserve le support ou l'incertitude. |
| `trials` | `id`, `site_id`, `design`, `background_json`, `dependency_group`, `source_id` | Essai, plan de randomisation, conduite commune et groupe de dépendance. Les apports communs de fond restent distincts des facteurs randomisés. |
| `blocks` | `id`, `trial_id`, `source_label` | Bloc randomisé documenté. Présent à Gagnoa ; nul au Sénégal où les suffixes de parcelle sont des répétitions d'un dispositif complètement randomisé. |
| `treatments` | `id`, `trial_id`, `source_label`, `is_control`, `control_definition`, `assignment_json` | Traitement nominal et définition du témoin. `is_control=1` ne signifie pas absence de tout engrais. `assignment_json` ne remplace pas les doses appliquées. |
| `plots` | `id`, `trial_id`, `block_id`, `treatment_id`, `source_label`, `experimental_area_m2`, `sown_area_m2`, `harvested_area_m2`, `replication_basis` | Parcelle physique persistante. Surface brute expérimentale distincte du semé/récolté. Ces deux dernières restent null si non documentées ; 64 m² bruts au Sénégal ne remplacent pas les 48 m² de planches cultivées. |
| `crop_varieties` | `id`, `crop`, `variety`, `source_id` | Culture normalisée et libellé variétal source. Variétés, organes et systèmes ne sont pas confondus. |
| `campaigns` | `id`, `plot_id`, `variety_id`, `year`, `season`, `sowing_date`, `harvest_date`, `date_precision`, `source_row_id`, `dependency_group`, `synthetic` | Une unité parcelle × année × cycle. `year` et `season` sont ceux de la source, même en cas de conflit de protocole signalé. `synthetic=0` pour les fichiers réels livrés. Les jachères sont explicites. |
| `split_assignments` | `campaign_id`, `split`, `protocol` | Affectation future `train/validation/test` selon un protocole écrit. Table vide : aucune validation n'est revendiquée. Un même site dans plusieurs splits est refusé ; une donnée synthétique est exclue de toute validation agronomique. |

## Sol et météo

| Table | Champs | Sens / unités |
| --- | --- | --- |
| `soil_profiles` | `id`, `site_id`, `plot_id`, `treatment_id`, `year`, `sampled_on`, `sampling_phase`, `upper_cm`, `lower_cm`, `sampling_support`, `source_row_id`, `licence` | Prélèvement/horizon, pas un profil pédologique complet imputé. Profondeurs en cm. Les composites 1993 de Gagnoa n'ont pas de parcelle individuelle ; les sols nus au Sénégal ne deviennent pas des témoins de récolte. |
| `soil_measurements` | `id`, `profile_id`, `parameter`, `value`, `unit`, `analytical_method`, `status`, `original_value`, `source_field`, `lower_class_bound`, `upper_class_bound`, `available_on` | Valeur analytique ou standardisée, unité et méthode indissociables. Les bornes de classes sont prévues mais aucun milieu de classe Kara n'est importé. `available_on` correspond à la publication/acquisition conservatrice pour les données de recherche acquises ; la disponibilité au jour d'émission historique reste non documentée. |
| `campaign_soil_links` | `campaign_id`, `profile_id`, `temporal_basis`, `predictor_eligible`, `reason` | Association documentaire, **pas** autorisation d'entraînement. Au Sénégal, seuls les prélèvements strictement antérieurs au semis sont reliés. Tous les `predictor_eligible` restent 0 faute de date de disponibilité analytique documentée. |
| `weather_series` | `id`, `site_id`, `variable`, `unit`, `time_step`, `spatial_support`, `source_id` | Série stationnelle, variable et pas `day/month`. Pluie en mm/jour ; températures minimale/maximale moyennes mensuelles en °C. |
| `weather_observations` | `id`, `series_id`, `period`, `value`, `status`, `source_row_id` | `period` journalier ISO ou mensuel `YYYY-MM`. Un mois de température n'est jamais dupliqué en jours mesurés ; aucun ET0 absent n'est inventé. |

Méthodes maintenues séparées : P Olsen, Olsen-Dabin, Bray, Mehlich ; K échangeable acétate ammonium contre K Mehlich ; pH eau contre KCl. Les valeurs en mg/g de C ou N valent numériquement g/kg ; elles ne deviennent pas N minéral. Au Sénégal, N-NO3/N-NH4 en mg/kg de sol sec, extraction KCl 1 M ; bases échangeables en cmol(+)/kg de sol sec, acétate ammonium 1 M pH 7. Les méthodes et unités issues de cellules README explicitement fusionnées sont développées uniquement dans le dictionnaire, jamais dans les observations manquantes.

## Produits, interventions et récoltes

| Table | Champs | Sens / unités |
| --- | --- | --- |
| `product_analyses` | `id`, `trial_id`, `year`, `crop`, `product`, `sampled_on`, `composition_json`, `method_json`, `source_row_id` | Composition du lot/cycle quand disponible. Matière fraîche, sèche et éléments chimiques restent distincts. Pas d'extension d'une analyse 1973 à toutes les années ou d'un lot sénégalais à tous les cycles. |
| `interventions` | `id`, `plot_id`, `campaign_id`, `year`, `season`, `date`, `date_precision`, `kind`, `product`, `dose`, `unit`, `dose_basis`, `composition_id`, `application_method`, `application_depth_cm`, `status`, `source_row_id` | Dose avec produit, date, composition et mode/profondeur si établis. N Gagnoa : **kg N/ha/an**, `campaign_id=null`, une fois par parcelle/an. Compost : kg MS/ha/cycle. Produits Sénégal : kg de matière fraîche commerciale/ha de planches ; 1 t fraîche = 1 000 kg frais, sans déduction de matière sèche. |
| `plant_observations` | `id`, `campaign_id`, `observed_on`, `parameter`, `value`, `original_value`, `unit`, `method`, `sampling_unit`, `source_row_id` | Sous-échantillons végétaux et observations. Les six planches ne créent pas six répétitions ; les valeurs catégorielles restent dans `original_value`, sans code numérique inventé. Les racines estimées de Gagnoa sont signalées comme estimées. |
| `harvests` | `id`, `campaign_id`, `event_label`, `harvested_on`, `organ`, `product_basis`, `moisture_percent`, `area_m2`, `denominator`, `yield_value`, `yield_unit`, `yield_kg_ha`, `mass_kg`, `status`, `source_row_id` | Total de récolte documenté par campagne, avec source brute conservant les récoltes successives. Maïs Gagnoa : t/ha à 15 % d'eau ; conversion × 1 000 vers kg/ha ; dénominateur semé/récolté non établi et masse non dérivée des 43,2 m². Sénégal : masse fraîche totale de toutes les catégories / 48 m² × 10 000 ; total indisponible si une récolte/planche/catégorie manque. |
| `response_functions` | `id`, `country`, `crop`, `nutrient`, `year_text`, `source_identifier`, `latitude`, `longitude`, `a`, `b`, `c`, `coefficient_units`, `original_json`, `source_row_id`, `excluded_from_plot_calibration` | Fonctions OFRA déjà ajustées ; pas des récoltes ni des doses réelles. Unités des coefficients non résolues (`null`), pas d'évaluation automatique. `excluded_from_plot_calibration=1`. |
| `context_observations` | `id`, `country`, `crop`, `observation_kind`, `details_json`, `source_row_id`, `excluded_from_plot_calibration` | Moyennes variétales IITA, exclues de l'apprentissage expérimental. Unité YIELD non déduite du nom de colonne. |

`observation_units` est une vue de lecture liant pays, culture, variété, parcelle, année/cycle, récolte et dénominateur. Elle ne constitue pas une table prête à entraîner : il faut appliquer les contrôles de licence, protocole, causalité, temporalité et validation externe.

## Statuts importants

- `reported_applied` : quantité rapportée comme appliquée dans le fichier scientifique ; ce n'est pas une preuve instrumentale. `assigned_unknown_realization` : traitement nominal sans preuve suffisante de réalisation/date ; `unknown` : absence conservée. Les interventions utilisateur `planned` et `declared/measured` ne sont jamais confondues avec ces expériences.
- Récolte `reported_complete` ou `reported_plot_total_from_reconstructed_beds` : somme documentée ; `incomplete_no_extrapolation` : aucune somme de cycle ; `not_cropped` : jachère ; `quarantined/missing` : non utilisable comme valeur quantitative.
- Sol `reported_measured`, `reported_standardized`, `spectral_estimate`, `missing`, `quarantined` : statut de la source et du contrôle. Un silence sur la spectroscopie n'est pas converti en certitude de mesure de laboratoire.
- Les contradictions `CULTIVAR_PROTOCOL_CONFLICT`, `COMPOST_PERIOD_PROTOCOL_CONFLICT`, `MANAGEMENT_MISSING`, `FERTILIZER_DOSE_MISSING` exigent une revue producteur ; elles ne déclenchent pas de correction automatique.
