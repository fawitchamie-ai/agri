# AgriPrévision : étude OneSoil / Cropin et livraison du 2 novembre 2026

## Objectif

Rendre la simulation lisible pour un exploitant des six pays (Togo, Bénin, Burkina Faso, Ghana, Côte d’Ivoire, Sénégal), relier chaque action à ses données et préparer l’amélioration de la précision par des observations vérifiables. L’étude porte sur les pages produit et la documentation publiques, y compris les captures d’interface officielles ; aucun compte commercial, modèle propriétaire ou jeu de données sous licence de ces plateformes n’a été utilisé.

## Principes retenus

| Fonction observée | Apport à AgriPrévision | État livré |
| --- | --- | --- |
| OneSoil : champ et carte au centre de l’expérience | Relier parcelle, culture et résultats sans changer d’espace | Schéma exact du contour avec trous, orientation nord et accès direct à la carte existante |
| OneSoil : météo et suivi de terrain | Savoir quelles données sont présentes avant d’intervenir | Bandeau de sept jours : pluie, température disponible, statut et sources ; aucune extrapolation des jours absents |
| Cropin : rendement, progression et alertes dans la vue parcellaire | Faire apparaître les résultats avant les détails techniques | Quatre indicateurs : t/ha semé, tonnes, eau restante à la source et stade calendaire |
| Cropin : une prochaine action explicable | Passer d’un tableau de paramètres à une décision vérifiable | Actions ordonnées : eau stagnante, terrain, bilan incomplet, arrosage proposé, référence de rendement et observation du champ |
| OneSoil : scouting ; Cropin : collecte structurée | Créer une vérité terrain datée | Carnet de levée, adventices, ravageurs, maladies, drainage et stades ; auteur, date, note et export JSON |
| OneSoil : essais en champ | Mesurer les effets au lieu de les supposer | Registre d’essais existant conservé et regroupé dans « Suivi et essais » |
| Cropin : preuves et qualité des informations | Ne pas transformer une source disponible en modèle validé | Portée du sol, du rendement, des observations et du satellite explicitée dans une rubrique compacte |

L’interface principale comprend quatre onglets : Vue du champ, Eau et semis, Engrais, Suivi et essais. Les paramètres complets restent accessibles dans un panneau replié. Les rubriques non affichées ne déclenchent plus toutes leurs requêtes d’engrais/comparaison au chargement de la synthèse. Les flèches du clavier, Début et Fin permettent de naviguer entre les onglets.

## Comportement et précision

Les indicateurs utilisent les sorties existantes du moteur ; cette livraison n’introduit aucun coefficient de rendement ou gain d’engrais supplémentaire. Le scénario de récolte correspond aux seuls apports enregistrés, ou au plan manuel proposé lorsque celui-ci est actif, comme dans le panneau de récolte existant. L’unité t/ha semé est distinguée des tonnes sur la parcelle et du contour dessiné.

Les valeurs d’un plan en recalcul ou d’une acquisition en cours sont masquées. La pluie inconnue ne devient jamais zéro : le cumul de sept jours reste absent si un jour manque, est seulement un scénario personnel ou n’était pas disponible à la date de la simulation. Les observations météo futures et les données acquises après cette date sont exclues de ce bandeau. Le stade provient des durées culturales, avec mention de sa nature indicative ; il ne certifie ni la levée ni la floraison observées.

Une déclaration d’engorgement ou de submersion est prioritaire sur les propositions d’arrosage. Le carnet visuel sert à documenter une vérification et n’applique pas automatiquement une perte de rendement ou un traitement phytosanitaire. La saisie reste dans le brouillon jusqu’à l’enregistrement de la campagne ; elle est ensuite conservée dans les révisions existantes. Un changement de contour démarre sans réutiliser le carnet, les essais, le scénario de rendement ou la salinité de l’ancien champ. Les campagnes déjà enregistrées restent accessibles.

## Éléments non revendiqués et suite technique

| Capacité des références | Condition nécessaire pour une intégration fiable |
| --- | --- |
| Séries NDVI / NDRE / humidité de végétation | Fournisseur effectivement raccordé ; masques nuages et ombres ; dates des acquisitions ; statistiques dans le contour ; couverture et résolution documentées ; contrôle des petites parcelles |
| Zones de productivité stables | Historique de plusieurs saisons, cultures/stades compatibles, stabilité évaluée et vérification au champ ; un fond satellite ne constitue pas cette analyse |
| Doses variables d’engrais | Analyses représentatives par zone, méthodes et profondeurs compatibles, essais de réponse, composition des produits, contraintes eau/sol et validation locale |
| Diagnostic de maladie et alertes prédictives | Données locales annotées, modèle évalué hors échantillon, seuils et agronome ; les notes de symptômes ne deviennent pas un diagnostic |
| Meilleure date de semis et gain optimal | Comparaison sur des cycles météo complets et compatibles, variété, contraintes de terrain et validation du modèle de réponse |

Ces capacités ne sont pas simulées visuellement. La synthèse indique « série NDVI non raccordée ». Les travaux de calibration existants sont préservés, mais aucune performance commerciale de OneSoil ou Cropin n’est transférée à AgriPrévision. La précision future se vérifiera sur des campagnes et des sites tenus à l’écart, avec erreurs en t/ha, couverture et incertitude, et non par un score général inventé.

## Sources publiques consultées

- OneSoil Platform : https://onesoil.ai/fr/platform
- Capture de la plateforme : https://onesoil.ai/_next/image?q=75&url=%2Fimages%2Fhome-hero%2Fhero-preview.png&w=2048
- Cropin : https://www.cropin.com/
- Cropin Apps : https://www.cropin.com/intelligent-agriculture-cloud-cropin-apps/
- Capture du suivi parcellaire : https://www.cropin.com/assets/apps-use-cases/apps-plot-progression.webp
- OneSoil, interprétation du rapport parcellaire : https://help.onesoil.ai/en/articles/6115775-the-field-report-explained
- OneSoil, démarrage et observations de terrain : https://help.onesoil.ai/en/articles/17634801-how-to-get-started-with-onesoil
- OneSoil, disponibilité des images et nuages : https://help.onesoil.ai/en/articles/5237667-why-aren-t-i-getting-vegetation-index-updates
- OneSoil, échantillonnage du sol par zones : https://help.onesoil.ai/en/articles/7946937-how-to-use-the-tool-for-soil-sampling-based-on-productivity-zones

Les descriptions de fonctionnalités relèvent de leurs éditeurs. Cette étude n’est pas une évaluation indépendante de leur précision agronomique.
