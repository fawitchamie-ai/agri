# Fertilizer evidence v1

The original Carob ZIP is retained unchanged, SHA-256 pinned in `sources.json`.
It contains 5,601 standardized records, not the 7,555 currently announced by the
report page. Data: Kihara, Okeyo, Bolo, Kinyua (2020), Harvard Dataverse v2.2,
DOI https://doi.org/10.7910/DVN/GXUNAZ, **CC BY 4.0**. `pairs.csv` is a derivative
matching 554 maize NPK/control contrasts; missing moisture/year/denominator and
randomization are intentionally retained as missing. Negative gains remain.
It is a research dataset, not a prescription or an operational predictor.

OFRA (CC0-1.0, Wortmann et al., https://doi.org/10.5061/dryad.tt6h5h1) and Senegal
(CC BY 4.0, https://doi.org/10.6084/m9.figshare.27022285.v1) workbooks were acquired
and read. Their large originals are restored by exact checksum from the receipt,
never silently replaced by newer files. Metadata and audit counts are tracked.
OFRA functions are not converted into independent observations. Senegal treatment
names mix varieties and fertilizer interventions; no automatic causal pairing is
asserted. No nearby soil record was attached to an experimental plot.

The Carob R standardization script is an unexecuted audit snapshot under GPL-3.0;
its upstream license is included in `raw/CAROB-LICENSE`. It is not imported by the
application. No NC original, derived NC coefficient, private field record, or user
campaign enters this evidence release.

Reproduce with Python 3 standard library only:

```bash
python3 scripts/calibration/acquire_fertilizer.py
python3 scripts/calibration/fertilizer_pipeline.py --prepare
python3 scripts/calibration/fertilizer_pipeline.py --evaluate
python3 -m unittest discover -s tests/calibration -p 'test_fertilizer.py' -v
```

Preparation freezes matching, localities, candidates and acceptance thresholds;
evaluation refuses changed inputs. `PROTOCOL-v2.json` groups T/wada and Tudun Wada
conservatively. The earlier alias split and its scores are kept as invalidated,
not treated as independent validation. The test has been inspected during this
research run; a future certification needs new independent observations.

Rejected row IDs and reasons can be rebuilt into the ignored `rejected.json`;
the immutable original and deterministic matching code preserve their trace.
OFRA sentinel values -9/-999 remain missing; no P2O5/K2O conversion or dry-basis
conversion is performed without qualified original units.
