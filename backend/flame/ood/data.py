import hashlib
import math
from pathlib import Path
from .schema import Dataset

DIRECT = {'ground', 'partial_gravity', 'microgravity'}

def load_dataset(path: Path):
    if not path.exists():
        return [], None
    raw = path.read_bytes()
    dataset = Dataset.model_validate_json(raw)
    return dataset.observations, hashlib.sha256(raw).hexdigest()

def cohort_rows(rows, fuel, configuration, temperature_available, exploratory=False):
    return [r for r in rows if (r.reviewed or exploratory) and r.provenance in DIRECT
            and r.fuel == fuel and r.configuration == configuration
            and (r.temperature_k is not None) == temperature_available]


def compatible(rows, query, output=None):
    rows = cohort_rows(rows, query.fuel, query.configuration, query.temperature_k is not None,
                       exploratory=getattr(query, 'data_mode', 'reviewed') == 'exploratory')
    return [r for r in rows if output is None or r.outputs.get(output) is not None]


def features(query):
    from .schema import FEATURES
    return [getattr(query, key) for key in FEATURES] + ([] if query.temperature_k is None else [query.temperature_k])

def gravity_to_g(value, unit):
    if not math.isfinite(value) or value < 0:
        raise ValueError('Gravity must be finite and nonnegative')
    if unit == 'g':
        return value
    if unit == 'm/s2':
        return value / 9.80665
    raise ValueError('Gravity units must be g or m/s2')


def split_gravity(rows, gravity):
    """Exclude all dependencies of the held-out rows, including other gravities."""
    test = [r for r in rows if r.gravity_g == gravity]
    groups = {r.leakage_group for r in test}
    train = [r for r in rows if r.gravity_g != gravity and r.leakage_group not in groups]
    return train, test, groups


def eligible(rows):
    return len(rows) >= 3 and len({r.gravity_g for r in rows}) >= 2


def output_coverage(rows):
    from .schema import OUTPUTS
    coverage = {}
    for output in OUTPUTS:
        measured = [r for r in rows if r.outputs.get(output) is not None]
        levels = sorted({r.gravity_g for r in measured})
        folds = []
        for gravity in levels:
            train, test, _ = split_gravity(measured, gravity)
            folds.append({'gravity_g': gravity, 'eligible': bool(test) and eligible(train),
                          'training_n': len(train), 'test_n': len(test)})
        coverage[output] = {'observations': len(measured), 'gravity_levels': levels,
                            'prediction_eligible': eligible(measured), 'folds': folds}
    return coverage
