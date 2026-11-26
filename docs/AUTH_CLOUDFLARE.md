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

Le lien « Se connecter par e-mail » ouvre la page de connexion Access. À la première connexion vérifiée et autorisée, l’application crée un compte responsable et un espace personnel isolé, identifié par le `sub` signé. Le compte applicatif reste distinct des autres; le sélecteur permet de retrouver les autres espaces sans déplacer ni supprimer leurs campagnes, récoltes ou réglages. Les rattachements à plusieurs coopératives sont conservés dans `account_cooperatives`. Accepter une invitation ajoute l’espace reçu au compte; la personne invitée doit d’abord être autorisée par Access et les rôles restent propres à chaque coopérative. Le bouton ne modifie pas la politique Cloudflare : seules les identités autorisées par la règle actuelle peuvent ouvrir un espace réel. Pour autoriser tous les e-mails, il faut activer One-time PIN et ne pas limiter les adresses dans la règle Allow; cette configuration est distincte et n’est pas modifiée ici. Ne pas configurer de politique Access `Bypass` sur les routes métier.

Les vraies connexions restent gérées par Cloudflare Access; l’application ne conserve pas de mot de passe. Un ancien cookie de démonstration ne peut pas masquer une identité Access valide : il est expiré dès qu’une requête authentifiée revient, et une identité réelle ne peut pas ouvrir un espace de démonstration.

## Démonstration locale

`AUTH_DEMO_ONLY=true` permet une identité nulle uniquement sur `localhost`, `127.0.0.1` ou `::1`, pour les routes de l’interface et des API connues. Ce mode n’est pas une connexion administrateur : seuls les espaces fictifs obtenus via `/api/demo` peuvent fonctionner. Les invitations réelles restent impossibles sans identité vérifiée. Sur un domaine public, ce drapeau n’autorise aucun contournement.

Le lien de connexion ouvre `GET /api/auth/login` sur l’hôte du Worker. Protégez ce chemin dans l’application Access « AgriPrévision Togo » pour que Cloudflare ouvre le formulaire sur le domaine d’équipe et ramène le navigateur sur ce même chemin avec une identité vérifiée. Pour garder l’accueil accessible, configurez le domaine de cette application avec le chemin `/api/auth/login`. Conservez son audience, ses méthodes de connexion et ses règles d’accès. L’option **Cookie path** doit rester désactivée afin que le navigateur transmette aussi le cookie à `/api/seasonal` et `/api/workspace`.

À son retour, le Worker vérifie le JWT et renvoie le navigateur vers « Mes champs » ou vers l’outil demandé. Si Cloudflare laisse arriver une requête sans session sur ce chemin, le Worker affiche une erreur explicite. Pour vérifier le réglage dans une nouvelle session de navigateur, cliquez sur « Se connecter », terminez le parcours par e-mail et vérifiez que les campagnes de votre espace s’affichent. La déconnexion Access utilise le chemin géré par Cloudflare `/cdn-cgi/access/logout`.

## Vérification automatisée et service de santé

La CI peut utiliser un service token Access. Un JWT Access valide sans identité humaine est accepté exclusivement pour `GET /api/health`, avec un contexte utilisateur nul. Il ne crée aucun compte et ne permet pas de lire ou modifier une coopérative. Un test de santé réussi ne remplace pas un test utilisateur réel.

Les tests `tests/cloudflare-access.test.ts` génèrent une paire RSA locale et des JWT signés, sans contacter Cloudflare. Ils couvrent les signatures du header et du cookie, les retours de connexion, signature altérée, mauvais émetteur/audience, expiration, faux en-têtes, configuration manquante, mode local, service token et isolation concurrente du contexte. Ils ne prouvent pas que la politique Access du compte distant est correctement configurée; vérifiez la règle Allow et One-time PIN dans le tableau Cloudflare.

Après `pnpm build`, lancez `pnpm test:access-worker`. Le test exécute le Worker compilé avec D1 local. Il vérifie le retour vers l’outil demandé, l’accès par cookie signé, l’écriture et la relecture d’une campagne, puis le refus de cette même campagne pour un autre compte ou une session expirée.
