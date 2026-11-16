# Contrôle du relais publié et cache des rasters

La PR #86 rétablit un repli authentifié et distingue les pannes des nuages.
Son déploiement `4bdfd764` affiche dans le navigateur une observation réelle du
15 novembre 2026 sur le contour public de 4,879 ha utilisé par les exemples.
NDVI moyen : 0,436 ; couverture : 100 %. La capture
`satellite-novembre-2026-browser.jpg` conserve la date effectivement chargée.
Le titre « Togo 2024 » désigne l'exemple ouvert ; cette observation a ensuite été
chargée manuellement pour 2026 sur le même contour. Aucune culture n'est confirmée.

Un test distinct force l'accès direct à échouer sur un contour public de
0,681041 ha. Il utilise une session de démonstration isolée et le véritable
endpoint HTTPS publié. La session est fermée après le test. Aucun contour privé,
récolte ou jeton n'est enregistré dans les preuves.

## Défaut encore observé après la PR #86

- Les en-têtes et certaines plages de données du raster sont bien relayés en 206.
- Pour `S2A_T31PBL_20261115T101908_L2A/B08.tif`, la plage
  `116195328-117768191` répond directement en 206 : 1 572 864 octets, environ 6,5 s.
- Le même accès via le relais expire après environ 30 s, avec une erreur explicite.
  Une plage réduite à 65 536 octets à cette position expire également : découper
  artificiellement les lectures n'est donc pas une correction démontrée.

## Complément

Le `fetch` source utilise `cache: 'no-store'` afin de demander la plage à
l'origine sans remplissage ni réutilisation du cache intermédiaire. C'est une
hypothèse opérationnelle à contrôler avec le raster qui échouait, pas une preuve
que le cache causait tous les échecs du champ utilisateur. Les contrôles de
session, d'hôte, de bande, de taille et de Content-Range restent appliqués.

Documentation fournisseur consultée :
https://developers.cloudflare.com/workers/examples/cache-using-fetch/
https://developers.cloudflare.com/workers/reference/how-the-cache-works/

Validation locale du complément : 16 tests ciblés réussis, dont lecture TIFF,
repli après panne directe et gestionnaire HTTP avec contrôle de session.
Le rejeu complet sur le déploiement suivant doit confirmer la lecture des trois
bandes et de l'observation entière avant de conclure sur le relais.

## Résultats sur `6ec97a775`

Le NDVI complet est reproduit via le véritable relais publié : 25 cellules,
100 % de couverture, moyenne 0,4450165590844608, identique à la lecture directe.
Les neuf plages HTTP de ce contrôle répondent en 206. Le résultat est conservé
dans `satellite-relay-production-ndvi-2026-11-16.json`.

Le premier contrôle RGB est interrompu par le proxy réseau de l'environnement
de test. Un rejeu ciblé retrouve ensuite de véritables délais côté fournisseur
sur la bande B03 : il reste en échec et est archivé dans
`satellite-relay-production-visuals-before-resilience-2026-11-16.json`.
Le cache désactivé seul ne garantit donc pas les autres vues.

## Reprise bornée du même objet public

Le relais demande des octets sans compression HTTP, s'arrête dès que la plage
annoncée est entièrement reçue et annule le flux sans attendre une fin de
connexion éventuellement bloquée. Un test de flux contenant tous les octets,
mais ne produisant jamais EOF, vérifie ce comportement.

Une interruption transitoire peut être reprise une fois sur l'adresse S3
régionale du même bucket et de la même clé. L'URL est construite seulement après
la validation des quatre buckets autorisés ; aucune adresse libre n'est acceptée.
La première tentative dispose de 12 s et le délai total reste limité à 30 s.
Un refus HTTP 403 ou une redirection ne déclenche aucune reprise. Le relais
continue à refuser les plages incohérentes et les octets manquants.

La plage B03 `107610112-109117439` du cas en échec est obtenue via les deux styles
d'adresse AWS : même réponse 206, 1 507 328 octets, même SHA-256
`d4f58f20230e35be83a05077ef500c055e75d8c05aedf10330e02801dd385614`.
Documentation officielle des deux adresses du même objet :
https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html

Le probe `scripts/verify-satellite-relay-production.mjs` impose le commit attendu,
un lancement explicite `--live`, une géométrie technique publique et une session
de démonstration isolée. Il enregistre chaque couche réussie avant de passer à
la suivante et conserve les échecs HTTP récupérés dans les preuves.
