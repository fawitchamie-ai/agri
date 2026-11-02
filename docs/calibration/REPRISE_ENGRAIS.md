# Reprise AgriPrévision — 2 novembre 2026

Point de départ : main `3040e1d3f7172ef2a9ecba387738ac7901f29150`. Les résultats cités dans le message de reprise ne sont pas des fichiers retrouvés : ils seront recalculés, avec leurs propres empreintes et limites.

## Plan d'exécution

1. Acquérir les sources ouvertes, contrôler unités, témoins et répétitions ; figer le protocole avant tout calcul de score.
2. Exécuter une calibration de recherche sur contrastes appariés, conserver tests par localités et test Togo, publier résultats et refus d'activation si nécessaire.
3. Intégrer les observations expérimentales et références contextualisées sans les transformer en prévisions parcellaires ni en Ym hydrique ; conserver toute hypothèse utilisateur existante.
4. Ajouter un registre facultatif d'essais volontaires, un contrôle de récolte et une action prioritaire explicite. Tester autorisations, révisions et non-régression ; publier via la CI existante.

## Audit initial

- Dépôt public accessible, droits push établis par le connecteur ; aucune PR ouverte.
- Pas d'instructions AGENTS.md dans le dépôt. Les branches calibration/evidence ont déjà été fusionnées. Aucun fichier de la calibration annoncée dans la conversation n'y figure.
- Le moteur existant FAO eau et le service WOFOST SNOMIN de recherche sont conservés ; les effets P/K et la réponse locale aux engrais ne sont pas activés.
- Les originaux NC et les campagnes privées ne seront pas intégrés au modèle déployé.
- Déploiement existant : workflow main, contrôles puis restauration D1/migrations/publication. Pas de nouvelle infrastructure Sites créée.

Les résultats, commandes et preuves de livraison complèteront ce fichier après leur exécution.

## Résultats de cette reprise

Les sources acquises sont épinglées dans `research-data/fertilizer/v1/sources.json`.
Carob 5 601 lignes ; OFRA 6 146 fonctions ; Sénégal 2 992 lignes dont 2 728 avec
rendement numérique. 554 paires de maïs / 25 groupes de localités sont reconstruits.
Le premier split qui distinguait T/wada et Tudun Wada est invalidé et conservé ;
la correction géographique est documentée sans modifier les seuils selon les scores.

Protocole final : `docs/calibration/fertilizer/PROTOCOL-v2.json`. Test : 125 paires /
7 localités ; MAE gain 0,96275 t/ha, RMSE 1,29702 ; Togo : 21 paires / 2 localités,
MAE 1,12340, RMSE 1,38984, biais +0,78727. Les rendements sont tels que rapportés,
sans humidité certifiée. Aucun modèle de prescription n'est activé.

L'application affiche des repères nationaux FAOSTAT et les contrastes observés,
un calcul économique de scénario personnel et une seule action indicative.
Le registre volontaire sauvegarde protocole, tirage, surfaces nettes, apports,
récoltes et corrections dans les révisions de campagne. Aucun jeu privé n'est
utilisé dans la calibration ; aucune migration de production ajoutée.

Vérifications locales : TypeScript et 211 tests Node réussis ; trois nouveaux
contrôles Python de reproductibilité/fuite exécutés (également repris par la
suite d'audit existante). Les 14 tests facultatifs nécessitant les originaux NC
restent explicitement ignorés ; ils ne sont pas déclarés exécutés. Intégration
HTTP et régressions du projet réussies. Compilation réussie.

Contrôle navigateur local : contour saisi et confirmé, session de démonstration,
repère FAOSTAT Togo maïs 2024 (1,26 t/ha récolté), graphique Affem/Sessaro et tableau
contrôlés visuellement ; création d'un essai logiciel à deux blocs et affichage
du tirage vérifiés. L'identifiant a été rendu compatible avec le contexte HTTP de
l'aperçu. Aucune récolte réelle, aucun essai agronomique de terrain et aucune recette
mobile complète revendiqués. Les limites d'acquisition de terrain restent explicites.

Le Git CLI ne dispose pas d'identifiants d'écriture dans cette session ; la
publication est effectuée par le connecteur GitHub du compte propriétaire, avec
une PR dédiée et les contrôles/déploiement existants. Le résultat de cette CI et
la preuve du déploiement doivent être vérifiés avant d'annoncer une publication.
Voir `docs/calibration/fertilizer/DELIVERY.md` pour les fonctions, limites et repli.
