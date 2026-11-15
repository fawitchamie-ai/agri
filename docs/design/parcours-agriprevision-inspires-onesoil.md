# Parcours AgriPrévision réorganisés

Analyse des parcours OneSoil publics consultés le 15 novembre 2026 et traduction
en organisation propre à AgriPrévision. Ce document décrit une référence de
parcours, pas une affiliation ni une copie de marque ou de calculs.

## Parcours observés

| Besoin | Parcours OneSoil public | Adaptation AgriPrévision |
|---|---|---|
| Retrouver ses champs | Liste de champs, ajout depuis carte, dessin ou fichier ; champ sélectionné sur une carte | « Carte des champs » associe la liste recherchable aux limites réellement enregistrées ; sélectionner une parcelle la centre et expose ses informations |
| Suivre une culture | Fiche de statut avec image, indice, dates, météo et évolution intra-saison | Les raccourcis ouvrent directement le suivi du champ sélectionné ; images et indices, météo, zones historiques, doses et carnet restent liés à ce champ |
| Analyser les différences internes | Rapport du champ avec zones historiques, stabilité et motifs d’inéligibilité | « Zones historiques » ouvre la comparaison pluriannuelle et expose les raisons de suspension |
| Préparer une action | Cartes de tâches pour semis, fertilisation ou pulvérisation, selon l’image courante ou les zones historiques | « Cartes de doses » ouvre la carte préparée par l’opérateur et ses totaux ; les recommandations automatiques restent désactivées sans calibration |
| Faire le suivi terrain | Notes de reconnaissance et données de récolte reliées au champ | « Carnet terrain » et « Récoltes observées » sont placés dans le même parcours de campagne |
| Examiner méthodes et références | Les outils avancés restent dans OneSoil Pro et la donnée opérationnelle dans ses applications de suivi | « Données et méthodes » et « Coopérative » restent disponibles dans des groupes repliables, séparés des décisions quotidiennes |

## Changements d’interface

- Une navigation latérale commune remplace les deux menus séparés de l’accueil et
  de l’espace applicatif.
- L’accueil devient un espace de travail cartographique : liste et recherche à
  gauche, contours réels sur la carte, bascule Plan/Satellite et détail du champ
  sélectionné. Sur mobile, liste et carte se consultent dans deux vues adaptées.
- Le bouton d’ajout ouvre directement le tracé de parcelle. Un champ existant
  ouvre soit son suivi, soit son tracé si aucun contour n’est encore enregistré.
- Le contexte du champ sélectionné est conservé dans la navigation : les entrées
  Suivi satellite, Zones historiques, Cartes de doses et Carnet terrain s’ouvrent
  sur ce champ. Sans sélection, l’application revient à la liste et l’indique.
- Les raccourcis de navigation conduisent directement à l’onglet de campagne
  correspondant. La destination reste dans l’adresse et suit précédent/suivant.
- Les tableaux de référence, le catalogue scientifique et les outils coopératifs
  sont regroupés à part pour réduire le bruit dans les tâches de terrain.

## Limites conservées dans les libellés

La documentation OneSoil décrit des cartes de rendement, d’élévation et de
luminosité du sol, des essais VRA et des cartes machine. AgriPrévision ne les
présente pas comme disponibles lorsqu’elles ne sont pas implémentées. La carte
historique actuelle exprime une vigueur relative issue de Sentinel-2 ; les doses
restent saisies et confirmées. Aucun rendement parcellaire en t/ha n’est produit
par cette organisation d’écrans.

## Références publiques

- [Plateforme OneSoil](https://onesoil.ai/en/platform) : suivi, analyse de
  productivité, actions, essais et distinction web / mobile.
- [Analyser la donnée d’un champ](https://help.onesoil.ai/en/articles/6998999-analyzing-field-data) : fenêtres saisonnières, stabilité et refus de zones.
- [Ajouter des champs](https://help.onesoil.ai/en/articles/5235093-how-to-add-fields-in-the-onesoil-platform) : liste, carte et création.
- [Statut, NDVI et météo](https://help.onesoil.ai/en/articles/8354961-checking-field-status-ndvi-and-weather-data) : écran de suivi par champ.
- [Démarrage OneSoil Pro](https://help.onesoil.ai/en/articles/7007824-onesoil-pro-quick-start-guide) : rapports, cartes de doses, essais et analyse des récoltes.
- [Différences entre les applications OneSoil](https://help.onesoil.ai/en/articles/5237584-how-the-onesoil-web-and-mobile-apps-differ) : répartition des fonctions selon la plateforme.
