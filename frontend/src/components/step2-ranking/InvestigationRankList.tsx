import {useT} from '../../i18n/useT';
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Map, GitCompare, MessageCircle } from "lucide-react";
import { useScenario } from "../../context/ScenarioContext";
import { fetchMissionMatch } from "../../services/api";

// 1. Agregamos una prop para avisarle al padre (o Drawer) que queremos abrir Copilot
interface RankListProps {
  onAskCopilot?: (question: string) => void;
}

export const InvestigationRankList: React.FC<RankListProps> = ({ onAskCopilot }) => {
  const t = useT();

  const { lang, conditions, safetyPillar, selectedInvestigationId, setSelectedInvestigationId, setEvidenceTab } = useScenario();
  const [rankedInvestigations, setRankedInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadRanking() {
      setLoading(true);
      const payload = {
        o2: conditions.o2,
        pressure_psi: conditions.pressurePsi,
        flow: conditions.airflowCms,
        gravity: conditions.gravityG,
        selected_pillar: safetyPillar,
      };

      const result = await fetchMissionMatch(payload);
      if (result && result.ranking) {
        setRankedInvestigations(result.ranking);
        if (!selectedInvestigationId && result.ranking[0]) setSelectedInvestigationId(result.ranking[0].investigation_id);
        if (result.ranking.length > 0) {
          setExpandedId(result.ranking[0].investigation_id || "0");
        }
      }
      setLoading(false);
    }

    loadRanking();
  }, [conditions, safetyPillar]);

  const showChart = (id: string) => {
    setSelectedInvestigationId(id);
    setEvidenceTab("inside");
    document.getElementById("investigation-evidence")?.scrollIntoView({behavior:"smooth", block:"start"});
  };

  const toggleExpand = (id: string) => {
    setSelectedInvestigationId(id);
    setEvidenceTab("inside");
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Acción del botón Preguntar a Copilot
const handleAskCopilotClick = (e: React.MouseEvent, acronym: string) => {
    e.stopPropagation(); 
    const suggestedQuestion = lang === "en" 
      ? `What does NASA PSI evidence say about ${acronym}?`
      : `¿Qué evidencia hay en NASA PSI sobre ${acronym}?`;
      
    // Disparamos un evento global con la pregunta como detalle
    window.dispatchEvent(new CustomEvent('triggerCopilot', { detail: suggestedQuestion }));
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800/90 bg-[#0B1425] p-5 shadow-2xl overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t(lang === "en" ? "NASA Investigations Ranked" : "Investigaciones NASA Ranked")}
        </h3>
        {loading && <span className="text-[10px] text-sky-400 animate-pulse">{" "}{t("Calculando motor 1...")}{" "}</span>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {rankedInvestigations.map((inv, index) => {
          const id = inv.investigation_id || index.toString();
          const isExpanded = expandedId === id;

          return (
            <div
              key={id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? "border-sky-500/50 bg-[#0F1B38] shadow-[0_0_15px_rgba(56,189,248,0.1)]"
                  : "border-slate-800/95 bg-[#081124] hover:border-slate-600"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(id)}
                className="w-full text-left p-3.5 focus:outline-none"
              >
                {/* ... (código existente del header clickable) ... */}
                <div className="flex items-start justify-between">
                  <div className="pr-4">
                    <span className="font-mono text-xs font-bold text-white">
                      <span className="text-slate-500 mr-1.5">{t(index + 1)}</span>
                      {t(inv.acronym)}
                    </span>
                    <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                      {t(inv.name)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-sm font-extrabold text-white">
                        {t(Math.round(inv.relevance_score))}
                      </span>
                      <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        {" "}{t("Score")}{" "}</span>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-slate-400">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                {!isExpanded && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/50 pt-2 font-mono text-[9px] text-slate-400">
                    <span>O₂: {t(inv.match_breakdown.o2_match_pct)}%</span>
                    <span>{" "}{t("PSI:")}{" "}{t(inv.match_breakdown.pressure_match_pct)}%</span>
                    <span>{" "}{t("Flujo:")}{" "}{t(inv.match_breakdown.flow_match_pct)}%</span>
                    <span>{" "}{t("Grav:")}{" "}{t(inv.match_breakdown.gravity_match_pct)}%</span>
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-4 pt-1 border-t border-slate-700/50 bg-[#0C152B]">
                  
                  <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
                    {inv.pillars?.map((p: string) => (
                      <span key={p} className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] text-slate-300 capitalize">
                        {t(p)}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] text-slate-300">
                      {t(inv.platform || "NASA")}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[9px] text-slate-300">
                      {t(inv.facility || "Microgravedad")}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                    {t(inv.objectives || (lang === "en" ? "No objectives reported for this investigation." : "Esta investigación no reporta objetivos."))}
                  </p>

                  {/* Barras de Coincidencia exactamente como el mockup */}
                  <div className="space-y-2.5 mb-5">
                    <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      {t(lang === "en" ? "WHY IT'S HERE" : "POR QUÉ ESTÁ AQUÍ")}
                    </span>
                    
                    <MatchProgressBar label="Coincidencia O₂" pct={inv.match_breakdown.o2_match_pct} />
                    <MatchProgressBar label="Coincidencia flujo" pct={inv.match_breakdown.flow_match_pct} />
                    <MatchProgressBar label="Coincidencia presión" pct={inv.match_breakdown.pressure_match_pct} />
                    <MatchProgressBar label="Coincidencia gravedad" pct={inv.match_breakdown.gravity_match_pct} />
                    <MatchProgressBar label="Relevancia total" pct={inv.relevance_score} isTotal />
                  </div>

                  {/* Botones de Acción (El botón Copilot llama a nuestra prop) */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => showChart(id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-slate-700">
                       {t(lang === "en" ? "View paper chart" : "Ver gráfico del paper")}
                    </button>
                    <button onClick={() => {setSelectedInvestigationId(id); setEvidenceTab("inside");}} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-slate-700">
                      <GitCompare size={13} /> {t(lang === "en" ? "What changed" : "Qué cambió")}
                    </button>
                    
                    {/* Botón Preguntar a Copilot Conectado */}
                    <button 
                      onClick={(e) => handleAskCopilotClick(e, inv.acronym)}
                      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-700/50 bg-sky-900/40 px-3 py-2 text-[10px] font-bold text-sky-400 transition hover:bg-sky-800/60 hover:shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                    >
                      <MessageCircle size={13} /> {t(lang === "en" ? "Ask Copilot about this" : "Preguntar a Copilot")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MatchProgressBar = ({ label, pct, isTotal = false }: { label: string, pct: number, isTotal?: boolean }) => {
  const t = useT();

  return (
    <div className="flex items-center gap-3 font-mono text-[10px]">
      <span className={`w-32 truncate ${isTotal ? "text-slate-300 font-bold" : "text-slate-400"}`}>
        {t(label)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ${isTotal ? "bg-[#38BDF8]" : "bg-sky-600"}`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
      <span className={`w-10 text-right ${isTotal ? "text-[#38BDF8] font-bold" : "text-sky-500"}`}>
        {t(Math.round(pct))}%
      </span>
    </div>
  );
};