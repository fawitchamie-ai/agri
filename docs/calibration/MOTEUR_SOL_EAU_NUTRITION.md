# Choix et implémentation du moteur — prompts 2 et 3

Audit et livraison du 1 novembre 2026, sur `main` à `ca610ac` (prompt 1 fusionné via PR #17). Le bilan hydrique et la géométrie existants sont conservés. Aucun pays n'est déclaré calibré. Les données Gagnoa et Sangalkam, leurs limites de protocole et leurs droits non commerciaux restent ceux de [l'inventaire](INVENTAIRE.md) ; elles ne deviennent pas des paramètres ou des récoltes de validation par leur présence dans le dépôt.

## Décision fondée sur les données

Le premier domaine de recherche reste le maïs de Gagnoa, mais la répartition annuelle/par cycle du N, les surfaces nettes et le dénominateur de rendement restent à confirmer. Les apports communs de P/K ne permettent pas d'identifier leurs réponses indépendantes. Les fonctions OFRA acquises sont des ajustements externes dont les unités et le domaine d'évaluation restent à qualifier ; elles ne sont pas exécutées pour fabriquer des observations. Sangalkam documente des apports organiques en maraîchage ; cela ne fournit pas un cultivar de maïs calibré.

**Choix implémenté :** conserver la référence simple existante, fournir un adaptateur exécutant WOFOST 8.1–SNOMIN dans un service Python séparé et limiter ses résultats à des **scénarios de recherche eau–azote**, P/K supposés non limitants et non simulés. Le catalogue calcule les masses N/P/K apportées indépendamment de leur disponibilité. Il ne constitue pas une réponse complète NPK du rendement. QUEFTS est une référence saisonnière pertinente à évaluer dès que fournitures, méthodes analytiques et domaine sont qualifiés ; il n'est pas activé avec des paramètres inventés.

| Candidat | Ce qui est effectivement calculé | Dates et doses | Données nécessaires ici | Performance et décision |
| --- | --- | --- | --- | --- |
| Référence imposée et FAO56 saisonnier existants | Production par surface semée ; réponse hydrique conditionnelle au Ky des cultures renseignées | Dates d'eau dans le bilan ; aucun effet d'engrais | Référence indépendante Ym, surfaces, forçage hydrique et conditions compatibles | Référence de comparaison conservée ; aucune précision agronomique démontrée. Pas de produit arbitraire de scores. |
| QUEFTS / Rquefts | Fournitures NPK et réponse saisonnière selon paramètres culturaux et rendement atteignable | Dose totale ; aucune dynamique des dates intra-cycle | Fournitures compatibles, P Olsen/sols/méthodes qualifiés, coefficients d'absorption et production dans le domaine | Aucune MAE/RMSE calculable avec un jeu local qualifié de cette livraison. Non activé. Rquefts 1.2-8 indique GPL ≥3 et compilation R/Rcpp. |
| WOFOST 8.1–SNOMIN / PCSE 6.0.13 | Croissance, eau multicouche, C/N organique, NH₄/NO₃ et réponse de la culture à N | Oui, événements journaliers compatibles | Paramètres du cultivar, courbes hydriques, C/N, états initiaux, cinétiques et météo complète | Vrai moteur installé et exécuté ; tests de sensibilité dose/date et de masses. Ces tests ne mesurent pas l'erreur de prévision au champ. Adaptateur retenu, domaine eau–N uniquement. |
| DSSAT CSM / CERES-Maize | Appels N, P et K repérés dans le module maïs, avec processus différents selon nutriment | Oui, si options et données adéquates | Cultivar, fichiers sol/météo/conduite, pools et paramètres des modules retenus | Code source audité ; pas de simulation locale ni de classement prédictif. Licence BSD-3-Clause du CSM, données à qualifier séparément. Réserve d'évolution si les limites de SNOMIN imposent un autre moteur. |
| APSIM Next Generation / Maize | Eau/N documentés ; documentation maïs citant un module d'engorgement et une réponse P encore à développer | Oui selon modules | Paramétrage local et vérification de chaque composant ; licence adaptée à l'usage | Non exécuté. Ne pas transférer une fonction APSIM Classic ou d'une autre culture à ce maïs NG. Licence General Use pour certains usages et Special Use pour activité commerciale à vérifier auprès du producteur. |
| AquaCrop | Réponse à l'eau et stress de fertilité, pas transformations explicites complètes N/P/K | Gestion de l'eau ; stress de fertilité à calibrer | Paramètres culturaux et hydriques calibrés | Non retenu pour représenter des stocks/transferts NPK. Ni licence d'une distribution particulière ni intégration de calcul revendiquées. |

Les performances prédictives ne sont **pas** classées : les labels, témoins et dénominateurs utilisables pour une comparaison indépendante font défaut. Le coût informatique réel est vérifié sur un exemple technique du fournisseur, sans le présenter comme une récolte agricole africaine. Une étape de calibration devra comparer les candidats sur mêmes sites/campagnes et unités, avec groupes de parcelles/sites indépendants et campagnes futures séparées ; aucun découpage aléatoire des répétitions permanentes ou des fonctions ajustées OFRA ne constitue cette évaluation.

## Vérification des modules et domaine par culture

DSSAT source épinglée pour l'examen : [25c93b9a2f73f8ec45bf441b198dac5fb7b22849](https://github.com/DSSAT/dssat-csm-os/tree/25c93b9a2f73f8ec45bf441b198dac5fb7b22849). La présence d'un appel est une preuve de raccordement du code, pas une calibration ou une validation du processus dans nos pays.

| Module examiné | N | P | K | Engorgement | Organique | Activation ici |
| --- | --- | --- | --- | --- | --- | --- |
| DSSAT CERES-Maize | `MZ_NUPTAK`, `MZ_NFACTO`, sol N | `P_Ceres` appelé dans `MZ_GROSUB` | `MZ_KUPTAK` et `SoilKi` ; absorption plafonnée reliée à N et pool disponible, pas un échangeur K exhaustif | `SATFAC`, pores/racines ; pas une preuve de mortalité par inondation | CERES/CENTURY présents dans la suite ; combinaison à paramétrer/tester | Aucune |
| DSSAT CERES-Sorghum | `SG_NUPTAK`, `SG_NFACT` | `P_Ceres` repéré | Non établi par ce contrôle ; aucune capacité affirmée | Non qualifié | Non qualifié pour le domaine | Aucune |
| DSSAT CERES-Rice | `RI_NUPTAK` | `P_Ceres` repéré | `RI_KUPTAK`/`MZ_KUPTAK` repérés ; mêmes réserves de portée | Le riz inondé exige son régime hydrique propre | Non qualifié pour le domaine | Aucune |
| DSSAT CERES-Millet | Ne pas déduire les capacités depuis Maize | Non établi ici | Non établi ici | Non établi ici | Non établi ici | Aucune |
| DSSAT CROPGRO soja/arachide/niébé | Existence de familles culturales vérifiée dans la liste officielle ; fixation et options non qualifiées pour nos jeux | Non qualifié par culture | Non qualifié par culture | Non qualifié par culture | Non qualifié par culture | Aucune |
| APSIM NG Maize | Documenté | Documentation de validation : développement futur | Non établi dans la référence consultée | Fonctions d'excès d'eau documentées en mai 2026, sans vérification de nos paramètres | Caractérisation et liaison du module sol à vérifier | Aucune |
| WOFOST 8.1–SNOMIN choisi | NH₄/NO₃/C–N explicites | Aucun | Aucun | Réponse à l'oxygène selon `IOX` et paramètres ; pas de mortalité d'inondation représentée par l'adaptateur | C/N et âge apparent, sans changement instantané de structure | Scénarios de recherche avec paquet complet uniquement |

Dans le catalogue des 23 cultures : `maize` est le seul identifiant admis comme candidat de recherche par le nouveau service. `sorghum`, `millet`, `rice-upland`, `rice-flooded`, `cowpea`, `soybean`, `groundnut`, `bambara`, `cassava`, `sweet-potato`, `yam`, `onion`, `tomato`, `okra`, `hot-pepper`, `bell-pepper`, `cabbage`, `cucumber`, `watermelon`, `eggplant`, `sesame`, `fonio` restent **non activés** dans ce nouveau moteur journalier ; leurs fiches et capacités hydriques antérieures sont conservées. Aucun module absent ou non vérifié n'est propagé depuis une autre culture. Une fixture `potato/DEMO`, extérieure au catalogue agricole, sert uniquement à vérifier le raccordement technique.

## Processus, équations et unités

Les équations journalières sont celles de PCSE 6.0.13, sans réimplémentation approximative. Le [service et son contrat](../../services/crop-compute/README.md) décrivent les objets et unités. `soilProperties` conserve les horizons relativement stables ; `initialState` contient les stocks initiaux ; `processParameters` les cinétiques ; `siteParameters` les conditions fixes ; la sortie contient les états évolutifs par jour/horizon. Le pH reste une entrée fixe des processus C/N et ne devient pas un état acidifié quotidiennement.

Dans SNOMIN, par horizon et pas journalier, le bilan conceptuel est :

```text
ΔNH4 = apport + minéralisation nette + dépôt − nitrification − absorption + entrée − sortie
ΔNO3 = apport + nitrification + dépôt − dénitrification − absorption + entrée − sortie
```

La minéralisation nette peut être négative (immobilisation). C/N de la biomasse, âge apparent et réponses à l'humidité/température/pH sont définis par le module, pas par un coefficient unique de disponibilité. Les stocks natifs NH₄/NO₃/N organique sont en kg N/m² ; les cinétiques de référence en j⁻¹ ; les dépôts en mg N/L ; profondeur/racines/eau en cm dans ce moteur. Les sorties cumulées de pertes `NLOSSCUM`, `NH4LEACHCUM`, `NO3LEACHCUM`, `NDENITCUM` et l'absorption culturale sont déjà en kg N/ha. Elles ne sont donc pas multipliées par 10 000 une seconde fois. `nitrogenDailyKgHa` normalise uniquement les stocks natifs par couche. Le dictionnaire de sortie documente chaque variable. Les contrôles internes de bilans du moteur restent exécutés ; leur réussite ne certifie pas l'exactitude des mesures d'entrée.

Le module sélectionné ne représente pas l'urée/hydrolyse ni la volatilisation NH₃ : les apports uréiques sont refusés dans l'adaptateur journalier, tout en restant comptabilisables comme N total dans le calendrier. Fixation biologique désactivée (`NFIX_FR=0`). P/K : masses des apports seulement, aucun pool labile/adsorbé/échangeable ou absorption simulé. La salinité, toxicité, verse et phytoprotection ne modifient pas le rendement de ce moteur. Les mécanismes non représentés restent explicites dans la matrice renvoyée par `crop-engine`.

Aucun facteur FAO n'est appliqué après WOFOST : son propre bilan eau–N commande la croissance. Le bilan hydrique simplifié existant reste une référence indépendante, pas une pénalité supplémentaire. Aucun produit « eau × pH × engrais × température », aucune pénalité liée à la seule proximité d'eau et aucun bonus de compost ou biostimulant.

## Catalogue, analyses et interventions

Catalogue `fertilizers-2026-11-01`. Il contient des **spécifications et profils à renseigner**, pas un inventaire de sacs vendus ni une composition de fumier par défaut. La source FAO distingue les garanties de produit et leur base ; fabricant, lot ou bulletin réels restent à renseigner lorsqu'ils sont disponibles. NPK 15–15–15 est un exemple de convention, pas une dose de conseil.

Le serveur conserve convention `N-P2O5-K2O` ou `N-P-K`, base fraîche/sèche, teneurs massiques, humidité, densité des liquides, formes N incluses dans N total, source/lot/date, statut déclaré/étiquette/analyse/scénario estimé et incertitude. Pour l'organique : carbone, C/N, maturité et stockage restent séparés. Une donnée inconnue reste `null`. Un profil de référence exige un scénario nommé ; aucune analyse locale de compost n'est inventée. La forme détaillée est disponible dans les apports, avec base analytique et détails repliables.

```text
Matière sèche (kg/ha) = masse fraîche × (1 − humidité/100)
Masse fraîche (kg/ha) = dose liquide (L/ha) × densité (kg/L)
Nutriment garanti (kg/ha) = masse sur la base analytique × teneur (%)/100
P élémentaire = P2O5 × 0,4364 ; K élémentaire = K2O × 0,8301
```

Les facteurs sont des rapports stœchiométriques arrondis, conservés explicitement avec le code. Exemple de test : 100 kg/ha de produit à 15–15–15 sur la base « tel qu'appliqué » donnent 15 N, 15 P₂O₅, 15 K₂O, donc **6,546 P et 12,4515 K kg/ha**. La disponibilité pendant le cycle reste inconnue sans module compatible.

Un mélange conserve ses composantes identifiées et refuse les doublons d'identifiant. Les formes N ne sont jamais ajoutées une seconde fois au N total. Les totaux prévu/réalisé sont distincts ; une teneur inconnue rend le total correspondant inconnu. La même liste doit concerner la même unité et le même dénominateur de surface ; ne pas sommer des doses à l'hectare de plusieurs unités spatiales.

Une mesure P extractible en mg/kg n'est pas une fourniture. L'utilitaire d'inventaire accepte uniquement des conventions explicites : densité du sol entier, fraction **massique** de terre fine, concentration dans cette terre fine et épaisseur documentée. Il calcule `mg/kg × 10⁻⁶ × densité kg/m³ × épaisseur m × 10 000 m²/ha × fraction`. Il ne convertit ni fraction volumique en massique, ni méthode Olsen en Bray, ni profondeur 0–20 en 0–30 cm. Le résultat ne constitue ni stock total P ni quantité absorbable.

Amendements calcaires, gypse, biochar, biostimulants et pesticides sont séparés. Aucun besoin de chaux depuis le seul pH ; aucun gain automatique phytosanitaire ; homologations pays/culture/usage/date toujours requises pour une prescription, qui n'est pas produite par ces API. Aucune toxicité chiffrée n'est fabriquée à forte dose. Les formes nutritives et leurs autres effets restent distincts.

## Géométrie et agrégation conservées

Contour, terre potentiellement cultivable, semé et récolté restent séparés. Les tests existants couvrent trous, unités disjointes, chevauchements, partition incomplète, unités hors contour et dénominateur récolté. Les données spatiales gardent leur résolution et couverture ; un profil 250 m n'est pas une analyse au m².

`P = Σ(A_i × Y_i)` pour unités disjointes, avec A en ha semés et Y en kg/ha semé. 1 ha semé à 4 t/ha donne 4 t ; 0,4 ha semé dans 1 ha de contour donne 1,6 t et conserve 4 t/ha semé. Une référence par hectare récolté n'est convertie que si cette surface est documentée. Le nouveau service n'accepte qu'une unité homogène par appel et renvoie sa production sèche ; sa réponse ne contourne pas les contrôles spatiaux. L'agrégation automatique des tâches journalières avec des campagnes est **non activée**, en attente de paquets locaux et du raccordement effectif du service.

## Vérification et limites de livraison

Tests ajoutés : conventions/stoéchiométrie, frais/sec, liquides, inconnues, composantes, fermeture des formes N, organique compatible/incompatible, refus urée/profondeur et appels API authentifiés. Tests Python exécutant le **vrai moteur**, sa sensibilité dose/date, le cycle complet, les états C/N, surface 40 %, erreurs sans résultat, stockage persistant, propriétaire, reprise et tentatives. CI distincte avant publication.

L'exemple fournisseur, les différences de doses artificielles et le scénario organique de test ne deviennent jamais une validation de terrain. La mesure de précision, la calibration des cultivars locaux, un domaine P/K qualifié, la simulation d'urée et le déploiement externe de calcul ne sont pas acquis. Le code et les interfaces sont livrés ; **le résultat journalier eau–N n'est pas encore une fonction opérationnelle raccordée à la production**. Sans service configuré, les actions journalières retournent une indisponibilité explicite. Les bilans de masses et le calendrier continuent de fonctionner sur Workers.

## Références examinées

- [PCSE : modèles](https://pcse.readthedocs.io/en/stable/_modules/pcse/models.html), [SNOMIN](https://pcse.readthedocs.io/en/stable/_modules/pcse/soil/snomin.html), [paquet et licence](https://pypi.org/project/pcse/6.0.13/).
- [QUEFTS, documentation producteur Rquefts](https://search.r-project.org/CRAN/refmans/Rquefts/html/Rquefts-package.html), [fournitures et méthodes](https://search.r-project.org/CRAN/refmans/Rquefts/help/nutSupply2.html), [source du paquet](https://github.com/cropmodels/Rquefts).
- [DSSAT : source et licence du CSM](https://dssat.net/development/open-source/), [liste officielle des modules culturaux](https://dssat.net/plant-growth-modules-in-dssat-csm/), source épinglée ci-dessus, `Soil/Inorganic_N`, `Soil/Inorganic_P`, `Soil/Inorganic_K` et appels des modules examinés.
- [APSIM NG Maize : documentation de validation](https://jenkins.apsim.info/validation/Maize), [licences et enregistrement](https://registration.apsim.info/).
- [FAO AquaCrop](https://www.fao.org/aquacrop/overview/en), [spécifications des engrais](https://www.fao.org/agriculture/crops/thematic-sitemap/theme/spi/plantnutrition/fertspecs/en/).
