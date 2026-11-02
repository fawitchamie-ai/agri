# Engrais v2 — résultats et livraison du 2 novembre 2026

L’importeur, les évaluations et l’export descriptif sont exécutés. **Aucune réponse
parcellaire ni dose optimale n’est activée.** Les nouveaux diagnostics échouent
aux critères enregistrés. Les observations utiles sont ajoutées à l’application,
avec séparation des systèmes et des interventions.

## Point de départ et gel

- Reprise exacte : `f2fcd53c485d97af70a10ec82559a7fa334213c3`, descendant du main
  `9442c254d3409646138b2311f5b9888aaca2422a` (PR #21). Main n’avait pas évolué lors
  de la reprise. L’ancien checkout et ses changements non publiés sont préservés.
- Le fichier local `fertilizer_expansion.py` retrouvé attendait d’autres entrées
  et permettait des contrastes maïs insuffisamment qualifiés. Il n’est pas repris.
- Les six ZIP ont passé les contrôles SHA-256, taille, intégrité ZIP, licence,
  nombre de lignes et unicité des identifiants. Les originaux sont conservés.
- Les deux suppléments Frontiers originaux sont acquis et épinglés dans
  `supplement-sources.json` (CC BY 4.0, attribution Vandamme et al.). Ils remplacent
  leur copie Carob, sans ajouter de doublons. L’archive Carob reste intacte.
- Le gel local `4857a49` précède le premier calcul des scores v2. Son arbre exact
  est publié au commit [1c877d7](https://github.com/fawitchamie-ai/agri/commit/1c877d70539e3af44ca4ab93036435f48461f1bd).
  Le protocole initial reste intact ; `IMPLEMENTATION.json` décrit les décisions
  prises avant scores. `FREEZE.json` fige identifiants, sources et empreintes.

## Import et qualification

AMAZXA fournit 1 203 cellules de rendement grain non manquantes dans les
suppléments. Les identifiants d’environnement permettent de relier les deux
feuilles. Le champ Trial du classeur de rendement fusionne à tort plusieurs
essais puis décale les suivants ; celui de Table_1 est cohérent avec le tableau
de l’article et prévaut. Les deux valeurs sont conservées pour l’audit.

L’appariement exige pays, site, essai, année, saison, système et variété, un seul
bras +P et un seul -P, ainsi que N/K connus et identiques. Les valeurs manquantes
ne deviennent jamais zéro ni la valeur du bras voisin. Les estimations ajustées
de rendement négatives restent dans les données harmonisées mais leurs
contrastes sont rejetés ; les différences négatives physiquement admissibles
sont conservées. `rep` reste un nombre de répétitions, sans blocs fabriqués.
Les rendements g/m² sont convertis en kg/ha (×10), à 14 % d’humidité selon les
méthodes de [Vandamme et al.](https://doi.org/10.3389/fpls.2016.01435).

Résultat : **412 contrastes P, sept sites, 14 campagnes, une publication**.
Ils comprennent Bénin 234, Burkina Faso 33, Gambie 37, Nigeria 71 et Philippines
37. Les sites cibles ne sont que Bohicon, Cotonou et Farako-Ba. Une variété
partagée entre pays ne constitue pas une validation sur un génotype inédit.
Les champs voisins +P/-P n’établissent pas une affectation aléatoire du P.
Ce témoin contient déjà N et K ; il ne représente pas un rendement sans engrais.
La seule dose de P admise est 30 kg P/ha ; aucune courbe continue n’est identifiée.

GFWCYQ fournit **45 contrastes NPK, 15 campagnes, un site** à Ndiaye. Les trois
doses N=60/120/180 ont P=26 et K=50 kg élémentaires/ha. Leurs témoins sont partagés
dans chaque campagne. Le protocole de [Kouadio et al.](https://doi.org/10.1371/journal.pone.0317170)
applique chaque régime aux mêmes parcelles au fil du temps : le contraste
inclut l’héritage de fertilisation. Les lignes du Niger et les sorties APSIM
ne sont pas utilisées pour cet objectif. L’humidité reste inconnue.

Les quatre autres archives restent hors calibration. Les tentatives publiques
documentées dans `access-attempts-20261102.json` répondent encore HTTP 403 pour
les originaux TROYBD et BBKJH0. Les recherches sur le titre, le nom exact du CSV
et les publications n’ont pas apporté de copie originale téléchargeable et
autorisée. La publication Ichami et al. renvoie à deux suppléments DOCX ; aucune
copie du CSV original avec ses identifiants de paire n’a été acquise par cette voie.
Les métadonnées ne sont pas présentées comme des fichiers de données acquis.
4CFDEG n’est jamais ajouté à GFWCYQ, compte tenu du recouvrement expérimental
possible. SRANPI reste un changement de stratégie incluant variété/amendements.

`harmonized.json`, `pairs.json`, `rejected.json` et `IMPORT_AUDIT.json` rendent
chaque inclusion et exclusion traçable. `COVERAGE.csv` sépare lignes d’archive,
contrastes admis, sites, campagnes et publications dans les six pays.

## Évaluations réellement exécutées

Erreurs en t/ha ; biais = prédit − observé. Les scores sont pondérés par site
pour AMAZXA, par campagne pour GFWCYQ. Les sites ne sont pas tous des études
indépendantes. Les seuils n’ont pas changé après les scores.

Après les premiers scores, la revue du code a rendu les références par système
explicites dans le rapport, pour que l’export consomme directement les résultats
publiés sans dépendre d’un second fichier de prédictions. Cette correction
d’export ne modifie aucun identifiant, partition, candidat, ajustement, score,
intervalle ou seuil de décision.

| Diagnostic | Contrastes évalués | Sites | MAE gain | RMSE gain | Biais gain |
|---|---:|---:|---:|---:|---:|
| AMAZXA, pays exclu et sélection interne par site | 412 | 7 | 0,793 | 1,020 | −0,079 |
| Référence moyenne, mêmes pays exclus | 412 | 7 | 0,686 | 0,926 | +0,014 |
| Comparaison hiérarchique prédéfinie, mêmes pays exclus | 412 | 7 | 0,664 | 0,886 | −0,073 |
| Bénin, pays entièrement exclu | 234 | 2 | 0,903 | 1,200 | +0,183 |
| Burkina Faso, pays entièrement exclu | 33 | 1 | 0,317 | 0,401 | +0,135 |
| Ndiaye, test temporel 2021–2022 | 9 | 1 | 0,693 | 0,817 | −0,253 |
| Référence moyenne Ndiaye, même test | 9 | 1 | 0,669 | 0,831 | −0,253 |

AMAZXA compare moyenne et ridge 0,1/1/10 ; les normalisations sont apprises
uniquement sur les sites d’entraînement. Le modèle hiérarchique exécute des
intercepts de site régularisés et des effets fixes ; un nouveau site reçoit une
déviation de site nulle. Son amélioration globale d’environ 3,3 % reste sous 10 %,
avec une MAE supérieure à 0,5 t/ha. Il n’est pas promu après consultation du test.
Les seuls pays cibles admis ont au plus deux sites chacun. Même le score
numérique encourageant du Burkina ne qualifie pas une prévision parcellaire.

Pour Ndiaye : apprentissage 2015–2018 (24 contrastes/8 campagnes), sélection
2019–2020 (12/4), test 2021–2022 (9/3). La saturation tau=30 est retenue devant
tau=60/120, la moyenne et les moyennes par dose. L’ajustement reste celui de
l’apprentissage, sans réentraînement sur les années de réglage. L’ordonnée à
l’origine n’est pas interprétée à N=0 : P/K sont ajoutés avec N et l’historique
diffère. Aucune extrapolation ou optimisation n’est exportée.

Les niveaux de rendement sont aussi évalués sans injecter le vrai témoin du
test comme prédicteur : MAE témoin/traité 1,534/1,246 pour AMAZXA et 0,912/0,937
pour Ndiaye. Les erreurs par pays, système, site/année, candidats et identifiants
des partitions figurent dans `VALIDATION.json` et `predictions.json`.

Les quantiles des résidus AMAZXA sont **rétrospectifs**, sans garantie prédictive.
Pour Ndiaye, deux années de calibration imposent un rang 3 alors que seuls deux
maxima annuels existent : rayon, couverture et largeur à 95 % restent `null` pour
gain, témoin et traité. La sélection sur ces mêmes années et la répétition des
parcelles limiteraient aussi une certification. Aucun intervalle fini n’est inventé.

QUEFTS reste non identifiable pour ces contrastes : offre indigène N/P/K,
absorption et bornes d’efficacité conjointes ne sont pas qualifiées. Les
concentrations de P après traitement ne remplacent pas ces entrées. Le moteur
WOFOST existant n’est pas paramétré arbitrairement. Aucune erreur de décision
économique n’est estimée sans prix vérifiés et réponse validée.

## Parties opérationnelles

L’export léger `data/seasonal/fertilizer-extension.json` contient dix groupes
d’observations et quatre diagnostics pays/système. Il exclut les coefficients
de modèles et ne déclenche aucun entraînement à la requête.

- Bénin : riz aérobie avec irrigation d’appoint et riz de bas-fond, contrastes P séparés.
- Burkina Faso : riz pluvial/aérobie, contrastes P à Farako-Ba.
- Sénégal : riz de bas-fond irrigué à Ndiaye, trois régimes NPK par saison.
- Togo, Ghana, Côte d’Ivoire : informations manquantes explicites, sans nouveau
  contraste v2 prétendument validé. Les observations maïs togolaises historiques
  de la PR #21 restent disponibles séparément.

Dans « Mes engrais et leurs effets », les modalités, doses élémentaires,
rendements médians, différences appariées, dispersion, effectifs, dates,
provenance et limites sont consultables. Les observations sont filtrées par
pays, culture/système et date de disponibilité. Ni leurs médianes ni la moyenne
FAOSTAT ne sont ajoutées au modèle hydrique. Les quantités de produits,
nutriments, dates et scénarios économiques existants sont conservés. Aucun
nouveau calendrier personnalisé n’est déduit d’un protocole de station.

## Reproduction et vérification

```bash
python3 scripts/calibration/fertilizer_v2_import.py --prepare
python3 scripts/calibration/fertilizer_v2_evaluate.py --evaluate
python3 scripts/calibration/fertilizer_v2_export.py
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
```

Contrôles locaux exécutés : TypeScript, **213 tests Node réussis**, dont huit
nouveaux cas Python v2 via la suite Node, intégration HTTP, persistance et
régressions réussies ; compilation réussie. Les 14 cas Python facultatifs NC
absents sont explicitement ignorés par la suite d’audit existante, sans être
comptés comme validations agronomiques. Le test de route des nouvelles
observations vérifie authentification, pays/système, disponibilité et maintien
des révisions/permissions des campagnes.

Publication : PR dédiée depuis `feat/fertilizer-validation-v2-delivery`, puis
workflow GitHub existant. Les preuves finales de CI et de publication sont à
consulter sur la PR et le run main. L’appel non authentifié à `/api/health` a
répondu 403 dans cet environnement ; aucune recette humaine authentifiée en
production n’est revendiquée. Une compilation ou un job de publication ne vaut
pas à lui seul une visite authentifiée de l’interface.

## Prochain point de reprise

Repartir de main après la PR dédiée ou de la branche de livraison. Les tests v2
ont été consultés : conserver leur statut diagnostique. Ne pas redécouper ces
mêmes données pour annoncer un nouveau test prospectif. Les pistes prioritaires
sont les identifiants et protocoles originaux de TROYBD/BBKJH0, la qualification
de l’humidité et des recouvrements des expériences sénégalaises, puis des essais
indépendants dans chaque domaine cible. Une nouvelle méthode ou de nouvelles
données exigent leur propre protocole gelé avant leurs scores.

Retour arrière : revenir au code parent via PR et workflow, sans restauration
ni effacement des campagnes ou des essais. Aucune migration, modification
d’authentification ou collecte de données privées n’a été ajoutée ici.
