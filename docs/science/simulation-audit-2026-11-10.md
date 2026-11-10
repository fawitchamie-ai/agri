# Correction des simulations AgriPrévision — 10 novembre 2026

## Résultat et portée

Les corrections portent sur la conservation des entrées manuelles, l'affichage des résultats après modification/erreur, l'identification du build servi et les diagnostics nutritifs. Aucun paramètre de rendement n'a été ajusté sur les trois moyennes togolaises. Le moteur intégré demeure exploratoire dans les six pays. Les campagnes, migrations, carte et styles sont conservés.

Trois régressions sont reproduites sur `40d1884869172917cfcf8617b25ac84668a774cc` puis protégées par des tests sur le code corrigé. Les bilans du moteur ne justifiaient pas de supprimer la limitation K : sa présence explique le plafond de la reconstitution. Aucune précision parcellaire nouvelle n'est annoncée.

## Version de départ et publication

Le 10 novembre, `git ls-remote` et la consultation des workflows confirment main à `40d1884`. Aucune PR ouverte ni version main plus récente au début du travail. La copie de travail est isolée ; les copies anciennes présentes dans les autres espaces n'ont pas été modifiées.

Le run [42767723839](https://github.com/fawitchamie-ai/agri/actions/runs/42767723839) a terminé avec succès les jobs TypeScript/tests/build, moteur Python, publication et santé. Cela prouve la publication par cette pipeline, pas l'identité d'une réponse HTTP quelconque. L'appel direct initial à `/api/health` sans identité retourne 401 ; ses en-têtes et son corps sont archivés.

`GET /api/version` expose désormais seulement le commit injecté à la compilation, l'heure UTC du build, les versions des moteurs et du catalogue, et le statut non calibré. Cette route ne lit pas D1 et n'expose aucune identité, entrée utilisateur ou variable d'environnement. `/api/health` conserve ses protections et inclut la même identité du build. La vérification de publication refuse un commit servi différent de `GITHUB_SHA`.

Les preuves finales de publication et l'appel direct sont consignés dans `research-data/simulation-audit/2026-11-10/DELIVERY.md`.

## Causes corrigées

| Cas établi | Avant | Après | Protection |
|---|---|---|---|
| ET0/rayonnement corrigés, pluie encore automatique | Une acquisition reprenait toute la ligne météo ; ET0 2 devenait 5 mm/j | Priorité par champ ; ET0 2 et rayonnement 17 conservés avec provenance manuelle | `automatic-simulation.test.ts` |
| Humidité manuelle et nouvelle rétention incompatible | 0,23 m³/m³ devenait 0,188 ; les horizons/rétentions étaient remplacés | Le profil hydrique lié à la mesure manuelle est conservé ; les valeurs acquises restent au registre de source | même test |
| Modification pendant recalcul ou après échec terrain | Un plan précédent restait transmis à certains panneaux ; le drapeau pouvait redevenir non périmé après erreur | Toutes les vues utilisent uniquement un plan lié à la sérialisation complète espace/configuration/événements ; erreurs et contour en modification masquent les sorties périmées | `seasonal-scheduling.test.mjs` avec réponses inversées et échec 503 |
| Diagnostic nutritif agrégé | Jours limités par « nutriments », sans identification N/P/K | Nutriment(s) qui bornent effectivement le minimum journalier ; égalités conservées | `growth-water.test.ts` |
| Identification directe du service | Pas de commit public du build | Métadonnées minimales publiques et contrôle du SHA servi | `build-info.test.ts`, `deployment.test.mjs` |

La conservation du profil hydrique évite également une attribution par indice entre horizons de profondeurs différentes. Ce n'est pas une simulation d'eau au-dessus de la capacité au champ. Ces états restent refusés par le modèle actuel ; aucun plafonnement silencieux ni stockage de saturation inventé.

Les corrections de `0fc5fd9`, `3cdf5e8` et `40d1884` sont conservées : recalcul des apports, affichage de l'irrigation, observations d'humidité maintenues dans les comparaisons. Les quantités réalisées et prévues restent distinctes. L'empreinte de l'affichage contient toutes les entrées, et non seulement irrigation ou date ; il n'existe pas de cache de résultats agronomiques par empreinte partielle ajouté ici.

## Reconstitution togolaise

Les fichiers originaux `AgriPrevision_reconstitution_Togo_2026-11-10.md` et `AgriPrevision_dossier_reconstitution_2026-11-10.zip` n'ont pas été retrouvés dans les recherches de fichiers. Aucun script original correspondant n'a donc été prétendu exécuté. Un protocole de remplacement explicite est fourni : `scripts/reproduce-simulation-audit.mjs`. Il a été exécuté contre le vrai moteur du commit de départ puis contre le code corrigé, avec les mêmes entrées et sans optimisation de paramètres.

Source : Gadédjisso-Tossou, Avellán et Schütze, Water SA 46(1), 141–152, [DOI 10.17159/wsa/2020.v46.i1.7894](https://doi.org/10.17159/wsa/2020.v46.i1.7894). PDF téléchargé et tableaux/figure contrôlés. Les nombres simulés d'AquaCrop ne sont pas utilisés comme récoltes observées.

- Semis 16 décembre 2017, maturité 5 avril 2018 ; tableau 4 : 111 jours, stades 20/30/46/15 jours. Ces durées diffèrent des paramètres AquaCrop du tableau 1 et des durées Kc de la méthode ; nous retenons explicitement le tableau 4 pour la reconstruction des volumes de l'essai.
- Eau FI/80%/60% : 1 038,5 / 831,1 / 632,6 mm au total. Les volumes par stade sont conservés. Leur distribution journalière uniforme est reconstruite, les vraies dates n'étant pas acquises. Le tableau 3 appartient à une autre analyse de scénarios AquaCrop/densité et ne remplace pas ces volumes mesurés.
- Les événements utilisés par l'adaptateur de replay sont des scénarios déclarés et marqués `SCENARIO RECONSTRUCTION`, jamais des mesures instrumentales. Ils ne sont pas enregistrés dans une campagne ni importés en production. Le champ de l'archive s'appelle `reconstructionForcing`, distinct d'un carnet d'observations.
- Humidités initiales publiées 0,2872 et 0,2819 dans les deux premiers horizons, supérieures aux FC 0,2602 et 0,2559. Le validateur les refuse ; ce refus est archivé. Le replay remplace ces deux seules valeurs par une **hypothèse explicite FC**. Les deux horizons suivants gardent leurs valeurs publiées. Cela ne reproduit pas l'état hydrique initial complet.
- Racines limitées aux 0,5 m dont les horizons sont publiés ; extension à 1 m non identifiable faute de rétention sous 0,5 m. Infiltration : valeur conservative minimale des conductivités saturées du tableau 2 utilisée comme plafond exploratoire, pas comme loi d'infiltration calibrée. Pas de submersion, remontée capillaire ou asphyxie simulée.
- NPK 15-15-15 : 200 kg/ha à DAP15 ; urée 46% : 100 kg/ha à DAP35. Convention N–P₂O₅–K₂O supposée explicitement. Le moteur convertit en éléments P/K ; aucun stock absorbable n'est dérivé des analyses de sol.
- NASA POWER : requête arrondie 11°N/0°E, météo du 16/12/2017 au 05/04/2018, archive complète conservée. ET0 calculée par la fonction NASA/FAO56 réelle du dépôt. Données estimées de maille, acquises en 2026 ; la date du calcul est 2026-11-10, sans prétendre à une information disponible en 2017.
- RUE 1,5 g/MJ solaire global intercepté, HI 0,45, couvert et demandes N/P/K sont **illustratifs**, issus du profil déjà disponible. La variété TZEE-W est un nom, sans profil RUE local vérifié. Aucun coefficient CERES ou AquaCrop n'a été transféré automatiquement.
- Humidité grain 13%, milieu de la plage 12–14% publiée ; ni valeur exacte mesurée ni paramètre ajusté sur les rendements. Sensibilité à 12 et 14% conservée.

### Avant/après sur les mêmes entrées

| Traitement | Observé (t/ha) | Avant (t/ha) | Après (t/ha) | Jours limités par eau | Jours où K borne la croissance |
|---|---:|---:|---:|---:|---:|
| FI | 2,2004 | 2,574190 | 2,574190 | 2 | 62 |
| 80% FI | 1,8309 | 2,574190 | 2,574190 | 5 | 62 |
| 60% FI | 1,0683 | 2,574190 | 2,574190 | 54 | 62 |

FI et 60% sont imprimés numériquement dans le texte. 1,8309 t/ha provient de la valeur donnée par l'utilisateur ; sa cohérence avec la figure 7 et le DISI arrondi de 16,79% a été contrôlée, mais aucun fichier brut ni cellule numérique imprimée à cette précision n'a été acquis pour cette moyenne. Ne pas lui attribuer une précision documentaire supérieure.

Le contour du replay est synthétique (environ 1,21 ha), et non le contour mesuré des parcelles expérimentales de 20 m². La production exportée porte uniquement sur cette surface prévue de test ; aucune production réelle de l’essai n’est déduite de ce contour.

Le potassium disponible total illustratif, y compris la récupération de l'engrais, est consommé. L'eau peut modifier les jours de croissance sans modifier ce plafond final. Retirer cette limitation pour « corriger » la réponse à la sécheresse falsifierait le scénario.

| Domaine exploratoire | n | MAE (t/ha) | RMSE (t/ha) | Biais prédit−observé (t/ha) | nRMSE |
|---|---:|---:|---:|---:|---:|
| RUE/NPK illustratif, avant | 3 | 0,874323 | 0,993294 | +0,874323 | 58,4337% |
| Même scénario, après | 3 | 0,874323 | 0,993294 | +0,874323 | 58,4337% |
| Nutriments synthétiques non limitants, après | 3 | 7,914908 | 7,921262 | +7,914908 | 465,9932% |
| Référence fixe 2 t/ha (description variétale publiée, sans réglage sur ces trois moyennes) | 3 | 0,433733 | 0,558814 | +0,300133 | 32,8740% |

nRMSE = 100 × RMSE / moyenne des observations du même échantillon (1,699867 t/ha). Une seule station-saison et trois moyennes corrélées ; aucune validation indépendante. Aucun R² ni intervalle prédictif n'est présenté. La référence simple fait mieux que le scénario, ce qui interdit d'annoncer un gain de précision agronomique grâce aux corrections.

Le contrôle non limitant produit 10,139827 / 10,121477 / 8,583021 t/ha : le mécanisme eau agit, mais le paramétrage générique surestime fortement l'essai. Ces valeurs ne constituent ni une estimation des stocks réels ni une proposition de nouvelle calibration. La sensibilité à l'humidité 12–14% donne une RMSE de 0,967646 à 1,019741 t/ha ; c'est un choix exploratoire, pas un intervalle statistique.

## Données réellement accessibles et limites

La liste entrée par entrée, unités, source, statut et manque figure dans `input-inventory.csv`. Les fichiers acquis sont empreintés dans `sources.json`.

| Essai/source | Acquisition réelle | Exploitation et blocages |
|---|---|---|
| Togo irrigation 2017–2018 | Article PDF, tableaux 1–6, figure 7 ; NASA POWER JSON téléchargés | Replay ci-dessus, pas de validation ; apports journaliers et NPK accessibles inconnus |
| Ina, DMR-ESR-W, 2014–2015 | Annexe DOCX publique [figshare 7678853](https://api.figshare.com/v2/articles/7678853), DOI 10.3389/fenvs.2019.00013.s001, CC BY 4.0, MD5 vérifié | Tableau S1 extrait sans modification. LL/DUL/SAT, texture, C, nitrate/ammonium publiés ; pas de fourniture P/K accessible ni de météo journalière numérique de station. Les figures de sensibilité et de météo ne sont pas des tables de données brutes. Pas de simulation RUE interprétable avec ces seules entrées. |
| Sékou, serre 2023 | [Zenodo 14357601](https://zenodo.org/records/14357601), `Maize_growth_data.xlsx`, 321 644 octets, CC BY 4.0, MD5 `7a48e39dafbc08e680527d2a8f167d08` vérifié | 892 lignes germination, 5 400 croissance, 912 récolte. Masses fraîches d'épis en g ; humidité et fraction grain sec absentes. Pas de conversion en t/ha. Deux phases W1/W2 ne sont pas deux sites indépendants. |
| Parakou, fichiers expérimentaux complets | Non acquis | Les résultats DSSAT publiés ne deviennent pas des récoltes mesurées. |
| Fiches ITRA supplémentaires | Non acquises | Aucune réponse/clarification présumée. |

L'annexe Ina publie des profondeurs « 5–10 » et « 15–20 cm » avec des lacunes ; elles sont conservées. L'unité de densité est imprimée `g cm-1` : aucun stock N surfacique n'est calculé en corrigeant arbitrairement ce libellé. Le nitrate/ammonium ne dispense pas de caractériser les autres fournitures et leur dynamique. L'azote total, le P extractible, le pH, le carbone, la CEC et la texture ne sont pas changés en multiplicateurs de rendement.

Sékou : les statistiques descriptives par traitement, effectifs numériques et manquants sont dans `sekou-qualification.json`. Treize clés d'identité sont répétées et une ligne (837) ne peut être classée par W1/W2 ; rien n'est dédupliqué sans justification. Les chaînes/textes et valeurs manquantes ne deviennent pas des zéros. Aucune MAE/RMSE de rendement grain n'est calculée pour Sékou ou Ina faute de cible et d'entrées compatibles. Il n'existe pas de score global mélangeant ces essais.

Aucun mail n'a été consulté ou envoyé pour cette exécution. Les cinq demandes sont un historique de démarches, pas des données acquises. Aucune étape de livraison ne dépend de leur réponse.

## Distinction des méthodes

Le moteur intégré calcule la biomasse sèche journalière avec rayonnement, température, eau et minimum des disponibilités N/P/K, puis HI et humidité du produit. La réponse FAO demeure un calcul hydrique séparé ETa/ETm–Ky, sans rendement optimal inventé. QUEFTS demeure un scénario nutritif indépendant, sans intégration automatique de la sécheresse. Ces pénalités ne sont pas multipliées ensemble. Aucun effet phytosanitaire, bonus compost ou perte d'inondation n'a été ajouté.

Le service WOFOST 8.1–SNOMIN déjà présent dans le dépôt dispose de tests dédiés, mais aucun provisionnement ou raccordement au service en ligne n'est réalisé ici. Il n'est pas présenté comme moteur actif ou calibré des résultats RUE affichés.

## Vérifications

- 61 tests ciblés réussis : acquisitions/manuels, diagnostic K, contrôles eau/nutrition/co-limitation, pluie suffisante, irrigation compensatoire, observations conservées, réponses inversées, erreur terrain, métadonnées et refus d'un ancien SHA déployé.
- Tests hydriques synthétiques sur TGO/BEN/BFA/GHA/CIV/SEN et les quatre céréales terrestres déjà paramétrées. Cela vérifie le branchement logiciel, pas la précision locale. Tests existants de masses, humidité, N/P/K versus oxydes, surfaces et tonnes conservés.
- Vérification TypeScript et compilation locales réussies ; intégration HTTP/persistance et régressions d'autorisations réussies.
- Suite locale complète : le seul échec est le lancement de Chromium, interdit dans ce conteneur (`socket() failed: Operation not permitted`), sans modification du test pour le masquer. Un test live est ignoré. Le résultat CI complet fait foi pour le navigateur et le moteur Python.
- Lint global : 200 erreurs et 72 avertissements déjà présents, même compte sur main sans les fichiers de tests temporaires ; aucun nouveau résultat vert global revendiqué. Les nouveaux modules/scripts de build sont contrôlés séparément.
- Pas de migration nouvelle, pas d'entraînement en Worker, ni d'appel Python dans le Worker. Les diagnostics ajoutent seulement des comparaisons sur les jours déjà calculés.

## Reproduire

Node 24 et dépendances verrouillées du dépôt. Les archives gzip contiennent les configurations complètes, le forçage explicitement reconstruit et les sorties, avec commit de départ ; les résumés JSON permettent la lecture sans décompression. Python n'est nécessaire que pour qualifier les documents sources.

```bash
pnpm install --frozen-lockfile
python3 scripts/acquire-simulation-sources.py
# openpyxl et python-docx requis pour cette seule extraction :
python3 scripts/qualify-simulation-sources.py
node --experimental-transform-types scripts/reproduce-simulation-audit.mjs . /tmp/replay-current.json
# Dans un checkout du commit initial avec les mêmes dépendances :
node --experimental-transform-types scripts/reproduce-simulation-audit.mjs /chemin/checkout-40d1884 /tmp/replay-before.json
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
```

Les métriques et les entrées sont gelées avant ajustement ; aucun ajustement n'a lieu dans ce script. Une future calibration doit annoncer son domaine et ses critères, réserver des stations/saisons distinctes à l'évaluation et conserver une référence simple. Les données présentes ne justifient pas une certification dans les six pays.
