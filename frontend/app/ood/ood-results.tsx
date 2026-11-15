'use client';

import {useT} from '../../src/i18n/useT';
import {
  CartesianGrid, ErrorBar, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';

export const propertyLabels: Record<string, string> = {
  minimum_oxygen_pct: 'Minimum sustaining oxygen',
  spread_mm_s: 'Flame-spread velocity',
  length_mm: 'Flame length',
  temperature_k: 'Flame temperature',
};
export const modelLabels: Record<string, string> = {
  gpr: 'Standard GPR', boosting: 'Gradient Boosting',
};

type Metrics = {
  n: number; mae: number; rmse: number; normalized_mae: number | null;
  r2: number | null; coverage: number | null; interval_width: number | null;
};
type Point = { observed: number; predicted: number; source: string; interval: [number, number] | null };
type Fold = {
  gravity_g: number; status: string; reason?: string; position?: string;
  training_n?: number; metrics?: Metrics; by_source?: Record<string, Metrics>; points?: Point[];
};
export type Estimate = {
  unit: string; mean?: number | null; median?: number | null; target_transform?: string; interval?: [number, number] | null;
  interval_interpretation?: string; gravity_position?: string; within_marginal_ranges?: boolean;
  training_gravity_levels?: number[]; matching_conditions_gravity_levels?: number[]; joint_domain?: string; sources?: string[]; physical_constraint_warning?: string;
  outside_features?: string[]; training_n?: number; unreviewed_training_n?: number; folds?: Fold[];
};
export type Result = {
  status: string; reason: string | null; model: string; dataset_sha256: string | null;
  results: Record<string, Estimate>; request: Record<string, unknown>;
  data_mode?: 'reviewed' | 'exploratory'; warning?: string; unavailable_outputs?: Record<string, string>;
  artifact_version: string; package_versions: Record<string, string>;
};
const number = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toFixed(3);

const estimateNumber = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  if (Math.abs(value) >= 100000 || (value !== 0 && Math.abs(value) < .01)) return value.toExponential(2);
  return new Intl.NumberFormat('en', {maximumSignificantDigits: 3}).format(value);
};

export function PredictionCard({name, estimate: r}: {name: string; estimate: Estimate}) {
  const t = useT();

  const hasMedian = r.median != null && (r.target_transform === 'log' || r.target_transform === 'logit');
  const position = r.gravity_position === 'interpolation' ? 'Gravity inside observed range' : r.gravity_position === 'extrapolation' ? 'Gravity outside observed range' : 'Gravity represented in data';
  return <article className="ood-estimate">
    {!!r.unreviewed_training_n && <span className="tag">{" "}{t("Exploratory · pending review")}{" "}</span>}
    <span className="eyebrow">{t(propertyLabels[name])}</span>
    <span className="ood-point-label">{t(hasMedian ? 'Posterior median' : 'Model estimate')}</span>
    <div className="ood-estimate-value">{t(estimateNumber(hasMedian ? r.median : r.mean))} <small>{t(r.unit)}</small></div>
    {hasMedian && <p className="small-note">{" "}{t("Posterior mean:")}{" "}{t(estimateNumber(r.mean))} {t(r.unit)}{" "}{t(". The mean can differ from the median for a skewed distribution.")}{" "}</p>}
    <div className="ood-uncertainty"><strong>{t(r.interval ? 'Uncalibrated 95% model interval' : 'Prediction interval unavailable')}</strong>
      {r.interval && <span>{t(r.interval.map(estimateNumber).join(' to '))} {t(r.unit)}</span>}
      <small>{" "}{t("Empirical coverage has not been established. This is not a validated safety range.")}{" "}</small></div>
    <div className="ood-badges"><span className="tag">{t(position)}</span><span className="tag neutral">{t(r.training_n)} {" "}{t("training observations")}{" "}</span></div>
    {r.physical_constraint_warning && <p role="alert">{t(r.physical_constraint_warning)}</p>}
    {r.outside_features?.length ? <p className="ood-warning">{" "}{t("Outside training ranges:")}{" "}{t(r.outside_features.join(', '))}.</p> : <p>{" "}{t("Inputs are within marginal training ranges. Joint support is not established.")}{" "}</p>}
    {r.training_gravity_levels && <p>{" "}{t("Training gravity levels:")}{" "}{t(r.training_gravity_levels.map(estimateNumber).join(', '))} {" "}{t("g. Interpolation describes the gravity axis only.")}{" "}</p>}
    {r.matching_conditions_gravity_levels && <p className="ood-warning">{t(r.matching_conditions_gravity_levels.length >= 2
      ? `Exact matches for the other input conditions exist at ${r.matching_conditions_gravity_levels.join(', ')} g; this does not establish independent validation.`
      : 'No matching set of the other input conditions is observed across two gravity levels. Joint generalization is unvalidated.')}</p>}
    <details><summary>{" "}{t("Uncertainty, sources & limitations")}{" "}</summary>
      <p>{t(r.interval_interpretation)}</p>
      <p>{" "}{t("Reported measurement errors enter GPR through a first-order approximation in transformed target space; this may be inaccurate for large relative errors. Model and domain coverage uncertainty are not separately identified. A calibrated novelty or failure probability is unavailable.")}{" "}</p>
      <p>{" "}{t("This estimate has not itself established independent validation. Conditioning variables express statistical association, not proof of physical causation.")}{" "}</p>
      <ul>{r.sources?.map(source => <li key={source}>{t(source)}</li>)}</ul>
    </details>
  </article>;
}

function ValidationFold({fold: f, unit}: {fold: Fold; unit: string}) {
  const t = useT();

  if (!f.metrics) return <p>{t(f.gravity_g)} g: {t(f.reason)}</p>;
  const points = f.points || [];
  const values = points.flatMap(p => [p.observed, p.predicted, ...(p.interval || [])]);
  const lo = Math.min(...values), hi = Math.max(...values);
  const padding = (hi - lo || Math.abs(lo) || 1) * .1;
  const domain: [number, number] = [lo - padding, hi + padding];
  const intervalPoints = points.filter(p => p.interval).map(p => ({observed: p.observed, predicted: (p.interval![0] + p.interval![1]) / 2, error: (p.interval![1] - p.interval![0]) / 2}));
  return <article className="ood-fold">
    <h4>{t(f.gravity_g)} g · {t(f.position)}</h4>
    <p>{t(f.metrics.n)} {" "}{t("held-out observations ·")}{" "}{t(f.training_n)} {" "}{t("training observations after related groups were excluded.")}{" "}</p>
    <dl className="ood-metrics">
      {Object.entries({MAE: number(f.metrics.mae), RMSE: number(f.metrics.rmse),
        'Normalized MAE': number(f.metrics.normalized_mae), 'R²': number(f.metrics.r2),
        'Interval coverage': f.metrics.coverage == null ? 'Unavailable' : `${(f.metrics.coverage * 100).toFixed(1)}%`,
        'Mean interval width': number(f.metrics.interval_width)}).map(([label, value]) =>
        <div key={label}><dt>{t(label)}</dt><dd>{t(value)}</dd></div>)}
    </dl>
    <p>{" "}{t("Observed versus predicted means (")}{" "}{t(unit)}{" "}{t("). The dashed line represents perfect agreement. Error bars show uncalibrated central model intervals when available; coverage describes this held-out fold only.")}{" "}</p>
    <div className="ood-scatter"><ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{top: 12, right: 24, bottom: 22, left: 12}}>
        <CartesianGrid stroke="#283341"/>
        <XAxis dataKey="observed" type="number" name={t('Observed')} domain={domain} label={{value: `Observed (${unit})`, position: 'bottom'}} tickFormatter={v => Number(v).toPrecision(3)}/>
        <YAxis dataKey="predicted" type="number" name={t('Predicted')} domain={domain} label={{value: `Predicted (${unit})`, angle: -90, position: 'insideLeft'}} tickFormatter={v => Number(v).toPrecision(3)}/>
        <Tooltip/>
        <ReferenceLine segment={[{x: domain[0], y: domain[0]}, {x: domain[1], y: domain[1]}]} stroke="#8497a9" strokeDasharray="4 4"/>
        <Scatter name={t("Model intervals")} data={intervalPoints} fill="transparent" isAnimationActive={false}>
          <ErrorBar dataKey="error" direction="y" stroke="#f3b48f" width={5}/>
        </Scatter>
        <Scatter name={t("Held-out predictions (mean)")} data={points} fill="#f38b55"/>
      </ScatterChart>
    </ResponsiveContainer></div>
    <div className="ood-table-scroll"><table>
      <caption>{" "}{t("Held-out pairs (")}{" "}{t(unit)})</caption>
      <thead><tr><th scope="col">{" "}{t("Source")}{" "}</th><th scope="col">{" "}{t("Observed")}{" "}</th><th scope="col">{" "}{t("Predicted mean")}{" "}</th><th scope="col">{" "}{t("Interval")}{" "}</th></tr></thead>
      <tbody>{points.map((p, i) => <tr key={i}><td>{t(p.source)}</td><td>{t(number(p.observed))}</td><td>{t(number(p.predicted))}</td><td>{t(p.interval?.map(number).join(' to ') || 'Unavailable')}</td></tr>)}</tbody>
    </table></div>
    <details><summary>{" "}{t("Error by source")}{" "}</summary>{Object.entries(f.by_source || {}).map(([source, m]) =>
      <p key={source}>{t(source)}: n={t(m.n)}{" "}{t(", MAE")}{" "}{t(number(m.mae))}{" "}{t(", RMSE")}{" "}{t(number(m.rmse))}{" "}{t(", coverage")}{" "}{t(number(m.coverage))}{" "}{t(", interval width")}{" "}{t(number(m.interval_width))}.</p>)}</details>
  </article>;
}

export function ValidationResults({results}: {results: Result[]}) {
  const t = useT();

  return <div className="ood-validation-results">{results.map(result => <section key={result.model}>
    <h4>{t(modelLabels[result.model])}</h4><p>{t(result.reason)}</p>
    {Object.entries(result.results).map(([key, estimate]) => <div key={key}>
      <h4>{t(propertyLabels[key])} ({t(estimate.unit)})</h4>
      {estimate.folds?.map(fold => <ValidationFold key={fold.gravity_g} fold={fold} unit={estimate.unit}/>)}
    </div>)}
  </section>)}</div>;
}
