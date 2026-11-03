# Présentation et espace de simulation

Refonte du 3 novembre 2026. Le premier écran présente AgriPrévision ; le travail
sur les campagnes commence avec « Commencer une simulation ». L’accueil ne
déclenche pas les API scientifiques et métier.

## Parcours

1. **Parcelle** : chercher un lieu, dessiner, saisir des points GPS ou importer
   un GeoJSON. Confirmer le contour avant de passer à la campagne.
2. **Campagne** : nommer le champ, choisir sa culture et sa date de semis.
   L’acquisition environnementale et le calcul attendent la fin de cette étape.
3. **Simulation** : lire une synthèse, puis ouvrir le module nécessaire.
   Les hypothèses soumises à accord et les calculs bloqués restent explicites.

Le navigateur conserve le composant de simulation lors des changements de
rubrique : ouvrir les récoltes, les références ou la présentation ne détruit
pas le brouillon en mémoire. Les changements de propriétaire continuent de
réinitialiser les données de l’espace. Un nouveau brouillon ou l’ouverture
d’une autre campagne demande de confirmer le remplacement des modifications.

## Fonctions et nouvel emplacement

| Fonction conservée | Emplacement |
| --- | --- |
| Surface, contours, trous, pays, couches terre/eau | Carte de parcelle |
| Recherche de lieu, GPS, GeoJSON, dessin tactile | Carte, outils de localisation et de contour |
| Rendement, production, surface semée, référence et méthode | Module Rendement |
| Comparaison des campagnes et export du rendement | Module Rendement, détails |
| Besoins hydriques, semences et irrigation | Module Eau et semis |
| Calendrier détaillé, contraintes, tableau et export d’eau | Paramètres → Calendrier détaillé |
| Produits, compositions, doses et propositions culturales | Engrais → Mes apports |
| QUEFTS, comparaison avec/sans nouvel apport, preuves et seuil économique | Engrais → Effet sur le rendement |
| Comparaison des interventions prévues | Engrais ou Eau et semis, comparaison |
| Satellite, NDVI, anomalie, dates publiées et consentement | Module Images |
| Notes de terrain et essais comparatifs | Module Carnet |
| Mesures de pluie, irrigation, humidité, corrections et synchronisation | Carnet → Carnet d’eau |
| Sol, analyses chimiques, installation, météo, dates de semis | Module Paramètres, réglages détaillés |
| Provenance des entrées et diagnostics agronomiques | Module Paramètres, panneaux sur demande |
| Sauvegarde, révisions, campagnes précédentes et brouillon local | Enregistrer / Mes simulations / Fichiers |
| JSON de campagne, GeoJSON, CSV et PDF métier | Fichiers et exports dans chaque outil concerné |
| Quantités réellement récoltées, déclarations et pesées | Récoltes réelles, formulaire ouvert à la demande |
| Collecte, créneaux, magasins, capacités et transport | Coopérative → Collectes et logistique |
| Membres, moyens, rôles, invitations et démonstration | Coopérative → Membres et moyens, sous-rubriques |
| Estimations historiques, atlas, modèles, qualité et catalogue | Données et références |
| Conversion rendement–volume et imports scientifiques | Outils et fichiers |

La synthèse montre trois indicateurs prioritaires. Les références longues,
analyses, explications et formulaires spécialisés sont accessibles après une
action explicite. Le formulaire de récolte porte sur les quantités obtenues,
distinctes du scénario simulé. Ses filtres excluent les versions de modèle et
échelles scientifiques sans rôle dans cette saisie.

## Choix visuels et vérification

- Palette vert profond, surfaces claires, typographie Lato, navigation stable.
- Illustration d’accueil créée en SVG ; elle n’est pas une image satellite.
- Le dessin du contour en synthèse est une représentation géométrique,
  distincte des couches satellite du module Images.
- Les panneaux repliés sont montés à l’ouverture afin d’éviter les requêtes
  et le bruit visuel des outils non consultés.
- Navigation au clavier pour les modules ; états chargement, erreur et vide.
- Les valeurs périmées sont masquées. Une erreur ne reste pas affichée comme
  un recalcul perpétuel et n’autorise pas à présenter une estimation absente.

Tests : la navigation réelle du composant React vérifie l’accueil sans API,
le maintien du brouillon et l’ouverture volontaire du formulaire de récolte.
La préparation et la reprise vérifient l’attente du terrain, la suspension
pendant le dessin et l’application de la culture choisie. Les règles de
calcul, permissions et contrôles d’origine restent testés par les suites
existantes. La refonte ne valide pas les modèles au champ et n’augmente pas le
plafond CPU du Worker.

## Références de conception

Les guides officiels consultés organisent le travail par parcelle/campagne et
permettent de passer d’une vue synthétique à des analyses spécialisées.
Le parcours et la mise en page d’AgriPrévision sont des décisions de conception
propres au projet, sans reprise des interfaces ou des promesses commerciales.

- OneSoil : https://onesoil.ai/en/platform
- OneSoil, démarrage : https://help.onesoil.ai/en/articles/17634801-how-to-get-started-with-onesoil
- EOSDA, gestion des parcelles : https://eos.com/user-guide/crop-monitoring/fields/
- EOSDA, campagnes : https://eos.com/user-guide/crop-monitoring/seasonality/
