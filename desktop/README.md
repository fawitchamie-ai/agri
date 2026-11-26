# AgriPrévision Desktop

Version 0.4.1 · Application Windows autonome avec Tauri 2

L’interface est incluse dans l’application. Elle appelle directement l’API AgriPrévision (/api/seasonal) par le client natif de Tauri; elle ne charge pas le site Web AgriPrévision comme interface.

La connexion utilise Microsoft/Cloudflare Access. Une connexion Internet et un compte autorisé sont nécessaires pour lire les campagnes et obtenir les données distantes. L’application n’affiche aucun champ de démonstration.

## Fonctions connectées

- Recherche de localités par l’API et affichage d’images Sentinel‑2 retournées par l’API.
- Création d’une campagne à partir d’un contour dessiné ou d’un GeoJSON. Le contour est manuel et n’a pas de statut cadastral.
- Analyse du terrain, des profils SoilGrids et de l’environnement météorologique par les actions API environment et agronomic-soil. Les propriétés spatiales du sol peuvent aussi être rechargées depuis une campagne enregistrée.
- Affichage des données de sol à résolution native de 250 m. Ce sont des prédictions cartographiques; elles ne remplacent pas une analyse de laboratoire. Le profil de campagne est pondéré à partir des profils API disponibles. Les campagnes ne sont pas créées avec des valeurs de sol inventées.
- Enregistrement dans la campagne des seules lignes météo API marquées « observé » ou « prévision » et pourvues de pluie et d’ET0. Le point météo reprend le point représentatif calculé pour le contour. Les jours estimés ou scénarisés ne sont pas ajoutés comme des mesures réelles; une couverture partielle reste visible.
- Lecture et mise à jour des campagnes par révision, observations, images, séries NDVI/EVI, cartes de zones, informations sur les engrais et résultats conditionnels du Worker.

Le formulaire de création desktop est actuellement limité au maïs; les autres cultures des campagnes déjà enregistrées restent lisibles si l’API les fournit. Les paramètres hydriques non mesurés, comme l’humidité initiale du sol, restent inconnus et bloquent les conseils concernés. Les propriétés chimiques du sol sont affichées avec leur provenance; elles ne sont pas converties automatiquement en dose d’engrais ou en gain de rendement. Un résultat conditionnel reste une estimation du modèle, pas une récolte mesurée ni une prévision validée à l’échelle de la parcelle.

## Démarrer sur Windows

Installez [Node.js](https://nodejs.org/fr), [Rust stable](https://rust-lang.org/tools/install) et les [outils Microsoft C++](https://visualstudio.microsoft.com/fr/visual-cpp-build-tools/) avec la charge de travail **Développement Desktop en C++**. Consultez le [guide Tauri pour Windows](https://v2.tauri.app/start/prerequisites/#windows) pour WebView2.

Dans le dossier extrait AgriPrevision-Desktop, ouvrez PowerShell et lancez :

    npm.cmd install
    npm.cmd run desktop:dev

Dans l’application, choisissez **Mon compte → Se connecter**, terminez l’authentification Access, puis cliquez sur **Actualiser les campagnes**. Si Access ou l’API refuse la connexion, l’application affiche l’erreur reçue.

## Construire l’installateur

    npm.cmd run desktop:build

L’installateur NSIS *-setup.exe est créé dans src-tauri/target/release/bundle/nsis/. Il s’installe pour l’utilisateur Windows courant. Le premier lancement peut demander le téléchargement de WebView2. L’application a besoin d’Internet pour toutes les fonctions qui lisent ou enregistrent les données AgriPrévision.

L’EXE de développement n’est pas signé et peut afficher l’avertissement SmartScreen. Le workflow Desktop produit également les paquets de soumission MSIX. Le paquet MSIX de soumission ne devient installable depuis le Microsoft Store qu’après certification et publication.

## Fichiers principaux

| Fonction | Fichier |
| --- | --- |
| Écrans et style locaux | ui/index.html, ui/styles/ |
| Carte, campagnes et données distantes | ui/js/carte.js, ui/js/champs.js, ui/js/worker-campagnes.js |
| Recherche, contour, terrain, sol et météo | ui/js/worker-edition.js |
| Client natif direct vers l’API | src-tauri/src/main.rs |
| Construction Windows | src-tauri/, ../.github/workflows/desktop.yml |

Les données indisponibles restent identifiées comme telles. Une limite dessinée sur Sentinel‑2 n’est pas une limite juridique ou cadastrale; l’API ne fournit pas de source universelle de limites cadastrales.
