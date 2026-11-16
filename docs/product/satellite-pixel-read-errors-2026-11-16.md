# Lecture satellite : erreurs de pixels et relais authentifié

Le retour utilisateur contient quatorze dates trouvées, mais six échecs de lecture
« Request failed » et aucune observation archivée. Cela ne démontre pas six dates
nuageuses : les pixels n’ont pas été lus. La bibliothèque GeoTIFF remplaçait la
cause réseau/HTTP par une erreur agrégée contenant des blocs absents.

## Corrections

- Le lecteur conserve la cause réelle de la requête et la restitue lorsqu’un
  échec de blocs était masqué par « Request failed ».
- Dans le navigateur, un accès Sentinel-2 direct refusé ou interrompu peut être
  repris via `/api/seasonal?satellite=raster`. Le relais conserve la vérification
  de session existante ; les visites anonymes n’obtiennent aucun accès supplémentaire.
- Le relais ne décode pas les TIFF : il transmet une seule plage d’octets bornée
  à 4 Mo, provenant uniquement des buckets et bandes Sentinel-2 autorisés. Aucun
  cookie ou jeton utilisateur n’est envoyé au fournisseur. Redirections, plages
  incohérentes, réponses tronquées et hôtes arbitraires sont refusés.
- La lecture et le calcul restent côté navigateur, sans remettre les historiques
  complets dans le Worker limité en CPU.
- La recherche distingue les acquisitions lues sans surface analysable, les
  échecs de lecture et les résultats mixtes. Une panne ne devient plus un message
  affirmant que toutes les images sont insuffisamment claires.
- Le délai de chaque requête de catalogue reste applicable lorsqu’un signal
  d’annulation global est fourni ; le signal global ne supprime plus ce délai.

## Vérifications

- 487 tests réussis, deux ignorés ; intégration 14/14 ; régressions 5/5.
- TypeScript, compilation et ESLint ciblé des nouveaux modules réussis.
- TIFF généré réellement décodé après une panne d’accès direct injectée.
- Relais HTTP : contrôle de session, allowlist, absence de transmission des
  credentials, contrôle des plages et refus des corps incomplets.
- Test réel sur un contour technique public de 0,681041 ha au Togo : acquisition
  Sentinel-2 du 15 novembre 2026, accès direct volontairement mis en échec, puis
  lecture de vrais octets via le code du relais. Trois échecs directs injectés,
  neuf requêtes relayées, 25 cellules analysables, couverture 100 %, NDVI moyen
  pondéré 0,445017. Aucun défaut de lecture restant dans ce rejeu.
- Résultat compact : `docs/qa/satellite-byte-relay-2026-11-16.json`.

Ce contour public sert uniquement au contrôle technique. La géométrie de la
parcelle privée signalée n’a pas été fournie ; son résultat ne peut pas être
déduit de ce contrôle. La session HTTP du relais est testée séparément dans le
véritable gestionnaire de route. Aucune campagne privée n’est modifiée.
