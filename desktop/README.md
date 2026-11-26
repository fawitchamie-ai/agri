# AgriPrévision Desktop

AgriPrévision Windows embarque la même interface que le site Web. Les vues **Champs**, **Comparer**, **Zones**, **Carnet** et **Décider** utilisent `public/champs/` dans les deux versions. Sur Windows, Tauri transmet les requêtes à l’API AgriPrévision. Une connexion Internet et un compte autorisé sont nécessaires pour récupérer et enregistrer les données de campagne.

Utilisez **Mon compte → Se connecter** et terminez l’authentification Cloudflare Access. Les campagnes apparaissent après vérification de la session. **Autres outils** ouvre notamment les simulations de campagne, les prévisions territoriales et la coopérative dans une fenêtre AgriPrévision.

Le fond photographique sert à tracer le champ. Les acquisitions Sentinel‑2, leurs indices et les cartes historiques restent datés et distincts. Les données de sol, de météo et de rendement indisponibles restent signalées. Les cultures dont le cycle demande une référence locale se paramètrent dans **Ma simulation**.

## Exécuter et construire

Installez [Node.js](https://nodejs.org/fr), [Rust stable](https://rust-lang.org/tools/install) et les [outils Microsoft C++](https://visualstudio.microsoft.com/fr/visual-cpp-build-tools/) avec la charge de travail Développement Desktop en C++. Windows utilise [WebView2](https://v2.tauri.app/start/prerequisites/#windows).

Depuis le dépôt complet, ouvrez PowerShell dans `desktop/`.

```powershell
npm.cmd install
npm.cmd run desktop:dev
npm.cmd run desktop:build
```

La compilation produit l’installateur NSIS dans `desktop/src-tauri/target/release/bundle/nsis/`. La procédure de distribution Microsoft Store figure dans [store/README.md](store/README.md).
