import {useT} from '../../i18n/useT';
import React from "react";
import { useScenario } from "../../context/ScenarioContext";

export const AlertsStrip: React.FC = () => {
  const t = useT();

  const { lang, conditions, activeMaterialEvaluation } = useScenario();

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">
            {t(lang === "en" ? "Physical alerts" : "Alertas físicas")}
          </h3>
          <p className="text-[11px] text-slate-400">
            {t(lang === "en"
              ? "2 critical · counter-intuitive physics to design for"
              : "2 críticas · física contraintuitiva para la que diseñar")}
          </p>
        </div>
        <button className="text-[11px] font-semibold text-sky-400 hover:text-sky-300">
          {t(lang === "en" ? "Show all 8 ▾" : "Ver las 8 ▾")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Alerta 1: Crítica */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#0A1224] p-4 transition-colors hover:border-slate-600 hover:bg-[#0C1529]">
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-rose-400">
              <span className="text-[10px]">⚠️</span> {t(lang === "en" ? "CRITICAL" : "CRÍTICO")}
            </span>
            <h4 className="mb-1.5 text-xs font-bold text-white">
              {t(lang === "en" ? "Exploration atmosphere: O₂-enriched" : "Atmósfera de exploración: rica en O₂")}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {t(lang === "en"
                ? `${conditions.o2.toFixed(1)}% O₂ is 44% more than Earth. ${activeMaterialEvaluation.shortName} sits ${activeMaterialEvaluation.burnMarginPts.toFixed(1)} pts above its oxygen limit here.`
                : `${conditions.o2.toFixed(1)}% de O₂ es 44% más que en la Tierra. Acrílico (PMMA) queda ${activeMaterialEvaluation.burnMarginPts.toFixed(1)} pts sobre su límite de oxígeno.`)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 text-[9px]">
            <span className="text-slate-500">{" "}{t("Evidencia")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("SoFIE")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("ACME CFI-G")}{" "}</span>
          </div>
        </div>

        {/* Alerta 2: Crítica */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#0A1224] p-4 transition-colors hover:border-slate-600 hover:bg-[#0C1529]">
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-rose-400">
              <span className="text-[10px]">⚠️</span> {t(lang === "en" ? "CRITICAL" : "CRÍTICO")}
            </span>
            <h4 className="mb-1.5 text-xs font-bold text-white">
              {t(lang === "en" ? "Earth test is not conservative here" : "La prueba terrestre no es conservadora aquí")}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {t(lang === "en"
                ? `An Earth screening test reports a ${activeMaterialEvaluation.earthTest1Pct.toFixed(1)}% O₂ limit, but at ${conditions.airflowCms.toFixed(1)} cm/s and ${conditions.gravityG.toFixed(2)} g the real limit is ${activeMaterialEvaluation.minO2ToBurnPct.toFixed(1)}%: ${activeMaterialEvaluation.blindSpotPts.toFixed(1)} pts of hidden hazard.`
                : `Una prueba terrestre reporta un límite de ${activeMaterialEvaluation.earthTest1Pct.toFixed(1)}% de O₂, pero a ${conditions.airflowCms.toFixed(1)} cm/s y ${conditions.gravityG.toFixed(2)} g el límite real es ${activeMaterialEvaluation.minO2ToBurnPct.toFixed(1)}%: ${activeMaterialEvaluation.blindSpotPts.toFixed(1)} pts de peligro oculto.`)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 text-[9px]">
            <span className="text-slate-500">{" "}{t("Evidencia")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("BASS-II")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("BASS")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("SoFIE")}{" "}</span>
          </div>
        </div>

        {/* Alerta 3: Advertencia */}
        <div className="flex flex-col justify-between rounded-xl border border-amber-900/30 bg-[#0A1224] p-4 transition-colors hover:border-amber-800/40 hover:bg-[#0C1529]">
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-400">
              <span className="text-[10px]">⚡</span> {t(lang === "en" ? "WARNING" : "ADVERTENCIA")}
            </span>
            <h4 className="mb-1.5 text-xs font-bold text-white">
              {t(lang === "en" ? "Your fan speed is in the danger band" : "Tu ventilación está en la banda de peligro")}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {t(lang === "en"
                ? "Between ~3 and 25 cm/s, slow airflow feeds the flame without cooling it. Cutting ventilation in the affected zone moves you out of the band."
                : "Entre ~3 y 25 cm/s, el flujo lento alimenta la llama sin enfriarla. Cortar la ventilación de la zona afectada te saca de la banda.")}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 text-[9px]">
            <span className="text-slate-500">{" "}{t("Evidencia")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("BASS-II")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("BASS")}{" "}</span>
          </div>
        </div>

        {/* Alerta 4: Advertencia */}
        <div className="flex flex-col justify-between rounded-xl border border-amber-900/30 bg-[#0A1224] p-4 transition-colors hover:border-amber-800/40 hover:bg-[#0C1529]">
          <div>
            <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-400">
              <span className="text-[10px]">⚡</span> {t(lang === "en" ? "WARNING" : "ADVERTENCIA")}
            </span>
            <h4 className="mb-1.5 text-xs font-bold text-white">
              {t(lang === "en" ? "Fire spreads toward the fan" : "El fuego avanza hacia el ventilador")}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {t(lang === "en"
                ? "Without buoyancy, flames on sheets and fabrics creep upstream — against the airflow — searching for fresh oxygen."
                : "Sin flotabilidad, las llamas en láminas y telas avanzan contra el flujo de aire, buscando oxígeno fresco.")}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 text-[9px]">
            <span className="text-slate-500">{" "}{t("Evidencia")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("Saffire I-III")}{" "}</span>
            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-bold text-slate-300">{" "}{t("BASS")}{" "}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
