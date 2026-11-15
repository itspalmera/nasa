"""Independent GPs in output-aware transformed space, fitted within each fold."""
from dataclasses import dataclass
import numpy as np
from scipy.special import expit
from scipy.stats import norm
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, ConstantKernel, WhiteKernel
from sklearn.ensemble import HistGradientBoostingRegressor


class Unavailable(ValueError):
    pass


@dataclass
class FittedGP:
    estimator: object
    transform: str
    reference: float = 1.0


@dataclass
class PredictiveDistribution:
    mean: np.ndarray
    median: np.ndarray
    interval: np.ndarray | None
    transform: str


def fit_model(name, x, y, uncertainty=None, output=None):
    if name == 'physics_gpr':
        raise Unavailable('No documented regime-specific physical baseline is supplied. Physics-guided GPR is disabled.')
    y = np.asarray(y, dtype=float)
    if not np.all(np.isfinite(y)):
        raise Unavailable('Targets must be finite')
    if name == 'boosting':
        return make_pipeline(StandardScaler(), HistGradientBoostingRegressor(min_samples_leaf=2, max_iter=100, random_state=0)).fit(x, y)
    if name != 'gpr':
        raise Unavailable('Unknown model')
    sigma = np.array([0.0 if s is None else s for s in uncertainty]) if uncertainty is not None else np.zeros(len(y))
    if sigma.shape != y.shape or np.any(~np.isfinite(sigma)) or np.any(sigma < 0):
        raise Unavailable('Measurement standard deviations must be finite, nonnegative and match target shape')
    transform, reference = 'identity', 1.0
    if output in {'spread_mm_s', 'length_mm', 'temperature_k'}:
        if np.any(y <= 0):
            raise Unavailable('Positive-support GPR requires strictly positive measurements. Zero/extinction needs a separate censored or occurrence model; use Gradient Boosting for this output.')
        transform, reference = 'log', float(np.median(y))
        # Dimensionless log ratio to a training-only reference in the same units.
        target, transformed_sigma = np.log(y) - np.log(reference), sigma / y
    elif output == 'minimum_oxygen_pct':
        if np.any((y <= 0) | (y >= 100)):
            raise Unavailable('Bounded GPR requires oxygen thresholds strictly between 0 and 100%; endpoint observations need a separate boundary model.')
        transform = 'logit'
        target, transformed_sigma = np.log(y) - np.log(100 - y), 100 * sigma / (y * (100 - y))
    else:
        target, transformed_sigma = y, sigma
    # Delta-method measurement variance, then normalize to GP target units.
    scale = float(np.std(target)) or 1.0
    alpha = (transformed_sigma / scale)**2 + 1e-8
    kernel = ConstantKernel(1.0) * Matern(length_scale=np.ones(len(x[0])), nu=1.5) + WhiteKernel(1e-3)
    estimator = make_pipeline(StandardScaler(), GaussianProcessRegressor(
        kernel=kernel, alpha=alpha, normalize_y=True, random_state=0)).fit(x, target)
    return FittedGP(estimator, transform, reference)


def predict_distribution(model, x, name):
    if name != 'gpr':
        mean = model.predict(x)
        return PredictiveDistribution(mean, mean, None, 'identity')
    mu, std = model.estimator.predict(x, return_std=True)
    radius = norm.ppf(.975) * std
    latent_interval = np.column_stack((mu - radius, mu + radius))
    if model.transform == 'log':
        with np.errstate(over='ignore', under='ignore'):
            median = model.reference * np.exp(mu)
            mean = model.reference * np.exp(mu + std**2 / 2)
            interval = model.reference * np.exp(latent_interval)
    elif model.transform == 'logit':
        median, interval = 100 * expit(mu), 100 * expit(latent_interval)
        # Logistic-normal mean: deterministic 40-node Gauss-Hermite quadrature.
        nodes, weights = np.polynomial.hermite.hermgauss(40)
        mean = 100 * np.sum(expit(mu[:, None] + np.sqrt(2) * std[:, None] * nodes) * weights, axis=1) / np.sqrt(np.pi)
    else:
        mean = median = mu
        interval = latent_interval
    return PredictiveDistribution(mean, median, interval, model.transform)


def predict(model, x, name):
    result = predict_distribution(model, x, name)
    return result.mean, result.interval


def interval_description(transform, available=True):
    if not available:
        return 'Unavailable for this output/model; no calibrated interval is supplied.'
    distribution = {'log': 'lognormal', 'logit': 'logistic-normal', 'identity': 'Gaussian'}[transform]
    return (f'Uncalibrated central 95% {distribution} posterior predictive interval, including fitted white noise in transformed target space. '
            'Endpoints are inverse-transformed quantiles, not clipped bounds. This is a model assumption, not demonstrated coverage or a safety range.')
