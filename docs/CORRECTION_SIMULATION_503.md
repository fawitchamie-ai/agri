# Actualisation des données et indicateur d'eau

Correctif fondé sur main `81f6a1111c51f045e3c2cb1f658813f080888a92`.

## Diagnostic et reproduction

Le signalement vise POST `/api/seasonal`, action `environment`, actualisation explicite d'un cycle de 210 jours au Bénin. La capture montre aussi un bilan suspendu parce que les hypothèses initiales ne sont pas encore acceptées : une météo renseignée à 100 % ne suffit pas à autoriser ces hypothèses.

Reproduction logicielle confirmée sur la route d'acquisition : une réponse Forecast API possède les dates et les unités attendues, mais manque la colonne ET0. Le code précédent acceptait cette réponse puis indexait la colonne absente, provoquant `TypeError: Cannot read properties of undefined (reading '0')`, traduit en HTTP 503 par le gestionnaire d'erreur. Le corps exact de la réponse amont ayant causé l'incident utilisateur n'est pas disponible ; ce cas reproduit une cause effective du 503 sur la route signalée.

Le calcul de l'historique parcourait en outre trois années à chaque jour et pour chaque entrée de provenance. Un profil SoilGrids lançait jusqu'à 30 lectures simultanées et était entièrement rechargé lors des actualisations météo. Ces charges sont réduites sans changer les équations ni les dates d'acquisition.

## Changements

- Contrat météo vérifié avant utilisation : dates ISO réelles/distinctes, tableaux présents et alignés, unités compatibles, période de l'archive respectée. Une réponse invalide devient une source indisponible. Un historique valide peut fournir un scénario explicitement nommé ; sans historique valide, les jours restent manquants, sans zéro pluie inventé.
- Calendrier historique indexé une fois, y compris provenance du 29 février fondée sur les trois 28 février utilisés dans le calcul. Aucun changement des moyennes des autres jours.
- Quatre lectures SoilGrids au maximum à la fois, corps et reprises compris ; un délai global de 30 secondes annule aussi les lectures en file d’attente, sans multiplier les délais par 30. Les profils entièrement acquis sont conservés 24 h au point exact, dans un cache public borné à 16 profils. Leurs dates, profondeurs, unités et sources d'origine sont conservées. Les profils incomplets ne sont pas présentés comme complets et ne sont pas placés dans ce cache.
- Le clic d'actualisation force une seule acquisition. Il ne force plus toutes les acquisitions suivantes après un changement de culture ou de date. Une culture sans cycle arrête correctement l'état de chargement.
- Près des résultats, le bouton « Lancer le scénario avec ces hypothèses » explique et déclenche explicitement l'acceptation nécessaire au bilan d'eau. Aucune acceptation automatique, aucune hypothèse transformée en mesure. Les autres données manquantes restent bloquantes.
- L'indicateur d'eau précise s'il attend cette acceptation, un calcul ou une donnée. Une ancienne valeur ne s'affiche pas comme résultat courant pendant un recalcul. Une demande nulle ne produit pas un pourcentage artificiel.
- Une erreur interne comporte une référence de diagnostic liée au journal serveur et un en-tête `X-Request-Id`. L'interface précise que l'actualisation a échoué et conserve les saisies. Aucun détail interne n'est exposé dans la réponse.

## Vérification

Le nouveau test `seasonal-worker.test.mjs` exécute les vrais handlers saisonniers dans workerd/Miniflare, avec le runtime et la date de compatibilité de production, le vrai transport D1 et les migrations. Seules les réponses des fournisseurs sont synthétiques et l'identité de test est fixée dans l'entrée de test, jamais dans le Worker de production.

Il vérifie : calcul/audit/provenance simultanés dans les six pays synthétiques ; sauvegarde et relecture d'un cycle de 366 jours ; acquisition d'un cycle de 210 jours ; refus du calcul avant acceptation ; bilan et consommation d'eau disponibles après acceptation ; deuxième actualisation avec une colonne météo absente ; réutilisation du sol avec conservation de la date initiale ; panne de fournisseurs laissant un nouveau contour inconnu et le calcul suspendu.

Validation locale : 158 tests automatisés réussis, vérification TypeScript, tests d’intégration, régressions et compilation réussis.

Les tests complémentaires couvrent les dates invalides/dupliquées, colonnes absentes, absence simultanée des sources, indicateurs périmés, demande nulle et consentement explicite. Les tests de calcul, droits, révisions et export existants restent applicables.

Une comparaison locale indicative sur quatre appels synthétiques de 210 jours a donné environ 62 ms avant et 11 ms après pour la construction de l'environnement avec historique ; ce n'est ni un benchmark de production, ni une mesure de la latence des fournisseurs.

La publication du correctif ne vaut pas validation agronomique. Le contrôle connecté de production reste soumis à Cloudflare Access ; une étape ignorée faute d'identifiants de service n'est pas un contrôle réussi. Après publication, une page restée ouverte doit être rechargée pour utiliser le nouveau code de l'interface.
