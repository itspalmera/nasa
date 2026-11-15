// frontend/views/home-view.tsx
'use client';

import {useT} from '../src/i18n/useT';
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Flame,
  Layers,
  ListOrdered,
  Sparkles,
} from 'lucide-react';
import InteractiveFlame3D from '../components/home/interactive-flame-3d';
import { HABITAT_PRESETS } from '../data/mocks/flare.mock';
import { HabitatPreset, ViewStep } from '../models/flare.model';

interface HomeViewProps {
  onNavigateStep: (step: ViewStep) => void;
  onQuickSelectHabitat: (habitat: HabitatPreset) => void;
  activeHabitat: HabitatPreset;
}

export default function HomeView({
  onNavigateStep,
  onQuickSelectHabitat,
  activeHabitat,
}: HomeViewProps) {
  const t = useT();

  const [demoGravityG, setDemoGravityG] = useState<number>(0.0);

  // Contadores animados para los KPIs del Hero
  const [yearsCount, setYearsCount] = useState(0);
  const [invCount, setInvCount] = useState(0);
  const [runsCount, setRunsCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 38;
    const timer = setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3); // Ease-out cubic
      setYearsCount(Math.round(30 * progress));
      setInvCount(Math.round(15 * progress));
      setRunsCount(Math.round(70 * progress));
      if (frame >= totalFrames) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, []);

  const scrollToHowItWorks = () => {
    const el = document.getElementById('tres-pasos-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const heroTitleLetters = 'FLARE'.split('');
  const subtitleWords =
    t('El fuego no se comporta igual donde no hay arriba ni abajo.').split(' ');

  const stepCards = [
    {
      num: '01',
      step: 'scenario' as ViewStep,
      icon: Layers,
      title: 'Escenario',
      description:
        'Elige un hábitat y ajusta oxígeno, presión, ventilación y gravedad.',
      bullets: ['Selector de hábitat', 'Editor de atmósfera'],
      accentColor: 'from-sky-500/20 via-blue-500/10 to-transparent',
    },
    {
      num: '02',
      step: 'ranking' as ViewStep,
      icon: ListOrdered,
      title: 'Ranking y alertas',
      description:
        'Qué investigaciones de la NASA aplican a tu cabina y qué debería preocuparte.',
      bullets: [
        'Alertas físicas',
        'Mapa de peligro',
        'Comparador de investigaciones',
      ],
      accentColor: 'from-orange-500/20 via-amber-500/10 to-transparent',
    },
    {
      num: '03',
      step: 'predict' as ViewStep,
      icon: Sparkles,
      title: 'Predecir y preguntar',
      description:
        'Ve más allá de lo probado: predice, descarga datos y pregunta al Copilot.',
      bullets: [
        'Predicción de gravedad parcial',
        'Datos limpios en CSV',
        'Copilot con citas',
      ],
      accentColor: 'from-indigo-500/20 via-sky-500/10 to-transparent',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      {/* HERO SECTION: 2 Columnas */}
      <section className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        {/* Columna Izquierda: Propuesta de Valor Animada */}
        <div className="flex flex-col items-start lg:col-span-7">
          {/* Píldora superior animada */}
          <div
            style={{ animationDelay: '40ms' }}
            className="animate-reveal inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-sky-500/10 px-4 py-1.5 text-xs font-semibold text-orange-200 shadow-sm"
          >
            <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
            <span>{" "}{t("Flame Analysis Research Explorator")}{" "}</span>
          </div>

          {/* Título FLARE con revelado letra por letra y degradado vivo */}
          <h1
            aria-label={t("FLARE")}
            className="mt-5 font-display text-6xl font-black tracking-tight sm:text-7xl lg:text-[84px] leading-none select-none"
          >
            {heroTitleLetters.map((char, idx) => (
              <span
                key={idx}
                style={{ animationDelay: `${100 + idx * 75}ms` }}
                className="animate-letter animate-gradient-text bg-gradient-to-r from-white via-orange-200 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_8px_28px_rgba(249,115,22,0.22)]"
              >
                {t(char)}
              </span>
            ))}
          </h1>

          {/* Subtítulo con aparición palabra por palabra */}
          <h2 className="mt-5 max-w-xl font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
            {subtitleWords.map((word, idx) => (
              <span
                key={idx}
                style={{ animationDelay: `${380 + idx * 42}ms` }}
                className="animate-reveal mr-[0.28em] inline-block"
              >
                {t(word)}
              </span>
            ))}
          </h2>

          {/* Párrafo descriptivo */}
          <p
            style={{ animationDelay: '780ms' }}
            className="animate-reveal mt-5 max-w-xl text-base leading-relaxed text-slate-300"
          >
            {" "}{t("Explora más de 30 años de experimentos de fuego de la NASA, descubre qué peligros esconden las pruebas terrestres y decide con evidencia para tu hábitat.")}{" "}</p>

          {/* Botones de Acción con Degradado y Shimmer */}
          <div
            style={{ animationDelay: '900ms' }}
            className="animate-reveal mt-8 flex flex-wrap items-center gap-4"
          >
            <button
              type="button"
              onClick={() => onNavigateStep('scenario')}
              className="btn-shimmer group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-white via-slate-100 to-orange-100 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-orange-500/15 ring-1 ring-white/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-orange-500/30 active:translate-y-0 active:scale-95"
            >
              <span>{" "}{t("Configurar mi escenario")}{" "}</span>
              <ArrowRight className="h-4 w-4 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-1" />
            </button>

            <button
              type="button"
              onClick={scrollToHowItWorks}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/90 bg-[#0b1324]/90 px-6 py-3.5 text-sm font-semibold text-slate-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/60 hover:bg-slate-800/80 hover:text-white active:scale-95"
            >
              <span>{" "}{t("Cómo funciona")}{" "}</span>
            </button>
          </div>

          {/* 3 KPIs con Contadores Animados */}
          <div
            style={{ animationDelay: '1020ms' }}
            className="animate-reveal mt-11 grid w-full max-w-lg grid-cols-3 gap-6 border-t border-slate-800/90 pt-7 sm:gap-8"
          >
            <div className="group">
              <div className="font-mono text-2xl font-extrabold text-white transition-colors group-hover:text-orange-300 sm:text-3xl">
                {t(yearsCount)}+
              </div>
              <div className="mt-1 text-xs text-slate-400">{" "}{t("años de datos")}{" "}</div>
            </div>
            <div className="group">
              <div className="font-mono text-2xl font-extrabold text-white transition-colors group-hover:text-sky-300 sm:text-3xl">
                {t(invCount)} <span className="text-slate-500">·</span> {t(runsCount)}
              </div>
              <div className="mt-1 text-xs text-slate-400">{" "}{t("investigaciones PSI")}{" "}</div>
            </div>
            <div className="group">
              <div className="font-mono text-2xl font-extrabold text-amber-400 sm:text-3xl">
                0
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {" "}{t("datos directos en Luna o Marte")}{" "}</div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Simulador Volumétrico de Llama */}
        <div
          style={{ animationDelay: '280ms' }}
          className="animate-reveal lg:col-span-5"
        >
          <InteractiveFlame3D
            gravityG={demoGravityG}
            onGravityChange={(g) => setDemoGravityG(g)}
          />
        </div>
      </section>

      {/* BANNER DE ADVERTENCIA FÍSICA */}
      <section
        style={{ animationDelay: '450ms' }}
        aria-label={t("La brecha que Flare te ayuda a ver")}
        className="animate-reveal relative mt-14 overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/12 via-[#0d1526] to-[#0b1120] px-6 py-5 shadow-lg transition-all duration-300 hover:border-amber-400/60"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-slate-300">
            <strong className="font-semibold text-white">
              {" "}{t("La brecha que Flare te ayuda a ver:")}{" "}</strong>{" "}{t(' ')}{" "}
            {" "}{t("las pruebas terrestres pueden decir que un material es seguro, pero en microgravedad puede arder con menos oxígeno. Flare compara ambos mundos para tu cabina y te dice cuánto riesgo oculto hay.")}{" "}</p>
        </div>
      </section>

      {/* SECCIÓN: Tres pasos, una decisión (Tarjetas con Spotlight Interactivo) */}
      <section id="tres-pasos-section" className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {" "}{t("Tres pasos, una decisión")}{" "}</h2>
          <span className="hidden font-mono text-xs uppercase tracking-widest text-slate-500 sm:inline">
            {" "}{t("FLUJO GUIADO DE INGENIERÍA")}{" "}</span>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-3">
          {stepCards.map((card, index) => {
            const IconComponent = card.icon;
            return (
              <article
                key={card.num}
                style={{ animationDelay: `${550 + index * 120}ms` }}
                onClick={() => onNavigateStep(card.step)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty(
                    '--mouse-x',
                    `${e.clientX - rect.left}px`
                  );
                  e.currentTarget.style.setProperty(
                    '--mouse-y',
                    `${e.clientY - rect.top}px`
                  );
                }}
                className="animate-reveal group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b1120]/90 p-7 shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-400/60 hover:shadow-2xl hover:shadow-sky-950/50"
              >
                {/* Efecto Spotlight que sigue el mouse dentro de la tarjeta */}
                <div
                  className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(380px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(56, 189, 248, 0.13), transparent 60%)',
                  }}
                />

                {/* Barra superior con brillo al hacer hover */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-400 group-hover:bg-sky-500/20 group-hover:text-sky-300">
                      <IconComponent className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-4xl font-extrabold text-slate-800/90 transition-colors duration-300 group-hover:text-sky-400/25">
                      {t(card.num)}
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-lg font-bold text-white transition-colors group-hover:text-sky-200">
                    {t(card.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {t(card.description)}
                  </p>

                  <ul className="mt-5 space-y-2.5 text-xs font-medium text-slate-300">
                    {card.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2.5 transition-transform duration-200 group-hover:translate-x-1"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]" />
                        <span>{t(b)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative z-10 mt-7 inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 transition-colors group-hover:text-sky-300">
                  <span>{" "}{t("Abrir")}{" "}</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1.5" />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* SALTO RÁPIDO A HÁBITATS CON TELEMETRÍA COMPACTA */}
      <section
        style={{ animationDelay: '850ms' }}
        className="animate-reveal mt-14 border-t border-slate-800/80 pt-8"
      >
        <p className="text-xs font-medium text-slate-400">
          {" "}{t("¿Prefieres empezar rápido? Salta directo a un hábitat:")}{" "}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {HABITAT_PRESETS.map((preset) => {
            const isSelected = activeHabitat.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onQuickSelectHabitat(preset)}
                className={`group flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                  isSelected
                    ? 'border-sky-400/80 bg-gradient-to-r from-sky-500/20 to-blue-600/15 text-white shadow-md shadow-sky-950/50'
                    : 'border-slate-800 bg-[#0b1120]/90 text-slate-300 hover:border-slate-600 hover:bg-[#111a2e] hover:text-white'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full transition-transform group-hover:scale-125 ${
                    preset.o2Pct >= 30
                      ? 'bg-orange-400 shadow-[0_0_8px_#fb923c]'
                      : preset.gravityG === 0
                      ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'
                      : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  }`}
                />
                <span>{t(preset.name)}</span>
                <span className="font-mono text-[10px] text-slate-500 transition-colors group-hover:text-sky-300">
                  {t(preset.o2Pct)}% O₂ · {t(preset.gravityG)}g
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}