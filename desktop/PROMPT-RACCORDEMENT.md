# Prompt de développement · AgriPrévision Desktop

Tu interviens sur le projet Tauri 2 contenu dans ce dossier et sur le dépôt source `fawitchamie-ai/agri`. Le Worker de référence est `https://agri.fawitchamie.workers.dev/`. Lis d’abord le README de ce dossier, puis les routes et contrats actuellement publiés dans le dépôt. Vérifie la version de `main` avant de modifier quoi que ce soit.

## Objectif

Faire de cette application Windows légère un vrai client du Worker AgriPrévision, en conservant fidèlement la mise en page et les interactions de **notre maquette HTML**. Les données, les calculs et leurs limites doivent venir des mêmes contrats métier que l’application web. Termine le travail par une version vérifiée et un installateur Windows, ou rapporte exactement le prérequis externe qui empêche de le produire. Ne présente jamais les scénarios de démonstration comme des résultats d’une campagne réelle.

## État de départ

- L’interface Tauri embarque la maquette et ses ressources locales.
- Le bouton Mon compte lit les campagnes avec `GET /api/seasonal` et le catalogue, les indices et les cartes avec `POST /api/seasonal`. La création, l’édition, les observations et les plans d’arrosage ou d’engrais appellent `save` ou `event` avec une révision attendue. Une fenêtre WebView ouvre la connexion Cloudflare Access ; le code Rust relit le cookie HTTP-only du profil et appelle le Worker fixe sans exposer le jeton au JavaScript.
- Les campagnes réelles affichent leur contour dans l’emprise des images Sentinel‑2 publiées et peuvent comparer deux dates. La nouvelle route `field-zone-map`, fusionnée dans `main`, fournit les géométries des zones et les doses confirmées, sous réserve de son déploiement sur le Worker.
- Les sept fiches connectées utilisent les données de la campagne lorsqu’un calcul existe. La densité de levée et la comparaison vente/stockage restent des scénarios locaux explicitement signalés. Le mode Démonstration utilise des exemples séparés.
- L’authentification et la compilation native Windows n’ont pas été validées sur cette machine Linux.

## Travail à terminer

1. **Connexion** : tester sous Windows l’ouverture Access, la persistance et l’expiration de session, la sélection d’espace personnel ou coopératif, les réponses 401/403/503, la déconnexion et le comportement hors ligne. Ne stocke ni JWT ni clé de service dans les ressources ou journaux. Corrige le client natif si le profil WebView ne partage pas le cookie entre fenêtres. Ne contourne aucune règle Access.
2. **Campagnes** : vérifier puis achever les parcours de chargement, sélection, création, modification et enregistrement via le contrat versionné du Worker. Respecte `expectedRevision`, les conflits 409 et l’isolement des comptes. Préserve localement un brouillon non synchronisé sans l’envoyer silencieusement et sans écraser une révision distante. Montrer provenance, date, statut et données manquantes.
3. **Cartes et suivi** : utiliser les géométries réelles, les scènes/rastres Sentinel et indices servis par les routes saisonnières existantes. Conserver projection, dates d’acquisition, résolution, masque de nuages, unités et légende. Afficher une absence explicite quand une couche ou sa couverture est indisponible. Les zones historiques et cartes de doses exigent des réponses réelles et leur méthode ; aucune interpolation décorative.
4. **Sept aides** : Semis, Variété, Levée, Eau, Engrais, Récolte, Vente ou stockage. Pour chacune, retrouver le contrat et le calcul existants dans le dépôt, utiliser les entrées de la campagne, afficher l’action, la date, l’unité, la source et les limites. Si le Worker ne possède pas encore un calcul validé, garder la fiche en état indisponible et développer le contrat côté serveur seulement après preuve agronomique et tests. Ne déduis pas une dose personnalisée d’un SoilGrids 250 m ni une culture semée d’un simple NDVI.
5. **Rendement** : afficher t/ha et tonnes uniquement si le rapport réel est disponible et conditionnel. Respecter les scénarios, surfaces semées et périodes. Montrer clairement « Pas simulé » et la raison quand l’estimation manque ou que le calcul Cloudflare échoue. Une modification d’eau ou d’apport ne doit changer le rendement qu’après recalcul serveur réel.
6. **UX** : conserver les dimensions, typographie, couleurs, espacement, cartes et contrôles de la maquette fournie, avec navigation clavier, états chargement/erreur et textes courts en français. Séparer visiblement « Démonstration » et « Données du Worker ». Ne pas copier d’éléments propriétaires exacts de OneSoil.
7. **Livraison** : tests de contrats API, campagnes de test aux données connues, vérification des sept parcours et des états manquants, audit de non-fuite des identifiants, build Tauri sur Windows, installateur NSIS et README de lancement. Ne déploie le Worker que si une modification serveur est réellement nécessaire ; vérifier alors les migrations, la CI et la version publiée.

Commence par un inventaire factuel des routes et des champs disponibles, puis implémente les blocs cohérents jusqu’à obtenir un client fonctionnel. Corrige les tests qui échouent et réessaie. Ne t’arrête pas pour me demander un nouveau prompt entre chaque bloc. Dans le bilan, distingue explicitement les fonctions réellement connectées, celles seulement démonstratives et les données impossibles à calculer avec les sources actuelles.
