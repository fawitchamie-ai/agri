# Protocole saisonnier — version 0.1, 29 octobre 2026

Ce protocole est fixé pour les **nouvelles** expériences saisonnières. Il ne requalifie pas les expériences v22/v24 ni les évaluations déjà réalisées. Aucun modèle saisonnier de rendement n'est encore évalué avec ce protocole.

## Question et pilote

À une date d'émission donnée, prévoir une récolte et comparer des décisions avec les seules informations disponibles à cette date. Premier domaine candidat : maïs, une zone et une saison explicitement choisies, système pluvial, variété et définition de récolte documentées. La Kozah dispose ici d'une fiche de fertilisation, mais cela ne prouve pas qu'elle dispose d'un jeu de validation parcellaire : le choix définitif du pilote reste suspendu à cette acquisition.

Séparer référence territoriale, simulation de pratiques, prévision saisonnière et conseil. Le calcul d'irrigation actuel est une simulation conditionnelle ; les anciennes prévisions à origine 2015 demeurent une expérience historique. Une analyse, une publication et une date d'ingestion ne sont pas interchangeables. Les observations sans millésime de publication peuvent servir à une exploration rétrospective, pas à prouver un service réellement disponible dans le passé.

## Données et séparation

Avant chaque expérience, geler pays, géographie datée, culture/variété, système, saison, dates d'émission, cible, unité, forme du produit, humidité et dénominateur de surface. Versionner entrées, exclusions, code, graines et empreintes. Inconnu reste absent, jamais zéro. HarvestStat et FEWS sont traités comme sources apparentées.

Découpage externe par campagne chronologique ; sélection des modèles et hyperparamètres sur campagnes antérieures uniquement. Calibration séparée, également antérieure au test. Grouper les observations par champ/exploitation/campagne ; retraits spatiaux par zone et examen du transfert entre pays. Les transformations, imputations, masques de culture, générateurs météo et calibrations ne voient aucune donnée de test. Employer des rétrospectives du même fournisseur/version de prévision lorsqu'elles existent ; une météo future observée ne les remplace pas.

## Comparaison et évaluation

Comparer moyenne historique, dernière observation et moyenne des cinq dernières observations lorsque leur définition et leurs entrées sont admissibles, puis les modèles retenus sur **les mêmes cibles**. Conserver âge de la dernière étiquette et couverture. Rapporter effectifs, exclusions, MAE, RMSE, biais, échec de culture, incertitude et métriques de décision/marge lorsque les observations le permettent. Pondérations et dépendance entre campagnes explicites. Publier résultats par pays/zone/culture/système/saison/date/support, y compris les échecs.

Comparer les itinéraires sous les mêmes scénarios météo et contraintes. Un écart entre simulations n'est pas une preuve de gain causal. Une dispersion entre modèles/membres n'est pas un intervalle calibré. Les niveaux d'intervalle et critères numériques d'acceptation seront fixés dans une version du protocole **avant** l'expérience correspondante, avec justification du risque et dimensionnement ; faute de ces éléments, aucune décision de validation opérationnelle n'est autorisée.

## Conditions d'activation

Une méthode de fertilisation personnalisée nécessite une relation locale sol–culture, les méthodes analytiques compatibles, les fournitures du sol et apports antérieurs, eau, objectif atteignable et budget. Une référence chiffrée publiée est affichée comme telle et conserve son domaine, sans label de prescription personnalisée.

Le volet chimique phytosanitaire reste désactivé sans diagnostic et registre d'autorisation/étiquette valides pour le pays, l'usage et la date. La composition du sol ne suffit pas à choisir un pesticide.

La validation de terrain nécessite prévisions et conseils archivés avant décision/récolte, comparateurs, mesures standardisées des sols, pratiques et récoltes, protocole prospectif et effectif justifié. Les tests logiciels et données fictives n'y contribuent pas comme observations. Les seuils ne seront pas modifiés après résultats pour faire accepter un modèle.

## États indépendants

Conserver séparément : exécuté, vérifié par tests logiciels, évalué rétrospectivement, domaine agronomique qualifié, pilote prospectif réalisé. Toute dépendance manquante maintient le statut correspondant bloqué. Les fiches de capacité et le journal décrivent la dernière preuve, pas une intention.
