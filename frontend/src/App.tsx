//frontend/src/App.tsx
'use client';

import React from "react";
import { ScenarioProvider, useScenario } from "../src/context/ScenarioContext";
import { TopCommandBar } from "../src/components/layout/TopCommandBar";

// Importamos las 3 Vistas independientes
import { Step1ScenarioView } from "../src/components/step1-scenario/Step1ScenarioView";
import { Step2RankingView } from "../src/components/step2-ranking/Step2RankingView";
import { Step3PredictorView } from "../src/components/step3-predictor/Step3PredictorView";

function MainWorkspace() {
  const { activeStep } = useScenario();

  return (
    <div className="min-h-screen bg-[#050B1A] text-slate-100 selection:bg-sky-500 selection:text-white">
      <TopCommandBar />
      
      <main className="w-full">
        {activeStep === 1 && <Step1ScenarioView />}
        {activeStep === 2 && <Step2RankingView />}
        {activeStep === 3 && <Step3PredictorView />}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <ScenarioProvider>
      <MainWorkspace />
    </ScenarioProvider>
  );
}