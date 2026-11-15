import {InvestigationChart} from "./InvestigationChart";
import {useT} from '../../i18n/useT';
import React, { useEffect, useState, useRef } from "react";
import { useScenario } from "../../context/ScenarioContext";

type Variable = {variable: string; min?: number; max?: number; unit?: string; values?: string[]; platform?: string; facility?: string; hardware?: string; note?: string; label: string};
type Analysis = {acronym: string; name: string; fixed_conditions: Variable[]; iterated_variables: Variable[]; unreported_variables: Variable[]; diagnostics_used: string[]; measured_outcomes: {text: string; source?: string; page?: number}[]};

export const InsideInvestigationPanel: React.FC = () => {
  const t = useT();

  const { lang, selectedInvestigationId: selected, setSelectedInvestigationId: setSelected } = useScenario();
  const en = lang === "en";
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {panel.current?.scrollTo({top:0});}, [selected]);
  const [investigations, setInvestigations] = useState<{id: string; acronym: string; name: string}[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/investigations", {signal: controller.signal}).then(async response => {
      if (!response.ok) throw Error(en ? "Could not load investigations" : "No se pudieron cargar las investigaciones");
      return response.json();
    }).then(data => {if (!controller.signal.aborted) {setInvestigations(data); if (!selected) setSelected(data[0]?.id || "");}})
      .catch(reason => {if (!controller.signal.aborted) setError(reason.message);});
    return () => controller.abort();
  }, [retry, en]);
  useEffect(() => {
    setAnalysis(null);
    if (!selected) return;
    const controller = new AbortController();
    setError("");
    fetch(`/api/motor3/intra/${encodeURIComponent(selected)}`, {signal: controller.signal}).then(async response => {
      if (!response.ok) throw Error(en ? "Comparison unavailable" : "No se pudo cargar la comparación");
      return response.json();
    }).then(data => {if (!controller.signal.aborted) setAnalysis(data);})
      .catch(reason => {if (!controller.signal.aborted) setError(reason.message);});
    return () => controller.abort();
  }, [selected, retry, en]);
  const labels: Record<string, string> = en ? {o2: "Oxygen", pressure: "Pressure", flow: "Airflow", gravity: "Gravity", fuels: "Materials", hardware_context: "Hardware"} : {o2: "Oxígeno", pressure: "Presión", flow: "Flujo de aire", gravity: "Gravedad", fuels: "Materiales", hardware_context: "Hardware"};
  const display = (item: Variable) => item.values?.map(value => t(value)).join(", ") || (item.min !== undefined ? `${item.min}${item.max !== item.min ? ` – ${item.max}` : ""} ${item.unit || ""}` : [item.platform, item.facility, item.hardware].filter(Boolean).map(value => t(value)).join(" · "));
  return <div ref={panel} className="flex-1 overflow-y-auto p-4 sm:p-6">
    <h3 className="text-lg font-bold">{t(en ? "Inside an investigation" : "Dentro de una investigación")}</h3>
    <p className="my-3 text-xs text-slate-400">{t(en ? "Compare reported conditions and findings. Catalog ranges do not identify individual experimental runs." : "Compara condiciones y hallazgos reportados. Los rangos del catálogo no identifican corridas experimentales individuales.")}</p>
    <label className="block text-sm" htmlFor="intra-investigation">{t(en ? "Investigation" : "Investigación")}</label>
    <select id="intra-investigation" className="my-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" value={selected} onChange={event => setSelected(event.target.value)} disabled={!investigations.length}>
      {investigations.map(item => <option key={item.id} value={item.id}>{t(item.acronym)} — {t(item.name)}</option>)}
    </select>
    {error ? <div role="alert" className="my-4 text-amber-200">{t(error)} <button onClick={() => setRetry(value => value + 1)} className="underline">{t(en ? "Retry" : "Reintentar")}</button></div> : !analysis ? <p role="status">{t(en ? "Loading comparison…" : "Cargando comparación…")}</p> : <>
      <h4 className="my-4 font-bold">{t(analysis.acronym)} · {t(analysis.name)}</h4>
      <InvestigationChart key={selected} investigationId={selected}/>
      <div className="grid gap-4 lg:grid-cols-2">{[
        [en ? "Fixed conditions" : "Condiciones fijas", analysis.fixed_conditions],
        [en ? "Variables changed" : "Variables que cambiaron", analysis.iterated_variables],
        [en ? "Unreported variables" : "Variables sin datos", analysis.unreported_variables],
      ].map(([title, items]) => <section key={title as string} className="rounded-xl border border-slate-700 p-4">
        <h4 className="mb-3 font-bold">{t(title as string)}</h4>
        {(items as Variable[]).length ? (items as Variable[]).map(item => <div key={item.variable} className="mb-3 text-xs"><strong>{t(labels[item.variable] || item.variable)}</strong><p className="mt-1 text-slate-300">{t(display(item) || (en ? "Not reported" : "No reportado"))}</p>{item.note && <p className="mt-1 text-slate-400">{t(item.note)}</p>}</div>) : <p className="text-xs text-slate-400">{t(en ? "None reported" : "Ninguna reportada")}</p>}
      </section>)}</div>
      <h4 className="mb-2 mt-5 font-bold">{t(en ? "Reported findings" : "Hallazgos reportados")}</h4>
      {analysis.measured_outcomes.length ? analysis.measured_outcomes.map((item, index) => <blockquote key={index} className="mb-3 border-l-2 border-sky-500 pl-3 text-sm">{t(item.text)}<p className="text-xs text-slate-400">{t(item.source)}{t(item.page ? ` · p. ${item.page}` : "")}</p></blockquote>) : <p className="text-xs text-slate-400">{t(en ? "No findings in this catalog entry." : "Esta ficha no contiene hallazgos.")}</p>}
      <p className="mt-4 text-xs text-slate-400">{t(en ? "Diagnostics" : "Instrumentos")}: {t(analysis.diagnostics_used.map(value => t(value)).join(", ") || (en ? "Not reported" : "No reportado"))}</p>
    </>}
  </div>;
};
