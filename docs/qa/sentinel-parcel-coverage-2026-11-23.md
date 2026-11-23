# Couverture Sentinel-2 : recherche à 80 % et diagnostic du masque

## Cause reproduite

Le 23 novembre 2026, analyse du contour communiqué par l’utilisateur (1,439379 ha).
Les coordonnées et fichiers raster du contour restent hors du dépôt. Le rapport
ci-dessous contient uniquement les mesures agrégées et les identifiants publics
des acquisitions Sentinel-2. La culture et le semis ne sont pas confirmés.

Earth Search publie 32 scènes sur 15 dates du 1er octobre au 23 novembre.
Les six dates les plus récentes (3, 5, 8, 13, 15 et 18 novembre) présentent
0 % de surface claire SCL 4/5 sur le contour. Les classes observées sont les
nuages moyens/forts et le cirrus (SCL 8/9/10). Les pixels RGB existent également
au-dessus des nuages : leur affichage ne prouve pas que le sol est observable.

L’ancienne recherche automatique s’arrêtait à six dates. Elle ne pouvait donc
jamais atteindre le 29 octobre, première date plus ancienne franchissant 80 %.
Elle choisissait aussi une tuile quotidienne selon la nébulosité de la scène
entière, sans mesurer les différences de masque sur la parcelle.

## Mesures sur les vraies bandes publiques

| Acquisition | Tuile retenue | Surface NDVI exploitable | Grille qualifiée | Cellules | NDVI moyen de grille |
| --- | --- | ---: | ---: | ---: | ---: |
| 18 novembre 2026 | 31NDH | 0 % | 0 % | 0 | absent |
| 29 octobre 2026 | 31NDH | 91,248972 % | 93,764319 % | 47 | 0,401636 |
| 14 octobre 2026 | 31NDH | 100 % | 100 % | 51 | 0,624444 |

Le 29 octobre, la tuile 31NCH choisie auparavant donne 88,456387 % de surface
claire selon SCL, contre 91,248972 % pour 31NDH. La partie exclue de 31NDH est
classée incertaine (SCL 7, 8,751028 %), et n’est pas transformée en observation.
La surface des cellules de synthèse qualifiées diffère de celle des pixels
natifs : une cellule de grille reste qualifiée à partir de 60 % de surface
claire, règle historique conservée.

Le rejeu automatique sur ces lectures publiques trouve le 29 octobre en sept
tentatives, sans échec de lecture, après les six dates de novembre opaques.

## Correction

- Recherche jusqu’à 36 dates distinctes, avec progression et annulation. Le
  résultat indique les dates anciennes restant à explorer si la limite est atteinte.
- Objectif automatique de 80 % sur la surface NDVI native **et** la grille
  qualifiée, avec au moins 12 cellules. Les dates moins couvertes restent consultables.
- Lecture SCL avant les réflectances. Les dates entièrement opaques n’imposent
  plus deux téléchargements inutiles B04/B08.
- Comparaison locale des masques de quatre tuiles maximum par date ; choix
  d’une acquisition unique, sans assemblage de dates ni assouplissement du masque.
- L’affichage RGB, SCL, NDVI et NDVI contrasté utilise l’identifiant de
  l’acquisition archivée. Le zoom ne choisit plus implicitement une autre tuile.
- Dates annotées par leur couverture ; répartition nuages/cirrus, ombres, eau,
  classification incertaine et absence de données conservée avec la campagne.
- Anciennes archives sans ce diagnostic toujours acceptées. Diagnostic
  sérialisé et validé, sans migration de base ni changement des droits de session.

## Vérifications

- 509 tests exécutés : 507 réussis, deux tests externes ignorés localement.
- Régressions ciblées après modification des tests de persistance et d’interface : 11/11.
- Intégration HTTP et persistance : 14/14 ; régressions finales : 5/5.
- Vérification TypeScript et compilation de production réussies.
- Contrôles : septième date après six nuageuses, rejet d’une observation à 70 %,
  masque opaque sans lecture B04/B08, tuile régionale peu nuageuse mais parcelle
  opaque, cohérence des quatre couches, repli après panne, trous du contour et
  sauvegarde des diagnostics avec isolation des comptes.
- Lectures réelles B04/B08/SCL à 10/10/20 m et RGB, les 29 et 14 octobre.

Reproduction sur un GeoJSON local, après déploiement du commit exact :

```sh
node --use-env-proxy --experimental-transform-types scripts/verify-field-coverage.mjs \
  --live /chemin/prive/contour.json 2026-10-01 2026-11-23 /chemin/prive/rapport.json COMMIT_DEPLOYE
```

Le script vérifie `/api/version`, utilise une session de démonstration isolée,
teste les quatre couches natives, ferme sa session et n’enregistre aucune
campagne en production. Le rapport exclut la géométrie privée.

Référence des classes SCL :
https://sentiwiki.copernicus.eu/web/s2-processing

## Complément : chargement des 8 au 18 novembre

Contrôle en production sur `daa6b58fa077ea5a1cdea8ee3eefd14d3ac31dbc` :
le script de contrôle sélectionne le 29 octobre après sept acquisitions et
charge RGB, SCL, NDVI et NDVI contrasté (10/20/10/10 m). Session isolée fermée.

Les quatre acquisitions de novembre ont ensuite été ouvertes individuellement :

| Date | Acquisition | RGB dans l’emprise du contour | Surface NDVI claire |
| --- | --- | ---: | ---: |
| 8 novembre | S2B_T31NDH_20261108T101936_L2A | 255 pixels | 0 % |
| 13 novembre | S2C_T31NCH_20261113T102642_L2A | 255 pixels | 0 % |
| 15 novembre | S2A_T31NCH_20261115T102900_L2A | 255 pixels | 0 % |
| 18 novembre | S2B_T31NDH_20261118T102434_L2A | 255 pixels | 0 % |

Le navigateur confirme l’affichage des quatre images datées. Le défaut
reproduit dans l’interface est un message d’erreur « Image Sentinel-2
indisponible » lorsque le NDVI n’a aucun pixel clair. La lecture du masque
avait pourtant réussi : il s’agit d’une acquisition opaque, pas d’une panne.

Le complément remplace cet échec apparent par un état « Acquisition chargée ·
sol masqué », permet d’ouvrir directement les couleurs naturelles et le masque,
et empêche un indicateur de chargement persistant lorsqu’aucun raster NDVI
n’est demandé. Dans l’autre vue Images & indices, le résultat vide du NDVI
est également un état mesuré, sans exception ni faux pixel. Les vraies pannes
de transport continuent de produire une erreur et une option de rechargement.

Un cas de contrôle a été créé dans une démonstration isolée pour vérifier le
parcours après rechargement de l’application. Il porte un semis explicitement
indicatif ; il ne confirme ni la culture ni la conduite réelle de ce champ.
