# Authentification autonome Cloudflare Access

La version autonome n’utilise plus les en-têtes d’identité de ChatGPT Sites. Le nom historique `getChatGPTUser()` demeure uniquement un alias interne pour préserver les contrats métier; il lit un contexte serveur, alimenté par le Worker après vérification de Cloudflare Access.

## Chemin de confiance

1. L’accueil et la démonstration restent accessibles sans compte. Les routes métier vérifient une identité Cloudflare Access avant d’ouvrir un espace réel.
2. Le Worker lit `Cf-Access-Jwt-Assertion`, ou le cookie `CF_Authorization` pour la connexion optionnelle du site public, puis vérifie RS256, la signature, `iss`, `aud`, `iat` et `exp`. Le domaine des clés est contraint à un domaine d’équipe HTTPS `*.cloudflareaccess.com`.
3. Les clés JWKS sont chargées depuis le domaine d’équipe et conservées par le cache JOSE, qui permet la rotation des clés; elles ne sont pas copiées dans le dépôt.
4. Les en-têtes visiteurs `oai-authenticated-user-*` et `x-agri-*` sont supprimés. Aucun en-tête utilisateur n’est une preuve d’identité.
5. Une identité humaine exige un sujet et une adresse email dans les claims signés. Si `email_verified` est présent et faux, l’identité est refusée. Pour que toute personne puisse s’inscrire par e-mail, activez One-time PIN comme méthode de connexion et utilisez une règle Allow qui inclut les méthodes One-time PIN sans filtre de domaine ni liste d’adresses. Cette règle permet à toute adresse e-mail valide de recevoir un code.
6. L’identifiant applicatif est `cf:<sub>`. L’identité est transmise par `AsyncLocalStorage`, jamais réinterprétée à partir d’un en-tête envoyé par le navigateur.
7. Les API appliquent ensuite les rôles et le périmètre de coopérative déjà existants.

Une configuration absente répond 503; un jeton absent ou invalide répond 401. Le Worker ne passe pas en mode public lorsqu’Access manque.

## Variables

- `CF_ACCESS_TEAM_DOMAIN` : domaine HTTPS de l’équipe, par exemple `https://mon-equipe.cloudflareaccess.com`.
- `CF_ACCESS_AUD` : audience exacte de l’application Access.
- `ADMIN_EMAILS` : liste des emails autorisés comme administrateurs techniques, séparés par une virgule. Les emails doivent provenir des claims signés. Ne pas autoriser tous les emails dans cette variable.
- `ADMIN_USER_IDS` : alternative explicite par identifiant `cf:<sub>`.

Le lien « Se connecter par e-mail » ouvre la page de connexion Access. Lors de la première connexion vérifiée, la première lecture de l’espace crée automatiquement un compte responsable et un espace personnel séparé, identifié par le `sub` signé. Aucun compte Cloudflare n’est exigé si One-time PIN est activé. Les campagnes et autres données restent associées à cet espace. Les rattachements à plusieurs coopératives sont conservés dans `account_cooperatives`; changer d’espace ne déplace ni ne supprime ses données. Accepter une invitation ajoute l’espace reçu au compte et l’ouvre; les rôles restent propres à chaque coopérative. Les invitations métier n’élargissent pas la politique Access. Ne pas configurer de politique Access `Bypass` sur les routes métier.

Le bouton de connexion ne modifie pas la politique Cloudflare. Avec une règle limitée à des adresses ou à un fournisseur, seules les identités déjà autorisées par Access peuvent ouvrir un espace réel. L’ouverture à tous les e-mails demande le réglage One-time PIN décrit au point 5 et doit être décidée dans le tableau Cloudflare séparément.

Les vraies connexions restent gérées par Cloudflare Access; l’application ne conserve pas de mot de passe. Un ancien cookie de démonstration ne peut pas masquer une identité Access valide : il est expiré dès qu’une requête authentifiée revient, et une identité réelle ne peut pas ouvrir un espace de démonstration.

## Démonstration locale

`AUTH_DEMO_ONLY=true` permet une identité nulle uniquement sur `localhost`, `127.0.0.1` ou `::1`, pour les routes de l’interface et des API connues. Ce mode n’est pas une connexion administrateur : seuls les espaces fictifs obtenus via `/api/demo` peuvent fonctionner. Les invitations réelles restent impossibles sans identité vérifiée. Sur un domaine public, ce drapeau n’autorise aucun contournement.

Le point d’entrée public `GET /api/auth/login` ne fait qu’émettre une redirection Access, avec un retour relatif validé. La déconnexion Access utilise le chemin géré par Cloudflare `/cdn-cgi/access/logout`.

## Vérification automatisée et service de santé

La CI peut utiliser un service token Access. Un JWT Access valide sans identité humaine est accepté exclusivement pour `GET /api/health`, avec un contexte utilisateur nul. Il ne crée aucun compte et ne permet pas de lire ou modifier une coopérative. Un test de santé réussi ne remplace pas un test utilisateur réel.

Les tests `tests/cloudflare-access.test.ts` génèrent une paire RSA locale et des JWT signés, sans contacter Cloudflare. Ils couvrent les signatures du header et du cookie, les retours de connexion, signature altérée, mauvais émetteur/audience, expiration, faux en-têtes, configuration manquante, mode local, service token et isolation concurrente du contexte. Ils ne prouvent pas que la politique Access du compte distant est correctement configurée; vérifiez la règle Allow et One-time PIN dans le tableau Cloudflare.
