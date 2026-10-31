# Données et modèles opérationnels dans les six pays

Recherche et acquisition du 31 octobre 2026. Base : main `20d0d6f9030dfdafdf439aeff2eaa6ffe41f8de6` (PR 9), avec inspection des sources et des paramètres existants. Les archives nationales déjà acquises sont conservées. Aucun rendement récent manquant n'est synthétisé.

## Ce qui est ajouté

- Historique NASA POWER optionnel : pluie corrigée, températures moyenne/minimale/maximale et de rosée, humidité relative, vent à 2 m, rayonnement et pression. ET0 calculée avec FAO56 Penman–Monteith journalier, flux de chaleur du sol nul et albédo 0,23. Les ingrédients numériques du calcul ET0 sont conservés dans `rawValue`, dans l'ordre et les unités de `rawUnit` ; version du calcul, API, sources et date d'acquisition sont enregistrées. Les nouvelles variables descriptives ne deviennent pas des pénalités de rendement.
- Statistiques FAOSTAT officielles acquises pour les six pays, 2020–2024 : 485 observations pays/produit/année, 21 produits recherchés. Surface récoltée, production, rendement, unités brutes, flags et notes conservés. Ces références nationales sont affichées séparément et restent exclues du calcul de Ym.
- Neuf cultures avec Ky saisonnier : maïs, sorgho grain, soja, arachide, tomate, chou pommé, pastèque, oignon et poivron. Oignon/poivron utilisent chacun Ky=1,10 du tableau 24 FAO56. Leurs profils hydriques étaient déjà paramétrés. Un cycle complet, un Ym indépendant déclaré, le sol, la météo, les surfaces semées et les conditions compatibles restent requis. Les autres cultures ne reçoivent pas un coefficient interpolé.
- Scénario FAO56 de salinité **isolée** pour six couples culture/produit explicitement paramétrés. Ce scénario suppose tous les autres facteurs non limitants et reste séparé des trois scénarios hydriques. Il ne simule ni leur interaction, ni la toxicité ionique, ni une mortalité. Il ne prescrit ni engrais ni lessivage.
- Audit serveur et panneau « Ce qui manque encore pour cette parcelle », avec sources, limites, paramètres requis et export JSON. Les paramètres et résultats de salinité sont recalculés et conservés dans les révisions des campagnes ; les acquisitions météo gardent leur provenance. Les anciennes versions restent inchangées. Le CSV de rendement continue à décrire uniquement les scénarios hydriques ; le scénario isolé apparaît dans les exports JSON explicitement nommés.

## Contrat NASA et vérification réelle

Documentation primaire : https://power.larc.nasa.gov/docs/services/api/temporal/daily/

API : `https://power.larc.nasa.gov/api/temporal/daily/point`, communauté AG, neuf paramètres et `time-standard=UTC`. Les unités sont contrôlées strictement : températures C, humidité %, vent m/s, pluie mm/day, rayonnement MJ/m²/day, pression kPa. Une unité inattendue, un contrat temporel différent, une valeur manquante ou une combinaison non physique n'est jamais converti arbitrairement. ET0 reste nulle/inconnue si ses ingrédients manquent. Les données manquantes ne deviennent pas zéro pluie. Les dates accessibles sont passées, au plus 366 jours par requête ; la date du conseil doit être aujourd'hui pour une nouvelle acquisition. Une ancienne révision ne reçoit donc pas une donnée obtenue après son émission.

La requête est arrondie à 0,5 degré pour mutualiser le cache public (une heure, 24 entrées). Ce pas de requête n'est pas présenté comme la résolution native de tous les produits NASA. Les coordonnées interrogées sont conservées ; aucune emprise de pixel ni mesure de parcelle n'est inventée. Le cache conserve la date initiale d'acquisition. Aucun calcul sous-pixel ou interpolation locale n'est prétendu. Les valeurs locales mesurées et les valeurs manuellement modifiées restent prioritaires. Les acquisitions sont explicites dans le panneau, jamais un téléchargement automatique à chaque déplacement de contour.

La disponibilité est celle du moment de l'acquisition, pas la date du jour météorologique. Les jours récents peuvent manquer. NASA est un historique modélisé révisable ; ce n'est pas une prévision saisonnière. La configuration conserve les valeurs effectivement utilisées pour permettre un export reproductible, sans prétendre que l'API publique est une archive immuable.

Acquisition réelle : un point par pays, du 1 au 3 janvier 2025, le 31 octobre 2026. Les 18 jours ont une pluie et une ET0 dérivée disponibles. Voir `verification-nasa-six-pays-20261031.json`. Les points interrogés sont [longitude, latitude] :

| Pays | Point de requête | Jours pluie + ET0 | Validation de rendement |
|---|---|---:|---|
| Togo | [1 ; 9,5] | 3/3 | Aucune nouvelle validation |
| Bénin | [2,5 ; 9,5] | 3/3 | Aucune nouvelle validation |
| Burkina Faso | [-1,5 ; 12,5] | 3/3 | Aucune nouvelle validation |
| Ghana | [-1 ; 8] | 3/3 | Aucune nouvelle validation |
| Côte d'Ivoire | [-5,5 ; 7,5] | 3/3 | Aucune nouvelle validation |
| Sénégal | [-14,5 ; 14,5] | 3/3 | Aucune nouvelle validation |

Reproduction volontaire hors CI : `node --use-env-proxy --experimental-transform-types scripts/check-nasa-six-countries.mjs`. Le fichier de preuve distingue acquisition réelle, calcul dérivé et validation absente. Ces six points ne prouvent pas une couverture sans erreur de toutes les parcelles, ni l'état de la session de production.

FAO56 ET0 : chapitres 2, 3 et 4, équations 6, 11, 13, 21, 23, 25 et 37–40 :

- https://www.fao.org/4/x0490e/x0490e06.htm
- https://www.fao.org/4/x0490e/x0490e07.htm
- https://www.fao.org/4/x0490e/x0490e08.htm

Le test reproduit l'exemple 18 (Uccle, jour 187, environ 3,88 mm/j, tolérance 0,05 mm/j). Ce test vérifie l'équation ; il ne valide pas les données de maille NASA contre des stations africaines.

## Salinité : domaine strict et distinct

Source primaire : FAO56 chapitre 8, tableau 23 et équation 89, https://www.fao.org/4/x0490e/x0490e0e.htm

| Culture/produit | Seuil ECe dS/m | Perte relative % par dS/m au-delà du seuil |
|---|---:|---:|
| Maïs grain | 1,7 | 12 |
| Sorgho grain | 6,8 | 16 |
| Soja graine | 5 | 20 |
| Arachide graine | 3,2 | 29 |
| Niébé graine | 4,9 | 12 |
| Oignon bulbe | 1,2 | 16 |

`Ya/Ym = 1 − b × max(0, ECe − seuil)/100`, uniquement pour une ECe saisonnière représentative de la zone racinaire, extrait de pâte saturée à 25 °C, sous les autres conditions supposées optimales. Les entrées doivent couvrir le cycle et la profondeur maximale des racines. Une mesure superficielle, une EC 1:5 ou une EC d'eau d'irrigation ne sont pas converties. Les coefficients à plage ou au produit ambigu sont exclus ; la conductivité particulière du riz submergé n'est pas assimilée à l'ECe du système terrestre.

Restriction conservatrice : perte calculée strictement inférieure à 50 %. Ce seuil est une limite d'implémentation ; il ne constitue pas une validation ni un seuil universel de survie. Une unité spatiale homogène terrestre, drainée, une surface semée validée et un Ym indépendant sans contrainte hydrique/saline sont obligatoires. Les cultures associées, riz submergé et nappes proches sont hors domaine. Les pertes ne sont ni cumulées avec la méthode hydrique ni soustraites une seconde fois par la surface récoltée. Un changement de contour invalide le scénario. Un changement de culture ou de profondeur peut rendre le scénario enregistré indisponible au recalcul.

## Recherche GAEZ et références territoriales

Sources primaires examinées :

- https://www.fao.org/gaez/en
- https://github.com/un-fao/gaezv5
- https://raw.githubusercontent.com/wiki/un-fao/gaezv5/21.-GAEZ-v5-Platform-User-Guide.md
- https://github.com/user-attachments/files/21917536/_readme_RES05.xlsx (noms de fichiers et dimensions)
- Bucket public `fao-gismgr-gaez-v5-data` : listes et métadonnées JSON accessibles. Exemple vérifié : `DATA/GAEZ-V5/MAPSET/RES05-YCX/GAEZ-V5.RES05-YCX.HP0120.AGERA5.HIST.MZE.HILM.json`.

GAEZ v5 est accessible. `RES05-YCX` représente un rendement atteignable moyen des terres cultivées actuelles ; `RES05-YXX` celui de la meilleure classe présente dans la maille. HP0120 correspond à 2001–2020, HIST à l'historique et HILM à l'irrigation avec conduite à intrants élevés. Cette dernière configuration ne représente pas un champ pluvial actuel. Le modèle général distingue produit et matière sèche ; le catalogue VACS YCAS annonce kg de matière sèche/ha, facteur 1. Cette information d'un autre produit ne suffit pas à qualifier automatiquement chaque raster RES05-YCX : échelle/nodata du fichier exact, produit et dénominateur, contraintes déjà intégrées, contexte variétal et compatibilité avec les surfaces doivent être vérifiés avant une conversion.

Les cartes de rendement atteignable combinent déjà des contraintes climatiques, de sol et de terrain. Elles restent donc **non injectées comme Ym indépendant de parcelle**. Une double pénalisation n'est pas une solution au manque de référence. Leurs limites de maille et leur climat historique ne deviennent pas des conditions observées du champ cette année.

FAOSTAT QCL : https://www.fao.org/faostat/ et https://data.fao.org/catalog/iso/d24a448b-3b62-4c09-8c1d-4a39bb599876. L'API `fenixservices.fao.org` répond HTTP 403 depuis cet environnement, mais le téléchargement officiel fonctionne :

`https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip`

Archive de 33 921 825 octets, SHA256 `c5835418c18f9322e7decbd6800f93a216eaae3cdfa31acb08f0518c0c6d6853`. Le catalogue annonce historiquement des rendements en hg/ha ; **l'archive réellement acquise contient kg/ha**, surface récoltée ha et production t. L'import vérifie les unités du fichier ; aucune division par dix sur ces kg/ha. Un éventuel hg/ha est converti en kg/ha avec conservation du brut et de l'unité (1 hg = 0,1 kg). Codes 5312/5412/5510, pays identifiés par M49. Les correspondances de produits et leur portée sont explicites : riz tous systèmes, piments/poivrons regroupés, arachide non décortiquée, espèces de mil et d'igname regroupées. Aucune de ces agrégations ne prouve la compatibilité avec le produit d'une parcelle.

Acquisition 2020–2024 :

| Pays | Observations pays/produit/année | Produits présents sur 21 recherchés | Produits sans ligne acquise |
|---|---:|---:|---|
| Togo | 70 | 14 | Niébé sec, concombre/cornichon, aubergine, piments/poivrons verts, oignon/échalote sec, gombo, pastèque |
| Bénin | 85 | 17 | Chou, concombre/cornichon, aubergine, pastèque |
| Burkina Faso | 80 | 16 | Chou, concombre/cornichon, aubergine, oignon/échalote sec, pastèque |
| Ghana | 80 | 16 | Fonio, voandzou, sésame, chou, pastèque |
| Côte d'Ivoire | 80 | 16 | Niébé sec, voandzou, chou, oignon/échalote sec, pastèque |
| Sénégal | 90 | 18 | Voandzou, concombre/cornichon, piments/poivrons verts |

Ces absences concernent cette extraction QCL et cette période ; elles ne signifient pas absence de culture dans le pays. Il existe 13 écarts de réconciliation production/surface/rendement au seuil 0,1 % ou 0,11 kg/ha ; ils sont conservés et signalés, sans correction automatique. L'arrondi des petites surfaces peut notamment produire des écarts. Les flags A (officiel), E (estimé), I (imputé), X (organisation externe) et M (manquant) restent attachés à chaque variable, avec la note source. Exemple Côte d'Ivoire, maïs 2024 : 1 640 661 t [A], 640 000 ha récoltés [X, note « Unofficial figure »], rendement 2 563,5 kg/ha récolté [E]. La production officielle ne rend pas automatiquement officiel le rendement estimé.

Le nouveau contexte national est acquis pour la Côte d'Ivoire ; le **panel administratif infranational** reste à acquérir et qualifier. Les archives administratives existantes ne sont ni remplacées ni mélangées. Aucun chiffre national n'est utilisé automatiquement comme Ym. Une date du conseil antérieure à l'acquisition bloque l'utilisation de ce nouveau contexte dans la prédiction passée. La source, le SHA256 et la date d'acquisition figurent dans l'API et l'export de l'audit.

Reproduction : `python3 scripts/acquire-faostat-context.py`. Pour retraiter exactement l'archive téléchargée : `python3 scripts/acquire-faostat-context.py --archive chemin.zip`. Snapshot versionné : `data/seasonal/faostat-context.json`. Les nouveaux téléchargements restent des opérations explicites hors CI.

## Données encore nécessaires

| Objet | Données et validation manquantes |
|---|---|
| Rendement crédible de chaque parcelle | Ym indépendant par culture/variété/produit/conduite, semé réel et pertes documentées ; récoltes et humidités indépendantes ; validation multi-sites et multi-années dans les six pays |
| Fertilisation et rendement | Azote minéral, P et K assimilables, méthodes/profondeurs, apports antérieurs, résidus ; courbes locales de réponse et interactions eau–nutrition |
| Inondation et survie | Hauteur/durée de submersion, drainage, stade et variété ; réponse calibrée, observations de mortalité et récupération |
| Chaleur et calendrier dynamique | Paramètres variétaux, seuils de développement/dommage, levée et floraison observées ; réponses calibrées |
| Toute la saison future | Forçages saisonniers d'ensemble accessibles et qualifiés ; compétence évaluée par pays/saison et vérification prospective des rendements |
| Irrigation multi-unités | Allocation partagée des débits, quotas, tours d'eau, énergie et disponibilité réelle |
| Riz submergé, associations et successions | Modèles et paramètres propres ; une campagne de culture terrestre unique ne suffit pas |

L'ECe peut être déclarée comme hypothèse modifiable pour le scénario isolé ; sa présence ne prouve pas qu'une analyse représentative est disponible. SoilGrids et NASA ne fournissent pas automatiquement ces données de terrain. Les paramètres descriptifs pH, texture, température ou azote total ne deviennent pas des facteurs arbitraires. Revue agronomique indépendante et validation au champ restent manquantes.

## Vérification logicielle

152 tests automatisés passent, dont nouveaux tests de NASA, ET0 FAO56, neuf cultures, salinité isolée, six pays synthétiques, dates, dénominateurs, paramètres absents, résultats/surfaces forgés, droits, sauvegarde et révisions. Les tests d'intégration, régressions et compilation passent également. Les acquisitions réelles sont rapportées séparément ci-dessus. Aucune métrique de validation de rendement n'est fabriquée.

API POST `/api/seasonal` : `nasa-history`, `data-readiness`, `salinity-scenario`. Les actions existantes de simulation, acquisition de sol, comparaison, diagnostic, sauvegarde et observation restent disponibles. Les nouvelles entrées sont optionnelles ; aucune migration destructive ou modification de permissions.

## Longs historiques et stockage

La provenance détaillée d'une année peut dépasser 2 Mo avant compression. Les requêtes de la seule API saisonnière acceptent jusqu'à 8 Mo (contrôle en octets UTF-8) ; les autres API gardent leur plafond. Les colonnes config/événements/plan volumineuses sont stockées avec une enveloppe versionnée `agri-deflate-json-1` et une compression sans perte. L'API et les exports restituent le JSON complet. Les anciens JSON non compressés restent lisibles, sans migration des anciennes révisions. Les valeurs, dates et sources ne sont pas supprimées pour gagner de la place.

La taille de la ligne compressée entière est contrôlée sous 1,8 Mo avant écriture, pour respecter la limite D1 de 2 Mo : https://developers.cloudflare.com/d1/platform/limits/. Un dépassement refuse la sauvegarde entière avec une explication ; aucune révision partielle n'est enregistrée. Un test de route sauvegarde et relit 365 jours et leur provenance après une requête dépassant 2 Mo ; les tests vérifient aussi l'ancienne sérialisation, le format compressé et les archives corrompues. Les traitements spatiaux différés restent inchangés.
