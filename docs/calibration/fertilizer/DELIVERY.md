# Livraison : observations d'engrais et essais volontaires

## Résultats réellement calculés

Carob : 5 601 lignes ; 554 paires de maïs témoin/NPK, dans **25 groupes de localités**.
Les appellations voisines T/wada et Tudun Wada sont regroupées, pour empêcher un
passage entre apprentissage et test. Les sous-ensembles sont : apprentissage
286 paires / 13 localités, réglage 143 / 5, test 125 / 7. Les 21 paires togolaises
d'Affem et Sessaro restent dans le test. Les compilations ambiguës et doublons
potentiels entre synthèse et sous-jeux sont exclus plutôt que réappariés par
valeurs de rendement ou d'analyse de sol. Les répétitions manquantes ne sont pas
inventées ; la colonne `rep` de certaines sources est un nombre de répétitions.

| Métrique sur le gain | Test total | Togo |
|---|---:|---:|
| Paires / groupes de localités | 125 / 7 | 21 / 2 |
| MAE (t/ha telles que rapportées) | 0,963 | 1,123 |
| RMSE | 1,297 | 1,390 |
| Biais (prédit − observé) | +0,012 | +0,787 |

La moyenne pondérée par localité est retenue devant les trois régressions ridge
de contexte (latitude, longitude et doses déclarées). Elle n'améliore donc pas
la référence simple. Seuils fixés avant calcul : gain de MAE d'au moins 10 %,
MAE ≤ 0,5 t/ha, biais absolu ≤ 0,25 t/ha, au moins cinq localités cibles et
qualification des unités et du protocole. Ces exigences ne sont pas satisfaites.
Seulement cinq localités de réglage ne permettent pas de calculer un intervalle
groupé à 95 % fini. Aucun intervalle prédictif certifié n'est affiché.

Un premier découpage distinguait T/wada et Tudun Wada ; il est invalidé et archivé.
Le changement de groupement répond à cette ambiguïté géographique, sans ajuster
les seuils aux scores. Les scores finaux restent un diagnostic de recherche ;
ils ne sont pas une certification sur test jamais consulté.

Les 6 146 fonctions OFRA ont été lues (Togo 15, Burkina 272, Ghana 247). Sénégal :
2 992 lignes, 2 728 avec au moins un rendement numérique humide/sec. Pas de fusion
des deux bases avec Carob sans contrôle d'articles et d'identité expérimentale.
La matrice `COVERAGE.csv` détaille les lignes Carob et paires par pays/culture ;
`SOURCE_AUDIT.json` conserve les autres effectifs. Les six pays sont couverts
par l'inventaire, **pas par un modèle parcellaire d'engrais validé**.

## Ce qui fonctionne dans l'application

- Dans **Ma simulation → Mes engrais et leurs effets** : dernier repère national
  FAOSTAT disponible pour le pays/culture, provenance, observations appariées
  togolaises, graphique médiane et dispersion observée, scores et limites.
- Une moyenne nationale n'est pas un témoin sans engrais et n'est pas injectée
  dans Ym. Les valeurs antérieures, y compris une hypothèse volontaire à 20 t/ha,
  restent des hypothèses avec leur source ; aucune valeur n'est promue en science.
- Le calcul économique expose coûts marginaux, gain hypothétique choisi par
  l'utilisateur, seuil de rentabilité et sensibilité. Aucun bénéfice probable ou
  optimum de dose n'est inventé quand la réponse n'est pas validée.
- **Essai volontaire dans mon champ** : protocole, bras, blocs choisis avec
  l'expérimentateur, tirage reproductible, zones tampons, apports réels par unité,
  surface nette récoltée, masse, date, humidité et source. Le bilan compare les
  récoltes à matière sèche, appariées par bloc. Les observations restent déclarées.
- Les essais suivent la campagne, son propriétaire et ses révisions existantes.
  Après observation, protocole et tirage sont figés ; une correction de mesure
  requiert un nouveau motif et conserve les anciennes révisions. Pas de table
  supplémentaire, pas de migration destructive, pas d'apprentissage automatique.
- Une seule action prioritaire indicative est formulée. Sa méthode est
  heuristique ; aucune valeur économique de l'information n'est revendiquée.

## Blocages scientifiques restants

Les 5 601 lignes Carob n'ont ni humidité ni date de plantation qualifiée ; les
surfaces de référence, dates et affectations expérimentales nécessitent les
protocoles originaux. Ces données permettent une exploration de contrastes,
pas une validation prospective ni des effets propres de N, P et K. Une dose par
unité ne permet pas de comparer un optimum continu ou un plateau causal.
QUEFTS requiert absorption, offre du sol et efficacités locales qualifiées ;
WOFOST SNOMIN requiert forçages journaliers, cultivar, dates et états initiaux.
Les variantes sont déclarées non identifiables plutôt que paramétrées au hasard.
Les sources NC Gagnoa/SOERE restent séparées et exclues du moteur opérationnel.
Les comparaisons sénégalaises demandent encore la lecture des protocoles pour
distinguer variétés et apports. Aucun essai prospectif n'a été réalisé ici.

Les calculs eau, nutriments et conversions du produit existants sont conservés.
Aucun gain d'engrais n'est ajouté au modèle hydrique, aucune double pénalité
d'eau ou de surface n'est introduite. Aucune campagne privée n'est utilisée.

## Exploitation et retour arrière

Les sorties légères de `data/seasonal/fertilizer-evidence.json` sont embarquées
dans la version du Worker ; aucun entraînement à la requête. API authentifiées :
`fertilizer-evidence`, `fertilizer-information`, `marginal-scenario`,
`field-trial-summary`. Les essais sont sauvegardés par l'action `save` existante.
Le repli est un message explicite si la source/API manque, jamais un rendement nul.

Publication : PR vers main, contrôles existants puis déploiement Cloudflare avec
point de restauration D1. Pour revenir au comportement précédent, revenir au
commit parent via PR puis CI, **sans restaurer la base ni supprimer des essais**.
Si un ancien client ne connaît pas `fieldTrials`, ses sauvegardes ne doivent pas
effacer les essais observés : le serveur les protège. Une ancienne version du
serveur peut ignorer ce champ ; conservez donc les révisions et empêchez les
écritures pendant un retour au code antérieur. Les instantanés restent lisibles.
Le contrôle de santé authentifié et la visite en production sont distincts de
la compilation et du déploiement ; ne pas les annoncer si Access les bloque.
