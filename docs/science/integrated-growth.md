# Croissance intégrée — modèle de scénario `daily-rue-npk-1`

## Ce qui est livré

Dans **Rendement → Croissance et production journalières**, un profil explicite peut être activé pour simuler quatre conduites : sans irrigation ajoutée et sans engrais prévus ; apports réalisés seulement ; eau et engrais prévus ; même eau, sans engrais prévu. Les quantités réalisées sont conservées. Les variantes de produits de l'onglet Engrais réutilisent ce moteur lorsqu'un profil est actif. La synthèse privilégie alors le rendement intégré, sans le confondre avec le rendement hydrique ou QUEFTS.

Ce moteur JavaScript fonctionne dans le Worker existant, sans nouveau service ni secret. Il est distinct de WOFOST/PCSE (dont le service externe reste disponible séparément), AquaCrop, APSIM et QUEFTS. **Aucun de ces noms ne constitue une validation du modèle livré.** Les anciens calculs sont conservés et les campagnes sans profil ne changent pas de méthode.

Produit pris en charge : grain de maïs, sorgho, mil et riz pluvial, dans un système terrestre drainé, sur une unité homogène. Les six pays peuvent exécuter des scénarios explicites ; **aucun pays ni cultivar n'est déclaré calibré**. Rizière submergée, nappe proche, salinité renseignée, cultures associées et produits frais/tubercules sont refusés. Aucun rendement de remplacement n'est créé lorsque les entrées sont incomplètes.

## Équations et conventions

Pour chaque jour `d` :

1. Le bilan hydrique existant fournit ETa et ETm et tient compte des horizons, réserve initiale, rétention, infiltration, pluie, racines et irrigation, avec les quotas/efficacités existants.
2. La fraction de rayonnement intercepté est interpolée entre les bornes déclarées de chaque stade. Une observation NDVI/EVI compatible peut remplacer cette fraction selon la transformation linéaire déclarée. Aucun pixel de carte n'est assimilé implicitement.
3. `fT` est une réponse trapézoïdale déclarée entre quatre températures. `fW = (ETa/ETm)^s`, où `s` est la sensibilité déclarée du stade. Si ETm est nulle, `fW = 1`. ETa inclut l'évaporation : ce proxy n'est pas un modèle détaillé de transpiration.
4. `ΔBpot = rayonnement global [MJ/m²/j] × fraction interceptée × RUE [g/MJ] × 10 × fT × fW` donne des kg de matière sèche aérienne/ha/j. Le facteur 10 convertit g/m² en kg/ha. **La RUE porte sur le rayonnement solaire global intercepté, pas sur le PAR**, et sur la biomasse aérienne, pas sur les racines.
5. Les stocks accessibles de N/P/K reçoivent la fourniture de fond quotidienne et les fractions récupérées des engrais minéraux à leur date. Les valeurs N/P/K sont élémentaires ; les conversions P₂O₅/P et K₂O/K sont celles du catalogue serveur.
6. Les produits organiques exigent un profil par produit : fraction accessible et demi-vie, avec source. La fraction libérée du jour d'âge `a` est `fraction × [2^(-a/H) − 2^(-(a+1)/H)]`. Cette cinétique est une hypothèse déclarée, pas SNOMIN. Une masse sans composition complète ou sans profil bloque le résultat.
7. `fNPK = min(1, stock[k] / besoinPotentiel[k])`. `ΔB = ΔBpot × fNPK`. L'absorption est retirée des stocks avec les besoins déclarés en kg élément/t de biomasse. Les bilans fournis/absorbés/restants et leurs résidus sont exportés ; une masse de nutriments ne peut pas être consommée deux fois.
8. `rendement sec = ΣΔB × indice de récolte`. Le rendement à l'humidité de référence vaut `rendement sec / (1 − humidité/100)`. `production = rendement × superficie/10000`. La surface prévue reste distincte du semis réalisé.

La réponse pH est **facultative et déclarée**, liée à une analyse et sa méthode. Elle limite les fournitures de fond quotidiennes et les fractions récupérées des apports ; elle ne pénalise pas de nouveau les stocks initiaux déjà déclarés accessibles. Le pH seul ne permet pas de déduire cette courbe. Aucun pH optimal EcoCrop n'est converti automatiquement en rendement. Sans courbe, le pH reste un diagnostic, ce que l'interface indique.

Les contraintes d'eau, température et nutriments s'appliquent à la croissance quotidienne. Il n'y a pas de seconde multiplication du rendement final par un facteur Ky ou QUEFTS.

## Paramètres et données

**Toutes les valeurs numériques du formulaire initial sont illustratives**, choisies pour permettre l'examen des mécanismes. Elles ne proviennent pas d'une calibration du maïs, d'une recommandation locale ou d'un cultivar certifié. L'utilisateur doit remplacer/documenter le profil et accepter explicitement ce scénario. Il n'existe pas de précision garantie ou d'intervalle prédictif associé. Les tests synthétiques vérifient le logiciel, pas l'exactitude agronomique.

Les fournitures initiales se rapportent au début du cycle et excluent les apports ajoutés explicitement au calendrier. Les mesures d'azote total, carbone, P extractible ou K échangeable ne sont jamais converties silencieusement en fourniture. La texture intervient via les propriétés hydrauliques disponibles, pas par une pénalité autonome. Les pertes, immobilisations et efficacités sont simplifiées dans les fournitures/récupérations déclarées ; aucun bénéfice structurel automatique du compost n'est calculé.

Pluie/ET0 et météo détaillée sont prises dans la campagne. Sans température moyenne (ou Tmin/Tmax) et rayonnement sur tout le cycle, le résultat reste indisponible, sauf acceptation d'un scénario explicite pour les jours manquants. Les valeurs dont la provenance est marquée manquante ne sont pas utilisées. Un scénario constant n'est pas une prévision saisonnière.

## Satellite

Le profil JSON accepte `satellite` avec `index` (NDVI ou EVI), bornes `bare`/`full`, âge maximal (0–30 j), source et observations `{date, availableOn, value, clearFraction, source}`. Les observations doivent appartenir au cycle, être déjà observées et disponibles à la date du calcul, et avoir une fraction claire ≥ 0,8. Ce seuil est un contrôle logiciel conservateur, pas une certification de qualité. Le fournisseur, masque des cultures, emprise, résolution et relation indice/interception doivent être documentés dans la source ; l'application ne les acquiert ni ne les certifie automatiquement.

Une observation ne remplace le couvert qu'à partir de sa date et jusqu'à son âge maximal. Aucune interpolation depuis une observation future ni prolongation jusqu'à la récolte. Les contrefactuels utilisent le même couvert observé, qui peut déjà refléter des stress passés : **les écarts ne représentent pas un effet causal total**. Ce moteur ne corrige pas rétroactivement la réserve hydrique à partir du NDVI.

## Récoltes passées

Le profil peut contenir `history`, liste de 4 à 500 observations de parcelles, agrégées par site/saison. Chaque observation contient : `id`, `site`, `season`, `split` (`training`/`validation`), `country`, `cropId`, `variety`, `profileId`, `availableOn`, `source`, `biomassDryKgHa`, `observedYieldKgHa`, `moisturePercent`. Le rendement doit être compatible avec le grain et exprimé par hectare initialement semé. `profileId` est affiché par le formulaire et exporté avec les résultats ; il identifie les paramètres de biomasse à l'exclusion de l'indice de récolte ajusté.

L'ajustement actuel porte **uniquement sur l'indice de récolte**, par moindres carrés sans constante : `HI = Σ(B × Ysec) / Σ(B²)`, sur l'apprentissage seulement. Au moins deux observations par partition sont requises ; identifiants et couples site/saison sont uniques. Les sites de validation doivent être distincts et toutes leurs saisons postérieures à l'apprentissage. Le pays, la culture, la variété et le profil doivent correspondre exactement. Des HI hors [0,01 ; 0,90] sont refusés, pas tronqués.

MAE, RMSE et biais sont affichés en kg secs/ha, séparément pour chaque partition, avec leurs effectifs et nombres de sites. Une modification des récoltes de validation ne change pas le paramètre ajusté. Ces contrôles ne prouvent pas la provenance des biomasses déclarées, ni une validation indépendante de tous les paramètres. Aucun seuil de performance n'active automatiquement une prévision. FAOSTAT reste un contexte national et ne remplace pas des essais parcellaires.

## Limites qui restent à traiter

- Pas de croissance de couvert ou de racines rétroagissant avec nutrition, de phénologie thermique, de fixation biologique, de chimie N/P/K, de volatilisation ou lessivage explicites.
- Pas de stérilité florale calculée par Tmax, d'indice de récolte dynamique, de mortalité, ravageurs/maladies, verse ou pertes commercialisables.
- Pas d'acquisition automatique d'observations satellites numériques de la parcelle ni de calibration locale automatique à partir des archives territoriales.
- Pas d'incertitude prédictive mesurée, de doses optimales ou de prévision qualifiée dans les six pays.

Pour passer à une prévision opérationnelle : acquérir des essais compatibles avec sol, apports, météo et récoltes ; documenter un profil par domaine ; calibrer les paramètres identifiables ; réserver des sites et campagnes indépendants ; comparer aux références historiques ; mesurer l'incertitude et faire examiner le domaine par un agronome. L'ajout de paramètres ne remplace pas cette évaluation.

## Références de structure, sans transfert de coefficients

- APSIM, `RUEModel` : https://github.com/APSIMInitiative/ApsimX/blob/master/Models/Functions/SupplyFunctions/RUEModel.cs — principe de conversion du rayonnement intercepté en biomasse sous contraintes. Aucun code ni coefficient APSIM recopié.
- FAO, schéma AquaCrop : https://www.fao.org/aquacrop/overview/calculation-scheme/ — distinction couvert, biomasse et indice de récolte. Le présent moteur n'implémente pas AquaCrop.
- Le bilan d'eau et ses références FAO56 restent ceux de `engine.ts` ; le moteur WOFOST existant et ses limites sont documentés séparément dans `services/crop-compute/README.md`.
