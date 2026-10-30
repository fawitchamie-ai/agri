# Simulation automatique — 30 octobre 2026

Navigation principale : Ma simulation et Mes récoltes. Le choix du champ, de la culture et du semis remplace le parcours en sept étapes. Confirmer la parcelle ouvre le résultat ; les ajustements recalculent localement le bilan avec un délai de 220 ms. Les paramètres détaillés et les archives existantes sont conservés sans encombrer la navigation.

## Acquisition

La route authentifiée `POST /api/seasonal`, action `environment`, reçoit les coordonnées du point représentatif, le pays, le début et la durée du cycle (366 jours maximum). Aucun hôte externe n’est accepté en entrée.

- ISRIC SoilGrids WCS : pH eau, carbone organique, azote total, CEC, sable et argile à 5–15 cm ; prédictions à 250 m, au point représentatif, pas une analyse du champ ni une moyenne du polygone.
- Rétention à 33 et 1500 kPa : six horizons de 0 à 200 cm, unités converties en fractions volumiques. Un profil incomplet n’est pas assemblé en omettant des horizons. La réserve initiale reste une hypothèse à 60 % de l’eau disponible. Infiltration et efficacité d’arrosage restent des hypothèses explicites et modifiables.
- Open-Meteo : pluie, ET0 et température moyenne ; 16 jours de prévisions et historique récent de modèles, sans les déclarer comme mesures de terrain.
- Au-delà : moyenne du même jour des trois années calendaires complètes précédentes. Chaque jour porte le statut scénario ; il ne s’agit ni d’une normale climatique de 30 ans ni d’une prévision saisonnière calibrée. Le 29 février utilise le 28 février des années de référence.

Le lecteur TIFF n’accepte qu’un pixel entier 16 bits, mono-bande, brut ou Deflate (tuile de 256 pixels maximum). Taille et décompression sont bornées, no-data et formats inconnus sont refusés. Les erreurs fournisseur laissent les valeurs absentes. Les observations et ajustements de l’utilisateur restent prioritaires ; une indisponibilité ne supprime pas les valeurs précédemment récupérées pour le même cycle. Cache mémoire public borné à 24 entrées, une heure, sans identifiants de compte.

## Interprétation

Le radar présente des axes indépendants : eau satisfaite après les arrosages proposés, proximité indicative du repère pH, part des températures dans la plage optimale, couverture météo et réserve initiale supposée. Il ne produit aucun score global ni rendement. Une valeur inconnue ne devient pas zéro. pH et chimie ne modifient pas artificiellement le rendement ou le bilan hydrique. P/K assimilables, salinité, doses d’engrais et pesticides ne sont pas inventés.

Le graphe hebdomadaire montre les besoins, la pluie retenue et l’irrigation nette. Les segments de besoin utilisant un scénario historique sont en pointillés. Le moteur existant conserve ses limites et bloque l’arrosage lorsque le champ est déclaré engorgé ou submergé ; mortalité et pertes de rendement ne sont pas simulées.

Les cultures sans paramètres ou durées suffisamment définis restent à compléter au lieu de recevoir les paramètres du maïs.

## Sources

- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html — propriétés, horizons et conversions.
- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html — REST suspendu, alternatives WCS.
- https://docs.isric.org/globaldata/soilgrids/wcs.html — acquisition spatiale WCS.
- https://open-meteo.com/en/docs — météo et ET0.
- https://open-meteo.com/en/docs/historical-weather-api — réanalyses historiques et limites spatiales.

## Vérifications

101 tests unitaires passent, ainsi que les tests de routes/persistance et de régression ; TypeScript et compilation de production passent. Les tests ajoutés couvrent TIFF, unités, horizons, pannes, priorité des mesures et sensibilité du bilan à la pluie. Acquisition externe vérifiée à un point de test au Togo : pH 6,3, six horizons, 125 jours météo. Ces vérifications ne constituent pas une validation agronomique au champ. L’aperçu local a un accès sortant restreint : la récupération exécutée dans son Worker peut rester indisponible ; l’affichage est vérifié avec une campagne de test contenant les données réellement récupérées via le transport Node.
