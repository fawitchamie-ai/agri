# Revue croisée de l’export Cloudflare autonome

Relecture indépendante des auteurs de l’authentification, de la configuration et de la pipeline. Périmètre : worker d’entrée, vérification JWT, contexte d’identité, séparation comptes humains/services, déclencheurs CI/CD et conservation des secrets. Aucun compte Cloudflare réel ni secret GitHub n’a été utilisé pendant cette revue.

## Vérifications exécutées

```bash
node --experimental-strip-types --test tests/cloudflare.review.test.ts
```

**6 tests réussis, aucun échec** :

1. Un en-tête `Host: localhost` ou `X-Forwarded-Host` forgé ne déclenche pas le mode de démonstration sur une URL distante.
2. Les JWT sans signature, utilisant HS256, sans date d’émission ou avec un `nbf` futur sont refusés.
3. Un jeton de service sans identité humaine est limité à `GET /api/health`; science, exports métier et variantes du chemin sont refusés.
4. Le nettoyage des en-têtes conserve le corps JSON et l’origine utilisés par les contrôles CSRF, mais retire les anciennes identités injectables.
5. Une exception asynchrone ne laisse pas d’identité résiduelle dans le contexte serveur.
6. Le job de vérification ne référence pas les secrets; la publication exige `main`, exclut les PR, reste désactivée sans le drapeau explicite et ne peut interrompre une migration en cours. Aucun workflow `pull_request_target` ni upload d’artefact de sauvegarde n’est présent.

Les JWT des tests sont signés par une paire RSA créée localement et vérifiés par le véritable code `jose`. Les appels d’identité réelle et l’exécution Cloudflare distante ne sont pas simulés comme des succès. Ces six tests complètent les tests de l’auteur de l’authentification et les tests de pipeline, sans en remplacer les limites.

## Constats de revue

| Gravité | Preuve ou scénario | État / correction recommandée |
|---|---|---|
| Faible | Le générateur de configuration accepte un domaine comprenant plusieurs labels avant `cloudflareaccess.com`, tandis que le validateur d’exécution impose un seul label. Exemple : `https://foo.bar.cloudflareaccess.com` peut être généré puis refusé au runtime. | Corrigé : le générateur et le validateur d’exécution imposent maintenant le même domaine d’équipe à un label. |
| Faible | En démonstration locale sans identité, `DELETE /api/session` exige une identité humaine; le bouton pour quitter la démo peut alors répondre 401. | Comportement explicite : la route répond 401 avec « La démonstration locale ne dispose pas d’un compte Cloudflare Access. » Aucun accès à des données réelles. |

Aucun blocage de sécurité élevé connu n’a été trouvé dans les scénarios examinés. Ce constat ne vaut pas audit exhaustif.

## Points confirmés par lecture

- L’identité utilisée par les routes métier provient d’un contexte serveur alimenté après vérification du JWT. Les en-têtes visiteurs `oai-authenticated-user-*` et `x-agri-*` ne peuvent pas créer d’identité.
- Les clés Access sont chargées depuis le domaine d’équipe contrôlé et mises en cache. Signature RS256, émetteur, audience, expiration et émission sont vérifiés.
- Les droits d’administrateur par email dépendent de l’email provenant du JWT signé; l’utilisateur ne choisit pas lui-même son rôle.
- L’authentification Access ne remplace pas le contrôle de coopérative : les routes continuent à filtrer et autoriser les enregistrements par coopérative et propriétaire.
- La publication exige la concordance entre la base configurée et la base du build, refuse l’identifiant D1 factice et refuse le mode de démonstration local.
- Le point de restauration D1 est demandé avant les migrations. Son format `result.bookmark` et l’endpoint GET ont été vérifiés dans la [référence API officielle Cloudflare](https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/).
- Le contrôle de santé ne traite ni une redirection de connexion, ni une page HTML, ni l’absence de secrets Access comme un succès. Le statut `SKIPPED` reste explicite si le contrôle distant n’est pas configuré.
- Aucun export SQL contenant les données communautaires n’est déposé dans les artefacts d’un dépôt public.

## Vérifications restant nécessaires

Le dépôt GitHub cible est public. Le 28 octobre 2026, l’accès propriétaire `fawitchamie-ai` a été vérifié avec le droit d’écriture. Cette revue locale ne constitue pas une preuve d’exécution GitHub Actions. La création des ressources sur le compte réel, la connexion Access humaine, le contrôle de santé distant, les quotas gratuits et le parcours complet après publication restent à vérifier avec les accès du propriétaire.

## Nouvelle vérification locale du 28 octobre 2026

`pnpm check`, `pnpm test` (45 tests), `pnpm test:integration` (14 scénarios), `pnpm test:regressions` (5 scénarios) et `pnpm build` ont tous terminé avec un code de sortie 0. Les avertissements de découpage des imports vinext ne bloquent pas la compilation. Aucun déploiement Cloudflare distant n’est revendiqué par ces vérifications.
