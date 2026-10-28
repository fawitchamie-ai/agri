# Observatoire agricole — refonte

## Parcours livrés

- Vue d’ensemble : repères scientifiques, série nationale interactive, couverture des six cultures et accès aux outils de terrain.
- Atlas : géométries historiques réelles des 35 unités, couleurs calculées sur les estimations sélectionnées de la campagne et culture, sélection au clavier ou à la souris, classement et série locale. Les unités sans estimation restent grises.
- Résultats et modèles : 15 096 sorties candidates consultables par culture, territoire et année ; métriques nationales calculées dans le protocole source, affichées séparément des prévisions choisies. Aucun intervalle nominal n’est déduit du désaccord des modèles.
- Traçabilité : choix par culture, territoire et campagne ; historique des entrées admissibles, identifiants, lignes et empreintes. Le cadre complet transmis au générateur est distingué du sous-ensemble propre à chaque estimateur.
- Qualité et disponibilité : comptage des candidats, panel et exclusions, explication des motifs, absences INSEED et limites géographiques/GEE/SPAM ; trois archives complémentaires téléchargeables.
- Données et recherche : 175 jeux de tableaux et métadonnées, 450 636 lignes, raccourcis thématiques, profil du jeu entier, choix des colonnes, filtres et exports, accès du panel au fichier source.

Les parcours de simulation, collecte, récoltes, fiche PDF, gestion d’équipe et imports restent disponibles. La navigation utilise un fragment d’URL. Le menu mobile peut être ouvert et fermé. Le chargement du socle scientifique figé reste possible lorsque l’API de l’espace ne répond pas ; les données privées ou imports ne sont jamais remplacés par des données inventées.

## Intégrité

Les index d’affichage dérivent des exports v24 existants. Aucun réentraînement ni changement du CSV de référence. `scripts/build-research-workbench.py` reconstruit les index depuis le catalogue ; un argument pointant vers le dossier scientifique est nécessaire uniquement pour reconstruire les trois téléchargements d’archives. Les inventaires techniques Drive sont exclus du catalogue.

Les archives supplémentaires sont un GeoPackage, le journal historique v19 et le notebook historique v19. Elles ne sont pas présentées comme des résultats v24. Un fichier temporaire incomplet et les reçus techniques de transfert ne sont pas des jeux scientifiques à publier.

## Prévisualisation

`terminal.local` est autorisé par Vite pour la prévisualisation. La consultation de démonstration de cet hôte nécessite simultanément `import.meta.env.DEV === true` et le drapeau local `AUTH_DEMO_ONLY=true`. Cette exception est éliminée dans le build de production. Les mêmes contrôles Access et tests de signature continuent de s’appliquer en production. Le fichier `.dev.vars` reste ignoré par Git.

## Vérification

Contrôle TypeScript, 55 tests unitaires/scientifiques et d’intégrité, tests de routes avec SQLite/D1 et régressions d’autorisation. Vérification navigateur : accueil rempli, sélection de Tchamba sur la carte, passage à ses entrées historiques, métriques nationales des modèles, chargement intégral du panel et filtre riz/Agou (8 lignes), détail des champs. La disposition mobile est prévue par CSS ; le navigateur de contrôle a été vérifié à sa taille bureau.

La publication de code et des archives scientifiques dans GitHub reste soumise à la confirmation explicite demandée par le contrôle automatique lors de la tentative précédente. Aucun envoi ne doit être annoncé comme réussi avant vérification du déploiement.
