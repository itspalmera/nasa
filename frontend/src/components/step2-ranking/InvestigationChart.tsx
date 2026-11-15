'use client';

import {useEffect, useState} from 'react';
import {CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis} from 'recharts';
import {useScenario} from '../../context/ScenarioContext';
import {useT} from '../../i18n/useT';
import {propertyLabels} from '../../../app/ood/ood-results';

type Range = {variable: string; unit: string; min: number | null; max: number | null; basis: string | null; note: string | null};
type Observation = {
  experiment_id: string; fuel: string; configuration: string; gravity_g: number;
  oxygen_pct: number; airflow_cm_s: number; pressure_kpa: number;
  outputs: Record<string, number | null>; citation: string; reviewed: boolean;
};
type ChartData = {
  investigation_id: string; acronym: string; ranges: Range[]; observations: Observation[];
  outputs: Record<string, string>; sources: {id: string; title: string; url: string | null}[];
};

export function InvestigationChart({investigationId}: {investigationId: string}) {
  const {lang, conditions} = useScenario();
  const t = useT();
  const en = lang === 'en';
  const [loaded, setLoaded] = useState<ChartData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [configuration, setConfiguration] = useState('');
  const [property, setProperty] = useState('spread_mm_s');
  const [axis, setAxis] = useState('oxygen_pct');
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setLoaded(null);
    setConfiguration('');
    fetch(`/api/motor3/chart/${encodeURIComponent(investigationId)}`, {signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw Error('Chart unavailable');
        const data = await response.json();
        if (data.investigation_id !== investigationId || !Array.isArray(data.ranges)) throw Error('Invalid chart');
        return data as ChartData;
      })
      .then(data => {if (!controller.signal.aborted) setLoaded(data);})
      .catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [investigationId, retry]);
  // Bind the displayed data to its identity even before effect cleanup runs.
  const data = loaded?.investigation_id === investigationId ? loaded : null;
  const labels: Record<string, string> = en
    ? {o2:'Oxygen', pressure:'Pressure', flow:'Airflow', gravity:'Gravity'}
    : {o2:'Oxígeno', pressure:'Presión', flow:'Flujo de aire', gravity:'Gravedad'};
  const targets: Record<string, number> = {o2:conditions.o2, pressure:conditions.pressurePsi * 6.894757293168, flow:conditions.airflowCms, gravity:conditions.gravityG};
  const fmt = (value: number) => new Intl.NumberFormat(lang, {maximumFractionDigits:3}).format(value);
  const configurations = [...new Set(data?.observations.map(row => row.configuration) || [])];
  const chosenConfig = configurations.includes(configuration) ? configuration : configurations[0];
  const observations = data?.observations.filter(row => row.configuration === chosenConfig) || [];
  const properties = Object.keys(data?.outputs || {}).filter(key => observations.some(row => row.outputs[key] != null));
  const chosenProperty = properties.includes(property) ? property : properties[0];
  const points = observations.filter(row => row.outputs[chosenProperty] != null).map(row => ({...row, value:row.outputs[chosenProperty]}));
  const gravityLevels = [...new Set(points.map(row => row.gravity_g))].sort((a,b) => a-b);
  const axisLabels: Record<string,string> = {oxygen_pct:en ? 'Oxygen (%)' : 'Oxígeno (%)', airflow_cm_s:en ? 'Airflow (cm/s)' : 'Flujo de aire (cm/s)', gravity_g:en ? 'Gravity (g)' : 'Gravedad (g)'};
  const colors = ['#38bdf8','#fb923c','#a78bfa','#34d399'];
  return <section aria-label={en ? 'Investigation chart' : 'Gráfico de la investigación'} data-investigation-id={investigationId} className="my-5 rounded-xl border border-sky-800/60 bg-[#070f1e] p-3 sm:p-5">
    <h4 className="text-base font-bold">{en ? 'Paper chart' : 'Gráfico del paper'}{data ? ` · ${data.acronym}` : ''}</h4>
    {error ? <p role="alert" className="my-3 text-amber-200">{en ? 'Could not load this paper’s chart.' : 'No se pudo cargar el gráfico de este paper.'} <button type="button" onClick={() => setRetry(value => value+1)} className="underline">{en ? 'Retry' : 'Reintentar'}</button></p> : !data ? <p role="status" className="my-3 text-xs">{en ? 'Loading paper data…' : 'Cargando datos del paper…'}</p> : <>
      <p className="my-3 text-xs text-slate-300">{en ? 'Reported experimental conditions. Blue marks show the source range; the orange marker shows your scenario. Each row has its own scale and units.' : 'Condiciones experimentales reportadas. Las marcas azules muestran el rango de la fuente; el marcador naranja, tu escenario. Cada fila tiene su propia escala y unidades.'}</p>
      <div className="space-y-4" role="group" aria-label={en ? 'Reported ranges' : 'Rangos reportados'}>
        {data.ranges.map(range => {
          const target = targets[range.variable];
          const low = range.min ?? range.max;
          const high = range.max ?? range.min;
          const known = low != null && high != null;
          const scaleMax = Math.max(high ?? 0, target, range.variable === 'o2' ? 21 : range.variable === 'gravity' ? 1 : 1) * 1.1;
          const x = (value: number) => 12 + (value / scaleMax) * 276;
          const label = known ? `${fmt(low)}${low === high ? '' : ` – ${fmt(high)}`} ${range.unit}` : (en ? 'Not reported' : 'No reportado');
          return <div key={range.variable}>
            <div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{labels[range.variable]}</strong><span className="text-sky-200">{label}</span></div>
            <svg viewBox="0 0 300 44" className="h-12 w-full" role="img" aria-label={`${labels[range.variable]}: ${label}. ${en ? 'Scenario' : 'Escenario'}: ${fmt(target)} ${range.unit}`}>
              <line x1="12" y1="18" x2="288" y2="18" stroke="#334155" strokeWidth="4"/>
              {known && <><line x1={x(low)} y1="18" x2={x(high)} y2="18" stroke="#38bdf8" strokeWidth="9" strokeLinecap="round"/><circle cx={x(low)} cy="18" r="4" fill="#bae6fd"/><circle cx={x(high)} cy="18" r="4" fill="#bae6fd"/></>}
              <path d={`M ${x(target)} 5 l -5 -5 h 10 z`} fill="#fb923c"/><line x1={x(target)} y1="5" x2={x(target)} y2="27" stroke="#fb923c" strokeWidth="2"/>
              <text x="12" y="41" fill="#94a3b8" fontSize="9">0</text><text x="288" y="41" textAnchor="end" fill="#94a3b8" fontSize="9">{fmt(scaleMax)} {range.unit}</text>
            </svg>
            <p className="mb-1 text-[11px] text-slate-400">{range.basis === 'planificado' ? (en ? 'Planned conditions · not measurements' : 'Condiciones planificadas · no son mediciones') : range.basis === 'cabina' ? (en ? 'Nominal cabin conditions' : 'Condiciones nominales de cabina') : range.basis === 'sin_dato' ? (en ? 'No measurement basis reported' : 'Sin base de medición reportada') : (en ? 'Reported by the source' : 'Reportado por la fuente')}</p>
            <p className="text-[11px] text-slate-400">{en ? 'Your scenario' : 'Tu escenario'}: {fmt(target)} {range.unit}{known ? ` · ${target >= low && target <= high ? (en ? 'Within this reported range' : 'Dentro de este rango reportado') : (en ? 'Outside this reported range' : 'Fuera de este rango reportado')}` : ''}</p>
            {range.note && <details className="mt-1 text-[11px] text-slate-400"><summary>{en ? 'Source note' : 'Nota de la fuente'}</summary><p>{t(range.note)}</p></details>}
          </div>;
        })}
      </div>
      <p className="my-3 text-[11px] text-amber-200">{en ? 'Separate ranges do not prove that their combination was tested or establish a flammability limit.' : 'Los rangos por separado no demuestran que su combinación haya sido probada ni establecen un límite de inflamabilidad.'}</p>
      {!!data.observations.length ? <>
        <h5 className="mb-3 mt-5 font-bold">{en ? 'Measurements from the paper' : 'Mediciones del paper'}</h5>
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <label className="sm:col-span-2">{en ? 'Experimental configuration' : 'Configuración experimental'}<select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" value={chosenConfig} onChange={event => setConfiguration(event.target.value)}>{configurations.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <label>{en ? 'Measured property' : 'Propiedad medida'}<select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" value={chosenProperty} onChange={event => setProperty(event.target.value)}>{properties.map(value => <option key={value} value={value}>{t(propertyLabels[value])}</option>)}</select></label>
          <label>{en ? 'Horizontal axis' : 'Eje horizontal'}<select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" value={axis} onChange={event => setAxis(event.target.value)}>{Object.entries(axisLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <div className="mt-5 h-64 w-full min-w-0" role="img" aria-label={`${en ? 'Measured data' : 'Datos medidos'} · ${data.acronym} · ${t(propertyLabels[chosenProperty])}`}>
          <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:10,right:15,left:0,bottom:25}}>
            <CartesianGrid stroke="#26364c"/><XAxis type="number" dataKey={axis} name={axisLabels[axis]} label={{value:axisLabels[axis],position:'bottom',fill:'#cbd5e1',fontSize:11}} tick={{fill:'#94a3b8',fontSize:11}}/>
            <YAxis type="number" dataKey="value" name={t(propertyLabels[chosenProperty])} unit={` ${data.outputs[chosenProperty]}`} tick={{fill:'#94a3b8',fontSize:11}} width={65}/>
            <Tooltip content={({active,payload}) => {
              const row = payload?.[0]?.payload as (Observation & {value:number}) | undefined;
              return active && row ? <div className="max-w-72 rounded-lg border border-slate-600 bg-slate-950 p-3 text-xs"><strong>{fmt(row.value)} {data.outputs[chosenProperty]}</strong><p>{row.oxygen_pct}% O₂ · {row.airflow_cm_s} cm/s · {row.pressure_kpa} kPa · {row.gravity_g} g</p><p>{row.citation}</p></div> : null;
            }}/>
            {gravityLevels.map((gravity,index) => <Scatter key={gravity} name={`${gravity} g`} data={points.filter(row => row.gravity_g === gravity)} fill={colors[index % colors.length]} isAnimationActive={false}/>)}
          </ScatterChart></ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">{gravityLevels.map((gravity,index) => <span key={gravity} style={{color:colors[index % colors.length]}}>● {gravity} g</span>)}</div>
        <p className="my-3 text-xs text-slate-400">{en ? 'Points are recorded measurements, not predictions. Other conditions can vary between points; this is not a controlled causal curve. Review status is preserved below.' : 'Los puntos son mediciones registradas, no predicciones. Las otras condiciones pueden variar entre puntos; no es una curva causal controlada. El estado de revisión se conserva abajo.'}</p>
        <details className="text-xs"><summary>{en ? 'Measurements and citations' : 'Mediciones y citas'} ({points.length})</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr>{[en ? 'Measurement' : 'Medición','O₂ (%)',en ? 'Airflow (cm/s)' : 'Flujo (cm/s)','g',en ? 'Source / review' : 'Fuente / revisión'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{points.map(row => <tr key={row.experiment_id} className="border-t border-slate-800"><td className="p-2">{fmt(row.value!)} {data.outputs[chosenProperty]}</td><td className="p-2">{row.oxygen_pct}</td><td className="p-2">{row.airflow_cm_s}</td><td className="p-2">{row.gravity_g}</td><td className="min-w-48 p-2">{row.citation}<p>{row.reviewed ? (en ? 'Reviewed' : 'Revisado') : (en ? 'Pending scientific review' : 'Revisión científica pendiente')}</p></td></tr>)}</tbody></table></div></details>
      </> : <p className="my-4 rounded-lg bg-slate-800/70 p-3 text-xs text-slate-300">{en ? 'No run-level numeric measurements are linked to this paper in the available dataset. The chart above shows only its reported experimental ranges.' : 'El conjunto disponible no tiene mediciones numéricas por corrida asociadas a este paper. El gráfico superior muestra únicamente sus rangos experimentales reportados.'}</p>}
      {!!data.sources.length && <details className="mt-4 text-xs text-slate-400"><summary>{en ? 'Paper sources' : 'Fuentes del paper'}</summary><ul className="mt-2 space-y-2">{data.sources.map(source => <li key={source.id}>{source.url && /^https?:\/\//.test(source.url) ? <a href={source.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">{source.title}</a> : source.title}</li>)}</ul></details>}
    </>}
  </section>;
}
