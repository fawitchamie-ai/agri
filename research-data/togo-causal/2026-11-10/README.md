# Diagnostic Togo et comparateur AquaCrop

Rapport : `docs/science/togo-causal-aquacrop-2026-11-10.md`.

- `PROTOCOL.md` : expériences/calendriers annoncés avant comparaison ; `protocol.sha256` : empreinte.
- `rue-daily.json.gz` : 36 cas, entrées d'irrigation hypothétiques et flux quotidiens complets ; `rue-daily.csv.gz` : export lisible ; `rue-summary.json` : synthèses, métriques et dates de divergence.
- `aquacrop-daily.json.gz` et `aquacrop-summary.json` : 20 exécutions réelles AquaCrop-OSPy 3.0.12 ; paramètres, provenance, bilans et limites. Python dans la recherche/CI uniquement.
- `AQUACROP_ADAPTER.md` : unités, profil réellement simulé et hypothèses explicites.
- `published-intermediates.json` : transcriptions des tableaux du DOI 10.17159/wsa/2020.v46.i1.7894, sans prétendre à des séries brutes journalières.
- `identifiability.json` : sensibilité/confusion de paramètres, sans optimisation ou calibration.
- `remote-*.json` et `deployed-before-causal.json` : contrôles directs des versions publiées précédant ce diagnostic.

Les trois moyennes mesurées d'un même essai ne deviennent pas 36 ou 20 validations. Aucun calendrier reconstruit n'est une observation réelle. Le plateau nutritif n'est pas supprimé en production. Aucune réponse de chercheur ni nouvelle donnée privée n'est présumée.
