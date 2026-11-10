# AgriPrévision — correction numérique et évaluation sur LIRF

10 novembre 2026. Base vérifiée : `1d7351fb67ba33bd61b9c84326d1fb0ec22b8204`.

Le moteur partagé calcule désormais, **avec un profil explicite**, l'évaporation et la transpiration séparément. La croissance peut utiliser une équation alternative fondée sur la transpiration normalisée. Le rejeu américain s'améliore ; le cas togolais reste non résolu avec ses stocks nutritifs illustratifs. Aucun profil américain ne devient un défaut pour l'Afrique.

## Changements opérationnels

- Bilan `water-balance-1.5.0` : option `waterModel.version = fao56-dual-1`, Kcb/Ke/Ks, déficit de surface, transpiration et évaporation explicites. Le même stock d'eau est débité une seule fois et le bilan quotidien est contrôlé.
- Croissance `daily-rue-npk-1.3.0` : la limitation par l'eau utilise Tr réelle/Tr potentielle avec ce bilan. L'option `growth.parameters.biomassModel.kind = transpiration-normalized` calcule B = WP × Σ(Tr/ET0). Cette équation remplace la production par RUE ; aucun Ky ou facteur hydrique supplémentaire n'est ajouté.
- Les stocks N/P/K et leurs bilans sont conservés. La nutrition non limitante est un **diagnostic**, jamais une fertilité mesurée déduite des récoltes.
- Le choix de méthode figure dans la réponse et le CSV. Un changement de modèle de biomasse invalide l'identité d'une calibration antérieure. Les observations de couvert futures ou indisponibles sont refusées.
- Les API de simulation exécutent effectivement ces calculs. Un test de route authentifiée le vérifie. Les campagnes existantes gardent leur méthode ; carte et style ne sont pas modifiés.
- `/api/health` exécute une sonde numérique déterministe sans écriture : Tr = 3 mm, E = 0 mm, biomasse avant nutrition = 150 kg/ha. Le déploiement exige le bon commit et le moteur attendu. Cette sonde vérifie le logiciel, pas sa précision agronomique.

Ce module est un bilan de zone racinaire à double coefficient avec une approximation de surface. Ce n'est pas une implémentation intégrale d'AquaCrop. Le couvert reste prescrit ; la phénologie thermique, la sénescence causée par le stress, le CO2, les ravageurs et une dynamique complète d'indice de récolte restent absents du moteur interne. WP est ici une efficacité effective ajustée, pas une propriété variétale identifiée séparément.

## Données réellement exploitées

LIRF 2012–2013 : 96 lignes annuelles, **94 rendements exploitables**, 24 moyennes année × traitement. Les deux grains « . » restent manquants. Les **48 biomasses annuelles de 2013 sont également manquantes** : aucune métrique de biomasse 2013 n'est fabriquée. Les séries journalières sont surtout des moyennes par traitement, pas quatre forçages indépendants de parcelles.

LIRF 2011, acquis ensuite : six traitements, 24 parcelles. WP et HI issus de 2012 ont été figés avant l'acquisition de ces récoltes ; aucun coefficient n'est réajusté sur 2011. C'est une évaluation rétrospective d'une autre saison de la même ferme, pas une validation dans un nouveau climat ni en Afrique.

Contrôles de mesure :

- grain américain à 15,5 %, distinct du 12–14 % togolais ; conversion matière sèche/produit explicite ;
- ET0 de référence herbe, distincte de ETr luzerne ;
- données horaires MST de fin d'heure : minuit affecté au jour précédent ; rayonnement kJ/m²/min × 60/1000 pour obtenir MJ/m² par heure ; 67 valeurs horaires négatives sont ramenées à zéro physique et comptées ;
- doses efficaces 2012–2013 utilisées au point net ; doses de turbine 2011 utilisées au champ avec deux scénarios d'efficacité annoncés, 0,90 et 1,00 ; aucune perte appliquée deux fois ;
- theta en % converti en fraction, horizons en m ; dates de maturité R6 distinctes des récoltes ; désaccord R5/R6 2013 conservé ;
- profondeur racinaire étiquetée « cm » mais atteignant 1 050 : **327 égalités exactes SWD_RZ = SWD_105** à cette profondeur étayent l'unité mm. C'est une correction inférée, pas une confirmation des auteurs ;
- rétention 2007/2008–2011 auditée avec identifiants de parcelles et horizons. La correspondance complète avec toutes les parcelles plus récentes n'étant pas établie, ces valeurs ne sont pas transférées comme mesures locales. Trois scénarios WP/FC = 0,35 / 0,50 / 0,65 sont conservés ;
- humidité à la date du semis reconstituée à partir du déficit initial estimé du bilan de terrain, et non présentée comme mesurée ;
- un jour 2011 manque de Tmin et de rayonnement : interpolation des jours immédiatement voisins, inscrite dans `holdout-2011-adapter.json.gz`. Les autres entrées ne sont pas complétées silencieusement.

## Résultats avant/après

Scénario central WP/FC = 0,50. Chaque moteur ajuste **un coefficient de production sur la biomasse 2012**, puis **un HI commun sur le grain 2012**. Il n'existe aucun coefficient par traitement. Les profils ajustés sont ensuite réellement réexécutés dans `planSeason`, avec contrôle de l'égalité des résultats.

| Chaîne | Saison et portée | RMSE grain (t/ha) | nRMSE (% de moyenne observée) |
|---|---|---:|---:|
| Bilan simple + RUE, ajusté sur 2012 | 2013, 12 moyennes | 2,162 | 16,71 |
| Double coefficient + RUE, ajusté sur 2012 | 2013, 12 moyennes | 2,291 | 17,71 |
| Double coefficient + WP, ajusté sur 2012 | 2013, 12 moyennes | **1,149** | **8,88** |
| Bilan simple + RUE figé, efficacité 1,00 | 2011, six moyennes | 1,264 | 13,07 |
| Double coefficient + WP figé, efficacité 1,00 | 2011, six moyennes | **1,176** | **12,16** |
| Bilan simple + RUE figé, efficacité 0,90 | 2011, six moyennes | 1,210 | 12,52 |
| Double coefficient + WP figé, efficacité 0,90 | 2011, six moyennes | **1,093** | **11,31** |

2013 a servi à examiner les mécanismes et choisir la nouvelle équation : ces résultats sont du développement rétrospectif, **pas un test aveugle**. L'amélioration est ensuite plus modeste en 2011. Ne sélectionner ni l'efficacité ni le scénario de sol selon leur erreur finale.

Sur 2013, la RMSE des cumuls ET passe de 63,58 à 48,80 mm dans le scénario central. La MAE grain de la nouvelle chaîne vaut 0,969 t/ha et le biais −0,290 t/ha. Les erreurs journalières d'ET et de réserve à 105 cm, le couvert, les contrastes et les répétitions figurent dans les JSON. Les fenêtres de cumul ET et certaines maturités restent incertaines : le cumul annuel et la somme tronquée journalière sont rapportés séparément.

Le contrôle défavorable reste visible : en 2011, traitement 6, la nouvelle chaîne estime **6,578 t/ha contre 3,966 observés**, avec efficacité 1,00. Le traitement le mieux irrigué donne 13,633 contre 13,640 t/ha. Un bon accord sur ce témoin ne résout donc pas la réponse au déficit sévère.

Le WP central ajusté vaut 24,6786 g/m² et le HI commun 0,53183. La sensibilité de nRMSE 2013 au scénario de sol est de **7,07 à 9,71 %**. Ce sont des scénarios, pas un intervalle prédictif. Ni ces coefficients ni leur erreur ne s'appliquent automatiquement aux six pays.

## Contrôles de référence

Le calcul conditionnel fourni est reproduit sans changer sa formule : k = 0,84982255357 ; RMSE 2013 = 1,10798 t/ha ; nRMSE = 8,56457 %, contre 27,01281 % pour la référence constante 2012. Il reçoit l'ET estimée de terrain et la référence FI 2013 ; il ne prédit pas cette ET. Ce contrôle ne devient pas un profil national.

L'exécutable **officiel AquaCrop 7.3, v7.3_typofix** reproduit de nouveau ses huit fichiers de référence, hors horodatage de création. L'activation/désactivation de fertilité de l'exemple de luzerne est également rejouée. Cela ne valide pas le maïs ou la fertilité locale.

Un véritable comparateur officiel exécute ensuite les 24 cas LIRF, sur les mêmes séries météo, doses nettes et scénario de sol. Deux paramètres de couvert, un WP et un HI communs sont ajustés sur **FI 2012 seulement**. Ses erreurs grain sont 4,93 % en 2012 et **39,45 % en 2013**. Les sorties quotidiennes de couvert, racines, transpiration, biomasse et grain sont générées par le script et conservées dans les archives détaillées. Ce mauvais transfert est rapporté ; il ne justifie pas de remplacer le moteur applicatif.

Les différences restent explicites : trajectoires racinaires et de couvert, coefficients génériques, paramètres hydrauliques non mesurés, extension éventuelle des compartiments et arrondi entier des doses/HI dans la lecture officielle. Cette comparaison ne classe pas équitablement deux calibrations identiques. Le profil officiel reste expérimental. AquaCrop-OSPy, conservé pour le benchmark historique antérieur, ne représente pas la fertilité ; il n'est pas utilisé ici pour prétendre identifier un effet N/P/K.

## Retour aux observations africaines

| Ensemble | Contrôle exécuté | Conclusion actuelle |
|---|---|---|
| Nord Togo | 36 diagnostics du moteur courant, cinq calendriers | Le cas original reste 2,57419 / 2,57419 / 2,57419 t/ha ; RMSE 0,99329. Plafond K illustratif conservé, pas fertilité du champ démontrée. |
| Ghana, Zenodo 6632083 | 500 mesures, 144 quadrats, 51 contours, jointures et groupes audités | 47 identifiants de champs ; un en a six quadrats. Groupes réservés par champ, sans découper ses quadrats. Sol, conduite datée et base d'humidité du grain insuffisamment établis pour calibrer le moteur complet. Aucune métrique locale inventée. |
| Parakou | Publications acquises recontrôlées | Fichiers journaliers et données originales par traitement toujours non reçus. Les métriques DSSAT des auteurs ne mesurent pas AgriPrévision. |
| Ina | Annexe acquise recontrôlée | Moyennes marginales disponibles ; matrice conjointe année × variété × dose × répétition incomplète. |
| Sékou, Zenodo 14357601 | Classeur acquis et base de mesure conservés | Masses fraîches d'épis, humidité/égrenage/surface non établis pour le grain sec : exclusion de cette comparaison. |
| ITRA–FSRP | Disponibilité des fiches | Aucune fiche individuelle reçue ; précision locale non calculée. |

**Aucune équipe sollicitée n'a répondu ; aucun message ni relance n'est envoyé dans cette exécution.** Les corrections générales sont partagées par les six pays ; la calibration locale de leur rendement reste à établir.

Correction d'évaluation : **1,000 n'appartient pas à [0,813 ; 0,851]**. Un optimum sur une borne est un signal à examiner, pas un rejet automatique universel. L'incertitude de lecture d'une figure ne constitue ni la variabilité biologique ni une incertitude prédictive.

## Reproduction et vérification

Les adaptations, résultats synthétiques par traitement et profils figés sont sous `research-data/lirf/2026-11-10`. Les trois archives de sorties quotidiennes détaillées sont générées localement par les scripts ; elles sont conservées séparément du dépôt publié. Les SHA-256 des classeurs et les versions Python y sont conservés. Les originaux restent distincts des données compilées.

```bash
python scripts/lirf-adapter.py /path/to/usda
python scripts/lirf-conditional-benchmark.py /path/to/usda/LIRF_2012_2013.xlsx /tmp/conditional.json
node --experimental-transform-types scripts/lirf-replay.mjs
python scripts/lirf-holdout-2011.py /path/to/holdout-2011
node --experimental-transform-types scripts/lirf-holdout-replay.mjs
node scripts/check-lirf.mjs
python scripts/replay-aquacrop-official-reference.py /path/to/calibration_audit
python scripts/lirf-official-benchmark.py /path/to/official/testcase
```

Le contrôle LIRF et le rejeu 2011 sont raccordés à la CI avant publication. Types, tests numériques et routes, intégration, régressions et compilation ont été exécutés localement. Le test Chromium de mise en page est empêché localement par l'interdiction des sockets Unix ; il reste inchangé et sera exécuté par la CI habituelle. Aucun test logiciel n'est assimilé à une validation agronomique.

## Sources

- [USDA LIRF 2012–2013, DOI 10.15482/USDA.ADC/1439968](https://doi.org/10.15482/USDA.ADC/1439968).
- [USDA LIRF 2008–2011, DOI 10.15482/USDA.ADC/1254006](https://doi.org/10.15482/USDA.ADC/1254006).
- [FAO56, chapitre 7, double coefficient](https://www.fao.org/4/x0490e/x0490e0c.htm), équations 69, 71, 74, 75 ; [chapitre 8](https://www.fao.org/4/x0490e/x0490e0e.htm), équations 80, 84.
- [FAO, schéma AquaCrop et biomasse par transpiration normalisée](https://www.fao.org/aquacrop/overview/calculation-scheme/en).
- [AquaCrop officiel 7.3, source et release](https://github.com/KUL-RSDA/AquaCrop/releases/tag/v7.3_typofix).
- [Essai togolais, Water SA](https://doi.org/10.17159/wsa/2020.v46.i1.7894).
- [Ghana, Zenodo 6632083](https://doi.org/10.5281/zenodo.6632083), licence CC-BY-4.0 ; [Sékou, Zenodo 14357601](https://doi.org/10.5281/zenodo.14357601).
