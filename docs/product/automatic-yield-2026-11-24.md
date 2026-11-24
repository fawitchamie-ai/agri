# Simulation automatique indicative et images à 20 %

## Rendement de la campagne

Une campagne avec contour et cycle propose désormais le profil versionné
`maize-rue-indicative-1` pour le maïs grain terrestre et drainé. Après confirmation
du drainage et des hypothèses, le serveur prépare le profil et exécute le moteur
existant `daily-growth-process-1.5.0`. La synthèse et « Rendement & production »
affichent le même scénario choisi, en t/ha et en tonnes sur sa surface prévue ou
semée. Un recalcul en cours ou échoué masque les anciennes valeurs.

Cette réalisation raccorde un scénario logiciel ; elle ne calibre pas WOFOST,
un cultivar ou une prédiction parcellaire. Les autres cultures restent bloquées
avec une raison explicite tant qu'aucun profil compatible n'est enregistré.
Un profil expert, un modèle FAO explicitement choisi ou le nowcast LAI existant
conserve la priorité. Le calcul automatique peut être désactivé par campagne.

Le rayonnement global quotidien Open-Meteo est maintenant acquis et contrôlé
en MJ/m², avec pluie, ET0 et température. Pour les dates hors prévision, seules
les valeurs manquantes sont complétées par la moyenne du même jour des trois
années précédentes, si elles sont toutes disponibles. Leur provenance reste
« scénario » : ces moyennes ne sont pas une prévision saisonnière. Les saisies
manuelles sont préservées. Une unité inconnue ou une donnée absente ne devient
pas une constante cachée ; la croissance explique alors ce qui manque.

Les coefficients RUE, couvert, indice de récolte, humidité et fournitures N/P/K
du modèle illustratif sont visibles. SoilGrids n'est jamais traduit en stocks
N/P/K disponibles. Le plafond nutritif est signalé lorsqu'il limite le résultat ;
les stocks et libérations peuvent être renseignés avec une source. Les équations
et la version du moteur ne sont pas modifiées pour améliorer artificiellement
un score. Le profil exact utilisé et ses hypothèses figurent dans
`plan.automaticYield`, sans remplacer `config.growth` par un profil expert.

## Dates Sentinel-2

Le seuil des images datées est **20 % inclus de surface NDVI native exploitable
dans le contour**. La couverture de la grille statistique est affichée dans une
autre colonne et ne constitue plus un second seuil caché pour ouvrir une image.
Le masque des nuages, ombres, eau et pixels invalides reste appliqué. Les parties
sans mesure ne sont pas remplies. Les cartes NDVI et NDVI contrasté conservent
les pixels natifs à 10 m et la découpe exacte au contour, y compris ses trous.

Le catalogue est toujours parcouru sur toutes les dates annoncées. Les anciens
rejets disposant déjà de mesures NDVI suffisantes sont requalifiés. Ceux où seules
les classes SCL avaient été lues attendent une nouvelle lecture des bandes. Le
seuil entre dans l'empreinte du cache : un ancien rejet à 80 % ne peut donc pas
empêcher une nouvelle lecture à 20 %. Cette règle concerne les images et le suivi,
pas le niveau de validation scientifique d'une prévision de rendement.

## Vérifications reproductibles

- `npm test` : calcul réel, données manquantes, météo et surface modifiées,
  priorité des profils experts, désactivation, résultat choisi et interactions UI.
- `tests/automatic-yield-routes.test.mjs` : identité obligatoire, recalcul serveur,
  résultat client falsifié ignoré, sauvegarde/rechargement SQLite, révisions
  conservées et compte tiers refusé.
- `tests/environment-radiation.test.ts` : unités, complétion par variable et
  conservation des autres valeurs prévisionnelles.
- `tests/field-image-calendar.test.ts` : 19 % refusé, 20 % accepté, ancienne
  exclusion requalifiée ou relue et parcours complet après la première date claire.
- `npm run check`, `npm run build`, `npm run test:integration`,
  `npm run test:regressions`.

Un rejeu local du 24 novembre a utilisé 125 jours de données Open-Meteo réelles
(16 de prévision et 109 de scénario historique). Il a exécuté la chaîne complète
de préparation et croissance, avec sol illustratif et terrain synthétique
explicitement signalés. Le plafond nutritif du profil explique l'égalité entre
certains scénarios. Ce rejeu vérifie le raccordement et ne mesure aucune précision
sur une récolte réelle ; les coordonnées et données privées ne sont pas publiées.

Variable et unité du fournisseur :
https://open-meteo.com/en/docs/historical-weather-api
