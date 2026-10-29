# AgriPrévision — avancement vérifié au 29 octobre 2026

## Reprise et publication antérieure

Le dépôt actif est `fawitchamie-ai/agri`. La PR #1 irrigation a été fusionnée au commit `9c16fc5751b524ff96c78c9a81f7375c0d33e125`. Le workflow `40956392933` a réussi les contrôles, le point de restauration/migrations/publication Cloudflare et le contrôle authentifié de santé. Cette preuve porte sur la PR #1. Les ajouts ci-dessous sont préparés sur `feat/refonte-audit-cultures-20261029`. Leur état de fusion et de publication doit être lu dans la PR et le workflow associés au commit final ; la réussite de la PR #1 ne leur est pas attribuée.

Le code et les rapports ont été enregistrés dans le commit local `6a46819`. L'envoi de cette nouvelle branche a été rejeté par la revue automatique d'approbation : ensemble de changements jugé large, risque potentiel de données internes et absence d'autorisation explicite pour cette publication vers GitHub. Aucun contournement ni nouvelle tentative d'envoi n'a été fait. Une lecture des branches distantes confirme l'absence de la nouvelle branche ; aucune nouvelle PR n'a donc été créée. Le contrôle local des 36 fichiers modifiés ne trouve aucun motif de secret parmi les motifs recherchés, et aucun chemin de données brutes ou configuration de production n'est modifié ; ce contrôle limité n'est pas une garantie universelle d'absence de secret. La prochaine étape de publication nécessite l'accord explicite pour envoyer cette version vers le dépôt cité et ouvrir la PR.

Mise à jour : l'utilisateur a explicitement autorisé l'envoi de tous les changements en attente, leur intégration et le déploiement Cloudflare. La reprise comprend la comparaison des anciennes branches locales, l'ouverture de la PR, ses contrôles, la fusion du commit vérifié et la vérification de publication/santé du même commit. Les anciennes branches de présentation et d'observatoire sont des instantanés de travaux déjà repris sur main ; leurs différences d'authentification locale sont conservées telles que corrigées sur main.

## Réalisé, exécuté et vérifié dans cette reprise

- Relecture du cahier et des prompts joints ; six notebooks ouverts, versions et empreintes recalculées. Archives pays contrôlées intégralement en flux borné sans exécuter les cellules ni charger les gros exports FEWS dans pandas.
- Reconstruction des panels Bénin/Burkina/Ghana/Sénégal : 11 412 / 9 313 / 1 025 / 9 317 observations. Dernières années retenues : 2023 / 2023 / 2022 / 2015. Données utiles externalisées hors notebook ; sources originales préservées. Les extractions sont reproductibles depuis les notebooks conservés.
- Réexécution du protocole Togo v24 : 1 092 prévisions et empreinte CSV strictement identique. Rapport `docs/refonte/REPRODUCTION_V24.json`. Complément INSEED absent, diagnostics supplémentaires incomplets.
- Catalogue de 23 cultures, 16 paramètres chimiques et neuf références de fertilisation conditionnelles. Les 29 empreintes des sources agronomiques concordent avec les documents acquis précédemment. Les fiches ne sont pas annoncées comme une validation de terrain.
- Date de mesure et date de disponibilité des analyses distinctes ; résultat encore indisponible à la date du conseil refusé. Méthodes et horizons conservés, valeurs inconnues distinctes de zéro.
- Registre de capacités commun API/UI/notebook ; matrice de 828 états pour six pays et 23 cultures. Dans l'application, affichage des archives disponibles et des limites de conseil par pays. Aucun effet de rendement ajouté arbitrairement à partir des doses ou de l'eau.
- Notebook saisonnier : dix cellules exécutées dans un nouvel interpréteur Python, appel au moteur Node partagé, aucune archive embarquée. Les démonstrations fictives restent identifiées ; la couverture pays provient de l'audit réel.
- Vérifications : TypeScript, 85 tests, 14 contrôles d'intégration, cinq régressions, compilation et contrôle des différences Git réussis. Les tests des routes comparent les sorties du moteur, de l'API et les révisions sauvegardées, dont les analyses et références nutritionnelles. Contrôle navigateur du choix de fiche maïs et du formulaire d'analyse avec les deux dates ; pas de recette mobile complète revendiquée.

Mesures : audit des sources en 1,803 s, pic RSS 170,92 Mio pour son processus Linux ; reproduction v24 en 49,373 s. Le pic mémoire global du navigateur/Node/v24 n'a pas été mesuré. Les durées de tests et de compilation ne constituent pas des performances mesurées sur Cloudflare.

## Livrables et commandes

Les rapports sont dans `docs/refonte/` : inventaire, couverture, matrice, registre de sources, réutilisation, dictionnaire, écarts, protocole et preuves JSON. Les sources d'origine restent conservées dans les fichiers historiques ; les données extraites ne sont pas publiées comme nouvelles microdonnées de champ.

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm test:regressions
pnpm build
python3 scripts/execute-water-notebook.py science-source/seasonal/planification_saisonniere.ipynb
node --experimental-strip-types scripts/seasonal-capabilities.mjs
```

La reprise locale a employé les exécutables Node sous-jacents à ces scripts pnpm, sans modifier les dépendances. Pour la référence historique :

```bash
python3 scripts/reproduce-v24.py \
  --snapshot-notebook /chemin/memoire_togo_v22_complet_execute.ipynb \
  --notebook /chemin/memoire_togo_v24_integral_2016_2027.ipynb \
  --out /chemin/reproduction-neuve
```

Pour reconstruire les entrées et l'audit sans exécuter les anciens notebooks :

```bash
python3 scripts/audit-seasonal-inputs.py \
  --country-notebook /chemin/previsions_benin_autonome.ipynb \
  --country-notebook /chemin/previsions_burkina_faso_autonome.ipynb \
  --country-notebook /chemin/previsions_ghana_autonome.ipynb \
  --country-notebook /chemin/previsions_senegal_autonome.ipynb \
  --notebook /chemin/memoire_togo_v22_complet_execute.ipynb \
  --notebook /chemin/memoire_togo_v24_integral_2016_2027.ipynb \
  --togo-results /chemin/reproduction-neuve/results \
  --out /chemin/audit-neuf --data-out /chemin/donnees-neuves
```

Les deux destinations doivent être nouvelles pour éviter un écrasement. Les tableaux et empreintes sont déterministes sur les mêmes sources ; durée et pic mémoire dépendent de l'environnement. Le premier lancement a révélé un nom de colonne Togo incorrect dans le nouveau script ; corrigé puis relancé, sans déclarer son rapport incomplet comme réussi.

## État des étapes demandées

| Étape | État actuel |
|---|---|
| 1. Audit/reproduction/protocole | Audit exécuté et référence v24 reproduite ; absence ivoirienne et limites explicites. |
| 2. Socle de données et calcul | Socle hydrique/chimie actif et partagé ; dictionnaire et externalisation exécutés. Schéma extensible complet et package scientifique installable encore partiels. |
| 3. Sols/météo qualifiés | Formulaires et connecteur météo courte échéance présents ; aucun nouveau jeu de sols réels ou ensemble saisonnier harmonisé acquis ici. |
| 4. Prévision saisonnière | Non réalisée. Une reproduction historique ou un bilan d'eau ne la remplace pas. |
| 5. Conseils | Références conditionnelles et conversions exécutées ; méthode sol–culture personnalisée et phytosanitaire chimique bloqués faute de données qualifiées. |
| 6. Notebook/API/interface | Intégrés pour les calculs présents ; anglais, contour parcellaire et fonctionnalités restantes non livrés. |
| 7. Vérifications | Contrôles logiciels réalisés dans le périmètre indiqué ; qualification agronomique et scientifique saisonnière non réalisée. |
| 8. Exploitation/pilote | Pipeline existant vérifié pour la version antérieure ; pilote prospectif non commencé. |

## Prochaine action et dépendances

Acquérir/versionner météo historique et rétrospectives saisonnières, profils de sols et paramètres locaux avec droits et disponibilité vérifiés, puis fixer le domaine pilote effectivement documenté. Qualifier aussi les statistiques ivoiriennes et frontières datées. Les prescriptions personnalisées, registres phytosanitaires et la validation prospective nécessitent des informations/observations actuellement absentes ; leurs statuts restent bloqués. Voir `docs/refonte/ECARTS_DONNEES.md` pour chaque dépendance. Aucun abonnement, notification à un tiers ni validation d'agronome n'est créé ou inventé.
