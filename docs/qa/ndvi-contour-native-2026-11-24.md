# NDVI limité au champ et pixels natifs de 10 m

## Défauts constatés

La couche NDVI native était dessinée sur le rectangle de cadrage sans masque
du contour : elle coloriait aussi les parcelles voisines. Le contraste était
étiré sur les pixels de ce rectangle. Après rechargement, ou sans date marquée
comme chargée dans l'état temporaire, la vue pouvait également afficher les
cellules de synthèse à 20 m comme carte NDVI. Les bandes natives B04/B08
étaient déjà lues à 10 m ; c'est ce repli de présentation qui est supprimé.

## Correction

- Le NDVI et le NDVI contrasté utilisent uniquement les bandes natives B04/B08
  à 10 m. Une source plus grossière est refusée ; aucun agrandissement,
  regroupement de cellules ou interpolation ne remplace les données natives.
- La lecture des pixels, le choix du masque et les bornes du contraste sont
  liés au contour complet du champ, indépendamment du rectangle de zoom.
  Les pixels extérieurs et ceux des trous ne participent pas au contraste.
- Le rendu SVG découpe les empreintes natives au contour, avec une règle
  pair/impair pour conserver les trous. Les pixels de bord gardent leur
  taille source et leur valeur ; seule leur partie dans le champ est visible.
- La découpe s'applique dans l'analyse, ses comparaisons et la galerie
  quotidienne. Chaque carte possède son propre identifiant de masque.
- La grille à 20 m reste utilisée pour les statistiques enregistrées et les
  zones historiques. Elle ne sert plus de carte de remplacement dans les
  deux vues NDVI. Après autorisation, la date sélectionnée charge directement
  ses pixels natifs, y compris après rechargement ou sans grille en cache.
- Le RGB conserve son contexte géographique à 10 m ; la classification SCL
  reste à sa résolution native de 20 m. Le calendrier qualifié est préservé.

## Vérifications

- Contour concave, trou intérieur, pixels de bord, identifiants indépendants
  des comparaisons et absence de regroupement dans le rendu.
- Extrêmes NDVI hors contour et dans un trou exclus du contraste ; même
  résultat avant et après zoom ; empreintes source inchangées.
- GeoTIFF métrique de contrôle à 10 m : 117 échantillons distincts lus sans
  perte, côtés des pixels de 10 m après reprojection.
- Rejeu du nouveau lecteur sur les bandes publiques Sentinel-2 réelles déjà
  acquises pour le contour communiqué (coordonnées privées hors du dépôt) :

| Date | Acquisition | Pixels natifs intersectant le champ | Résolution | Pixels entièrement extérieurs retenus |
| --- | --- | ---: | ---: | ---: |
| 14 octobre 2026 | S2C_T31NCH_20261014T101926_L2A | 176 | 10 m | 0 |
| 29 octobre 2026 | S2B_T31NDH_20261029T102145_L2A | 157 | 10 m | 0 |
| 23 novembre 2026 | S2C_T31NCH_20261123T101801_L2A | 175 | 10 m | 0 |

Ces comptes incluent les pixels partiellement coupés au bord ; leur surface
complète ne doit pas être assimilée à la surface du champ. Chaque côté a été
mesuré dans EPSG:32631 : 9,999999999 à 10,000000001 m. NDVI et contraste
conservent les mêmes pixels ; seules leurs couleurs diffèrent.

Vérification locale avant publication : 522 tests exécutés, 520 réussis,
deux tests externes ignorés et aucun échec. Intégration HTTP 14/14,
régressions finales 5/5, TypeScript et compilation de production réussis.

Le script `scripts/verify-field-coverage.mjs` transmet désormais aussi le
contour au lecteur visuel et contrôle la résolution et les pixels extérieurs.
