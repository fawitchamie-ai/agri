# API saisonnière : ressources et diagnostic

L'erreur Cloudflare 1102 signale une limite CPU ou mémoire. Les journaux
« Worker exceeded CPU time limit » précisent le cas CPU. Un HTTP 400 reste une
validation d'entrée et un HTTP 502 peut provenir d'un fournisseur : ces causes
ne doivent pas être confondues.

## Corrections

- `/api/seasonal` est servi directement après vérification Cloudflare Access,
  dans le même contexte d'identité, sans passer par le routeur de pages React.
- Les analyses des contours inférieurs à 100 ha sont conservées dans D1,
  dans `land_jobs` (lignes complètes de zéro secteur), par propriétaire,
  coopérative, géométrie et version des sources. Réutilisation 30 minutes ;
  échec de partition ou WorldCover manquant : 60 secondes. Les résultats trop
  volumineux pour la marge D1 restent utilisables sans stockage partiel.
- `land`, `environment`, simulation et sauvegarde partagent cette acquisition.
  Les grandes parcelles conservent leur préparation durable par secteurs.
  Le rapport envoyé par le navigateur n'est jamais une preuve serveur.
- L'interface attend le rapport de terrain avant sa première simulation. Elle
  valide les champs avant une requête automatique et conserve les mêmes
  contrôles obligatoires côté serveur. Une relance explicite réactualise le
  terrain des petites parcelles ; pas de boucle automatique après un 1102.
- Satellite et service de calcul utilisent `redirect:manual`, avec refus
  explicite des 3xx. `redirect:error` était refusé par workerd avant le réseau.
  Les catalogues XML et leur interprétation sont réutilisés dans l'isolate.
- Les logs `seasonal.start` / `seasonal.complete` identifient l'action, un
  `traceId`, le statut et la durée totale (pas le CPU). Ni corps de requête,
  géométrie ni identité n'y sont imprimés. Le `traceId` est renvoyé dans
  `X-Agri-Trace-Id`. La métrique CPU reste celle de Cloudflare.

## Limite qui subsiste

Workers Free autorise **10 ms de CPU par requête**, sans compter l'attente
réseau. Une première lecture/décompression TIFF et une partition exacte de
parcelle peuvent dépasser largement ce budget. Le cache évite la répétition,
mais ne rend pas cette première acquisition compatible avec ce plafond.

Le diagnostic reproductible local est :

```sh
node --experimental-transform-types scripts/profile-seasonal-cpu.mjs
```

Il compare un exemple de saison et une parcelle synthétique fragmentée
d'environ 20 ha (1 680 cellules). Lors de l'enquête du 3 novembre 2026, cette
partition a pris environ **1,8–2,8 secondes de CPU local**. Ce n'est ni une
mesure de la parcelle de l'utilisateur ni une mesure du compteur Cloudflare.
Les tests Miniflare vérifient la logique, l'authentification et les requêtes
réelles du runtime ; ils ne prouvent pas le respect de la limite CPU déployée.

Pour conserver ce traitement exact côté serveur, utiliser un hébergement avec
un budget CPU adapté : Workers Paid (minimum annoncé de 5 USD/mois, usage
supplémentaire facturable, 30 secondes par défaut), ou un service de calcul
externe raccordé et testé. Le service PCSE/WOFOST existant ne remplace pas
automatiquement les fonctions de terrain et de saison.

Aucun abonnement, facturation ou plafond payant n'est changé par ce correctif.
Ne pas ajouter `limits.cpu_ms` comme prétendu contournement de Workers Free.
Si le compte est déjà Paid, vérifier le plafond effectif du Worker `agri` dans
Workers & Pages → agri → Settings → CPU Limits.

Après publication, contrôler avec une identité humaine autorisée : ouverture
d'une parcelle non cachée, acquisition du sol/météo, simulation, sauvegarde,
relecture et trois couches satellite. Inspecter les CPU des actions concernées
dans Cloudflare et les événements 1102. Une compilation ou un health check ne
valide pas ces parcours.

Sources officielles vérifiées le 3 novembre 2026 :

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/
