# Reprise engrais — 2 novembre 2026

## État exact

Base : `main` au commit `9442c254d3409646138b2311f5b9888aaca2422a` (PR #21).
Branche de reprise : `feat/fertilizer-validation-v2`.
Cette branche contient un **point de sauvegarde de recherche**, pas une nouvelle
version opérationnelle du modèle. Aucun importeur v2, entraînement v2, score v2,
changement d'interface ou déploiement v2 n'a été exécuté ici.

La PR #21 décrit 554 paires / 25 localités ; son test corrigé comporte 125 paires
/ 7 localités. MAE du gain : 0,963 t/ha au total ; 1,123 au Togo (21 paires,
2 localités). Le premier découpage avec deux alias d'une même localité est
invalidé. Les scores sont diagnostiques, pas une certification indépendante.

## Fichiers acquis et contrôlés

`research-data/fertilizer/v2/sources.json` conserve les URLs, empreintes SHA-256,
licences annoncées dans les métadonnées Carob et effectifs. Les six ZIP sont
conservés, ouverts et lisibles, tous CC0-1.0 selon leur fichier `_meta.csv`.

| DOI 10.7910/DVN/… | Lignes | Utilité et décision actuelle |
|---|---:|---|
| AMAZXA | 1223 | Riz, phosphore, dont Bénin 550 et Burkina 105. Appariement variété/essai à coder. |
| GFWCYQ | 156 | Riz Sénégal 60 lignes à Ndiaye, autres 96 lignes de mil au Niger. Diagnostic temporel du riz à coder. |
| BBKJH0 | 664 | Riz : Nigeria 381, Burkina 80, Mali 94, Côte d'Ivoire 36, Sierra Leone 16, Ghana 57. Stratégies complètes, pas effet isolé garanti. |
| 4CFDEG | 372 | Riz Sénégal, deux localités. Quarantaine pour incohérences de dose/coordonnées/qualification. |
| TROYBD | 936 | Maïs, dont Togo 76, Ghana 24, Bénin 2, Côte d'Ivoire 2. Couples originaux à récupérer avant calibration. |
| SRANPI | 86 | Riz Sénégal : changements de variété et d'apports combinés ; inventaire seulement. |

Ces effectifs sont des lignes, **pas** des essais indépendants ou des paires.
Les bases ne sont pas encore fusionnées ou harmonisées.

## Pièges vérifiés dans les sources

- AMAZXA : article `https://doi.org/10.3389/fpls.2016.01435`. Rendements grain à
  14 % d'humidité, moyennes ajustées par génotype. `rep` désigne le nombre de
  répétitions, pas un bloc. Les environnements +P/-P sont des parcelles voisines ;
  ne pas affirmer que l'affectation du phosphore y est randomisée. N/K doivent
  être identiques et connus. Plusieurs lignes -P ont N/K manquants ; ne pas les
  remplacer par zéro. La seule dose +P n'identifie pas un optimum continu.
- GFWCYQ : article `https://doi.org/10.1371/journal.pone.0317170`. À Ndiaye,
  traitements 0-0-0, 60-26-50, 120-26-50, 180-26-50 kg N-P-K/ha, même parcelle
  traitée au fil des années. Les 15 campagnes entre 2015 et 2022 ne constituent
  qu'un site. Effet du régime de longue durée, pas seulement de l'apport courant.
  Humidité non qualifiée dans l'archive. Ne pas importer les résultats simulés
  d'APSIM comme récoltes observées ni ses scores comme scores de notre modèle.
- 4CFDEG : le traitement T5 est nommé N26-P26-K50 mais la colonne N indique 180.
  Le script Carob ajoute 14 % d'humidité sans justification source ; les
  coordonnées Ndiaye diffèrent de celles de GFWCYQ. Possible même expérience
  de longue durée : séparer train/test par archive serait insuffisant.
- BBKJH0 : conflit entre l'abstract (P2O5/K2O) et le dictionnaire annoncé (P/K).
  `hhid` absent dans tous les pays cibles de ce jeu ; ne pas apparier arbitrairement
  par ordre de ligne ou seul nom d'essai. Contrôler variété, date, conduite,
  identifiants originaux et affectation. Les lignes Ghana représentent 29 FP
  contre 28 RAL. Une stratégie RAL n'est pas automatiquement un effet d'engrais.
- TROYBD : identifiant de paire supprimé dans la transformation Carob et
  dédoublonnage appliqué. Des taux contredisent le libellé : 50 kg N devient 500
  dans un enregistrement ; 40 kg P devient 20 dans un autre. Plusieurs campagnes
  togolaises n'ont plus d'année. Sekou/Glidji : affectation pays à confirmer dans
  les sources primaires. Ne pas réparer par simple supposition.
- SRANPI : variété, zinc, gypse et NPK changent ensemble ; pas de réponse NPK
  isolée par défaut. Humidité non documentée.

Scripts Carob inspectés au commit `44a628274b59e8c71eef5c0490e7bf2846ef4465`
de `https://github.com/carob-data/carob`. Copie locale éventuelle :
`/workspace/scratch/263791ed680e/carob-audit` ; ne pas supposer qu'elle persistera.

## Accès aux originaux : ne pas confondre métadonnées et données

L'endpoint `/api/datasets/:persistentId/` répondait 403. L'export public a réussi :
`https://dataverse.harvard.edu/api/datasets/export?exporter=dataverse_json&persistentId=doi:10.7910/DVN/TROYBD`
et son équivalent BBKJH0. Les deux JSON sont dans `raw/`.

Les téléchargements `/api/access/datafile/{id}` ont ensuite répondu **403** :

- TROYBD : 3603449 (CSV original des paires), 3603448 (références),
  3603447 (autre tableau, identifié dans les métadonnées mais non demandé ici).
- BBKJH0 : 14102691 (`data.xls`), 13094736 (`dictionary.xls`).

`original-sources.json` enregistre les quatre tentatives échouées. Les classeurs
et CSV originaux ne sont donc **pas acquis**. Chercher un accès public ordinaire,
une copie autorisée ou les suppléments ; ne pas contourner une restriction.

## Prochaine étape

1. Lire le protocole `PROTOCOL.json`, établi avant calcul des nouveaux scores.
2. Écrire un importeur v2 reproductible avec vérification des empreintes,
   appariement explicite, journal de rejets et aucune modification des originaux.
3. Prioriser AMAZXA et GFWCYQ ; évaluer leurs objectifs séparément. Rechercher
   les originaux TROYBD/BBKJH0 pour débloquer les autres pays et le maïs.
4. Geler les identifiants/fichiers de données dérivées avant évaluation. Toute
   modification du protocole doit être motivée et historisée avant les scores.
5. Comparer les modèles selon le protocole ; enregistrer erreurs, biais,
   intervalle disponible ou non, effectifs indépendants et domaine précis.
6. Intégrer seulement les sorties justifiées ; tester puis publier les parties
   opérationnelles selon l'autorisation existante. Aucun objectif de couverture
   des six pays ne permet de falsifier les critères ou les résultats.

L'ancien checkout `../agri` contient des changements locaux antérieurs ; il a
été conservé intact. Repartir de la branche propre et comparer avant toute reprise.
