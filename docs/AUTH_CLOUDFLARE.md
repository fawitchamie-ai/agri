# Authentification autonome Cloudflare Access

La version autonome n’utilise plus les en-têtes d’identité de ChatGPT Sites. Le nom historique `getChatGPTUser()` demeure uniquement un alias interne pour préserver les contrats métier; il lit un contexte serveur, alimenté par le Worker après vérification de Cloudflare Access.

## Chemin de confiance

1. Cloudflare Access protège l’adresse complète du Worker, y compris les API et les URL de prévisualisation exposées.
2. Le Worker lit `Cf-Access-Jwt-Assertion` et vérifie RS256, la signature, `iss`, `aud`, `iat` et `exp`. Le domaine des clés est contraint à un domaine d’équipe HTTPS `*.cloudflareaccess.com`.
3. Les clés JWKS sont chargées depuis le domaine d’équipe et conservées par le cache JOSE, qui permet la rotation des clés; elles ne sont pas copiées dans le dépôt.
4. Les en-têtes visiteurs `oai-authenticated-user-*` et `x-agri-*` sont supprimés. Aucun en-tête utilisateur n’est une preuve d’identité.
5. Une identité humaine exige un sujet et une adresse email dans les claims signés. Si `email_verified` est présent et faux, l’identité est refusée. Cloudflare Access vérifie l’identité selon le fournisseur et la politique configurés; l’authentification par code email doit être limitée aux emails autorisés.
6. L’identifiant applicatif est `cf:<sub>`. L’identité est transmise par `AsyncLocalStorage`, jamais réinterprétée à partir d’un en-tête envoyé par le navigateur.
7. Les API appliquent ensuite les rôles et le périmètre de coopérative déjà existants.

Une configuration absente répond 503; un jeton absent ou invalide répond 401. Le Worker ne passe pas en mode public lorsqu’Access manque.

## Variables

- `CF_ACCESS_TEAM_DOMAIN` : domaine HTTPS de l’équipe, par exemple `https://mon-equipe.cloudflareaccess.com`.
- `CF_ACCESS_AUD` : audience exacte de l’application Access.
- `ADMIN_EMAILS` : liste des emails autorisés comme administrateurs techniques, séparés par une virgule. Les emails doivent provenir des claims signés. Ne pas autoriser tous les emails dans cette variable.
- `ADMIN_USER_IDS` : alternative explicite par identifiant `cf:<sub>`.

Un utilisateur authentifié sans rôle existant reçoit son espace personnel responsable, isolé des autres. Les invitations métier n’élargissent pas la politique Access : la personne invitée doit d’abord être autorisée dans Access. Ne pas configurer de politique Access `Bypass` sur les routes métier.

## Démonstration locale

`AUTH_DEMO_ONLY=true` permet une identité nulle uniquement sur `localhost`, `127.0.0.1` ou `::1`, pour les routes de l’interface et des API connues. Ce mode n’est pas une connexion administrateur : seuls les espaces fictifs obtenus via `/api/demo` peuvent fonctionner. Les invitations réelles restent impossibles sans identité vérifiée. Sur un domaine public, ce drapeau n’autorise aucun contournement.

Sur l’hébergement protégé, le bouton « Utiliser mon compte connecté » supprime le cookie de sélection de démonstration par une requête DELETE de même origine, puis recharge l’espace réel de l’identité Access. Il ne déconnecte pas Access. La déconnexion Access utilise le chemin géré par Cloudflare `/cdn-cgi/access/logout`.

## Vérification automatisée et service de santé

La CI peut utiliser un service token Access. Un JWT Access valide sans identité humaine est accepté exclusivement pour `GET /api/health`, avec un contexte utilisateur nul. Il ne crée aucun compte et ne permet pas de lire ou modifier une coopérative. Un test de santé réussi ne remplace pas un test utilisateur réel.

Les tests `tests/cloudflare-access.test.ts` génèrent une paire RSA locale et des JWT signés, sans contacter Cloudflare. Ils couvrent signature altérée, mauvais émetteur/audience, expiration, faux en-têtes, configuration manquante, mode local, service token et isolation concurrente du contexte. Ils ne prouvent pas que la politique Access du compte distant est correctement configurée; cette politique doit être contrôlée avant l’ouverture du site.
