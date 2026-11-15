"""A model curve, not new measurements: fit once, predict a fixed gravity grid."""
from importlib.metadata import version as package_version
from .data import compatible, eligible, features, load_dataset
from .schema import OUTPUTS, Query
from .service import WARNING


def gravity_sweep(path, request):
    import numpy as np
    from .models import fit_model, predict_distribution, interval_description, Unavailable
    rows, digest = load_dataset(path)
    reference = Query(**request.model_dump(exclude={'property_name'}), gravity_g=0)
    selected = compatible(rows, reference, request.property_name)
    base = {'dataset_sha256': digest, 'request': request.model_dump(), 'artifact_version': 'ood-sweep-v1',
            'curve_is_model_output': True, 'scientific_validation': 'not_established',
            'training_n': len(selected), 'unit': OUTPUTS[request.property_name],
            'package_versions': {name: package_version(name) for name in ('numpy','scipy','scikit-learn')},
            'warning': ('Exploratory model curve; source transcriptions are pending review. ' if request.data_mode == 'exploratory' else '') + WARNING}
    if not eligible(selected):
        return base | {'status': 'unavailable', 'reason': 'This property needs at least three compatible observations across two gravity levels; no curve is fabricated.', 'points': [], 'observations': []}
    x = [features(r) for r in selected]
    y = [r.outputs[request.property_name] for r in selected]
    try:
        model = fit_model(request.model, x, y, [r.uncertainty.get(request.property_name) for r in selected], output=request.property_name)
    except Unavailable as error:
        return base | {'status':'unavailable','reason':str(error),'points':[],'observations':[]}
    vector = features(reference)
    grid = [i / 1000 for i in range(1001)]
    distribution = predict_distribution(model, [[g] + vector[1:] for g in grid], request.model)
    upper = 100 if request.property_name == 'minimum_oxygen_pct' else np.inf
    points = []
    for i, gravity in enumerate(grid):
        mean, median = distribution.mean[i], distribution.median[i]
        interval = distribution.interval[i] if distribution.interval is not None else None
        valid_interval = interval is not None and np.all(np.isfinite(interval)) and 0 <= interval[0] <= interval[1] <= upper
        points.append({'gravity_g': gravity,
                       'mean': float(mean) if np.isfinite(mean) and 0 <= mean <= upper else None,
                       'median': float(median) if np.isfinite(median) and 0 <= median <= upper else None,
                       'interval': interval.tolist() if valid_interval else None})
    matched = [r for r in selected if features(r)[1:] == vector[1:]]
    outside = [name for i,name in enumerate(['gravity_g','oxygen_pct','pressure_kpa','airflow_cm_s'] + ([] if reference.temperature_k is None else ['temperature_k']))
               if i and not min(v[i] for v in x) <= vector[i] <= max(v[i] for v in x)]
    return base | {'status':'available','reason':None,'points':points,
                   'observations':[{'id':r.experiment_id,'gravity_g':r.gravity_g,'observed':r.outputs[request.property_name],
                                    'source':r.source,'citation':r.citation,'reviewed':r.reviewed,'provenance':r.provenance,
                                    'measurement_sd':r.uncertainty.get(request.property_name)} for r in matched if 0 <= r.gravity_g <= 1],
                   'training_gravity_levels':sorted({r.gravity_g for r in selected}),
                   'matching_conditions_gravity_levels':sorted({r.gravity_g for r in matched}),
                   'outside_features':outside,'target_transform':distribution.transform,
                   'interval_interpretation':interval_description(distribution.transform, distribution.interval is not None),
                   'sources':sorted({r.citation for r in selected}),
                   'gravity_note':'0 g is nominal microgravity where used by the source, not proof of measured zero residual acceleration.',
                   'limitations':['Curve samples are model outputs, never added to the training dataset.',
                                  'Only observations with exactly matching recorded non-gravity conditions are plotted as measurements.',
                                  'Independent validation and calibrated interval coverage have not been established.',
                                  'E-FIELD analogs are excluded, not mapped to equivalent gravity.',
                                  'No most-flammable gravity, oxygen safety threshold or extinction verdict is inferred from this curve.']}
