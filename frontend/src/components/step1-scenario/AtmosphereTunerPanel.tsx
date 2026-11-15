import {useT} from '../../i18n/useT';
import React from "react";
import { useScenario } from "../../context/ScenarioContext";
import {
  GRAVITY_QUICK_STOPS,
  MATERIALS_CATALOG,
} from "../../data/scenarioPresets";
import { MaterialId, SafetyPillar } from "../../Models/scenario";
import { FlameCanvasSvg } from "./FlameCanvasSvg";

export const AtmosphereTunerPanel: React.FC = () => {
  const t = useT();

  const {
    lang,
    conditions,
    updateCondition,
    selectedMaterial,
    setSelectedMaterial,
    safetyPillar,
    setSafetyPillar,
    activeMaterialEvaluation,
    setActiveStep,
  } = useScenario();

  const materialsList: MaterialId[] = ["cellulose", "pmma", "sibal", "nomex"];
  const pillarsList: {
    id: SafetyPillar;
    icon: string;
    label: { en: string; es: string };
  }[] = [
    { id: "all", icon: "", label: { en: "All", es: "Todos" } },
    { id: "prevention", icon: "🛡️", label: { en: "Prevention", es: "Prevención" } },
    { id: "detection", icon: "📡", label: { en: "Detection", es: "Detección" } },
    { id: "suppression", icon: "🧯", label: { en: "Suppression", es: "Supresión" } },
  ];

  // Posiciones porcentuales exactas para las marcas de referencia debajo de los sliders
  const earthO2LeftPct = ((20.9 - 12.0) / (100.0 - 12.0)) * 100; // ~10.1%
  const earthPsiLeftPct = ((14.7 - 3.0) / (18.0 - 3.0)) * 100;  // ~78%
  const issFlowLeftPct = ((10.0 - 0.0) / (40.0 - 0.0)) * 100;   // 25%

  const marginSign = activeMaterialEvaluation.burnMarginPts >= 0 ? "+" : "";

  return (
    <aside className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#081124]/95 p-5 shadow-2xl">
      <div>
        {/* Título del Panel */}
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-white">
            {t(lang === "en" ? "Fine-tune atmosphere" : "Ajusta la atmósfera")}
          </h2>
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-[10px] text-slate-400">
            i
          </span>
        </div>

        {/* IMAGEN DEL FUEGO SOBRE LA INFORMACIÓN DE LA ATMÓSFERA */}
        <div className="mt-3.5 mb-5 flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-[#050B18] px-4 py-3.5 shadow-inner">
          <FlameCanvasSvg
            gravityG={conditions.gravityG}
            o2Pct={conditions.o2}
            airflowCms={conditions.airflowCms}
            size="md"
            variant="scenario"
          />
          <p className="mt-2 text-[11px] font-medium text-slate-300">
            {t(lang === "en"
              ? "Illustrative flame for your gravity & O₂"
              : "Llama ilustrativa según tu gravedad y O₂")}
          </p>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-sky-400">
            <span>{t(conditions.o2.toFixed(1))}% O₂</span>
            <span>·</span>
            <span>{t(conditions.pressurePsi.toFixed(1))} {" "}{t("psi")}{" "}</span>
            <span>·</span>
            <span>{t(conditions.gravityG.toFixed(2))} g</span>
          </div>
        </div>

        {/* 4 Sliders de Condiciones Atmosféricas */}
        <div className="space-y-5">
          {/* 1. Oxígeno */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="text-sky-400">💧</span>
                <span>{t(lang === "en" ? "Oxygen" : "Oxígeno")}</span>
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {t(conditions.o2.toFixed(1))}{" "}{t(" ")}{" "}
                <span className="text-xs font-normal text-slate-400">% O₂</span>
              </span>
            </div>
            <input
              type="range"
              min={12.0}
              max={100.0}
              step={0.5}
              value={conditions.o2}
              onChange={(e) => updateCondition("o2", parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-[#38BDF8]"
            />
            <div className="relative mt-1 h-4 font-mono text-[10px] text-slate-500">
              <span
                style={{ left: `${earthO2LeftPct}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center leading-none"
              >
                <span className="text-[8px] text-slate-600">|</span>
                <span>{t(lang === "en" ? "Earth" : "Tierra")}</span>
              </span>
            </div>
          </div>

          {/* 2. Presión de cabina */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="text-sky-400">⏲️</span>
                <span>{t(lang === "en" ? "Cabin pressure" : "Presión de cabina")}</span>
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {t(conditions.pressurePsi.toFixed(1))}{" "}{t(" ")}{" "}
                <span className="text-xs font-normal text-slate-400">{" "}{t("psi")}{" "}</span>
              </span>
            </div>
            <input
              type="range"
              min={3.0}
              max={18.0}
              step={0.1}
              value={conditions.pressurePsi}
              onChange={(e) =>
                updateCondition("pressurePsi", parseFloat(e.target.value))
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-[#38BDF8]"
            />
            <div className="relative mt-1 h-4 font-mono text-[10px] text-slate-500">
              <span
                style={{ left: `${earthPsiLeftPct}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center leading-none"
              >
                <span className="text-[8px] text-slate-600">|</span>
                <span>{t(lang === "en" ? "Earth" : "Tierra")}</span>
              </span>
            </div>
          </div>

          {/* 3. Flujo de ventilación */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="text-sky-400">💨</span>
                <span>
                  {t(lang === "en" ? "Ventilation airflow" : "Flujo de ventilación")}
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {t(conditions.airflowCms.toFixed(1))}{" "}{t(" ")}{" "}
                <span className="text-xs font-normal text-slate-400">{" "}{t("cm/s")}{" "}</span>
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={40.0}
              step={0.5}
              value={conditions.airflowCms}
              onChange={(e) =>
                updateCondition("airflowCms", parseFloat(e.target.value))
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-[#38BDF8]"
            />
            <div className="relative mt-1 h-4 font-mono text-[10px] text-slate-500">
              <span
                style={{ left: `${issFlowLeftPct}%` }}
                className="absolute -translate-x-1/2 flex flex-col items-center leading-none"
              >
                <span className="text-[8px] text-slate-600">|</span>
                <span>{" "}{t("ISS")}{" "}</span>
              </span>
            </div>
          </div>

          {/* 4. Gravedad + Botones Rápidos */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="text-sky-400">🪐</span>
                <span>{t(lang === "en" ? "Gravity" : "Gravedad")}</span>
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {t(conditions.gravityG.toFixed(2))}{" "}{t(" ")}{" "}
                <span className="text-xs font-normal text-slate-400">g</span>
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.01}
              value={conditions.gravityG}
              onChange={(e) =>
                updateCondition("gravityG", parseFloat(e.target.value))
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-[#38BDF8]"
            />

            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {GRAVITY_QUICK_STOPS.map((stop) => {
                const isSelectedG = Math.abs(conditions.gravityG - stop.g) < 0.02;
                return (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => updateCondition("gravityG", stop.g)}
                    className={`rounded-lg py-1.5 font-mono text-[10px] font-semibold transition ${
                      isSelectedG
                        ? "bg-[#11244A] text-white border border-[#38BDF8]"
                        : "bg-[#0B152B] text-slate-400 border border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {t(stop.label[lang])}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
      {/* Botón Blanco Principal -> Paso 2 */}
      <button
        type="button"
        onClick={() => setActiveStep(2)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-bold text-slate-950 shadow-lg hover:bg-slate-100 transition"
      >
        <span>
          {t(lang === "en"
            ? "See ranked evidence & alerts"
            : "Ver evidencia y alertas")}
        </span>
        <span>→</span>
      </button>
    </aside>
  );
};