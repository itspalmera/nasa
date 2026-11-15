'use client';

import {useT} from '../../src/i18n/useT';
import {useEffect, useMemo, useRef, useState, type PointerEvent} from 'react';
import {Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis} from 'recharts';
import {Download, Wind} from 'lucide-react';
import {downloadJSON} from './ood-download';
import {propertyLabels} from './ood-results';

type Point = {gravity_g: number; median: number | null; mean: number | null; interval: [number, number] | null};
type Measurement = {id: string; gravity_g: number; observed: number; provenance: string; source: string; reviewed: boolean};
type Sweep = {
  status: string; reason: string | null; unit: string; points: Point[]; observations: Measurement[];
  training_n: number; dataset_sha256: string | null; training_gravity_levels?: number[];
  matching_conditions_gravity_levels?: number[]; outside_features?: string[];
  warning: string; interval_interpretation?: string; gravity_note?: string; limitations?: string[];
};
export type CurveConditions = {
  fuel: string; configuration: string; temperature_k: number | null; oxygen_pct: number;
  pressure_kpa: number; airflow_cm_s: number; data_mode: 'reviewed' | 'exploratory'; model: string;
};
type Props = {conditions: CurveConditions | null; properties: string[]; gravity: number; onGravityChange: (value: number) => void;
  onAirflowChange: (value: string) => void; token: string};
const chartMargin = {top:16,right:15,bottom:25,left:5};
const yAxisWidth = 65;
const references = [{name:'Orbit',g:0},{name:'Moon',g:.165},{name:'Mars',g:.38},{name:'Earth',g:1}];
const fmt = (value: number | null | undefined) => value == null ? 'Unavailable' : new Intl.NumberFormat('en', {maximumSignificantDigits:3}).format(value);

export default function OODGravityCurve({conditions, properties, gravity, onGravityChange, onAirflowChange, token}: Props) {
  const t = useT();

  const [property, setProperty] = useState('spread_mm_s');
  const [loaded, setLoaded] = useState<{key:string;token:string;data:Sweep} | null>(null);
  const [error, setError] = useState('');
  const dragging = useRef(false);
  const selectedProperty = properties.includes(property) ? property : properties[0];
  const requestBody = conditions && selectedProperty ? JSON.stringify({...conditions, property_name:selectedProperty}) : '';
  const response = loaded?.key === requestBody && loaded.token === token ? loaded.data : null;
  useEffect(() => {
    setError('');
    if (!requestBody) return;
    const controller = new AbortController();
    fetch('/api/ood/gravity-sweep', {method:'POST', signal:controller.signal,
      headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:requestBody})
      .then(async res => {const body = await res.json(); if (!res.ok) throw Error(body.error?.message || 'Gravity curve unavailable'); return body as Sweep;})
      .then(data => {if (!controller.signal.aborted) setLoaded({key:requestBody,token,data});})
      .catch(reason => {if (!controller.signal.aborted) setError(String(reason));});
    return () => controller.abort();
  }, [requestBody,token]);
  const probabilistic = conditions?.model === 'gpr';
  const point = response?.points?.[Math.round(gravity * 1000)];
  const curve = useMemo(()=>response?.points?.map(p => ({...p, band:p.interval})) || [],[response]);
  const levels = response?.training_gravity_levels || [];
  const outsideGravity = levels.length > 0 && (gravity < Math.min(...levels) || gravity > Math.max(...levels));
  const matching = response?.observations || [];
  const selectedReference = references.find(reference => Math.abs(reference.g-gravity)<.0005);
  function probePointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const left = chartMargin.left + yAxisWidth;
    const width = bounds.width - left - chartMargin.right;
    if (width <= 0) return;
    const value = Math.min(1,Math.max(0,(event.clientX-bounds.left-left)/width));
    onGravityChange(Math.round(value*1000)/1000);
  }
  return <section className="ood-curve" aria-labelledby="gravity-curve-title">
    <div className="ood-curve-heading"><div><span className="eyebrow">{" "}{t("MODEL CURVE · NOT INDEPENDENTLY VALIDATED")}{" "}</span><h4 id="gravity-curve-title">{" "}{t("Explore fire behaviour across gravity")}{" "}</h4>
      <p>{" "}{t("Hold oxygen, pressure, airflow and material fixed. Tap or drag the chart to inspect the model at another gravity.")}{" "}</p></div>
      <span className="tag neutral">{t(conditions?.data_mode === 'exploratory' ? 'Exploratory · pending review' : 'Reviewed inputs · model estimate')}</span></div>
    <div className="ood-curve-toolbar"><div className="ood-property-tabs" role="group" aria-label={t("Gravity curve property")}>
      {['minimum_oxygen_pct',...properties.filter(name=>name!=='minimum_oxygen_pct')].map(name => <button key={name} type="button" aria-pressed={name===selectedProperty}
        disabled={!properties.includes(name)} title={!properties.includes(name)?'Compatible sustaining-oxygen threshold observations are unavailable.':undefined}
        onClick={()=>setProperty(name)}>{t(name==='minimum_oxygen_pct'?'Min. O₂ to burn':propertyLabels[name])}</button>)}</div>
      <div className="ood-property-tabs" role="group" aria-label={t("Airflow condition")}><button type="button" aria-pressed={conditions?.airflow_cm_s===8} disabled={!conditions} onClick={()=>onAirflowChange('8')}><Wind size={13}/> {" "}{t("Fans 8 cm/s")}{" "}</button>
        <button type="button" aria-pressed={conditions?.airflow_cm_s===0} disabled={!conditions} onClick={()=>onAirflowChange('0')}>{" "}{t("Fans off · 0 cm/s")}{" "}</button></div></div>
    {!properties.includes('minimum_oxygen_pct') && <p className="small-note">{" "}{t("Minimum sustaining oxygen is unavailable: this cohort has no compatible threshold observations.")}{" "}</p>}
    <p className="small-note">{" "}{t("Fan buttons set imposed airflow only. Estimates outside recorded airflow coverage are flagged; no ionic-wind equivalence or combustion verdict is assumed.")}{" "}</p>
    {error && <p role="alert">{t(error)}</p>}
    {!requestBody && <p>{" "}{t("Choose a cohort with sufficient observations and valid physical inputs to compute a gravity curve. Observations-only materials remain available in the evidence panel.")}{" "}</p>}
    {requestBody && !response && !error && <p role="status">{" "}{t("Fitting the selected model and computing its gravity response…")}{" "}</p>}
    {response?.reason && <p>{t(response.reason)}</p>}
    {response?.status==='available' && <>
      <div className="ood-curve-grid"><div className="ood-curve-plot-side">
        <div className="ood-curve-reference-labels">{references.map(reference=><button type="button" key={reference.name} onClick={()=>onGravityChange(reference.g)}>{t(reference.name.toUpperCase())}</button>)}</div>
        <div className="ood-curve-chart"
          onPointerDown={event=>{dragging.current=true;event.currentTarget.setPointerCapture(event.pointerId);probePointer(event);}}
          onPointerMove={event=>{if(dragging.current)probePointer(event);}}
          onPointerUp={event=>{dragging.current=false;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
          onPointerCancel={()=>{dragging.current=false;}}>
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={curve} margin={chartMargin}>
            <CartesianGrid stroke="#2a3a50" vertical={false}/>
            <XAxis dataKey="gravity_g" type="number" domain={[0,1]} ticks={[0,.2,.4,.6,.8,1]} tickFormatter={v=>`${v} g`} label={{value:t('Gravitational acceleration (relative g)'),position:'bottom'}}/>
            <YAxis type="number" domain={[0,'auto']} name={t(propertyLabels[selectedProperty])} unit={` ${response.unit}`} tickFormatter={fmt} width={yAxisWidth}/>
            <Tooltip formatter={(value, name)=>[Array.isArray(value)?value.map(v=>fmt(Number(v))).join(' to '):fmt(Number(value)), name]} labelFormatter={label=>`${Number(label).toFixed(3)} g · model grid`}/>
            {response.points.some(p=>p.interval!=null) && <Area dataKey="band" name={t("Uncalibrated 95% model interval")} fill="#83baff" fillOpacity={.19} stroke="none" isAnimationActive={false} connectNulls={false}/>}
            <Line dataKey="median" name={t(probabilistic?'Model median':'Model estimate')} type="linear" stroke="#90c2ff" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false}/>
            {references.map(reference=><ReferenceLine key={reference.name} x={reference.g} stroke="#637386" strokeDasharray="2 5"/>)}
            <Scatter name={t("Reported ground observations · matching conditions")} data={matching.filter(row=>row.provenance==='ground')} dataKey="observed" shape="square" fill="#f4f6fa" isAnimationActive={false}/>
            <Scatter name={t("Reported reduced-gravity observations · matching conditions")} data={matching.filter(row=>row.provenance!=='ground')} dataKey="observed" fill="#b3d9ff" isAnimationActive={false}/>
            <ReferenceLine x={gravity} stroke="#fff" strokeWidth={1.5}/>
            {point?.median!=null && <ReferenceDot x={gravity} y={point.median} r={5} fill="#fff" stroke="#10243b" strokeWidth={2}/>}
          </ComposedChart></ResponsiveContainer>
        </div>
        <label htmlFor="curve-gravity" className="sr-only">{" "}{t("Probe gravity curve")}{" "}</label><input id="curve-gravity" type="range" min="0" max="1" step=".001" value={gravity} onChange={event=>onGravityChange(Number(event.target.value))}/>
        <div className="ood-curve-presets">{references.map(reference=><button type="button" key={reference.name} aria-pressed={selectedReference?.name===reference.name} onClick={()=>onGravityChange(reference.g)}>{t(reference.name.toUpperCase())} {t(reference.g.toFixed(3))}</button>)}</div>
        <div className="ood-curve-legend"><span>━ {t(probabilistic?'Model median':'Model estimate')}</span><span>{" "}{t("▰ Uncalibrated model interval")}{" "}</span><span>{" "}{t("■ Ground observations")}{" "}</span><span>{" "}{t("● Reduced-gravity observations")}{" "}</span></div>
      </div><aside className="ood-curve-readout" aria-live="polite"><span className="eyebrow">{" "}{t("AT")}{" "}{t(gravity.toFixed(3))} G{t(selectedReference?` · ${selectedReference.name.toUpperCase()} REFERENCE`:'')}</span>
        <p>{t(propertyLabels[selectedProperty])}</p><strong className="ood-curve-value">{t(fmt(point?.median))} <small>{t(response.unit)}</small></strong><small>{t(probabilistic?'Posterior median · not a measurement':'Deterministic model estimate · not a measurement')}</small>
        <hr/><p>{" "}{t("Uncalibrated 95% model interval")}{" "}</p><strong>{t(point?.interval?`${point.interval.map(fmt).join(' to ')} ${response.unit}`:'Unavailable for this model/point')}</strong><small>{" "}{t("Empirical coverage has not been independently established.")}{" "}</small>
        {probabilistic && <p>{" "}{t("Posterior mean:")}{" "}{t(fmt(point?.mean))} {t(response.unit)}</p>}<span className="tag">{t(outsideGravity?'Gravity extrapolation':'Gravity inside training range')}</span>
        <p>{t(response.training_n)} {" "}{t("training observations;")}{" "}{t(matching.length)} {" "}{t("match the other recorded conditions exactly.")}{" "}</p>
        {!!response.outside_features?.length && <p className="ood-warning">{" "}{t("Outside recorded ranges:")}{" "}{t(response.outside_features.join(', '))}.</p>}
        <p>{" "}{t("Joint support and independent validation are not established.")}{" "}</p>
      </aside></div>
      <div className="ood-curve-insight"><strong>{" "}{t("Evidence behind this curve")}{" "}</strong><p>{t(matching.length
        ? 'Markers show only source observations matching the current non-gravity inputs; repeated values at one gravity may overlap.'
        : 'No observations exactly match these other input conditions. The curve is a model estimate, not a measured or validated gravity response.')} {" "}{t("The")}{" "}{t(response.points.length)} {" "}{t("curve samples are predictions, not additional training data.")}{" "}</p>
        <p>{t(response.gravity_note)}</p></div>
      <details><summary>{" "}{t("Model uncertainty & source limitations")}{" "}</summary><p>{t(response.interval_interpretation)}</p><p>{t(response.warning)}</p><ul>{response.limitations?.map(value=><li key={value}>{t(value)}</li>)}</ul></details>
      <button type="button" className="button secondary" onClick={()=>downloadJSON('ood-gravity-curve.json',response)}><Download size={13}/> {" "}{t("Export model curve")}{" "}</button>
    </>}
  </section>;
}
