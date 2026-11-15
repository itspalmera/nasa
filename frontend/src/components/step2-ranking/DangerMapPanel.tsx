import {useT} from '../../i18n/useT';
import React from "react";
import { useScenario } from "../../context/ScenarioContext";
import { HeadToHeadPanel } from "./HeadToHeadPanel";
import { InsideInvestigationPanel } from "./InsideInvestigationPanel";

export const DangerMapPanel = () => {
  const t = useT();

  const {lang, evidenceTab, setEvidenceTab} = useScenario();
  return <div id="investigation-evidence" className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1425]">
    <div className="flex flex-wrap gap-2 border-b border-slate-700 p-3" role="group" aria-label={lang === "en" ? "Evidence view" : "Vista de evidencia"}>
      <button type="button" aria-pressed={evidenceTab !== "compare"} onClick={() => setEvidenceTab("inside")} className="rounded-lg border border-slate-600 px-3 py-2 text-xs aria-pressed:bg-sky-900">{t(lang === "en" ? "Inside an investigation" : "Dentro de una investigación")}</button>
      <button type="button" aria-pressed={evidenceTab === "compare"} onClick={() => setEvidenceTab("compare")} className="rounded-lg border border-slate-600 px-3 py-2 text-xs aria-pressed:bg-sky-900">{t(lang === "en" ? "Compare investigations" : "Comparar investigaciones")}</button>
    </div>
    {evidenceTab === "compare" ? <HeadToHeadPanel/> : <InsideInvestigationPanel/>}
  </div>;
};
