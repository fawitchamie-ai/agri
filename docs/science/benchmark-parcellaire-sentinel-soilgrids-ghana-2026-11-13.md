# Benchmark parcellaire Sentinel‑2 et SoilGrids — maïs, Ghana

## Décision

**Ne pas activer un rendement parcellaire automatique en t/ha à partir de ces résultats.** Sentinel‑2 permet de suivre automatiquement le couvert sur un contour connu. NDVI/EVI, les variables de sol, ou leur combinaison n'atteignent pas une précision stable au champ. L'ajout des six couches hydriques SoilGrids ne change pas cette conclusion.

## Protocole et données

- 46 champs non ambigus d'une étude de maïs dans le nord du Ghana, campagne 2021 ; rendement de grain rapporté en kg/ha à partir de quadrats, sans humidité de référence précisée.
- Partition d'IDs conservée depuis le benchmark existant : 27 entraînement, 9 calibration et 10 test. Les quatre dates utilisent les mêmes dix champs test ; elles ne constituent pas 40 parcelles indépendantes.
- Dates d'émission : 20 septembre, 4 octobre, 18 octobre et 5 novembre 2021. Seules les acquisitions Sentinel‑2 antérieures d'au moins cinq jours sont admissibles. Cette latence est une hypothèse prudente ; l'heure de publication historique de chaque produit n'est pas archivée.
- Les 27 contours déjà valides ont été repris sans modification. Les 19 contours invalides du GeoJSON public ont été réparés uniquement pour cette expérience avec GDAL/OGR `MakeValid`. La validation des contours en production n'a pas été assouplie.
- Les 46 champs ont des séries Sentinel‑2 sans erreur d'extraction finale ; la médiane est de 5 scènes utilisables par champ test et par date d'émission.
- SoilGrids 2.0 a été échantillonné au point intérieur représentatif de chaque champ, à son support de 250 m. Ce sont des estimations cartographiques, pas des analyses de sol de parcelle. Les six couches d'eau disponible sont présentes pour les 46 champs : 27 entraînement, 9 calibration, 10 test. Elles sont calculées comme `thetaFC − thetaWP` par couche et ne représentent pas l'humidité réelle du sol pendant la saison.
- Les modèles Ridge ont `alpha=1`. Imputation et normalisation sont ajustées sur l'entraînement seulement. Les variantes supplémentaires ont été ajoutées après inspection initiale du test : toutes les comparaisons sont donc exploratoires, pas une confirmation aveugle ni une sélection de production.

## Résultats du test spatial réservé

Le témoin est la moyenne des récoltes des 27 champs d'entraînement : **MAE 642 kg/ha, RMSE 750 kg/ha, biais +119 kg/ha et 3/10 champs à ±20 %**. Comme les récoltes d'entraînement viennent de la même campagne 2021, elles n'auraient pas été connues aux dates historiques de prévision. Le témoin est donc rétrospectif, pas une véritable prévision prospective.

| Variante | MAE selon la date | Champs test à ±20 % | Lecture |
| --- | ---: | ---: | --- |
| Amplitude NDVI | 436–670 kg/ha | 1–4/10 | Gain marqué le 4 octobre et le 5 novembre, mais faible ou absent aux autres dates |
| Amplitude EVI | 494–666 kg/ha | 2–3/10 | Signal variable ; pas de gain stable |
| Amplitude NDVI + EVI | 501–630 kg/ha | 1–3/10 | L'erreur baisse sur plusieurs dates, mais la tolérance ±20 % n'est pas atteinte de façon satisfaisante |
| Moyennes, derniers indices et trajectoires NDVI/EVI | 607–1 013 kg/ha selon la variante et la date | 0–4/10 | Les trajectoires plus riches ne font pas mieux de façon régulière |
| SoilGrids, 8 covariables de sol | 724 kg/ha | 3/10 | Pire que le témoin spatial |
| SoilGrids, eau à 10 kPa seule | 650 kg/ha | 3/10 | L'entrée est absente sur 2 champs test, où le modèle retombe sur la moyenne d'entraînement |
| SoilGrids, 12 scalaires disponibles | 920 kg/ha | 4/10 | L'ajout du carbone, des fragments grossiers et de l'eau à 10 kPa dégrade la MAE |
| SoilGrids, profil hydrique sur six couches | 704 kg/ha | 2/10 | Pire que le témoin ; profil disponible sur les 10 champs test |
| SoilGrids, huit covariables + profil hydrique | 838 kg/ha | 1/10 | Pas de gain de la combinaison sol complète |
| SoilGrids, scalaires et profil hydrique (18 variables) | 1 058 kg/ha | 2/10 | L'assemblage complet dégrade l'erreur |
| NDVI/EVI amplitude + profil hydrique (8 variables) | 509–825 kg/ha | 2–3/10 | Meilleur le 4 octobre, mais instable selon la date |
| NDVI/EVI amplitude + 8 variables de sol | 553–819 kg/ha | 1–3/10 | La combinaison avec le sol n'améliore pas de façon régulière |
| NDVI/EVI amplitude + 18 variables de sol | 926–1 033 kg/ha | 1–3/10 | Combinaison plus complète, mais nettement moins précise |
| NDVI/EVI trajectoire + profil hydrique | 697–1 016 kg/ha | 0–4/10 | Aucun gain régulier |
| NDVI/EVI trajectoire + toutes les variables SoilGrids (22 variables) | 982–1 252 kg/ha | 1–3/10 | Dégradation nette et compatible avec le surajustement sur 27 champs |
| LAI mesuré au champ, modèle de comparaison | 414–459 kg/ha | 3–4/10 | Mesure manuelle indisponible automatiquement ; précision encore insuffisante ici |
| Rendement administratif HarvestStat 2020, uniforme dans la région | 751 kg/ha | 2/10 | Repère temporel utile, mais aucune désagrégation entre champs |

La meilleure combinaison ponctuelle de critères atteint **4/10 champs à ±20 %**, contre 3/10 pour le témoin. Avec seulement dix champs, l'intervalle de Wilson à 95 % autour de 4/10 est d'environ **17–69 %**. Ce résultat ne démontre pas une fiabilité de 70 %. Les quatre dates réutilisent les mêmes champs et les variantes ont été nombreuses : le meilleur cas est une piste à retester, pas une performance généralisable. Les intervalles prédictifs à 90 % restent larges, avec des demi-largeurs d'environ 700 à 2 500 kg/ha selon la variante et la date.

Le profil hydrique plus complet améliore la couverture des entrées, mais pas la précision prédictive. Le fait qu'un indicateur soit disponible ne justifie pas son poids dans la prédiction.

La littérature de maïs en Éthiopie indique que des compositions mensuelles de MTCI (bande red-edge Sentinel‑2) peuvent dépasser NDVI dans un domaine local, avec R² jusqu'à 0,63 dans la meilleure zone ; les auteurs signalent cependant une faible généralisation spatiale, notamment sous brume, et peu de gain avec les covariables météo/sol. Cette piste mérite un benchmark red-edge dédié avec les mêmes récoltes indépendantes. Elle n'a pas été testée dans les 37 variantes de cette expérience et n'est pas activée dans le moteur.

## Ce que l'expérience établit

1. **Sentinel‑2 peut mesurer l'évolution de la végétation après la levée** sur un contour déjà connu : installation, vigueur relative, maximum, déclin et couverture de pixels clairs.
2. **NDVI/EVI seuls ne convertissent pas encore cette évolution en rendement de champ fiable.** L'amplitude NDVI est prometteuse sur deux dates, puis ne reproduit pas ce gain sur les quatre dates.
3. **SoilGrids apporte une description pédologique et des variables d'entrée possibles au bilan hydrique**, mais ni les scalaires ni le profil hydrique ne réduisent l'erreur de manière stable dans cette étude. Sa maille de 250 m ne doit pas être présentée comme une mesure analytique du champ.
4. **La fusion de toutes les entrées n'est pas automatiquement meilleure.** Avec 27 champs d'entraînement, les assemblages de 18 à 22 variables sont particulièrement instables et dégradent plusieurs dates.
5. **La détection automatique des champs et de la culture n'a pas été testée.** Le benchmark dispose déjà des contours et de l'étiquette maïs. Une carte verte ou une série NDVI n'identifie pas, à elle seule, une culture pure ni ses limites.
6. **Le test n'est pas prospectif.** Les récoltes d'entraînement de 2021 n'étaient pas encore disponibles aux dates d'émission. Une prévision réelle doit entraîner sur les campagnes antérieures et tester une saison complète laissée de côté.
7. **La moyenne régionale ne peut pas être copiée sur chaque champ.** L'échantillon de 46 contours ne représente pas l'ensemble des terres cultivées ; il manque un masque fiable et un dénominateur de surface pour redistribuer la production régionale sans biais.

## Décision produit et suite

- Garder Sentinel‑2 comme **suivi automatique de la végétation** et comme source candidate de nowcast après semis.
- Garder SoilGrids pour le contexte du sol ou le bilan hydrique avec une mention explicite de son support spatial ; ne pas attribuer un bonus de rendement à ses valeurs.
- Laisser `estimateYield()` refuser le mode automatique pour une valeur parcellaire en t/ha. Ce benchmark ne franchit pas le seuil empirique de 70 % de champs dans ±20 % et ne satisfait pas une validation prospective multi-saisons.
- Refaire le test avec des récoltes indépendantes au Togo : contours exacts, surface réellement récoltée, masse nette, humidité, culture/variété, dates et conduite. Garder des saisons et des sites entiers pour le test.
- Porte de validation recommandée : au moins 100 prédictions de parcelles indépendantes, sur plusieurs campagnes/sites laissés de côté, dont au moins 70 % à ±20 %, avec biais, MAE et couverture des intervalles publiés. Ce seuil est un objectif de preuve, pas une précision déjà obtenue.

## Reproduction et confidentialité

Les [métriques agrégées par date et variante](benchmark-parcellaire-sentinel-soilgrids-ghana-2026-11-13.json) et le protocole de l'étude sont versionnés ici. Les fichiers d'extraction ligne par ligne contiennent des identifiants de champs, des contours, des coordonnées et des rendements associés ; ils ne sont pas inclus dans ce dépôt produit. Le jeu d'origine est publié par Gómez-Dans et al. (2022), DOI `10.5281/zenodo.6632083`. Le protocole précise les limites de l'extraction et les résultats agrégés omettent volontairement les prédictions individuelles.

**Conclusion :** le suivi satellite de la parcelle peut être raccordé et utile dès maintenant ; l'affichage automatique d'un rendement parcellaire en t/ha ne peut pas être activé de façon fiable avec les preuves actuelles.
