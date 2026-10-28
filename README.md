# AgriPrévision Togo

Application web du mémoire de Fidèle AWIDAMANOSSI. Elle prolonge le notebook v24 : 1 092 prévisions 2016–2027 reproduites avec le code et les paramètres existants. Le CSV obtenu possède exactement le SHA-256 conservé dans le notebook exécuté. Aucun nouveau modèle n’est inventé; consulter l’application ne relance aucun entraînement.

## Démarrage local

Prérequis : Node.js 24 et pnpm 11.25.0. Les résultats scientifiques gelés sont déjà inclus; Python n’est pas nécessaire pour utiliser l’application.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Sur une nouvelle base locale uniquement, appliquer chaque migration dans l’ordre :

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_worried_zarda.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_married_jetstream.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_illegal_baron_strucker.sql
pnpm start
```

Ouvrir l’URL indiquée par le serveur. Les migrations ne doivent pas être rejouées sur une base où elles sont déjà appliquées. La base persistante se trouve dans `.wrangler/state`. Ne pas supprimer ce dossier pour conserver les saisies. Pour développer : `pnpm dev` après préparation de la base.

La consultation scientifique est accessible sans session. Pour les essais métier, ouvrir l’espace de démonstration : ses coopératives et membres fictifs sont créés par le serveur et séparés des espaces réels. Les rôles de démonstration ne permettent jamais de rejoindre une coopérative réelle.

## Configuration et accès réels

L’hébergement privé utilise l’identité ChatGPT fournie par la plateforme. Un nouveau compte obtient son propre espace responsable; les responsables peuvent générer un code d’invitation ciblé pour un agent ou un producteur. Aucun email n’est envoyé automatiquement. Une invitation expire après sept jours et s’utilise une seule fois. Les agents sont limités à la coopérative attribuée; les producteurs à leurs données. La désignation d’un administrateur technique utilise `ADMIN_USER_IDS`, côté serveur uniquement, suivant `.env.example` (à copier en `.dev.vars` localement si nécessaire).

Le mode local de démonstration fonctionne sans compte externe. Les invitations réelles demandent une identité ChatGPT; elles sont testées avec une identité contrôlée dans les tests d’intégration. Ne pas exposer directement le serveur local sur Internet : l’identité hébergée doit provenir de la passerelle de confiance.

## Six fonctions

1. Prévisions : culture, campagne, échelle, territoire et version; graphique, tableau et provenance.
2. Comparaison : paires compatibles, erreurs, MAE, RMSE, biais, période et effectif.
3. Simulation : rendement × hectares; variantes personnelles, kg, sacs et hypothèses conservées.
4. Collecte : membres, points, créneaux, catégories distinctes, stockage et transport par créneau.
5. Récoltes : saisie par étapes, normalisation, brouillon/soumis/validé et historique.
6. Fiche : bilan filtré, CSV, PDF téléchargé et impression.

## Imports scientifiques

L’administrateur ouvre « Sources et import ». Il charge un CSV en t/ha, examine les erreurs et l’aperçu, puis confirme. Le lot entier est refusé si une ligne est invalide. Les réimportations et doublons de clé sont signalés; une nouvelle version est ajoutée sans remplacer les snapshots utilisés dans les simulations. Le rapport identifie les lignes rejetées. Un export réel sert de modèle et se réimporte sans perte de précision.

Colonnes : `crop,year,territory,level,yield,model,version,issuedAt,status,source,areaDefinition`. La colonne `id` d’un export est facultative. Niveaux : `national`, `region`, `prefecture_historique` (alias français acceptés). Cultures et territoires doivent appartenir au référentiel actuel; leur extension nécessite une mise à jour explicite du référentiel. La date d’émission est au format ISO avec fuseau, ou vide si inconnue.

## Vérifications

```bash
pnpm check
pnpm test
pnpm test:integration
node --experimental-strip-types tests/performance.mjs
```

Les tests d’intégration appellent les véritables routes et migrations avec SQLite sur disque et un adaptateur D1; l’identité ChatGPT est contrôlée. Ils ne simulent pas un test du fournisseur distant. Le rapport détaillé, les corrections et les limites se trouvent dans `docs/REVIEW.md`.

## Documents

- `docs/SCIENCE.md` : sources, méthode, filiation, statut et limites scientifiques.
- `docs/ARCHITECTURE.md` : architecture et calculs.
- `docs/DEMONSTRATION.md` : parcours de soutenance en six étapes.
- `docs/REVIEW.md` : contrôles réellement exécutés et problèmes corrigés.
- `science-source/v24-results/` : CSV vérifiés, protocole, choix des modèles et filiation.
- `scripts/reproduce-v24.py` : reproduction optionnelle depuis les notebooks sources; versions Python exactes requises et contrôlées.

## Limites

Les prévisions sont rétrospectives, à origine fixe 2015; elles ne sont pas actualisées par les récoltes récentes. Seules 28 paires nationales 2016–2022 sont admises aux scores principaux. Les huit diagnostics nationaux 2023–2024 et les observations préfectorales à géographie non vérifiée en sont séparés. Aucune carte opérationnelle n’est ajoutée sans géométries qualifiées. La pièce justificative est une référence ou un lien, sans hébergement de fichiers dans cette version. La saisie reste disponible après une erreur; la synchronisation automatique hors connexion n’est pas implémentée. Une validation agronomique et des tests auprès de vrais utilisateurs restent nécessaires.

Contrôles de non-régression de la revue finale :

```bash
node --experimental-transform-types tests/final-regressions.mjs
```

Ils vérifient les changements de membre refusés, la cohérence d’une récolte liée à une collecte et la conservation des statuts scientifiques dans les CSV. Voir `docs/FINAL_REVIEW.md`.
