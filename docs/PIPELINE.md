# Mises à jour par GitHub Actions

## Ce qui est préparé

Le workflow `.github/workflows/ci.yml` valide les pull requests, les push sur `main` et les lancements manuels. Il exécute TypeScript, les tests scientifiques et métier, les routes avec SQLite/D1 adapté, les dernières régressions d’autorisations, puis la compilation. Il ne réentraîne aucun modèle scientifique et ne remplace aucune prévision du mémoire.

La publication est un second job, après validation, uniquement sur `main` et si `CLOUDFLARE_DEPLOY_ENABLED` vaut exactement `true`. Les pull requests ne reçoivent aucun secret Cloudflare. Le checkout ne conserve pas les identifiants Git et le token GitHub est limité à la lecture du contenu. Un contrôle du SHA courant de `main` arrête les anciennes publications devenues obsolètes.

Le job de publication possède un groupe de concurrence unique avec `cancel-in-progress: false` : un nouveau push n’interrompt pas une migration déjà commencée. Les compilations de vérification et de production utilisent le même fichier de dépendances verrouillé et la même révision du code; la seconde reçoit les identifiants de ressources de production.

## Configuration du dépôt

Dans le dépôt cible, ouvrir **Settings → Secrets and variables → Actions**. Les secrets et variables ci-dessous sont des paramètres du dépôt, pas des fichiers à committer.

| Type | Nom | Contenu |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Jeton Cloudflare limité au compte cible et aux opérations Workers/D1 nécessaires |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Identifiant du compte Cloudflare utilisé pour la publication |
| Secret | `ADMIN_EMAILS` | Emails vérifiés autorisés comme administrateurs, séparés par une virgule; facultatif |
| Variable | `CLOUDFLARE_DATABASE_ID` | UUID réel de la base D1 de production |
| Variable | `CF_ACCESS_TEAM_DOMAIN` | Origine de l’équipe Access, par exemple `https://mon-equipe.cloudflareaccess.com` |
| Variable | `CF_ACCESS_AUD` | Audience de l’application Access protégeant le site |
| Variable | `CLOUDFLARE_DEPLOY_ENABLED` | `true` seulement après configuration du compte, de D1 et d’Access |
| Variable | `APP_URL` | Origine HTTPS réelle retournée par Cloudflare, sans chemin ni paramètres |
| Secret | `CF_ACCESS_CLIENT_ID` | Identifiant d’un token Access de service pour la vérification de santé; facultatif |
| Secret | `CF_ACCESS_CLIENT_SECRET` | Secret correspondant, saisi directement dans GitHub; facultatif |

`ADMIN_EMAILS` est un secret même s’il ne s’agit pas d’un mot de passe : le dépôt peut être public et les logs de la pipeline ne doivent pas exposer ces adresses. Ne jamais coller les jetons Cloudflare ou Access dans le chat, le code, les messages de commit ou les journaux.

Le jeton de déploiement doit autoriser l’édition des scripts Workers et la lecture/écriture D1 sur le compte sélectionné. L’édition D1 couvre la demande du point Time Travel; le script s’arrête avant toute mutation si ce point est refusé. Ne pas utiliser une clé globale. L’identité Access et les jetons de service ne sont pas des jetons d’administration Cloudflare.

Le workflow utilise des secrets de dépôt afin de ne pas dépendre de la disponibilité des secrets d’« environment » sur les différentes offres GitHub. Les protections de branche et les restrictions d’accès au dépôt restent à activer selon les capacités du compte. Ne pas activer une deuxième publication automatique Workers Builds en parallèle de GitHub Actions pour la même branche.

## Ordre d’une publication

1. Vérifier les identifiants : base réelle, absence d’UUID fictif, correspondance des configurations source/compilée et paramètres Access, mode local interdit.
2. Demander un point de restauration D1 Time Travel à Cloudflare. Le jeton passe uniquement dans l’en-tête HTTPS destiné à l’API Cloudflare.
3. Écrire localement un fichier de métadonnées de restauration dans `.cloudflare/predeploy-bookmark.json` (permissions privées). La date UTC préalable aux migrations est indiquée dans le journal et le résumé du job. Aucun contenu métier ni export SQL n’est téléversé en artifact GitHub.
4. Exécuter uniquement les migrations D1 non appliquées. Une erreur arrête immédiatement la publication; aucune suppression ou reconstruction automatique de la base n’est prévue.
5. Publier le build Vite avec sa configuration générée `dist/server/wrangler.json`.
6. Contrôler `/api/health` avec une identité Access de service, si elle est configurée.
7. Effacer les fichiers de configuration et de métadonnées éphémères du runner.

Le point Time Travel est une possibilité de restauration gérée par Cloudflare, pas une copie SQL externe conservée pendant deux mois. La rétention publiée pour Workers Free est de sept jours. La base courante ne disparaît pas après sept jours; cette durée concerne les anciennes versions restaurables. Pour une archive indépendante ou de longue durée, exporter la base depuis un terminal personnel avec `wrangler d1 export ... --remote --output ...` et conserver ce fichier dans un emplacement privé. Ne pas le publier dans ce dépôt ni dans un artifact Actions accessible aux lecteurs du dépôt.

## Portée du contrôle après publication

Le service Access utilisé par la pipeline ne reçoit pas d’identité producteur ou responsable. Le Worker limite son usage au **GET `/api/health`**. Le script vérifie : réponse HTTP positive sans redirection, type JSON, statut du runtime, accès à D1, nombre de prévisions intégrées (1 092), empreinte du notebook v24 et empreinte du CSV de référence.

Ce contrôle ne crée pas de récolte et ne simule pas la connexion d’un utilisateur humain. Il complète les tests d’intégration locaux, sans remplacer un parcours authentifié réel.

- Si les deux secrets Access de service sont absents : le script annonce **SKIPPED**, émet un avertissement et écrit que la santé du déploiement n’a pas été vérifiée automatiquement. Le déploiement peut avoir réussi, mais aucun succès de ce contrôle n’est revendiqué.
- Si un seul secret est présent, si l’URL est invalide, si une redirection ou une page HTML de connexion est retournée, ou si les références scientifiques diffèrent : le contrôle échoue.
- Si tous les contrôles JSON attendus passent : le résultat est **PASS**, limité au runtime, à D1 et au socle scientifique.

Le token de service doit être autorisé dans une politique Access adaptée à ce contrôle. Une politique qui renvoie un token sans email ne doit jamais lui donner accès aux données métier; le Worker vérifie cette séparation.

## Utilisation quotidienne

Créer une branche pour les modifications, ouvrir une pull request et attendre les résultats. Une fusion dans `main` déclenche la publication si le paramètre d’activation est présent. Un lancement manuel sur une autre branche vérifie le code mais ne publie pas en production.

Les migrations doivent être ajoutées, sans réécrire les fichiers déjà appliqués. Privilégier les évolutions compatibles avec la version courante du code. Une migration destructive ou une transformation des données mérite une procédure spécifique; la pipeline ne promet pas de la rendre réversible automatiquement.

## En cas d’échec

- Échec de tests ou compilation : aucune publication ne commence.
- Point Time Travel refusé : aucune migration ni publication n’est exécutée.
- Migration échouée : la publication s’arrête; examiner l’état exact de la base avant reprise.
- Publication échouée après migration : le schéma peut déjà avoir changé. Corriger ou republier un code compatible, sans rejouer les migrations historiques.
- Contrôle de santé échoué : le nouveau Worker peut déjà être publié. Examiner les métriques/logs Cloudflare et la configuration Access avant de décider d’un retour arrière.

Revenir au code précédent ne restaure pas automatiquement la base. Le retour arrière de code doit utiliser une version compatible avec le schéma courant. Une restauration D1 doit être décidée séparément : elle peut supprimer des écritures métier effectuées après le point choisi. La pipeline ne lance jamais une restauration destructrice automatique.

## Vérifications locales réellement exécutées

`node --test tests/deployment.test.mjs` : **8 tests réussis**. Ils vérifient les paramètres de publication, le refus d’une base fictive ou incohérente, l’ordre point de restauration → migration → publication, l’arrêt après échec, le statut SKIPPED en l’absence de secrets, le refus d’une page de connexion/redirect et la concordance JSON du socle v24.

Les appels HTTP Cloudflare et les commandes Wrangler distantes sont remplacés par des fonctions contrôlées dans ces tests. Ils vérifient le comportement des scripts; ils ne constituent ni une exécution GitHub Actions ni une publication sur le compte Cloudflare de l’utilisateur. Ces opérations restent à confirmer après connexion et configuration des accès.

## Références primaires consultées le 28 octobre 2026

- [Cloudflare : GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare : migrations D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare : Time Travel et sauvegardes](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare : API de point Time Travel](https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/)
- [GitHub : version checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), commit épinglé `3d3c42e5aac5ba805825da76410c181273ba90b1`, également référencé dans le workflow officiel d’actions/setup-node.
- [GitHub : setup-node](https://github.com/actions/setup-node/blob/main/README.md), version majeure `v7` documentée.

Wrangler est celui du lockfile du projet; aucune commande CI n’installe une version flottante de Wrangler. pnpm est fixé à 11.25.0. Node utilise la branche majeure 24 avec ses correctifs. La version majeure de setup-node peut recevoir des correctifs; checkout est épinglé par commit complet.
