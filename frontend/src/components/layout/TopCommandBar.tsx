import React from "react";
import { useScenario } from "../../context/ScenarioContext";

export const TopCommandBar: React.FC = () => {
  const {
    lang,
    setLang,
    activeStep,
    setActiveStep,
    activeHabitat,
    conditions,
    activeMaterialEvaluation,
    o2VsEarthPct,
    isCustomEdited,
    resetToHabitatPreset,
  } = useScenario();

  const steps = [
    {
      num: 1 as const,
      label: lang === "en" ? "Scenario" : "Escenario",
    },
    {
      num: 2 as const,
      label: lang === "en" ? "Rank & alerts" : "Ranking y alertas",
    },
    {
      num: 3 as const,
      label: lang === "en" ? "Predict & ask" : "Predecir y preguntar",
    },
  ];

  const sign = activeMaterialEvaluation.burnMarginPts >= 0 ? "+" : "";
  const o2Sign = o2VsEarthPct >= 0 ? "+" : "";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#050A18]/95 backdrop-blur-md">
      {/* FILA 1: NAVBAR ESTRICTAMENTE HORIZONTAL */}
      <div className="mx-auto flex max-w-[1440px] flex-row items-center justify-between gap-4 overflow-x-auto px-6 py-2.5 whitespace-nowrap">
        {/* Izquierda: Logo circular con llama azul + PyraScope */}
        <div className="flex flex-row items-center gap-3 shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0B152C] border border-slate-700/80 shadow-inner">
            <div className="absolute h-5 w-5 rounded-full bg-sky-500/25 blur-sm" />
            <svg className="relative h-4 w-4 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.5C9.5 6.2 7.5 9.3 7.5 13C7.5 16.5 10.1 19.5 13.5 19.5C16.9 19.5 19.5 16.5 19.5 13C19.5 10.8 18.2 8.7 16.5 7.2C16.5 9.6 14.9 11 13.5 11C12.1 11 11.2 9.5 11.7 7.2C12 5.8 12.6 4.2 12 2.5Z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold leading-tight tracking-tight text-white">
              Flare
            </span>
            <span className="text-[11px] leading-tight text-slate-400">
              {lang === "en"
                ? "Fire-safety decisions for space habitats"
                : "Decisiones de seguridad contra incendios"}
            </span>
          </div>
        </div>

        {/* Centro: Navegación Horizontal de los 3 Pasos (Píldora Horizontal) */}
        <nav className="flex flex-row items-center rounded-full border border-slate-800/90 bg-[#091124] p-1 shrink-0">
          {steps.map((step) => {
            const isActive = activeStep === step.num;
            const isCompleted = activeStep > step.num;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(step.num)}
                className={`flex flex-row items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#112246] text-white border border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-white text-slate-950"
                      : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {isCompleted ? "✓" : step.num}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Derecha: Selector EN | ES, Botón Copilot e Insignia Space Apps */}
        <div className="flex flex-row items-center gap-2.5 shrink-0">
          <div className="flex flex-row items-center rounded-lg border border-slate-800 bg-[#091124] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-md px-2 py-1 font-bold transition ${
                lang === "en"
                  ? "bg-white text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("es")}
              className={`rounded-md px-2 py-1 font-bold transition ${
                lang === "es"
                  ? "bg-white text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ES
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className="flex flex-row items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0C1730] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400/50 hover:text-white transition"
          >
            <span className="text-sky-400">✦</span>
            <span>Copilot</span>
          </button>

          <div className="flex flex-row items-center gap-1.5 border-l border-slate-800 pl-3 text-[10px] font-mono leading-none text-slate-300">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[8px]">
              🪐
            </span>
            <div className="flex flex-col">
              <span className="font-bold tracking-wider text-white">SPACE APPS</span>
              <span className="text-[8px] tracking-widest text-slate-400">CHALLENGE</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILA 2: BARRA HORIZONTAL DE TELEMETRÍA Y ALERTAS RÁPIDAS */}
      <div className="border-t border-slate-800/70 bg-[#070E20]/95">
        <div className="mx-auto flex max-w-[1440px] flex-row items-center justify-between gap-4 overflow-x-auto px-6 py-1.5 text-xs whitespace-nowrap">
          {/* Izquierda: Escenario activo y parámetros atmosféricos */}
          <div className="flex flex-row items-center gap-2.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="font-bold text-white">
              {activeHabitat.name[lang]}
            </span>
            <span className="font-mono text-[11px] text-slate-300">
              {conditions.o2.toFixed(1)}% O₂ · {conditions.pressurePsi.toFixed(1)} psi ·{" "}
              {conditions.airflowCms.toFixed(1)} cm/s · {conditions.gravityG.toFixed(2)} g
            </span>
            {isCustomEdited && (
              <button
                type="button"
                onClick={resetToHabitatPreset}
                className="ml-1 rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 transition"
              >
                {lang === "en" ? "↺ Reset" : "↺ Restaurar"}
              </button>
            )}
          </div>

          {/* Derecha: 4 Píldoras Horizontales de Estado Físico */}
          <div className="flex flex-row items-center gap-2 shrink-0">
            {/* Píldora 1: Margen de quemado del material activo */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold border ${
                activeMaterialEvaluation.burns
                  ? "bg-[#3B121D] text-rose-300 border-rose-500/40"
                  : "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
              }`}
            >
              <span>{activeMaterialEvaluation.burns ? "🔥" : "✓"}</span>
              <span>
                {activeMaterialEvaluation.shortName}:{" "}
                {activeMaterialEvaluation.burns
                  ? lang === "en"
                    ? "Burns"
                    : "Arde"
                  : lang === "en"
                  ? "Safe"
                  : "Seguro"}{" "}
                {sign}
                {activeMaterialEvaluation.burnMarginPts.toFixed(1)} pts
              </span>
            </span>

            {/* Píldora 2: Brecha optimista de la prueba terrestre */}
            {activeMaterialEvaluation.blindSpotPts > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#33220E] px-2.5 py-0.5 font-mono text-[11px] font-medium text-amber-300 border border-amber-500/40">
                <span>⚠️</span>
                <span>
                  {lang === "en"
                    ? `Earth test optimistic by ${activeMaterialEvaluation.blindSpotPts.toFixed(1)} pts`
                    : `Prueba terrestre optimista por ${activeMaterialEvaluation.blindSpotPts.toFixed(1)} pts`}
                </span>
              </span>
            )}

            {/* Píldora 3: O2 vs Tierra */}
            <span className="inline-flex items-center rounded-full bg-[#0D172E] px-2.5 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700/80">
              O₂ {o2Sign}
              {o2VsEarthPct}% vs {lang === "en" ? "Earth" : "Tierra"}
            </span>

            {/* Píldora 4: Investigaciones muy afines */}
            <span className="inline-flex items-center rounded-full bg-[#0D172E] px-2.5 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700/80">
              {activeHabitat.strongMatchesCount}/15{" "}
              {lang === "en" ? "strong matches" : "muy afines"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};