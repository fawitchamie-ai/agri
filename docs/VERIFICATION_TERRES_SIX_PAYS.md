# Terres et simulation conditionnelle — vérification du 31 octobre 2026

Le parcours vérifié est : contour valide → occupation du sol → point terrestre → propriétés du sol et météo → fusion des données avec leur provenance → acceptation explicite des hypothèses → bilan d’eau journalier.

Les sources réelles ont fourni, sur un échantillon dans chacun des six pays, le pH, le carbone organique, l’azote total, la CEC, la texture et six horizons de rétention hydrique. Les six scénarios ont abouti sur 125 jours, avec météo de modèles puis repère historique. Les données et résultats détaillés figurent dans `verification-terrestrial-2026-10-31.json`. Le secteur testé au Burkina Faso contient du bâti : seul son sous-ensemble terrestre a été sélectionné pour le scénario final. Un premier appel au Sénégal a rencontré une indisponibilité temporaire ; une acquisition ultérieure a récupéré le profil et la météo.

Un second contour réel, plus grand, au Togo dépasse l’ancienne limite de lecture. Sa partie terrestre sélectionnée permet également un calcul complet. Les tests déterministes vérifient en complément un raster de 300 000 pixels : le regroupement en rectangles conserve toutes les valeurs et surfaces natives, sans rééchantillonnage.

## Comportement livré

- Le contour dessiné est conservé. Une sélection explicite permet de calculer sur les terres potentielles cartographiées, sans redessiner les berges ni les trous.
- La surface sélectionnée et sa géométrie sont renvoyées dans le résultat. Les volumes et références quantitatives utilisent cette surface ; eau, zones humides, bâti et inconnus restent exclus.
- Les observations conservent leur portée : contour entier ou sélection terrestre. Un changement de surface ne réinterprète pas automatiquement les apports historiques.
- Le serveur réacquiert le classement avant simulation et sauvegarde ; les surfaces ou rapports favorables envoyés par le client ne font pas autorité.
- Les pannes temporaires de SoilGrids/météo ont une reprise bornée. Les unités invalides, pixels sans donnée et valeurs inconnues ne deviennent pas des observations.
- Les hypothèses initiales restent soumises à acceptation. Leur valeur proposée remplace correctement leur ancien état nul, sans transformer une acquisition automatique manquante en mesure.

## Portée des vérifications

Un succès dans six lieux ne prouve pas la disponibilité pour chaque parcelle des six pays. WorldCover est historique, SoilGrids représente une maille de 250 m et un point de sol ne décrit pas toute l’hétérogénéité d’un grand champ. Une terre potentielle peut être boisée ou non cultivable pour d’autres raisons ; aucune autorisation juridique ou aptitude agronomique complète n’est déduite de cette classe.

Les limites synchrones restent explicites : 16 millions de pixels natifs dans le rectangle de lecture, budgets réseau et mémoire, fragmentation géométrique, au plus quatre tuiles par source et limites du validateur de contour. Les cas dépassant ces limites restent incomplets ; aucun résultat favorable n’est fabriqué. Une couverture réellement universelle des grands contours exige un traitement différé par secteurs.

WOfS et InputQuality étaient indisponibles dans le réseau de test. Le classement disponible repose donc ici sur WorldCover/JRC ; il ne confirme pas l’état actuel de l’eau. La saison complète utilise un scénario historique au-delà des modèles météo disponibles. Le module calcule un bilan d’eau conditionnel ; rendements, mortalité, fertilisation locale optimale et validation au champ ne sont pas établis par ces vérifications.

## Reproduire

```bash
node --use-env-proxy --experimental-transform-types scripts/check-terrestrial-simulation.mjs --live /tmp/terrestrial.json
node --use-env-proxy --experimental-transform-types scripts/check-terrestrial-simulation.mjs --live /tmp/large.json --country TGO --half-size .006
```

Ces commandes effectuent des lectures publiques réelles ; elles sont séparées de la suite déterministe pour ne pas faire dépendre la CI de la disponibilité des fournisseurs.
