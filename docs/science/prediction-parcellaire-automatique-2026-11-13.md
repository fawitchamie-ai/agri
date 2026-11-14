# Prévision parcellaire automatique — méthode de travail

## Décision

Le moteur automatique doit obtenir le lieu à partir du contour de la parcelle. L'utilisateur ne choisit pas une préfecture. Le serveur déduit le pays et les unités spatiales croisées par le polygone, puis interroge les données à la résolution qu'elles supportent.

En revanche, le rendement d'une maille ou d'une préfecture ne doit pas être présenté comme le rendement mesuré de ce champ. Tant que le domaine culture–zone–saison n'a pas passé une validation hors échantillon au niveau des champs, `method: automatic` reste indisponible pour une valeur parcellaire. Le code de `lib/seasonal/yield.ts` applique actuellement cette règle.

## Ce que les données permettent déjà

Les **33 081 lignes territoriales retenues** dans les cinq pays couverts par le panel (Togo 2 014, Bénin 11 412, Burkina Faso 9 313, Ghana 1 025, Sénégal 9 317) fournissent une base utile aux références et prévisions administratives. Elles ne sont pas 33 081 récoltes de champs. Le fichier HarvestStat Afrique brut contient 217 370 lignes dans 33 pays ; les unités et les millésimes de frontières diffèrent. Le Ghana est au niveau régional dans ce panel, et la Côte d'Ivoire n'a pas de série équivalente dans cette base. Les statistiques FEWS/INSEED disponibles pour 2016–2019 comprennent 326 rendements préfectoraux, mais leur correspondance géographique avec la grille du modèle n'est pas vérifiée : ils sont exclus du score primaire. Les 28 paires d'évaluation retenues sont nationales, sur 2016–2022, avec seulement sept années par culture et sans intervalle prédictif calibré.

Les sources n'ont pas toutes le même rôle :

| Famille de données | Ce qu'elle peut apporter | Ce qu'elle ne permet pas d'affirmer seule |
| --- | --- | --- |
| HarvestStat, FEWS/INSEED, FAOSTAT | Références temporelles et contraintes de moyenne nationale, régionale ou administrative | Le rendement particulier d'un champ à l'intérieur de l'unité |
| Enquêtes de ménages, dont GROW-Africa et One Acre Fund | Information sur les pratiques et rendements déclarés ; contraintes à échelle régionale si la position est brouillée | Un label de champ à 10 m : le GPS LSMS est déplacé de 0–5 km et les crop-cuts LSMS de GROW concernent l'Éthiopie |
| Essais et crop-cuts | Réponses biologiques et récoltes mesurées, si surface, humidité, variété et traitement sont connus | Une validation indépendante en comptant les répétitions d'un même site comme des sites différents |
| Sols WoSIS, SoilGrids, iSDA | Contexte pédologique avec profondeur, méthode et incertitude | Une mesure parcellaire de N disponible, P/K assimilable ou une réponse causale à l'engrais |
| Pluie, température, rayonnement et ET0 | Anomalies de saison et stress hydrique par période de croissance | Une récolte sans connaître variété, conduite, maladies, pertes et surface récoltée |
| Sentinel-2 | Mesures de réflectance et indicateurs de végétation datés sur le contour | Des tonnes de grain observées ou un effet causal du sol/engrais |

Autres éléments acquis : 4 420 unités parcelle × campagne d'essais à Gagnoa et Sangalkam (deux sites, répétitions réutilisées, licence non commerciale) ; 4 977 horizons WoSIS pH sans récolte liée ; 6 146 fonctions OFRA ajustées, qui ne sont pas des répétitions d'essais bruts ; et l'essai de serre de Sékou, dont les masses d'épis frais ne fournissent pas une cible t/ha de grain sec. Ils peuvent informer des hypothèses ou des sous-modèles, pas gonfler artificiellement l'effectif de récoltes indépendantes.

Le fichier `grow-support-audit.json` est une synthèse agrégée de GROW-Africa ; les classeurs sources ne sont pas dans l'arbre de travail actuel. Les 12 741 lignes et leur support décrivent donc une piste de données publiques à réacquérir et harmoniser, pas 12 741 labels locaux prêts pour un entraînement de champ.

| Source | Support et contenu | Usage possible | Limite de transfert |
| --- | --- | --- | --- |
| GROW-Africa v1, enquête LSMS | 12 741 lignes de rendement pour maïs, sorgho, mil et riz dans cinq des six pays cibles ; 9 673 ont des coordonnées valides ; la précision déclarée est de 5 km sur toutes les lignes | Prior spatial ou apprentissage faible sur des cellules de plusieurs kilomètres, en intégrant l'incertitude de position | Ce ne sont pas des contours de champs ni des récoltes de crop-cut ; ne pas entraîner un modèle de pixel comme si le point GPS était exact |
| GROW-Africa v1, crop-cut LSMS | Aucune ligne des six pays cibles dans le fichier crop-cut | Aucun pour ces pays | Le papier décrit ces crop-cuts LSMS comme provenant d'Éthiopie |
| GROW-Africa v1, classe « Point » | 6 955 lignes des quatre céréales dans quatre pays ; 6 888 proviennent de CEEPA, sans précision spatiale explicite ; 4 042 moyennes temporelles n'ont pas d'année ; les 67 lignes restantes ont une précision déclarée de 1,85 km et pas de dates de semis/récolte | Contexte administratif et comparaison exploratoire après examen de chaque source | Aucun de ces nombres ne représente 6 955 parcelles indépendantes géolocalisées précisément |
| Ghana, mesures de LAI et récolte 2021 | 46 champs non ambigus, avec contour, récolte et LAI mesuré au champ | Test local d'un nowcast conditionné à l'état de la culture | Une seule campagne ; LAI manuel requis ; couverture de l'intervalle nominal à 90 % : 7/10 champs réservés |
| Sorgho ouest-africain CIRAD, DOI `10.18167/DVN1/WEZAYO` | 23 sites expérimentaux au Burkina Faso, au Sénégal et au Mali, 2013–2016 ; variétés, dates de semis, météo, sol, conduite, croissance et récolte ; CC BY 4.0 | Calibration et validation hors site d'un modèle mécaniste de sorgho, puis test du transfert aux champs | 23 sites expérimentaux ne couvrent pas toutes les variétés, pratiques, saisons ni les autres pays |
| Maïs AgMIP/CIRAD, DOI `10.18167/DVN1/CIN8PB` | Cinq sites au Bénin, au Ghana, en Éthiopie et au Rwanda, 2008–2015 ; météo, sol, dates, opérations, LAI, eau/azote, biomasse et grain ; CC BY-NC-SA 4.0 | Recherche de calibration de mécanismes maïs dans une enclave de recherche séparée | Licence non commerciale : ne pas intégrer les données dérivées ou coefficients à une production commerciale sans autorisation distincte |

L'inventaire GROW peut être reproduit avec `scripts/audit-grow-parcel-support.py`. Son JSON est agrégé : aucun identifiant de ménage, champ ou observation individuelle n'est exporté. La méthode et les limites de GROW sont documentées par Geyman et al. (2025) et la fiche de données v1.0.

## Ce que Sentinel-2 peut prédire dans notre cas

Après semis, une série claire Sentinel-2 sur le contour peut décrire : l'installation du couvert, sa vitesse de croissance, le niveau et la date du maximum de végétation, la durée du couvert et son déclin avant récolte. Des résumés comme NDVI/EVI maximum, intégrale saisonnière, pente de croissance et anomalie par rapport aux saisons précédentes sont des **prédicteurs candidats** d'état du couvert et, après calibration, de rendement. Ils peuvent aussi aider à repérer un champ qui se développe plus lentement que ses voisins. Avant la levée, ils ne décrivent pas la culture future.

La chaîne maintenant intégrée lit les bandes natives B02, B04, B08 et le masque SCL, calcule des médianes dans le polygone, archive les dates et leur couverture claire, et écarte les classes de nuage/ombre/eau. Elle sélectionne au plus six dates par récupération. Le suivi apparaît dans la campagne et le brief agronomique, avec une courbe et les dernières valeurs. `estimateYield` ne lit toujours pas `satelliteMonitoring` : ces observations n'augmentent donc pas le rendement en t/ha. La résolution nominale des bandes utilisées est 10 m ; SCL est à 20 m. Le masque SCL peut lui-même manquer une partie des nuages, ce qui impose de conserver une mesure de pixels clairs et un indicateur de qualité. La recherche de scènes transmet l'emprise géographique à Digital Earth Africa, sans transmettre l'identifiant du compte.

Il ne faudra pas limiter le banc d'essai à NDVI/EVI. Sentinel-2 fournit aussi les bandes red-edge B05–B07 à 20 m et les bandes SWIR B11/B12 à 20 m ; des indices de chlorophylle/couvert (par exemple GCVI, MTCI ou CIred-edge) et d'eau (NDWI) sont des candidats à comparer. Le code actuel ne lit aucune de ces bandes : leur ajout dépendra du gain réel et du nombre de pixels disponibles dans les petites parcelles. Dans deux zones de maïs en Éthiopie, le MTCI mensuel a atteint R² = 0,63 dans la meilleure zone, mais le transfert vers l'autre zone était faible et l'ajout des variables météo/sol améliorait peu l'ajustement. Il faut donc tester chaque famille par ablation, en gardant les mêmes champs et saisons réservés, plutôt que supposer que plus d'indices ou de données donne automatiquement un meilleur modèle.

Un précédent particulièrement proche existe au Burkina Faso : à Nouna, une étude a associé des mesures de récolte au champ à des séries Sentinel-2 multi-mensuelles et a rapporté, pour le maïs, R² = 0,46 ; les fenêtres observées permettaient une estimation jusqu'à environ deux mois avant récolte. C'est une preuve que la piste est plausible dans la région, pas une validation transférable à tous les champs ou pays. L'étude souligne aussi le besoin d'une série temporelle assez dense et de références récolte suffisantes.

L'information temporelle vaut plus qu'un seul NDVI maximal, mais elle ne remplace pas les récoltes. Dans deux zones de maïs en Éthiopie, le MTCI mensuel issu de Sentinel‑2 a donné le meilleur modèle local (R² jusqu'à 0,63), mais le transfert entre zones était faible ; l'ajout de météo et de sol améliorait peu l'ajustement. Cela justifie de tester les bandes red-edge, pas de transférer ce score tel quel. Dans notre test indépendant de dix champs, le comparateur fondé sur du LAI mesuré manuellement obtient 3 à 4 champs sur 10 à ±20 % selon la date. Aucun de ces résultats n'établit une fiabilité de 70 % transférable aux six pays.

L'appariement a été réalisé sur 46 champs ghanéens non ambigus, avec quatre dates d'émission et une marge de disponibilité de cinq jours. Les contours invalides du fichier public ont été réparés uniquement pour cette analyse. Le [rapport agrégé](benchmark-parcellaire-sentinel-soilgrids-ghana-2026-11-13.md) et les [résultats métriques sans identifiants de champs](benchmark-parcellaire-sentinel-soilgrids-ghana-2026-11-13.json) sont versionnés ; les coordonnées et prédictions individuelles ne le sont pas.

Résultat exploratoire : le témoin spatial de moyenne des champs d'entraînement atteint une MAE de 642 kg/ha et 3/10 champs test à ±20 %. L'amplitude NDVI varie de 436 à 670 kg/ha de MAE selon la date ; l'amplitude EVI de 494 à 666. Le meilleur cas isolé obtient 4/10 champs à ±20 % (intervalle de Wilson à 95 % : 17–69 %), mais les résultats changent selon la date et le jeu test n'a que dix champs. SoilGrids à huit covariables atteint 724 kg/ha de MAE ; le profil hydrique SoilGrids à six couches, disponible pour les dix champs test, atteint 704 kg/ha. Les assemblages plus larges de variables du sol ou de Sentinel‑2 ne produisent pas de gain stable et dégradent plusieurs dates. Le rendement administratif de 2020 appliqué uniformément par région atteint 751 kg/ha de MAE. Ce prior n'est pas une désagrégation entre parcelles.

Ce test reste rétrospectif et spatial : les rendements 2021 des champs d'entraînement n'étaient pas disponibles aux dates d'émission. Les quatre dates réutilisent les mêmes champs test ; il ne faut pas les compter comme 40 essais indépendants. Le protocole n'évalue pas non plus la détection automatique des contours ou des cultures, car les polygones et l'étiquette maïs étaient déjà connus.

## Modèle recommandé

### 0. Harmoniser sans mélanger les échelles

Oui, l'assemblage peut améliorer le modèle, surtout ses références, son transfert et la stabilité des prédictions. Il faut d'abord conserver pour chaque mesure sa source, son type, sa précision spatiale, sa date de disponibilité, sa culture, sa saison, son système, sa base d'humidité et son dénominateur de surface. HarvestStat/FEWS/GROW peuvent se recouper : dédoublonner par source d'origine, unité géographique datée, culture et saison avant de compter les observations. Les statistiques apparentées ne doivent pas être traitées comme deux confirmations indépendantes.

Le modèle doit représenter un rendement latent de champ, puis relier chaque label à son support : un crop-cut contraint le champ échantillonné ; une enquête LSMS contrainte une zone de plusieurs kilomètres ; un chiffre administratif contraint une moyenne de polygone ; un essai contraint un site × variété × traitement. Les rendements administratifs peuvent être comparés à la moyenne des prédictions de champs de cette zone, pas copiés sur chaque champ. Les essais NPK/compost alimentent un sous-modèle de réponse aux pratiques, séparé du niveau de rendement de base. SoilGrids, observations de sol et météo deviennent des covariables avec leurs incertitudes et dates, pas des pseudo-récoltes.

Les analyses doivent conserver des têtes séparées par culture et un effet partagé de climat/zone uniquement si la validation montre qu'il se transfère. Ajuster d'abord un modèle de référence, puis ajouter par blocs météo, sol, gestion et Sentinel-2. Retenir un bloc seulement si son gain tient sur les mêmes champs, saisons et sites réservés, sans dégrader le biais ni la couverture des intervalles. Cette procédure permet d'exploiter toutes les sources tout en empêchant qu'un très grand nombre de lignes administratives noie les rares labels exacts.

### 0 bis. Désagréger un rendement de zone vers les parcelles

La piste proposée — identifier les cultures, mesurer leur évolution par Sentinel-2, puis utiliser le rendement observé dans la zone — est une vraie famille de méthodes de **désagrégation spatiale**. Elle peut produire une carte parcellaire cohérente avec les statistiques de zone, à condition de la présenter comme une allocation modélisée et de valider la distribution entre champs. Une étude a, par exemple, distribué la production du district sur les pixels de la culture selon leur part d'EVI intégré. Les auteurs signalent toutefois qu'ils ne disposaient pas de récoltes de terrain pour valider le rendement pixel par pixel : le respect de la moyenne du district n'établissait donc pas l'exactitude individuelle des pixels.

Pour une zone `z`, une culture et une saison données, soit `Y_z` le rendement moyen observé, `A_i` la surface cultivée du champ `i`, et `s_i` un score relatif de productivité appris à partir de la trajectoire satellite, de la météo, du sol et des pratiques. Une allocation qui respecte exactement la moyenne officielle est :

`y_i = Y_z × s_i / (Σ_j A_j s_j / Σ_j A_j)`

Ainsi, la moyenne pondérée des `y_i` par surface retombe sur `Y_z`. Si l'on connaît plutôt la production totale de la zone, on peut répartir cette production entre les champs selon `A_i × s_i`, puis la convertir en t/ha. Le score `s_i` ne doit pas être le NDVI brut : il doit être calibré sur des récoltes mesurées, une culture et une période de croissance comparables, avec son incertitude.

Cette méthode est immédiatement utile pour cartographier **où les champs semblent meilleurs ou moins bons que la moyenne locale**, et pour désagréger rétrospectivement une statistique déjà publiée. Elle ne transforme pas une moyenne zonale en récoltes individuelles observées. Surtout, le rendement officiel de la saison en cours n'est généralement connu qu'après récolte : l'utiliser dans la prédiction de cette même saison serait une fuite temporelle. Avant récolte, le système doit utiliser les saisons antérieures comme prior et les observations satellite/météo déjà disponibles ; quand le résultat zonal final arrive, il peut servir à recalibrer ou vérifier la carte, pas à prétendre que la prévision antérieure le connaissait.

La chaîne doit séparer trois classifications : (1) masque des terres cultivées, (2) détection ou import des contours de champs, (3) culture ou combinaison de cultures dans chaque contour. Un contour déjà dessiné par l'utilisateur est préférable à une limite déduite automatiquement. Des limites automatiques sont possibles, mais les petits champs irréguliers et leurs frontières peu visibles exigent souvent des images plus fines, des exemples annotés et une validation indépendante. Une cartographie du Ghana a utilisé des images de référence de 3,7 m, des étiquettes vérifiées et une segmentation ; même ainsi, la précision producteur des frontières de champs restait de 58,2 %. Ce résultat ne peut donc pas être attribué à NDVI/EVI Sentinel-2 seuls. Au Burkina Faso, Sentinel-2 pouvait estimer le couvert et la production sur des placettes, mais la distinction millet/sorgho et les champs en cultures associées restaient des difficultés importantes.

Une fois des frontières disponibles, les séries temporelles Sentinel-2 peuvent classifier les cultures, mais un unique NDVI/EVI ne suffit pas toujours : les calendriers de croissance peuvent se chevaucher et les cultures associées mélangent leurs signaux. Pour le Togo, Bénin, Burkina Faso, Ghana, Côte d'Ivoire et Sénégal, le test doit être fait par culture et saison, avec une classe explicite « mélange/autre/inconnu ». Les rendements de zone ne doivent être répartis qu'à l'intérieur du masque de la culture concernée, jamais sur toutes les parcelles vertes.

La validation de la désagrégation comporte deux contrôles distincts : (a) la carte agrégée doit reproduire les statistiques de zone sans biais ; (b) sur des champs avec récoltes exactes et tenus à l'écart, les prédictions doivent aussi être proches des mesures champ par champ. Le contrôle (a) seul est nécessaire mais insuffisant pour annoncer un rendement parcellaire fiable.

### 1. Modèle hiérarchique à supports connus

Utiliser les sources selon leur unité d'observation, sans les fusionner comme si elles décrivaient le même objet :

- une statistique nationale ou administrative est une moyenne sur son polygone ;
- une réponse d'enquête LSMS avec GPS brouillé contribue à une zone de probabilité d'environ 5 km, pas à un pixel central ;
- un essai avec placettes et récolte pèse au niveau site × saison × variété × traitement ;
- une récolte de l'application, avec contour et surface récoltée mesurés, est une observation parcellaire, sous réserve de son contrôle qualité.

La vraisemblance des labels agrégés doit intégrer leur support spatial. Les prédicteurs de la parcelle sont ensuite agrégés sur la zone d'observation pour comparer leur moyenne à un label régional. Cette étape permet d'utiliser les grandes sources sans leur attribuer une précision qu'elles n'ont pas. Elle ne valide pas, à elle seule, la différence de rendement entre deux champs voisins.

### 2. Socle agronomique et correction locale

Utiliser le bilan hydrique et le modèle de croissance comme structure, avec des paramètres propres à la culture et au domaine effectivement évalué. Apprendre ensuite une correction statistique résiduelle sur des récoltes indépendantes. Séparer les effets de saison, zone agroécologique, variété, date de semis, irrigation et apports documentés. Les rendements historiques nationaux peuvent stabiliser la moyenne, mais ne deviennent pas des observations du champ.

Avant semis, le système emploie le sol et les scénarios météo accessibles à cette date. Il ne prétend pas connaître le NDVI/EVI de la culture qui n'a pas encore poussé. Après levée, l'imagerie peut mettre à jour la prévision si les valeurs sont calculées sur le contour, filtrées contre nuages/sol nu et disponibles à la date d'émission. SoilGrids reste un covariable de sol à maille et profondeur données ; une analyse chimique de parcelle et une mesure d'azote disponible ne s'en déduisent pas.

### 3. Usage conditionnel du NDVI/EVI et de SoilGrids

Pour chaque ajout, comparer le modèle complet au même modèle sans cette variable, avec exactement les mêmes partitions indépendantes. Garder NDVI/EVI ou SoilGrids dans le calcul de rendement seulement si le gain d'erreur hors échantillon est positif avec une incertitude compatible, sans dégradation du biais, du transfert spatial et de la couverture des intervalles. Sinon, les afficher comme indicateurs descriptifs séparés du rendement. Les images WMS déjà servies par `lib/seasonal/satellite.ts` sont des rendus, pas une série de mesures NDVI/EVI qualifiée pour le modèle.

## Résultat du test de transfert du 13 novembre 2026

Un banc d'essai reproductible compare le modèle source, la moyenne source, la moyenne historique locale, le recalage résiduel uniforme, son rétrécissement vers zéro et la correction par similarité. Il distingue la prévision sur des cellules qui ont déjà un historique de celle sur des cellules géographiquement inédites. Les détails et métriques sont dans [`research-data/alternative-models/2026-11-13/transfer/report.md`](../../research-data/alternative-models/2026-11-13/transfer/report.md) et les résultats agrégés dans `results.json`.

Sur quatre pays non cibles (Burundi, Kenya, Rwanda, Tanzanie), le modèle par similarité réduit le RMSE poolé des cellules inédites de 6,0 % face au modèle source, mais seulement de 2,5 % face à la moyenne source et de 2,3 % face à la moyenne historique locale. Les intervalles appariés incluent zéro pour ces deux repères simples. Le gain n'est pas uniforme : au Burundi, la moyenne locale historique fait nettement mieux. Pour les cellules déjà observées, la moyenne locale historique bat la correction par similarité. La piste par similarité est conservée comme candidate de recherche, pas activée dans le moteur.

Dans les tests sans historique local au Nigeria 2022 et en Ouganda 2020, la variante sans covariables de sol a un RMSE inférieur à celle avec sol, mais son biais reste élevé. Les variables testées sont les couches d'argile, de pH, de carbone organique et d'ECEC d'iSDA, pas SoilGrids. Aucun gain d'apport du sol n'est démontré dans ce test. L'enquête ne contient pas de série NDVI/EVI qualifiée, donc elle ne peut estimer leur valeur ajoutée. La fiche du jeu précise que le GPS exact du champ ne concerne que 70 % des observations et que les autres utilisent un point de bourg ou de district ; le rendement correspond à deux quadrats de 36 m² par champ. Ces limites rendent le test spatial indicatif, pas parcellaire exact.

Ces résultats ne couvrent aucun des six pays ciblés et reposent sur des récoltes en quadrats avec localisation parfois remplacée par un bourg ou un district. Les variantes utilisent aussi les valeurs rétrospectives de variété et de date de semis ; elles ne sont valides à l'émission que si ces entrées sont connues comme plan. Ce n'est pas un calcul fondé uniquement sur le polygone. Ces limites ne changent donc pas la décision produit : pas de valeur de rendement automatique parcellaire avant validation sur des récoltes exactes des pays cibles.

## Validation et activation automatiques

La validation doit être séparée par culture, pays et zone agroécologique et doit conserver ensemble toutes les répétitions d'une parcelle/essai.

1. Comparer à un repère simple construit uniquement sur le passé : médiane récente du même domaine, puis climatologie locale si elle est disponible.
2. Réserver des saisons complètes pour tester le temps et des sites/zones entiers pour tester le transfert spatial ; aucun découpage aléatoire de lignes.
3. Publier MAE, RMSE, biais, skill face au repère, effectifs et couverture des intervalles prédictifs. Réévaluer NDVI/EVI et chaque groupe SoilGrids par ablation appariée.
4. Activer une **prévision parcellaire** uniquement après résultats positifs sur des récoltes exactes, des saisons indépendantes et un transfert spatial documenté. Le seuil de skill de 10 % retenu dans le mémoire peut servir de porte produit ; son intervalle de confiance doit aussi exclure l'absence de gain.
5. Émettre un point estimé, un intervalle calibré, la date d'émission, les sources, le support spatial, le domaine de calibration et les limites. Si seule la maille 5 km est soutenue, répondre « repère régional 5 km », jamais « rendement prédit de votre parcelle ».

## Collecte indispensable dans l'application

À chaque récolte, conserver une observation distincte de la prévision : culture et variété, dates de semis et de récolte, contour, surface réellement récoltée, masse nette de grain, humidité de référence, système pur/associé, irrigation et apports datés. La géométrie du champ permet de résoudre automatiquement pays et zone ; aucun champ « préfecture » n'est nécessaire dans le formulaire de rendement.

Un contrôle doit mettre en quarantaine les rendements impossibles, les unités incohérentes, les surfaces de récolte supérieures à la surface semée, les observations répétées et les récoltes dont l'humidité ou le dénominateur sont inconnus. L'entraînement ne peut réutiliser que les variables connues à la date de prévision : dates de récolte, stress observés après l'émission et interventions futures sont des fuites de cible.

## État d'activation

- **Calcul parcellaire automatique validé : non.** `estimateYield` refuse actuellement le mode automatique.
- **Contour → géographie sans préfecture manuelle : possible.** Les coordonnées de la géométrie sont déjà le point d'entrée spatial ; cette résolution doit rester côté serveur.
- **Preuve d'un nowcast local : expérimentale.** Le prototype Ghana utilise du LAI manuel et ne couvre pas l'intervalle nominal à 90 % sur le petit jeu réservé.
- **Fusion multi-source : utile si elle respecte les supports.** Elle peut renforcer une prévision territoriale ou le prior d'un futur nowcast de champ ; elle ne crée pas les récoltes de champ manquantes.
- **Sentinel-2 : suivi automatique du couvert après semis intégré.** Le contour et le cycle déclenchent la recherche sans sélection administrative ; NDVI/EVI, couverture claire, courbe et dernières valeurs figurent dans le suivi de campagne et le brief agronomique. Le moteur de rendement ne les consomme pas encore ; le test ghanéen n'a pas prouvé une précision transférable.
- **NDVI/EVI et SoilGrids comme correcteurs de rendement : non qualifiés.** Les ablations n'ont pas montré de gain stable hors échantillon ; SoilGrids est un prédicteur 250 m et non une analyse du champ.
- **Désagrégation d'un rendement régional : non validée au niveau parcelle.** Il manque un masque représentatif de toutes les terres en maïs et un dénominateur de surface pour redistribuer la moyenne sans biais.
- **Prochain travail utile :** recueillir des récoltes exactes au Togo (surface récoltée, masse, humidité, variété, dates, pratiques), puis valider par saisons et sites indépendants. Les données CC BY-NC-SA restent en recherche non commerciale, séparées du code et des modèles de production tant que les droits ne l'autorisent pas.

## Références

- Geyman et al. (2025), *An Africa-wide agricultural production database to support policy and satellite-based measurement systems*, DOI `10.5281/zenodo.14961637`. La publication distingue régions et points, signale le bruit des enquêtes et le brouillage GPS de 0 à 5 km, et précise que les crop-cuts LSMS du dépôt concernent l'Éthiopie.
- Adam et al. (2026), *Dataset characterizing ten major West African sorghum varieties in twenty-three sites across the sudano-sahelien West Africa*, CIRAD Dataverse, DOI `10.18167/DVN1/WEZAYO`, licence CC BY 4.0.
- Falconnier et al. (2025), *Calibration data for: Modelling climate change impacts on maize yields under low nitrogen input conditions in sub-Saharan Africa*, CIRAD Dataverse, DOI `10.18167/DVN1/CIN8PB`, licence CC BY-NC-SA 4.0.
- Gomez-Dans et al. (2022), *Location, biophysical and agronomic parameters for croplands in northern Ghana*, ESSD 14, 5387, DOI `10.5194/essd-14-5387-2022`, données DOI `10.5281/zenodo.6632083`.
- Karst et al. (2020), *Estimating Yields of Household Fields in Rural Subsistence Farming Systems to Study Food Security in Burkina Faso*, Remote Sensing 12(11), 1717, DOI `10.3390/rs12111717`.
- Mondschein et al. (2024), *Mapping Field-Level Maize Yields in Ethiopian Smallholder Systems Using Sentinel-2 Imagery*, Remote Sensing 16(18), 3451, DOI `10.3390/rs16183451`. Le MTCI atteint R² jusqu'à 0,63 localement dans l'étude, mais le transfert spatial était limité et météo/sol apportaient peu.
- Shirsath et al. (2020), *Downscaling Regional Crop Yields to Local Scale Using Remote Sensing*, Agriculture 10(3), 58, DOI `10.3390/agriculture10030058`.
- Karlson et al. (2022 issue; 2021 volume), *High Resolution, Annual Maps of Field Boundaries for Smallholder-Dominated Croplands at National Scales*, Frontiers in Artificial Intelligence 4, DOI `10.3389/frai.2021.744863`.
- Karlson et al. (2020), *The Potential of Sentinel-2 for Crop Production Estimation in a Smallholder Agroforestry Landscape, Burkina Faso*, Frontiers in Environmental Science 8, DOI `10.3389/fenvs.2020.00085`.
