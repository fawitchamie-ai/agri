# Données expérimentales de recherche

Les données de ce dossier ne sont pas utilisées par le moteur de rendement publié. Elles servent à préparer et auditer une calibration future. Aucun des six pays n'est déclaré calibré.

- `raw/open/` : sous-ensemble CC0 des fonctions ajustées OFRA (ce ne sont pas des parcelles), profils pH eau WoSIS filtrés selon la licence de chaque ligne, et moyennes d'essais variétaux IITA Togo. Attribution détaillée dans `manifest.json` et `docs/calibration/REGISTRE_SOURCES.json`.
- `raw/research-only/` : emplacement local ignoré par Git pour les données originales CIRAD Gagnoa et SOERE PRO Sénégal sous **CC BY-NC-SA 4.0**, acquises et contrôlées localement, **non redistribuées dans ce dépôt**, pour la recherche non commerciale. La même restriction s'applique aux extractions et à la base dérivée. Ce dossier n'est ni exposé par le site ni intégré dans un modèle opérationnel. Une exploitation commerciale exige une autorisation distincte des ayants droit. Le code d'import n'accorde aucun droit supplémentaire sur ces données.
- `manifest.json` : URL d'acquisition, version, licence, dates d'accès, taille et SHA-256 de chaque fichier. Une copie modifiée est refusée par le reconstructeur.

Reconstruction sans service externe et sans dépendance Python tierce :

```bash
python scripts/calibration/build.py --output work/experimental-open
# Acquérir d’abord les originaux si leur licence permet votre usage de recherche
python scripts/calibration/acquire.py --destination research-data/calibration/raw/research-only --include-noncommercial-research
python scripts/calibration/build.py --output work/experimental-research --include-noncommercial-research
```

La commande `build.py --include-noncommercial-research` matérialise une base de recherche non commerciale. Les CSV exportés et la base SQLite portent leur provenance et leur licence. Les champs absents restent null ; les lignes non qualifiables restent en quarantaine. Les modèles, campagnes utilisateur, cartes et observations de production ne sont pas modifiés.

Citations :

- Cardinael R., Guibert H., Kouassi Brédoumy S.T., Gigou J., N'Goran K.E., Corbeels M. Données Gagnoa, CIRAD Dataverse v1, DOI https://doi.org/10.18167/DVN1/MHLKKW ; article https://doi.org/10.1016/j.fcr.2021.108335.
- Vermeire M.-L., Basse P., Legros S., Diallo F., Desnues A., Feder F. SOERE PRO Sénégal, CIRAD Dataverse v3.1, DOI https://doi.org/10.18167/DVN1/CHZ81W ; article https://doi.org/10.1016/j.dib.2026.112456. La licence CC BY de l'article ne remplace pas la licence CC BY-NC-SA du jeu de données.
- Wortmann C. et al. OFRA, DOI https://doi.org/10.5061/dryad.tt6h5h1, miroir https://zenodo.org/records/4383403, CC0-1.0.
- Batjes N.H., Calisto L., de Sousa L.M. WoSIS latest, https://doi.org/10.5194/essd-16-4735-2024 ; accès WFS le 1 novembre 2026. Les licences CC BY 3.0/4.0 et domaine public US sont préservées par ligne ; les lignes NC sont exclues du sous-ensemble ouvert.
- IITA, essais internationaux de maïs au Togo, https://doi.org/10.25502/20180730/1522/MA, CC BY 4.0.

Pour ces données, les conditions ci-dessus prévalent sur toute licence générale du dépôt. Les identifiants de sites et profils sont ceux d'essais et bases scientifiques publiés ; aucune campagne privée de coopérative n'est incluse.
