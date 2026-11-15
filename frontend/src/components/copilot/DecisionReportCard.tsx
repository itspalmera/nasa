// frontend/src/components/copilot/DecisionReportCard.tsx
// Informe de decisión del Motor 4 (POST /api/report), compacto: veredicto + 3 columnas (materiales, supresión, protocolos).
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useScenario } from '../../context/ScenarioContext';
import { DecisionReport, fetchDecisionReport, resolveSourceUrl } from '../../../services/ragService';

const STATUS: Record<DecisionReport['verdict']['status'], { color: string; icon: React.ReactNode }> = {
  flammable: { color: 'text-rose-300', icon: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /> },
  not_flammable_in_tests: { color: 'text-emerald-300', icon: <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> },
  insufficient_evidence: { color: 'text-slate-200', icon: <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> },
};

// Texto plano del informe para copiar o descargar (mismas frases y números de cita que en pantalla).
function asText(r: DecisionReport, en: boolean): string {
  const lines = [
    `${en ? 'DECISION BRIEF' : 'INFORME DE DECISIÓN'} · ${r.scenario.name} · ${en ? r.material.name_en : r.material.name}`,
    `${Number(r.scenario.o2_pct).toFixed(1)}% O2 · ${Number(r.scenario.pressure_kpa).toFixed(1)} kPa · ${Number(r.scenario.gravity_g).toFixed(2)} g`,
    '',
    r.verdict.headline,
    ...(r.verdict.text ? [r.verdict.text] : []),
    '',
    ...(r.gaps.length ? [en ? 'Not measured yet:' : 'Sin medición todavía:', ...r.gaps.map((g) => `- ${g}`), ''] : []),
    ...r.sections.flatMap((s) => (s.items.length ? [s.title, ...s.items.map((i) => `- ${i.text}`), ''] : [])),
    en ? 'Sources:' : 'Fuentes:',
    ...r.citations.map((c, i) => `[${i + 1}] ${c.title} — ${c.source_file}${c.page > 0 ? `, p. ${c.page}` : ''}${c.url ? ` (${resolveSourceUrl(c.url)})` : ''}`),
  ];
  return lines.join('\n');
}

export const DecisionReportCard: React.FC = () => {
  const { lang, activeHabitat, conditions, selectedMaterial } = useScenario();
  const en = lang === 'en';
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    fetchDecisionReport({
      scenarioId: activeHabitat.backendId,
      materialId: selectedMaterial,
      language: lang,
      conditions,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setReport(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  };

  // Se regenera al cambiar hábitat, material, idioma o condiciones (con espera para no llamar por cada movimiento de slider).
  const key = `${activeHabitat.backendId}|${selectedMaterial}|${lang}|${conditions.o2.toFixed(1)}|${conditions.pressurePsi.toFixed(1)}|${conditions.airflowCms.toFixed(1)}|${conditions.gravityG.toFixed(2)}`;
  useEffect(() => {
    const timer = setTimeout(load, 900);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(asText(report, en));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el portapapeles puede estar bloqueado; no es crítico */
    }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([asText(report, en)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-${report.scenario.id ?? 'escenario'}-${report.material.id}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const status = report ? STATUS[report.verdict.status] : STATUS.insufficient_evidence;
  const sections = report?.sections ?? [];

  return (
    <div className="@container rounded-xl border border-slate-700 bg-[#081124]">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-left">
          <FileText className="h-3.5 w-3.5 text-sky-300" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
            {en ? 'Decision brief' : 'Informe de decisión'}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />}
          {report && (
            <>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800">
                <Copy className="h-3 w-3" /> {copied ? (en ? 'Copied' : 'Copiado') : en ? 'Copy' : 'Copiar'}
              </button>
              <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-900 hover:bg-slate-200">
                <Download className="h-3 w-3" /> {en ? 'Download' : 'Descargar'}
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-800 p-3 text-[11px]">
          {loading && !report && (
            <p className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {en ? 'Searching evidence and writing the brief…' : 'Buscando evidencia y redactando el informe…'}
            </p>
          )}
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-rose-200">
              {error}{' '}
              <button type="button" onClick={load} className="underline">
                {en ? 'Retry' : 'Reintentar'}
              </button>
            </div>
          )}

          {report && (
            <div className={`grid grid-cols-1 gap-2.5 @3xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
              {/* Columna 1: veredicto, condiciones, vacíos y "leer primero" */}
              <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-[#050A15] p-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{en ? 'Verdict' : 'Veredicto'}</span>
                <div className="flex items-start gap-1.5">
                  {status.icon}
                  <p className={`text-xs font-bold leading-snug ${status.color}`}>{report.verdict.headline}</p>
                </div>
                {report.verdict.text && (
                  <p className="line-clamp-4 leading-relaxed text-slate-300" title={report.verdict.text}>
                    {report.verdict.text}
                  </p>
                )}
                <dl className="space-y-0.5 border-y border-slate-800 py-1.5 font-mono text-[10px]">
                  <div className="flex justify-between gap-2"><dt className="text-slate-500">O₂ · {en ? 'pressure' : 'presión'}</dt><dd className="text-white">{Number(report.scenario.o2_pct).toFixed(1)}% · {Number(report.scenario.pressure_kpa).toFixed(1)} kPa</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-slate-500">{en ? 'Gravity' : 'Gravedad'}</dt><dd className="text-white">{Number(report.scenario.gravity_g).toFixed(2)} g</dd></div>
                </dl>
                {report.gaps.length > 0 && (
                  <ul className="space-y-0.5 text-[10px] leading-snug text-amber-200">
                    {report.gaps.map((g, i) => (
                      <li key={i} className="flex gap-1"><span>⚠</span><span>{g}</span></li>
                    ))}
                  </ul>
                )}
                {report.read_first.length > 0 && (
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{en ? 'Read first' : 'Leer primero'}</span>
                    <ol className="mt-1 space-y-1">
                      {report.read_first.map((r, i) => (
                        <li key={r.investigation_id} className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="w-3 text-slate-500">{i + 1}</span>
                          <span className="w-20 truncate font-semibold text-white" title={r.name}>{r.acronym}</span>
                          <span className="h-1.5 flex-1 rounded-full bg-slate-800">
                            <span className="block h-1.5 rounded-full bg-sky-400" style={{ width: `${Math.max(4, Math.min(100, r.relevance_score))}%` }} />
                          </span>
                          <span className="w-6 text-right text-slate-300">{r.relevance_score.toFixed(0)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Columnas 2-4: evaluación de materiales, diseño de supresión, protocolos de seguridad */}
              {sections.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-800 bg-[#050A15] p-3">
                  <span className="text-[11px] font-bold text-white">{s.title}</span>
                  {s.items.length ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {s.items.map((item, i) => (
                        <li key={i} className="flex gap-1.5 leading-snug text-slate-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                          <span className="line-clamp-5" title={item.text}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-slate-500">{en ? 'No cited evidence for this scenario.' : 'Sin evidencia citada para este escenario.'}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {report && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-slate-500">
              <button type="button" onClick={() => setShowSources((v) => !v)} className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200">
                <BookOpen className="h-3 w-3" />
                {en ? `Sources (${report.citations.length})` : `Fuentes (${report.citations.length})`}
                <ChevronDown className={`h-3 w-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
              </button>
              <span>
                {report.mode !== 'generated' && report.limitations[0] ? `${report.limitations[0]} · ` : ''}
                {report.usage?.cached ? (en ? 'cached · ' : 'en caché · ') : ''}
                {en ? 'catalog' : 'catálogo'}: {report.scenario_source}
              </span>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 disabled:opacity-40">
                <RefreshCw className="h-3 w-3" /> {en ? 'Regenerate' : 'Regenerar'}
              </button>
            </div>
          )}

          {report && showSources && (
            <ol className="mt-2 grid grid-cols-1 gap-1.5 @3xl:grid-cols-2">
              {report.citations.map((c, i) => {
                const url = resolveSourceUrl(c.url);
                return (
                  <li key={c.id} className="rounded-md border border-slate-800 bg-[#050B16] p-2 text-[10px]">
                    <span className="font-mono font-bold text-sky-300">[{i + 1}]</span> <strong className="text-slate-200">{c.title}</strong>
                    <span className="block text-slate-400">{c.page > 0 ? `${en ? 'p.' : 'pág.'} ${c.page} · ` : ''}{c.source_file}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                        {en ? 'Open source' : 'Abrir fuente'} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};
