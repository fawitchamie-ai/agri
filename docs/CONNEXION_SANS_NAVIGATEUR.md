# Continuer sans navigateur distant

La connexion Google ne suffit pas si le retour Cloudflare ne termine pas dans le navigateur distant. La pipeline peut s’authentifier directement avec un jeton Cloudflare conservé dans les secrets GitHub, sans exposer sa valeur au chat.

1. Dans votre navigateur personnel, ouvrir Cloudflare → profil → API Tokens → Create Token. Utiliser le modèle Edit Cloudflare Workers et ajouter Account / D1 / Edit. Limiter les ressources au seul compte du projet. Le modèle Workers doit couvrir les opérations Worker et son sous-domaine workers.dev. Ne pas activer un abonnement payant.
2. Dans GitHub `fawitchamie-ai/agri` → Settings → Secrets and variables → Actions → New repository secret, ajouter `CLOUDFLARE_API_TOKEN`. Coller uniquement le jeton dans le champ Secret. Ne pas le communiquer dans le chat.
3. Ajouter de la même manière `CLOUDFLARE_ACCOUNT_ID`, l’identifiant du compte Cloudflare à 32 caractères hexadécimaux, et non une adresse email ni un Zone ID.
4. Dans Actions, choisir **Préparer la base Cloudflare** puis **Run workflow**, branche `main`. Le script retrouve la base nommée `agriprevision-db` ou la crée si absente. Il ne supprime rien et n’applique pas les migrations. Son résumé fournit `CLOUDFLARE_DATABASE_ID`, à enregistrer ensuite comme variable du dépôt.
5. La publication reste désactivée. Cloudflare Access, son domaine d’équipe et son audience doivent encore être configurés selon `AUTH_CLOUDFLARE.md` et `PIPELINE.md`. Les deux secrets seuls ne suffisent pas à publier l’application complète.

Ce workflow peut être relancé : une base existante est conservée. Les erreurs API ne révèlent ni le jeton ni le corps brut des réponses. Le jeton reste révocable dans Cloudflare. Aucun export de données métier n’est créé.

Références : [GitHub Actions Cloudflare](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [création D1](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/).
