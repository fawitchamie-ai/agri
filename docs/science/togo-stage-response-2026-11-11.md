# Togo : une réponse du grain par stade, raccordée au moteur

## Résultat et domaine

Le calcul quotidien principal donne désormais, **avec la nouvelle méthode explicitement sélectionnée**, 2,2004 / 2,1558 / 1,4055 t/ha pour FI/80%/60%. Le profil illustratif RUE–NPK reste un diagnostic archivé à 2,57419 dans les trois cas. Son plateau est le résultat de fournitures K supposées, pas une teneur mesurée dans le champ ni une erreur d'arrondi.

| Traitement | Grain observé/rapporté (t/ha) | Ancien RUE–NPK | Nouvelle réponse par stade |
|---|---:|---:|---:|
| FI, utilisé pour la capacité commune | 2,2004 | 2,5742 | 2,2004 |
| 80%FI | 1,8309 | 2,5742 | 2,1558 |
| 60%FI | 1,0683 | 2,5742 | 1,4055 |

La valeur détaillée80% est celle fournie pour le rejeu, cohérente avec le DISI arrondi et l'ordre graphique ; les répétitions brutes ne sont pas acquises. FI et60% figurent explicitement dans la publication. L'absence de différence significative FI/80% rapportée par les auteurs n'impose pas de forcer une séparation statistique.

| Erreur, deux déficits seulement | MAE (t/ha) | RMSE (t/ha) | Biais (t/ha) | nRMSE |
|---|---:|---:|---:|---:|
| Ancien profil quotidien | 1,125 | 1,187 | +1,125 | 81,92% |
| Constante FI | 0,751 | 0,842 | +0,751 | 58,09% |
| FAO saisonnier, capacité ajustée sur FI seulement | 0,532 | 0,561 | +0,532 | 38,70% |
| Produit par phases, capacité ajustée sur FI seulement | 0,331 | 0,331 | +0,331 | 22,84% |

nRMSE ci-dessus utilise la moyenne des **deux** déficits, 1,4496t/ha. Sur les trois moyennes, en incluant FI qui a servi à l'ajustement, RMSE0,27035 et nRMSE15,90%, contre0,99329 et58,43% pour le profil initial. Ce dernier calcul ne doit pas devenir la seule statistique mise en avant. Les pertes restent sous-estimées : écarts80−FI /60−FI prévus−0,0446/−0,7949t/ha, observés−0,3695/−1,1321. Rapports prédits0,9797/0,6387, observés0,8321/0,4855. Le biais n'est pas effacé.

## Changement numérique

`water-stages.ts` calcule `F = produit_i[1−Ky_i(1−ETa_i/ETm_i)]`, puis `Y=Ym×F`. Les sensibilités FAO33 du maïs sont fixées à0/0,4/1,5/0,5/0,2 pour installation/végétation/floraison/formation/maturation. La composition s'inspire du module statique SWAP ; SWAP utilise la transpiration, alors que cette adaptation applique les Ky FAO à l'ET totale. Ce n'est ni SWAP complet, ni AquaCrop complet.

Les ET viennent du **vrai bilan d'eau** de l'application, avec météo NASA, rétention du sol, racines et doses du rejeu. Aucune relation dose/rendement n'est inventée. La capacité commune2210,392512kg/ha est calculée avec FI seul :2200,4/0,9954793044. Les deux rendements déficitaires n'ajustent pas cette capacité et aucun coefficient ne leur est propre. FI est un proxy local de référence ; cette capacité effective n'identifie ni potentiel physiologique, ni fertilité, ni ravageurs. Elle n'est multipliée ni par le grain RUE déjà freiné par l'eau, ni par QUEFTS.

Le calendrier principal vient de la thèse2020 : installationDAP1–20 ; végétation21–65 ; floraison66–83 ; formation84–104 ; maturation105–111. Le calendrier de l'article est testé séparément :54–63/64–95/96–111. La thèse décrit une recalibration qui a exploré tous les traitements : même si notre capacité utilise FI seul, **le développement et le calendrier ne constituent pas un test indépendant des deux déficits**. La référence n'est disponible qu'après récolte, donc aucun résultat de prévision avant campagne n'est revendiqué.

L'ETm et l'ETa saisonnières seules perdent l'information de date. Le test logiciel conserve18mm de perte d'ET et la déplace : le facteur du grain vaut0,7 si la perte est entièrement en floraison, contre0,968 en végétation avec ce découpage. Une phase avec facteur négatif est refusée explicitement ; les ETa/ETm<0,5 sont signalés comme extrapolations fortes. Un couvert déjà rendu dynamique par le stress bloque cette combinaison, faute d'ETm de référence indépendante.

## Calendriers et incertitudes conservés

Les cinq calendriers conservent **exactement les cumuls par stade**, mais pas les dates réelles manquantes. Avec la phénologie principale, les rendements FI/80/60 (t/ha) sont : quotidien2,200/2,156/1,405 ;3j début2,193/2,148/1,322 ;3j fin2,186/2,139/1,423 ;7j début1,907/1,846/1,267 ;7j fin1,803/1,759/1,419. La RMSE sur les déficits varie0,141–0,332t/ha. Le calendrier7j début n'est pas sélectionné parce qu'il donne la plus petite erreur.

Avec l'autre phénologie publiée, 60% quotidien tombe près de1,068t/ha, mais les autres cas, dont les impulsions7j fin, sont moins bons. Ce résultat déjà examiné ne sert pas à remplacer le calendrier principal après coup. Toutes les lignes restent dans `stage-summary.json`.

Cette dispersion est une sensibilité aux scénarios, pas une variabilité biologique ni un intervalle prédictif. Le grain est à13% par hypothèse centrale de la plage12–14% ; il n'est pas converti avec le15,5% américain. Les sorties couvert, biomasse et ET observée par phase restent **nulles** pour cette équation de grain. Les diagnostics RUE ne sont pas rebaptisés en sorties du nouveau modèle. La référence variétale2t/ha, dont l'humidité est ambiguë, est testée sous deux conventions séparées et n'est pas le paramètre opérationnel.

## Contre-épreuve officielle et erreurs d'adaptation vérifiées

La thèse a effectivement été téléchargée (12 714 120octets, SHA256 dans `thesis-source.json`). Elle fournit la SAT mesurée34,87/36,51/39,91/41,35%, la racine0,3–0,5m, HI26% et les réponses de fertilité CGC−15%, CCx−1%, WP*−70%, déclin0,42point/jour. Ces réponses sont représentées dans le code officiel7.3 au degré interne50 par inversion des quatre courbes.50 est une coordonnée interne choisie pour cette représentation, pas une interprétation du libellé65 de l'ancien article ou de Brel60.

Les unités sont contrôlées à partir du code officiel : `SFCDecline=.42` est divisé par100 une fois ; le vieillissement Kc journalier d'un ancien port n'est pas recopié dans le champ7.3 de diminution cumulée. Les entiers du format Fortran et les arrondis des doses sont explicites. Avec le calendrier quotidien, la variante officielle calendaire avec fertilité donne environ2,967t/ha aux trois traitements (RMSE1,352t/ha). Ce profil est **rejeté comme correction opérationnelle**, sans conclure qu'AquaCrop est intrinsèquement incapable de représenter l'essai.

Le mode thermique n'atteint pas les1898GDD de la thèse avec les seules températures NASA du rejeu (~1644GDD avant la date de récolte). Le moteur ne produit pas un cycle de culture exploitable pour ce transfert ; des champs racinaires/HI sont des sentinelles. La récolte est conservée manquante, pas transformée en rendement nul ; aucune précision de grain n'est calculée pour ces30cas. Le bilan de sol du comparateur reste contrôlé à la précision de ses sorties arrondies0,1mm (borne de quantification quotidienne0,45mm), distincte d'une incertitude agronomique.

Le script officiel de référence reproduit toujours les huit fichiers Ottawa à l'horodatage près. Ce contrôle valide l'exécution logicielle et le mécanisme de fertilité sur luzerne, pas la précision du maïs au Togo. Le contrôle LIRF conditionnel2012→2013 demeure distinct : k0,84982255, RMSE1,108t/ha, avec ET du bilan terrain reçue en entrée, contre3,495t/ha pour la constante FI2012. Il ne valide pas cette nouvelle réponse locale par phases.

## Utilisation et publication

Le serveur `planSeason` accepte désormais `yieldEstimation.method='fao-stages'`, avec calendrier sourcé, accepté, daté et lié au contour/variété/semis/cycle. Le score hydrique et le grain absolu utilisent la même fonction. Les sorties sont recalculées côté serveur ; un résultat envoyé par le client est ignoré. Le produit est calculé une seule fois sur la surface prévue/semée vérifiée. Les révisions conservent les anciennes valeurs et les corrections d'arrosage passent par l'action `event`, sans écrasement du journal par `save`.

Le profil fourni est strictement restreint au **rejeu TZEE-W du16/12/2017, cycle111jours et site de Dapaong**. Aucun coefficient de cet essai ou des États-Unis ne devient une valeur nationale dans les six pays. Les campagnes existantes ne sont pas migrées silencieusement. L'interface permet de sélectionner ce rejeu, affiche le nouveau grain au premier niveau et conserve RUE comme diagnostic distinct.

Le laboratoire public `/scientific/togo-stage-replay.html` compile le même moteur, affiche son commit et recalcule les trois traitements lorsqu'on modifie les doses ou le calendrier. Une modification contrefactuelle masque la RMSE, faute de récolte correspondante. Il ne lit ni n'écrit les campagnes privées et ne nécessite aucune modification de l'authentification.

Reproduire : `node --experimental-transform-types scripts/togo-stage-benchmark.mjs` ; `python3 scripts/acquire-official-aquacrop.py /tmp/ac-official` ; `python3 scripts/replay-aquacrop-official-reference.py /tmp/ac-official` ; `python3 scripts/togo-official-fertility.py /tmp/ac-official/official_replay` (gfortran pour recompiler le code officiel en x86-64 générique ; SciPy versionnée dans `requirements-official.txt`). Le binaire précompilé officiel peut lever `SIGILL` selon le processeur du runner ; il reste acquis et contrôlé par empreinte, mais le rejeu utilise la compilation du code source officiel versionné et vérifie les huit sorties contre la référence. Les tests pertinents portent sur chronologie, référence future, conservation, déplacements du déficit, absence de double pénalité, API, persistance, permissions et interface réelle. Le nouvel algorithme est identifiable dans `/api/version` et sa sonde compare un déficit identique en végétation et en floraison.

Les trois preuves restent distinctes : reproduction du contrôle de référence ; mécanisme numérique et meilleure concordance sur ce rejeu ; précision locale indépendante. Les deux premières ont avancé ; **la troisième n'est pas démontrée pour cette nouvelle méthode**. Une erreur résiduelle et un calendrier manquant ne sont pas supprimés par l'amélioration de la RMSE.1,000 reste arithmétiquement hors de l'intervalle observé0,813–0,851.

Sources : Gadédjisso-Tossou et al.2020, DOI10.17159/wsa/2020.v46.i1.7894 ; thèse2020, urn:nbn:de:bsz:14-qucosa2-387041, pp89,99–100 ; FAO33/AnnexII https://www.fao.org/4/X5647E/x5647e0e.htm ; Kroes et al.2017, SWAP4, DOI10.18174/416321 ; code officiel KUL-RSDA/AquaCrop `v7.3_typofix`.
