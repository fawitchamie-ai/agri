# Dossier reproductible de correction — 2026-11-10

Rapport : `docs/science/simulation-audit-2026-11-10.md`.

- `before.json.gz` / `after.json.gz` : instantanés complets, entrées et forçage de reconstruction (aucune importation de carnet réel).
- `*-summary.json` : mêmes métriques/sorties sans les entrées répétées.
- `input-inventory.csv` : valeurs, unités, sources, statuts et manques par essai.
- `sources.json`, métadonnées éditeurs et fichiers Ina/Sékou : acquisitions publiques et empreintes.
- `nasa-power-20171216-20180405.json` : réponse NASA figée.
- `software-before.log` / `software-after.log` : régressions ciblées.
- `DELIVERY.md` : preuves finales de version/publication et contrôles réalisables.

## Mise à jour Sékou — 2026-11-12

Une clarification de l’autrice du jeu de données précise que `Freshweight_cob` est la masse fraîche des épis après retrait des spathes. Ce n’est ni la masse de grains seuls ni un rendement en grain sec. Les valeurs manquantes restent manquantes.

Cette variable peut servir à documenter une analyse exploratoire des mesures de serre. Dans `Yield parameters`, une clé composite plausible (climat × bloc × répétition × traitement) se répète pour 13 combinaisons, avec des mesures qui diffèrent. L’autrice n’a pas confirmé le sens de ces répétitions. Une ligne n’a pas d’étiquette de fertilisant. Aucune ligne n’est fusionnée ou supprimée ; les moyennes du script sont uniquement descriptives par enregistrement. L’essai n’est donc pas utilisé pour calibrer ou valider un rendement sec en t/ha.

L’autrice indique aussi que les données climatiques expérimentales sont déposées sur Zenodo. Le message ne fournit pas de DOI ou de fichier précis ; aucun fichier compagnon n’a été identifié ni acquis. Le classeur public téléchargé ne contient pas de série climatique journalière. Tant que la référence exacte n’est pas retrouvée, la météo de l’essai reste manquante.

Citation du jeu et de l’article : Tahi et al. (2025), *PLOS ONE*, DOI `10.1371/journal.pone.0318121`, et Tahi et al. (2024), dépôt Zenodo `10.5281/zenodo.14357601`. L’usage de recherche est permis sous réserve de ces citations. Les coordonnées et le contenu privé du courriel ne sont pas archivés dans le dépôt.

Les deux livrables nommés dans la demande initiale ne sont pas retrouvés ; ce dossier est une nouvelle reconstitution explicite. Ne pas présenter les moyennes d'un seul essai comme une validation indépendante. Aucune donnée attendue sur demande n'est déclarée acquise.
