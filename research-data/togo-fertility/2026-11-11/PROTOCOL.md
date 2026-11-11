# Relecture du profil togolais, 11 novembre 2026

Protocole écrit avant exécution du nouveau comparateur. Les récoltes des trois traitements sont déjà connues : aucune validation aveugle n'est revendiquée.

## Hypothèse principale

Le plafond K du profil illustratif ne représente pas la fertilité du champ. Tester le logiciel officiel AquaCrop 7.3 `v7.3_typofix` avec la recalibration publiée dans la thèse de Gadédjisso-Tossou (2020), pp. 89 et 99–100. Cette recalibration a utilisé **les trois traitements** du même essai : son transfert est un rejeu documentaire, pas une estimation de paramètres indépendamment des contrôles.

Paramètres fixés avant calcul : HI de référence 26%, racines 0,3–0,5 m, densité 70 000/ha, CN46, REW2 ; émergence8, couvert maximal69, enracinement86, sénescence90, maturité111, floraison66 pendant18 jours, formation HI39 jours ; équivalents thermiques 135/1199/1257/1408/1898/1018/183/778. Couvert potentiel 0,78/(1−0,01), CGC dérivé du temps au maximum à 98% de CCx ; CDC générique maïs versionné, WP* potentiel33,7 g/m². Réponses publiées : CGC−15%, CCx−1%, WP*−70%, déclin de couvert **0,42 point de pourcentage/jour**. Ce dernier vaut 0,42 dans `SFCDecline`, que le code officiel divise par100 : ne pas diviser deux fois.

Les quatre formes de réponse sont inversées pour produire ces effets au degré interne50%. Cette coordonnée est une convention de représentation ; elle n'interprète ni le libellé65 de l'article antérieur ni Brel60 comme un multiplicateur. Gestion identique dans les trois traitements. Aucun ajustement sur les kg N/P/K, aucun coefficient par traitement.

## Entrées et comparaisons fixées

Même météo quotidienne NASA déjà acquise ; origine locale documentée, distincte de la station de l'essai. Sol : FC/WP et humidité initiale publiées, SAT mesurée dans la thèse (34,87/36,51/39,91/41,35%), Ksat714,24/574,81/693,58/592,70mm/j. Quatre horizons jusqu'à0,5m ; l'éventuelle extension numérique du logiciel est déclarée.

Les cinq calendriers existants (quotidien, impulsions3jours début/fin, impulsions7jours début/fin) conservent exactement les volumes par stade du tableau4. Ils restent des hypothèses ; les événements bruts du champ ne sont pas acquis. Ne pas choisir le calendrier sur son erreur de grain. Application100% dans la comparaison principale, sans perte cachée. Quantifier les arrondis de dose du logiciel officiel.

Deux variantes de phénologie, annoncées ici : jours calendaires publiés ; degrés-jours publiés (mode de la thèse). Contrôle fertilité désactivée, tous autres paramètres identiques. Aucun paramètre libre dans cette phase. Les tableaux3/7 de l'article constituent d'autres scénarios d'irrigation simulés par les auteurs et ne sont pas des observations de l'essai.

Évaluer séparément : bilans, irrigation effectivement simulée, ET/Tr/E, couvert, biomasse, HI et grain à13% (sensibilité12–14%). MAE/RMSE/biais/nRMSE, contrastes et résultats défavorables pour tous les calendriers. Couvert/biomasse de stades : comparaison descriptive seulement, pondérations de mesures inconnues. Une baisse d'erreur absolue sans correction des rapports n'est pas une solution au problème. Aucun profil national activé par ce rejeu.

Source : https://tud.qucosa.de/api/qucosa%3A38704/attachment/ATT-0/ ; URN urn:nbn:de:bsz:14-qucosa2-387041. Fichier acquis et empreinte enregistrée séparément ; ne pas redistribuer le PDF intégral dans le dépôt.
