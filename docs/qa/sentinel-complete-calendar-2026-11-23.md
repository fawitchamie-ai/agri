# Calendrier Sentinel-2 complet et dates qualifiées

Ce contrôle prolonge celui de `sentinel-parcel-coverage-2026-11-23.md`.
Les limites de 36 dates recherchées, quatre tuiles comparées et douze cartes
archivées décrites dans ce premier rapport sont remplacées par les règles
ci-dessous. Le contour privé et les fichiers raster restent hors du dépôt.

## Causes du 14 octobre absent de la liste

La recherche s'arrêtait à la première image couvrant 80 % du champ : le
29 octobre masquait ainsi le 14 octobre. Le catalogue découvert restait dans
l'état temporaire de l'interface ; seules les douze dernières cartes chargées,
y compris les dates nuageuses, survivaient à l'enregistrement. Une collection
C1 non vide empêchait également de vérifier les autres collections. Enfin,
les pages STAC courtes avec un lien `next` n'étaient pas toujours épuisées.

## Comportement corrigé

- Interrogation des collections C1 et harmonisées de Digital Earth Africa et
  Earth Search, puis comparaison au calendrier officiel Copernicus Data Space.
  Aucun filtre de nébulosité globale ou de plateforme Sentinel-2 A/B/C.
- Pagination jusqu'à épuisement, même après une page courte. Les liens restent
  sur l'endpoint d'origine et ne peuvent modifier ni l'emprise ni la période.
  Sans curseur sûr, découpage de la période ; une saturation non résolue
  produit une erreur explicite, jamais un catalogue annoncé complet.
- Vérification de toutes les dates de la période, sans arrêt à la première
  image claire. Comparaison du masque local de chaque acquisition distincte,
  y compris au-delà de la quatrième tuile ; les miroirs d'une même capture
  servent de transports de secours. Une seule acquisition est retenue par date.
- Lecture SCL avant les réflectances. Une date sous 80 % ne télécharge pas
  inutilement les bandes NDVI. Le masque conserve ses classes 4/5 ; aucun
  nuage, ombre, plan d'eau ou pixel incertain n'est promu en pixel clair.
- Le sélecteur de dates et la galerie quotidienne proposent seulement les
  observations ayant au moins 80 % de surface NDVI native, 80 % de grille
  qualifiée et douze cellules. Le détail des acquisitions conserve les
  exclusions, lectures en erreur et bandes indisponibles.
- Calendrier compact sérialisé avec la campagne : les dates qualifiées restent
  visibles après rechargement, même hors du cache de 48 grilles détaillées.
  Une grille évincée est relue à la demande. Reprise des lectures interrompues,
  réutilisation des résultats vérifiés et empreinte du catalogue pour détecter
  une acquisition nouvelle ou modifiée.
- La collecte NDVI/EVI du cycle vérifie aussi toutes les dates, au lieu d'un
  échantillon de six, dans le navigateur avec progression et annulation.
  Les appels serveur conservés pour compatibilité restent bornés explicitement.

Une recherche couvre au maximum 366 jours d'écart, avec des plafonds de
ressources provoquant un diagnostic explicite si nécessaire. « Complet »
signifie que la période demandée a été parcourue. Les pannes des sources et
l'indisponibilité du contrôle officiel restent indiquées ; elles ne permettent
pas de garantir l'intégralité des acquisitions de la mission mondiale.

## Vérification sur les données réelles

Le 23 novembre 2026, le catalogue officiel et les deux collections Earth Search
exposent chacun 34 scènes sur 16 dates entre le 1er octobre et le 23 novembre.
Les deux endpoints DE Africa répondent 403 depuis l'environnement de contrôle ;
ces échecs figurent dans les avertissements. La date du 23 novembre a été
ingérée depuis le contrôle précédent (qui comptait 32 scènes sur 15 dates).

Toutes les seize dates ont été examinées sur le contour de 1,439379 ha. Quatre
franchissent les seuils, sans échec de lecture des bandes :

| Date | Acquisition publique retenue | Surface NDVI native | Grille qualifiée | Cellules | NDVI moyen de grille |
| --- | --- | ---: | ---: | ---: | ---: |
| 4 octobre 2026 | S2C_T31NDH_20261004T102619_L2A | 89,6350 % | 86,1541 % | 42 | 0,362520 |
| 14 octobre 2026 | S2C_T31NCH_20261014T101926_L2A | 100 % | 100 % | 51 | 0,623936 |
| 29 octobre 2026 | S2B_T31NDH_20261029T102145_L2A | 91,2490 % | 93,7643 % | 47 | 0,401636 |
| 23 novembre 2026 | S2C_T31NCH_20261123T101801_L2A | 99,9524 % | 100 % | 51 | 0,568964 |

Les douze autres dates sont écartées : 6, 9, 16, 19, 24 et 26 octobre ; 3, 5,
8, 13, 15 et 18 novembre. Le 24 octobre offre 4,85 % de sol clair ; les onze
autres offrent 0 % selon le masque SCL sur ce contour. Elles ne deviennent
pas des options de la carte NDVI. Les acquisitions RGB au-dessus des nuages
ne constituent toujours pas des observations du sol.

Le 14 octobre, les tuiles voisines NCH et NDH offrent toutes deux une couverture
complète. Le choix NCH dans ce contrôle explique le léger écart de moyenne
avec le précédent rapport (NDH). Les valeurs ne sont pas mélangées entre tuiles.

## Tests de non-régression

Tests dédiés : pagination courte et répétée, conservation de la requête,
complémentarité C1/harmonisé/officiel, refus de radiométrie non certifiée,
cinquième acquisition, poursuite après une première image claire, reprise et
invalidation du cache, calendrier sans grille, rejet des dates sous 80 %,
sérialisation des révisions avec isolation des comptes, affichage partagé et
consentement préalable. TypeScript, compilation, suite de tests et intégration
HTTP sont contrôlés avant publication : 519 tests exécutés, 517 réussis,
deux tests externes ignorés, aucun échec ; intégration HTTP 14/14,
régressions finales 5/5, vérification des types et compilation réussies.

Reproduction du contrôle réel et des quatre couches natives, avec vérification
du commit effectivement déployé :

```sh
node --use-env-proxy --experimental-transform-types scripts/verify-field-coverage.mjs \
  --live /chemin/prive/contour.json 2026-10-01 2026-11-23 /chemin/prive/rapport.json COMMIT_DEPLOYE
```

Le script utilise une session isolée, la ferme et ne modifie aucune campagne.
