'use client';

import {useT} from '../../src/i18n/useT';
import {useEffect, useState} from 'react';
import {Download, Database} from 'lucide-react';
import {CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis} from 'recharts';
import {propertyLabels} from './ood-results';
import {downloadJSON} from './ood-download';

type Observation = {
  id: string; gravity_g: number; oxygen_pct: number; pressure_kpa: number;
  airflow_cm_s: number; temperature_k: number | null; observed: number; measurement_sd: number | null;
  source: string; citation: string; reviewed: boolean; provenance: string; leakage_group: string;
};
type Preview = {
  gravity_g: number; held_out_n: number; remaining_before_group_exclusion: number;
  related_rows_removed: number; remaining_training_n: number; remaining_gravity_levels: number[];
  excluded_groups: string[]; data_split_eligible: boolean; validation_allowed: boolean; reasons: string[];
};
type ObservedOutput = {
  unit: string; observations: Observation[]; fold_preview: Preview | null;
  by_gravity: {gravity_g: number; observations: number; reviewed: number}[];
};
type Evidence = {
  status: string; reason: string | null; dataset_sha256: string | null; model_fitted: false;
  cohort_observations: number; dependency_groups: number; outputs: Record<string, ObservedOutput>;
  gravity_note: string | null; limitations: string[];
};
type Props = {
  cohort: {fuel: string; configuration: string; temperature_available: boolean};
  gravity: number | null; dataMode: 'reviewed' | 'exploratory'; token: string; observationsOnly?: boolean;
};
const format = (value: number) => new Intl.NumberFormat('en', {maximumSignificantDigits: 4}).format(value);
const colors = ['#739fca', '#8eb49f', '#c3a0d1', '#d0b087'];

export default function OODEvidence({cohort, gravity, dataMode, token, observationsOnly = false}: Props) {
  const t = useT();

  const [loaded, setLoaded] = useState<{key: string; token: string; report: Evidence} | null>(null);
  const [error, setError] = useState('');
  const [property, setProperty] = useState('');
  const [showAll, setShowAll] = useState(false);
  const requestBody = JSON.stringify({fuel: cohort.fuel, configuration: cohort.configuration,
    temperature_available: cohort.temperature_available, data_mode: dataMode, gravity_g: gravity});
  const report = loaded?.key === requestBody && loaded.token === token ? loaded.report : null;

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setShowAll(false);
    fetch('/api/ood/evidence', {method: 'POST', signal: controller.signal,
      headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})}, body: requestBody})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error?.message || 'Could not load observed evidence');
        return data as Evidence;
      })
      .then(data => {if (!controller.signal.aborted) setLoaded({key: requestBody, token, report: data});})
      .catch(reason => {if (!controller.signal.aborted) setError(String(reason));});
    return () => controller.abort();
  }, [requestBody, token]);

  const properties = Object.keys(report?.outputs || {});
  const selectedProperty = properties.includes(property) ? property : properties[0];
  const output = report?.outputs[selectedProperty];
  const preview = output?.fold_preview;
  const selectedRows = output?.observations.filter(row => gravity == null || row.gravity_g === gravity) || [];
  const shownRows = showAll ? selectedRows : selectedRows.slice(0, 15);

  return <details className="ood-evidence" open>
    <summary><Database size={16}/> {" "}{t("Observed evidence & validation readiness")}{" "}</summary>
    {error && <p role="alert">{t(error)}</p>}
    {!report && !error && <p role="status">{" "}{t("Loading source-linked observations…")}{" "}</p>}
    {report && <>
      <p>{t(report.cohort_observations)} {" "}{t("observations in this fuel/configuration cohort ·")}{" "}{t(report.dependency_groups)} {" "}{t("dependency groups. This panel inspects recorded measurements and exclusion rules; it does not fit a model or compute validation errors.")}{" "}</p>
      {report.reason && <p>{t(report.reason)}</p>}
      {!!properties.length && <>
        {observationsOnly && <section className="ood-measured-results" aria-label={t("Measured results · not predictions")}>
          <h4>{" "}{t("Measured results · not predictions")}{" "}</h4>
          <p>{" "}{t("These are recorded values for this experimental configuration, at the conditions listed with each measurement. They do not change when you adjust the target gravity, oxygen, pressure or airflow above. A prediction at those target conditions is unavailable.")}{" "}</p>
          <div className="ood-results">{Object.entries(report.outputs).map(([name, measured]) => <article className="ood-estimate" key={name} aria-label={`Measured ${propertyLabels[name]}`}>
            <span className="eyebrow">{" "}{t("MEASURED ·")}{" "}{t(measured.observations.length)} {" "}{t("OBSERVATIONS")}{" "}</span>
            <h4>{t(propertyLabels[name])}</h4>
            {measured.observations.slice(0, 5).map(row => <div className="ood-measured-row" key={row.id}>
              <strong className="ood-estimate-value">{t(format(row.observed))} <small>{t(measured.unit)}</small></strong>
              <p>{t(format(row.gravity_g))} g · {t(format(row.oxygen_pct))}% O₂ · {t(format(row.pressure_kpa))} {" "}{t("kPa ·")}{" "}{t(format(row.airflow_cm_s))} {" "}{t("cm/s")}{" "}</p>
              <span className="tag neutral">{t(row.reviewed ? 'Reviewed observation' : 'Transcription pending scientific review')}</span>
              <details><summary>{" "}{t("Source ·")}{" "}{t(row.id)}</summary><p>{t(row.citation)}</p></details>
            </div>)}
            {measured.observations.length > 5 && <p>{" "}{t("First 5 measurements shown; inspect all")}{" "}{t(measured.observations.length)} {" "}{t("in the source-linked table below.")}{" "}</p>}
          </article>)}</div>
        </section>}
        <div className="ood-result-toolbar"><label>{" "}{t("Observed property")}{" "}<select value={selectedProperty} onChange={event => {setProperty(event.target.value); setShowAll(false);}}>
          {properties.map(key => <option key={key} value={key}>{t(propertyLabels[key])}</option>)}
        </select></label><button type="button" className="button secondary" onClick={() => downloadJSON('ood-observed-evidence.json', report)}><Download size={14}/> {" "}{t("Export observed evidence")}{" "}</button></div>
        <div className="ood-gravity-counts">{output?.by_gravity.map(level => <div key={level.gravity_g} className={gravity === level.gravity_g ? 'selected' : ''}>
          <strong>{t(level.gravity_g)} g</strong><span>{t(level.observations)} {" "}{t("measured rows")}{" "}</span><small>{t(level.reviewed)} {" "}{t("reviewed ·")}{" "}{t(level.observations - level.reviewed)} {" "}{t("pending")}{" "}</small>
        </div>)}</div>
        {report.gravity_note && <p className="small-note">{t(report.gravity_note)}</p>}
        <h4>{" "}{t("Observed")}{" "}{t(propertyLabels[selectedProperty]?.toLowerCase())} {" "}{t("versus oxygen")}{" "}</h4>
        <p>{" "}{t("Each point uses its own recorded pressure, airflow and temperature. This plot does not isolate an oxygen effect. Repeated points may overlap; every row is retained in the table.")}{" "}</p>
        <div className="ood-evidence-chart"><ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{top: 12, right: 22, bottom: 25, left: 15}}>
            <CartesianGrid stroke="#283341"/>
            <XAxis dataKey="oxygen_pct" type="number" name="Oxygen" unit="%" label={{value: t('Recorded oxygen (%)'), position: 'bottom'}}/>
            <YAxis dataKey="observed" type="number" name={t('Observed')} unit={` ${output?.unit}`} domain={[0, 'auto']} tickFormatter={format}/>
            <Tooltip/><Legend verticalAlign="top"/>
            {output?.by_gravity.map((level, index) => <Scatter key={level.gravity_g}
              name={`${level.gravity_g} g${gravity === level.gravity_g ? ' · selected' : ''}`}
              data={output.observations.filter(row => row.gravity_g === level.gravity_g)}
              fill={gravity === level.gravity_g ? '#f38b55' : colors[index % colors.length]} isAnimationActive={false}/>) }
          </ScatterChart>
        </ResponsiveContainer></div>
        {preview ? <div className="ood-fold-preview">
          <h4>{" "}{t("What happens if")}{" "}{t(preview.gravity_g)} {" "}{t("g is held out?")}{" "}</h4>
          <div className="ood-split-stages">
            <div><strong>{t(preview.held_out_n)}</strong><span>{" "}{t("rows held out")}{" "}</span></div>
            <div><strong>{t(preview.remaining_before_group_exclusion)}</strong><span>{" "}{t("rows at other gravities")}{" "}</span></div>
            <div><strong>{t(preview.remaining_training_n)}</strong><span>{" "}{t("rows after dependency exclusions")}{" "}</span></div>
          </div>
          <p><span className="tag">{t(preview.validation_allowed ? 'Data split eligible for validation' : 'Scientific comparison unavailable')}</span></p>
          {preview.reasons.length > 0 && <ul>{preview.reasons.map(reason => <li key={reason}>{t(reason)}</li>)}</ul>}
          <p>{" "}{t("Remaining training gravity levels:")}{" "}{t(preview.remaining_gravity_levels.length ? preview.remaining_gravity_levels.join(', ') + ' g' : 'none')}.</p>
          <details><summary>{" "}{t("Dependency groups excluded with the held-out rows")}{" "}</summary><ul>{preview.excluded_groups.map(group => <li key={group}>{t(group)}</li>)}</ul></details>
          {!preview.validation_allowed && <div className="ood-next-evidence"><strong>{" "}{t("What would enable this comparison?")}{" "}</strong><ul>
            {dataMode === 'exploratory' && <li>{" "}{t("Review the transcribed measurements before using reviewed-mode validation.")}{" "}</li>}
            {preview.related_rows_removed > 0 && <li>{" "}{t("Provide compatible observations from genuinely independent runs or campaigns. Renaming a dependency group does not make it independent.")}{" "}</li>}
            {output && output.by_gravity.length < 3 && <li>{" "}{t("This protocol needs observations at another gravity so two training levels can remain after one is held out.")}{" "}</li>}
            {preview.remaining_training_n < 3 && <li>{" "}{t("Retain at least three training rows without held-out group overlap; this software minimum does not establish scientific sufficiency.")}{" "}</li>}
          </ul></div>}
        </div> : <p className="ood-warning">{t(observationsOnly ? 'Measured results are available. Predicting across gravity requires at least three compatible observations spanning two gravity levels per property; this configuration does not meet that minimum.' : 'Choose a gravity above to inspect its measurements and preview the leakage-safe holdout split.')}</p>}
        <details className="ood-measurement-table" open><summary>{" "}{t("Source-linked measurement table ·")}{" "}{t(selectedRows.length)} {" "}{t("rows")}{" "}{t(gravity == null ? ' across all gravities' : ` at ${gravity} g`)}</summary>
          <div className="ood-table-scroll"><table><caption>{" "}{t("Observed")}{" "}{t(propertyLabels[selectedProperty]?.toLowerCase())} ({t(output?.unit)}{" "}{t(") · recorded conditions, not predictions")}{" "}</caption>
            <thead><tr><th scope="col">{" "}{t("Row / source")}{" "}</th><th scope="col">{" "}{t("Gravity (g)")}{" "}</th><th scope="col">{" "}{t("Oxygen (%)")}{" "}</th><th scope="col">{" "}{t("Pressure (kPa)")}{" "}</th><th scope="col">{" "}{t("Airflow (cm/s)")}{" "}</th><th scope="col">{" "}{t("Observed (")}{" "}{t(output?.unit)})</th><th scope="col">{" "}{t("Measurement SD")}{" "}</th><th scope="col">{" "}{t("Review")}{" "}</th></tr></thead>
            <tbody>{shownRows.map((row, index) => <tr key={`${row.id}-${index}`}>
              <td><details><summary>{t(row.id)}</summary><p>{t(row.citation)}</p><p>{t(row.provenance.replaceAll('_', ' '))} {" "}{t("· dependency group:")}{" "}{t(row.leakage_group)}</p>{row.temperature_k != null && <p>{" "}{t("Initial temperature:")}{" "}{t(row.temperature_k)} K</p>}</details></td>
              <td>{t(format(row.gravity_g))}</td><td>{t(format(row.oxygen_pct))}</td><td>{t(format(row.pressure_kpa))}</td><td>{t(format(row.airflow_cm_s))}</td><td>{t(format(row.observed))}</td><td>{t(row.measurement_sd == null ? 'Unavailable' : `${format(row.measurement_sd)} ${output?.unit}`)}</td><td>{t(row.reviewed ? 'Reviewed' : 'Pending')}</td>
            </tr>)}</tbody>
          </table></div>
          {selectedRows.length > 15 && <button type="button" className="text-button" onClick={() => setShowAll(!showAll)}>{t(showAll ? 'Show first 15 rows' : `Show all ${selectedRows.length} rows`)}</button>}
          {selectedRows.length === 0 && <p>{" "}{t("No measurements for this property at the selected gravity.")}{" "}</p>}
        </details>
        <details><summary>{" "}{t("Inspection limitations")}{" "}</summary><ul>{report.limitations.map(limitation => <li key={limitation}>{t(limitation)}</li>)}</ul><p>{" "}{t("Dataset SHA-256:")}{" "}<small>{t(report.dataset_sha256)}</small></p></details>
      </>}
    </>}
  </details>;
}
