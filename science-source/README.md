# Sources scientifiques conservées

La référence principale est v24, origine fixe 2015. `v24/` contient les modules exacts extraits du notebook; `v24-results/` contient les CSV et preuves gelés. Le SHA des 1 092 prévisions est identique à la sortie exécutée du notebook v24.

Les modules `build_panel.py`, `baselines.py`, `notebook-output-evidence.json` à la racine décrivent l’audit historique v22, conservé comme provenance de l’instantané initial. Ils ne sont pas la méthode principale actuellement affichée.

Pour reproduire la préparation scientifique, installer les versions de `requirements.txt` puis suivre `scripts/reproduce-v24.py --help` et `scripts/integrate-v24.py --help`. Les notebooks v22 et v24 originaux sont nécessaires comme entrées à la préparation, mais pas à l’exécution du site. Ils ne sont ni téléchargés ni exécutés lors de la consultation.

Les sources brutes sont lues depuis l’archive embarquée v22, après vérification de 302 tailles/SHA. Les données de coopérative n’interviennent jamais dans cet entraînement. Le supplément INSEED absent est documenté comme diagnostic incomplet et ne change ni l’apprentissage ni les prévisions reproduites.
