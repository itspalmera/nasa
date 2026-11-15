'use client';

import {useT} from '../../src/i18n/useT';
import {useEffect, useRef, useState} from 'react';
import {Download} from 'lucide-react';
import {useScenario} from '../../src/context/ScenarioContext';
import {MATERIALS_CATALOG} from '../../src/data/scenarioPresets';
import OODEvidence from './ood-evidence';
import OODGravityCurve, {type CurveConditions} from './ood-gravity-curve';
import {downloadJSON} from './ood-download';
import {modelLabels, PredictionCard, propertyLabels, type Result} from './ood-results';

type Coverage = {
  observations: number; gravity_levels: number[]; prediction_eligible: boolean;
  folds: {gravity_g: number; eligible: boolean; training_n: number; test_n: number}[];
};
type Cohort = {fuel: string; configuration: string; temperature_available: boolean; coverage: Record<string, Coverage>; availability?: string; observed_ranges?: Record<string, [number, number]>};
type Status = {
  reason: string | null; reviewed_direct_observations: number; dependencies_ready: boolean;
  observations?: number; unreviewed_observations?: number; cohorts: Cohort[]; exploratory_cohorts?: Cohort[]; dataset_sha256: string | null; provenance_counts: Record<string, number>;
};

export type InitialConditions = {material?: string; gravity: number; oxygen: number; pressureKpa: number; airflow: number};

export default function OODPanel({token, initialConditions}: {token: string; initialConditions?: InitialConditions}) {
  const t = useT();

  const {lang, selectedMaterial, setSelectedMaterial} = useScenario();
  const en = lang === 'en';
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gravity, setGravity] = useState(initialConditions?.gravity ?? .38);
  const [oxygen, setOxygen] = useState(String(initialConditions?.oxygen ?? 21));
  const [pressure, setPressure] = useState(String(initialConditions ? Number(initialConditions.pressureKpa.toFixed(4)) : 101.325));
  const [airflow, setAirflow] = useState(String(initialConditions?.airflow ?? 0));
  const [temperature, setTemperature] = useState('');
  const [cohort, setCohort] = useState('0');
  const [model, setModel] = useState('gpr');
  const [exploratory, setExploratory] = useState(false);
  const [showCurve, setShowCurve] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const headers = {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})};

  useEffect(() => {
    const controller = new AbortController();
    setStatus(null);
    setError('');
    fetch('/api/ood/status', {signal: controller.signal, headers: token ? {Authorization: `Bearer ${token}`} : {}})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error?.message || 'Scientific service unavailable');
        return data;
      })
      .then(data => {if (!controller.signal.aborted) setStatus(data);})
      .catch(reason => {if (!controller.signal.aborted) setError(String(reason));});
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    activeRequest.current?.abort();
    setBusy(false);
    setError('');
    setResult(null);

    return () => activeRequest.current?.abort();
  }, [gravity, oxygen, pressure, airflow, temperature, cohort, model, token, exploratory, selectedMaterial]);

  useEffect(() => { setShowCurve(false); }, [oxygen, pressure, airflow, temperature, cohort, model, token, exploratory, selectedMaterial]);

  const sourceOptions = [...(status?.cohorts || []), ...(status?.exploratory_cohorts || [])].filter(item => Object.values(item.coverage).some(output => output.prediction_eligible));
  const cohortOptions = sourceOptions.filter((item, index) =>
    Object.values(item.coverage).some(output => output.prediction_eligible) &&
    item.fuel.toLowerCase().includes(selectedMaterial) &&
    sourceOptions.findIndex(other => other.fuel === item.fuel && other.configuration === item.configuration && other.temperature_available === item.temperature_available) === index
  );
  const selected = cohortOptions[Number(cohort)] || cohortOptions[0];
  const coverage = selected?.coverage || {};
  const availableProperties = Object.values(coverage).some(value => value.prediction_eligible);
  const reviewed = !!selected && !!status?.cohorts.some(item => item.fuel === selected.fuel && item.configuration === selected.configuration && item.temperature_available === selected.temperature_available && Object.values(item.coverage).some(output => output.prediction_eligible));
  const needsOptIn = !reviewed && !exploratory;
  const ready = !needsOptIn && !!selected && !!status?.dependencies_ready && availableProperties && (!selected.temperature_available || !!temperature);

  const validCurveInputs = oxygen.trim() !== '' && pressure.trim() !== '' && airflow.trim() !== '' &&
    [Number(oxygen),Number(pressure),Number(airflow)].every(Number.isFinite) && Number(oxygen)>=0 && Number(oxygen)<=100 && Number(pressure)>=.001 && Number(airflow)>=0 &&
    (!selected?.temperature_available || (temperature.trim() !== '' && Number.isFinite(Number(temperature)) && Number(temperature)>=1));
  const curveConditions: CurveConditions | null = ready && selected && validCurveInputs ? {
    fuel:selected.fuel, configuration:selected.configuration, temperature_k:selected.temperature_available?Number(temperature):null,
    oxygen_pct:Number(oxygen),pressure_kpa:Number(pressure),airflow_cm_s:Number(airflow), data_mode:exploratory?'exploratory':'reviewed',model,
  } : null;
  const curveProperties = Object.entries(coverage).filter(([,value])=>value.prediction_eligible).map(([name])=>name);

  async function run() {
    if (!ready || !selected || !form.current?.reportValidity()) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError('');
    setResult(null);
    const payload = {
      data_mode: exploratory ? 'exploratory' : 'reviewed',
      gravity_g: gravity, oxygen_pct: Number(oxygen), pressure_kpa: Number(pressure), airflow_cm_s: Number(airflow),
      temperature_k: selected.temperature_available ? Number(temperature) : null,
      fuel: selected.fuel, configuration: selected.configuration,
      holdout_g: null,
    };
    try {
      const responses = await Promise.all([model].map(async candidate => {
        const response = await fetch('/api/ood/predict', {
          method: 'POST', headers, signal: controller.signal, body: JSON.stringify({...payload, model: candidate}),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error?.message || 'Scientific request failed');
        return data as Result;
      }));
      if (!controller.signal.aborted) {
        setResult(responses[0]);
        setShowCurve(true);
      }
    } catch (reason) {
      if (!controller.signal.aborted) {controller.abort(); setError(String(reason));}
    } finally {
      if (activeRequest.current === controller) setBusy(false);
    }
  }

  return <section className="panel ood-panel" aria-labelledby="ood-title" aria-busy={busy}>
    <h2 id="ood-title" className="text-xl font-bold">{t(en ? 'Explore an experiment in 3 steps' : 'Explora un experimento en 3 pasos')}</h2>
    <p>{t(en ? 'Start with a material, choose a source-backed experiment, then estimate its supported properties.' : 'Parte del material, elige un experimento con fuentes y estima las propiedades disponibles.')}</p>
    {error && <div className="alert" role="alert">{t(error)}</div>}
    {!status && !error && <p role="status">{t(en ? 'Loading available experiments…' : 'Cargando experimentos disponibles…')}</p>}
    <form ref={form} onSubmit={event => {event.preventDefault(); void run();}}>
      <fieldset className="lab-step"><legend>1 · {t(en ? 'Material and experiment' : 'Material y experimento')}</legend>
        <div className="lab-materials" role="group" aria-label={en ? 'Material' : 'Material'}>
          {Object.values(MATERIALS_CATALOG).map(item => <button key={item.id} type="button" aria-pressed={selectedMaterial === item.id} onClick={() => {setSelectedMaterial(item.id); setCohort('0'); setTemperature('');}}>
            <strong>{t(item.name[lang])}</strong><small>{t(item.subtitle[lang])}</small>
          </button>)}
        </div>
        {status && !cohortOptions.length && <p role="status">{t(en ? 'No experiment with enough data for prediction is available for this material. Choose cellulose or another material with compatible observations.' : 'Este material no tiene experimentos con datos suficientes para predecir. Elige celulosa u otro material con observaciones compatibles.')}</p>}
        {!!cohortOptions.length && <label>{t(en ? 'Available experiment' : 'Experimento disponible')}<select value={cohort} onChange={event => {setCohort(event.target.value); setTemperature('');}}>
          {cohortOptions.map((item, index) => <option key={index} value={index}>{t(item.fuel)} · {t(item.configuration)}</option>)}
        </select></label>}
        {selected && <div className="lab-facts">{Object.entries(coverage).filter(([,value]) => value.prediction_eligible).map(([key,value]) => <span key={key}><strong>{t(propertyLabels[key])}</strong> · {t(value.observations)} {t(en ? 'observations' : 'observaciones')} · {t(value.gravity_levels.length)} {t(en ? 'gravity levels' : 'niveles de gravedad')}</span>)}</div>}
      </fieldset>
      {selected && <>
        <fieldset className="lab-step"><legend>2 · {t(en ? 'Conditions to explore' : 'Condiciones que quieres explorar')}</legend>
          <p>{t(en ? 'These values start with your scenario. They describe the prediction target, not the original measurements.' : 'Estos valores parten de tu escenario. Definen la estimación, no las mediciones originales.')}</p>
          <label htmlFor="ood-gravity">{t(en ? 'Gravity' : 'Gravedad')}: {t(gravity.toFixed(3))} g</label>
          <input id="ood-gravity" type="range" min="0" max="1" step="0.001" value={gravity} onChange={event => setGravity(Number(event.target.value))}/>
          <div className="ood-references">{[['Orbit',0],['Moon',.165],['Mars',.38],['Earth',1]].map(([name,value]) => <button key={name} type="button" aria-pressed={gravity === value} onClick={() => setGravity(Number(value))}>{t(name)} · {t(value)} g</button>)}</div>
          <div className="ood-controls">
            <label>{t(en ? 'Oxygen (%)' : 'Oxígeno (%)')}<input type="number" required min="0" max="100" step="any" value={oxygen} onChange={event => setOxygen(event.target.value)}/></label>
            <label>{t(en ? 'Pressure (kPa)' : 'Presión (kPa)')}<input type="number" required min="0.001" step="any" value={pressure} onChange={event => setPressure(event.target.value)}/></label>
            <label>{t(en ? 'Airflow (cm/s)' : 'Flujo de aire (cm/s)')}<input type="number" required min="0" step="any" value={airflow} onChange={event => setAirflow(event.target.value)}/></label>
            {selected.temperature_available && <label>{t(en ? 'Initial temperature (K)' : 'Temperatura inicial (K)')}<input type="number" required min="1" step="any" value={temperature} onChange={event => setTemperature(event.target.value)}/></label>}
          </div>
          {selected.observed_ranges && <details><summary>{t(en ? 'Compare with measured conditions' : 'Comparar con las condiciones medidas')}</summary><div className="lab-facts">{Object.entries(selected.observed_ranges).map(([key,range]) => <span key={key}>{t(({oxygen_pct:'Oxygen (%)', pressure_kpa:'Pressure (kPa)', airflow_cm_s:'Airflow (cm/s)', temperature_k:'Temperature (K)'} as Record<string,string>)[key])}: {t(range[0])} – {t(range[1])}</span>)}</div><p>{t(en ? 'A value inside each individual range does not prove the combination was tested.' : 'Estar dentro de cada rango por separado no demuestra que la combinación haya sido probada.')}</p></details>}
        </fieldset>
        <fieldset className="lab-step"><legend>3 · {t(en ? 'Estimate and understand the result' : 'Estima y entiende el resultado')}</legend>
          {!reviewed && <div className="ood-exploratory"><label className="ood-mode-toggle"><input type="checkbox" checked={exploratory} onChange={event => setExploratory(event.target.checked)}/><span>{t(en ? 'Use extracted observations for exploratory estimates' : 'Usar observaciones extraídas para estimaciones exploratorias')}</span></label><p>{t(en ? 'These measurements await scientific review. Enable this option to explore them; results remain unvalidated.' : 'Estas mediciones esperan revisión científica. Activa esta opción para explorarlas; los resultados no están validados.')}</p></div>}
          <details><summary>{t(en ? 'Model options' : 'Opciones del modelo')}</summary><label>{t(en ? 'Regression model' : 'Modelo de regresión')}<select value={model} onChange={event => setModel(event.target.value)}>{Object.entries(modelLabels).map(([key,label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label></details>
          {!status?.dependencies_ready && <p role="status">{t(en ? 'The prediction service is missing its scientific dependencies.' : 'Al servicio de predicción le faltan sus dependencias científicas.')}</p>}
          {selected.temperature_available && !temperature && <p>{t(en ? 'Enter the initial temperature to continue.' : 'Ingresa la temperatura inicial para continuar.')}</p>}
          <button className="button primary" disabled={!ready || busy || !validCurveInputs}>{t(busy ? (en ? 'Computing…' : 'Calculando…') : (en ? 'Estimate supported properties' : 'Estimar propiedades disponibles'))}</button>
          <p className="small-note">{t(en ? 'Research estimates only. They do not certify safety or determine whether a fire will extinguish.' : 'Estimaciones para investigación. No certifican seguridad ni determinan si un fuego se extinguirá.')}</p>
        </fieldset>
      </>}
    </form>
    {result && <section className="lab-result" aria-live="polite"><h3>{t(en ? 'Your result' : 'Tu resultado')}</h3><p>{t(result.warning || result.reason)}</p>
      <div className="ood-results">{Object.entries(result.results).map(([key,estimate]) => <PredictionCard key={key} name={key} estimate={estimate}/>)}</div>
      {Object.entries(result.unavailable_outputs || {}).map(([key,reason]) => <p key={key}>{t(propertyLabels[key])}: {t(reason)}</p>)}
      <button type="button" onClick={() => downloadJSON('ood-prediction.json',result)} className="button secondary"><Download size={14}/>{t(en ? 'Download result' : 'Descargar resultado')}</button>
    </section>}
    {showCurve && <OODGravityCurve conditions={curveConditions} properties={curveProperties} gravity={gravity} onGravityChange={setGravity} onAirflowChange={setAirflow} token={token}/>}
    {selected && <details className="lab-step"><summary>{t(en ? 'View measurements and paper sources' : 'Ver mediciones y fuentes del paper')}</summary><OODEvidence key={`${selected.fuel}/${selected.configuration}`} cohort={selected} gravity={null} dataMode={reviewed ? 'reviewed' : 'exploratory'} token={token}/></details>}
  </section>;
}
