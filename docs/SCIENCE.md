# AgriPrévision Togo : méthode et provenance scientifique

## Référence principale retenue

L’application prolonge l’expérience principale du notebook **`memoire_togo_v24_integral_2016_2027.ipynb`**, retrouvé et examiné pendant la réalisation. Cette version contient 383 cellules et des résultats réellement exécutés. Sa partie principale fixe l’origine des prévisions à **2015**, pour les années cibles **2016 à 2027**. Les sorties des cellules 82, 87, 114 et 119 attestent le volume de prévisions, les cohortes d’évaluation et les limites de l’analyse.

Le fichier initialement joint, `memoire_togo_v22_complet_execute.ipynb`, fournit un instantané embarqué des mêmes sources brutes et une expérience historique différente. Il a servi à vérifier et récupérer les sources, sans être confondu avec la méthode principale v24. Le fichier `final_forecasts_status.csv` retrouvé séparément comporte 468 lignes et correspond à une exécution antérieure : il n’a pas été intégré comme résultat actuel.

## Réexécution fidèle et concordance

Les exports CSV principaux de la v24 n’étaient pas disponibles dans les fichiers retrouvés. Le code exact des cellules 75, 78, 81 et 86 a donc été réexécuté avec ses paramètres existants, sans modifier la méthode, la sélection des candidats ou leurs hyperparamètres. Les versions utilisées concordent avec celles du notebook : NumPy 2.3.5, pandas 2.2.3 et scikit-learn 1.8.0.

Les 302 fichiers de l’instantané source ont été contrôlés par taille et SHA-256. L’empreinte de l’archive est `47c87676a0dc1ae57d3c9da627930e47b43f4e2547ccdd3d66eeea450ed6c3c5`. La reconstruction exacte du panel produit 2 014 observations, en accord avec les sorties des deux notebooks. Le modèle principal ne consomme que les cultures admissibles et les observations antérieures ou égales à 2015.

Le fichier **`predictions_2016_2027.csv`** reproduit possède le SHA-256 :

```
aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d
```

Cette empreinte est **identique à celle imprimée dans la cellule 87 du notebook v24 exécuté**. Il s’agit donc d’une concordance octet à octet de l’export des 1 092 prévisions, incluant ses valeurs, les modèles sélectionnés et les identifiants de filiation. L’évaluation est exécutée ensuite et vérifie que le fichier de prévisions reste inchangé.

Une première orchestration avait omis les alias de métadonnées nationales de la cellule 79 et produisait une empreinte différente. Elle a été rejetée avant intégration. L’orchestration corrigée, identique au notebook, a obtenu l’empreinte attendue en environ 53 secondes, puis l’évaluation complète en environ 55 secondes. Ces résultats sont consignés dans `reproduction-status.json` et `evaluation_audit.json`. Le temps concerne cette réexécution scientifique dans cet environnement, pas une mesure des performances de l’interface.

La consultation web ne lance ni le notebook ni un entraînement. Elle lit le bundle gelé construit à partir des CSV vérifiés. La réexécution de préparation est une reproduction des entraînements existants, et non la création d’un nouveau modèle.

## Couverture des prévisions

| Culture | Séries nationales | Séries préfectorales historiques | Prévisions sur douze années |
|---|---:|---:|---:|
| Maïs (`Maize`) | 1 | 34 | 420 |
| Mil (`Millet`) | 1 | 12 | 156 |
| Riz (`Rice`) | 1 | 12 | 156 |
| Sorgho (`Sorghum`) | 1 | 29 | 360 |
| **Total** | **4** | **87** | **1 092** |

Les prévisions nationales sont calculées directement. Elles ne sont pas la moyenne simple, ni une agrégation par des superficies non vérifiées, des prévisions préfectorales. Une prévision nationale n’est pas une prévision parcellaire validée.

Les préfectures doivent disposer d’au moins cinq observations historiques admissibles avant 2016. Une culture absente d’un territoire reste sans prévision ; son absence ne vaut pas zéro. Les unités sont celles de la grille historique de 35 préfectures. Cette grille n’est pas une certification des limites administratives actuelles.

Le bundle de l’application comprend également 2 116 observations avec provenance : 1 539 observations préfectorales HarvestStat utilisées dans l’historique des quatre cultures avant 2016, 140 observations nationales FAOSTAT avant/après l’origine et 437 valeurs FEWS disponibles comme diagnostics. Une présence dans le bundle ne rend pas une observation admissible à un score.

## Sélection et modèles réellement utilisés

La sélection s’effectue par culture, niveau géographique et horizon, sur les seules campagnes antérieures ou égales à 2015. Le protocole impose les cohortes communes, une MAE moyennée d’abord par campagne et un seuil de stabilité de 5 % par rapport à la moyenne des cinq dernières observations. Ce seuil est une convention du protocole, pas un test de significativité statistique. Les horizons ne disposant pas des campagnes suffisantes conservent les replis documentés.

| Culture | Modèles nationaux effectivement sélectionnés selon l’horizon |
|---|---|
| Maïs | dernière observation, moyenne de cinq observations, Ridge sur logarithme (α = 10) |
| Mil | moyenne de cinq observations, Ridge sur logarithme (α = 10) |
| Riz | dernière observation, moyenne historique, moyenne de cinq observations |
| Sorgho | tendance logarithmique amortie, dernière observation, tendance logarithmique régularisée, moyenne de cinq observations |

Les modèles préfectoraux sont aussi conservés exactement dans les CSV : ils comprennent les références simples, les rétrécissements territoriaux et, selon la culture/horizon, Random Forest ou Ridge. Le champ `model` de chaque prévision est son estimateur effectif. `selectionStatus`, `selectionCampaigns`, `trainingInputSha256`, `nationalInputSha256` et `sourceLineage` rendent sa provenance consultable. Le fichier `forecast_model_selection.json` conserve les décisions et paramètres complets.

Le modèle peut changer selon l’horizon. Une rupture de trajectoire ne démontre donc pas automatiquement une variation agronomique attendue. Aucun résultat postérieur à 2015 ne réactualise ces prévisions. L’année cible, l’horizon et l’origine 2015 doivent rester visibles.

La date de génération de l’application est la date de reproduction des exports. Elle ne transforme pas ces résultats en prévisions actualisées. Les statistiques utilisées sont des versions révisées ; les publications réellement disponibles en 2015 ne sont pas archivées. La méthode n’est ni un nouveau test aveugle ni une reconstitution certaine des publications de l’époque.

## Observations et comparaisons admissibles

L’évaluation principale contient **28 paires nationales**, soit sept campagnes **2016–2022** pour quatre cultures, issues des statistiques FAOSTAT de statut **A**. Les huit valeurs nationales de statut **X/E** pour 2023–2024 sont conservées comme diagnostics séparés. Les champs `compatibleForMetrics` et `evaluationScope` du bundle distinguent ces catégories.

**Aucune paire préfectorale postérieure à 2015 n’est admise aux scores principaux.** Les correspondances entre les unités géographiques historiques et les observations ultérieures ne sont pas établies. L’interface doit afficher un état explicite lorsque le filtre préfectoral ne permet aucun calcul d’erreur, sans lui substituer un score national.

Pour les paires compatibles retenues par les filtres :

- erreur signée = prévision − observation ;
- erreur absolue = |prévision − observation| ;
- MAE = moyenne des erreurs absolues ;
- RMSE = racine de la moyenne des carrés des erreurs ;
- biais = moyenne des erreurs signées.

L’effectif et la période évaluée accompagnent les indicateurs. Un dénominateur nul ne peut être utilisé dans une erreur relative. Le notebook exclut également les rendements inférieurs à 0,1 t/ha des erreurs relatives ; les effectifs exclus sont documentés dans ses exports. Une moyenne d’erreurs par ligne n’est pas automatiquement la MAE macro par campagne du protocole de sélection.

Les résultats nationaux de la synthèse v24, sur sept campagnes par culture, sont descriptifs : MAE environ 0,0348 t/ha pour le maïs, 0,2044 pour le mil, 0,1774 pour le riz et 0,0258 pour le sorgho. Les valeurs exactes sont dans `model_comparison.csv`. Une faible erreur de niveau sur une série peu variable ne démontre pas la capacité à prévoir ses fluctuations : la v24 documente aussi les faibles corrélations et les R² descriptifs négatifs.

## Correspondance avec les six fonctionnalités

| Fonction | Résultats du mémoire réutilisés | Données ou calculs métier ajoutés |
|---|---|---|
| Consulter les prévisions | 1 092 valeurs v24 vérifiées, modèle effectif, origine, horizon et provenance | Filtres et présentation |
| Comparer les campagnes | Historique, 28 paires nationales principales et diagnostics identifiés | Métriques de la sélection de paires compatibles |
| Simuler un volume | Identifiant et valeur d’une prévision gelée | Superficie, variantes et poids du sac saisis par l’utilisateur |
| Organiser la collecte | Simulation retenue si applicable | Membres, engagements, créneaux, points et capacités |
| Enregistrer une récolte | Aucune réestimation scientifique automatique | Déclaration ou mesure communautaire, superficie récoltée, provenance et validation |
| Fiche de campagne | Prévisions effectivement utilisées et leurs limites | Synthèse séparée des simulations, déclarations, engagements, collectes et récoltes |

Les données fictives de coopérative servent uniquement à démontrer les parcours métier. Elles ne remplacent aucune prévision scientifique. Les nouvelles récoltes communautaires ne sont automatiquement ni des statistiques officielles, ni des données d’entraînement, ni une mise à jour des scores du mémoire.

## Superficies, scénarios et conversions

Le calcul dérivé est : `production simulée (t) = rendement (t/ha) × superficie (ha)`.

La portée de ce calcul dépend de la définition de superficie du rendement source. Les superficies HarvestStat sont déclarées et la distinction semée/récoltée reste non résolue. Les observations FEWS disponibles sont liées à une superficie semée. Le rendement national FAOSTAT conserve sa définition propre. Utiliser un rendement territorial avec une superficie récoltée locale est une hypothèse explicite de simulation ; ce n’est pas une prédiction de parcelle validée. Modifier uniquement la superficie ne prédit aucune modification du rendement.

Les scénarios bas, central et haut sont définis par l’utilisateur. Ils ne sont pas des intervalles de confiance. Aucun intervalle prédictif nominal n’est établi par la v24 aux horizons présentés. Les bandes de désaccord entre candidats restent une sensibilité aux modèles.

Une tonne vaut 1 000 kg. Le nombre équivalent de sacs est `masse en kg / poids du sac en kg`, avec ce poids affiché. Un arrondi au supérieur pour le conditionnement doit être distingué du nombre équivalent non arrondi.

Un rendement communautaire observé est `quantité normalisée en tonnes / superficie effectivement récoltée en hectares`. L’agrégation de récoltes compatibles est `somme des productions / somme des superficies`, jamais une moyenne simple de rendements. Les cultures, campagnes et définitions de superficies doivent être compatibles.

Prévisions, simulations, déclarations, engagements et collectes sont des catégories distinctes. Elles ne s’additionnent pas pour former un total général de récolte, car une même récolte traverse plusieurs étapes.

## Reproduction et fichiers livrés

- `scripts/reproduce-v24.py` : vérification de l’instantané v22, extraction et réexécution des modules v24 exacts, contrôle obligatoire du SHA attendu avant évaluation.
- `scripts/integrate-v24.py` : import des CSV vérifiés dans les deux bundles JSON de l’application, sans réentraînement.
- `science-source/v24/` : modules exacts de la méthode principale, notamment construction du panel, sources officielles, origine fixe et évaluation.
- `science-source/v24-results/` : exports gelés principaux, filiation et preuves de reproduction.
- `public/scientific/` : mêmes exports scientifiques consultables depuis l’application privée.
- `lib/scientific-data.json` et `public/scientific-data.json` : copies identiques du bundle consommé par l’application.
- `scripts/extract-notebook.py` : outil historique v22, conservé pour audit ; il ne doit pas remplacer le bundle principal v24 lors d’un lancement normal.

Les notebooks originaux restent les entrées requises pour réexécuter la préparation. Aucune consultation de l’application ne nécessite leur présence. Les comptes utilisateurs, les données personnelles et les données de récolte ne sont pas placés dans les exports scientifiques publics du site.

## Limites restantes pour la soutenance

- Le supplément INSEED 2020–2024 n’était pas disponible lors de cette reproduction. Ses diagnostics complémentaires sont absents ; il n’entre ni dans l’apprentissage ni dans les 28 paires principales. Cette omission ne modifie pas l’export de prévisions, dont le SHA est identique.
- Les frontières préfectorales après 2015 ne sont pas validées. La carte historique ne prouve pas une précision locale actuelle.
- Les archives de publication disponibles en 2015 manquent. Les évaluations restent rétrospectives sur statistiques révisées et déjà consultées.
- Aucun intervalle nominal calibré, aucun gain universel et aucune validation opérationnelle ne sont revendiqués. Les performances du mil et des références simples doivent rester discutées.
- Les traitements GEE et SPAM ne sont pas une source de covariables validées de cette expérience.
- Les observations compatibles 2025–2026 ne sont pas disponibles et 2027 reste une projection.
- Une campagne indépendante, des correspondances géographiques contrôlées et une évaluation terrain restent nécessaires avant un usage décisionnel réel.
- Aucun rendement prévu ne permet, seul, de déduire une causalité, une recommandation agronomique ou un diagnostic d’insécurité alimentaire.
