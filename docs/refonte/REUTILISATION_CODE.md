# Réutilisation du code

| Élément | Décision et motif |
|---|---|
| `science-source/v24/`, résultats v24 | Conserver comme référence historique ; modules contrôlés identiques et CSV reproduit sans modifier le protocole. |
| Sources v22 | Réutiliser l'instantané vérifié pour la reproduction ; ne pas reprendre les anciennes archives dans le notebook saisonnier. |
| Notebooks autonomes pays | Conserver leurs sources et configurations ; extraire les données utiles avec `audit-seasonal-inputs.py`. Ne pas importer leurs moyennes finales comme modèle saisonnier. |
| `lib/seasonal/engine.ts` | Moteur hydrique partagé API/UI/notebook ; aucune deuxième implémentation Python des calculs. |
| `catalog.ts`, `chemistry.ts`, `nutrition.ts` | Fiches sourcées et quantités conditionnelles. Pas de fonction locale sol–rendement calibrée. |
| `capabilities.ts` | États distincts calculés à partir de l'audit et des fonctions actives. Même registre dans les trois interfaces. |
| `validation.ts` | Contrôles d'unités, méthodes, dates de mesure et disponibilité. Interdire un résultat d'analyse indisponible à la date du conseil. |
| API et D1 | Conserver authentification, périmètres, révisions et recalcul serveur. Les analyses/références utilisent les instantanés JSON existants ; pas de migration supplémentaire. |
| `irrigation.py` | Pont Python vers Node ; orchestration seulement. |
| Extraction GEE historique | Conserver comme proposition archivée ; absence d'authentification et d'extraction actuelle, donc aucune covariable acquise par cette voie dans cette reprise. |

Le notebook saisonnier contient dix cellules de code, dont des exemples explicitement fictifs pour le bilan hydrique/chimique. La cellule de couverture utilise les effectifs réellement audités. Aucun ZIP/base64 ni raster n'est intégré. Les anciens notebooks et leurs sorties sauvegardées ne sont pas renommés comme de nouvelles expériences.
