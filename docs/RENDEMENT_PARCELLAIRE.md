# Rendement et production selon la surface semée

Version : conditional-yield-1.0.0, 31 octobre 2026.

## Audit du logiciel et choix de méthode

Base examinée : main 5929ead03981954ac7554d3d70bf21f3d9804e05. Aucune PR ouverte lors de l’inspection. Les branches distantes historiques de refonte, provenance, simulation automatique et corrections du raster/dessin existent ; leurs fonctionnalités opérationnelles sont déjà sur main. Aucun assemblage aveugle des anciennes branches.

Le moteur water-balance-1.3.0 calcule ET réelle et demande journalière avec Kc simple, croissance racinaire, réserve du sol, ruissellement, drainage libre et contraintes d’irrigation. Il proposait automatiquement de l’irrigation à partir de la date du conseil : ce bilan ne représentait donc pas un champ laissé sans intervention. Aucun rendement agricole n’y était calculé. L’analyse terrestre produit des fractions géométriques disjointes, mais le contour d’entrée refusait les trous ; ceux-ci sont maintenant acceptés et validés.

Les archives historiques restent des références territoriales. AUDIT_PAYS.json rapporte Togo 2 014 lignes (1995–2019 reconstruit), Bénin 11 412 (1995–2023), Burkina Faso 9 313 (1984–2023), Ghana 1 025 (1997–2022), Sénégal 9 317 (1960–2015). La Côte d’Ivoire n’a pas de panel acquis dans cet audit. Les limites territoriales et périodes ne sont pas assimilées aux parcelles. SCIENCE.md documente les unités et la validation de la référence Togo : les projections 2016–2027 ont une origine fixe en 2015. Aucun de ces rendements historiques n’est automatiquement injecté comme rendement potentiel Ym. Aucun jeu récent n’a été inventé.

Deux méthodes utilisables sont livrées :

- **Scénario à rendement imposé** : hypothèse utilisateur en kg/ha, avec source, contexte, culture, date de disponibilité et dénominateur semé/récolté. Le calcul spatial de production est opérationnel ; les trois hypothèses d’irrigation donnent le même résultat, car aucun effet agronomique n’est inféré par cette méthode.
- **Approximation hydrique FAO saisonnière** : Ym indépendant sous conditions sans déficit hydrique, obligatoirement par hectare initialement semé. Ky saisonnier documenté ; ETm est la somme journalière Kc × ET0, ETa la somme de l’ET réelle du même bilan et du même cycle. Aucun coefficient de stade n’est multiplié avec Ky saisonnier. Une moyenne territoriale déjà affectée par des stress n’est pas un Ym admissible. L’utilisateur doit déclarer et justifier cette indépendance : ceci reste une hypothèse, pas une certification de la référence.

Aucune prévision saisonnière de rendement parcellaire évaluée n’est livrée. Les conseils nutritionnels existants restent séparés. Pas de facteur arbitraire de pH, température ou sol ; pas de mortalité ni de perte par inondation calculée. Un engorgement/submersion connu bloque la méthode hydrique. L’absence d’engorgement doit être déclarée. La riziculture submergée et les nappes proches restent hors domaine.

## Références et domaine d’application

S1 : FAO56, chapitre 8, équations 81 et 90, tableau 24 : https://www.fao.org/4/x0490e/x0490e0e.htm

S2 : FAO, annexe II, base théorique et tableau 12 reprenant FAO33 : https://www.fao.org/4/X5647E/x5647e0e.htm

La relation est Ya = Ym × [1 − Ky × (1 − ETa/ETm)]. FAO56 précise que Ks appliqué au Kc simple est moins rigoureux que la séparation évaporation/transpiration et est surtout raisonnable lorsque l’évaporation du sol n’est pas une grande composante. Cette limite est affichée ; le module ne prétend pas devenir AquaCrop. L’usage saisonnier ignore la répartition du stress entre stades. Le logiciel refuse les cycles incomplets, ETm nul, ETa non physique, ETa/ETm < 0,5 ou une réponse négative/supérieure à Ym. Le seuil 0,5 est une restriction conservatrice d’implémentation, pas une preuve de calibration ni un seuil universel de survie. Aucune borne ne transforme une extrapolation extrême en résultat valide.

Ky versionné FAO56-table24-seasonal-1 : maïs 1,25 ; sorgho grain 0,90 ; soja 0,85 ; arachide 0,70 ; tomate 1,05 ; chou pommé 0,95 ; pastèque 1,10. Les stades, sol, météo, variété et conduite doivent toujours être paramétrés ; le sorgho nécessite notamment des durées adaptées. Les autres cultures n’ont pas de modèle hydrique de rendement activé. Un scénario imposé reste possible lorsqu’une fiche hydrique complète existe ; il ne constitue pas un modèle paramétré pour une culture inconnue.

## Contrat spatial et unités

Le contour dessiné, la terre potentielle, le semé, le récolté, le non semé dans la terre potentielle et chaque fraction eau permanente/eau saisonnière/zone humide/incompatible/inconnue restent séparés. Le bâti et les surfaces incompatibles sont regroupés par le classificateur existant : ce regroupement est conservé, sans inventer un détail plus fin.

Les unités de rendement sont des MultiPolygon disjoints dans le domaine terrestre sélectionné. Les trous, composantes déconnectées et secteurs non plantés sont préservés. Plusieurs unités doivent partitionner tout le domaine ; un secteur non semé se décrit avec sownAreaM2=0. Une surface semée inférieure à la surface géométrique représente une déclaration globale dans l’unité ; sa localisation interne n’est pas connue et l’homogénéité doit être déclarée. Plusieurs cultures se décrivent dans des campagnes distinctes ; une campagne reste liée à une culture, et une référence d’une autre culture est refusée.

Les sommes et intersections sont contrôlées avec tolérance max(0,001 m², surface de contour × 10⁻⁷). C’est une tolérance numérique, sans lien avec la précision agronomique ou foncière. Les surfaces sont sphériques WGS84 (R = 6 371 008,8 m), pas des mesures cadastrales.

Pour chaque unité : P_i = surface initialement semée en ha × rendement en kg/ha semé. P = somme(P_i). Rendement moyen semé = P / somme(A_i). Production par hectare de contour = P / surface du contour en ha. 1 ha = 10 000 m² ; 1 t = 1 000 kg.

Cas obligatoire : 1 ha semé × 4 t/ha = 4 t ; 0,4 ha semé et 0,6 ha d’eau exclue × 4 t/ha = 1,6 t. Le rendement semé reste 4 t/ha ; la production par hectare de contour devient 1,6 t/ha. Aucune pénalité de voisinage de l’eau.

Une référence par hectare récolté conserve son dénominateur et requiert une surface récoltée documentée. La production correspondante est ensuite rapportée à la surface initialement semée pour l’indicateur comparable. Une référence par hectare semé n’est jamais multipliée une seconde fois par le ratio récolté/semé. Aucune perte de destruction n’est ajoutée automatiquement.

## Eau et conditions hétérogènes

Les bilans sont rejoués séparément :

1. Pluvial : aucune irrigation ; seules les observations de pluie sont conservées. Les corrections de capteur de sol après irrigation sont retirées pour ne pas contaminer ce contrefactuel.
2. Réalisé : observations mesurées/déclarées, sans arrosages futurs automatiques.
3. Proposé : réalisé plus arrosages futurs proposés, sous quota, débit, horaires, fréquence, jours permis, efficacités et limites journalières connus.

Les événements planned/cancelled ne deviennent jamais réalisés. Dates de météo, référence et saisie ne peuvent dépasser la date du conseil. Une proposition n’est pas une garantie ; énergie et disponibilité non renseignées restent inconnues.

Chaque unité peut avoir son propre profil de sol et sa météo, validés par les mêmes règles physiques et temporelles. Les événements d’irrigation et de capteur doivent être associés par unitId lorsqu’il y a plusieurs unités. Les observations de pluie partagées s’appliquent comme lame uniforme déclarée. **Le plan futur multi-unités et le calendrier global sont suspendus tant qu’une allocation des ressources partagées n’existe pas** : le logiciel ne duplique pas le quota disponible. Les résultats pluvial et réalisé restent calculés unité par unité. L’interface précise cette limite. Avec une unité, les volumes d’eau utilisent la surface semée validée, pas le contour entier.

## Serveur, révisions, interface et exports

POST /api/seasonal action simulate remplace l’analyse terrestre reçue par une acquisition serveur ou le résultat complet d’un traitement serveur. Surface du contour recalculée depuis la géométrie ; sownAreaM2 borné par les unités ; résultats transmis par le client ignorés. Les hypothèses de rendement restent déclaratives et sont étiquetées comme telles.

La page principale utilise ce même calcul serveur, avec debounce et AbortController ; les réponses d’anciennes requêtes ne remplacent pas la saisie actuelle. Les trois indicateurs de récolte sont placés avant le bilan hydrique. Paramètres détaillés repliables ; comparaison possible avec un instantané de campagne autorisé. Elle distingue différences de surfaces et de rendements sans attribution causale. Versions ou cultures différentes rendent la comparaison non établie.

Les sauvegardes et observations passent par planSeason et conservent config, events et plan dans les révisions existantes. Pas de réécriture des anciennes campagnes. Les changements de géométrie ou de portée semée/unités sont refusés après observations réalisées : créer une nouvelle campagne. Les contrôles d’accès coopérative/rôle restent inchangés.

Export JSON : hypothèses, versions, références, événements et résultats complets. Export CSV de rendement : lignes totales et par unité, unités dans les en-têtes, dénominateur/source/date de référence, versions de données et limites. GET /api/seasonal?id=…&format=yield-csv exporte **l’instantané de la révision enregistrée**, sans actualisation silencieuse. L’export de la simulation courante est indisponible tant que la réponse serveur est périmée.

## Grands contours et déploiement

À partir de 100 ha, le serveur exige une analyse par secteurs complète. Migration additive 0004_land_jobs.sql ; ne supprime aucune campagne. Les traitements sont privés au compte propriétaire/cooopérative et persistent en D1. start/step/status sont des actions POST authentifiées. Fenêtres de 0,005 degré, intersections exactes, progression en secteurs et m², pause/reprise, cache d’acquisition existant, bail de travail 180 secondes et reprise après interruption. Un traitement ne se poursuit pas navigateur fermé : les secteurs terminés restent enregistrés et le bouton reprend les suivants. Ce comportement est explicite ; pas de faux travail d’arrière-plan.

Les limites sont 1 024 fenêtres candidates et 256 composantes de secteurs par traitement. Au-delà, le serveur demande plusieurs campagnes/secteurs sans faire passer une analyse partielle pour complète. Le résultat final n’est assemblé qu’après contrôle de couverture et de disjonction. Une acquisition traitée mais classée inconnue ne devient pas une terre exploitable. Un résultat complet reste utilisable 24 h, puis doit être actualisé. Les nouvelles migrations sont appliquées par le pipeline Cloudflare avant publication.

## Vérification et limites restantes

Tests synthétiques : 4 t / 1,6 t, conversions, eau seule, inconnu, trous, composantes, partition partielle, chevauchements, hétérogénéité hydrique, références absentes, dates futures, météo incomplète, stress extrême, absence de facteur pH, semé/récolté, absence de double perte, proposé/réalisé, surfaces et résultats forgés.

Tests API : six pays, recalcul serveur, persistance, révisions, droits, export, portée des observations et reprise D1 après redémarrage. Les acquisitions réelles sur six échantillons sont consignées séparément dans la preuve d’acquisition ; elles ne valident ni toutes les parcelles ni les rendements. Aucune récolte prospective n’a servi à calibrer ou valider ce nouveau modèle.

À construire avant un conseil prédictif validé : références Ym locales indépendantes, calibration par culture/variété et conduite, validation spatiale/temporelle, modèle d’engorgement/mortalité, allocation de ressources multi-unités, analyses sol représentatives de toute la parcelle et évaluation prospective sur récoltes mesurées.
