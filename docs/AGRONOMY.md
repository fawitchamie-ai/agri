# Cultures, chimie du sol et références de fertilisation

État au 29 octobre 2026. Le catalogue contient 23 cultures et neuf références de fertilisation. Ces fiches servent à construire des scénarios documentés ; elles ne constituent pas une validation au champ.

## Ce qui est implémenté

- `lib/seasonal/catalog.ts` conserve séparément chaque espèce, les coefficients hydriques, les durées géographiquement situées, les profondeurs et les manques. Une culture sans paramètres ne reprend pas les stades de la précédente. Les incohérences entre somme des phases et total imprimé sont signalées et bloquent l’application de l’exemple sans durées saisies explicitement. Les durées et Kc de référence restent à adapter localement.
- `lib/seasonal/chemistry.ts` définit 16 paramètres : pH, EC, carbone organique, matière organique, azote total/minéral, P assimilable, K échangeable, CEC, Ca, Mg, Na, S, Zn, B et Al. Chaque analyse conserve date de mesure, disponibilité des résultats (`availableOn`), profondeur, origine, statut, méthode et unité. Des résultats non encore disponibles à la date du conseil sont refusés. Olsen-Dabin est distinct d’Olsen et Bray ; EC 1:5 est distincte de l’ECe sur pâte saturée. Les horizons et méthodes ne sont pas fusionnés.
- `lib/seasonal/nutrition.ts` vérifie pays, culture, système, territoire indiqué et variété lorsque la fiche la restreint. Il convertit les quantités publiées pour la surface de la parcelle et les éléments N–P₂O₅–K₂O. Une composition de produit inconnue reste inconnue. MgO, S et Zn mentionnés dans les intitulés du Ghana ne sont pas inclus dans ce bilan à trois éléments.
- Les apports déjà réalisés concernent les mêmes produits, en kg/ha. Ils sont déduits de chaque scénario de quantité ; les dépassements restent visibles. Un champ vide n’est pas interprété comme zéro. Les autres engrais, amendements, résidus et fournitures du sol ne sont pas automatiquement crédités.
- La référence choisie, le contexte déclaré et les quantités déjà apportées sont enregistrés dans `SeasonalConfig.nutritionReference`. Le moteur renvoie les quantités et la source dans `WaterPlan.nutrition`. La sauvegarde D1, l’historique et l’export JSON les conservent sans nouvelle migration. Le CSV demeure l’export du bilan hydrique.
- L’interface, les routes et le notebook utilisent les mêmes fonctions. Aucun second calcul Python des doses ou du bilan hydrique n’est introduit.

## Couverture réelle

| Pays | Références de fertilisation acquises et transcrites | Limites |
|---|---|---|
| Togo | Kozah : maïs, sorgho et sésame ; ITRA/FertiTogo, mars 2021 | La Kozah ne représente pas les autres préfectures ; état actuel du champ non connu. Recettes minérales, sans calcul des fournitures organiques. |
| Ghana | Maïs : deux alternatives d’engrais de fond du manuel 2025 | Les alternatives ne se cumulent pas. Les sacs de 50 kg sont indiqués par **acre**, convertis avec 4 046,8564224 m²/acre. |
| Côte d’Ivoire | Maïs FMB, soja, gombo court et riz pluvial | Domaines et notes des fiches conservés ; pas de généralisation à toutes les variétés. Les plages du riz ne définissent pas une optimisation ni des couples région–objectif qualifiés. |
| Bénin | Aucune recette chiffrée qualifiée intégrée | Saisie d’un plan documenté possible dans le calculateur ; pas de recette importée du voisin. |
| Burkina Faso | Aucune recette chiffrée qualifiée intégrée | Même limite. |
| Sénégal | Aucune recette chiffrée qualifiée intégrée | Même limite. |

Les 23 cultures ont une fiche informative. Cela ne signifie pas que 23 calendriers hydriques ou 23 plans de fertilisation sont disponibles dans chaque pays. Riz pluvial, igname, voandzou, gombo, piment et fonio n’ont pas de paramètres hydriques acquis dans ce catalogue. Le riz submergé exige un moteur particulier et reste bloqué, y compris si un client tente de lui associer artificiellement le système générique.

## Interprétation scientifique

L’adaptation **quantitative** d’une dose à la chimie réelle du champ n’est pas réalisée. Ajouter une analyse ne calcule pas une carence, un taux de minéralisation, une dose de chaux, une fixation biologique ou un rendement. Les repères de pH EcoCrop n’indiquent pas leur méthode analytique : ils restent informatifs. Le signal de salinité compare seulement une ECe à un repère de la culture ; aucune perte de rendement ou dose de lessivage n’en découle.

Une personnalisation défendable nécessite une méthode sol–culture locale : échantillonnage représentatif, méthodes de laboratoire compatibles, zone/variété/système/saison, objectif faisable, fournitures et apports antérieurs, réponse aux nutriments, efficacité et contraintes économiques. Elle devra être évaluée avec des observations et essais appropriés avant d’être activée. Un rendement territorial historique ne fournit pas cette validation.

Le calculateur de bilan nutritif manuel reste un outil arithmétique distinct : l’utilisateur fournit lui-même un besoin justifié et la composition du produit. Ses résultats temporaires sont effacés lorsqu’on modifie ses entrées ou la campagne ; ils ne sont pas annoncés comme une prescription sauvegardée.

## Sources et acquisition

`lib/seasonal/sources.ts` conserve 29 sources primaires, URL, portée, date de consultation et SHA-256 des fichiers examinés. Les 29 empreintes ont été comparées aux fichiers d’acquisition locaux. Les documents d’origine restent téléchargeables auprès des éditeurs ; leur contenu n’est pas embarqué dans le notebook.

- [FAO56, chapitre 6](https://www.fao.org/4/X0490E/x0490e0b.htm) : tableaux 11/12, Kc et phases.
- [FAO56, chapitre 8](https://www.fao.org/4/X0490E/x0490e0e.htm) : tableaux 22/23, racines, p et repères ECe ; ajustement de p à la demande par l’équation 83.
- [FAO EcoCrop](https://ecocrop.apps.fao.org/) : fiches écologiques par espèce ; les URL précises sont conservées dans le registre.
- [FertiTogo : fiches préfectorales](https://fertitogo.tg/fiches-de-recommandations) et [méthodes de laboratoire](https://fertitogo.tg/analyse-des-sols). La méthode publiée utilise notamment pH eau 1:2,5, P Olsen-Dabin et EC 1:5.
- [Manuel de production durable du maïs au Ghana](https://cgspace.cgiar.org/server/api/core/bitstreams/40fbec24-8696-4f7d-b2d1-f6ade042ac7a/content), tableau 6.
- Fiches [CNRA](https://cnra.ci/) soja, gombo, riz pluvial et IFDC/FeSeRWAM maïs FMB : liens exacts et empreintes dans le registre.

## Vérification exécutée

`tests/crop-chemistry.test.ts` couvre les conversions indépendantes, le domaine des références, les analyses incompatibles/futures, ECe/EC, l’absence de transfert entre cultures, les valeurs manquantes et la conservation de l’eau pour tous les exemples applicables. Les tests des routes vérifient l’égalité moteur/API, la sauvegarde, la relecture et l’historique chimie/nutrition. Le notebook exécute dix cellules de calcul depuis un processus Python neuf, avec le moteur Node partagé ; ce n’est pas une exécution dans un noyau Jupyter. Le registre de capacités commun est accessible par l’action API `capabilities` et le pont Python, sans rehausser les états de validation. L’audit des données historiques et la preuve de reproduction sont dans `docs/refonte/` ; le journal de reprise est `AVANCEMENT.md`.

Ces vérifications logicielles ne sont pas un pilote agronomique. L’adaptation anglaise et les prescriptions chimiques personnalisées demeurent à réaliser.
