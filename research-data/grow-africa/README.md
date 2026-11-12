# GROW-Africa v2.0 — acquisition, qualification et évaluation régionale

Source : Geyman et al., *An Africa-wide agricultural production database to support policy and satellite-based measurement systems*, Scientific Data 12 (2025), DOI [10.1038/s41597-025-05257-5](https://doi.org/10.1038/s41597-025-05257-5). Données : [GROW-Africa Database v2.0](https://doi.org/10.5281/zenodo.16544448), CC BY 4.0.

Acquisition contrôlée le **2026-11-12**. Le registre `qualification.json` conserve la taille, le MD5 indiqué par Zenodo, le SHA-256 réellement calculé, les colonnes et les effectifs par pays des quatre tables. L’archive originale de 64 638 070 octets n’est pas copiée au dépôt. `grow-africa-regional.json` contient uniquement les dernières années disponibles (cinq au plus par unité/culture) pour le panneau de références; `evaluation.json` et `qualification.json` sont reconstruits à partir de la table complète.

## Reproduire

```bash
python -m pip install -r research-data/grow-africa/requirements.lock.txt
python scripts/build-grow-africa.py \
  --archive /tmp/GROW-Africa-Database.zip \
  --acquire \
  --acquired-on 2026-11-12
```

Le script refuse une taille ou un MD5 différent, vérifie les colonnes attendues, conserve la provenance de l’archive, et échoue si une clé pays × GADM × culture × année × niveau est dupliquée. Le script peut prendre du temps car il vérifie aussi les effectifs des quatre tables source.

## Données effectivement retenues

Les lignes du moteur de référence proviennent seulement de `GROW-Africa_Regional.xlsx` : pays cible, niveaux administratifs 1 et 2, `QC_flag_Y=A`, culture de la liste avec correspondance documentée, rendement positif et fini, année de récolte valide et identifiant GADM présent. **43 793 lignes** satisfont ces règles dans l’archive acquise; le fichier de lecture de l’application garde **10 629** lignes, limitées aux cinq dernières années publiées par unité/culture. Les agrégats par pays, culture, niveau, années et source sont dans `qualification.json`.

Ce ne sont pas 43 793 coupes de champ : ce sont des observations administratives qui peuvent provenir de sources et de dénominateurs différents. `yieldTonHa` est conservé tel quel; le produit exact et l’humidité ne sont pas harmonisés. Les flags A sont les contrôles transmis par GROW, pas une validation indépendante par notre équipe.

Les quatre tables ont été parcourues. Effectifs des lignes des six pays ciblés (pas des observations indépendantes ni des colonnes de rendement non manquantes) :

| Table | Togo | Bénin | Burkina Faso | Ghana | Côte d’Ivoire | Sénégal | Années publiées |
|---|---:|---:|---:|---:|---:|---:|---|
| Statistiques administratives | 3 136 | 23 127 | 18 157 | 4 967 | 0 | 11 008 | pays-dépendant; détail dans `qualification.json` |
| Enquêtes LSMS | 11 580 | 3 973 | 1 570 | 0 | 1 417 | 3 044 | 2018–2022 (sauf Côte d’Ivoire : 2019–2022) |
| Observations ponctuelles | 0 | 24 | 7 198 | 1 671 | 0 | 2 791 | 2000–2015 selon pays/culture |
| Coupes LSMS | 0 | 0 | 0 | 0 | 0 | 0 | aucune ligne de pays cible |

Les détails culture × années exacts sont dans `qualification.json`. Les trois tables non administratives ne sont pas réunies aux lignes régionales :

- `GROW-Africa_LSMS_survey.xlsx` : rendements déclarés de parcelles, plusieurs estimateurs de production et dénominateurs (surface déclarée ou GPS), part de la parcelle cultivée et récoltée; pas de jointure météo/sol/campagne exploitable commune établie ici.
- `GROW-Africa_Point.xlsx` : géolocalisations ponctuelles et précision annoncée variable; ne pas assimiler ces points à des contours de parcelle.
- `GROW-Africa_LSMS_cropcut.xlsx` : table parcourue; aucune ligne ne correspond aux six pays ciblés dans cette version.

Aucune de ces tables n’est utilisée pour produire un effet d’irrigation, un effet d’engrais, un rendement potentiel ni une validation d’un contour précis.

## Protocole d’évaluation

Deux baselines simples sont évaluées à l’unité administrative, par pays × culture × niveau, avec les années de récolte à partir de 2011 : (1) moyenne de l’historique du même territoire, limitée aux années antérieures; (2) observation antérieure la plus récente du même territoire. Un contrôle spatial séparé réserve l’unité administrative entière et prédit avec l’historique antérieur des autres unités du même pays/culture/niveau. L’effectif minimal de test est de trois années antérieures pour le test temporel et de trois territoires/10 observations d’apprentissage pour le test spatial. Les lignes d’une même unité ne sont donc pas réparties aléatoirement dans les deux côtés d’un test spatial.

`evaluation.json` donne les effectifs de test, unités et années indépendants, MAE, RMSE, biais, nRMSE, R² quand défini et un intervalle bootstrap de la MAE (1000 rééchantillonnages de territoires; au moins trois territoires). Cet intervalle décrit l’incertitude de la MAE, pas une plage prédictive. Les métriques mélangent encore des campagnes et définitions de rendement source; elles ne certifient pas une compétence parcellaire.

| Pays | Maïs, niveau 2, test temporel historique | Maïs, niveau 2, unités spatiales réservées |
|---|---|---|
| Bénin | n=836; 76 territoires; 2011–2021; MAE 0,247; RMSE 0,349; biais −0,132; nRMSE 27,1 %; R² 0,268 | n=836; 76 territoires; MAE 0,315; RMSE 0,436; biais −0,133; nRMSE 34,0 %; R² −0,146 |
| Burkina Faso | n=537; 45 territoires; 2011–2022; MAE 0,331; RMSE 0,435; biais −0,193; nRMSE 32,4 %; R² 0,359 | n=537; 45 territoires; MAE 0,468; RMSE 0,588; biais −0,205; nRMSE 43,8 %; R² −0,172 |
| Ghana | pas de test temporel/spatial admissible; séries administratives concentrées sur 2012–2016, sans historique antérieur suffisant par unité | pas de test admissible |
| Sénégal | n=232; 39 territoires; 2011–2016; MAE 0,409; RMSE 0,561; biais −0,258; nRMSE 44,7 %; R² 0,308 | n=232; 39 territoires; MAE 0,548; RMSE 0,705; biais −0,197; nRMSE 56,2 %; R² −0,095 |
| Togo | n=191; 34 territoires; 2011–2017; MAE 0,220; RMSE 0,298; biais −0,037; nRMSE 24,9 %; R² 0,369 | n=191; 34 territoires; MAE 0,302; RMSE 0,382; biais −0,037; nRMSE 31,9 %; R² −0,038 |
| Côte d’Ivoire | aucune série régionale admissible | aucune série régionale admissible |

Les erreurs spatiales donnent un R² négatif pour le maïs au Bénin, au Burkina Faso, au Sénégal et au Togo. En outre, aucune covariable météo, sol ou satellite n’a été jointe et les définitions de cible ne sont pas harmonisées. **Aucun modèle régional n’est activé comme prévision.** Les seules lignes affichées dans l’application sont des références historiques si un nom de territoire déclaré correspond exactement à une seule unité; elles ne sont ni extrapolées au champ ni injectées dans le calcul.

## Usage dans l’application

`data/seasonal/grow-africa-regional.json` alimente uniquement le panneau replié « Repère statistique régional · GROW-Africa ». Un rapprochement exact et unique du nom de territoire est exigé; aucune région n’est déduite des coordonnées ou de la forme du contour. Côte d’Ivoire, territoire inconnu, correspondance ambiguë ou culture absente produisent un statut indisponible avec la raison, sans substitution par un pays ou une région voisine.
