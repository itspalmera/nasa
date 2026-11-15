// frontend/src/components/step4-copilot/Step4CopilotView.tsx
// Paso 4: el Copilot del Motor 4 a pantalla completa (informe de decisión arriba + chat con citas validadas).
'use client';

import React from 'react';
import { useScenario } from '../../context/ScenarioContext';
import { RagCopilotWorkspace } from '../copilot/RagCopilotWorkspace';

export const Step4CopilotView: React.FC = () => {
  const { lang, setActiveStep } = useScenario();
  const en = lang === 'en';
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-6 pb-20 sm:px-6">
      <span className="font-mono text-xs text-sky-300">04 · {en ? 'SCIENTIFIC COPILOT' : 'COPILOT CIENTÍFICO'}</span>
      <h1 className="mt-2 text-3xl font-bold">{en ? 'Ask the evidence' : 'Pregúntale a la evidencia'}</h1>
      <p className="mt-3 max-w-3xl text-sm text-slate-300">
        {en
          ? 'A decision brief for your scenario and material, followed by a chat grounded in the team papers and the NASA PSI catalog. Every claim cites a verbatim passage; when there is no evidence, it says so.'
          : 'Un informe de decisión para tu escenario y material, y un chat basado en los papers del equipo y el catálogo NASA PSI. Cada afirmación cita un pasaje textual; si no hay evidencia, lo dice.'}
      </p>
      <RagCopilotWorkspace variant="page" />
      <button
        type="button"
        onClick={() => setActiveStep(3)}
        className="mt-6 rounded-lg border border-slate-700 px-5 py-3 text-sm"
      >
        ← {en ? 'Back to prediction' : 'Volver a predicción'}
      </button>
    </section>
  );
};
