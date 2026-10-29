"""Python bridge to the shared TypeScript engine. No duplicate water-balance implementation."""
import json
import subprocess
from pathlib import Path


def repository_root():
    for candidate in (Path(__file__).resolve().parent, *Path(__file__).resolve().parents):
        if (candidate / 'scripts/run-water-plan.mjs').is_file():
            return candidate
    raise FileNotFoundError('Ouvrez ce notebook dans le dépôt AgriPrévision complet.')


def plan_irrigation(config, events=None):
    result = subprocess.run(
        ['node', '--experimental-strip-types', 'scripts/run-water-plan.mjs'],
        cwd=repository_root(), input=json.dumps({'config': config, 'events': events or []}),
        text=True, capture_output=True, timeout=30, check=True,
    )
    return json.loads(result.stdout)
