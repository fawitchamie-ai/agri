# AgriPrévision Desktop

Version 0.4.0 · Base Windows avec Tauri 2 et synchronisation volontaire avec le Worker

Le projet embarque la maquette AgriPrévision dans une fenêtre de bureau. Les sept aides locales restent des scénarios de démonstration. Le bouton **Mon compte** ouvre le Worker `https://agri.fawitchamie.workers.dev/` avec votre session Cloudflare Access. Le mode connecté lit et enregistre les campagnes avec révision attendue, documente les observations de pluie et d’irrigation, planifie des apports et affiche les résultats recalculés par le Worker. Les images Sentinel‑2, indices NDVI/EVI et cartes de zones et de doses sont chargés à la demande. Une carte de doses n’apparaît que si sa prescription est confirmée et validée par le Worker.

## Démarrer sur Windows

Installez [Node.js](https://nodejs.org/fr), [Rust stable](https://rust-lang.org/tools/install) et les [outils Microsoft C++](https://visualstudio.microsoft.com/fr/visual-cpp-build-tools/) avec la charge de travail **Développement Desktop en C++**. Le [guide de Tauri](https://v2.tauri.app/start/prerequisites/#windows) indique comment vérifier le runtime WebView2.

Extrayez le dossier **AgriPrevision-Desktop**. Ouvrez-le dans VS Code ou ouvrez PowerShell dans ce dossier, puis lancez ces deux commandes.

```powershell
npm.cmd install
npm.cmd run desktop:dev
```

Le premier lancement télécharge les dépendances de compilation. La fenêtre AgriPrévision s’ouvre une fois la compilation terminée. Choisissez **Mon compte → Se connecter**, terminez l’authentification Cloudflare Access dans la fenêtre ouverte, puis cliquez sur **Actualiser les campagnes**. Si aucun espace personnel n’est ouvert, l’API refuse l’accès et l’application affiche son erreur. **Revenir à la démonstration** restaure les scénarios locaux.

## Préparer l’installateur

Dans le même dossier, exécutez cette commande.

```powershell
npm.cmd run desktop:build
```

L’installateur NSIS au format `*-setup.exe` se trouve par défaut dans `src-tauri/target/release/bundle/nsis/`. Il installe AgriPrévision pour l’utilisateur Windows courant. Si WebView2 doit être installé, l’installateur utilise une connexion pour le télécharger. Les écrans et les calculs de démonstration fonctionnent hors connexion ; la lecture des campagnes requiert Internet et une session Access autorisée.

## Où intervenir

| Besoin | Fichier ou dossier |
| --- | --- |
| Structure et style de l’écran | `ui/index.html` et `ui/styles/` |
| Parcelles, carte, couches et carnet | `ui/js/carte.js` et `ui/js/champs.js` |
| Données d’exemple et calculs de décision | `ui/js/calculs-decisions.js` |
| Fiches, aperçus et brouillons | `ui/js/ecrans-decisions.js` |
| Fenêtre et installateur Windows | `src-tauri/` |
| Lecture sécurisée des campagnes du Worker | `src-tauri/src/main.rs` et `ui/js/worker-campagnes.js` |

## Reprendre le développement

La création initiale accepte un contour GeoJSON et prépare un **maïs** avec un profil FAO56 indicatif, sans météo, humidité initiale ou paramètres de pompe inventés. Complétez ces données sur la campagne avant d’utiliser un résultat hydrique. L’édition rapide modifie le nom et la localité ; les autres saisies de la maquette connectée passent par les fiches Eau, Engrais et Observations. Chaque enregistrement utilise `expectedRevision` : en cas de conflit ou d’erreur, le formulaire reste ouvert. La comparaison de vente et le contrôle de levée sont des calculs locaux à partir des valeurs saisies ; ils ne prétendent pas prédire le prix ou décider automatiquement un regarnissage. Les données du mode Démonstration ne sont jamais envoyées au compte.

La route `field-zone-map` du Worker fournit le GeoJSON calculé par son analyse spatiale et les doses confirmées. Le bouton « Charger la carte géographique » signale toute erreur ou absence de couverture ; aucune carte fictive ne la remplace. L’enregistrement d’une dose commerciale ne calcule pas son effet sur le rendement. Cette route est publiée sur le Worker, avec un contrôle de santé Access réussi après déploiement.

Pour poursuivre sans répéter tout le contexte, utilisez `PROMPT-RACCORDEMENT.md` depuis ce dossier.

## État de ce jalon

Le projet source et ses ressources locales sont fournis. La syntaxe JavaScript, les contrats de route et le test d’accès aux cartes ont été contrôlés. La compilation Windows et la création de l’installateur NSIS ont réussi dans le [workflow Desktop](https://github.com/fawitchamie-ai/agri/actions/runs/45693087636). L’ouverture interactive sous Windows, la qualité des images pour une campagne donnée et une connexion à un compte Access réel restent à confirmer. Un appel public à `/api/health` du Worker a répondu « Connexion Cloudflare Access requise » le 25 novembre 2026. L’installateur est disponible dans l’artefact du workflow, séparément du projet source.
