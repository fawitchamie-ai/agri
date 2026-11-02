# Correction grands contours, couches terre/eau et images satellite

## Régression corrigée

Les appels de simulation et plusieurs panneaux demandaient un terrain autoritatif avant que le traitement manuel des grands contours soit terminé. Le serveur répondait 409 « Analyse par secteurs requise », puis les modifications de paramètres déclenchaient d’autres appels incompatibles avec cet état.

Le serveur crée maintenant un traitement idempotent et renvoie une préparation normale HTTP 202. Le client partage un seul exécuteur pour un même traitement appartenant à un utilisateur. Chaque requête HTTP garde sa propre limite de temps ; le traitement complet peut dépasser cette durée. Les consommateurs attendent la fin de tous les secteurs avant de reprendre automatiquement leur calcul. L’annulation d’un panneau ne coupe pas le travail attendu par un autre panneau. Une pause ou une erreur d’acquisition conserve les secteurs déjà traités. Les traitements de l’ancienne version dont la méthode de surface reste compatible sont repris avec leur progression. Les conflits réels de révision restent des 409. Les géométries détaillées des classes de terrain ne sont plus renvoyées inutilement dans chaque requête de calcul : le serveur recharge son résultat autoritatif, ce qui évite de saturer la taille des requêtes pour un grand champ.

L’analyse de terrain démarre indépendamment de la présence d’un cycle cultural. La carte et la synthèse récupèrent donc les classes terre/eau même si les paramètres d’une culture restent incomplets. Les exports de calendrier relisent la révision enregistrée sans déclencher implicitement un nouveau calcul de terrain.

## Affichage et fonctions

- Classes rétablies sur la carte interactive et dans la synthèse : terre potentielle, eau permanente, eau saisonnière, zone humide, bâti/incompatible et inconnu.
- Géométries, trous, composantes et surfaces du moteur conservés. Aucun inconnu n’est coloré comme une terre connue.
- Accès directs aux semences et à l’eau, aux doses et produits d’engrais, à la comparaison des dates de semis, aux paramètres du sol et à l’export de campagne.
- Le planificateur des produits et doses est directement visible dans Engrais. Les fonctions d’arrosage restent dans Eau et semis.

## Images réelles

Les services publics WMS et STAC Digital Earth Africa sont raccordés. Le catalogue et une image sur une large emprise publique de l’Afrique de l’Ouest ont été vérifiés. Les tests applicatifs emploient des données synthétiques, sans coordonnées privées.

| Vue | Donnée | Résolution nominale | Précaution |
| --- | --- | --- | --- |
| Satellite | Sentinel-2 L2A, couleurs naturelles | 10 m | Date publiée et couverture locale à vérifier |
| Vigueur | NDVI Sentinel-2 | 10 m | Indice de couvert, pas un diagnostic nutritif |
| Stress possible | Anomalie NDVI mensuelle DE Africa | 30 m | Écart à la référence historique, cause non déterminée |
| Nuages / eau | Classification SCL Sentinel-2 | 20 m | Nuages, ombres et pixels mixtes ; ne remplace pas la visite du champ |
| Qualité mensuelle | Nombre d’observations claires | 30 m | Contexte de disponibilité de la synthèse mensuelle |

Un clic explicite indique au visiteur que l’emprise de la parcelle sera transmise au fournisseur. Les données de compte, notes et récoltes ne sont pas envoyées. Le catalogue STAC propose des dates de scènes intersectant cette emprise ; seules les dates également publiées par le WMS sont proposées pour les vues journalières. Le pourcentage de nuages décrit la scène entière. Les vues mensuelles indiquent leur mois et n’affichent pas une précision quotidienne.

Les images sont récupérées par une route authentifiée, depuis un fournisseur fixe et avec une emprise et une taille bornées. Le serveur vérifie le format PNG. Le service WMS 1.3 est appelé en EPSG:4326 avec son ordre latitude/longitude ; le contour GeoJSON reste en longitude/latitude. Le contour exact est superposé à l’image ; les pixels transparents restent inconnus et une image vide sur le contour est signalée. Les légendes proviennent du fournisseur. Ces vues n’appliquent aucun coefficient de rendement ni aucune dose automatique d’engrais.

Sources :
- https://ows.digitalearth.africa/wms?service=WMS&request=GetCapabilities
- https://docs.digitalearthafrica.org/en/latest/data_specs/Sentinel-2_Level-2A_specs.html
- https://docs.digitalearthafrica.org/en/latest/data_specs/NDVI_Anomaly_specs.html
- https://explorer.digitalearth.africa/stac/
