# Planification saisonnière et irrigation

Version du moteur : `water-balance-1.0.0`. Livraison du 29 octobre 2026.

L’entrée « Préparer et suivre ma culture » ouvre un parcours de campagne dans la plateforme existante : parcelle et culture, sol et eau, météo, calendrier, observations et autres décisions. Le style et les parcours de consultation historiques sont conservés. Aucun résultat v24 n’est réentraîné ni requalifié par ce module.

## Capacités effectivement implémentées

- Bilan quotidien du semis à la fin du cycle, limité à 366 jours et 12 horizons de sol.
- Croissance racinaire par stade, coefficients culturaux interpolés et réserve racinaire par horizon ; initialisation hydrique explicite.
- Demande sans stress, consommation ajustée au stress, pluie retenue, ruissellement, drainage, correction de stock et fermeture du bilan.
- Calendrier d’apports nets et bruts, conversions en mm/L/m³, durée au point du débit, fréquence résultante et synthèses hebdomadaires, décadaires et par stade.
- Contraintes de quota saisonnier à la source, débit et durée disponible, jours d’accès, disponibilités par date, intervalle minimal et plafonds nets/infiltration journalière.
- Volume réalisé, restant prévu et total actualisé. Les totaux complets sont indisponibles si le bilan est interrompu par des données manquantes.
- Événements pluie/irrigation/humidité, réalisés mesurés ou déclarés, prévus et annulés. Correction par identifiant stable, rejeu complet et révisions immuables.
- Conservation en D1 dans le périmètre de la coopérative ; producteur limité à ses propres campagnes. Concurrence contrôlée par révision et écritures groupées.
- Brouillon local facultatif, file d’observations hors connexion par compte/espace, synchronisation explicite avec arrêt en cas de conflit ; export de la file en attente.
- Exports de campagne JSON, calendrier CSV et fiche imprimable/PDF via le navigateur. Les révisions antérieures sont téléchargeables après contrôle d’accès.
- Comparaison de trois dates de semis sous les hypothèses disponibles, sans classement optimal inventé.
- Bilan multinutriments N–P₂O₅–K₂O et quantité de produit pour la parcelle à partir d’un besoin cible documenté, sans prescription chimique issue de données insuffisantes.
- Référence de rendement existante réutilisée uniquement si pays Togo, culture, territoire et année correspondent exactement. Elle ne réagit pas à l’irrigation.

## Pays et domaine de validité

Togo, Bénin, Burkina Faso, Ghana, Côte d’Ivoire et Sénégal sont configurables, avec fuseaux propres. Cela permet un calcul conditionnel sur les entrées de la campagne, pas une validation opérationnelle pour chaque pays. Les coefficients de démonstration ne sont pas des paramètres nationaux.

Le niveau de preuve de tous les plans est `simulation_non_validee`. Le système générique couvre les sols non submergés à nappe profonde. Rizières submergées et nappes proches sont bloquées. Hétérogénéité parcellaire, mouillage partiel, hydraulique des réseaux, salinité, lessivage et intensités horaires exigent des modules ou une qualification supplémentaires. La surface est déclarée ; aucun relevé de sol au m² n’est déduit de cette saisie.

## Convention scientifique du moteur

L’ET0 est une entrée quotidienne en mm : observation/calcul externe documenté, prévision du fournisseur ou hypothèse nommée. Le connecteur Open-Meteo demande l’ET0 FAO et la pluie sur 16 jours au maximum ; il n’ajoute pas de calcul Penman–Monteith local à partir de capteurs bruts. Toute donnée de modèle reste une prévision. L’instant de récupération est archivé comme date de disponibilité, pas comme heure d’émission du modèle d’origine.

Le calcul utilise un coefficient cultural simple : `demande = Kc × ET0`. Le stress réduit la consommation simulée, pas la demande sans stress. Le schéma journalier est une approximation à comparer aux mesures ; il ne résout pas les flux horaires ni l’évaporation et la transpiration séparément.

Ordre journalier :

1. Extension des racines : chaque nouvelle portion d’horizon apporte son eau initiale propre. La partie déjà exploitée n’est pas artificiellement réhumidifiée.
2. Correction d’humidité éventuelle, appliquée à toute la zone racinaire et tracée comme ajustement d’état. Les horizons non encore explorés conservent leur état initial.
3. Pluie prioritaire enregistrée, sinon source météo, sinon hypothèse explicite. L’infiltration journalière limite la pluie entrante ; l’excès est ruisselé.
4. Stockage jusqu’à capacité au champ ; excès drainé avant consommation quotidienne.
5. Irrigation réelle, ou proposition future sous contraintes. Aucune irrigation passée absente du journal n’est présumée réalisée. Une journée avec irrigation réelle n’est pas complétée automatiquement par une seconde irrigation proposée : le pas journalier ne connaît pas les heures restantes.
6. Stockage de l’apport net, drainage supplémentaire d’une éventuelle surdose, puis évapotranspiration ajustée au stress.

Les pertes moyennes d’application sont déjà comprises dans l’efficacité effective. Le bilan racinaire reçoit l’apport net après ces pertes ; seul un excès supplémentaire au-delà de la réserve est drainé. L’efficacité de transport est appliquée une fois entre source et champ. Ce contrat agrégé évite d’appliquer deux fois les mêmes pertes. Il ne constitue pas un modèle détaillé d’infiltration d’un réseau d’aspersion.

Le minimum d’irrigation affiché vise à rester au-dessus du seuil de stress jusqu’à la fin de la journée ; le plan peut demander davantage pour reconstituer la réserve cible. Ce sont des décisions de gestion distinctes. Les minima répétés sous un déficit persistant ne doivent pas être additionnés comme une dette unique de fin de cycle.

Les stocks et flux ferment : `stock_fin = stock_début + eau_nouvelles_racines + correction + pluie - ruissellement + irrigation_nette - drainage - consommation`. Les corrections d’état et les gains liés à l’enracinement ne sont pas étiquetés pluie ou irrigation.

## Météo et scénarios

Le connecteur utilise un endpoint fixe HTTPS, des coordonnées contrôlées, un horizon borné, un délai maximal de 12 s et vérifie les unités. Les coordonnées sont transmises à Open-Meteo lorsque l’utilisateur active le chargement météo. La documentation du fournisseur et ses conditions doivent être respectées, notamment avant usage commercial de son endpoint gratuit. Attribution visible dans l’application.

Le connecteur est testé avec un transport simulé. Un appel réel du 29 octobre 2026 sur des coordonnées publiques de démonstration à Lomé a aussi retourné 16 journées, sans pluie manquante. Cela vérifie l’accès technique depuis l’environnement d’exécution, pas la qualité météorologique locale ni l’accès depuis le Worker publié. Une panne laisse le scénario et les saisies disponibles ; aucun résultat réseau n’est fabriqué.

Au-delà de la météo renseignée, un scénario quotidien explicite peut prolonger le cycle. Le scénario sec de démonstration est une hypothèse répétée, pas une désagrégation d’un cumul saisonnier. Le module ne contient pas encore d’ensemble saisonnier calibré, de générateur météo ni d’intervalle prédictif validé. Les comparaisons de dates sans covariables météo différentes ne justifient aucun classement agronomique.

## Persistance, synchronisation et confidentialité

Migration additive `drizzle/0003_seasonal_campaigns.sql` : tables des campagnes et des révisions, sans modification des anciennes tables. Le pipeline Cloudflare existant applique les migrations après point de restauration, avant publication. Revenir au code précédent conserve les nouvelles tables.

`GET /api/seasonal` liste les campagnes visibles ; `GET ?id=...` retourne la campagne et l’historique. `GET ?id=...&revision=N` fournit un instantané antérieur autorisé ; `format=csv` exporte le calendrier actif. Les routes utilisent les contrôles Cloudflare Access et la session de la plateforme.

`POST /api/seasonal` : actions `save`, `event`, `simulate`, `weather`. Les plans envoyés par le navigateur ne sont pas crus : le serveur recalcule. Les événements d’une campagne existante ne sont pas remplaçables par `save` ; chaque correction utilise `event`. Un réimport d’événement identique ne crée pas de révision, même après perte de réponse. Une autre modification avec une révision dépassée produit 409.

Les brouillons et files hors connexion contiennent des données de parcelle : conservation locale sur choix explicite pour le brouillon ; les événements saisis hors connexion sont conservés sur cet appareil avec un avertissement. Ils sont séparés par compte et coopérative et ne sont pas automatiquement envoyés sous une autre identité. La synchronisation s’arrête au premier conflit ; reprendre après examen est une action explicite. Aucune synchronisation de fond ni notification SMS n’est activée.

## Notebook et reproduction

`science-source/seasonal/planification_saisonniere.ipynb` contient des cellules Python lisibles qui appellent le moteur TypeScript par `irrigation.py` et `scripts/run-water-plan.mjs`. Il n’embarque aucune archive ou série raster. La version historique du notebook est conservée séparément.

```bash
python3 scripts/execute-water-notebook.py science-source/seasonal/planification_saisonniere.ipynb
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
```

Le script d’exécution réalise les cellules séquentiellement dans un nouvel interpréteur Python et sauvegarde compteurs et sorties. Il ne simule pas un noyau Jupyter et l’indique dans les métadonnées. Le notebook reste ouvrable et exécutable dans Jupyter avec Python 3 et Node 24 disponibles.

## Ce qui reste à obtenir et valider

La livraison ne fournit pas d’analyses de sol, essais de réponse à la fertilisation, étiquettes de rendement de champs ni registres phytosanitaires qualifiés pour les six pays. Elle ne permet donc pas d’activer des prescriptions chimiques automatiques ou d’afficher une fiabilité parcellaire démontrée. Elle ne déduit aucun rendement d’un volume d’eau par un coefficient arbitraire.

À conduire : acquisition et qualification des données, paramètres locaux/variétaux, couplage avec un simulateur agronomique calibré, validation des méthodes de pluie/stockage et de la météo, comparaison indépendante avec références agronomiques adaptées, pilote prospectif avec mesures de sol, compteurs, interventions et récoltes. Le support anglais, une carte de contour parcellaire, les alertes et la collecte automatique de capteurs ne sont pas livrés dans cette version.

Sources méthodologiques consultées : [FAO 56, chapitre 6](https://www.fao.org/4/X0490E/x0490e0b.htm), [chapitre 8](https://www.fao.org/4/X0490E/x0490e0e.htm), [efficacités d’irrigation](https://www.fao.org/4/t7202e/t7202e08.htm), [documentation Open-Meteo](https://open-meteo.com/en/docs). Ces références ne certifient pas les coefficients fictifs de l’exemple.
