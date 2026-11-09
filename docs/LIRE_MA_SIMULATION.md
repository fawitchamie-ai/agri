# Lire Ma simulation

La page commence par « Que dois-je faire ? ». Le message dépend de l’état réel du calcul : accord sur les hypothèses, sélection de la partie terrestre, données à compléter, calcul en cours ou calendrier disponible. Les hypothèses ne sont jamais acceptées automatiquement.

## Pour l’utilisateur

1. Vérifier le champ, la culture et la date de semis.
2. Si demandé, vérifier les valeurs supposées puis lancer un scénario avec ces hypothèses. Cela ne les transforme pas en mesures.
3. Lire le **prochain apport proposé**. Vérifier la pluie réelle et l’accès à l’eau avant de l’appliquer. Le volume sur tout le cycle est réparti entre plusieurs apports, jamais à apporter en une fois.
4. Pour prévoir la récolte avant semis, choisir « Surface prévue avant semis », saisir la surface que l’on pense cultiver, la culture et la date envisagées, puis fournir une référence de rendement indépendante si l’on veut obtenir des tonnes par hectare. Aucune preuve de semis n’est demandée : le résultat signifie « si je sème cette surface dans ce scénario ». La surface terrestre proposée est une limite potentielle à ajuster à l’intention de l’utilisateur. Après le semis, renseigner la surface effectivement semée pour le suivi et conserver les observations réelles séparément.
5. Enregistrer la simulation pour conserver sa version. Les paramètres, observations, comparaisons et sources restent accessibles dans les panneaux repliés et le calendrier détaillé.

## Graphique et indicateurs

- Ligne verte : besoin d’eau de la culture, en mm utiles par semaine.
- Barres bleues : pluie utilisable selon le bilan ; le sol stocke aussi de l’eau entre les semaines.
- Barres violettes, lorsqu’il y en a : apports enregistrés dans le carnet.
- Barres jaunes : apports proposés, restant à réaliser.
- Sélectionner une semaine affiche les quantités et les stades de culture en texte. Un tableau contient les mêmes valeurs. La liste des semaines et le tableau rendent la lecture indépendante de la couleur et du clic sur le dessin.
- Les pointillés signalent les intervalles utilisant un scénario météo. Le nombre de jours de prévision et de scénario apparaît explicitement. Un cycle rempli avec un repère historique n’est pas présenté comme une prévision météo complète.
- Le pourcentage d’eau couvert est conditionnel à la réalisation du plan proposé. Il n’est ni un constat d’arrosage actuel, ni une note de qualité de la récolte. Les anciens scores de pH, température, réserve et couverture météo sur un radar ont été retirés de cette page.
- 1 mm = 1 litre/m². Les m³ au champ tiennent compte de l’efficacité déclarée ; les barres montrent l’eau utile. Une efficacité inconnue conserve un volume inconnu.

Le rendement affiché est une simulation conditionnelle : la référence indépendante est ajustée par le stress hydrique calculé. Le scénario « Avec le plan d’arrosage » suppose que les apports proposés seront réalisés ; il ne les enregistre pas comme faits. Les apports réellement effectués se consignent dans le carnet d’eau. Le scénario NPK QUEFTS reste exploratoire et transféré d’un contexte de référence ; les résultats eau et engrais ne sont pas additionnés.

## Portée et vérification

Cette mise à jour clarifie la simulation avant semis, la séparation entre scénario prévu et suivi réalisé, et l’interprétation des profils SoilGrids. Elle n’ajoute pas de calibration locale : les équations de rendement et le modèle NPK exploratoire restent ceux de l’application. L’aperçu utilise le bilan retourné par le serveur. Les sources complémentaires sont montées à la première ouverture du panneau puis conservées pendant les replis.

Les tests `overview.test.ts` vérifient la séparation réalisé/proposé, la réconciliation hebdomadaire, les volumes inconnus et la couverture météo. `simulation-reading.test.mjs` rend le composant réel côté serveur et vérifie les états disponible/bloqué/périmé, les champs de récolte vides, les panneaux initialement repliés et les descriptions accessibles du graphique. Ils utilisent des données synthétiques, sans validation agronomique au champ.

Contrôles de livraison : typage, tests, intégration HTTP, régressions et compilation. Le navigateur de contrôle ne peut pas accéder au serveur local dans cet environnement ; le rendu visuel et les interactions en navigateur ne sont donc pas déclarés vérifiés. Le contrôle authentifié de production dépend toujours des identifiants de test Cloudflare Access configurés dans le dépôt.
