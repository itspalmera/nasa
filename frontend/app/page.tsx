// frontend/app/page.tsx
'use client';

import React, { useState } from 'react';
import CopilotDrawer from '../components/layout/copilot-drawer';
import Navbar from '../components/layout/navbar';
import ScenarioRibbon from '../components/layout/scenario-ribbon';
import { HABITAT_PRESETS } from '../data/mocks/flare.mock';
import { HabitatPreset, ViewStep } from '../models/flare.model';
import HomeView from '../views/home-view';
import { HABITAT_PRESETS as scenarioPresets } from '../src/data/scenarioPresets';

// Importamos el ScenarioProvider global y tus vistas modulares
import { useScenario, ScenarioProvider } from "../src/context/ScenarioContext";
import { Step1ScenarioView } from "../src/components/step1-scenario/Step1ScenarioView";
import { Step2RankingView } from "../src/components/step2-ranking/Step2RankingView";
import { Step3PredictorView } from "../src/components/step3-predictor/Step3PredictorView";
import { Step4CopilotView } from "../src/components/step4-copilot/Step4CopilotView";

function MainAppContent() {
  const scenario = useScenario();
  const [home, setHome] = useState(true);
  const steps: ViewStep[] = ['scenario', 'ranking', 'predict', 'copilot'];
  const activeStep: ViewStep = home ? 'home' : steps[scenario.activeStep - 1];

  const setActiveStep = (step: ViewStep) => {
    setHome(step === 'home');
    if (step !== 'home') {
      scenario.setActiveStep((steps.indexOf(step) + 1) as 1 | 2 | 3 | 4);
    }
  };

  const [activeHabitat, setActiveHabitat] = useState<HabitatPreset>(HABITAT_PRESETS[0]); 
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const language = scenario.lang;
  const setLanguage = scenario.setLang;

  // Otras vistas lanzan preguntas al Copilot con el evento 'triggerCopilot'. En el paso 4 ya está a pantalla
  // completa y responde ahí mismo; en los demás pasos se abre el cajón lateral.
  React.useEffect(() => {
    const handleTrigger = () => {
      if (activeStep !== 'copilot') setCopilotOpen(true);
    };
    window.addEventListener('triggerCopilot', handleTrigger);
    return () => window.removeEventListener('triggerCopilot', handleTrigger);
  }, [activeStep]);

  const handleQuickSelectHabitat = (habitat: HabitatPreset) => {
    setActiveHabitat(habitat);
    const preset = scenarioPresets.find(item => item.backendId === habitat.id);
    if (preset) scenario.selectHabitat(preset.id);
    setActiveStep('scenario');
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(14,116,144,0.18),transparent)]">
      <Navbar
        activeStep={activeStep}
        onSelectStep={setActiveStep}
        onOpenCopilot={() => setActiveStep('copilot')}
        language={language}
        onToggleLanguage={setLanguage}
      />

      {/* Cinta de Telemetría del Escenario (visible en los Pasos 1, 2 y 3) */}
      {activeStep !== 'home' && activeStep !== 'predict' && activeStep !== 'copilot' && (
        <ScenarioRibbon
          habitat={activeHabitat}
          activeStep={activeStep}
          onEditScenario={() => setActiveStep('scenario')}
        />
      )}

      {activeStep === 'predict' && (
        <div className="border-b border-slate-800 px-6 py-3 text-sm text-slate-300">
          {scenario.activeHabitat.name[language]} · {scenario.conditions.o2}% O₂ · {scenario.conditions.pressurePsi} psi · {scenario.conditions.airflowCms} cm/s · {scenario.conditions.gravityG} g
        </div>
      )}

      {/* Contenido Principal por Vista */}
      <main className="flex-1 w-full">
        {activeStep === 'home' && (
          <HomeView
            onNavigateStep={setActiveStep}
            onQuickSelectHabitat={handleQuickSelectHabitat}
            activeHabitat={activeHabitat}
          />
        )}

        {activeStep === 'scenario' && <Step1ScenarioView />}
        {activeStep === 'ranking' && <Step2RankingView />}
        {activeStep === 'predict' && <Step3PredictorView />}
        {activeStep === 'copilot' && <Step4CopilotView />}
      </main>

      <CopilotDrawer
        open={copilotOpen && activeStep !== 'copilot'}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
}

export default function FlareAppPage() {
  return (
    <ScenarioProvider>
      <MainAppContent />
    </ScenarioProvider>
  );
}