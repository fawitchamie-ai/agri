# AgriPrévision : audit du calcul et comparaison d'hypothèses

## Décision opérationnelle

Le rejeu togolais reste à **2,574 / 2,574 / 2,574 t/ha**, pour des observations de **2,2004 / 1,8309 / 1,0683 t/ha**. Il n'est pas résolu. Les fournitures K illustratives créent le plafond : ce n'est pas une analyse du champ. Les valeurs d'une courbe RUE et d'un HI communs modifient l'échelle, pas les rapports entre traitements lorsque NPK ne limite pas ; la vérification numérique retrouve un écart maximal de rapports nul à la précision calculée.

Un nouveau calcul de **suivi du maïs par mesures de LAI vert**, distinct des simulations d'interventions, est raccordé à `planSeason`, aux sauvegardes et à l'interface Rendement. Le profil est une hypothèse locale explicite du nord du Ghana. Il exige deux semaines de suivi, au moins deux visites et trois points de mesure par visite, un champ dans l'enveloppe étudiée et un LAI dans la plage d'apprentissage. Il ne remplace pas automatiquement les profils des six pays. Une observation après l'échéance ne peut pas améliorer rétroactivement une estimation.

## Méthodes effectivement confrontées

Les protocoles, paramètres libres, résultats et partitions sont dans `research-data/alternative-models/2026-11-11`. Les erreurs ci-dessous sont calculées par nos scripts ; ce ne sont pas les précisions revendiquées par les auteurs des données.

| Hypothèse | Évaluation réservée | Référence | Résultat | Décision |
| --- | --- | --- | --- | --- |
| GBM sur les champs africains One Acre Fund, sans variables de récolte | 876 observations 2020 dans des cellules spatiales absentes de 2016-2019 | RMSE 1,707 t/ha | 1,616 t/ha ; nRMSE 57,89 % | Gain modeste ; rejet comme modèle général |
| Même GBM, pays entier réservé | 115 observations Nigeria 2022 | RMSE 1,351 t/ha | 1,380 t/ha ; nRMSE 78,43 % | Transfert défavorable ; aucune activation nationale |
| Jensen, deux phases ET simulée, trois coefficients ajustés en 2012 | 12 moyennes de traitements LIRF 2013 | WP existant : RMSE 1,149 t/ha | Jensen ET : environ 2,086 t/ha avant changement structurel | Rejet du profil ; pas d'équivalence irrigation/perte de rendement |
| Couvert dynamique lié à la transpiration et recharge du profil | LIRF 2013, paramètres de couvert ajustés uniquement sur le couvert 2012 | Couvert prescrit : RMSE grain 1,149 t/ha | RMSE grain 2,145 t/ha ; couvert 0,223 fraction | Rejet du profil de prévision ; mécanisme disponible seulement avec paramètres explicites |
| Recharge des horizons non encore racinés, coefficients WP/HI archivés figés | 6 traitements LIRF 2011, efficacité 1 | RMSE 1,176 t/ha | 2,598 t/ha | Diagnostic structurel ; non activé par défaut |
| LAI maximal des 14 premiers jours de suivi | 10 champs Ghana 2021, 30 quadrats conservés ensemble | RMSE 0,750 t/ha | **0,573 t/ha**, MAE 0,445 ; biais +0,156 ; nRMSE 43,55 % | Hypothèse locale de suivi explicite, gain RMSE 23,6 % |

Le GBM est choisi sur l'erreur de 2019 seulement : 2016-2018 pour ajuster, 2019 pour sélectionner, 2020 pour vérifier, Nigeria 2022 pour le transfert géographique. Les identifiants des exploitants ne sont pas fournis : la séparation spatiale par cellules de 0,05 degré est un proxy de séparation, pas une preuve d'identité distincte. Les variables de densité mesurées à la récolte, incidents de fin de saison, totaux d'interventions non datés et date de récolte sont exclus. La pluie complète de saison n'est testée que comme diagnostic rétrospectif ou scénario futur explicite. Ce jeu observationnel n'identifie pas l'effet causal des kg N/P/K.

## Profil ghanéen et limites locales

Les 500 lignes biophysiques et 144 quadrats ont été contrôlés. Le champ `7069ZIN` contient six quadrats et des identifiants répétés : ses six lignes restent dans la source mais sont exclues de l'ajustement et des métriques, sans réattribution inventée. Les 46 autres champs sont séparés par identifiant : **27 apprentissage, 9 calibration d'incertitude, 10 contrôle**. Aucun quadrat d'un champ d'apprentissage ne rejoint le contrôle.

L'équation figée est `Y = max(0, 80,9395 + 886,2078 × LAI_max)` en kg/ha. `LAI_max` est le maximum des moyennes de points par visite dans les 14 premiers jours de suivi. Ridge alpha=1 est fixé avant cet ajustement ; ni coefficient par champ ni réglage sur les récoltes de contrôle. Cette extension en fenêtre relative vient après l'exploration des dates calendaires : c'est une comparaison de développement, **pas un nouveau test aveugle**. Une autre saison reste nécessaire pour l'évaluation finale.

La variable de grain est utilisée dans son unité publiée kg/ha. Le protocole décrit une détermination d'humidité, mais le fichier fourni ne précise pas une humidité de référence commune. Aucun passage arbitraire à grain sec, 13 % ou 15,5 % n'est effectué. Le profil ne déduit ni fertilité, ni dégâts de ravageurs, ni mortalité. Les propriétés de plusieurs contours sont manquantes ou décalées ; elles ne fournissent pas un calendrier de conduite.

La plage conformelle nominale à 90 %, calculée sur les seuls neuf champs de calibration, ne couvre que **7 champs de contrôle sur 10**. Elle est conservée dans les résultats mais l'interface indique cet échec de couverture et ne la présente pas comme un intervalle validé pour la récolte de l'utilisateur. L'incertitude de lecture d'une figure reste une autre quantité.

Les cas défavorables restent visibles : `7017SAM` 1,634 t/ha estimée contre 0,637 observée ; `7020YAM` 1,805 contre 2,793 ; `3074TAM` 1,312 contre 0,440. Un LAI plus élevé ne garantit donc pas à lui seul une meilleure estimation de chaque récolte.

## Audit de la chaîne de calcul

1. **Versions** : base distante et publiée contrôlée avant modification, commit `a7d421f132dcb7e7671cd8ef34460d32b8347371`. La version publique expose maintenant des sondes numériques déterministes exécutées par les mêmes fonctions ; aucune donnée de campagne ni secret n'est exposé.
2. **Entrées et unités** : les tests conservent 1 mm = 10 m³/ha, eau au champ/eau nette/eau à la source, pertes appliquées une fois, humidités du grain distinctes, dates de disponibilité, surfaces et mode du scénario. Les données LIRF ne sont pas des mesures journalières indépendantes de chaque parcelle.
3. **Eau** : l'ancien seau racinaire assimile l'eau passant sous les racines à une sortie. Une hypothèse à horizons conserve explicitement cette recharge, le stock total et le drainage hors profil. Le test isolé reçoit 60 mm, conserve 45 mm sous les jeunes racines puis les retrouve lorsque celles-ci progressent. Les bilans racinaire et du profil ferment à l'arrondi numérique. La dégradation sur 2011 empêche son activation automatique ; les états initiaux et calendriers racinaires reconstitués restent des entrées incertaines.
4. **Couvert** : dans le mode historique, un couvert observé affecte Ke tandis que Kcb reste prescrit. Le nouveau mode explicite lie les deux via `Kcb = KcTr,max × clip(1,72 CC - CC² + 0,30 CC³)` ; expansion et sénescence peuvent être des états sous stress. Il exige la biomasse par transpiration normalisée si un calcul de croissance est activé. Ce sous-modèle n'est pas AquaCrop complet. Son profil LIRF ajusté est rejeté en prévision après l'évaluation 2013.
5. **Biomasse et nutriments** : les sommes journalières, stocks, absorptions, résidus N/P/K et correction d'humidité sont vérifiés. La RUE est définie par MJ de rayonnement global intercepté ; une RUE physiologique potentielle n'est pas une borne inférieure universelle de l'efficacité effective au champ. Aucun élargissement des bornes n'a servi à obtenir une acceptation.
6. **Calibration** : les identifiants de biomasse archivée distinguent maintenant les changements d'équation du couvert et de stockage. Une ancienne calibration HI ne peut pas être réutilisée silencieusement sous un autre mécanisme. Un optimum sur une borne est signalé et examiné ; les profils rejetés ici échouent surtout en transfert temporel, pas simplement parce qu'ils touchent une borne.
7. **Service et affichage** : les routes recalculent les nombres côté serveur, ignorent un rendement forgé envoyé par le client, préservent les révisions et les droits d'accès. Le suivi LAI reste distinct des effets d'interventions FAO/RUE/QUEFTS. La carte, le style et les campagnes existantes sont conservés.
8. **Rejeu** : les archives ne sont pas écrasées ; les calculs courants vont dans un dossier distinct. L'horloge des fixtures historiques est figée afin que l'expiration opérationnelle de la cartographie après 24 heures ne fasse pas échouer un contrôle scientifique rejoué plus tard.

**Rectification arithmétique : 1,000 est hors de [0,813 ; 0,851].**

La baisse de rendement constatée par l'utilisateur lorsque les apports changent est compatible avec le plateau de ce seul rejeu. Le moteur réagit aux déficits importants, aux dates et à la nutrition ; trois traitements modérés peuvent néanmoins atteindre le même plafond hypothétique. Dans le calendrier uniforme togolais, le stress du traitement 80 % apparaît surtout en fin de cycle. Les dates d'irrigation originales manquent : aucun multiplicateur n'est inventé pour faire apparaître artificiellement les 17 % de perte observés.

## Reproduction

```bash
# Vérification des archives inchangées, puis moteur courant :
node scripts/check-lirf.mjs
LIRF_REPLAY_OUTPUT=research-data/alternative-models/2026-11-11/current-replay node --experimental-transform-types scripts/lirf-replay.mjs
LIRF_REPLAY_OUTPUT=research-data/alternative-models/2026-11-11/current-replay node --experimental-transform-types scripts/lirf-holdout-replay.mjs
node --experimental-transform-types scripts/audit-calculation-chain.mjs
node scripts/check-alternative-benchmarks.mjs
# Les données ghanéennes publiques nécessaires sont incluses, CC BY 4.0 :
python3 scripts/ghana-canopy-benchmark.py research-data/alternative-models/2026-11-11/ghana/inputs research-data/alternative-models/2026-11-11/ghana
```

Les dépendances de recherche sont verrouillées dans `research-data/alternative-models/requirements.lock.txt`. One Acre Fund est acquis depuis la version Zenodo 11122388 ; sa somme MD5 est `7856ff0693dce26817623bc73ac5fa7b`. GROW-Africa v2 et LIRF 2008-2010 sont acquis mais ne sont pas utilisés comme nouvelles validations dans cette livraison. GROW mêle des échelles régionales, enquêtes et coupes : ce ne sont pas 535 844 essais de parcelles interchangeables.

## Références de méthode et de données

- Gomez-Dans et al., 2022. *Location, biophysical and agronomic parameters for croplands in northern Ghana*. ESSD 14, 5387. https://doi.org/10.5194/essd-14-5387-2022 ; données https://doi.org/10.5281/zenodo.6632083.
- Aramburu Merlos et al., 2024. *Adopting yield-improving practices to meet maize demand in Sub-Saharan Africa without cropland expansion*. https://pmc.ncbi.nlm.nih.gov/articles/PMC11130130/ ; données v2 https://doi.org/10.5281/zenodo.11122388.
- FAO. *Irrigation scheduling for conjunctive use of rainfall and irrigation based on yield-water relationships*, équation multiplicative de Jensen et limites. https://www.fao.org/4/w4367e/w4367e0n.htm.
- FAO. *AquaCrop calculation scheme* et manuel, couvert, transpiration, biomasse et HI. https://www.fao.org/aquacrop/overview/calculation-scheme/ ; code officiel `KUL-RSDA/AquaCrop`, release `v7.3_typofix` (mécanismes de référence, sans assimilation à AquaCrop-OSPy).
- USDA ARS. LIRF 2012-2013, https://doi.org/10.15482/USDA.ADC/1439968 ; sols et essais antérieurs https://doi.org/10.15482/USDA.ADC/1254006.
- Geyman et al., 2025. GROW-Africa v2, https://doi.org/10.5281/zenodo.16544448 ; inventaire complémentaire, non utilisé comme validation parcellaire dans cette livraison.
