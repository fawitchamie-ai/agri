# Calendrier des apports modifiable — 1 novembre 2026

Sur « Ma simulation », la carte « Mes apports, date par date » présente un diagramme en bâtons. Sélectionner une barre, déplacer sa hauteur ou modifier sa quantité dans le champ numérique ou le curseur. Les flèches haut/bas du clavier ajustent aussi la dose. Une simple sélection ne modifie rien. Les dates sont modifiables et des apports peuvent être ajoutés ou supprimés. Le calendrier couvre tout le cycle ; les nombreuses dates défilent horizontalement.

## Eau : réponse effectivement calculée

- Ordonnée en **m³/ha au champ**, abscisse par date. 10 m³/ha = 1 mm ; volume du champ = dose en m³/ha × surface de calcul en m² / 10 000. L’efficacité d’application convertit cette eau brute en lame nette une seule fois ; les pertes de transport ne sont appliquées que pour le prélèvement à la source.
- Le premier réglage copie toutes les dates positives du calendrier automatique dans un calendrier personnalisé. Il ne copie pas seulement les huit premières fenêtres. En mode personnalisé, aucune date supplémentaire ne compense automatiquement un arrosage supprimé ou réduit. Un bouton explicite restaure le mode automatique.
- Le bilan borne les doses selon les jours d’accès, l’intervalle minimal, l’infiltration, la dose nette maximale, les quotas saisonniers et quotidiens et le couple débit × heures lorsqu’ils sont renseignés. La barre demandée est bleue ; une barre intérieure marine indique une dose retenue différente. Ces contraintes sont des hypothèses de l’installation, pas une preuve d’approvisionnement. L’énergie et les disponibilités non renseignées restent inconnues.
- La dose retenue est **simulée**, pas déclarée réalisée. Les arrosages déjà enregistrés dans le carnet ont priorité à la même date ; le plan ne les compte pas deux fois. Une proposition dans le passé n’est pas transformée en arrosage réel. Pour enregistrer un arrosage effectué, utiliser le carnet existant et ses permissions.
- Le serveur recalcule le bilan et les trois scénarios de rendement. La carte et le sélecteur de récolte passent au scénario proposé au premier réglage manuel ; il reste possible de comparer le pluvial et les seuls apports réalisés. Les réponses réseau périmées sont ignorées par le contrôleur de simulation existant ; les contrôles restent montés pendant les recalculs et les résultats antérieurs sont masqués.
- Avec la méthode FAO saisonnière, le rendement répond à ETa/ETm du cycle complet. Il faut une référence Ym indépendante justifiée par hectare semé, une surface semée, un sol drainé, une culture paramétrée et un déficit dans le domaine conservateur accepté. Sans référence ou météo complète, aucun rendement n’est inventé. La méthode « rendement imposé » reste une multiplication par l’hypothèse ; elle ne répond pas à l’eau.
- Cultures avec Ky saisonnier : maïs, sorgho, soja, arachide, tomate, chou pommé, pastèque, oignon et poivron doux. Les paramètres des cycles doivent être complétés pour les profils qui ne disposent pas d’un cycle d’exemple. Les rizières submergées et l’eau permanente restent hors du module terrestre. Le modèle n’ajoute aucune mortalité ni réponse chimique.

Référence du modèle préexistant : [FAO56, équation 90 et tableau 24](https://www.fao.org/4/x0490e/x0490e0e.htm). Les coefficients saisonniers ne sont pas combinés avec des coefficients de stade.

## Engrais, traitements et autres produits

Les onglets distincts enregistrent le produit commercial, la date, la dose, l’unité **kg/ha** ou **L/ha**, le statut prévu ou déclaré réalisé et une source obligatoire. Les unités restent dans des graphiques séparés. Un apport déclaré réalisé ne peut pas être futur à la date du conseil.

Pour un engrais solide en kg/ha avec composition massique connue, les quantités N, P₂O₅ et K₂O sont calculées en kg/ha. Par exemple, 100 kg/ha de NPK 15-15-15 correspondent à 15 kg/ha de chacun de ces trois termes. Ce sont des quantités apportées, pas assimilées. Aucune conversion de L en kg de nutriments sans masse volumique.

**Leur effet quantitatif sur le rendement reste non modélisé.** Un calendrier d’engrais ou de pesticide ne suffit pas à l’établir. Il manque notamment des réponses calibrées pour la culture/variété et la conduite, la disponibilité des nutriments du sol et la récupération des apports ; pour les traitements, le diagnostic, la pression et les dégâts, l’efficacité documentée selon le produit, la cible, le stade et les conditions. Aucun facteur arbitraire ni dose de pesticide automatique. La saisie d’un produit n’est pas une validation d’homologation ni une prescription.

## API, sauvegarde et export

`SeasonalConfig.managementPlan` : version `management-1.0.0`, identité du contour et de la culture ; `irrigation.mode` automatique ou manuel, `applications: [{date,fieldM3Ha}]` ; `products: [{id,date,kind,product,dose,unit,status,source,npkPercent}]`. Chaque dose d’eau est au champ. Les pourcentages massiques N/P₂O₅/K₂O peuvent être null pour inconnu.

Les entrées sont validées côté serveur : dates dans le cycle, valeurs finies positives ou nulles, unités et statuts explicites, limites de taille, absence de doublons d’eau, portée du contour et culture. Les résultats et surfaces soumis par le client ne font pas autorité. L’objet `plan.management` conserve dose demandée, dose simulée, contraintes et quantité de produit sur la surface de calcul. Les produits globaux ne bénéficient pas d’une allocation ou d’un effet de rendement par unité spatiale inventé. Le plan d’eau proposé multi-unités reste suspendu tant que l’allocation des ressources partagées n’est pas définie.

Les révisions de campagnes existantes gardent leurs instantanés. Aucune migration de base n’est nécessaire ; les anciens fichiers sans calendrier restent compatibles. Un nouveau contour ou une nouvelle culture efface ce calendrier de travail. Un changement de semis ne décale pas silencieusement les apports : les dates incompatibles sont à corriger ou le calendrier peut être réinitialisé.

Export local CSV des doses demandées et sources, unités, statuts, composition et limite de rendement ; pour une campagne enregistrée, `GET /api/seasonal?id=…&format=management-csv` retourne le calendrier de la révision courante enregistrée, sous les mêmes permissions. L’export hydraulique CSV recalculé par le serveur ajoute `dose_demandee_m3_ha_champ`, `dose_retenue_m3_ha_champ`, `version_moteur` et `mode_calendrier`. Les données JSON de chaque révision gardent le bilan, le calendrier et ses contraintes.

Versions : moteur hydrique `water-balance-1.4.0` ; rendement `conditional-yield-1.2.0`. Pas de nouvelle acquisition de données agricoles dans ce changement.

## Vérification et limites de validation

Tests synthétiques des unités m³/ha → mm → m³ sur la bonne surface, calendrier manuel sans compensation, dose nulle, quota et efficacité, dates passées et priorité des réalisés, effet sur le rendement hydrique dans les six codes pays, invariance du pluvial/réalisé et du scénario à rendement imposé, météo manquante, masses NPK et unités de produits. Tests serveur de falsification, persistance des révisions, anciennes campagnes et permissions d’export. Exécution du calendrier dans workerd pour les six codes pays avec sources synthétiques. Tests des véritables contrôles React dans un DOM de test : quantité, clavier, sélection sans modification, déplacement de barre, formulaire d’engrais, recalcul et masquage des anciens résultats.

Ces tests ne constituent ni des observations au champ, ni six acquisitions réelles, ni une validation locale du rendement. La simulation dans une session de production connectée reste à vérifier avec une identité Cloudflare Access autorisée ; le workflow signale explicitement son contrôle authentifié ignoré si les secrets de service sont absents.
