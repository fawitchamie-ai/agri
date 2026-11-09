# Simulation automatique — 9 novembre 2026

Navigation principale : Ma simulation et Mes récoltes. Le scénario peut être préparé avant semis avec la surface que l’utilisateur prévoit de cultiver. Après semis, la surface effectivement semée et les opérations réelles alimentent le suivi. Confirmer la parcelle ouvre le résultat ; les ajustements recalculent localement le bilan avec un délai de 220 ms.

## Acquisition

La route authentifiée `POST /api/seasonal`, action `environment`, reçoit les coordonnées du point représentatif, le pays, le début et la durée du cycle (366 jours maximum). Aucun hôte externe n’est accepté en entrée.

- ISRIC SoilGrids WCS : propriétés récupérées pour l’interprétation du sol : pH eau, carbone organique (SOC), densité et stock de carbone (OCD/OCS), azote total, CEC, densité apparente, éléments grossiers, sable, limon, argile et eau volumique à 10 kPa. Les propriétés générales interrogées ici décrivent 5–15 cm, sauf le stock de carbone OCS qui décrit 0–30 cm ; les propriétés chimiques et physiques ne sont pas toutes interrogées sur les six profondeurs SoilGrids dans cette version. Ce sont des prédictions à 250 m, pas des mesures de la parcelle. Le panneau calcule une synthèse pondérée par aire à partir de profils représentatifs de zones terrestres ; cette estimation parcellaire n’est pas un zonage exhaustif des pixels et ne crée aucune précision sous-maille. pH reste affiché par zone, sans moyenne arithmétique.
- Rétention à 33 et 1500 kPa : six horizons de 0 à 200 cm. Le panneau affiche, par zone, eau au champ, flétrissement, réserve théorique par horizon et humidité initiale supposée à 60 % de l’eau disponible. La réserve totale sur 0–200 cm n’est pas nécessairement accessible aux racines de la culture. La maille et les profils incomplets sont signalés ; les quantiles Q0.05–Q0.95 sont des intervalles prédictifs par valeur SoilGrids, pas un intervalle de confiance de la moyenne parcellaire.
- Open-Meteo : pluie, ET0 et température moyenne ; 16 jours de prévisions et historique récent de modèles, sans les déclarer comme mesures de terrain.
- Au-delà : moyenne du même jour des trois années calendaires complètes précédentes. Chaque jour porte le statut scénario ; il ne s’agit ni d’une normale climatique de 30 ans ni d’une prévision saisonnière calibrée. Le 29 février utilise le 28 février des années de référence.

Le lecteur TIFF n’accepte qu’un pixel entier 16 bits, mono-bande, brut ou Deflate (tuile de 256 pixels maximum). Taille et décompression sont bornées, no-data et formats inconnus sont refusés. Les erreurs fournisseur laissent les valeurs absentes. Les observations et ajustements de l’utilisateur restent prioritaires ; une indisponibilité ne supprime pas les valeurs précédemment récupérées pour le même cycle. Cache mémoire public borné à 24 entrées, une heure, sans identifiants de compte.

## Interprétation

Le radar présente des axes indépendants : eau satisfaite après les arrosages proposés, proximité indicative du repère pH, part des températures dans la plage optimale, couverture météo et réserve initiale supposée. Il ne produit aucun score global ni rendement. Une valeur inconnue ne devient pas zéro. pH et chimie ne modifient pas artificiellement le rendement ou le bilan hydrique. P/K assimilables, salinité, doses d’engrais et pesticides ne sont pas inventés.

Les images satellites, NDVI et EVI renseignent surtout la couverture et la vigueur de la végétation visible ; elles ne fournissent pas le pH, le carbone, l’azote disponible, le phosphore ou le potassium du sol. SoilGrids fournit une estimation cartographique de propriétés physiques et chimiques ; il renvoie l’azote total, pas l’azote immédiatement disponible, et ne renvoie pas P/K assimilables. Pour ces diagnostics, afficher et saisir séparément une analyse de laboratoire avec méthode et profondeur.

Le graphe hebdomadaire montre les besoins, la pluie retenue et l’irrigation nette. Le scénario d’apports proposés simule ce qui arriverait s’ils étaient réalisés ; les arrosages saisis dans le carnet restent des observations de suivi. Le moteur existant conserve ses limites et bloque l’arrosage lorsque le champ est déclaré engorgé ou submergé ; mortalité et pertes de rendement ne sont pas simulées.

Les cultures sans paramètres ou durées suffisamment définis restent à compléter au lieu de recevoir les paramètres du maïs.

## Sources

- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html — propriétés, horizons et conversions.
- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html — REST suspendu, alternatives WCS.
- https://docs.isric.org/globaldata/soilgrids/wcs.html — acquisition spatiale WCS.
- https://www.fao.org/4/X0490E/x0490e0b.htm — FAO-56, Kc et durées d’exemple par contexte.
- https://www.fao.org/4/X0490E/x0490e0e.htm — FAO-56, racines et seuils p.
- https://ecocrop.apps.fao.org/ — profils écologiques des cultures.
- https://open-meteo.com/en/docs — météo et ET0.
- https://open-meteo.com/en/docs/historical-weather-api — réanalyses historiques et limites spatiales.

## État des vérifications

Les résultats ci-dessous décrivent une révision antérieure et ne valident pas les changements de cette mise à jour. Les tests automatisés, le typage et la compilation restent à exécuter sur cette révision. La récupération externe SoilGrids doit être confirmée depuis le Worker de déploiement. Même vérifiés, ces contrôles techniques ne constituent pas une validation agronomique au champ.
