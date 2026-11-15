//frontend/src/components/step3-predictor/DecisionBriefModal.tsx
import {useT} from '../../i18n/useT';
import React from "react";
import { Copy, Download, AlertTriangle, FileText } from "lucide-react";
import { useScenario } from "../../context/ScenarioContext";

export const DecisionBriefModal: React.FC = () => {
  const t = useT();

  const { lang, activeHabitat, conditions } = useScenario();

  return (
    <div className="mt-6 rounded-2xl border border-slate-700 bg-[#081124] shadow-2xl overflow-hidden">
      
      {/* Elemento 1: Cabecera */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#0A1429] px-6 py-4">
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            <FileText size={12} /> {t(lang === "en" ? "RESULT" : "RESULTADO")}
          </span>
          <h2 className="text-2xl font-bold text-white">
            {t(lang === "en" ? "Your decision brief" : "Tu informe de decisión")}
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-400">
            {t(lang === "en"
              ? "Everything above, compiled into evidence-backed actions for the three uses of this data according to NASA: materials screening, suppression design, and safety protocols. Every line is traceable to a PSI investigation."
              : "Todo lo anterior, compilado en acciones respaldadas por evidencia para los tres usos de estos datos según la NASA: evaluación de materiales, diseño de supresión y protocolos de seguridad. Cada línea es trazable a una investigación PSI.")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="flex items-center gap-2 rounded-lg border border-slate-600 bg-transparent px-4 py-2 text-[11px] font-bold text-white hover:bg-slate-800 transition">
            <Copy size={14} /> {t(lang === "en" ? "Copy" : "Copiar")}
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[11px] font-bold text-slate-900 shadow-sm hover:bg-slate-100 transition">
            <Download size={14} /> {t(lang === "en" ? "Download brief" : "Descargar informe")}
          </button>
        </div>
      </div>

      {/* Elemento 2: Grilla con las tarjetas */}
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-4">
        
        {/* Columna 1: Veredicto */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-[#050A15] p-5">
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-slate-500">
              {t(lang === "en" ? "VERDICT" : "VEREDICTO")}
            </span>
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-1 text-rose-500" />
              <h3 className="text-[15px] font-extrabold leading-snug text-white">
                {t(lang === "en" ? "Acrylic (PMMA) is NOT acceptable as-is" : "Acrílico (PMMA) NO es aceptable tal cual")}
              </h3>
            </div>
          </div>
          
          <div className="space-y-2 border-y border-slate-800 py-3 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500">{t(lang === "en" ? "Scenario" : "Escenario")}</span>
              <strong className="text-white">{t(activeHabitat.name[lang])}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t(lang === "en" ? "Atmosphere" : "Atmósfera")}</span>
              <strong className="text-white">{t(conditions.o2.toFixed(1))}% - {t(conditions.pressurePsi.toFixed(1))} {" "}{t("psi")}{" "}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t(lang === "en" ? "Flow - gravity" : "Flujo - gravedad")}</span>
              <strong className="text-white">{t(conditions.airflowCms.toFixed(1))} {" "}{t("cm/s -")}{" "}{t(conditions.gravityG.toFixed(2))} g</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t(lang === "en" ? "Margin" : "Margen")}</span>
              <strong className="text-rose-400">{" "}{t("+13.4 pts ·")}{" "}{t(lang === "en" ? "Burns" : "Arde")}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t(lang === "en" ? "Earth blind spot" : "Punto ciego terrestre")}</span>
              <strong className="text-white">{" "}{t("-1.0 pts")}{" "}</strong>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-500">
              {t(lang === "en" ? "READ FIRST" : "LEER PRIMERO")}
            </span>
            <div className="space-y-2 font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">1</span>
                <strong className="w-14 text-white">{" "}{t("SoFIE")}{" "}</strong>
                <div className="h-1.5 flex-1 rounded-full bg-[#11244A]"><div className="h-full w-[96%] rounded-full bg-[#38BDF8]"></div></div>
                <span className="text-slate-400">96</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">2</span>
                <strong className="w-14 text-white">{" "}{t("BASS-II")}{" "}</strong>
                <div className="h-1.5 flex-1 rounded-full bg-[#11244A]"><div className="h-full w-[81%] rounded-full bg-[#38BDF8]"></div></div>
                <span className="text-slate-400">81</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">3</span>
                <strong className="w-14 text-white">{" "}{t("BASS")}{" "}</strong>
                <div className="h-1.5 flex-1 rounded-full bg-[#11244A]"><div className="h-full w-[81%] rounded-full bg-[#38BDF8]"></div></div>
                <span className="text-slate-400">81</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna 2: Evaluación */}
        <div className="rounded-xl border border-slate-800 bg-[#0C1529] p-5">
          <h4 className="mb-3 text-[13px] font-bold text-white">
            {t(lang === "en" ? "Materials screening" : "Evaluación de materiales")}
          </h4>
          <ul className="space-y-3 pl-4 text-[11px] leading-relaxed text-slate-300 list-disc marker:text-[#38BDF8]">
            <li>
              {t(lang === "en"
                ? `Reject qualification by Earth test alone: at ${conditions.o2.toFixed(1)}% O₂ the material sits +13.4 pts above its limit. Re-test at ${conditions.pressurePsi.toFixed(1)} psi / ${conditions.o2.toFixed(1)}% O₂ with opposed flow of 5–20 cm/s (SoFIE style).`
                : `Rechazar la calificación solo con prueba terrestre: con ${conditions.o2.toFixed(1)}% de O₂ el material queda +13.4 pts sobre su límite. Re-probar a ${conditions.pressurePsi.toFixed(1)} psi / ${conditions.o2.toFixed(1)}% O₂ con flujo opuesto de 5–20 cm/s (tipo SoFIE).`)}
            </li>
            <li>
              {t(lang === "en"
                ? "Apply a design margin of 1.5 pts of O₂: Earth tests are optimistic by 1.0 pts here."
                : "Aplicar un margen de diseño de 1.5 pts de O₂: las pruebas terrestres son optimistas en 1.0 pts aquí.")}
            </li>
          </ul>
        </div>

        {/* Columna 3: Supresión */}
        <div className="rounded-xl border border-slate-800 bg-[#0C1529] p-5">
          <h4 className="mb-3 text-[13px] font-bold text-white">
            {t(lang === "en" ? "Suppression design" : "Diseño de supresión")}
          </h4>
          <ul className="space-y-3 pl-4 text-[11px] leading-relaxed text-slate-300 list-disc marker:text-[#38BDF8]">
            <li>
              {t(lang === "en"
                ? "Use total-flooding dilution (CO₂/He, per FLEX) or water mist. Avoid targeted N₂ jets, which can fan the flame (BASS)."
                : "Usar dilución por inundación total (CO₂/He, según FLEX) o niebla de agua. Evitar chorros dirigidos de N₂, que pueden avivar la llama (BASS).")}
            </li>
            <li>
              {t(lang === "en"
                ? 'Maintain "fire out" declaration hold until temperature and gases confirm no cool flame remains (FLEX, CFI).'
                : 'Mantener la declaración de "fuego apagado" hasta que temperatura y gases confirmen que no queda llama fría (FLEX, CFI).')}
            </li>
          </ul>
        </div>

        {/* Columna 4: Protocolos */}
        <div className="rounded-xl border border-slate-800 bg-[#0C1529] p-5">
          <h4 className="mb-3 text-[13px] font-bold text-white">
            {t(lang === "en" ? "Safety protocols" : "Protocolos de seguridad")}
          </h4>
          <ul className="space-y-3 pl-4 text-[11px] leading-relaxed text-slate-300 list-disc marker:text-[#38BDF8]">
            <li>
              {t(lang === "en"
                ? "Upon alarm, halt ventilation in the affected module to exit the 3–25 cm/s danger band and stop propagation."
                : "Ante una alarma, detener la ventilación del módulo afectado para salir de la banda de peligro de 3-25 cm/s y frenar la propagación.")}
            </li>
            <li>
              {t(lang === "en"
                ? "Place detectors in the flow return path and calibrate for larger smoke particles in microgravity (SAME)."
                : "Ubicar detectores en la ruta de retorno del flujo y calibrar para partículas de humo más grandes en microgravedad (SAME).")}
            </li>
            <li>
              {t(lang === "en"
                ? `Values at ${conditions.gravityG.toFixed(2)} g are predictions (±0.3 pts). Flag for validation with LUCI / FM2 data.`
                : `Los valores a ${conditions.gravityG.toFixed(2)} g son predicciones (±0.3 pts). Marcar para validación con datos LUCI / FM2.`)}
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
};