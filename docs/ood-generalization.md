# Gravity generalization: auditable minimum implementation

The repository snapshot contained a literature dashboard, not the gravity prediction chart described in the task. The new panel is additive on Overview; existing research features remain in place. There are **no scientifically approved run-level datasets bundled**. A later [PDF transcription package](../datasets/papers/README.md) contains 91 schema-compatible rows from supplied papers, all pending scientific review, plus a 123-record extraction audit. Run `python scripts/import_paper_observations.py` to merge these into the local dataset without overwriting existing reviews. The importer never grants scientific approval. The papers and extracted document summaries cannot be treated as matched physical observations. No external PSI/BASS-II/SAFFIRE numerical dataset was downloaded for training; the bundled transcription is sourced from the local PDFs. The default view therefore has no estimated curves, experimental markers, or benchmark numbers.

## Run

Install `python -m pip install -e '.[science,test]'`, start the existing FastAPI service, and run the frontend normally. Scientific dependencies are optional for the literature application. The frontend uses the existing Next API proxy and in-memory API token.

Place a reviewed JSON dataset at `<FLAME data_dir>/combustion-observations.json`. The native adapter validates the whole file, with `schema_version: 1` and `observations: []`. Empty observations are a valid unavailable state. An invalid file is rejected, not partially accepted. No automatic inference from literature metadata is performed. Dataset custodians must transcribe or export compatible experimental observations and retain source references. There is no generic PSI conversion because no compatible downloaded file format or measurement table was available for verification.

Each observation requires:

| Field | Meaning / unit |
|---|---|
| experiment_id | Experiment/run identifier |
| source, citation | Source identifier and resolvable citation, including table/page where applicable |
| leakage_group | Shared dependency group across runs/campaigns/sources; use the broadest dependent group |
| provenance | ground, partial_gravity, microgravity, efield_analog, simulation, model_prediction |
| reviewed | Defaults false; scientific custodian must confirm run-level integrity |
| gravity_g | Acceleration / standard gravity (9.80665 m/s²); adapter supports explicit m/s² conversion |
| oxygen_pct | 0–100, percent |
| pressure_kpa | Positive, kPa |
| airflow_cm_s | Nonnegative, cm/s |
| fuel, configuration | Required cohort identifiers; include geometry, mechanism and regime in configuration |
| temperature_k | Positive K or null (explicit missing indicator) |
| outputs | Any subset of minimum_oxygen_pct (%), spread_mm_s (mm/s), length_mm (mm), temperature_k (K); null means missing |
| uncertainty | Optional output → measured standard deviation, in matching units |

Missing required physical conditions are rejected rather than imputed. Missing optional temperature creates a separate cohort. Output absence/null excludes that row for that output only. Observation/Query JSON schemas can be obtained with Pydantic `model_json_schema()`; requests are also in `/api/openapi.json`. NaN/Infinity, unknown fields, negative measurements and unsupported outputs are rejected. Extinction classification is unavailable because no compatible labeled data/model was provided.

## Models, assumptions and uncertainty

* Standard GPR uses a fixed initial Matérn 3/2 covariance plus fitted constant and white-noise kernels. Features and target normalization are fitted using training rows only. Strictly positive speed, length and temperature targets use log(y/reference), where reference is the training median in the same units; oxygen thresholds use logit(y/100). These are support constraints, not a physical baseline. Measurement errors are propagated to transformed space with a first-order delta method and then normalized to the GP target variance. This approximation can be inaccurate for large relative errors. Separate GPs fit each output, without cross-output covariance. Known standard deviations enter the GP diagonal variance. Missing uncertainty does not establish zero measurement error; a numerical jitter is used and white noise is fitted.
* HistGradientBoostingRegressor provides a deterministic comparison baseline. It has no interval estimator here and should not be expected to extrapolate trends.
* Physics-guided GPR is explicitly disabled. No regime-specific cited physical law, baseline coefficients, thermophysical properties, length scale or validated microgravity applicability was available. No arbitrary gravity power law, dimensionless features, or E-FIELD effective-gravity mapping was invented.
* Symbolic regression and correlated multi-task GPs are not implemented.

In the default reviewed mode, only reviewed direct observations are eligible for training; E-FIELD analogs, simulations and model predictions remain labeled in the loader and are excluded. Fuel, geometry/regime configuration, and temperature availability are matched before training. A reviewed flag is an operator attestation, not automatic scientific verification. Input cohorts must still be scientifically reviewed by a domain expert.

GPR uses central 95% posterior quantiles in transformed target space, including fitted WhiteKernel noise, then inverse-transforms both endpoints. Log-target intervals are lognormal and nonnegative; bounded oxygen intervals are logistic-normal and stay in 0–100%. Bounds are **not clipped**. These are **uncalibrated model intervals**, not demonstrated empirical coverage or safety ranges. A positive-support assumption does not establish accurate predictions or scientific validation. Measurement, latent-model and domain-coverage uncertainties are not separately identified; no arbitrary distance-dependent inflation is used.

The API reports the inverse-distribution **mean and median separately**. For log targets, median = reference × exp(mu), mean = reference × exp(mu + variance/2). For bounded oxygen the logistic-normal mean is computed with deterministic 40-node Gauss-Hermite quadrature. The card emphasizes the posterior median and shows the mean separately, with three significant digits. Validation error metrics still use predictive means in the original output units. A very skewed distribution's mean can fall outside its central interval; chart interval bars therefore use their own midpoint instead of assuming symmetry about the prediction.

Exact zero observations for positive-support GPR and endpoint oxygen thresholds need occurrence/censoring or boundary models that are not implemented. Those outputs are explicitly unavailable for that model, rather than shifting targets or silently dropping rows. Other fit-compatible outputs remain available; Gradient Boosting can still fit compatible nonnegative targets without supplying an interval. Numerically nonfinite or physically invalid statistics are suppressed with a warning, never clipped into plausible values.

Measured gravity, numerical interpolation/extrapolation, input marginal coverage and joint OOD status are different concepts. The API reports marginal bounds; the joint supported domain and calibrated novelty/failure probabilities remain unavailable. An unmeasured level inside the observed gravity range is interpolation, without implying validated joint support. All conditioning features enter the estimator but feature dependence does not prove causation.

## Validation and API

* `GET /api/ood/schema`: strict dataset-envelope JSON Schema, including observation fields. The UI also offers an empty dataset template containing no fabricated measurements.
* `GET /api/ood/status`: data/dependency availability, provenance counts/hash, cohorts, per-output measurement counts and fitting eligibility, and cohort-specific gravity folds. Fold eligibility uses the same dependency-group exclusion as evaluation. The UI disables validation for ineligible folds and never offers gravity levels from a different cohort.
* `POST /api/ood/predict`: Query physical inputs plus model (`gpr`, `boosting`, `physics_gpr`). Only outputs with at least three compatible measurements across two gravities are estimated. This minimum is a software eligibility rule, not a scientific sufficiency claim.
* `POST /api/ood/validate`: same Query, optional `holdout_g`; omitted means all gravity levels. For each output, every row at held-out gravity is excluded, along with all rows sharing leakage groups with the test rows. Folds need at least three remaining rows across two gravities. Missing/ineligible folds give reasons. Input oxygen/pressure/airflow do not filter LOGO test observations; evaluation uses each held-out row's recorded conditions within the selected fuel/configuration/temperature-availability cohort.

Each eligible fold includes MAE, RMSE, MAE divided by training target range (null for zero range), R² only with at least two nonconstant test targets, empirical interval coverage/mean width when available, per-source metrics and predicted/observed pairs. The UI compares both baselines for the selected held-out gravity and displays paired values with intervals and a scatter plot. No pooled-only performance claims are made. Sparse single-observation folds cannot establish reliable calibration. Leakage-group quality is the dataset custodian's responsibility.

LOGO is implemented; leave-one-condition-out, nested grouped kernel selection, alternative kernels and calibration are deferred. The initial Matérn kernel is not claimed to have won model selection. There are no scientific validation results until reviewed datasets are supplied. Test fixtures are explicitly synthetic software tests, excluded from dashboard datasets.

## Reproducibility and limits

Models fit on demand and are not deserialized from untrusted pickle files. Responses identify pipeline version `ood-v4`, SHA-256 of the complete source dataset, the exact validated input request, and installed NumPy/SciPy/scikit-learn versions. Prediction and validation reports can be exported as JSON from the panel. Persisted fitted model artifacts, training job scheduling, calibrated domain detection and physical-baseline registration are not yet implemented. Small local datasets are intended; large production datasets require offline training and bounded serving workloads.

References for implemented methods: Rasmussen & Williams, *Gaussian Processes for Machine Learning*, MIT Press (2006), https://gaussianprocess.org/gpml/ ; scikit-learn Gaussian process regression https://scikit-learn.org/stable/modules/gaussian_process.html and histogram gradient boosting https://scikit-learn.org/stable/modules/ensemble.html#histogram-based-gradient-boosting . Dataset discovery starting point: NASA Physical Sciences Informatics https://psi.nasa.gov/ . These are method/discovery references, not evidence that any NASA observations were loaded.

This module supports research exploration. Unvalidated estimates are insufficient for spacecraft fire-safety certification.

## Interface behavior

Changing conditions cancels outstanding requests and clears previous results, so late responses cannot overwrite estimates for the new inputs. Both fitting and validation apply the same browser input validity checks. The observed/predicted plot uses common axis bounds, a perfect-agreement reference line and available interval bars; the underlying pairs remain accessible in a table. Coverage is empirical per held-out fold and does not imply calibrated intervals. Empty-data onboarding, per-property availability, detailed provenance and result exports remain available without inventing observations.

### Regression checks

Run `pytest` with the science/test extras installed. Browser regression tests use synthetic API fixtures only: after `npm ci` and `npm run build` in `frontend`, install Chromium with `npx playwright install chromium`, then run `npm run test:ood-ui`. To use an existing system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path. Desktop and mobile tests cover empty-state downloads, cohort-specific gravity choices, leakage-group eligibility, physical input validation, cancellation of stale predictions, provenance exports, and both models' held-out comparison charts and tables. These checks do not establish experimental model accuracy.

## Explicit exploratory estimates

The default `data_mode` is `reviewed` and retains the approval gate. `POST /api/ood/predict` also accepts `data_mode: "exploratory"` after the user explicitly checks **Use extracted observations for exploratory estimates**. This fits on compatible direct experimental transcriptions, including unreviewed records. E-FIELD analogs, simulations, model predictions, other fuels and incompatible configurations remain excluded. No record's `reviewed` flag is modified.

Status exposes separate `cohorts` (reviewed) and `exploratory_cohorts` with per-output eligibility. On explicit opt-in the UI selects the first cohort with enough observations, rather than a sparse material that cannot fit a model. Unreviewed predictions carry visible exploratory warnings, per-output reviewed/unreviewed training counts, `data_mode`, and `scientific_validation: "not_established"` in the API/export. The same posterior uncertainty limitations apply. This is exploratory fitting, not approval of the source transcription, calibration or independent validation.

`POST /api/ood/validate` rejects exploratory requests; the UI disables held-out validation in this mode. Reviewed data still require independent dependency groups and eligible LOGO folds. The bundled NASA transcription has only two nominal gravity levels and one conservative campaign group, so it cannot establish independent LOGO evidence. The expanded PMMA groups now contain both nominal gravity levels (12 values at 1 mm and 8 at 0.5 mm), permitting exploratory velocity estimates. SIBAL groups remain observations-only because they contain one nominal gravity level.

### Gravity interpolation versus matched conditions

Prediction responses include `training_gravity_levels` and `matching_conditions_gravity_levels` per output. The latter lists exact recorded matches on all non-gravity numerical inputs within the selected cohort; it is not a calibrated novelty score or a continuous joint-domain estimator. Cards state when no matched set spans two gravity levels, even if every input is inside its marginal range. An unobserved gravity inside the numerical range is interpolation on that axis only. The bundled nominal 0 g condition is not an accelerometer reading of exactly zero residual gravity.

## Observed evidence and validation readiness

`POST /api/ood/evidence` accepts only cohort-identifying inputs (`fuel`, `configuration`, `temperature_available`, `data_mode`) and optional `gravity_g` to preview a holdout. It does not need prediction inputs, scientific fitting dependencies, or a trained model. It uses the same provenance/cohort filters and leakage-group split as inference/evaluation. Reviewed mode excludes pending records; exploratory inspection preserves their review state. Existing authentication and origin guards apply.

The response exposes source-linked observed values and recorded conditions, measurement standard deviations when reported, counts by gravity, the source-data hash, and a fold preview. That preview counts held-out rows, remaining rows at other gravities, related rows also excluded, the final training rows/gravity levels, and specific reasons validation is unavailable. It never returns invented predictions, performance metrics or calibrated uncertainty. `model_fitted` is always false. An eligible data split is a prerequisite, not proof that a particular model will fit successfully or generalize.

The gravity selector stays usable for inspection in exploratory mode. **Observed evidence & validation readiness** opens by default and contains an observed-versus-oxygen plot, per-gravity counts, an expandable source-linked measurement table, JSON export and an explanation of what additional independent evidence is required. Selecting a gravity highlights its points and filters the table; the plot retains the other observed levels for context. Observations may have different pressures, flows or temperatures, and repeated markers can overlap. The plot is not a controlled oxygen-effect comparison. No missing standard deviation is shown as zero, and nominal microgravity is labeled explicitly.

Inspecting a different holdout clears stale validation results but preserves the current prediction, since this selection does not change the prediction's physical inputs. Evidence requests cancel on cohort, mode, gravity or token changes so a late response cannot replace a newer inspection. JSON exports retain the dataset hash and exact inspection query. The measurements are still pending scientific review when so indicated; visualizing them does not approve them.

## Expanded materials and configuration coverage

The versioned paper bundle contains 91 observations across six exact material/configuration cohorts. Four support exploratory fits under the current eligibility rule: Kimwipes sheets at 0.076/0.152 mm, and clear PMMA rods at 0.5/1 mm. PMMA includes 20 plotted averages (two textual anchors plus 18 additional vector-digitized marker values), split into 8 and 12 rows by diameter. A source-pinned adapter and coordinate sidecar document the axes and marker matching; no intermediate points along smoothed curves, original repeats or Gaussian measurement errors were invented.

Three SIBAL concurrent-spread records complete two observations-only cohorts (406 mm and 50 mm width). Their nominal pressure/initial oxygen values are explicitly supplied by the experimental conditions table in another local PDF, with a supplementary hash checked during import. Numerical simulation outputs are excluded. The SIBAL data only cover nominal microgravity, so adding these options does not enable unsupported gravity regression or LOGO validation. Silicone ground controls still lack linked pressure/oxygen values and are not enabled.

Status includes per-cohort `prediction_eligible`, `availability`, and recorded numerical input ranges. Material options identify estimates versus observations-only; fixed inputs such as PMMA oxygen (21%) and pressure (101.325 kPa) remain visible. The existing domain warnings still apply to queries outside those ranges. Re-running the importer adds 21 rows to the original 70, without duplicating original text anchors, changing existing local records/reviews, or approving new data.

## Interactive gravity response

`POST /api/ood/gravity-sweep` holds the cohort/environment inputs fixed, fits the chosen supported output once, and evaluates 1,001 model samples from 0 to 1 relative g. The client probes that computed grid at 0.001 g resolution without fitting again when gravity alone changes. Orbit, Moon (0.165 g), Mars (0.38 g) and Earth controls share the same selected gravity as the existing inputs. Direct pointer coordinates use the chart's axis/margin geometry, and a keyboard-accessible range input is also provided.

The figure separates the model median line, the model's inverse-transformed central interval and matching source observations. Square markers represent ground observations; circles represent other direct gravity observations. Only exactly matching non-gravity inputs are overlaid as measurements. Curves and their exports carry `curve_is_model_output: true`, a dataset hash and `scientific_validation: "not_established"`; grid points never enter the training file. Positive-target support, missing intervals for Gradient Boosting, numerical suppression and the exploratory opt-in remain in force. The chart does not imply a monotone relation or a guarantee that predictions stay between measured endpoint values.

Airflow shortcuts set 8 or 0 cm/s rather than applying a separate fan physics law. Inputs outside recorded ranges remain visibly flagged. The minimum-sustaining-oxygen tab is disabled for cohorts without compatible threshold observations. No E-FIELD equivalent-gravity markers, arbitrary distance-dependent uncertainty band, inferred most-flammable gravity, extinction verdict or spacecraft certification claim is fabricated to match a design reference.

The acquisition/conversion workflow and the precise reason independent validation remains unavailable are described in [PDF acquisition and validation](pdf-acquisition-and-validation.md). That document also records the development environment's blocked public-source access and the distinction between source JSON, model predictions and actual independent experimental observations.
