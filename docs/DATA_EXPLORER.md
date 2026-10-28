# Explorateur scientifique

L’accueil « Données et recherche » expose les archives scientifiques disponibles, séparées des données communautaires privées. Les 175 jeux regroupent 450 636 lignes, dont les sources brutes, le panel harmonisé, les candidats exclus, les diagnostics et les sorties v24. Aucun résultat scientifique de référence n’est recalculé ni modifié.

Le chargement initial est limité à 500 lignes. Les filtres portent explicitement sur la partition chargée ; le chargement intégral volontaire permet une recherche dans le jeu entier. La pagination visuelle contient 25 lignes. Le détail affiche toutes les colonnes. Les exports filtrés CSV neutralisent les formules de tableur. Le téléchargement GZIP restitue les octets exacts du fichier collecté avec SHA-256 des octets décompressés.

Les archives antérieures restent identifiées comme telles. Les données géographiques non vérifiées et les sorties GEE/SPAM restent diagnostiques. Le supplément INSEED indisponible n’est pas inventé. La section méthodologique décrit les règles de `science-source/v24/build_panel.py`, également téléchargeable.

Reconstruction du catalogue à partir du dossier scientifique conservé :

```bash
python scripts/build-data-catalog.py /chemin/science
```

Le dossier doit contenir `originals/` et `v24-run/results/`. Les assets publiés sont conservés dans Git pour une reconstruction indépendante de ce dossier local. Les tests vérifient les empreintes de tous les originaux, le nombre exact des lignes de toutes les partitions et la conservation des jeux clés.

Validation : TypeScript, tests unitaires et scientifiques, routes SQLite/D1, régressions et compilation Vite. La prévisualisation navigateur est maintenant opérationnelle et les principaux parcours ont été vérifiés. Voir `OBSERVATOIRE_V2.md`.
