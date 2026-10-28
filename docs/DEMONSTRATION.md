# Scénario de soutenance

## Préparation
Ouvrir l’application, cliquer sur « Espace de démonstration ». Les membres, capacités et mouvements sont fictifs. Les références de rendement proviennent, elles, de la reconstitution traçable du notebook v24. Choisir Maïs, 2026, National et Togo. Conserver ces filtres tout le long du parcours.

1. **Consulter.** Montrer le rendement, son unité t/ha, le niveau national et l’historique disponible. Ouvrir la provenance. Expliquer l’origine fixe 2015. Le protocole exact v24 a été réexécuté et le CSV des 1 092 prévisions possède exactement l’empreinte imprimée dans le notebook. Les observations nationales 2023–2024 X/E sont diagnostiques.
2. **Comparer.** Consulter les paires historiques et leur période. Montrer les erreurs signées, absolues, MAE, RMSE et biais avec leur effectif. Ces indicateurs concernent la comparaison rétrospective du même estimateur, pas un nouveau test aveugle. Les 28 paires nationales principales couvrent 2016–2022; les préfectures n’ont pas de paire compatible aux scores.
3. **Simuler.** Saisir 2 ha, poids du sac 50 kg et variantes utilisateur. Vérifier tonnes = rendement × hectares; kilogrammes = tonnes × 1000. Enregistrer. Les scénarios sont des hypothèses, pas des intervalles de confiance; le transfert du rendement territorial à une superficie locale nécessite l’hypothèse de compatibilité des superficies.
4. **Préparer la collecte.** Choisir un membre fictif, un point, une date et les quantités par catégorie. Définir une capacité de stockage/transport; saisir un engagement la dépassant pour montrer l’alerte. Prévision, déclaration, engagement et collecte restent distincts.
5. **Enregistrer une récolte.** Saisir 1 ha effectivement récolté et 1 500 kg mesurés, puis passer de brouillon à soumis et validé avec le rôle autorisé. Le rendement vaut 1,5 t/ha. Montrer l’historique et la persistance après actualisation. Une mesure communautaire n’est pas une statistique officielle.
6. **Produire le bilan.** Ouvrir la fiche pour les mêmes filtres. Montrer les volumes séparés, superficies et effectifs, les hypothèses, sources et date. Exporter un CSV et télécharger le PDF natif, puis montrer l’impression proposée en complément.

## Discours de portée
- Fonctionnel : consultation, simulation, gestion métier persistante, contrôles côté serveur, import et exports, fiche imprimable.
- Réel scientifique : sources embarquées des notebooks, protocole v24 complet et modèles réellement sélectionnés, observations et CSV reproduit à empreinte identique.
- Démonstration : coopératives, membres, capacités et mouvements initiaux fictifs; saisies utilisateur identifiées.
- À valider : disponibilité historique des éditions des sources, géographies après2015, superficies, performance opérationnelle, adoption terrain.

Ce scénario est une démonstration ergonomique interne. Il ne remplace pas un test auprès de responsables de coopératives ou de producteurs.
