import {useT} from '../../i18n/useT';
import React, {useEffect, useState} from 'react';
import {useScenario} from '../../context/ScenarioContext';
type Entry = {id: string; acronym: string; name: string; objectives?: string; fuels: string[]; geometry?: string; hardware?: string; findings: {text: string; source?: string; page?: number}[]; o2?: {min?: number; max?: number}; pressure?: {min?: number; max?: number}; flow?: {min?: number; max?: number}; gravity?: number};
export const HeadToHeadPanel = () => {
  const t = useT();

  const {lang, selectedInvestigationId} = useScenario();
  const en = lang === 'en';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [left, setLeft] = useState(selectedInvestigationId);
  const [right, setRight] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/investigations', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw Error();
      return response.json();
    }).then((data: Entry[]) => {if (!controller.signal.aborted) {setEntries(data); setLeft(previous => previous || data[0]?.id || ''); setRight(data.find(item => item.id !== (selectedInvestigationId || data[0]?.id))?.id || '');}}).catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [selectedInvestigationId]);
  const range = (value: {min?: number; max?: number} | undefined, unit: string) => value?.min != null ? `${value.min} – ${value.max ?? value.min} ${unit}` : (en ? 'Not reported' : 'No reportado');
  return <div className="flex-1 overflow-y-auto p-4">
    <h3 className="mb-4 text-lg font-bold">{t(en ? 'Compare source records' : 'Comparar fichas de las fuentes')}</h3>
    {error && <p role="alert">{t(en ? 'Could not load investigations.' : 'No se pudieron cargar las investigaciones.')}</p>}
    {!entries.length && !error && <p role="status">{t(en ? 'Loading…' : 'Cargando…')}</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[left,right].map((id,index) => {
      const entry = entries.find(item => item.id === id);
      return <section key={index} className="min-w-0 rounded-xl border border-slate-700 p-4">
        <label>{t(en ? 'Investigation' : 'Investigación')} {t(index === 0 ? 'A' : 'B')}<select className="my-3 w-full rounded bg-slate-900 p-2" value={id} onChange={event => (index === 0 ? setLeft : setRight)(event.target.value)}>{entries.map(item => <option key={item.id} value={item.id}>{t(item.acronym)}</option>)}</select></label>
        {entry && <><h4 className="font-bold">{t(entry.name)}</h4><p className="my-3 text-xs text-slate-300">{t(entry.objectives)}</p>
          <dl className="space-y-3 text-xs">{[[en ? 'Materials' : 'Materiales',entry.fuels.map(value => t(value)).join(', ')],[en ? 'Oxygen' : 'Oxígeno',range(entry.o2,'%')],[en ? 'Pressure' : 'Presión',range(entry.pressure,'kPa')],[en ? 'Airflow' : 'Flujo de aire',range(entry.flow,'cm/s')],[en ? 'Gravity' : 'Gravedad',entry.gravity == null ? (en ? 'Not reported' : 'No reportado') : `${entry.gravity} g`],[en ? 'Geometry' : 'Geometría',entry.geometry],[en ? 'Hardware' : 'Hardware',entry.hardware]].map(([label,value]) => <div key={label}><dt className="text-slate-400">{t(label)}</dt><dd>{t(value || (en ? 'Not reported' : 'No reportado'))}</dd></div>)}</dl>
          <h5 className="mb-2 mt-5 font-bold">{t(en ? 'Reported findings' : 'Hallazgos reportados')}</h5>
          {entry.findings.length ? entry.findings.map((finding,i) => <blockquote key={i} className="mb-4 border-l border-sky-400 pl-3 text-xs">{t(finding.text)}<p className="mt-1 text-slate-400">{t(finding.source)}{t(finding.page ? ` · p. ${finding.page}` : '')}</p></blockquote>) : <p className="text-xs text-slate-400">{t(en ? 'No findings in this catalog entry.' : 'Esta ficha no contiene hallazgos.')}</p>}
        </>}
      </section>;
    })}</div>
    {left && left === right && <p className="mt-4 text-amber-200">{t(en ? 'Choose different investigations to compare them.' : 'Elige investigaciones distintas para compararlas.')}</p>}
  </div>;
};
