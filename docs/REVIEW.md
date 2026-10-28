# Revue croisée et vérifications

## Périmètre et méthode

La revue qualité a été effectuée par un agent distinct des auteurs frontend, backend et scientifiques. Les contrôles automatisés ci-dessous ont été exécutés; il ne s’agit pas de tests auprès de vrais utilisateurs. La revue du navigateur et de l’impression est conduite séparément par le coordinateur et l’UX.

### Vérifications exécutées

- `node --experimental-strip-types --test tests/*.test.*` : **21 tests réussis**, aucun échec. Conversions kg/sacs/tonnes, production, rendement, agrégation pondérée, MAE/RMSE/biais/zéro, étapes de collecte non additionnées, CSV échappé contre les formules, nombres invalides et dépassements, import invalide/doublon, scénarios et dates, cohérence indépendante du socle v24 et aller-retour export/import.
- `AGRI_TEST_INPROCESS=1 node --experimental-transform-types tests/http-integration.mjs` : **14 scénarios réussis**. Résultats enregistrés dans `tests/route-results.json`.
- Le parcours d’intégration appelle les **véritables fonctions des routes API**, utilise les migrations SQL du projet et une base SQLite temporaire sur disque. L’adaptateur reproduit les opérations D1 `prepare/bind/first/all/run/batch`. Seuls le transport D1 et l’identité ChatGPT sont remplacés pour ce test. Cela ne constitue pas un test du service D1 distant ni de l’authentification réelle ChatGPT.
- Les scénarios couvrent : accès anonyme refusé; démonstration; simulation et instantané de provenance; récolte/normalisation/correction/historique; collecte et doublon; isolation entre coopératives; limites des droits producteur; exports filtrés; aperçu/import/réimport; origine étrangère refusée; **fermeture puis réouverture de la base avec données conservées**; invitations ciblées avec identité contrôlée et transfert confirmé; confirmations concurrentes d’import et de collecte sans duplication; contenu du PDF et conservation du niveau géographique et de la version active.
- Une tentative de test HTTP direct vers l’URL de prévisualisation a échoué au transport (`fetch failed`, `UND_ERR_SOCKET`) avant les assertions. Aucun succès réseau n’est revendiqué sur cette voie.

### Contrôle scientifique indépendant

Le socle principal a été remplacé par la **v24 retrouvée**, après vérification du notebook et reproduction exacte de son protocole. Le test scientifique indépendant contrôle le SHA-256 du CSV (`aaa4c8f734322ad21a1ef781b7ac10322915441a3e2f06f64633ecc01fa4e71d`) contre l’empreinte conservée dans la sortie exécutée du notebook. Il vérifie 1 092 prévisions uniques sur 91 séries et quatre cultures, toutes les valeurs du JSON contre le CSV figé, la présence de leur filiation et l’absence d’entrées postérieures à 2015. Il contrôle les 28 paires nationales principales de 2016–2022, distingue les huit diagnostics de 2023–2024 et recalcule MAE/RMSE/biais pour les quatre cultures, à l’identique des exports du système sélectionné. Aucun score préfectoral ni validation opérationnelle ne sont revendiqués.

Les tests v22 ont servi au contrôle du premier socle provisoire, puis ont été remplacés par ces contrôles v24 après la récupération de la référence demandée. La v22 n’est pas présentée comme résultat principal de l’application.

## Problèmes constatés et corrections

| Gravité | Preuve ou reproduction | Correction et contrôle |
|---|---|---|
| Élevée | Un producteur pouvait voir tous les enregistrements de type membre de sa coopérative. | `canSee` restreint les membres au propriétaire. Scénarios droits producteur et isolation exécutés. |
| Élevée | Une récolte saisie par le responsable pour un membre producteur restait attribuée au responsable; le producteur ne voyait pas sa récolte. | Attribution au propriétaire du membre. Test intégration producteur et transfert par invitation réussis. |
| Élevée | Deux confirmations d’import simultanées pouvaient passer le contrôle préalable et dupliquer des résultats. | Clés de résultats immuables, contrainte unique de lot et transaction. Double confirmation concurrente exécutée : une seule version ajoutée. |
| Élevée | Deux créations de collecte simultanées pouvaient contourner le contrôle de doublon préalable. | Écriture atomique conditionnée à l’absence de clé membre/culture/campagne/territoire active. Test concurrent : réponses 201 et 409, une seule ligne. |
| Moyenne | La suppression d’une récolte pouvait laisser une collecte pointant vers une récolte inexistante. | Suppression refusée lorsqu’une collecte est liée; test de réponse 409 réussi. |
| Moyenne | `Number(true)` ou `Number([])` pouvait être accepté comme une quantité; de très grands produits pouvaient devenir infinis. | Validation de type et contrôle du résultat fini. Tests adversariaux réussis. |
| Moyenne | La date `2026-02-30` était acceptée par `Date.parse` puis normalisée silencieusement. | Date ISO avec fuseau et contrôle calendaire. Tests dates impossibles réussis. |
| Moyenne | La date du protocole pouvait être affichée comme date réelle d’émission. | `issuedAt` séparé de `decisionDate` et de `reconstructedAt`; origine de la reconstitution explicitée. |
| Faible | Un CSV contenant uniquement l’en-tête était accepté comme import vide. | Rejet explicite avant aperçu/confirmation; assertion exécutée avec succès dans le test CSV. |
| Moyenne | Une requête d’historique était émise pour chaque enregistrement métier. | Lecture groupée des historiques par coopérative, puis regroupement en mémoire. |

### Corrections frontend et PDF contrôlées

| Gravité | Preuve ou scénario | Correction demandée |
|---|---|---|
| Élevée | Importer une nouvelle version du même contexte : `find` sélectionnait toujours le résultat intégré en premier. | Sélecteur de version ajouté; courbe, comparaison et PDF liés à la version active. Lecture du code et test PDF avec version exécutés. |
| Moyenne | Télécharger l’export des prévisions et le réimporter comme exemple : colonne `id` supplémentaire et niveau traduit non conforme. | Import accepte l’identifiant facultatif de l’export et normalise les niveaux traduits. Test d’aller-retour sur les 1 092 lignes exécuté avec précision conservée. |
| Moyenne | Renseigner une capacité de 0 t puis engager un volume positif : affichage « non renseigné » et absence d’alerte. | Présence de capacité testée séparément de sa valeur; lecture du code confirme affichage 0 t et alerte pour engagement positif. Vérification visuelle finale du coordinateur. |
| Faible | Le libellé indiquait cinq observations pour des séries qui en ont moins. | Libellé corrigé lors de la phase v22; avec v24, la méthode réelle de chaque résultat est affichée, sans généralisation à une moyenne unique. |

Un problème supplémentaire a été reproduit dans le PDF : `national` transmis par les filtres ne correspondait pas au libellé source `National`, et la version active était ignorée. La normalisation du niveau et le filtre de version ont été corrigés. Le test intégré appelle la véritable route, ouvre le résultat avec pypdf et vérifie la version, le modèle, les sections et la présence de la prévision. Ce contrôle de contenu ne remplace pas l’inspection visuelle du PDF, effectuée séparément par le coordinateur.

## Performance mesurée

`node --experimental-strip-types tests/performance.mjs` exécute sept répétitions par calcul sous Node 24.22.1. Sur 100 000 lignes synthétiques, les premières médianes observées sont : calcul MAE/RMSE/biais **11,36 ms**, somme des colonnes de collecte **13,03 ms**, rendement agrégé **4,11 ms**. Décodage du JSON scientifique v24 de 2,51 Mo (3 244 lignes de données) : **6,46 ms**. Ce sont des microbenchmarks de calcul en mémoire et de décodage local, pas des temps de réponse navigateur/réseau/D1. Les données synthétiques du benchmark ne sont pas intégrées aux prévisions.

## Limites de validation

- Aucune validation agronomique sur le terrain ni étude utilisateur réelle n’a été menée.
- La disponibilité des géométries et leur correspondance administrative actuelle ne permettent pas de revendiquer une carte opérationnelle.
- Le fonctionnement de la connexion ChatGPT et du stockage D1 hébergé doit être distingué de l’intégration testée avec identité contrôlée et SQLite locale.
- Une route serveur produit un PDF téléchargeable; l’impression navigateur reste également disponible. Les contrôles visuels finaux appartiennent au coordinateur.
- Les résultats scientifiques intégrés v24 restent rétrospectifs et exploratoires malgré la concordance exacte du CSV avec la sortie source; les statistiques disponibles en 2015 ne sont pas archivées dans leurs éditions historiques.

## Contrôle intégré du coordinateur
Le parcours a été exécuté dans Chrome : prévisions nationales Maïs2026, comparaison7paires2016–2022, simulation2ha à1,1892999410629272t/ha puis sauvegarde, collecte avec catégories séparées, récolte mesurée1500kg/1ha validée, puis fiche avec volumes cohérents. La simulation et la récolte restaient présentes après rechargement et redémarrage de l’aperçu. Une vue interne dans un iframe de390×844a permis de contrôler le responsive et de naviguer vers la simulation; il ne s’agit pas d’un essai sur un téléphone physique. Les PDF A4 ont été rendus avec Poppler et inspectés visuellement.

Correction visuelle moyenne : la classe intégrée `.page-content` n’était pas ciblée par les marges du CSS; ajout dans les sélecteurs desktop, mobile et impression. Les termes et valeurs de récapitulatifs sont alignés, les champs terrain disposent de cibles44px et la navigation mobile a été compactée.

Trois tests supplémentaires de planification passent : créneaux indépendants, agrégation du même créneau, capacité zéro/absence/annulation. Les21tests et14scénarios API/SQL/PDF ont été réexécutés après ces changements.
