# Base expérimentale sol, eau et engrais — audit du 1 novembre 2026

Le code livré acquiert, contrôle et reconstruit une base relationnelle de recherche à partir de données réelles. Il n'entraîne pas de modèle et ne déclare aucun pays calibré. Les XLSX non commerciaux ont été acquis et contrôlés localement ; ils ne sont pas redistribués dans le dépôt. Les importeurs permettent leur acquisition explicite sous la licence du producteur. Les données expérimentales acquises concernent deux sites : Gagnoa en Côte d'Ivoire et Sangalkam au Sénégal. Leur licence CC BY-NC-SA 4.0 limite l'usage de ces fichiers et de leurs dérivés à la recherche non commerciale dans cette livraison. Le site publié n'embarque que les métadonnées de disponibilité et les limites ; le moteur de simulation n'utilise pas ces observations comme paramètres.

## Résultats vérifiés

| Jeu | Acquis et contrôlé | Usage possible et limite |
| --- | --- | --- |
| Gagnoa, Côte d'Ivoire | Classeur original, 1971–1990 : 3 840 lignes de cycles, 96 parcelles, 12 traitements, 8 blocs ; 292 prélèvements de sol ; 8 035 jours de pluie | Recherche sur N × compost dans un protocole donné. 8 lignes au champ `Crop=Second` sont conservées en staging et mises en quarantaine. 3 832 unités sont normalisées, dont 2 400 maïs. |
| SOERE PRO, Sénégal | Six classeurs originaux v3.1 : sol, composition et doses, conduite, carotte, laitue, tomate | 588 unités parcelle × culture × campagne sur 21 parcelles cultivées. 576 récoltes complètes quantifiables ; 12 restent indisponibles. Aucun essai maïs acquis dans ce jeu. |
| OFRA, archive CC0 août 2023 | SHA-256 du miroir Zenodo identique à celui annoncé par Dryad ; 6 146 lignes source, 534 fonctions dans les pays ciblés | 15 fonctions maïs Togo, 69 Burkina et 125 Ghana. Ce sont des fonctions ajustées, pas 209 répétitions d'essai ni un nouveau jeu de récoltes. Aucun point expérimental ne découle de leur évaluation. |
| WoSIS, pH eau | Requêtes WFS réellement exécutées dans les six pays : 11 954 enregistrements d'horizons dans cette propriété ; 4 977 conservés avec licences permissives | Contexte ponctuel avec méthodes, profondeurs, incertitudes et licences par ligne. Ni essais fertilisants, ni couverture exhaustive des propriétés du sol. Les lignes NC ne sont pas dans le sous-ensemble ouvert. |
| IITA, essais variétaux Togo | 112 lignes CSV conservées | Pas de dose d'engrais ou de répétition identifiée ; aucun rendement de parcelle n'est fabriqué à partir d'une entrée variétale. |
| Cartes Kara P/K/MO fournies | PDF acquis ; légendes et profondeurs 0–20 cm contrôlées | Classes régionales uniquement. Pas de point de sol acquis, de milieu de classe calculé ou d'extension vers d'autres horizons. |

La base de recherche normalise **4 420 unités parcelle × campagne**, dont 472 jachères explicites. Les effectifs ne sont pas des effectifs de validation indépendante : les mêmes parcelles et sites sont suivis dans le temps. Les sous-échantillons végétaux restent séparés. Les volumes de lignes manquantes sont dans `CONTROLES_IMPORT.json`, pas transformés en zéros.

Le [registre détaillé](REGISTRE_SOURCES.json) décrit 24 sources : propriétaire, URL d'accès et de licence, version, publication, dates de mesure, pays, cultures, système, profondeur, méthode, unité, support spatial, effectif, état d'acquisition et limites. Les booléens `catalogue_consulted`, `file_acquired`, `file_checked` et `usable_for` sont distincts. Une publication accessible ne vaut pas fichier brut disponible. La [matrice](COUVERTURE_PAYS_CULTURES.csv) contient les six pays × 31 identifiants de culture/système, y compris des cultures expérimentales extérieures au catalogue du moteur.

## Premier domaine retenu

Maïs **H507, premier cycle, Gagnoa, 1971–1976** : 576 unités (96 parcelles permanentes × six années), huit blocs et 12 combinaisons de traitements. Ce sous-ensemble est un candidat de recherche, après revue du protocole. Il n'est pas une validation actuelle des parcelles de Côte d'Ivoire.

Le classeur passe ensuite à IRAT83 alors que l'article décrit H507 pour le premier cycle. Les variétés du fichier sont conservées ; leur effet n'est pas séparé artificiellement de celui des années. L'allocation de la dose annuelle N aux cycles, le dénominateur semé/récolté, la surface nette récoltée et certaines méthodes analytiques restent à confirmer. Une réponse indépendante à P et K n'est pas identifiable : ces éléments appartiennent à la conduite de fond commune. Le témoin C0N0 est sans N minéral et compost, **avec** les apports communs P/K/S et dolomie.

Sangalkam constitue un second domaine de recherche sur les amendements organiques en maraîchage. SF100 est une référence fertilisée, pas un témoin sans engrais. Les trois cultures et la succession restent distinctes. Le cycle C10 de laitue est daté 2024 dans les récoltes contre 2025 dans la conduite et les doses : les 21 campagnes concernées restent sans lien de fertilisation plutôt que de corriger l’année. Ni les traitements de boues ni le protocole du site ne sont proposés aux utilisateurs comme prescriptions.

## Données bloquées ou insuffisantes

- Dryad diagnostic des éléments secondaires : notice et licence consultées ; API 401 et lien public 403, fichier non acquis. Le miroir CC0 de l'archive de fonctions OFRA a, lui, été téléchargé normalement et contrôlé.
- IITA Ghana maïs-élevage : embargo jusqu'au 1 décembre 2027, ressources `only_allowed_users`. La mention Open Access de la notice ne lève pas cette restriction. La méta-analyse IITA des apports organiques présente aussi une ressource restreinte. Aucune donnée reçue ni importée pour ces deux sources.
- Harvard, réplication engrais–rendement : accès public/API bloqué 403 depuis cet environnement. Les 12 081 observations annoncées ne sont pas des lignes acquises ici.
- WASCAL Vea/Dano/Dassari : catalogue repéré, fichiers et licence non acquis. IFDC Ghana : rapport consulté, brut par répétition non acquis. Les voies producteur INRAB, INERA, CSIR-SRI et ISRA sont consignées ; elles ne prouvent pas une acquisition.
- ISRIC cartes nutritives 250 m : catalogue du producteur contrôlé, rasters non acquis. Produit 0–30 cm distinct de SoilGrids ; P Mehlich-3 en pp100m (division par 100), K Mehlich-3 en ppm. Aucune fusion avec Olsen, Bray, Olsen-Dabin ou K acétate ammonium ; aucune conversion de profondeur arbitraire.
- SoilGrids standard conserve son rôle d'estimation cartographique dans le logiciel. Il ne fournit pas automatiquement P assimilable ou K échangeable. Son N total n'est pas N minéral disponible.
- Pour les six pays, les volumes réellement irrigués, les forçages hydriques complets, les droits d'usage et la validation sur des sites indépendants restent nécessaires avant un modèle opérationnel sol–eau–engrais.

Les PDF Kara possèdent des cadres GeoPDF avec points de contrôle (Lomé UTM 31N et WGS84), créés en décembre 2019 avec ArcMap 10.4. Ces métadonnées ne donnent ni les dates de prélèvement ni la résolution d’un raster original. Le [rapport des métadonnées PDF](CARTES_KARA_METADATA.json) conserve les empreintes et les systèmes déclarés. Aucun géoréférencement ne transforme une classe en mesure exacte.

Les originaux ponctuels des cartes Kara n'ont pas été récupérés auprès de l'ITRA. La demande précise à adresser au producteur figure dans [DEMANDES_PRODUCTEURS.md](DEMANDES_PRODUCTEURS.md) ; aucun message n'a été envoyé en votre nom.

## Audit du logiciel et des sauvegardes

Base inspectée : `main` à `b4d9c65692dce4ff2585e0230c9dc67d79319ed7`, arbre `bad05817699850da7b19d122b838ce8a32290007`. Les branches et les PR ont été consultées ; aucune PR ouverte au début de cette intervention. Aucun fichier AGENTS.md n'a été trouvé dans les emplacements inspectés. Les instructions du README et la CI ont été prises en compte.

Le bilan hydrique journalier 1.4.0 et le rendement conditionnel 1.2.0 sont conservés. Le calendrier manuel, les apports réalisés, les portées de contour, les cultures, les profils de sol, les méthodes chimiques et les contrôles de provenance ont été inspectés. Aucun code de dessin ou de découpage, de permission, de calcul de rendement ou de sauvegarde de campagne n'est remplacé par ces données.

Les archives existantes v24/HarvestStat/FAOSTAT sont territoriales. Elles restent des références historiques ; aucune dose ou conduite absente n'y est inventée. Le notebook v22 fourni contient 66 cellules, SHA-256 `8eddb3efac74903936cc31c3fd1c0f4eafcca71cbfcc4e93600e68f243355982`. Il est inspecté sans réexécution et sans modifier l'archive. Les projections du logiciel ne deviennent jamais des récoltes observées.

La persistance `seasonal_campaigns`/`seasonal_revisions`, les exports, les observations métier et l'encodage `agri-deflate-json-1` ont été inspectés. Le workflow [41291047879](https://github.com/fawitchamie-ai/agri/actions/runs/41291047879) confirme un point de restauration D1 avant migration au 1 novembre 2026, 09:00:28 UTC. Ce constat n'est pas un test de restauration complète. Le contenu des campagnes privées de production n'a pas été lu faute d'identité Access disponible ici ; aucun effectif privé ou jeu d'entraînement utilisateur n'est revendiqué. Un utilitaire local audite un export volontaire sans importer ses simulations comme labels.

Le [dictionnaire](DICTIONNAIRE.md) définit les tables, leurs liens, les dénominateurs, unités, valeurs nulles et statuts.

## Utilisation et reproduction

```bash
# Base ouverte de contexte, sans données NC ni essais couplés inventés
python scripts/calibration/build.py --output work/base-ouverte

# Originaux NC-SA : acquisition explicite après vérification des droits de recherche
python scripts/calibration/acquire.py --destination research-data/calibration/raw/research-only --include-noncommercial-research
# Base expérimentale de recherche non commerciale, SQLite + tables CSV
python scripts/calibration/build.py --output work/base-recherche --include-noncommercial-research

# Métadonnées de disponibilité à partir d'une reconstruction contrôlée
python scripts/calibration/evidence.py --database work/base-recherche/experimental.sqlite --quality work/base-recherche/quality.json

# Acquisition des versions originales épinglées, sans remplacer les fichiers du dépôt
python scripts/calibration/acquire.py --destination work/nouvelles-copies --include-noncommercial-research
python scripts/calibration/refresh_context.py --destination work/contexte-reacquis

# Revue privée d'un export de campagne, aucune publication ou entrée d'entraînement
python scripts/calibration/audit_campaign.py mon-export-campagne.json
```

La [preuve de réacquisition](ACQUISITIONS_REELLES.json) enregistre les sept originaux XLSX récupérés à nouveau et les trois instantanés ouverts reproduits. WoSIS varie l’ordre de ses lignes : le tri déterministe est vérifié sans arrondir ni changer leurs valeurs. Les SHA des octets originaux et des collections canoniques restent distincts. Ce contrôle d’acquisition ne constitue pas une validation des rendements.

Les importeurs utilisent la bibliothèque standard Python, sans exécuter les formules Excel et sans dépendance à un service lors de la reconstruction. Ils refusent une taille/SHA modifiée ou une sortie déjà occupée. L'acquisition enregistre les pannes et changements de version ; elle ne contourne ni embargo ni authentification. Les CSV/SQLite sont produits sous le dossier de sortie choisi et ne sont jamais chargés dans D1 de production. Seuls les instantanés ouverts sont distribués dans `research-data/calibration`. Les originaux NC-SA restent locaux et ignorés par Git ; leurs empreintes, citations, résultats de contrôle et importeurs sont livrés. La revue automatique d’approbation a refusé leur export public, faute d’autorisation explicite de redistribution publique. Aucun contournement ni publication de ces XLSX dans une branche de livraison n’est effectué.
