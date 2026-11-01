# Prompts 4 et 5 — calibration contrôlée et parcours des apports

Livraison du 1 novembre 2026, à partir de `42ffef9` (PR #18). La méthode et les garde-fous sont implémentés ; **aucun domaine agricole local n'est déclaré calibré** et le service Python externe reste à raccorder. Le bilan hydrique conditionnel existant demeure disponible avec ses références et limites.

## Résultat de la qualification des données réelles

Les sept XLSX CIRAD ont été réacquis sous leurs licences de recherche non commerciale et contrôlés par leurs empreintes épinglées. Un téléchargement de carotte a renvoyé HTTP 503 ; une nouvelle acquisition de ce fichier a réussi avec l'empreinte attendue. La base de recherche reconstruite contient 4 420 unités parcelle × campagne, sur Gagnoa (Côte d'Ivoire) et Sangalkam (Sénégal). Les originaux, la base et les éventuels modèles dérivés NC restent dans les répertoires locaux ignorés ; aucun brut n'est embarqué dans l'application.

Le rapport [QUALIFICATION_MODELES.json](QUALIFICATION_MODELES.json) qualifie dix combinaisons pays/culture/variété de la source, y compris la jachère qui n'est pas une culture à calibrer. Chaque combinaison ne possède qu'un groupe de site indépendant. Les répétitions et années d'une même parcelle n'ajoutent pas des sites. Les réserves du prompt 1 restent applicables : N annuel non attribuable arbitrairement à chaque cycle, dénominateurs non résolus à Gagnoa, fond P/K commun, conduites et produits frais/secs à distinguer. Les 978 observations de l'étude Ghana ne sont pas un fichier brut acquis ici : la [page IFDC vérifiée](https://hub.ifdc.org/items/c6ec6f43-fcc4-4bea-85a0-4bfa38525551/full) met à disposition l'article. Le portail [CPCN](https://cropnutrientdata.net/) ne devient pas une base importée par sa consultation.

| Domaine géographique | État de calibration et métriques |
| --- | --- |
| Togo, Bénin, Burkina Faso, Ghana | Aucun domaine local qualifié dans les essais bruts acquis pour cette livraison. MAE/RMSE/biais non calculés. |
| Côte d'Ivoire, Gagnoa | Candidat de recherche maïs ; doses par cycle, dénominateurs et test indépendant à qualifier. Aucun coefficient ajusté publié. |
| Sénégal, Sangalkam | Essais organiques maraîchers réels, un seul site ; compatibilité du moteur/produit/cultivar et test indépendant manquants. |

Aucune observation territoriale, fonction OFRA déjà ajustée, simulation utilisateur ou fixture synthétique n'est promue en essai. Les rendements scientifiques du mémoire et les campagnes privées ne servent pas de labels supplémentaires.

## Plan et pipeline exécutables

[PLAN_CALIBRATION.json](PLAN_CALIBRATION.json) fixe cible, pondération, familles de modèles, étapes, graine et règles de séparation **avant tout ajustement**. C'est un plan de méthode à compléter par domaine : ses bornes, seuils d'acceptation, données et sites de test ne sont pas inventés. Tant qu'ils restent absents, ce fichier ne passe pas la validation du pipeline et n'est pas un protocole de calibration locale achevé.

Le pipeline `scripts/calibration/validation_pipeline.py` exige un jeu canonique avec provenance/licence, culture/variété/système/produit, dose N par cycle, rendement sec par hectare semé, dates de disponibilité et qualification du protocole. Il vérifie l'empreinte exacte des données gelée dans le protocole. Les paramètres, protocole, graine, groupes, métriques, empreintes du code et données sont conservés dans le résultat. Une sortie existante n'est pas remplacée. Les dérivés NC ne peuvent pas être exportés par la CLI hors du dossier ignoré `work`.

- Sites entièrement séparés ; liens de source/site/essai/expérience/parcelle/doublon contrôlés. Les labels dupliqués doivent être canonicalisés, pas compter comme répétitions.
- Validation et test sur campagnes strictement ultérieures et sites indépendants. L'effectif minimum nécessaire à cette séparation n'est pas un nombre garantissant une calibration suffisante.
- Aucune imputation. Un prédicteur obligatoire absent ou indisponible à la date déclarée suspend le domaine.
- Pondération : poids égaux aux sites, aux expériences dans le site, puis aux répétitions d'une expérience.
- Références : moyenne d'apprentissage ; réponse empirique linéaire à plateau, avec grilles et bornes sourcées préétablies. Une pente négative n'est pas interdite par une règle de gain automatique ; son interprétation reste empirique dans les doses observées.
- En option, `services/crop-compute/calibration.py` exécute le vrai WOFOST–SNOMIN sur des paquets complets et cherche un ou deux paramètres identifiables par étape, au plus 64 combinaisons. Une phénologie ajustée exige des observations de floraison ; plusieurs paramètres ne sont pas estimés depuis le seul rendement final. Les contrastes organiques sont obligatoires pour l'âge apparent du produit. Il ne s'agit pas d'une conversion du stockage en âge apparent.
- Ajustement sur apprentissage, sélection sur validation, puis métriques finales sur test. Aucune sélection ni substitution de modèle n'utilise les erreurs du test.

Le pipeline distingue cible finale et états internes : une bonne erreur de rendement ne valide pas les stocks chimiques. Les étapes sol/eau/phénologie, cultivar, fourniture nutritive, organique et interaction eau–nutrition restent qualifiées séparément. Ni disponibilité P/K complète, ni mortalité par inondation, ni calibration d'un cultivar africain ne résulte de l'importation d'un profil ou de l'exécution de la fixture fournisseur.

```bash
# Réacquisition explicite pour la recherche, sans redistribution des originaux
python scripts/calibration/acquire.py --destination research-data/calibration/raw/research-only --include-noncommercial-research
python scripts/calibration/build.py --output work/base-recherche-nouvelle --include-noncommercial-research
# Qualification sans ajustement abusif
python scripts/calibration/validation_pipeline.py --audit-database work/base-recherche-nouvelle/experimental.sqlite --output work/qualification-nouvelle.json
# Après qualification réelle et gel d'un protocole complet, uniquement
python scripts/calibration/validation_pipeline.py --data work/essais-qualifies.json --protocol work/protocole-gele.json --output work/evaluation-versionnee.json
```

## Comparaison, incertitude et domaine

Les métriques exécutables sont MAE, RMSE et biais en t sèches/ha semé, ventilées par site/année/classe de sol, effectifs et groupes. Les gains relatifs utilisent un témoin réel apparié par expérience/campagne/bloc ; un témoin nul ou absent ne devient pas un gain calculable. Le classement des traitements conserve concordances, discordances et ex æquo ; aucun R² global n'est utilisé comme preuve suffisante.

L'incertitude des sols, météo future, composition, paramètres et structure est séparée. L'ensemble de scénarios natifs conserve ses membres en échec et suspend sa plage globale si l'un manque. Aucune probabilité ou couverture à 95 % n'est attachée à une plage de scénarios. Le bootstrap par sites, lorsqu'il est possible, concerne seulement l'incertitude de la MAE sur ces sites ; ce n'est pas un intervalle prédictif parcellaire.

Le domaine conserve culture, variété, pays, sol, système d'eau, produit et doses observées, ainsi que les axes numériques effectivement documentés. Méthode/profondeur pH et axes climatiques non connus rendent le domaine incomplet. Une entrée extérieure est marquée extrapolée ; une dimension inconnue ne signifie pas condition optimale. Même des critères numériques réussis ne publient pas automatiquement une prescription : revue agronomique et évaluation prospective de la météo restent à obtenir.

## Parcours modifiable et sauvegardé

Les styles existants et la carte sont conservés. Les graphiques séparent eau, engrais minéraux, produits organiques, phytosanitaires et autres apports. kg de produit/ha et L/ha restent sur des axes séparés. L'organique est une **dose fraîche** ; les teneurs peuvent être sur base sèche, avec humidité nécessaire à la conversion. Aucun équivalent minéral instantané du compost n'est affiché.

Dates et quantités se modifient par saisie/clavier et barres, avec calcul complet serveur après modification. Les mouvements de pointeur ne déclenchent pas un calcul à chaque pixel ; la valeur est engagée au relâchement. Une pile d'annulation bornée est liée à la campagne et au compte ; elle ne traverse pas un changement de compte/campagne/contour. Les réponses obsolètes sont annulées ou ignorées et les résultats précédents sont masqués pendant le recalcul. Aucun état journalier n'est réutilisé après modification.

Les produits déclarés réalisés sont verrouillés dans l'interface. Les corriger ou les retirer exige une action explicite, un motif et un identifiant de correction nouveau ; le serveur le vérifie et conserve la révision antérieure. Changer contour, culture, variété, pays, date de semis ou surface semée ne transfère pas silencieusement ces relevés. Les projets d'apports restent distincts des observations réalisées.

Le résultat serveur précise surface semée, t/ha semé, kg produits, scénario, statut et écart hydrique par rapport au pluvial. Cet écart est attribué à l'eau seulement. Une hypothèse saisie ne devient pas une réponse mesurée au sol. Les variantes d'engrais conservent les apports réalisés et montrent leurs masses apportées ; leurs différences de rendement restent indisponibles faute de domaine nutritif qualifié. Pas d'optimum économique ou agronomique inventé ; objectifs, coûts et contraintes restent nécessaires.

Les fiches et exports indiquent l'absence de validation locale et d'effet nutritif calculé. Aucun stock simulé n'est appelé analyse de laboratoire, aucun pH quotidien n'est affiché, et l'absence d'une sortie ne produit pas un graphique artificiel.

## Vérification et limites opérationnelles

Les tests synthétiques vérifient logiciel, conversions et refus de fuite ; les réacquisitions vérifient les fichiers ; les tests Python natifs exécutent réellement le fournisseur. **Aucun de ces trois contrôles n'est une validation indépendante des rendements africains.** Le rapport de livraison consigne les nombres et empreintes courants.

Les cas obligatoires sont testés : 446,93737505794223 m² = 0,044693737505794223 ha ; 4 t/ha hypothétiques donnent 178,7749500231769 kg ; 100 kg de produit/ha donnent 4,469373750579422 kg ; 1 mm donne 446,93737505794223 L et vaut 10 m³/ha ; 100 kg/ha de 15–15–15 donnent 15/15/15 kg N/P₂O₅/K₂O par hectare.

La CI couvre application, reconstruction/qualification, vrai moteur, authentification, erreurs/reprise, corrections historisées, export/rechargement, concurrence et six statuts pays distincts. Les cache/tâches natives intègrent empreintes du runner et des dépendances : un travail en attente d'une ancienne version échoue explicitement plutôt que de réutiliser des états incompatibles.

Le service externe de calcul n'est toujours pas provisionné ; ses endpoints restent indisponibles sans configuration. La simulation hydrique conditionnelle et les masses nutritives sont déployables indépendamment. La tentative de parcours humain dans le navigateur disponible rencontre l'écran de connexion Cloudflare ; aucune identité ou connexion n'est inventée. La publication peut être vérifiée par le workflow, mais cela ne prouve pas le parcours humain authentifié ni la validité agronomique. Une revue agronomique demeure marquée `pending` ; le plan de collecte doit être dimensionné avec un expérimentateur selon variance, contrastes et précision attendue.
