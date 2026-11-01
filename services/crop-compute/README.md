# Calcul journalier eau–azote, hors Workers

Le service exécute **réellement** `Wofost81_NWLP_MLWB_SNOMIN`, PCSE 6.0.13. Il accepte exclusivement des scénarios de recherche nommés, avec P/K explicitement non limitants et non simulés. Aucun des six pays n'est déclaré calibré. Le maïs est le premier domaine candidat ; le seul paquet complet livré est l'exemple technique pomme de terre du fournisseur aux Pays-Bas, isolé sous `country=DEMO`. Il n'est pas utilisable comme paramétrage agricole africain. Les autres cultures sont refusées par cet adaptateur.

## Exécution reproductible

Python 3.12 est utilisé pour la livraison. Les dépendances de la vérification sont épinglées dans `requirements.lock.txt` ; `requirements.txt` identifie la dépendance scientifique directe.

```bash
python3 -m venv .compute-python
.compute-python/bin/python -m pip install -r services/crop-compute/requirements.lock.txt
.compute-python/bin/python -m unittest discover -s services/crop-compute -p 'test_*.py' -v
.compute-python/bin/python services/crop-compute/runner.py < services/crop-compute/fixtures/upstream-potato.json > work/resultat-technique.json
```

Créer `work` avant la dernière commande. Le JSON de sortie est un scénario technique, avec organes de stockage **secs**, pas une récolte fraîche ou une recommandation. PCSE peut écrire une notice d'initialisation au premier import ; le service ne prend que la dernière ligne JSON et refuse les échecs. Les avertissements de dépréciation de la dépendance sont présents en Python 3.12, sans modifier les équations ou résultats.

## Service local et déploiement

```bash
# Définir CROP_COMPUTE_TOKEN dans le gestionnaire de secrets du service (au moins 32 caractères).
.compute-python/bin/python services/crop-compute/server.py --database work/crop-jobs.sqlite --port 8091
```

Le service écoute par défaut sur 127.0.0.1. Pour un serveur Linux/VM ou une plateforme de conteneurs, construire le `Dockerfile` depuis ce dossier ; placer `/data` sur un volume persistant et exposer le service derrière HTTPS. Une allocation de départ de 1 vCPU/512 Mo est à mesurer sous charge, pas une garantie de dimensionnement. Le calcul observé est inférieur à une seconde sur l'exemple après import ; l'import et le sous-processus ont un coût supplémentaire. Le moteur n'est pas un processus natif exécutable dans l'isolate JavaScript Workers ; il dépend notamment de Python, NumPy et pandas.

L'interface et l'API restent sur Cloudflare. Configurer côté Worker `CROP_COMPUTE_URL` (origine HTTPS et éventuel préfixe stable) et `CROP_COMPUTE_TOKEN` par les mécanismes de variables/secrets existants. Le jeton ne voyage jamais vers le navigateur. Le serveur de calcul doit être effectivement hébergé et accessible avant ce raccordement. **Aucun hébergement externe de calcul n'est provisionné par cette livraison.** Sans configuration, l'API répond 503 « Moteur journalier non raccordé », sans rendement substitué. Un conteneur n'a pas été construit dans l'environnement local dépourvu de Docker ; l'exécution Python et HTTP est testée séparément.

## Contrat HTTP

Tous les appels exigent `Authorization: Bearer <jeton>` et `X-Owner: <empreinte 64 hex>`. Le Worker dérive cette empreinte de la coopérative et de l'utilisateur authentifié ; il ne reprend pas un propriétaire envoyé par le navigateur. Le service vérifie l'appartenance à chaque lecture/reprise. Son jeton donne accès au service : conserver le réseau privé ou le proxy HTTPS contrôlé.

| Appel service | Action POST `/api/seasonal` | Réponse |
| --- | --- | --- |
| POST `/jobs`, bundle JSON | `engine-submit`, `bundle` | 202, id et état persistés ; même bundle/même propriétaire = même id |
| GET `/jobs/<id>` | `engine-status`, `jobId` | pending / running / complete / failed, tentatives, dates, résultat ou erreur |
| POST `/jobs/<id>/retry` | `engine-retry`, `jobId` | Reprise explicite d'un échec ; trois tentatives maximum |
| GET `/health` | Pas d'action navigateur | Version PCSE installée ; n'atteste pas une calibration |

Les tâches sont dans SQLite ; une transaction réserve une tâche à la fois. Un sous-processus séparé dispose de 90 secondes. Après interruption, le bail périmé devient un échec observable et reprenable. Le résultat n'est enregistré que si le vrai moteur termine avec un JSON exploitable. Une erreur, un dépassement de délai ou une dépendance absente ne crée jamais de récolte. Sauvegarder le volume, pas seulement l'image. Aucun résultat journalier n'est injecté dans une campagne existante ou une base de récoltes observées.

## Bundle scientifique

`version=pcse-snomin-bundle-1`, `purpose=named_research_scenario`, `pkAssumption=P_K_nonlimiting_not_simulated`. L'exemple JSON documente la structure complète sans fichiers binaires, chemins distants, pickle, YAML exécutable ni nom de classe fourni par le client. La source, licence, cultivar, pays et nom de scénario sont obligatoires ; ce sont des déclarations de provenance, pas une certification automatique de leur pertinence.

| Objet | Contenu et unités |
| --- | --- |
| `soilProperties` | Propriétés par horizon : épaisseur cm, densité `RHOD` g/cm³, pH de méthode à documenter, C/N, fraction MO, courbes θ(pF) et conductivité. Domaine sans nappe. |
| `initialState` | Eau disponible initiale `WAV` cm, stockage de surface `SSI` cm, NH₄-N/NO₃-N kg N/ha par horizon, âge apparent MO `A0SOM` années. L'humidité par couche est initialisée par le module multicouche depuis WAV/courbes ; aucun profil mesuré θ n'est silencieusement assimilé. |
| `processParameters` | Coefficients SNOMIN avec sources, unités natives et scénario explicités ; aucun remplacement par un paramètre local prétendument calibré. |
| `siteParameters` | CO₂ ppm, pluie non infiltrée, dépôt N mg N/L, paramètres fixes d'initialisation hydrique. |
| `cropParameters` | Paramètres complets du cultivar, fournis et sourcés ; `NFIX_FR=0` obligatoire dans ce domaine. |
| `weather` | Dates complètes : IRRAD J/m²/j, TMIN/TMAX °C, VAP hPa, RAIN/E0/ES0/ET0 cm/j, WIND m/s. Aucun remplissage de E0/ES0 par ET0 ni météo future inventée. |
| `applications` | Composantes conservées ; kg matériau frais/ha, masses NH₄-N/NO₃-N/N organique/MO/C, profondeur cm, âge apparent années, date/source/statut. N organique est contenu dans la MO. Urée refusée. |
| `irrigation` | Date, eau au champ mm et efficacité explicite ; conversion en cm une seule fois. |
| `sownAreaHa` | Surface semée de cette unité homogène ; elle ne remplace pas le contrôle du contour par l'API spatiale. |

Pour préparer les masses d'un apport depuis sa composition, l'API `snomin-application` réutilise les conversions serveur du catalogue. Elle exige les quatre formes N et la fermeture du N total. SNOMIN fixe C/MO=0,58 ; une analyse incompatible est refusée. Un scénario équivalent doit être nommé et justifié séparément, jamais présenté comme le produit mesuré. L'âge apparent SNOMIN ne se déduit pas automatiquement de la durée du stockage. Le module impose une incorporation au moins sur le premier horizon : l'adaptateur refuse une profondeur plus faible plutôt que de la corriger silencieusement.

PCSE possède un seul tampon d'apport par date. L'adaptateur somme les masses des composantes du même jour uniquement si profondeur et âge apparent coïncident. C/N du mélange est calculé par C total/N organique total. Sinon le scénario est refusé pour éviter l'écrasement d'un apport. Les composantes d'origine restent dans le résultat. Les statuts prévu/réalisé sont conservés ; ce scénario simule les composantes présentes et ne transforme pas un projet d'apport en observation.

## Sources et droits

- [PCSE, documentation des modèles](https://pcse.readthedocs.io/en/stable/_modules/pcse/models.html), paquet 6.0.13, EUPL-1.2. Aucun code PCSE modifié ou recopié dans l'adaptateur.
- [SNOMIN : code documenté et équations](https://pcse.readthedocs.io/en/stable/_modules/pcse/soil/snomin.html), Berghuijs et al. 2024, DOI [10.1016/j.eja.2024.127099](https://doi.org/10.1016/j.eja.2024.127099). Cette étude concerne le blé néerlandais ; sa publication ne valide pas le maïs des six pays.
- Fixture dérivée du [notebook 12 et données PCSE](https://github.com/ajwdewit/pcse_notebooks/tree/0956456e154e78d977dbb2c87f6b7e59ccf18f04), MIT © Allard de Wit 2017 pour le notebook et l'exemple ; paramètres pomme de terre déclarés EUPL dans les métadonnées YAML. Notices conservées dans `fixtures/LICENSE-MIT.txt` et `fixtures/LICENSE-EUPL.txt`. Le jeu est exclusivement une fixture technique, jamais une donnée locale de calibration.

Les droits des nouveaux paquets de paramètres/données doivent être établis séparément. Aucun essai CC BY-NC-SA du prompt 1 n'est utilisé par le service ou embarqué comme coefficient.
