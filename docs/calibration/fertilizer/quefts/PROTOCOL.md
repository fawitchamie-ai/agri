# Scénarios mécanistes transférés — protocole du 2 novembre 2026

Enregistré avant exécution du nouveau simulateur. Parent : fed924f.
Les seuils et résultats historiques v1/v2 restent inchangés. Aucun nouveau test
prédictif n'est annoncé : leurs étiquettes ont déjà été consultées.

## Objet et sources

Implémentation indépendante des équations QUEFTS (offre, absorption limitée par
les autres nutriments, six combinaisons de rendement) décrites par Shehu et al.,
2019, DOI https://doi.org/10.1016/j.fcr.2019.107585 (CC BY 4.0), §2.4 et tableaux
1, 3, 4. Paramètres maïs NGS et SS conservés comme deux profils cohérents, sans
mélanger arbitrairement leurs coefficients. Fourniture initiale calculée aux
sols moyens publiés, scénario de transfert et non mesure d'un sol cible.

Le transfert vers TGO/BEN/BFA/GHA/CIV/SEN est explicitement exploratoire. Ne pas
attribuer un profil à un pays, à un point GPS ou à SoilGrids. Ne pas utiliser les
coefficients maïs pour d'autres cultures. Plafond de rendement saisi, sourcé et
exprimé à 15 % d'humidité par hectare semé, compatible avec les conditions
hydriques envisagées. Pas de valeur par défaut pour ce plafond.

Une ancre facultative est un rendement témoin déclaré sans aucun engrais,
sur une unité et une humidité identiques. Pour chaque profil, rechercher un
unique facteur d'échelle de sa fourniture N/P/K qui reproduit cette ancre.
Le ratio N:P:K reste une hypothèse : un seul rendement ne l'identifie pas.
Cette inversion est une nouvelle hypothèse de l'application, non une méthode
validée par Shehu. Ne pas appeler cet ajustement validation ou apprentissage.

## Garde-fous

- Opt-in explicite, culture maïs terrestre drainée, composition minérale connue.
- Apports déclarés conservés dans les deux bras ; seuls les apports planifiés
  non passés changent. Un calendrier passé non réalisé bloque la simulation.
- NPK élémentaires convertis par le convertisseur existant, jamais oxyde = élément.
- Doses totales bornées au protocole de la publication ; aucun optimum calculé.
- Fournitures inconnues ne deviennent pas zéro ; organique hors domaine.
- Deux réponses appariées : min/max des gains calculés au sein de chaque profil,
  jamais différence de quantiles marginaux. Plage de sensibilité, pas IC à 95 %.
- Les rendements d'eau/FAOSTAT ne sont pas utilisés comme témoins sans engrais.
  Le plafond porte déjà le contexte hydrique : aucun second facteur hydrique.
- Production sur surface semée géométriquement vérifiée seulement ; sinon null.
- Les paramètres sont persistés avec la campagne ; changer culture/contour
  invalide l'accord. Aucun réentraînement ni appel externe à chaque calcul.
- Pas de MAE/RMSE inventée. La vérification mathématique et logicielle ne
  constitue pas une validation parcellaire ou une prescription de dose.

## Vérification prévue

Continuité et limites des équations, limitation par P/K malgré N, dose zéro,
saturation, ancrage et non-identifiabilité, nutriments/produits, apports réalisés,
surface, domaines, valeurs manquantes, persistance et isolation des comptes.
Contrôles standards du dépôt, PR puis publication par le workflow existant.
