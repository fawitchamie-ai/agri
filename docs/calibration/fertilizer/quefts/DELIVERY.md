# Engrais : simulation QUEFTS transférée, 2 novembre 2026

## Ce qui est désormais calculable

Un mode volontaire calcule pour le **maïs grain**, dans les six pays configurés,
le rendement sans nouveaux apports, le rendement avec les engrais prévus et
leur différence. Les produits sont convertis en N/P/K élémentaires. Les apports
déclarés réalisés sont présents dans les deux bras. Une surface semée vérifiée
donne aussi la production, sans nouvelle réduction par la surface récoltée.

Ce mode est un **scénario exploratoire transféré**, pas une calibration validée
dans les six pays. Les diagnostics v1/v2, leurs seuils et leur désactivation
comme prédicteurs locaux restent inchangés. Aucune nouvelle MAE, couverture à
95 % ou dose optimale n'est annoncée. Aucun essai ni récolte supplémentaire
n'a été créé à partir de ces équations.

## Recherche et choix

| Source primaire consultée | Apport et décision |
|---|---|
| [Shehu et al., 2019, Field Crops Research](https://doi.org/10.1016/j.fcr.2019.107585), [texte intégral CC BY](https://pmc.ncbi.nlm.nih.gov/articles/PMC6737993/) | Équations QUEFTS et deux paramétrages maïs de savanes nigérianes : retenus comme scénarios explicites de transfert. Données de sol, récupération, efficacités et doses décrites. |
| [Sattari et al., 2014](https://doi.org/10.1016/j.fcr.2013.12.005), [notice des auteurs PBL](https://www.pbl.nl/en/publications/crop-yield-response-to-soil-fertility-and-n-p-k-inputs-in-different-environments-testing-and-improving-the-quefts) | Travaux sur six jeux maïs/riz/blé, tropicaux et tempérés. Transfert nécessitant des adaptations ; les interactions hydriques et d'autres nutriments restent des limites. Aucun coefficient de blé/riz transféré au maïs. |
| [Ezui et al., 2017, Plant and Soil](https://doi.org/10.1007/s11104-017-3387-6), [notice des auteurs WUR](https://research.wur.nl/en/publications/understanding-cassava-yield-response-to-soil-and-fertilizer-nutri/) | Application QUEFTS au manioc au Togo/Ghana. Pertinence régionale, mais surestimation en présence de sécheresse. Ses coefficients manioc ne sont pas réutilisés pour les céréales. |
| [PCSE 6, documentation officielle](https://pcse.readthedocs.io/en/latest/code.html) | WOFOST eau–N reste une piste dynamique ; le service existant n'est pas provisionné et exige états/paramètres supplémentaires. Pas d'appel fictif à ce moteur. |
| [Rquefts, documentation des auteurs](https://reagro.org/methods/explanatory/quefts.html) | Confirme les entrées nécessaires et le rôle des interactions NPK. Aucun code GPL du paquet copié dans l'application. |
| [OFRA, organisme porteur CABI](https://www.cabi.org/projects/optimizing-fertilizer-recommendations-in-africa-ofra/) | Fonctions déjà acquises, à qualifier individuellement avant exécution ; ne constituent pas un nouveau jeu de mesures indépendantes. |

Le changement de méthode évite de demander à une régression géographique peu
informée d'identifier seule la réponse. Il rend calculables des **hypothèses de
nutrition** avec leur provenance. Il ne résout pas, par lui-même, le manque
d'essais de validation locale.

## Implémentation et hypothèses propres à AgriPrévision

`lib/seasonal/quefts.ts` implémente indépendamment les équations publiées :
offre du sol + fraction récupérée de l'apport, absorption limitée par les autres
nutriments, six combinaisons de rendement, saturation au plafond déclaré.
Les profils NGS/SS restent cohérents : pas de sélection après observation des
résultats ni de mélange de leurs coefficients. La fourniture du sol est évaluée
aux propriétés moyennes publiées ; ce n'est pas une mesure du champ cible,
ni, pour les équations non linéaires, la moyenne des fournitures mesurées.

L'équation 2b a une parenthèse ambiguë dans le rendu HTML. Le seuil implémenté
est `ri + (Sj-rj)*(2*dj/ai - aj/di)`, cohérent dimensionnellement et continu avec
2a/2c. Les limites de l'équation 6 sont bornées à son domaine d'interpolation :
pas de prolongement décroissant au-delà de la saturation. Les tests couvrent
ces raccordements et les cas analytiques d'un nutriment limitant.

L'option d'ancrage inverse est **une hypothèse nouvelle de l'application**, non
une méthode validée dans la publication : un facteur commun ajuste la fourniture
N/P/K de chaque profil pour reproduire un témoin déclaré sans aucun engrais.
Les ratios N:P:K restent imposés. Deux profils pouvant reproduire le même témoin
répondent différemment à l'apport : cela expose la non-identifiabilité, sans la
faire disparaître. Le témoin doit être positif, inférieur au plafond, à 15 %
d'humidité et par hectare semé, avec source et contexte. Une mesure de campagne
déjà fertilisée ou une moyenne FAOSTAT n'est pas admissible comme témoin.

Le plafond est obligatoire, sourcé et sans valeur par défaut. Il représente
une hypothèse compatible avec l'eau envisagée, dans la borne 10 t/ha de l'étude.
Ce n'est pas un couplage dynamique eau–N : aucune amélioration de la récupération
par irrigation n'est calculée, et aucun coefficient hydrique n'est multiplié une
deuxième fois. La plage de sortie est le min/max des deux profils, **pas un IC**.
Le min/max du supplément utilise leurs différences appariées, pas la différence
des bornes des niveaux de rendement. Une absence de réponse ou une perte reste
possible en réalité, sans être couverte par ces deux profils monotones.

## Domaine et parcours

- Maïs, sol déclaré drainé, culture unique, système terrestre ; organique,
  salinité renseignée, riz submergé, associations et autres cultures bloqués.
- Dose cumulée réalisée + prévue dans le domaine commun : N ≤ 120, P ≤ 40,
  K ≤ 40 kg élémentaires/ha. Ces limites viennent des traitements de l'étude,
  ne sont pas des recommandations ni une preuve de réponse continue locale.
- Toute composition inconnue ou tout apport passé encore « prévu » suspend le
  résultat. Les dates sont reprises mais leur effet physiologique n'est pas simulé.
- Les paramètres et résultats restent liés aux révisions privées de campagne.
  Culture, variété, pays, semis ou contour changé : accord à réexaminer.
- Onglet **Engrais → Simuler l'effet de mes engrais sur le maïs → Définir les
  hypothèses**. Renseigner plafond/source, éventuellement témoin, puis calculer.
  Enregistrer la campagne conserve le scénario. Modifier les doses le recalcule.
- Le résumé de parcelle affiche la plage avec engrais lorsque ce scénario est
  actif. Le calcul hydrique historique reste consultable séparément ; aucun gain
  n'est ajouté à une moyenne nationale ou à un rendement déjà fertilisé.

## Vérification et publication

Le protocole a été commité initialement à `3212fbf` avant la première exécution.
La reprise a ensuite récupéré `main` à `faaf001` (PR #24 et #25). Les conflits
d'intégration ont conservé les nouveaux onglets, carnet, secteurs et satellite.
Le rebasage conserve le protocole au commit `55c56e0`, avant l'implémentation.

Commandes reproductibles :

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
```

Tests ajoutés : limites analytiques N/P/K, continuité, monotonie et saturation,
ancrage, conservation des apports réalisés, conversions, domaine des six pays,
dates et inconnues, surfaces, absence de second stress hydrique, rendu réel du
composant, masquage des résultats périmés, persistance par révision et isolation
des comptes. Les chiffres du simulateur sont des sorties techniques et ne sont
jamais présentés comme des observations agricoles.

TypeScript, **242 tests de la suite complète**, intégration HTTP, persistance,
régressions et compilation locaux réussis. Le nouveau parcours est vérifié sur
le main récupéré. Les tests de rendu exécutent les vrais
composants en SSR/DOM ; aucune visite humaine authentifiée n'est revendiquée.

**Historique du blocage initial, levé par autorisation explicite le 3 novembre** : deux envois
de la branche ont été refusés, y compris après vérification du dépôt cible et
des droits du compte. La revue considère que la demande récente de continuer
et récupérer les mises à jour ne constitue pas une autorisation explicite de
publication sur le dépôt public. Les seules modifications sortantes sont le
code, les tests synthétiques et cette documentation, sans campagnes privées.
Une confirmation utilisateur explicite est demandée avant une autre tentative.
À ce point : pas de nouvelle PR, pas de CI distante ni de déploiement QUEFTS.
Branche locale `feat/fertilizer-quefts-scenarios`, base distante `faaf001`.

Après autorisation : envoyer cette branche, ouvrir la PR vers main, attendre
les contrôles, fusionner et vérifier le workflow Cloudflare. Reprendre les
dernières mises à jour de main avant fusion. Une publication Cloudflare ne
certifie pas le parcours humain authentifié ; les secrets Access de contrôle
de santé étaient absents aux livraisons précédentes.

## Prochain travail scientifique

Acquérir des témoins et essais d'omission N/P/K indépendants, avec absorption,
humidité et conduite documentées. Utiliser l'ancrage comme initialisation de
scénarios, puis valider la **différence de rendement** sur d'autres parcelles et
campagnes. Conserver les seuils v2. Étendre chaque culture avec ses propres
paramètres et tests ; ne pas recopier les paramètres maïs dans riz/sorgho/mil.

## Publication du 3 novembre et correction CPU

L’utilisateur a explicitement autorisé publication et déploiement. Le GET /
utilisait le rendu React côté serveur ; le forfait Workers gratuit ne fournit
que 10 ms CPU par requête. Le build prépare désormais un document initial
non personnalisé, avec les scripts d’hydratation réels. Après vérification
Access, le Worker sert cet accueil via ASSETS ; API, actions et RSC restent
dynamiques et authentifiés. Aucun changement de formule agronomique.

243 tests locaux réussis. Le HTML initial est produit avec un runtime local
uniquement, sans données de campagne ni identité. La configuration publiée
garde AUTH_DEMO_ONLY=false. La suppression du rendu React réduit le travail
du GET / ; la disparition de toute erreur CPU en production reste à confirmer
par observation des requêtes authentifiées.
