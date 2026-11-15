import {useT} from '../../i18n/useT';
import React from "react";
import { useScenario } from "../../context/ScenarioContext";
import {
  evaluateMaterialInAtmosphere,
  HABITAT_PRESETS,
} from "../../data/scenarioPresets";
import { HabitatPreset, MaterialId } from "../../Models/scenario";

/**
 * Miniaturas circulares ilustradas idénticas a la estética espacial del mockup image_b17a5f.png
 */
const HabitatArtworkThumbnail: React.FC<{ preset: HabitatPreset }> = ({ preset }) => {
  const t = useT();

  return (
    <div className="relative h-14 w-14 rounded-full border border-slate-700/80 bg-[#050A14] shadow-md overflow-hidden shrink-0">
      {preset.iconType === "moon" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#030712" />
          <circle cx="48" cy="16" r="1.2" fill="#94A3B8" />
          <circle cx="18" cy="14" r="1" fill="#CBD5E1" />
          {/* Horizonte lunar gris con cráteres */}
          <path d="M0 38 Q32 30 64 38 L64 64 L0 64 Z" fill="#94A3B8" />
          <path d="M0 44 Q28 38 64 45 L64 64 L0 64 Z" fill="#64748B" />
          <ellipse cx="22" cy="48" rx="8" ry="2.5" fill="#475569" />
          <ellipse cx="44" cy="53" rx="6" ry="2" fill="#334155" />
        </svg>
      )}
      {preset.iconType === "rover" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#040814" />
          <path d="M0 42 Q32 36 64 42 L64 64 L0 64 Z" fill="#78716C" />
          {/* Rover presurizado sobre superficie lunar */}
          <rect x="18" y="25" width="24" height="13" rx="4" fill="#E2E8F0" />
          <rect x="22" y="27" width="9" height="6" rx="1.5" fill="#0284C7" />
          <circle cx="22" cy="40" r="4.5" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
          <circle cx="38" cy="40" r="4.5" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
          <line x1="42" y1="25" x2="47" y2="18" stroke="#CBD5E1" strokeWidth="1.5" />
          <circle cx="47" cy="18" r="2.5" fill="#F59E0B" />
        </svg>
      )}
      {preset.iconType === "mars" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#030611" />
          <defs>
            <radialGradient id="marsGlobe" cx="38%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#FDBA74" />
              <stop offset="55%" stopColor="#C2410C" />
              <stop offset="100%" stopColor="#431407" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="20" fill="url(#marsGlobe)" />
          <path d="M20 28 Q30 24 42 30 Q34 36 22 34 Z" fill="#7C2D12" fillOpacity="0.45" />
          <ellipse cx="32" cy="15" rx="6" ry="1.8" fill="#FFF7ED" fillOpacity="0.7" />
        </svg>
      )}
      {preset.iconType === "iss" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#04091A" />
          <path d="M0 50 Q32 40 64 50 L64 64 L0 64 Z" fill="#1E3A8A" fillOpacity="0.6" />
          {/* Paneles solares dorados de la ISS */}
          <rect x="8" y="20" width="9" height="24" rx="1" fill="#D97706" stroke="#FBBF24" strokeWidth="0.8" />
          <rect x="20" y="22" width="7" height="20" rx="1" fill="#B45309" stroke="#FBBF24" strokeWidth="0.8" />
          <rect x="37" y="22" width="7" height="20" rx="1" fill="#B45309" stroke="#FBBF24" strokeWidth="0.8" />
          <rect x="47" y="20" width="9" height="24" rx="1" fill="#D97706" stroke="#FBBF24" strokeWidth="0.8" />
          <line x1="6" y1="32" x2="58" y2="32" stroke="#E2E8F0" strokeWidth="2.2" />
          <rect x="29" y="26" width="6" height="12" rx="1.5" fill="#CBD5E1" />
        </svg>
      )}
      {preset.iconType === "suit" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#02050E" />
          {/* Curvatura azul de la Tierra vista en EVA */}
          <path d="M0 44 Q32 34 64 46 L64 64 L0 64 Z" fill="#0284C7" />
          <path d="M0 46 Q32 36 64 48" fill="none" stroke="#7DD3FC" strokeWidth="2" />
          <circle cx="28" cy="24" r="4.5" fill="#F8FAFC" />
          <rect x="25.5" y="22" width="5" height="3.5" rx="1" fill="#F59E0B" />
        </svg>
      )}
      {preset.iconType === "mine" && (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <rect width="64" height="64" fill="#1C1408" />
          {/* Túnel minero subterráneo iluminado */}
          <path d="M8 58 L18 18 Q32 10 46 18 L56 58 Z" fill="#452B0D" stroke="#78350F" strokeWidth="2" />
          <circle cx="32" cy="28" r="10" fill="#F59E0B" fillOpacity="0.45" />
          <circle cx="32" cy="28" r="4" fill="#FEF08A" />
          <path d="M16 58 L26 36 L38 36 L48 58 Z" fill="#78350F" />
        </svg>
      )}
    </div>
  );
};

export const HabitatSelectorGrid: React.FC = () => {
  const t = useT();

  const {
    lang,
    selectedHabitatId,
    selectHabitat,
    selectedMaterial,
    conditions,
  } = useScenario();

  const materialsOrder: MaterialId[] = ["pmma", "sibal", "nomex"];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-bold text-white">
          {t(lang === "en" ? "Choose a habitat" : "Elige un hábitat")}
        </h2>
        <span className="text-xs text-slate-400">
          {t(lang === "en"
            ? "— each card previews how materials behave there"
            : "— cada tarjeta anticipa cómo se comportan los materiales allí")}
        </span>
      </div>

      {/* Grilla 3x2 de Tarjetas de Hábitats */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {HABITAT_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedHabitatId;
          const cardConditions = isSelected ? conditions : preset.conditions;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectHabitat(preset.id)}
              className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all ${
                isSelected
                  ? "bg-[#0D1A36] border-2 border-[#38BDF8] shadow-[0_0_24px_rgba(56,189,248,0.16)]"
                  : "bg-[#081124]/90 border border-slate-800/90 hover:border-slate-700 hover:bg-[#0B162E]"
              }`}
            >
              <div>
                {/* Fila superior: Miniatura Planetaria + Check azul */}
                <div className="mb-3 flex items-start justify-between">
                  <HabitatArtworkThumbnail preset={preset} />
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition ${
                      isSelected
                        ? "bg-[#60A5FA] text-slate-950 font-extrabold shadow-sm"
                        : "border border-slate-700 bg-slate-900/50 group-hover:border-slate-500"
                    }`}
                  >
                    {t(isSelected ? "✓" : "")}
                  </span>
                </div>

                {/* Nombre y Subtítulo del Hábitat */}
                <h3 className="text-[15px] font-bold leading-snug text-white">
                  {t(preset.name[lang])}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400 min-h-[32px]">
                  {t(preset.subtitle[lang])}
                </p>

                {/* Píldoras de O2, Presión (psi) y Gravedad (g) */}
                <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
                  <span className="rounded bg-[#111C35] px-2 py-0.5 text-slate-200 border border-slate-700/70">
                    {t(cardConditions.o2 % 1 === 0
                      ? cardConditions.o2.toFixed(0)
                      : cardConditions.o2.toFixed(1))}
                    % O₂
                  </span>
                  <span className="rounded bg-[#111C35] px-2 py-0.5 text-slate-200 border border-slate-700/70">
                    {t(cardConditions.pressurePsi.toFixed(1))} {" "}{t("psi")}{" "}</span>
                  <span className="rounded bg-[#111C35] px-2 py-0.5 text-slate-200 border border-slate-700/70">
                    {t(cardConditions.gravityG.toFixed(2))} g
                  </span>
                </div>
              </div>

              {/* Sección Inferior: MARGEN POR MATERIAL */}
              <div className="mt-4 pt-2.5">
                <span className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  {t(lang === "en"
                    ? "BURN MARGIN BY MATERIAL"
                    : "MARGEN POR MATERIAL")}
                </span>

                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {materialsOrder.map((matId) => {
                    const evalRes = evaluateMaterialInAtmosphere(
                      matId,
                      cardConditions
                    );
                    const isActiveMat = selectedMaterial === matId;
                    const sign = evalRes.burnMarginPts >= 0 ? "+" : "";

                    return (
                      <div
                        key={matId}
                        className={`rounded-lg px-2 py-1 font-mono transition ${
                          evalRes.burns
                            ? "bg-[#2C1221] text-rose-300"
                            : "bg-[#0D2329] text-slate-300"
                        } ${
                          isActiveMat
                            ? "border border-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.25)]"
                            : "border border-transparent opacity-90"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[9px] text-slate-300">
                          <span className="text-[8px]">
                            {t(evalRes.burns ? "🔥" : "❄️")}
                          </span>
                          <span className="truncate font-semibold">
                            {t(evalRes.shortName)}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] font-bold ${
                            evalRes.burns ? "text-rose-300" : "text-slate-300"
                          }`}
                        >
                          {t(sign)}
                          {t(evalRes.burnMarginPts.toFixed(1))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Nota al pie de la grilla */}
      <p className="mt-2.5 text-[11px] text-slate-400">
        {t(lang === "en"
          ? "Burn margin = cabin O₂ minus the minimum O₂ the material needs to keep burning at that airflow, pressure and gravity. Positive = it burns."
          : "Margen = O₂ de la cabina menos el O₂ mínimo que el material necesita para seguir ardiendo con ese flujo, presión y gravedad. Positivo = arde.")}
      </p>
    </div>
  );
};