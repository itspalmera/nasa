import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from .data import features, split_gravity, eligible
from .models import fit_model, predict, Unavailable

def position(gravity, levels):
    if not levels:
        return 'unavailable'
    if gravity in levels:
        return 'measured'
    return 'interpolation' if min(levels) <= gravity <= max(levels) else 'extrapolation'

def metrics(actual, predicted, intervals=None, training_span=0):
    result = {'n': len(actual), 'mae': float(mean_absolute_error(actual, predicted)),
              'rmse': float(np.sqrt(mean_squared_error(actual, predicted))),
              'normalized_mae': float(mean_absolute_error(actual, predicted) / training_span) if training_span else None,
              'r2': float(r2_score(actual, predicted)) if len(actual) >= 2 and np.ptp(actual) > 0 else None,
              'coverage': None, 'interval_width': None}
    if intervals is not None:
        result.update(coverage=float(np.mean((actual >= intervals[:, 0]) & (actual <= intervals[:, 1]))),
                      interval_width=float(np.mean(intervals[:, 1] - intervals[:, 0])))
    return result

def evaluate(rows, output, name, holdout=None):
    rows = [r for r in rows if r.outputs.get(output) is not None]
    folds = []
    levels = sorted({r.gravity_g for r in rows}) if holdout is None else [holdout]
    for gravity in levels:
        train, test, groups = split_gravity(rows, gravity)
        if not test or not eligible(train):
            folds.append({'gravity_g': gravity, 'status': 'unavailable', 'reason': 'Requires held-out observations and at least 3 independent training rows across 2 remaining gravity levels.'})
            continue
        y = [r.outputs[output] for r in train]
        try:
            model = fit_model(name, [features(r) for r in train], y, [r.uncertainty.get(output) for r in train], output=output)
        except Unavailable as error:
            folds.append({'gravity_g': gravity, 'status': 'unavailable', 'reason': str(error)})
            continue
        pred, intervals = predict(model, [features(r) for r in test], name)
        if not np.all(np.isfinite(pred)) or (intervals is not None and not np.all(np.isfinite(intervals))):
            folds.append({'gravity_g': gravity, 'status': 'unavailable', 'reason': 'Numerically unstable predictive distribution; no metrics reported.'})
            continue
        actual = np.array([r.outputs[output] for r in test])
        folds.append({'gravity_g': gravity, 'status': 'evaluated', 'position': position(gravity, {r.gravity_g for r in train}),
                      'training_n': len(train), 'excluded_groups': sorted(groups),
                      'metrics': metrics(actual, pred, intervals, float(np.ptp(y))),
                      'by_source': {source: metrics(actual[idx], pred[idx], intervals[idx] if intervals is not None else None, float(np.ptp(y)))
                                    for source in sorted({r.source for r in test})
                                    for idx in [[i for i, r in enumerate(test) if r.source == source]]},
                      'points': [{'observed': float(a), 'predicted': float(p), 'source': r.source,
                                  'interval': intervals[i].tolist() if intervals is not None else None}
                                 for i, (r, a, p) in enumerate(zip(test, actual, pred))]})
    return folds
