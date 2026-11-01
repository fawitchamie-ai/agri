# Actualisation environment : erreurs de géométrie — 1 novembre 2026

Signalement : POST `/api/seasonal`, action `environment`, erreur 503 avec référence de requête. La lecture des campagnes n’échoue pas. Le contour complet du signalement n’était pas fourni et les journaux historiques étaient désactivés : la référence donnée ne peut pas être reliée avec certitude à une exception antérieure depuis cet environnement.

## Défauts reproduits

Des mosaïques synthétiques de pixels avec un contour oblique provoquaient deux erreurs non interceptées dans l’analyse terrestre :

1. La surface sphérique utilisait une approximation par les extrémités d’un bord. Ajouter des sommets collinéaires lors d’un découpage modifiait la surface calculée. Cela déclenchait la vérification de partition, même avec des classes géométriquement complémentaires.
2. Les intersections répétées du contour avec chaque cellule fabriquaient des fragments presque collinéaires. Le moteur de découpage pouvait dépasser sa pile ou ne pas fermer un anneau de sortie.

Ces erreurs remontaient hors de la collecte des sources et devenaient des 503 génériques. Une indisponibilité météo/sol, elle, était déjà traitée comme une donnée manquante. Le test régional en sources réelles n’a pas reproduit un 503 sur le carré représentatif : terrain et sol ont répondu, tandis que la météo n’était pas disponible dans ce test. Ce test n’est ni le polygone exact de l’utilisateur, ni une vérification authentifiée de la production.

## Correction

- Intégration de `sin(latitude)` le long de chaque segment droit en longitude/latitude, avec origine locale et sommation compensée. Rayon terrestre inchangé : 6 371 008,8 m. Méthode `spherical-linear-edges-1`, également utilisée pour les trous et les composantes. Il ne s’agit pas d’une surface cadastrale ou d’un modèle de bords géodésiques.
- Fusion des cellules de chaque classe avant l’intersection finale avec le contour. Les priorités eau permanente, bâti, saisonnalité et qualité restent conservées.
- Moteur décimal `polyclip-ts` 0.16.8 et grille numérique commune de 1e-12 degré, très inférieure à la résolution des sources. Cette grille traite les derniers chiffres numériques des limites partagées, pas l’aptitude agronomique. L’option epsilon du moteur n’est pas utilisée : son test d’orientation emploie une distance au carré.
- Tolérance de réconciliation inchangée : maximum de 0,001 m² et de surface totale × 1e-7. Une incohérence au-delà de cette tolérance n’est pas normalisée artificiellement.
- En dernier recours, une partition non calculable laisse tout le contour explicitement inconnu (`LAND_PARTITION_FAILED`). Les sources acquises restent dans l’audit, sans les présenter comme des classes utilisables. Aucun sol terrestre n’est alors interrogé ni aucune production agricole extrapolée. La météo peut toujours être récupérée. Le cache de cet échec est limité à une minute.
- Les versions enregistrées restent intactes. Les nouvelles analyses par secteurs portent la méthode corrigée et ne réutilisent pas une ancienne analyse de surface pour un nouveau calcul.
- Les autres erreurs imprévues de l’acquisition indiquent une étape contrôlée (`terrain`, `point-sol`, `sol-meteo`) et leur référence. La réponse ne contient pas le détail interne. Les journaux Workers sont activés avec les journaux automatiques d’invocation désactivés ; le code ne journalise pas le corps de la requête.

Références techniques : [polyclip-ts](https://github.com/luizbarboza/polyclip-ts), [incidents connus de l’ancien moteur](https://github.com/mfogel/polygon-clipping/issues), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Vérification

- Rectangle analytique indépendant et invariance de surface après ajout de sommets sur des bords obliques.
- 60 mosaïques déterministes dans les six pays en tests permanents, réconciliation et contrôle des recouvrements ; 250 cas exécutés durant le diagnostic. Les anciens défauts étaient reproductibles dès les cas 2 et 10 du générateur.
- Échec de partition contrôlé : classes inconnues sur tout le contour, sources conservées, aucune terre cultivable inventée.
- Exécution dans workerd des appels `environment` avec contours obliques, mosaïque raster fragmentée, météo et sol synthétiques pour les six pays ; actualisations successives sans 503.
- 174 tests, intégration HTTP, régressions d’autorisations/persistance, typage et compilation. Les tests synthétiques ne sont pas une acquisition réelle ni une validation agricole au champ.

La vérification du parcours connecté après publication reste dépendante des identifiants Cloudflare Access de service ou d’une session humaine autorisée.
