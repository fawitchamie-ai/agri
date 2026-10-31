# Provenance des entrées et contrôle du terrain

État de départ audité : `7f0e36c65cc92ddd1c0b84f4a5ebe395f0b641fa`, 31 octobre 2026. Aucun `AGENTS.md` du projet trouvé. Lecture des instructions du README, de la configuration et des règles de publication ; migrations SQL existantes conservées.

## Comportement ajouté

Le parcours d’acquisition envoie le contour complet, le pays, la date de semis et la durée. Le serveur valide la géométrie, recalcule son aire et son point représentatif, acquiert les sources de terrain et de sol/météo, et renvoie leur provenance. Les coordonnées envoyées séparément par le client ne font pas autorité.

Avant une simulation ou un recalcul enregistré, le serveur acquiert/reprend son propre contrôle géospatial. Il ne fait pas confiance à un rapport favorable fourni par le client. Un export courant de calendrier est aussi revérifié. Les anciennes révisions restent des archives immuables.

- Eau permanente ou surface incompatible : partie exclue, calcul terrestre suspendu.
- Contour mixte : fractions et géométries affichées ; redessiner un secteur admissible avant de calculer. Pas de multiplication silencieuse par la surface totale.
- Eau saisonnière ou zone humide : diagnostic spécifique requis ; le module terrestre générique est suspendu. Cela ne signifie pas interdiction définitive de toutes les cultures, notamment du riz.
- Couverture inconnue : blocage du calcul sur l’ensemble du contour.
- Terre potentielle : statut conditionnel ; l’absence d’eau détectée ne prouve ni drainage, ni fertilité, ni aptitude, ni droit de cultiver.

Le moteur d’irrigation n’a pas été transformé en modèle de rendement, de mortalité ou de prescription optimale d’engrais.

## Contrat `inputs-1`

Chaque enregistrement `InputValue` conserve :

| Champ | Sens |
| --- | --- |
| `value`, `rawValue`, `unit`, `rawUnit` | Valeur utilisée, valeur reçue/saisie et unités ; `null` reste inconnu |
| `method`, `depthCm`, `interval` | Méthode, profondeur, intervalle temporel |
| `provider`, `product`, `productVersion` | Provenance documentée ou inconnue |
| `observedAt`, `referencePeriod` | Date réelle d’observation, ou période du produit/scénario |
| `acquiredAt` | Date d’acquisition/saisie lorsqu’elle est connue ; aucune date de mesure déduite |
| `model`, `runAt` | Modèle et run lorsqu’ils sont exposés par la source |
| `spatial` | Point/cellule ou emprise de requête décrite, CRS et résolution native disponible |
| `uncertainty` | Bornes, niveau et méthode disponibles ; aucune précision fictive |
| `status` | `measured`, `estimated`, `forecast`, `scenario`, `assumed`, `missing` |
| `origin` | Automatique, manuel, défaut logiciel, catalogue ou origine historique non qualifiée |
| `scopeId`, `validUntil` | Portée et fin de validité déclarée, si connue |
| `replacementReason`, `retention` | Motif et conservation fraîche, ancienne autorisée, ou manquante |

La géométrie complète est conservée une seule fois dans la portée du registre. L’identifiant compact facilite les clés ; les comparaisons de portée confrontent aussi la géométrie complète. Ce n’est ni une signature cryptographique ni une certification cadastrale.

Les valeurs météo disposent aussi d’une provenance par variable : une pluie mesurée et une ET0 de modèle peuvent partager une date sans devenir deux observations de terrain. Les événements de pluie, irrigation et humidité conservent leur propre provenance, leur date effective et leur date d’enregistrement. Un événement annulé ne devient pas une observation utilisable.

## Inventaire des entrées réellement lues

| Famille | Entrées | Usage |
| --- | --- | --- |
| Géométrie | Contour, aire, point représentatif, classes/surfaces | Précontrôle, portée, conversions en volumes ; aire sphérique R=6 371 008,8 m, pas bornage cadastral |
| Profil physique | Épaisseur, FC, WP, humidité initiale de chaque horizon ; infiltration | Réserve, eau disponible, ruissellement et bilan journalier |
| Météo | Pluie, ET0, dates, disponibilité | Bilan journalier ; température moyenne pour indicateur écologique uniquement |
| Culture | Fiche/version, stades, jours, racines, Kc, seuil de déficit, option d’ajustement du seuil | Demande et calendrier ; paramètres de référence non calibrés au champ |
| Installation | Efficacités, débit, heures, quota, limites journalières, jours autorisés, intervalle, déficit cible | Faisabilité des interventions et volumes |
| Observations | Pluie, irrigation, humidité, unité, point net/champ/source, statut et dates | Rejeu du bilan ; prévu ou annulé n’est pas réalisé |
| Chimie | pH, carbone organique, N total, CEC ou autres analyses saisies, méthodes et horizons | Diagnostic conservé ; aucune réponse sol–engrais–rendement calibrée |
| Fumure conditionnelle | Référence, contexte et masses déjà apportées | Arithmétique de références documentées ; pas dose optimale personnalisée |
| Repli explicite | Pluie et ET0 constantes, si le scénario en définit | Simulation nommée, pas prévision saisonnière |

Les données SoilGrids reçues mais non directement utilisées par le moteur sont archivées sous `source.soil.*`. Texture et chimie ne sont pas artificiellement transformées en multiplicateurs du rendement.

## Rafraîchissement, panne et modifications

Les arbitrages n’utilisent plus le début d’une étiquette comme `Hypothèse hydrique` ou `ISRIC SoilGrids`. `origin`, le statut et la portée pilotent la fusion.

- Les FC/WP automatiques sont renouvelées à chaque acquisition applicable, y compris après une première fusion.
- Une saisie ou mesure manuelle applicable reste prioritaire. Les dates et méthodes ne sont pas remplacées par celles du fournisseur.
- Une nouvelle estimation absente devient manquante. La réutilisation d’une estimation antérieure exige une option explicite, la même portée, une date d’acquisition connue et une validité non expirée. Son ancienne date est conservée.
- Un changement de contour invalide les données spatiales de l’ancien champ ; les révisions antérieures les conservent. Les échantillons sans position documentée ne sont pas transférés automatiquement.
- Les réponses anciennes sont écartées selon géométrie, pays, semis et durée ; les modifications intervenues pendant le chargement sont respectées.
- Le cache d’environnement inclut contour et contexte, avec durée maximale d’une heure. Le cache de terrain est de trente minutes, une minute pour un résultat entièrement inconnu. Le bouton d’actualisation force de nouvelles acquisitions.
- Les hypothèses sont visibles et doivent être acceptées avant un scénario. Cet accord ne contourne pas les contrôles eau/terre ou les entrées essentielles manquantes.

Hypothèses initiales exposées : FC 0,30, WP 0,15, réserve initiale 60 %, infiltration 30 mm/j, efficacité d’application 75 %, transport sans perte, apport net maximal 25 mm/j, intervalle minimal d’un jour, jours autorisés et déficit cible. Les valeurs effectivement présentes peuvent différer après acquisition ou saisie : le registre affiche les valeurs utilisées.

## Migration des campagnes existantes

Migration de lecture `migrateInputs`, puis persistance dans la nouvelle révision lors de la prochaine sauvegarde. Aucun ajout de colonne nécessaire : les campagnes sont stockées en JSON. Les anciennes migrations SQL et les anciennes révisions ne sont ni réécrites ni supprimées.

- Les valeurs historiques sont conservées, avec origine non qualifiée si les métadonnées manquent.
- Un ancien texte de source ne devient pas une preuve de mesure ou d’acquisition automatique.
- Pour une analyse **estimée**, une ancienne date qui pouvait être une date de téléchargement n’est pas conservée comme date de mesure : `date`/`observedAt` deviennent inconnues. Les dates de mesures explicitement déclarées comme telles restent conservées.
- Les hypothèses anciennes ne sont pas acceptées automatiquement. Une campagne sans contour complet ou sans contrôle applicable doit être complétée avant son utilisation opérationnelle.
- Les paramètres physiques anciens dont l’origine est ambiguë ne sont pas écrasés silencieusement comme s’ils provenaient de SoilGrids. Ils restent à qualifier ou à remplacer explicitement.
- Les événements existants reçoivent une provenance à partir de leurs dates et statuts enregistrés ; aucune date instrumentale plus précise n’est inventée.

## Couches géospatiales

Les lectures utilisent les **pixels numériques natifs** des GeoTIFF, sans couleurs RGB et sans suréchantillonnage. Les intersections entre pixels et contour sont découpées avec `polygon-clipping` ; les fractions sont calculées à partir des aires sphériques des morceaux. Les résultats gèrent trous et multipolygones issus du découpage. Le tracé d’entrée conserve son format existant de polygone simple ; les parties mixtes peuvent être redessinées en secteurs distincts.

| Couche | Interprétation et limites |
| --- | --- |
| WorldCover 2021 v200, environ 10 m | Classes originales : 80 eau permanente, 90/95 zones humides, 50/70 surfaces incompatibles ; autres classes terrestres reconnues = potentiel à vérifier. Millésime historique, erreurs de classification et pixels mixtes |
| WorldCover InputQuality | Trois bandes : nombre d’observations S1, nombre S2 et pourcentage S2 invalides. Lecture tentée avec la résolution propre de la couche. Absence ou échec indiqué ; aucun taux de confiance inventé. Zones sans observation ou valeurs invalides masquées lorsqu’elles sont disponibles |
| JRC GSW 1.5, saisonnalité 2024, environ 30 m | 12 mois = eau permanente du produit ; 1 à 11 = eau saisonnière. Les valeurs hors domaine sont inconnues. La couche Monthly Recurrence signalée défectueuse n’est pas utilisée. Pas mesure actuelle de profondeur d’eau |
| WOfS récent, si disponible | Recherche STAC sur les 90 derniers jours. Drapeaux 0/128 = observations claires sèche/eau ; autres drapeaux non utilisés comme preuve d’absence d’eau. Une scène sèche ne supprime pas une contrainte historique. Dernière scène exploitable parmi les cinq résultats interrogés |

Une couche récente indisponible ou nuageuse ne peut pas confirmer l’état actuel. La terre potentielle issue d’une carte historique demeure conditionnelle. La résolution d’une carte n’est pas un intervalle d’erreur de position : l’incertitude de frontière reste non quantifiée. Eau sous végétation, fleuves étroits et berges exigent une vérification locale.

La saisonnalité JRC 2024 peut préciser en eau saisonnière une zone déclarée permanente par WorldCover 2021. Une contradiction entre eau permanente historique et sec dans le produit ultérieur devient inconnue à vérifier ; elle ne devient pas automatiquement terre admissible. Une observation récente sèche ne prouve pas, à elle seule, la disparition d’une contrainte hydrologique.

Lectures HTTP partielles vers des hôtes fixes, budget de données et nombre de pixels bornés. Au-delà de 10 000 pixels natifs par fenêtre, le service demande un découpage, sans produire une estimation sur une grille artificiellement grossie. Les CRS WGS84, EPSG:6933 et UTM WGS84 sont pris en charge ; une projection non prise en charge devient un manque explicite.

## Champs encore non traçables ou non acquis

- Les réponses météo Best Match ne donnent pas ici un run exact, une version de modèle et une résolution effective fiables : champs inconnus, jamais remplacés par la date de téléchargement. La cellule renvoyée est conservée si le fournisseur la fournit.
- Les dates de prélèvement des profils d’entraînement SoilGrids et l’identifiant natif exact de cellule ne sont pas exposés par la requête WCS utilisée. La requête/position et la maille nominale sont documentées.
- Les quantiles Q0.05/Q0.95 sont demandés pour les six propriétés chimiques/texturales de surface. Un échec laisse l’incertitude inconnue. Les incertitudes des rétentions hydriques ne sont pas acquises dans cette étape.
- Les positions précises des prélèvements manuels, leur protocole de vérification et leur durée de validité ne sont pas déduites de la simple saisie d’un laboratoire. Le registre permet de représenter ces informations lorsqu’elles sont disponibles.
- Qualité InputQuality et observation récente WOfS sont tentées ; les actifs publics testés peuvent manquer ou répondre avec une erreur. Le résultat enregistre l’échec et les couches historiques disponibles.
- Le pays/localité choisi reste une déclaration ; aucune validation administrative ni autorisation foncière n’est déduite de ces couches.
- Saturation, nappe, drainage réel, crues du bassin amont, mortalité, rendement et dose optimale ne sont pas calculés par ces deux étapes.
- Le scénario météo historique sur trois ans est désormais tracé comme scénario ; sa refonte en ensembles saisonniers appartient à une étape distincte.

## Vérifications

```bash
pnpm check
pnpm test # comprend le test déterministe dans Cloudflare workerd
pnpm test:integration
pnpm test:regressions
pnpm build
node --experimental-transform-types scripts/check-land-sources.mjs --live
node scripts/check-land-worker.mjs --live
# Contrôle de décodage indépendant facultatif, dans un environnement Python isolé :
pip install -r tests/requirements-geo.txt
python scripts/check-raster-reference.py
```

Tests déterministes : migration, dates, panne, conservation ancienne autorisée, priorité manuelle, rafraîchissement FC/WP, changement de contour/contexte, fractions, rivière traversante hors centre, berge mixte, découpage avec trou, absence de donnée, zones humides/riz, six pays, géométrie invalide et contrôle serveur contre un rapport client favorable forgé. Les données synthétiques sont signalées comme telles.

Les contrôles externes sont séparés des tests : `verification-terrain-2026-10-31.json` conserve les appels effectués sur de petits secteurs publics des six pays et leurs sources. Les secteurs près de Volta et de Bagré peuvent être classés terrestres : le nom du secteur n’est pas une vérité de terrain indépendante. Les quatre secteurs d’eau de l’échantillon ne prouvent pas une couverture exhaustive des lacs et fleuves.

Ce travail vérifie le transport, les classes et les règles du logiciel. Il ne constitue pas une validation agronomique, hydrologique ou foncière au champ.

`verification-rasterio-2026-10-31.json` conserve aussi une lecture indépendante par GDAL/Rasterio des mêmes actifs sources, avec pondération d’aire ellipsoïdale. L’accès HTTP de ce contrôle passe par urllib avec vérification TLS et lectures partielles ; GDAL décode les pixels. Cet accord entre décodeurs n’est pas une vérité de terrain indépendante.

## Références primaires

- https://docs.isric.org/globaldata/soilgrids/
- https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/historical-weather-api
- https://esa-worldcover.org/en/data-access
- https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf
- https://global-surface-water.appspot.com/download
- https://docs.digitalearthafrica.org/en/latest/data_specs/Landsat_WOfS_specs.html
- https://geotiffjs.github.io/geotiff.js/
- https://github.com/mfogel/polygon-clipping

## Correction du transport Workers du 31 octobre 2026

Le premier déploiement utilisait `redirect: 'error'`, accepté par Node mais rejeté par Workers avant tout envoi réseau. Le lecteur raster appelait aussi la fonction native `fetch` comme méthode de son client : Workers refuse ce receveur (`Illegal invocation`), alors que Node le tolère. Les deux appels ont été corrigés : mode `manual`, refus explicite des réponses autres que 206 pour les rasters et appel de `fetch` sans receveur personnalisé. Les redirections restent refusées, sans élargissement de la liste des hôtes. Le catalogue WOfS refuse les redirections et les réponses non JSON en conservant le statut HTTP.

Le test `land-worker.test.mjs` exécute le fournisseur, le décodage GeoTIFF et la classification dans le workerd verrouillé avec Wrangler, avec réponses HTTP synthétiques : eau exclue, panne inconnue, redirection refusée. Le test inclut désormais une bande compressée Zstandard : le décodeur Wasm par défaut de GeoTIFF ne peut pas compiler ses octets dans Workers. Le remplacement JavaScript `fzstd` conserve le traitement des prédicteurs par GeoTIFF, et borne la taille des blocs acceptés. Les trois incompatibilités sont donc couvertes avant publication. `check-land-worker.mjs --live` utilise le même runtime et les vraies tuiles sur six secteurs ; seul le transport TLS est relayé par le réseau de l’hôte. Le rapport `verification-worker-2026-10-31.json` distingue ce contrôle local d’un contrôle authentifié de production et d’une validation de terrain.

L’interface indique désormais « Terrain non vérifié » pour une couverture entièrement inconnue et « Calcul suspendu » pour un plan bloqué, au lieu d’annoncer indéfiniment sa préparation. Les observations récentes et la qualité InputQuality restent signalées manquantes si leurs fournisseurs ne les livrent pas.

Références : https://developers.cloudflare.com/workers/runtime-apis/request/ ; https://github.com/101arrowz/fzstd
