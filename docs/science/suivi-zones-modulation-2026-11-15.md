# Suivi satellite, zones historiques et cartes de modulation

Le parcours **Suivi du champ** rassemble images datées, séries NDVI/EVI,
zones de vigueur historiques, projection relative conditionnelle, cartes de doses,
météo et carnet de terrain. Il est accessible depuis les résultats de la campagne
et leur onglet de suivi. Le Nigeria rejoint les six pays déjà sélectionnables.

| Fonction | Données et comportement |
|---|---|
| Images et indices | Sentinel-2 L2A, masque nuages/ombres/eau SCL ; médianes NDVI/EVI archivées dans la campagne. Fond photo non daté clairement séparé. |
| Météo | Prévisions Open-Meteo jusqu’à 16 jours, pluie, ET0, températures min/max/moyenne et date de disponibilité ; accès aux observations de la campagne. |
| Carnet | Observations datées, auteur/source, conservation dans les révisions et export du carnet. |
| Historique | Lecture effective des bandes rouge/proche infrarouge et SCL ; fenêtres et cultures confirmables pour chaque saison ; grille commune d’au moins 20 m. |
| Projection relative | Persistance exploratoire du classement de vigueur, seulement si les conditions ci-dessous sont remplies ; aucun rendement absolu ni probabilité de récolte. |
| Modulation | Doses par zone saisies et confirmées avec leur référence ; surfaces, masses et comparaison à une dose uniforme ; exports GeoJSON et CSV. |

## Méthode et données manquantes

Une requête traite une saison de 120 jours au maximum et un secteur de 100 ha au
maximum. Quatre acquisitions sont réparties dans la fenêtre ; jusqu’à deux
acquisitions supplémentaires sont essayées si moins de 60 % du champ dispose de
deux observations. Le traitement client conserve chaque saison reçue et permet
l’arrêt. Aucune recherche n’est lancée sans demande explicite pour le contour.

Collection 1 est privilégiée. Si sa couverture n’existe pas encore, les anciens
COG ne sont acceptés qu’avec métadonnées attestant l’offset BOA déjà appliqué.
La correction n’est jamais appliquée deux fois : Earth Search ancien corrigé,
C1 Earth Search avec scale/offset, C1 DE Africa avec offset en unités DN sont
traités selon leur contrat. Les hôtes et chemins de rasters sont limités aux
catalogues publics autorisés ; aucun téléchargement intégral de TIFF n’est accepté.

Chaque grille est découpée au vrai contour, trous compris. Les pixels natifs
clairs SCL 4/5 sont agrégés sur cette grille. Les cellules opaques restent absentes.
Une date n’est comptée pour une cellule que si au moins 60 % de sa surface est
couverte de pixels natifs clairs. Les empreintes sont intersectées exactement
avec la cellule et le contour ; leur NDVI médian est pondéré par l’aire claire.
Une saison demande deux dates ainsi qualifiées sur au moins 60 % du champ et au moins
12 cellules. Les saisons rejetées restent archivées avec leur raison d’exclusion.
Le noyau commun aux saisons admissibles doit encore couvrir au moins 60 % du champ.

Les rangs NDVI sont calculés à surface pondérée dans ce noyau commun, avec rangs
moyens pour les égalités. Classes relatives : tiers inférieur, milieu, tiers
supérieur. Un contraste P90−P10 inférieur à 0,10 dans la majorité des saisons ne
force pas artificiellement trois classes dans un champ uniforme. L’accord de
classe sur au moins deux tiers des saisons délimite les cellules stables ; les
autres restent variables. Trois années sont nécessaires pour cartographier.

Les années répétées et fenêtres qui se chevauchent sont rejetées. La projection
demande quatre années distinctes, même culture/stade/conduite confirmés,
contour cultivé inchangé, au moins 40 % de surface stable, et un accord spatial
d’au moins 65 % avec la dernière saison réservée. Ce contrôle utilise le noyau
observé commun rétrospectif. Les pixels ne constituent pas des exploitations
indépendantes. Ces seuils sont des **heuristiques versionnées**, sans validation
agronomique de rendement. Ils ne sont pas présentés comme les coefficients de
OneSoil et ne promettent pas de tonnes par hectare ou un horizon de 60 jours.

## Cartes de doses

Une carte historique suffit à préparer un scénario si la surface cultivée est
confirmée. Le produit, l’unité, la référence et les doses de toutes les zones sont
explicites, y compris zones variables ou sans donnée. Une absence de donnée n’est
pas transformée en dose nulle. Le total est la somme dose × surface ; la couleur
de la carte suit les doses effectivement saisies. Les changements de produit,
d’unité ou de valeur annulent la confirmation précédente.

Le sens de modulation, la dose optimale, une carence, un diagnostic sanitaire et
un gain de rendement ne sont pas inférés du NDVI. Une analyse de sol ou un conseil
agronomique peut fournir les doses à représenter. GeoJSON/CSV ne certifie pas la
compatibilité avec un terminal particulier ou une prescription réglementaire.

## Contrôle réel du 15 novembre 2026

Emprise de contrôle technique publique au Togo, sans identité d’exploitation ni
historique cultural connu : 4,879 ha. Cinq fenêtres d’octobre 2021–2025 ont été
lues réellement. 2022 est exclue pour couverture claire insuffisante sur deux
dates. Les quatre autres années couvrent ensemble **100,0 %** du contour sur une
grille de 20 m ; **58,3 %** de la surface garde un classement stable. Accord avec
la dernière saison : **59,2 %**, inférieur au seuil fixé avant ce contrôle.

La carte historique est produite. La projection est **suspendue**, à la fois pour
accord insuffisant et parce que culture, conduite et contour cultivé ne sont pas
confirmés. Aucun résultat n’est réétiqueté comme récolte mesurée. Les observations
locales et récoltes de coopératives restent nécessaires à une validation agronomique.

[Résultat agrégé réel](../qa/field-monitoring-live-2026-11-15.json).
La carte a été chargée dans l’interface réelle et son export GeoJSON téléchargé.
Les essais logiciels vérifient géométries, masques, dates, radiométrie, abstention,
conservation des quantités, sauvegarde des révisions et isolation des comptes.

Rejouer le contrôle public, facultatif et dépendant des services externes :

```bash
node --use-env-proxy --experimental-transform-types scripts/verify-field-monitoring-live.mjs /chemin/prive/hors/depot
```

## Sources

- [Copernicus / Digital Earth Africa Sentinel-2](https://docs.digitalearthafrica.org/en/latest/data_specs/Sentinel-2_Level-2A_specs.html).
- [DE Africa, offsets Collection 1](https://docs.digitalearthafrica.org/en/latest/sandbox/notebooks/Datasets/Sentinel_2.html).
- [Earth Search, catalogue](https://earth-search.aws.element84.com/v1/collections).
- [Element84, BOA offsets](https://github.com/Element84/earth-search/discussions/26).
- [Open-Meteo, prévisions](https://open-meteo.com/en/docs).

L’ajout du Nigeria au suivi ne crée pas une nouvelle archive nationale FAOSTAT :
la santé du service distingue sept pays de suivi et les six pays réellement présents
dans l’archive nationale acquise. Les travaux TAMASA antérieurs restent séparés.
