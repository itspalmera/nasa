import {useT} from '../../i18n/useT';
import React from "react";
import { useScenario } from "../../context/ScenarioContext";
import {
  describeFlamePhysics,
  MATERIALS_CATALOG,
} from "../../data/scenarioPresets";
import { AtmosphereTunerPanel } from "./AtmosphereTunerPanel";
import { FlameCanvasSvg } from "./FlameCanvasSvg";
import { HabitatSelectorGrid } from "./HabitatSelectorGrid";

export const Step1ScenarioView: React.FC = () => {
  const t = useT();

  const {
    lang,
    conditions,
    selectedMaterial,
    setSelectedMaterial,
    activeMaterialEvaluation,
  } = useScenario();

  const matSpec = MATERIALS_CATALOG[selectedMaterial];
  const marginSign = activeMaterialEvaluation.burnMarginPts >= 0 ? "+" : "";

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA (8 Columnas): Encabezado, 3 KPIs, 6 Tarjetas de Hábitats y Vista Previa de Llama */}
        <div className="space-y-6 lg:col-span-8">
          {/* Etiqueta de Paso y Título Principal */}
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="rounded bg-[#11244A] px-1.5 py-0.5 text-sky-400 border border-sky-500/30">
                1/3
              </span>
              <span>
                {t(lang === "en"
                  ? "STEP 1 OF 3 · CONFIGURE THE SCENARIO"
                  : "PASO 1 DE 3 · CONFIGURA EL ESCENARIO")}
              </span>
            </div>

            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t(lang === "en"
                ? "Where will the crew live?"
                : "¿Dónde vivirá la tripulación?")}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {t(lang === "en"
                ? "Pick a habitat. PyraScope ranks 30+ years of NASA fire experiments for it,"
                : "Elige un hábitat. PyraScope ordena más de 30 años de experimentos de fuego de la NASA para él,")}
              <br />
              <span className="font-semibold text-[#38BDF8]">
                {t(lang === "en"
                  ? "flags the counter-intuitive physics, and predicts what was never tested."
                  : "alerta la física contraintuitiva y predice lo que nunca se ha probado.")}
              </span>
            </p>
          </div>

          {/* 3 Tarjetas de Contexto PSI (30+, 15 · 70, 0) */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800/90 bg-[#081124]/85 px-4 py-3.5">
              <div className="flex items-center gap-2 font-mono text-lg font-extrabold text-white">
                <span className="text-sky-400 text-sm">🗄️</span>
                <span>30+</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t(lang === "en"
                  ? "years of shuttle & ISS fire data scattered across PDFs, videos & CSVs"
                  : "años de datos de fuego en transbordador e ISS dispersos en PDFs, videos y CSVs")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-[#081124]/85 px-4 py-3.5">
              <div className="flex items-center gap-2 font-mono text-lg font-extrabold text-white">
                <span className="text-sky-400 text-sm">💠</span>
                <span>15 · 70</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t(lang === "en"
                  ? "PSI investigations · curated runs, normalised to one schema"
                  : "investigaciones PSI · corridas curadas en un único esquema")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-[#081124]/85 px-4 py-3.5">
              <div className="flex items-center gap-2 font-mono text-lg font-extrabold text-white">
                <span className="text-amber-400 text-sm">⚠️</span>
                <span>0</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t(lang === "en"
                  ? "direct fire data points at lunar or Martian gravity"
                  : "datos directos de fuego en gravedad lunar o marciana")}
              </p>
            </div>
          </div>

          {/* Grilla de los 6 Hábitats */}
          <HabitatSelectorGrid />
          <div className="rounded-xl border border-slate-700 bg-[#081124] p-5">
            <label htmlFor="scenario-material" className="mb-2 block text-sm font-bold">{t(lang === "en" ? "Material for your scenario" : "Material para tu escenario")}</label>
            <select id="scenario-material" value={selectedMaterial} onChange={event => setSelectedMaterial(event.target.value as typeof selectedMaterial)} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3">
              {Object.values(MATERIALS_CATALOG).map(material => <option key={material.id} value={material.id}>{t(material.name[lang])} — {t(material.subtitle[lang])}</option>)}
            </select>
          </div>

          {/* Tarjeta Inferior: VISTA PREVIA DE LA LLAMA (En la Tierra vs En tu escenario) */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#081124]/90 p-5">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              {/* Dos medidores circulares lado a lado */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center">
                  <FlameCanvasSvg
                    gravityG={1.0}
                    o2Pct={20.9}
                    airflowCms={10.0}
                    size="md"
                    variant="earth-1g"
                  />
                  <span className="mt-2 text-xs font-bold text-white">
                    {t(lang === "en" ? "On Earth" : "En la Tierra")}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    1 g · 20.9% O₂
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <FlameCanvasSvg
                    gravityG={conditions.gravityG}
                    o2Pct={conditions.o2}
                    airflowCms={conditions.airflowCms}
                    size="md"
                    variant="scenario"
                  />
                  <span className="mt-2 text-xs font-bold text-white">
                    {t(lang === "en" ? "In your scenario" : "En tu escenario")}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {t(conditions.gravityG.toFixed(2))} g · {t(conditions.o2.toFixed(1))}% O₂
                  </span>
                </div>
              </div>

              {/* Explicación física y margen frente a su límite de oxígeno */}
              <div className="flex-1 space-y-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t(lang === "en"
                    ? "LIVE FLAME PREVIEW"
                    : "VISTA PREVIA DE LA LLAMA")}
                </span>
                <h3 className="text-base font-bold text-white">
                  {t(lang === "en"
                    ? "How fire looks where you are designing"
                    : "Cómo se ve el fuego donde diseñas")}
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  {t(describeFlamePhysics(conditions, lang))}
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-white">
                    {t(matSpec.name[lang])}
                  </span>
                  {activeMaterialEvaluation.available === false ? <span className="text-sky-300">{t(lang === "en" ? "Consult source-linked measurements in step 3. Oxygen threshold unavailable." : "Consulta las mediciones con fuentes en el paso 3. Umbral de oxígeno no disponible.")}</span> : <><span
                    className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                      activeMaterialEvaluation.burns
                        ? "bg-[#3B121D] text-rose-300 border border-rose-500/40"
                        : "bg-emerald-950/70 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {t(activeMaterialEvaluation.burns
                      ? lang === "en"
                        ? "Burns"
                        : "Arde"
                      : lang === "en"
                      ? "Safe"
                      : "Seguro")}{" "}{t(" ")}{" "}
                    · {t(marginSign)}
                    {t(activeMaterialEvaluation.burnMarginPts.toFixed(1))} {" "}{t("pts")}{" "}</span>
                  <span className="text-slate-400">
                    {t(lang === "en"
                      ? "vs its oxygen limit"
                      : "vs su límite de oxígeno")}
                  </span></>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (4 Columnas): Panel "Ajusta la atmósfera" con la llama arriba */}
        <div className="lg:col-span-4">
          <AtmosphereTunerPanel />
        </div>
      </div>
    </section>
  );
};