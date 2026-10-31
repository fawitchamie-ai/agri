# Extension agronomique opérationnelle — 31 octobre 2026

Cette étape progressive ajoute au modèle hydrique de la PR 8 :

- Matrice serveur de plus de 80 paramètres dans sept familles, avec récupération/utilisation/indication/non-modélisation distinctes, unités, profondeur/période, résolution, source, quantiles et valeurs manquantes. Rapport exportable depuis la simulation.
- Observations modifiables rattachées au contour et conservées dans les révisions. Un changement de contour invalide leur réutilisation. Une observation informative ne remplace pas silencieusement le paramètre actif du moteur.
- Acquisition des profils de sol par composantes et strates, limitée à huit profils, avec couverture hydrique complète mesurée par les intersections. Les trous sont conservés. Aucun résultat partiel n’est extrapolé. La résolution native reste 250 m ; le pH n’est pas moyenné et les erreurs communes de pixel sont signalées.
- Application explicite des profils séparés aux unités de calcul : répartition de surface semée par aire comme hypothèse confirmée ; priorité au profil local modifié. Les bilans pluvial/réalisé sont rejoués unité par unité. Le futur multi-unités reste suspendu sans partage des ressources.
- Scénarios documentés de pluie, ET0 et dates de semis. Même calendrier réel, sans translation des pluies ; cycle incomplet = résultat indisponible. Plage min/max seulement lorsque tous les scénarios du mode donnent un résultat ; aucune probabilité et aucun intervalle prédictif inventés.
- Fenêtre de saison déclarée et source conservées ; fin de cycle vérifiée contre la fenêtre. Pas de date optimale garantie, notamment lorsque les jours météo de fin de cycle ne sont pas disponibles.
- Diagnostic après récolte contre une révision enregistrée avant la récolte. Contrôle des accès, contour et culture ; masse corrigée par conservation de matière sèche, humidités obligatoires et compatibilité du produit explicitement déclarée. L’observation est ajoutée à une nouvelle révision avec protection de concurrence et détection des répétitions. MAE, RMSE et biais n=1 restent un diagnostic individuel, sans validation spatiale/temporelle globale.
- Blocage des associations, successions et récoltes multiples ; salinité de pâte saturée au-delà du repère cultural suspend le rendement hydrique. Pas de facteur de pH, de nutrition ou de température arbitraire.

## Sources vérifiées et choix du moteur

FAO AquaCrop, schéma officiel : https://www.fao.org/aquacrop/overview/calculation-scheme/

AquaCrop calcule couvert, transpiration, biomasse et indice de récolte. Il n’est pas activé ici sans profils variétaux calibrés et validation indépendante : aucun second bilan contradictoire n’est ajouté. Le moteur FAO saisonnier existant reste identifié et limité.

ISRIC SoilGrids : https://isric.org/explore/soilgrids

ISRIC annonce toujours le REST suspendu sans délai de reprise. Le WCS déjà intégré est réutilisé, avec ses erreurs et les six horizons du produit. Une mesure 5–15 cm n’est pas étendue à toute la racine. Les analyses de laboratoire compatibles restent prioritaires. La maille de 250 m ne devient pas une mesure au m².

Les accès CHIRPS/ERA5-Land, WoSIS et nationaux évalués précédemment ne sont pas présentés comme de nouveaux connecteurs opérationnels dans cette livraison. Les flux existants de météo, de terrain et de sol sont conservés, sans inventer de couverture récente.

## Limites décisives

La production biologique, la récolte et le commercialisable restent distincts ; biomasse, mortalité, reprise après submersion, réponse aux engrais, phytosanitaire, chaleur et interactions eau–azote ne sont pas calibrées. Les données descriptives restent visibles sans être transformées en scores multiplicatifs. Engorgement et submersion observés suspendent l’approximation ; proximité de l’eau et drainage théorique ne prouvent aucune connexion hydraulique ni évacuation réelle.

Pas de prescription d’engrais à partir du seul pH ou azote total. Pas de pesticide sans diagnostic et homologation locale. Pas de revendication de prévision saisonnière parcellaire évaluée. Revue documentaire technique effectuée ; **revue indépendante par un agronome en attente** et aucune validation au champ ajoutée par les tests logiciels.

Le diagnostic de récolte compare un seul cas. Les évaluations multi-sites et multi-années, référence simple indépendante, séparation entraînement/test et couverture d’intervalles restent à construire avec des récoltes indépendantes ; aucune métrique globale n’est fabriquée.

## API et compatibilité

POST /api/seasonal : agronomic-coverage, agronomic-soil, agronomic-compare et agronomic-harvest. Les permissions et la géométrie serveur restent applicables. Champs optionnels dans la configuration et stockage dans les révisions existantes : aucune migration supplémentaire. Interface sous « Comprendre et comparer ma parcelle », détails repliables.

Tests : six pays, couvertures/manquants, profondeur et dates, ancien contour, scénarios incomplets, bornes physiques, conservation de matière sèche, cultures non compatibles, permissions et persistance. Les acquisitions réelles des six échantillons de la première étape ne constituent pas une validation des rendements.
