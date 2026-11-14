# Transfert QUEFTS maïs vers le nord du Bénin — contrôle sur moyennes publiées

## Résultat

Un réglage d’un seul facteur commun de récupération NPK, ajusté sur les moyennes 2014, améliore le calcul de la **réponse moyenne conditionnelle** aux microdoses lorsqu’on le reporte sur les moyennes MD1/MD2 de 2015. Le témoin 2015 reste fourni au modèle comme ancre : il n’est pas prédit. Les deux profils QUEFTS ont 2/2 moyennes de traitement dans ±20 %, mais ce résultat ne porte que sur deux moyennes agrégées d’une seule étude.

**Décision produit : le réglage est maintenant exposé comme pilote expérimental facultatif dans le simulateur d’engrais maïs au Bénin. Il n’est pas versé dans le moteur automatique du rendement parcellaire et ne qualifie aucun domaine opérationnel.** Le pilote exige le rendement d’un témoin local sans engrais, le plafond fixe de 10 t/ha et l’une des deux doses de l’étude. Le contrôle publié utilise le rendement témoin observé de chaque saison pour ancrer le modèle : il ne teste donc pas une prévision automatique du rendement de base.

## Données et séparation

Source : Tovihoudji et al., *Field Crops Research* 230 (2019), 139–150, [DOI 10.1016/j.fcr.2018.10.018](https://doi.org/10.1016/j.fcr.2018.10.018). L’étude rapporte 51 essais paysans au total dans le district d’Ina, au cours des saisons 2014 et 2015; la variété est DMR-ESR. Les rendements sont publiés sur matière sèche. Les traitements microdose sont MD1 (23,8–4,1–7,8 kg N–P–K/ha) et MD2 (33,1–8,2–15,6 kg N–P–K/ha).

Le protocole fige **2014 pour l’ajustement** et **2015 pour le contrôle temporel**. Chaque jeu ne comporte que deux sorties exploitables : les moyennes publiées des traitements MD1 et MD2. Les 18 essais de 2014 et les 33 de 2015 ne sont pas comptés comme observations de parcelles, puisque les rendements appariés par exploitation ne sont pas dans les données utilisées.

| Saison | Témoin sans engrais | MD1 | MD2 | Unité source |
|---|---:|---:|---:|---|
| 2014, ajustement | 1 089 | 2 240 | 2 330 | kg grain sec/ha |
| 2015, contrôle temporel | 1 103 | 2 127 | 2 262 | kg grain sec/ha |

Pour comparer au moteur, les valeurs sèches sont converties à 15 % d’humidité (`kg sec/ha ÷ 0,85`). Le plafond du modèle reste fixé à 10 t/ha, valeur de potentiel déclarée dans la publication source des profils QUEFTS. Chaque saison est ancrée à son propre témoin observé; le modèle doit alors prédire les moyennes MD1/MD2.

## Ajustement et contrôle temporel

Un seul multiplicateur commun est ajusté aux trois récupérations N/P/K de chaque profil. La recherche est bornée pour qu’aucune récupération ne dépasse 100 %. Les profils NGS et SS déjà présents dans l’application sont évalués séparément et aucun n’est choisi sur le jeu 2015.

| Profil | MAE MD1/MD2 2015 sans réglage* | MAE ajustement 2014 | MAE MD1/MD2 2015 après réglage* | Biais 2015* | Moyennes 2015 dans ±20 % | Récupération candidate N–P–K |
|---|---:|---:|---:|---:|---:|---|
| NGS | 0,749 t/ha | 0,458 t/ha | 0,335 t/ha | −0,335 t/ha | 2/2 | 0,778 – 0,296 – 1,000 |
| SS | 0,721 t/ha | 0,139 t/ha | 0,113 t/ha | −0,015 t/ha | 2/2 | 0,825 – 0,206 – 0,954 |

\* Scores calculés sur les deux moyennes MD1/MD2 à 15 % d’humidité, après ancrage au rendement témoin publié de la même saison. Ils ne mesurent pas l’erreur d’une prévision autonome du rendement témoin.

Les valeurs 2015 prédites sont :

| Profil | MD1 prédit / observé | Erreur relative | MD2 prédit / observé | Erreur relative |
|---|---:|---:|---:|---:|
| NGS | 2,049 / 2,502 t/ha | −18,1 % | 2,446 / 2,661 t/ha | −8,1 % |
| SS | 2,374 / 2,502 t/ha | −5,1 % | 2,759 / 2,661 t/ha | +3,7 % |

Le profil NGS atteint la borne de récupération K = 1,00 durant l’ajustement; il ne peut pas davantage corriger son sous‑rendement sans changer la structure ou les ratios du modèle. Le profil SS est plus proche sur ces deux moyennes, mais retenir SS parce qu’il gagne sur ce seul contrôle serait une sélection sur un échantillon de validation trop petit.

## Portée et décision d’intégration

- Le contrôle porte sur **l’effet moyen conditionnel de deux traitements minéraux**, sachant déjà le témoin de la saison. Le rendement témoin fourni à l’application par un utilisateur n’est pas disponible à l’avance pour une prévision automatique.
- Les deux points de contrôle sont des **moyennes de traitement**, pas deux parcelles indépendantes. Ils ne permettent pas d’estimer la dispersion de l’erreur entre champs, un intervalle prédictif, ni la proportion de parcelles correctement prévues.
- Il n’y a qu’une étude et une zone; la validation ne démontre pas un transfert à tout le Bénin, au Togo ou aux quatre autres pays.
- Le compost/fumier, les pertes, les dates d’apport, l’eau et la réponse par champ ne sont pas évalués par ce calcul.
- La calibration candidate multiplie les récupérations publiées; elle ne ré-estime pas les stocks de sol, le profil d’eau ou les coefficients d’accumulation/dilution. Les données agrégées ne permettent pas d’identifier séparément N, P et K.

Le modèle automatique de rendement parcellaire reste inchangé et les pays demeurent non qualifiés. Le candidat est uniquement accessible comme comparaison conditionnelle des microdoses au Bénin ; les deux profils sont affichés ensemble et aucun « meilleur » profil n’est choisi sur ces données. Pour qualifier une prévision parcellaire, il faut des rendements par traitement et par exploitation, les surfaces nettes récoltées, l’humidité, les dates, l’identité des essais, le sol et la conduite correspondante, puis une validation sur d’autres sites et saisons indépendants.

Dans l’application, l’option Bénin est limitée au maïs, aux apports minéraux correspondant à MD1 ou MD2 (tolérance 2 %), à un sol drainé et à un témoin sans engrais mesuré par hectare semé à 15 % d’humidité. Elle bloque si ces conditions ne sont pas satisfaites. Le résultat reste un scénario expérimental : il ne constitue ni une recommandation ni une prévision automatique du rendement de base.

## Reproduction

Le calcul est reproductible avec :

```bash
node --experimental-transform-types scripts/calibration/benin-quefts-microdose-benchmark.mjs
```

Les entrées, les deux profils, les prédictions et les métriques sont conservés dans [le JSON de sortie](benin-quefts-microdose-benchmark-2026-11-14.json). Le script importe les équations QUEFTS réellement utilisées dans l’application et n’écrit aucun coefficient dans le moteur.
