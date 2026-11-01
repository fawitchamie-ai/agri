# Vérifications de la livraison expérimentale

Vérifications exécutées le 1 novembre 2026 :

| Contrôle | Résultat et portée |
| --- | --- |
| `pnpm check` | Types vérifiés. |
| `pnpm test` | 187 tests Node réussis, dont le reconstructeur exécutant 20 tests Python localement (14 sur les originaux de recherche acquis et 6 sur la livraison ouverte). Aucune acquisition réseau pendant ces tests. |
| `pnpm test:integration` | 14 vérifications HTTP/persistance réussies sur environnement local. |
| `pnpm test:regressions` | 5 contrôles métier/export/permissions réussis. |
| `pnpm build` | Compilation réussie ; avertissements existants Vite sur les imports dynamiques, sans échec. |
| Réacquisition des originaux | Sept XLSX CIRAD téléchargés à nouveau, tailles et SHA-256 identiques. |
| Reproduction des instantanés ouverts | WoSIS, OFRA et IITA Togo reproduits ; tri des réponses WoSIS sans changement de valeurs. Voir [ACQUISITIONS_REELLES.json](ACQUISITIONS_REELLES.json). |
| Base relationnelle | SQLite `integrity_check=ok`, aucune clé étrangère rompue, 4 420 unités de campagne, huit lignes source non qualifiables mises en quarantaine. |
| Métadonnées publiées | Reconstruction exacte vérifiée par test ; génération refusée si l'importeur, le schéma, le registre ou le manifeste changent depuis le rapport. |

Les 14 tests de recherche Python vérifient le plan expérimental réel, les pays/cultures, t/kg et m²/ha, le dénominateur non résolu de Gagnoa, les doses annuelles N sans double comptage, le compost appliqué distinct du nominal, les méthodes et horizons, l'absence de rattachement rétroactif des composites, les 48 m² de planches contre 64 m² bruts, les planches reconstruites non multipliées en répétitions, les récoltes incomplètes, les produits frais distincts de la matière sèche, la provenance/licence, les refus de modification d'empreinte ou de sortie occupée, les restrictions de ressource/embargo, les dates partielles, les blancs non imputés et la séparation des données privées/simulations. L'affectation d'un site à plusieurs splits et l'usage de synthétique pour validation sont rejetés. L'API impose une identité, rejette les pays/cultures inconnus et ne renvoie aucun brut expérimental.

En CI et dans un clone sans les originaux NC-SA, les 14 tests de recherche sont explicitement marqués ignorés ; les six contrôles ouverts sont exécutés. Les fichiers NC-SA ne sont pas redistribués. Les tests complets ont été exécutés localement après acquisition autorisée ; leur absence en CI ne constitue pas une validation agronomique.

Ces essais logiciels et acquisitions ne sont **pas une validation agronomique du rendement**. Aucun coefficient n'a été entraîné, aucun effet causal d'engrais ou de sol n'est annoncé, aucun pays n'est déclaré calibré. Les campagnes privées de production n'ont pas été lues. L'accès authentifié au site après publication doit être vérifié séparément ; une réussite de compilation ou une redirection vers Access ne le prouve pas. Les liens du workflow et le résultat réel de publication sont consignés dans la PR de livraison.
