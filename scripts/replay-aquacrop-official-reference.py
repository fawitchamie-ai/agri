"""Rejoue le test officiel AquaCrop, puis contrôle la sensibilité à la fertilité.

Linux x86_64 uniquement. Archives acquises depuis KUL-RSDA/AquaCrop,
release v7.3_typofix. Le cas fourni concerne la luzerne à Ottawa.
Ce script n'est pas une calibration du maïs ni une validation africaine.
"""
from pathlib import Path
import json
import platform
import shutil
import subprocess
import tarfile
import zipfile
import sys

ROOT = Path(sys.argv[1]).resolve()
if platform.system() != "Linux" or platform.machine() not in ("x86_64", "AMD64"):
    raise SystemExit("Le binaire fourni nécessite Linux x86_64; utiliser une distribution officielle adaptée.")
work = ROOT / "official_replay"
work.mkdir(exist_ok=True)
with tarfile.open(ROOT / "AquaCrop-v7.3_typofix.tar.gz") as archive:
    archive.extractall(work, filter="data")
test = next(work.glob("*/testcase"))
with zipfile.ZipFile(ROOT / "aquacrop-7.3-x86_64-linux.zip") as archive:
    name = next(name for name in archive.namelist() if name.endswith("/aquacrop"))
    (test / "aquacrop").write_bytes(archive.read(name))
(test / "aquacrop").chmod(0o755)
subprocess.run(["./aquacrop"], cwd=test, check=True, timeout=45)
checks = []
for reference in sorted((test / "OUTP_REF").glob("*.OUT")):
    actual = test / "OUTP" / reference.name
    a = reference.read_text().splitlines()
    b = actual.read_text().splitlines()
    differences = [i + 1 for i, (x, y) in enumerate(zip(a, b)) if x != y]
    unexpected = [line for line in differences if line != 1 or "Output created on" not in a[0]]
    ok = len(a) == len(b) and not unexpected
    checks.append({"file": reference.name, "matchedExceptCreationTimestamp": ok,
                   "differentLines": differences})
    if not ok:
        raise SystemExit("Écart au test officiel : " + reference.name)

alternative = work / "no_fertility_stress"
shutil.copytree(test, alternative, dirs_exist_ok=True)
management = alternative / "DATA/Ottawa.MAN"
text = management.read_text()
assert "50         : Degree of soil fertility stress" in text
management.write_text(text.replace("50         : Degree of soil fertility stress",
                                  "0          : Degree of soil fertility stress"))
subprocess.run(["./aquacrop"], cwd=alternative, check=True, timeout=45)

def seasonal(folder):
    lines = (folder / "OUTP/OttawaPRMseason.OUT").read_text().splitlines()
    header = next(line.split() for line in lines if "RunNr" in line)
    rows = [dict(zip(header, line.split())) for line in lines if line.strip().startswith("Tot(")]
    return [{key: row[key] for key in ("RunNr", "FertStr", "BioMass", "Y(dry)")} for row in rows]

result = {"engine": "official AquaCrop 7.3, release v7.3_typofix",
          "referenceChecks": checks,
          "syntheticFertilityDiagnostic": {"stress50": seasonal(test), "stress0": seasonal(alternative)},
          "scope": "Software execution and mechanism check on bundled Ottawa alfalfa example; not field yield validation."}
(ROOT / "official_reference_replayed.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
