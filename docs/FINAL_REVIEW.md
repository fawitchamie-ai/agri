# Revue indépendante finale

Relecture distincte des auteurs de l’application, réalisée sur la version préparée pour publication. Périmètre : autorisations, corrections métier, cohérence des liaisons, provenance scientifique et exports. Aucun test terrain ni authentification ChatGPT réelle n’est revendiqué.

## Constats corrigés avant livraison

| Gravité | Preuve / scénario | Correction contrôlée |
|---|---|---|
| Élevée | Une correction changeant `memberId` conservait l’ancien `owner_id` : le producteur initial pouvait alors voir la récolte attribuée à un autre membre. | Changement de membre refusé pour les récoltes et collectes existantes. Réponses 409, données et propriétaire initiaux conservés. |
| Moyenne | Une récolte liée à une collecte pouvait changer de culture, campagne ou territoire, rendant sa liaison incohérente. | Changement de ces clés refusé tant que la récolte est liée. Trois scénarios exécutés : réponses 409 et clés initiales préservées. |
| Moyenne | Le CSV d’observations omettait les statuts de qualité, rendant un diagnostic FAOSTAT X/E impossible à distinguer après export. | Colonnes de qualité et de filiation réellement disponibles ajoutées. Export Maïs/Togo/2024 contrôlé : statut X et `primaryEvaluation=false` présents. |

## Vérifications exécutées

Commande :

```bash
node --experimental-transform-types tests/final-regressions.mjs
```

**5 scénarios réussis**, résultats conservés dans `tests/final-regression-results.json`. Les tests appellent les véritables routes API avec les migrations et une base SQLite temporaire sur disque, via l’adaptateur D1 déjà documenté. Ils vérifient aussi que le producteur conserve uniquement les données de son membre après une correction refusée.

Contrôle supplémentaire exécuté : deux corrections concurrentes d’une récolte avec le même `updatedAt` ont produit une réponse 200 et une réponse 409 dans ce harnais. Ce contrôle ne garantit pas tous les ordonnancements possibles du service distant.

Les 21 tests purs et les 14 scénarios d’intégration précédents ont été exécutés par le coordinateur avant cette relecture. Le rapport principal reste `docs/REVIEW.md`. Cette revue ne remplace pas les contrôles visuels du navigateur et du PDF, ni la vérification du déploiement privé, conduits séparément.

Aucun blocage élevé connu ne subsiste parmi les scénarios examinés après ces corrections. Les limites scientifiques v24, les géométries non qualifiées, l’absence de synchronisation hors connexion et la validation terrain restent documentées dans `README.md` et `docs/SCIENCE.md`.
