# Analyse visuelle du champ

Accès : **Ma campagne → Ouvrir le suivi du champ → Analyse du champ**.

La vue réunit les cartes, les dates disponibles, les valeurs par cellule et les
courbes de campagne. La charte AgriPrévision reste en bleu, avec la police Lato.

| Vue | Informations disponibles |
| --- | --- |
| Cartes du champ | NDVI en échelle fixe, NDVI contrasté, couleurs naturelles Sentinel-2 datées, zones historiques, terre/eau et photo Esri de repérage. |
| Comparer | Deux dates et deux couches indépendantes, même cadrage et même cellule inspectée. Écart de NDVI calculé sur la surface commune qualifiée. |
| Évolution et météo | NDVI/EVI archivés, pluie passée renseignée, degrés-jours avec une base thermique explicitement choisie, export CSV et accès aux prévisions météo. |
| Rapport du champ | Couverture, vigueur, saisons retenues, surfaces des zones historiques, sources et accès au carnet de terrain. |

## Données et interprétation

- Les images se chargent après accord explicite de transmission du contour à
  Digital Earth Africa / Earth Search ; le fond photo utilise Esri.
- Une carte datée ne contient qu’une acquisition. Les composites historiques
  ne sont jamais présentés comme une image prise à une date unique.
- Douze cartes au maximum sont conservées avec la campagne. Les réglages des
  saisons ne suppriment pas ces acquisitions.
- Les statistiques de grille sont des moyennes/quantiles des médianes de cellules,
  pondérés par leur surface. Chaque cellule est qualifiée à partir d’au moins
  60 % de pixels clairs. La surface analysable et la fraction native de pixels
  clairs restent deux indicateurs distincts.
- Le contraste utilise les minimum et maximum de chaque image. Un champ
  homogène reste homogène ; comparer les couleurs contrastées ne mesure pas
  une variation absolue. Le calcul de différence utilise les mêmes cellules,
  au moins 12 cellules et 60 % du contour commun.
- Les courbes gardent les valeurs manquantes et les interruptions de plus de
  20 jours. Les jours météorologiques absents ne deviennent pas des zéros.
  Prévisions et scénarios sont exclus des cumuls passés.
- La carte de doses utilise automatiquement un historique qualifié ou une
  observation récente, avec choix manuel de la source. Les doses et leur
  référence agronomique restent renseignées et confirmées par l’utilisateur.
  La confirmation est liée au contour, aux zones et à la date de la carte.
- Une observation ne modifie jamais le score historique et n’active pas une
  prévision. La projection historique exige au moins deux contrôles temporels
  réservés, tous à 65 % minimum, ainsi que les autres conditions de comparabilité.

## Périmètre restant

Le relief, la vue 3D, la brillance du sol et les autres indices spectraux de
OneSoil ne sont pas raccordés par cette modification. Aucune couche ni valeur
de rendement en tonnes n’est fabriquée pour remplir ces emplacements.

Le contrôle visuel interactif n’a pas abouti : le navigateur de vérification a
refusé l’accès à l’aperçu. Les parcours sont vérifiés dans le DOM automatisé,
avec les tests de calcul, de persistance et de compilation. Ce document ne
revendique pas de contrôle visuel complet dans un navigateur.

## Références de parcours

- OneSoil, [suivi des indices et comparaison des cartes](https://help.onesoil.ai/en/articles/5237493-how-to-monitor-vegetation-indexes-ndvi-msavi-ndre-etc).
- OneSoil, [rapport du champ](https://help.onesoil.ai/en/articles/6115775-the-field-report-explained).
- OneSoil, [état du champ, NDVI et météo](https://help.onesoil.ai/en/articles/8354961-checking-field-status-ndvi-and-weather-data).
