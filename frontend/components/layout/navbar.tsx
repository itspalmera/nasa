// frontend/components/layout/navbar.tsx
'use client';

import {useT} from '../../src/i18n/useT';
import React, { useEffect, useState } from 'react';
import { Check, Flame, Sparkles } from 'lucide-react';
import { Language, ViewStep } from '../../models/flare.model';

interface NavbarProps {
  activeStep: ViewStep;
  onSelectStep: (step: ViewStep) => void;
  onOpenCopilot: () => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
}

export default function Navbar({
  activeStep,
  onSelectStep,
  onOpenCopilot,
  language,
  onToggleLanguage,
}: NavbarProps) {
  const t = useT();

  const [hasCustomLogo, setHasCustomLogo] = useState(false);

  // Verifica silenciosamente si existe /logos/space-apps-logo.png para nunca mostrar un ícono roto
  useEffect(() => {
    const img = new Image();
    img.src = '/logos/space-apps-logo.png';
    img.onload = () => setHasCustomLogo(true);
    img.onerror = () => setHasCustomLogo(false);
  }, []);

  const steps: { id: ViewStep; num: number; labelEs: string; labelEn: string }[] = [
    { id: 'scenario', num: 1, labelEs: 'Escenario', labelEn: 'Scenario' },
    { id: 'ranking', num: 2, labelEs: 'Ranking y alertas', labelEn: 'Ranking & alerts' },
    { id: 'predict', num: 3, labelEs: 'Predecir', labelEn: 'Predict' },
    { id: 'copilot', num: 4, labelEs: 'Copilot', labelEn: 'Copilot' },
  ];

  const stepOrder = ['home', 'scenario', 'ranking', 'predict', 'copilot'];
  const currentIdx = stepOrder.indexOf(activeStep);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#050912]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* 1. Marca Izquierda (Flare) */}
        <button
          type="button"
          onClick={() => onSelectStep('home')}
          className="group flex shrink-0 items-center gap-3 text-left focus:outline-none"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-orange-500 to-rose-600 text-slate-950 shadow-lg shadow-orange-500/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-orange-500/40">
            <Flame className="h-5 w-5 stroke-[2.3] transition-transform duration-300 group-hover:scale-110" />
          </span>
          <div>
            <span className="block font-display text-base font-extrabold tracking-tight text-white transition-colors group-hover:text-orange-200">
              {" "}{t("Flare")}{" "}</span>
            <span className="hidden text-[11px] text-slate-400 sm:block">
              {t(language === 'es'
                ? 'Seguridad contra incendios en microgravedad'
                : 'Microgravity fire safety insights')}
            </span>
          </div>
        </button>

        {/* 2. Stepper Central Guiado (1 Escenario · 2 Ranking y alertas · 3 Predecir y preguntar) */}
        <nav
          aria-label={t(language === 'es' ? 'Flujo guiado de cuatro pasos' : 'Four-step guided flow')}
          className="hidden lg:flex items-center gap-1 rounded-full border border-slate-800/90 bg-[#0b1120]/95 p-1 shadow-inner"
        >
          {steps.map((step) => {
            const isActive = activeStep === step.id;
            const stepIdx = stepOrder.indexOf(step.id);
            const isCompleted = currentIdx > stepIdx && activeStep !== 'home';

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={`group flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/20 to-blue-600/20 text-white shadow-sm ring-1 ring-sky-400/70'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-400 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.7)]'
                      : isCompleted
                      ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                      : 'border border-slate-700 bg-slate-800/90 text-slate-400 group-hover:border-slate-500 group-hover:text-slate-200'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : step.num}
                </span>
                <span>{t(language === 'es' ? step.labelEs : step.labelEn)}</span>
              </button>
            );
          })}
        </nav>

        {/* 3. Controles Derechos: Idioma + Botón Copilot con Degradado + Logo Space Apps */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          {/* Selector EN / ES */}
          <div
            role="group"
            aria-label={t("Selector de idioma")}
            className="flex items-center rounded-xl border border-slate-800 bg-[#0b1120] p-0.5 font-mono text-[11px]"
          >
            <button
              type="button"
              onClick={() => onToggleLanguage('en')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                language === 'en'
                  ? 'bg-slate-800 font-bold text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {" "}{t("EN")}{" "}</button>
            <button
              type="button"
              onClick={() => onToggleLanguage('es')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                language === 'es'
                  ? 'bg-slate-800 font-bold text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {" "}{t("ES")}{" "}</button>
          </div>

          {/* Botón Copilot con degradado interactivo y brillo */}
          <button
            type="button"
            onClick={onOpenCopilot}
            className="btn-shimmer group relative inline-flex items-center gap-2 rounded-xl border border-sky-400/50 bg-gradient-to-r from-sky-500/20 via-blue-600/25 to-indigo-600/20 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/15 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-sky-400/30 active:translate-y-0 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-300 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            <span>{" "}{t("Copilot")}{" "}</span>
          </button>

          {/* Logo NASA Space Apps (Carga /public/logos/space-apps-logo.png si existe, o SVG limpio) */}
          <div
            className="hidden xl:flex items-center border-l border-slate-800/90 pl-3"
            title={t("NASA Space Apps Challenge")}
          >
            {hasCustomLogo ? (
              <img
                src="/logos/space-apps-logo.png"
                alt={t("NASA Space Apps Challenge")}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800/90 bg-[#0b1120]/90 px-3 py-1.5 transition hover:border-slate-700">
                <svg
                  viewBox="0 0 40 40"
                  className="h-5 w-5 text-white shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <circle cx="18" cy="22" r="12" />
                  <circle cx="27" cy="13" r="4" fill="#0b1120" />
                  <line x1="29" y1="8" x2="33" y2="2" strokeLinecap="round" />
                  <line x1="31" y1="10" x2="37" y2="6" strokeLinecap="round" />
                  <line x1="32" y1="13" x2="38" y2="11" strokeLinecap="round" />
                </svg>
                <div className="leading-none">
                  <span className="block font-mono text-[8px] font-bold tracking-[0.2em] text-[#E43700]">
                    {" "}{t("NASA")}{" "}</span>
                  <span className="block font-display text-[10px] font-extrabold tracking-wider text-white">
                    {" "}{t("SPACE APPS")}{" "}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-barra de pasos compacta para pantallas medianas/móviles (<1024px) */}
      <div className="flex lg:hidden items-center justify-center gap-1 border-t border-slate-800/60 bg-[#080d1a] px-3 py-1.5">
        {steps.map((step) => {
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-sky-500/20 text-white ring-1 ring-sky-400/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="font-mono font-bold text-sky-400">{t(step.num)}.</span>
              <span>{t(language === 'es' ? step.labelEs : step.labelEn)}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}