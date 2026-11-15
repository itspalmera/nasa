"""Distribution, boundary and unit invariants; not experimental benchmarks."""
import json
from types import SimpleNamespace
import numpy as np
import pytest
from scipy.integrate import quad
from scipy.special import expit
from scipy.stats import norm
from flame.ood.models import FittedGP, fit_model, predict_distribution, Unavailable
from flame.ood.service import infer
from test_ood import query, row


def fixed_gp(mu, sigma, transform, reference=1):
    estimator = SimpleNamespace(predict=lambda x, return_std: (np.full(len(x), mu), np.full(len(x), sigma)))
    return FittedGP(estimator, transform, reference)


def test_log_posterior_has_correct_mean_median_and_quantiles_without_clipping():
    result = predict_distribution(fixed_gp(0, 1, 'log', reference=10), [[0]], 'gpr')
    assert result.median[0] == 10
    assert result.mean[0] == pytest.approx(10 * np.exp(.5))
    assert result.interval[0, 0] == pytest.approx(10 * np.exp(norm.ppf(.025)))
    assert result.interval[0, 1] == pytest.approx(10 * np.exp(norm.ppf(.975)))
    assert result.interval[0, 0] > 0
    # A skewed distribution's mean can legitimately exceed its central interval.
    wide = predict_distribution(fixed_gp(0, 5, 'log'), [[0]], 'gpr')
    assert wide.mean[0] > wide.interval[0, 1]
    assert wide.interval[0, 0] < wide.median[0] < wide.interval[0, 1]


def test_logistic_normal_mean_matches_independent_integration_and_stays_bounded():
    result = predict_distribution(fixed_gp(1, .7, 'logit'), [[0]], 'gpr')
    expected, _ = quad(lambda z: 100 * expit(1 + .7*z) * norm.pdf(z), -10, 10)
    assert result.mean[0] == pytest.approx(expected, abs=1e-6)
    assert result.median[0] == pytest.approx(100 * expit(1))
    assert 0 < result.interval[0, 0] < result.median[0] < result.interval[0, 1] < 100


@pytest.mark.parametrize('output', ['spread_mm_s', 'length_mm', 'temperature_k'])
def test_positive_gp_predictions_and_intervals_remain_positive_beyond_training(output):
    model = fit_model('gpr', [[0], [.2], [.5], [1]], [1, 2, 4, 8], output=output)
    result = predict_distribution(model, [[-10], [.38], [10]], 'gpr')
    assert np.all(np.isfinite(result.mean)) and np.all(result.mean > 0)
    assert np.all(result.interval > 0)
    assert np.all(result.interval[:, 0] <= result.median)
    assert np.all(result.median <= result.interval[:, 1])


def test_log_gp_respects_output_unit_scaling_including_measurement_errors():
    x, y, errors = [[0], [.2], [.5], [1]], np.array([1., 2., 4., 8.]), np.array([.1, .1, .2, .3])
    original = predict_distribution(fit_model('gpr', x, y, errors, output='length_mm'), [[.38]], 'gpr')
    scaled = predict_distribution(fit_model('gpr', x, y*10, errors*10, output='length_mm'), [[.38]], 'gpr')
    np.testing.assert_allclose(scaled.mean, original.mean*10, rtol=1e-4)
    np.testing.assert_allclose(scaled.interval, original.interval*10, rtol=1e-4)


def test_zero_targets_are_not_silently_shifted_or_dropped_and_other_outputs_remain_available(tmp_path):
    path = tmp_path/'observations.json'
    rows = [row(g, str(i), outputs={'spread_mm_s': 0 if i == 0 else 1+g, 'length_mm': 1+g}).model_dump() for i,g in enumerate([0,.2,1])]
    path.write_text(json.dumps({'schema_version': 1, 'observations': rows}))
    result = infer(path, query())
    assert set(result['results']) == {'length_mm'}
    assert 'strictly positive' in result['unavailable_outputs']['spread_mm_s']
    assert result['results']['length_mm']['target_transform'] == 'log'
    assert result['results']['length_mm']['training_gravity_levels'] == [0, .2, 1]
    assert result['results']['length_mm']['matching_conditions_gravity_levels'] == [0, .2, 1]
    assert 'spread_mm_s' in infer(path, query(model='boosting'))['results']


@pytest.mark.parametrize('values', [[0, 10, 20], [10, 20, 100]])
def test_oxygen_endpoints_require_an_explicit_boundary_model(values):
    with pytest.raises(Unavailable, match='strictly between'):
        fit_model('gpr', [[0],[.5],[1]], values, output='minimum_oxygen_pct')
