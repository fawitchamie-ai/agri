# Contrats actifs et extensions restantes

Les contrats TypeScript actifs sont dans `lib/seasonal/types.ts`, `chemistry.ts`, `catalog.ts` et `nutrition.ts`. Le schéma est contrôlé côté serveur par `validateConfig` et `validateEvents`. La version du moteur est conservée dans chaque plan ; le catalogue possède sa propre version. Cette livraison ne prétend pas fournir le schéma complet de tous les futurs modules.

| Objet actif | Champs, unités et sens |
|---|---|
| Campagne | Pays ISO3 parmi les six configurés, localité textuelle déclarée, culture/variété, semis et date du conseil ; surface effectivement arrosée en m² ou inconnue. Aucun identifiant administratif stable n'est déduit d'un nom. |
| Horizons hydriques | Épaisseur m, teneurs volumiques capacité au champ/flétrissement/initiale en m³/m³ ; humidité initiale manquante bloque le bilan. Origine dans `soil.source`. |
| Analyse chimique | Source, date de mesure `date`, date réelle de disponibilité `availableOn`, profondeur haute/basse cm, statut mesuré/déclaré/estimé. Mesures avec paramètre, valeur, unité et méthode conservés. La disponibilité doit suivre la mesure et précéder ou égaler le conseil. |
| Paramètres chimiques | pH ; EC dS/m avec dilution/méthode ; C organique, matière organique et N total distincts en % ou g/kg ; N minéral mg/kg ; P assimilable avec méthode ; K/Ca/Mg/Na échangeables et CEC avec unités explicites ; S/Zn/B/Al. Aucun inconnu converti en zéro. |
| Météo | Date quotidienne, pluie/ET0 en mm, statut observé/prévision/scénario, source et disponibilité ; les scénarios sont des hypothèses nommées. |
| Stades | Jours entiers, Kc sans unité, racines m, fraction hydrique p. Durées d'exemple contextualisées, jamais une floraison locale validée. |
| Irrigation | Efficacités fractionnelles, débit au point source en m³/h, durée h/j, quota m³, plafonds mm/j, jours d'accès ; net/champ/source distingués. |
| Observations eau | Identifiant stable, date, type, statut, quantité et unité, point de mesure, source et horodatage de saisie. Annulé/prévu n'est pas réalisé. |
| Fertilisation de référence | Identifiant et source de fiche, pays/culture/système, territoire et variété lorsqu'ils restreignent le domaine, produits et plages kg/ha, teneurs N–P₂O₅–K₂O, moment et notes. Contexte et masses déjà appliquées par produit conservés. |
| Plan | Version, statut conditionnel/bloqué, preuve `simulation_non_validee`, hypothèses, manques, jours et agrégations ; incertitude validée et rendement ne sont pas inventés. |
| Archivage | D1 conserve configuration, événements, plan, acteur et dates de révision. Une révision passée garde son résultat ; un nouveau calcul utilise les fonctions/version courantes. |

Extensions nécessaires : géométries et superficies brute/utile/semée/récoltée séparées, millésimes géographiques, saison et système pluvial/irrigué explicites, disponibilité de chaque paramètre physique, ingestion/millésime distincts des mesures, ensembles météo et versions, pratiques complètes et organiques, coûts/prix datés, cible et humidité de récolte, modèles/validations et règles agronomiques locales. Leur absence est un écart de réalisation, pas un champ implicitement mesuré.
