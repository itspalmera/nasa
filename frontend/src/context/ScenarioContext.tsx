//frontend/src/context/ScenarioContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import {
  AtmosphereConditions,
  HabitatId,
  HabitatPreset,
  Language,
  MaterialEvaluation,
  MaterialId,
  SafetyPillar,
} from "../Models/scenario";
import {
  evaluateMaterialInAtmosphere,
  HABITAT_PRESETS,
} from "../data/scenarioPresets";

interface ScenarioContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  activeStep: 1 | 2 | 3 | 4;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  selectedHabitatId: HabitatId;
  activeHabitat: HabitatPreset;
  selectHabitat: (id: HabitatId) => void;
  conditions: AtmosphereConditions;
  updateCondition: <K extends keyof AtmosphereConditions>(
    key: K,
    value: AtmosphereConditions[K]
  ) => void;
  selectedMaterial: MaterialId;
  setSelectedMaterial: (mat: MaterialId) => void;
  selectedInvestigationId: string;
  setSelectedInvestigationId: (id: string) => void;
  evidenceTab: "map" | "compare" | "inside";
  setEvidenceTab: (tab: "map" | "compare" | "inside") => void;
  safetyPillar: SafetyPillar;
  setSafetyPillar: (pillar: SafetyPillar) => void;
  activeMaterialEvaluation: MaterialEvaluation;
  allMaterialsEvaluation: Record<MaterialId, MaterialEvaluation>;
  o2VsEarthPct: number;
  isCustomEdited: boolean;
  resetToHabitatPreset: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | undefined>(undefined);

export const ScenarioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Idioma español por defecto tal como en el mockup image_b17a5f.png
  const [lang, setLang] = useState<Language>("es");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedHabitatId, setSelectedHabitatId] = useState<HabitatId>(
    "artemis_lunar_base"
  );
  const [conditions, setConditions] = useState<AtmosphereConditions>(
    HABITAT_PRESETS[0].conditions
  );
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialId>("cellulose");
  const [selectedInvestigationId, setSelectedInvestigationId] = useState("");
  const [evidenceTab, setEvidenceTab] = useState<"map" | "compare" | "inside">("map");
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const [safetyPillar, setSafetyPillar] = useState<SafetyPillar>("all");

  const activeHabitat = useMemo(
    () =>
      HABITAT_PRESETS.find((h) => h.id === selectedHabitatId) ||
      HABITAT_PRESETS[0],
    [selectedHabitatId]
  );

  const selectHabitat = (id: HabitatId) => {
    const found = HABITAT_PRESETS.find((h) => h.id === id);
    if (found) {
      setSelectedHabitatId(id);
      setConditions({ ...found.conditions });
    }
  };

  const updateCondition = <K extends keyof AtmosphereConditions>(
    key: K,
    value: AtmosphereConditions[K]
  ) => {
    setConditions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetToHabitatPreset = () => {
    setConditions({ ...activeHabitat.conditions });
  };

  const isCustomEdited = useMemo(() => {
    const base = activeHabitat.conditions;
    return (
      Math.abs(conditions.o2 - base.o2) > 0.05 ||
      Math.abs(conditions.pressurePsi - base.pressurePsi) > 0.05 ||
      Math.abs(conditions.airflowCms - base.airflowCms) > 0.05 ||
      Math.abs(conditions.gravityG - base.gravityG) > 0.005
    );
  }, [conditions, activeHabitat]);

  const allMaterialsEvaluation = useMemo(() => {
    return {
      cellulose: evaluateMaterialInAtmosphere("cellulose", conditions),
      pmma: evaluateMaterialInAtmosphere("pmma", conditions),
      sibal: evaluateMaterialInAtmosphere("sibal", conditions),
      nomex: evaluateMaterialInAtmosphere("nomex", conditions),
    };
  }, [conditions]);

  const activeMaterialEvaluation = allMaterialsEvaluation[selectedMaterial];

  // Referencia terrestre 20.9% O2 -> a 30.0% O2 da exactamente +44% vs Tierra
  const o2VsEarthPct = useMemo(() => {
    return Math.round(((conditions.o2 - 20.9) / 20.9) * 100);
  }, [conditions.o2]);

  return (
    <ScenarioContext.Provider
      value={{
        lang,
        setLang,
        activeStep,
        setActiveStep,
        selectedHabitatId,
        activeHabitat,
        selectHabitat,
        conditions,
        updateCondition,
        selectedMaterial,
        setSelectedMaterial,
        selectedInvestigationId, setSelectedInvestigationId, evidenceTab, setEvidenceTab,
        safetyPillar,
        setSafetyPillar,
        activeMaterialEvaluation,
        allMaterialsEvaluation,
        o2VsEarthPct,
        isCustomEdited,
        resetToHabitatPreset,
      }}
    >
      {children}
    </ScenarioContext.Provider>
  );
};

export const useScenario = (): ScenarioContextValue => {
  const ctx = useContext(ScenarioContext);
  if (!ctx) {
    throw new Error("useScenario must be used within a ScenarioProvider");
  }
  return ctx;
};