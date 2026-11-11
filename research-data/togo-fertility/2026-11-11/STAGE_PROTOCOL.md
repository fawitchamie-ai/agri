# Alternative de formation du grain selon le stade

Le pilote du 11 novembre a déjà exploré les récoltes togolaises : cette extension est du développement. Aucun résultat n'est qualifié de test aveugle ou d'évaluation climatique indépendante.

## Formulation et choix gelés avant comparaison élargie

Alternative au plafonnement journalier de toute la biomasse par un stock K illustratif : calculer une réponse relative du grain au déficit **d'ET** de chaque phase. Composition inspirée du module statique SWAP4 (§7.2), avec les Ky maïs de FAO33 : produit des termes `[1−Ky_i×(1−ETa_i/ETm_i)]`. Ky0/0,4/1,5/0,5/0,2 pour installation/végétation/floraison/formation/maturation. Les Ky ne sont pas ajustés. SWAP exprime sa réponse avec la transpiration ; ici la réponse FAO33 porte sur l’ET totale. Cette adaptation est annoncée comme hypothèse, pas comme exécution de SWAP. Ne pas multiplier ce résultat par le grain RUE déjà limité par l'eau ou par QUEFTS : cela compterait deux fois le stress.

Calendrier principal : installation DAP1–20 ; végétation21–65 ; floraison66–83 ; formation84–104 ; maturation105–111. Les dates66/18/39/111 viennent de la recalibration documentée de la thèse ; le bornage de l'installation vient du tableau4. La formation HI39jours commence à la floraison ; le découpage évite de compter deux fois les journées66–83. Calendrier alternatif publié dans l'article : floraison54–63, formation64–95, maturation96–111 (HI42jours). Ne pas choisir a posteriori entre ces deux calendriers sur leur RMSE.

Une seule capacité locale Ym est estimée à partir du traitement FI de la reconstruction quotidienne : `Ym=Y_FI / facteur_FI`. Puis elle reste figée pour les deux déficits, les cinq calendriers et les perturbations d'eau. Même humidité13% (hypothèse médiane12–14%) pour la référence et ses sorties ; aucune conversion depuis le grain américain15,5%. La référence FI n'est pas une mesure de rendement potentiel physiologique et n'est disponible qu'après récolte. L'ajustement est intra-essai, pas une prévision avant campagne.

Comparaisons : moteur illustratif inchangé, constante FI, FAO saisonnier ajusté sur FI seulement, produit par phases, et référence variétale2t/ha sans ajustement (humidité non établie : analyse de sensibilité séparée, pas paramètre opérationnel). Mesurer les erreurs sur **les deux déficits séparément**, puis sur les trois moyennes en signalant la calibration FI. Aucun coefficient par traitement. Conserver tous les calendriers et montrer leur dispersion : ce ne sont pas des répétitions biologiques.

Le modèle prédit ici l'ET avec le bilan existant. Il ne simule pas un couvert/une biomasse ni la mortalité à l'installation ; les sorties RUE ne sont pas renommées en sorties de cette méthode. Les flux restent audités et la méthode ne corrige pas magiquement le sol ou les événements manquants. Domaines : maïs grain terrestre drainé, calendrier explicite, référence Ym indépendante des traitements comparés et de la période de prévision. Toute référence acquise après la date de prévision est refusée. Aucun profil national par défaut.

Sources : FAO https://www.fao.org/4/X5647E/x5647e0e.htm ; SWAP4 https://doi.org/10.18174/416321 ; thèse urn:nbn:de:bsz:14-qucosa2-387041. Le module applicatif est cette équation simple raccordée au bilan d'eau, pas le logiciel SWAP complet.
