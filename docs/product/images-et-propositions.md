# Images et saisies accompagnées — 3 novembre 2026

Base : main 39a93e3 (PR #26). La correction conserve son mode QUEFTS maïs et
son accueil précompilé ; aucune modification des modèles agronomiques.

- Composition : remplacer la rangée flex par une grille à trois colonnes puis
  une colonne sur mobile ; analyse détaillée sur une ligne complète, en grille
  indépendante. Les champs ont des largeurs minimales nulles et labels sécables.
- Satellite : accepter dates ISO, horodatages et intervalles explicitement
  annoncés dans Dimension/Extent WMS ; ne pas fabriquer des dates hors catalogue.
  Demander WMS 1.3.0 explicitement. Si STAC ne correspond pas, proposer les dates
  régionales avec avertissement au lieu de vider la liste. Secours direct public
  pour une image rejetée par le relais.
- Satellite RGB sans date exploitable : afficher le fond de repérage Esri déjà
  utilisé dans la carte. Date non documentée, attribution visible. Ce fond ne
  remplace jamais NDVI, anomalie ou classification : aucune fausse mesure.
- Propositions : références du pays et de la culture en premier ; autres pays
  marqués comme transferts. Une proposition remplit un formulaire modifiable,
  conserve source/composition/calendrier, et doit être ajoutée explicitement.
  Statut toujours prévu ; composition enregistrée comme scénario de référence.
  Aucun apport réalisé remplacé. Fenêtres passées bloquées. Les cultures sans
  dose documentée affichent leurs besoins et les informations encore requises.
- Source supplémentaire : ministère togolais / ICAT, 27 juillet 2022 :
  https://agriculture.gouv.tg/recommandations-des-doses-dengrais-mineraux-et-periodes-depandage-pour-les-principales-cultures-vivrieres/
  Maïs : NPK15-15-15 200 kg/ha J10–15, urée46 100 J30–45. Riz pluvial : NPK150
  J15–21, urée25 J35–40 et25 J55–60. Riz bas-fond : NPK200 J15–21, urée50 J35–40
  et50 J55–60 (calendrier après semis, pas après repiquage). Sorgho local haut :
  NPK150 J10–15, urée50 J40–60. Les prix historiques ne sont pas repris comme
  prix actuels. Les références territoriales CNRA/FertiTogo/MoFA existantes restent
  distinctes ; les alternatives de produits ne sont pas additionnées.
- QUEFTS : bouton de préremplissage du plafond 10 t/ha publié au Nigeria,
  explicitement hypothèse transférée à adapter au contexte hydrique ; activation
  toujours volontaire. Cette valeur ne devient pas une prévision locale.

Vérifications : types, tests d'interaction du préremplissage, provenance,
non-mutation des campagnes, fenêtres calendaires, horodatages/intervalle WMS.
Test Chromium des rectangles de champs sur 1200/360 px lorsqu'un navigateur est
présent (runner CI). L'installation locale de Chromium a échoué (archive tronquée).
Test CI du service public réel : catalogue et PNG à une emprise témoin publique
au Togo ; indisponibilité réseau signalée comme test ignoré, sans fausse réussite.
L'accès au fournisseur depuis le conteneur local a répondu 403 ; pas de preuve
locale d'acquisition d'une image réelle. Les résultats distants sont sur la PR.

Le test réel sur GitHub a révélé un second défaut : GetMap refusait la largeur
640 avec « Width 640 exceeds supported maximum 512 ». Les images WMS sont
désormais demandées en 512×320 (mêmes proportions que le cadre 640×400).
Le test distant vérifie RGB, NDVI et anomalie, la signature PNG et les dimensions.
Une réponse 4xx n’est plus considérée comme une simple indisponibilité réseau.
Chrome a confirmé des champs distincts sans débordement à 1200/360 px dans la CI.

Le contrôle de publication a révélé une erreur du test distant : il choisissait
la première scène STAC (29 octobre), plus récente que le catalogue WMS du
13 octobre. Le test suit désormais la même règle que le client : intersection
des dates STAC et WMS avant GetMap. Les dates STAC seules ne prouvent pas
la publication d’une image WMS. Aucune restriction serveur n’est contournée.
