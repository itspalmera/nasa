import importlib.util
from importlib.metadata import version as package_version
from .data import load_dataset, compatible, features, eligible, output_coverage, DIRECT
from .schema import OUTPUTS

WARNING = 'Research exploration only. Unvalidated predictions are insufficient for spacecraft fire-safety certification.'

def cohorts(rows):
    result = []
    for fuel, configuration, temperature_available in sorted({(r.fuel, r.configuration, r.temperature_k is not None) for r in rows}):
        selected = [r for r in rows if (r.fuel, r.configuration, r.temperature_k is not None) == (fuel, configuration, temperature_available)]
        coverage = output_coverage(selected)
        prediction_eligible = any(output['prediction_eligible'] for output in coverage.values())
        fields = ['oxygen_pct', 'pressure_kpa', 'airflow_cm_s'] + (['temperature_k'] if temperature_available else [])
        result.append(dict(fuel=fuel, configuration=configuration, temperature_available=temperature_available,
                           coverage=coverage, prediction_eligible=prediction_eligible,
                           availability='estimates_available' if prediction_eligible else 'observations_only',
                           observed_ranges={field: [min(getattr(r, field) for r in selected), max(getattr(r, field) for r in selected)] for field in fields}))
    return result


def status(path):
    rows, version = load_dataset(path)
    ready = all(importlib.util.find_spec(p) is not None for p in ('numpy', 'scipy', 'sklearn'))
    all_direct = [r for r in rows if r.provenance in DIRECT]
    direct = [r for r in all_direct if r.reviewed]
    return {'schema_version': 1, 'dataset_sha256': version, 'observations': len(rows), 'reviewed_direct_observations': len(direct),
            'unreviewed_observations': sum(not r.reviewed for r in rows),
            'dependencies_ready': ready, 'models': {'gpr': ready, 'boosting': ready, 'physics_gpr': False},
            'outputs': OUTPUTS, 'cohorts': cohorts(direct),
            'exploratory_cohorts': cohorts(all_direct),
            'provenance_counts': {kind: sum(r.provenance == kind for r in rows) for kind in sorted({r.provenance for r in rows})},
            'gravity_levels': sorted({r.gravity_g for r in direct}),
            'reason': None if direct else (f'{len(rows)} observation rows loaded; {sum(not r.reviewed for r in rows)} await scientific review. Unreviewed records are excluded from reviewed-mode training. Exploratory estimates require explicit opt-in.' if rows else 'No reviewed run-level experimental observations supplied. Papers and metadata are not training rows.'),
            'warning': WARNING}

def infer(path, query, validation=False):
    from .models import fit_model, predict_distribution, interval_description, Unavailable
    import numpy as np
    from .evaluation import position, evaluate
    if validation and query.data_mode == 'exploratory':
        raise Unavailable('Scientific validation requires reviewed data. Exploratory mode supports estimates only and never grants review approval.')
    rows, version = load_dataset(path)
    rows = compatible(rows, query)
    if query.model == 'physics_gpr':
        raise Unavailable('Physics baseline unavailable: a cited, applicable regime-specific law and coefficients are required.')
    results = {}
    unavailable_outputs = {}
    for output, unit in OUTPUTS.items():
        selected = [r for r in rows if r.outputs.get(output) is not None]
        if not eligible(selected):
            continue
        if validation:
            results[output] = {'unit': unit, 'folds': evaluate(selected, output, query.model, query.holdout_g)}
            continue
        x = [features(r) for r in selected]
        y = [r.outputs[output] for r in selected]
        try:
            model = fit_model(query.model, x, y, [r.uncertainty.get(output) for r in selected], output=output)
        except Unavailable as error:
            unavailable_outputs[output] = str(error)
            continue
        distribution = predict_distribution(model, [features(query)], query.model)
        mean, intervals = distribution.mean, distribution.interval
        vector = features(query)
        inside = all(min(v[i] for v in x) <= value <= max(v[i] for v in x) for i, value in enumerate(vector))
        upper = 100 if output == 'minimum_oxygen_pct' else np.inf
        physical = np.isfinite(mean[0]) and 0 <= mean[0] <= upper
        median = distribution.median[0]
        valid_median = np.isfinite(median) and 0 <= median <= upper
        valid_interval = intervals is not None and np.all(np.isfinite(intervals[0])) and 0 <= intervals[0, 0] <= intervals[0, 1] <= upper
        matching_gravities = sorted({r.gravity_g for r in selected if features(r)[1:] == vector[1:]})
        results[output] = {'unit': unit, 'mean': float(mean[0]) if physical else None,
                           'median': float(median) if valid_median else None,
                           'target_transform': distribution.transform,
                           'physical_constraint_warning': None if physical and valid_median and (intervals is None or valid_interval) else 'Nonfinite or physically invalid model statistics were suppressed; no clipping was applied.',
                           'interval': intervals[0].tolist() if valid_interval else None,
                           'interval_interpretation': interval_description(distribution.transform, valid_interval),
                           'measurement_uncertainty': 'Reported standard deviations enter transformed-space GPR through a first-order delta-method approximation, which may be inaccurate for large relative errors. Missing errors do not establish zero measurement uncertainty.',
                           'gravity_position': position(query.gravity_g, {r.gravity_g for r in selected}),
                           'training_gravity_levels': sorted({r.gravity_g for r in selected}),
                           'matching_conditions_gravity_levels': matching_gravities,
                           'within_marginal_ranges': inside, 'joint_domain': 'Not established by marginal ranges',
                           'novelty_score': None, 'domain_coverage_uncertainty': 'Unavailable',
                           'validation_evidence': 'Unreviewed source transcriptions; no independent validation.' if query.data_mode == 'exploratory' else 'Run grouped LOGO validation; prediction alone is not independent validation.',
                           'reviewed_training_n': sum(r.reviewed for r in selected),
                           'unreviewed_training_n': sum(not r.reviewed for r in selected),
                           'sources': sorted({r.citation for r in selected}), 'training_n': len(selected),
                           'outside_features': [name for i, name in enumerate(['gravity_g', 'oxygen_pct', 'pressure_kpa', 'airflow_cm_s'] + ([] if query.temperature_k is None else ['temperature_k']))
                                                if not min(v[i] for v in x) <= vector[i] <= max(v[i] for v in x)]}
    return {'status': 'available' if results else 'unavailable', 'reason': None if results else ('No compatible output could be fitted; see the per-output model limitations.' if unavailable_outputs else f'Insufficient compatible {query.data_mode}-mode observations: need at least 3 rows across 2 gravity levels per output.'),
            'dataset_sha256': version, 'artifact_version': 'ood-v4', 'data_mode': query.data_mode,
            'scientific_validation': 'not_established',
            'request': query.model_dump(),
            'package_versions': {name: package_version(name) for name in ('numpy', 'scipy', 'scikit-learn')}, 'model': query.model, 'results': results, 'unavailable_outputs': unavailable_outputs,
            'warning': ('Exploratory estimate from source transcriptions pending scientific review. No independent validation or review approval is implied. ' if query.data_mode == 'exploratory' else '') + WARNING}
