"""Python bridge to the shared TypeScript engine. No duplicate water-balance implementation."""
import json
import subprocess
from pathlib import Path


def repository_root():
    for candidate in (Path(__file__).resolve().parent, *Path(__file__).resolve().parents):
        if (candidate / 'scripts/run-water-plan.mjs').is_file():
            return candidate
    raise FileNotFoundError('Ouvrez ce notebook dans le dépôt AgriPrévision complet.')


def shared_calculation(payload):
    result = subprocess.run(
        ['node', '--experimental-strip-types', 'scripts/run-water-plan.mjs'],
        cwd=repository_root(), input=json.dumps(payload),
        text=True, capture_output=True, timeout=30, check=True,
    )
    return json.loads(result.stdout)


def plan_irrigation(config, events=None):
    return shared_calculation({'config': config, 'events': events or []})


def crop_catalog():
    return shared_calculation({'action': 'catalog'})


def country_capabilities(country, crop_id=None):
    payload = {'action': 'capabilities', 'country': country}
    if crop_id is not None:
        payload['cropId'] = crop_id
    return shared_calculation(payload)


def apply_crop(config, crop_id, days=None):
    return shared_calculation({'action': 'crop', 'config': config, 'cropId': crop_id, 'days': days})


def fertilization_reference(config, reference_id, context_note, already_kg_ha=None):
    return shared_calculation({'action': 'nutrition', 'config': config, 'referenceId': reference_id,
                               'contextNote': context_note, 'alreadyKgHa': already_kg_ha or []})
