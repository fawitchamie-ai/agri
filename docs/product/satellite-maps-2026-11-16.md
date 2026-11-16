# Cartes satellite : observations réelles et chargement

## Corrections

La recherche précédente pouvait se limiter au jour du semis. Elle chargeait une
liste de dates, sans vérifier puis afficher une acquisition exploitable. Les
vues RGB/SCL dépendaient aussi d’un WMS qui renvoyait HTTP 403 pendant ce contrôle.
Un PNG reçu ne démontrait pas la présence de pixels du champ.

- Une campagne récente propose 90 jours de recul. Une campagne terminée reste
  sur sa propre saison ; les exemples utilisent leurs acquisitions archivées.
- Après autorisation et « Chercher les dates », le navigateur lit jusqu’à six
  acquisitions, de la plus récente à la plus ancienne. Une image demande au
  moins douze cellules et 60 % de surface analysable. Une date nuageuse reste
  archivée ; elle ne remplace pas la dernière observation exploitable.
- Le NDVI utilise une palette explicite rouge–jaune–vert. Le contraste propre à
  l’image est proposé par défaut ; l’échelle fixe −1 à 1 reste disponible pour
  comparer les valeurs. Un champ homogène conserve une couleur homogène.
- RGB et SCL sont lus dans les COG Sentinel-2 publics, via les catalogues
  radiométriquement qualifiés, sans dépendre du WMS. Le RGB utilise les bandes
  natives rouge, verte et bleue à 10 m : étirement fixe de réflectance 0–0,3 et
  gamma 2,2 uniquement pour l’affichage. La SCL à 20 m garde les nuages visibles.
- « Observer mon champ » utilise aussi les pixels natifs pour RGB, NDVI et SCL.
  Les anomalies mensuelles restent un service distinct : une erreur du fournisseur
  est affichée, sans fabriquer de couche de remplacement.
- Aucune nouvelle transmission du contour n’a lieu avant le consentement.
  Les requêtes obsolètes sont annulées ; les images partielles/vides sont explicites.

## Exemples accessibles

**Mes campagnes → Voir des cartes avec de vraies images → Togo 2024, Togo 2025,
Bénin 2024**. Le NDVI archivé s’affiche sans nouvelle requête satellite ; le RGB
et la classification demandent l’autorisation de chargement.

Ces carrés techniques publics ne représentent pas des limites agricoles
vérifiées. Culture, semis, conduite et récolte ne sont pas confirmés. Les exemples
ne contiennent aucun cycle agronomique, pluie synthétique ou rendement inventé.
Ils ne modifient pas les campagnes enregistrées. Ils n’activent aucune projection
historique expérimentale, y compris le candidat mentionné dans le rapport fourni.

| Exemple | Acquisition | NDVI moyen de grille | Surface analysable |
| --- | --- | ---: | ---: |
| Togo 2024 | 14 octobre 2024 | absent : nuages | 0 % |
| Togo 2024 | 19 octobre 2024 | 0,534792 | 100 % |
| Togo 2024 | 29 octobre 2024 | 0,506434 | 100 % |
| Togo 2025 | 21 octobre 2025 | 0,559579 | 100 % |
| Togo 2025 | 31 octobre 2025 | 0,522921 | 100 % |
| Bénin 2024 | 19 octobre 2024 | 0,773374 | 100 % |
| Bénin 2024 | 29 octobre 2024 | 0,742913 | 100 % |

La moyenne pondère les médianes de cellules par leur surface. Les 132 cellules
d’un même contour ne sont pas des observations agricoles indépendantes.

## Preuves reproductibles

- Acquisition des exemples :
  `node --use-env-proxy --experimental-transform-types scripts/acquire-satellite-map-examples.mjs`.
- Valeurs et identifiants de scènes :
  `docs/qa/satellite-map-examples-2026-11-16.json` et
  `public/examples/satellite-maps.json`.
- Le contrôle du chargement automatique a rejeté le 29 octobre 2025 (aucune
  cellule claire), puis chargé le 21 octobre 2025 (100 %, NDVI 0,559579), sans
  intervention pour choisir la deuxième date. Résultat :
  `docs/qa/satellite-automatic-loading-2026-11-16.json`.
- Le RGB du 19 octobre 2024 sur l’emprise [1,199 ; 9,399 ; 1,203 ; 9,403]
  contient 2 025 pixels natifs lus et 1 689 couleurs distinctes après étirement.
  La SCL compte 529 pixels lus et deux classes sur cette emprise.
- Les tests couvrent le repli après nuages/erreurs, l’annulation, les six essais
  maximum, les offsets C1, l’absence de pixels, la conservation des nuages en
  SCL, le consentement par contour et l’ouverture des trois exemples dans les
  vrais composants React.

Validation locale : 479 tests réussis, deux ignorés (dont le rendu Chromium
indisponible localement) ; intégration 14/14 ; régressions 5/5 ; TypeScript et
compilation réussis. ESLint ciblé des nouveaux modules réussi. Le test React
vérifie les trois exemples, sans sauvegarde ni requête satellite automatique.

Les contrôles visuels et l’identité de la version de production sont à consigner
après publication. Les tests de données ne remplacent pas un contrôle d’affichage.
