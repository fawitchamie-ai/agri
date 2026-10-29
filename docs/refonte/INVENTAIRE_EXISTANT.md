# Inventaire de reprise — 29 octobre 2026

Les six notebooks historiques ont été ouverts et leurs empreintes recalculées. L'audit ne les exécute pas ; les compteurs et erreurs sauvegardés sont conservés dans `INVENTAIRE_FICHIERS.json`, avec les tailles et empreintes de tous les membres des quatre archives pays. Les cellules encodées ne sont pas affichées dans les rapports.

| Source inspectée | Cellules | Code avec compteur enregistré | Nouvelle opération |
|---|---:|---:|---|
| Togo v22 joint | 66 | 35 | Instantané utilisé par la reproduction v24 |
| Togo v24, version actuelle retrouvée | 383 | 151 | Reproduction du protocole à origine 2015 |
| Bénin autonome | 37 | 17 | Audit et extraction contrôlée des sources utiles |
| Burkina Faso autonome | 36 | 17 | Même opération |
| Ghana autonome | 36 | 17 | Même opération |
| Sénégal autonome | 37 | 17 | Même opération |
| Côte d'Ivoire | — | — | Aucun notebook de rendement acquis |

La reproduction Togo a exécuté les modules historiques identiques à ceux extraits de v24 : **1 092 prévisions**, empreinte CSV `aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d`, identique à la référence. Durée de cette reproduction : 49,373 s. Numpy 2.3.5, pandas 2.2.3, scikit-learn 1.8.0. Le complément INSEED est absent de cette reprise et n'intervient pas dans l'ajustement ni les scores principaux. Le pic mémoire de cette reproduction séparée n'a pas été mesuré.

La reconstruction des quatre panels applique les cultures configurées, les drapeaux qualité, valeurs positives, cohérence production/surface/rendement, doublons et présence des identifiants de limites. Elle conserve les systèmes et saisons d'origine : `none` n'est pas renommé « pluvial ». Les références temporelles des publications et frontières actuelles ne sont pas validées par cette reconstruction.

| Pays | Observations retenues | Territoires observés | Dernière année retenue |
|---|---:|---:|---:|
| Togo | 2 014 | 34 préfectures historiques | 2019 |
| Bénin | 11 412 | 77 communes | 2023 |
| Burkina Faso | 9 313 | 45 provinces historiques | 2023 |
| Ghana | 1 025 | 16 régions harmonisées | 2022 |
| Sénégal | 9 317 | 43 départements historiques | 2015 |

Ces effectifs concernent les cultures retenues par chaque chaîne et ne constituent pas une couverture de toutes les cultures du catalogue. Le nom technique Togo `prefecture_modele_35` n'implique pas 35 territoires effectivement observés. Le Sénégal comporte 45 géométries mais 43 territoires observés retenus. `COUVERTURE_DONNEES.csv` détaille culture, système, saison et support ; ses lignes Togo gardent saison/système non spécifiés dans cette synthèse.

Les quatre archives pays ont été vérifiées intégralement en flux borné. Seuls HarvestStat, FAOSTAT, limites, configurations et document de sources sont externalisés. Les gros exports FEWS sont vérifiés mais ni chargés dans pandas ni recopiés. L'audit complet a pris 1,803 s, pic RSS 170,92 Mio pour le processus d'audit sous Linux ; ces chiffres excluent la reproduction v24, le navigateur et le moteur Node. Le premier lancement d'audit a échoué sur un nom de colonne Togo ; le rapport livré provient de la relance corrigée, sans réutiliser ce rapport incomplet.

La plateforme provient de `fawitchamie-ai/agri`. La PR #1 est fusionnée dans `main` au commit `9c16fc5751b524ff96c78c9a81f7375c0d33e125`. Le workflow GitHub `40956392933` a terminé avec succès les vérifications et le point de restauration/migrations/publication. Son contrôle de santé a été ignoré faute d’identifiants Access de service, comme vérifié dans les journaux ; le statut du job ne prouve pas une vérification authentifiée. Les ajouts cultures/chimie et le présent audit ont ensuite été intégrés par la PR #2 et publiés par le workflow `40960518624` ; le contrôle de santé de cette publication reste également ignoré. Voir le bilan daté dans `AVANCEMENT.md`.
