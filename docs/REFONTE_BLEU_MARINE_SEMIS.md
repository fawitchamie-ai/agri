# Tableau de bord sobre et préparation du semis — 1 novembre 2026

La page de simulation utilise désormais une palette bleu marine, bleu et blanc, une typographie plus lisible et des blocs espacés. Les valeurs de parcelle, culture, date, surface prévue et dose de semences se modifient au crayon ; Échap et « Terminer » ferment l’édition. Les changements relancent le calcul, avec protection contre les réponses périmées. Les informations de sol, météo, méthode et provenance sont regroupées dans « Réglages et données ». Le dessin de la carte conserve son moteur et ses interactions.

Les deux graphiques suivent les références visuelles fournies : barres de volumes d’arrosage (m³ au champ), puis deux courbes de besoin/pluie utilisable (mm utiles). Ils utilisent les agrégats du bilan serveur. Les apports enregistrés restent distincts des propositions. Une liste accessible sélectionne la semaine ; une lecture textuelle et un tableau donnent les valeurs sans dépendre de la couleur. Les pointillés et le nombre de jours séparent scénario météo et prévision proche. Aucune note globale n’est affichée.

## Quantité de semences préremplie

Version `sowing-1.0.0`. Pour une culture pure, semences en kg = surface prévue en m² / 10 000 × dose en kg/ha. L’affichage utilise les grammes en dessous de 1 kg ; API et export conservent les kg. Le préremplissage est un **repère pour préparer un semis**, pas un optimum déterminé pour la parcelle. La variété, le poids des graines, la germination, les ressources et la conduite locale doivent être vérifiés.

| Culture | Plage publiée | Valeur préremplie | Source et portée |
|---|---:|---:|---|
| Maïs | 20–25 kg/ha | 25 kg/ha | [Seed Co Nigeria](https://seedcogroup.com/ng/fieldcrops/good-agronomics-practices-for-maize-farming/), maïs hybride, taille des graines variable. Borne supérieure choisie comme repère de scénario. |
| Soja | 50–70 kg/ha | 60 kg/ha | [NAERLS / National Farmers’ Helpline](https://nfhl.naerls.gov.ng/index.php?action=faq&artlang=en&cat=182&id=83), Nigeria, dose dépendante du lot. Milieu de plage choisi. |
| Sorgho grain | 8–12 kg/ha | 10 kg/ha | [IITA / PROPaS](https://propas.iita.org/en/solutions/varieties-for-better-nutrition-and-stress-resistance/113/details/), variétés améliorées de zones sèches et savanes. Milieu de plage choisi. |
| Mil perlé | 5–8 kg/ha | 6,5 kg/ha | Même référence IITA, adaptation selon les zones. Milieu de plage choisi. |

Sources consultées le 1 novembre 2026. Les références ne sont pas présentées comme des recommandations nationales validées pour chacun des six pays. Par prudence, le repère automatique n’est pas appliqué à un scénario dont la date de conseil précède cette acquisition. Une dose documentée par l’utilisateur reste possible. Les autres cultures demandent une dose locale ; aucun défaut emprunté au maïs. Les associations de cultures, systèmes submergés et champs signalés engorgés/submergés ne reçoivent pas de quantité automatique.

La quantité se calcule par défaut sur la terre potentielle cartographiée, avec un libellé « surface prévue ». L’eau, le bâti, les zones humides et inconnues restent exclus. La carte ne prouve ni semis effectué, ni aptitude, ni droit de cultiver. Une surface semée explicitement déclarée pour le rendement a priorité. Le plan de semis ne crée pas de déclaration de semis ni de référence de rendement.

Une surface prévue modifiée sert aussi au volume d’eau du scénario, avec une hypothèse d’homogénéité et une position exacte restant à vérifier. La surface du bilan est visible dans la carte d’arrosage. Une dose de semences modifiée ne change pas le rendement ni le bilan hydrique : aucune réponse agronomique à la densité n’a été inventée. Une surface prévue nulle suspend les propositions d’arrosage. Si des observations sont enregistrées, changer cette surface exige une nouvelle campagne afin de préserver leur portée.

## Serveur, sauvegarde et limites

Le serveur valide la dose, la culture et le contour ; il remplace l’évaluation terrestre du client par la cartographie faisant autorité et recalcule les quantités. Les résultats client sont ignorés. Paramètres et estimation versionnée suivent les sauvegardes et révisions existantes, sans migration de base. L’export de semis indique les unités, le statut, la source et les limites. La lecture des anciennes campagnes reste compatible ; elles ne sont pas réécrites à leur ouverture.

L’action indépendante `sowing-plan` prépare les semences même si le cycle hydrique de la culture reste à paramétrer (cas du sorgho). Son exception de validation autorise seulement l’absence de cycle pour cette action ; le calcul hydrique et la sauvegarde d’une simulation hydrique continuent d’exiger un cycle valide. Le serveur conserve toutes les autres validations et l’authentification. Le sorgho n’acquiert donc pas de calendrier hydrique automatiquement.

Le rendement n’est pas inventé pour remplir une carte : la récolte conserve ses méthodes et les données nécessaires. Les paramètres de calcul et les comparaisons sont accessibles dans ce bloc. La mortalité, les dégâts d’inondation et les effets de densité ne sont pas ajoutés au modèle.

## Vérification

Tests synthétiques dans les six pays : doses/références, conversions m²/ha et kg, exclusion eau/inconnu, trou géométrique, surface semée prioritaire, références futures, dose non paramétrée, refus des valeurs forgées, modifications des volumes d’eau, indépendance de la dose vis-à-vis du rendement, cycle absent. Tests réels des routes et du stockage : sauvegarde, ancienne révision, permissions, verrouillage des surfaces avec observations et action de semis indépendante. Le bilan hydrique historique est comparé intégralement à son moteur, en isolant uniquement la nouvelle métadonnée de semis.

Contrôles : `pnpm check`, `pnpm test`, `pnpm test:integration`, `pnpm test:regressions`, `pnpm build`, `git diff --check`. Le contrôle visuel utilise le rendu statique du composant réel avec des données synthétiques, converti par un moteur de document ; il ne constitue pas un test des interactions d’un navigateur. Le contrôle authentifié après publication dépend des identifiants Cloudflare Access disponibles dans le dépôt.
