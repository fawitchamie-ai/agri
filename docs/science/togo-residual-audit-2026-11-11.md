# Pourquoi le rejeu surestime encore le grain

Base vérifiée : main et Worker e587d60234f4a308b0d21ae0c58eaecb7e58ace8. Audit isolé, sans changement des profils nationaux, du moteur physique partagé ou des campagnes existantes.

## Cause numérique établie et cause de terrain inconnue

Le traitement 80% atteint ETa/ETm=1 pendant installation, végétation, floraison et formation du grain. Seule la maturation est pénalisée (ratio 0,87658 ; Ky=0,2). Ainsi le moteur lui attribue presque le rendement FI, indépendamment des nutriments. Le scénario contient 831,1 mm d'apports, dont 165,32 mm sont drainés hors de la zone racinaire. Le cumul appliqué n'est pas le déficit physiologique.

L'efficacité supposée 100%, les dates uniformes et la représentation des phases expliquent cette saturation DANS LE CALCUL. Ils ne démontrent ni pertes réelles de 21%, ni défaut réel de l'irrigation. Le traitement 80% de l'article avait un calendrier optimisé (OCDI), distinct de la réduction de chaque événement décrite pour 60%. Les dates exactes n'étant pas acquises, les cinq calendriers partagés sont une sensibilité restreinte, pas une enveloppe complète des calendriers réels.

Le bilan de demande présente une compensation temporelle :

| Phase hydrique | Reconstitution précédente mm | Tableau 4 mm | Écart mm |
|---|---:|---:|---:|
| Initiale | 63,750 | 82,4 | -18,650 |
| Développement | 172,732 | 203,7 | -30,968 |
| Mi-saison | 414,231 | 385,8 | +28,431 |
| Fin | 106,378 | 83,3 | +23,078 |
| Total | 757,091 | 755,2 | +1,891 |

Les valeurs du tableau 4 sont une ETc calculée avec la station et les Kc, PAS une mesure d'ETa. La proximité saisonnière masquait des erreurs de répartition. Une ablation redimensionne l'ET0 NASA dans chaque phase pour retrouver ces quatre cumuls, tout en gardant ses variations journalières. Cette reconstitution n'est pas une météo mesurée. À elle seule, elle dégrade la RMSE des deux déficits de 0,331 à 0,479 t/ha. L'ablation Kc constant par phase donne 0,389. Les résultats défavorables sont conservés.

## Procédure et nouveau candidat

Le script exécute d'abord les trois ablations sans réglage sur les déficits. Pour l'étape suivante, deux paramètres communs seulement : capacité de rendement calculée sur FI, efficacité hydrique effective explorée sur la grille 0,60–1,00 par pas de 0,01. Critère : erreur quadratique du seul 80%, arrêt après 41 valeurs. Les bornes sont des hypothèses de sensibilité, pas une plage mesurée. Les Ky et la phénologie restent fixés. Aucune optimisation de N/P/K, RUE ou HI. Le calendrier quotidien est conservé, pas sélectionné selon l'erreur.

La capacité retenue est 2 200,4 kg/ha et l'efficacité effective 0,79. La récolte 60% n'entre pas dans la sélection. Elle était déjà connue et utilisée dans des travaux antérieurs : évaluation interne, jamais aveugle ni indépendante. La valeur 80%=1 830,9 kg/ha demeure celle du rejeu, cohérente avec le DISI publié, sans répétitions brutes disponibles ; ses décimales ne garantissent pas cette précision expérimentale.

| Traitement | Observé t/ha | Référence v1 | Candidat | Rôle dans candidat |
|---|---:|---:|---:|---|
| FI | 2,2004 | 2,2004 | 2,2004 | Ajustement capacité |
| 80% | 1,8309 | 2,1558 | 1,8454 | Ajustement efficacité |
| 60% | 1,0683 | 1,4055 | 0,9883 | Évaluation interne réservée |

| Ensemble | MAE avant/après t/ha | RMSE avant/après t/ha | Biais avant/après t/ha |
|---|---:|---:|---:|
| Ajustement FI+80 | 0,1625 / 0,0073 | 0,2298 / 0,0103 | +0,1625 / +0,0073 |
| 60% réservé, n=1 moyenne | 0,3372 / 0,0800 | 0,3372 / 0,0800 | +0,3372 / -0,0800 |
| Ensemble des trois, descriptif | 0,2207 / 0,0315 | 0,2704 / 0,0469 | +0,2207 / -0,0218 |

Y80/YFI : observé 0,8321 ; avant 0,9797 ; après 0,8387. Y60/YFI : observé 0,4855 ; avant 0,6387 ; après 0,4492. Grain 13% : convertir toutes les observations ET sorties vers 12% multiplie par 0,87/0,88 ; vers 14% par 0,87/0,86. Ces variations ±1,2% n'expliquent pas le biais initial de 0,33 t/ha. Aucune conversion épis frais/grain ni comparaison implicite à la biomasse sèche.

## Robustesse et non-identification

Paramètres quotidiens figés, sans réajustement :

| Calendrier | FI / 80 / 60 t/ha | Erreur absolue 60 t/ha | RMSE trois t/ha avant/après |
|---|---|---:|---:|
| Quotidien | 2,200 / 1,845 / 0,988 | 0,080 | 0,270 / 0,047 |
| 3j début | 2,184 / 1,740 / 0,929 | 0,139 | 0,234 / 0,097 |
| 3j fin | 2,186 / 1,813 / 1,004 | 0,065 | 0,272 / 0,040 |
| 7j début | 2,003 / 1,659 / 0,883 | 0,185 | 0,205 / 0,185 |
| 7j fin | 1,927 / 1,746 / 1,021 | 0,047 | 0,309 / 0,168 |

L'amélioration subsiste sur ces cinq scénarios, mais FI devient sous-estimé jusqu'à 0,274 t/ha. La nouvelle méthode n'est donc pas déclarée satisfaisante au champ.

Diagnostic séparé : réajuster sur FI+80 pour chaque calendrier (sans sélectionner sur 60) donne des efficacités 0,73–0,81, capacités 2,200–2,559 t/ha et prédictions 60 de 0,970–1,010 t/ha. Les écarts d'ajustement 80 ne dépassent pas 0,015 t/ha. Ce sont plusieurs profils explicatifs, pas des intervalles de confiance. L'efficacité est confondue avec le calendrier, l'ET quotidienne et le stockage ; impossible de retrouver une propriété physique unique à partir des seules récoltes.

## Chaîne contrôlée et intégration

Entrées météo complètes et dates consécutives ; doses conservées par stade ; mm/m3 et surface ; efficacité appliquée une fois ; résidus du bilan <1e-8 mm ; facteur de grain commun ; absence de double pénalité RUE/QUEFTS ; production=kg/ha×ha ; export ; changement des apports et retour au scénario initial. Les tests passent par planSeason, pas seulement une formule parallèle. Un défaut d'interface est corrigé : une erreur de calcul efface désormais anciennes phases, métrique et export, pour éviter de garder une RMSE périmée.

Aucun bug arithmétique expliquant les +0,33 t/ha n'a été démontré dans le chemin exercé. Cela ne certifie pas toutes les fonctions de l'application. Les échecs de biomasse/couvert de l'ancien profil ne sont pas corrigés par cette équation de grain. Le candidat n'a pas de sorties de biomasse, de couvert ou de nutrition, donc pas d'amélioration agronomique complète revendiquée. HI générique de RUE n'intervient pas dans ce calcul et ne peut expliquer son biais résiduel.

Le candidat est sélectionnable explicitement dans le laboratoire public. La référence v1 reste le choix initial et les campagnes gardent leur méthode. Le profil local versionné et ses limites sont dans `lib/seasonal/profiles/togo-residual-v1.json`. Les six pays ne reçoivent aucun nouveau coefficient par défaut.

Reproduire : `node --experimental-transform-types scripts/togo-residual-audit.mjs`. Données exhaustives, phases, grille et profils alternatifs : `research-data/togo-residual/2026-11-11/audit.json`. Comparaison de référence : `scripts/togo-stage-benchmark.mjs`.

Sources : article https://doi.org/10.17159/wsa/2020.v46.i1.7894, pp142–144 et tableau4 p146 ; coefficients inchangés https://www.fao.org/4/X5647E/x5647e0e.htm. L'article acquis est conservé dans les archives préexistantes ; aucune donnée d'équipe supposée reçue.
