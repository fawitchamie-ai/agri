# AgriPrévision — campagnes, irrigation et rendements

Le parcours « Préparer et suivre ma culture » permet de calculer et suivre un plan d’irrigation conditionnel du semis à la récolte, conserver les observations et leurs révisions, comparer des scénarios et vérifier un bilan d’engrais documenté. Six pays sont configurables ; la validation agronomique locale reste à conduire. Voir [le fonctionnement et les limites du module](docs/IRRIGATION.md) et le [notebook du moteur partagé](science-source/seasonal/planification_saisonniere.ipynb).

## Socle Cloudflare existant

Version indépendante pour le dépôt `fawitchamie-ai/agri`. Le socle agricole reste identique à la version livrée : 1 092 prévisions v24, CSV conforme à l’empreinte du notebook exécuté, six parcours, base persistante et exports PDF/CSV. Aucun entraînement n’est lancé lors du déploiement ou de la consultation.

Cette version remplace la passerelle ChatGPT Sites par **Cloudflare Access**. Le Worker vérifie la signature et les claims du JWT avant d’ouvrir les routes. Elle ne doit pas être déployée sur l’ancien projet Sites.

## Nom du Worker et publication

Le Worker Cloudflare cible est **`agri`**, celui protégé par votre application Access. Le dépôt est `fawitchamie-ai/agri`; le nom du produit reste AgriPrévision Togo. La base conserve son nom `agriprevision-db` et son binding `DB`. `APP_URL` doit contenir l’adresse HTTPS réelle de ce Worker `agri`. L’audience `CF_ACCESS_AUD` doit venir de l’application Access qui protège ce même Worker.

La publication utilise GitHub Actions. Désactiver la publication Git automatique Workers Builds sur ce Worker : un simple `vite build` suivi de `wrangler deploy` utiliserait la configuration de test, avec son UUID factice et ses paramètres Access vides. Le workflow GitHub génère la configuration réelle avant la compilation et applique les migrations avant publication.

## État de préparation

Le code, les migrations et la pipeline sont présents et testables localement. Les valeurs réelles du compte Cloudflare et les secrets GitHub ne sont pas intégrés à l’archive. La publication est désactivée jusqu’à la configuration explicite de `CLOUDFLARE_DEPLOY_ENABLED=true`. Une compilation réussie n’est pas une preuve de connexion au fournisseur.

## Installation et essais locaux

Node.js 24 et pnpm 11.25.0 sont requis. Python 3 et `pypdf` servent uniquement aux tests de contenu du PDF; l’application déployée n’en dépend pas. Depuis ce dossier :

```bash
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
python -m pip install -r tests/requirements.txt
cp .dev.vars.example .dev.vars
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
```

Pour la première base locale seulement, appliquer les migrations une fois chacune :

```bash
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

Ouvrir l’URL localhost affichée. Le mode `AUTH_DEMO_ONLY=true` permet uniquement une identité absente dans le contexte local : on ouvre ensuite un espace métier de démonstration, qui ne donne aucun accès aux espaces réels. Les sessions et données sont conservées dans l’état local Wrangler. `pnpm start` utilise la version compilée et une base locale; après changement de configuration, recompiler.

## Préparer Cloudflare une fois

1. Conserver un compte Workers Free, créer une base D1 nommée `agriprevision-db` et noter son UUID et l’identifiant du compte. Aucune base de la version Sites n’est transférée automatiquement.
2. Préparer une application Cloudflare Access pour l’adresse exacte du Worker; ajouter les adresses des utilisateurs autorisés. Noter le domaine d’équipe (`https://votre-equipe.cloudflareaccess.com`) et l’Application Audience Tag.
3. Configurer GitHub selon le tableau ci-dessous. Le jeton API doit être limité au compte concerné et aux opérations Workers et D1 nécessaires. Ne jamais le coller dans un message, un fichier suivi ou un journal public.
4. Pousser le code sur `main`, vérifier le job `checks`, puis activer `CLOUDFLARE_DEPLOY_ENABLED=true` et lancer manuellement le workflow pour la première publication.
5. Renseigner `APP_URL` avec l’URL réelle obtenue. Vérifier le parcours humain. Pour automatiser le contrôle distant, créer un Access Service Token, autorisé par une politique Access adaptée, et renseigner les deux secrets de service. Ce service ne peut appeler que GET `/api/health`, sans compte humain ni données privées.

| Nom | Emplacement GitHub | Contenu |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret du dépôt | Jeton Cloudflare limité au compte Workers/D1 |
| `CLOUDFLARE_ACCOUNT_ID` | Secret du dépôt | Identifiant du compte |
| `CLOUDFLARE_DATABASE_ID` | Variable du dépôt | UUID réel de la base D1 |
| `CF_ACCESS_TEAM_DOMAIN` | Variable du dépôt | Origine HTTPS de l’équipe Access |
| `CF_ACCESS_AUD` | Variable du dépôt | Audience Access, 64 caractères hexadécimaux |
| `ADMIN_EMAILS` | Secret du dépôt, facultatif | Emails administrateurs séparés par virgules; ils doivent venir du JWT vérifié |
| `APP_URL` | Variable du dépôt | Origine HTTPS de l’application publiée |
| `CF_ACCESS_CLIENT_ID` | Secret facultatif | Identifiant du service de contrôle |
| `CF_ACCESS_CLIENT_SECRET` | Secret facultatif | Secret du service de contrôle |
| `CLOUDFLARE_DEPLOY_ENABLED` | Variable du dépôt | `true` seulement quand la configuration est prête |

La configuration source `wrangler.jsonc` contient un UUID factice pour permettre les builds de test sans compte. `pnpm configure:cloudflare` refuse cet UUID et les paramètres Access manquants, puis génère `.cloudflare/wrangler.json`. Les builds de production prennent cette configuration générée; le script de publication vérifie que l’UUID et les paramètres du build concordent avec le compte cible. La démo distante sans identité est interdite.

## Publication manuelle dans un terminal autorisé

Renseigner les variables réelles dans l’environnement du terminal, sans modifier les fichiers suivis, puis :

```bash
pnpm exec wrangler login
pnpm configure:cloudflare
pnpm build
pnpm deploy:cloudflare
```

Le script automatique requiert `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` pour obtenir un point de restauration avant les migrations. La connexion interactive seule ne suffit pas pour ce script. Les secrets doivent être saisis dans le terminal ou le gestionnaire de secrets, sans passer par le chat.

## Mises à jour et retour arrière

Le workflow `.github/workflows/ci.yml` vérifie types, tests, référence scientifique et compilation sur chaque proposition. Sur `main`, la publication activée effectue une nouvelle compilation avec les vrais paramètres, vérifie un point de restauration D1, applique uniquement les migrations en attente, publie et tente le contrôle de santé. Les déploiements sont sérialisés et un commit dépassé est refusé. Aucune donnée D1 n’est exportée dans les artifacts publics GitHub.

Les migrations déjà appliquées sont immuables; ajouter des migrations compatibles plutôt que supprimer des colonnes utilisées par la version précédente. Revenir au code précédent ne restaure pas la base. Time Travel couvre la période de rétention du fournisseur, pas deux mois complets d’archives; conserver séparément des exports privés réguliers si cette durée est nécessaire.

```bash
pnpm exec wrangler d1 export agriprevision-db --remote --config .cloudflare/wrangler.json --output sauvegarde-privee.sql
```

Ne jamais commiter ou publier la sauvegarde. Les enregistrements communautaires contiennent des données de membres. Désactiver Workers Builds si GitHub Actions assure déjà la publication, pour éviter deux pipelines concurrents.

## Vérifications et limites

Voir `docs/CLOUDFLARE_REVIEW.md`, `docs/AUTH_CLOUDFLARE.md`, `docs/PIPELINE.md` et `docs/SCIENCE.md`. Les tests SQL utilisent de véritables routes et migrations avec SQLite local adapté à D1; les tests JWT vérifient de vraies signatures avec des clés de test. Ces tests ne prouvent pas une authentification réelle dans votre compte Cloudflare. Les résultats restent exploratoires et rétrospectifs à origine 2015. Une qualification des limites CPU du forfait gratuit sur le service distant et une vérification humaine finale sont nécessaires. Carte opérationnelle, téléversement de justificatifs et synchronisation hors ligne automatique ne sont pas inclus.
