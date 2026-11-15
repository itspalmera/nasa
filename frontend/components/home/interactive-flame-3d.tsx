// frontend/components/home/interactive-flame-3d.tsx
'use client';

import {useT} from '../../src/i18n/useT';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wind, Zap } from 'lucide-react';
import { FLAME_PHYSICS_STOPS } from '../../data/mocks/flare.mock';

interface InteractiveFlame3DProps {
  gravityG: number;
  onGravityChange: (g: number) => void;
}

interface StreamlineParticle {
  angle: number;
  dist: number;
  yProgress: number;
  speed: number;
  offset: number;
}

export default function InteractiveFlame3D({
  gravityG,
  onGravityChange,
}: InteractiveFlame3DProps) {
  const t = useT();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetGRef = useRef<number>(gravityG);
  const smoothGRef = useRef<number>(gravityG);
  const velocityGRef = useRef<number>(0);

  const [airflowCms, setAirflowCms] = useState<number>(10);
  const [eFieldActive, setEFieldActive] = useState<boolean>(false);

  useEffect(() => {
    targetGRef.current = gravityG;
  }, [gravityG]);

  // Cálculos físicos en vivo según gravedad, ventilación y campo eléctrico E-FIELD
  const currentInfo = useMemo(() => {
    const effectiveG = eFieldActive && gravityG < 0.22 ? 0.22 : gravityG;
    let closest = FLAME_PHYSICS_STOPS[0];
    let minDiff = Infinity;
    for (const stop of FLAME_PHYSICS_STOPS) {
      const diff = Math.abs(stop.gravityG - gravityG);
      if (diff < minDiff) {
        minDiff = diff;
        closest = stop;
      }
    }

    const title =
      gravityG <= 0.02
        ? 'Órbita · 0 g'
        : Math.abs(gravityG - 0.17) < 0.03
        ? 'Luna · 0.17 g'
        : Math.abs(gravityG - 0.38) < 0.03
        ? 'Marte · 0.38 g'
        : gravityG >= 0.96
        ? 'Tierra · 1 g'
        : `Gravedad parcial · ${gravityG.toFixed(2)} g`;

    const flowBonus = airflowCms > 0 ? 0 : 0.6;
    const loi = (16.3 + 1.4 * Math.pow(effectiveG, 0.75) + flowBonus).toFixed(1);
    const spread = (
      (1.15 + 0.17 * Math.pow(effectiveG, 0.65)) *
      (airflowCms > 0 ? 1.0 : 0.68)
    ).toFixed(2);

    return { closest, title, loi, spread, effectiveG };
  }, [gravityG, airflowCms, eFieldActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Líneas de corriente delicadas para visualizar difusión isotrópica (0g) vs convección ascendente (1g)
    const streamlines: StreamlineParticle[] = Array.from({ length: 22 }, (_, i) => ({
      angle: (i / 22) * Math.PI * 2,
      dist: 45 + (i % 4) * 18,
      yProgress: (i / 22),
      speed: 0.004 + (i % 3) * 0.0018,
      offset: i * 1.7,
    }));

    /**
     * Traza un contorno cerrado de llama de alta resolución (64 vértices polares)
     * que interpola matemáticamente entre una esfera de difusión (g=0) y una lágrima laminar (g=1).
     */
    const traceFlameContour = (
      cx: number,
      baseY: number,
      radiusX: number,
      heightUp: number,
      bottomBowl: number,
      g: number,
      t: number,
      turbulenceAmp: number,
      windTilt: number
    ) => {
      const steps = 64;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2; // 0 = punta superior, PI = base inferior
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        // En 0g es un domo esférico; a medida que sube g, la mitad superior se ahúsa en punta de vela
        const upperFactor = cosT > 0 ? cosT : 0; // 1 en la cúspide, 0 en los lados
        const lowerFactor = cosT < 0 ? -cosT : 0; // 1 en la base de la mecha

        // Estrechamiento progresivo de la punta por aceleración de flotabilidad (ley de conservación de masa en pluma)
        const pinch = 1 - g * 0.76 * Math.pow(upperFactor, 1.45);

        // Oscilación sinuosa natural de la lengua de fuego proporcional a la altura sobre el quemador
        const heightRatio = (1 + cosT) * 0.5; // 0 abajo, 1 arriba
        const waveX =
          Math.sin(t * (2.6 + g * 3.8) - heightRatio * 4.2) *
            turbulenceAmp *
            Math.pow(heightRatio, 1.6) *
            (0.25 + g * 1.35) +
          Math.cos(t * 1.9 + theta * 3) * turbulenceAmp * 0.22 * (1 - g * 0.5) +
          windTilt * Math.pow(heightRatio, 1.4);

        const waveY =
          Math.cos(t * (3.2 + g * 4.0) + heightRatio * 3.0) *
          turbulenceAmp *
          0.45 *
          Math.pow(heightRatio, 1.3);

        const x = cx + sinT * radiusX * pinch + waveX;
        const y =
          cosT >= 0
            ? baseY - upperFactor * heightUp + waveY
            : baseY + lowerFactor * bottomBowl;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const render = () => {
      time += 0.032;

      // Física de resorte para que al mover el slider la llama reaccione con inercia fluida
      const target =
        eFieldActive && targetGRef.current < 0.22 ? 0.22 : targetGRef.current;
      const force = (target - smoothGRef.current) * 0.12;
      velocityGRef.current = (velocityGRef.current + force) * 0.78;
      smoothGRef.current = Math.max(0, Math.min(1, smoothGRef.current + velocityGRef.current));

      const g = smoothGRef.current;
      const stretchKick = velocityGRef.current * 95; // Estiramiento elástico al arrastrar rápido
      const windTilt = airflowCms > 0 ? (1 - g * 0.6) * 3.5 : 0;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const burnerTopY = H * 0.72;

      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);

      // 1. Retícula instrumental de cámara de combustión (CIR / MSG)
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
      ctx.lineWidth = 1;
      [46, 82, 116].forEach((r, idx) => {
        ctx.beginPath();
        if (idx === 1) ctx.setLineDash([3, 6]);
        else ctx.setLineDash([]);
        ctx.arc(cx, burnerTopY - 38, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
      ctx.moveTo(cx - 135, burnerTopY - 38);
      ctx.lineTo(cx + 135, burnerTopY - 38);
      ctx.moveTo(cx, burnerTopY - 165);
      ctx.lineTo(cx, burnerTopY + 35);
      ctx.stroke();
      ctx.restore();

      // 2. Líneas de flujo físico (Difusión radial de O2 en 0g vs Corrientes de flotabilidad ascendente en 1g)
      ctx.save();
      streamlines.forEach((s) => {
        s.yProgress = (s.yProgress + s.speed * (0.55 + g * 1.35)) % 1;
        const fade = Math.sin(s.yProgress * Math.PI);

        if (g < 0.14) {
          // En microgravedad: difusión molecular lenta desde todas las direcciones hacia la esfera
          const rNow = 112 - s.yProgress * 58;
          const rTail = rNow + 11;
          const ang = s.angle + Math.sin(time * 0.4 + s.offset) * 0.08;
          const x1 = cx + Math.cos(ang) * rTail;
          const y1 = burnerTopY - 26 + Math.sin(ang) * rTail;
          const x2 = cx + Math.cos(ang) * rNow;
          const y2 = burnerTopY - 26 + Math.sin(ang) * rNow;

          ctx.strokeStyle = `rgba(56, 189, 248, ${fade * 0.28})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else {
          // Con gravedad: líneas de corriente convectiva que entran por la base y suben aceleradas
          const side = s.angle > Math.PI ? 1 : -1;
          const spreadFactor = 24 + (s.dist % 36);
          const yPos = burnerTopY + 18 - s.yProgress * 155;
          const curveIn =
            side * spreadFactor * (1 - 0.45 * Math.sin(s.yProgress * Math.PI));
          const xPos = cx + curveIn + Math.sin(time * 2 + s.offset) * 1.5;

          ctx.strokeStyle =
            g > 0.35
              ? `rgba(251, 146, 60, ${fade * 0.22 * g})`
              : `rgba(96, 165, 250, ${fade * 0.24})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(xPos, yPos + 12);
          ctx.lineTo(xPos - side * 2, yPos);
          ctx.stroke();
        }
      });
      ctx.restore();

      // Dimensiones morfométricas de la llama según g
      const baseRx = 46 - g * 18; // En 0g es ancha y esférica (46px); en 1g se estrecha (28px)
      const heightUp = 48 + g * 88 + stretchKick; // En 0g mide ~48px; en 1g se estira hasta ~136px
      const bottomBowl = 22 - g * 8; // En 0g envuelve la mecha esféricamente; en 1g sube un poco
      const flameBaseY = burnerTopY - 12;

      //Fracción de formación de hollín luminoso (0 en microgravedad pura -> 1 en Tierra)
      const soot = Math.min(1, Math.max(0, Math.pow(g / 0.55, 0.85)));

      // 3. CAPA 1: Halo térmico ambiental profundo (Blur amplio sin bordes duros)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(26px)';
      traceFlameContour(
        cx,
        flameBaseY,
        baseRx * 1.55,
        heightUp * 1.22,
        bottomBowl * 1.4,
        g,
        time,
        5,
        windTilt
      );
      ctx.fillStyle =
        soot < 0.3
          ? 'rgba(37, 99, 235, 0.55)'
          : soot < 0.7
          ? 'rgba(59, 130, 246, 0.38)'
          : 'rgba(234, 88, 12, 0.42)';
      ctx.fill();
      ctx.restore();

      // 4. CAPA 2: Manto exterior de reacción (Difusión azul CH* en 0g / Manto naranja en 1g)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(11px)';
      traceFlameContour(
        cx,
        flameBaseY,
        baseRx * 1.12,
        heightUp * 1.05,
        bottomBowl * 1.1,
        g,
        time * 1.1,
        4.2,
        windTilt
      );
      const outerGrad = ctx.createLinearGradient(
        cx,
        flameBaseY + bottomBowl,
        cx,
        flameBaseY - heightUp * 1.05
      );
      if (soot < 0.18) {
        // Esfera azul pura de microgravedad
        outerGrad.addColorStop(0, 'rgba(29, 78, 216, 0.75)');
        outerGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.92)');
        outerGrad.addColorStop(1, 'rgba(125, 211, 252, 0.88)');
      } else {
        // Base azul-cian que transiciona a manto naranja/ámbar hacia arriba
        outerGrad.addColorStop(0, 'rgba(37, 99, 235, 0.85)');
        outerGrad.addColorStop(0.28, `rgba(56, 189, 248, ${0.85 - soot * 0.45})`);
        outerGrad.addColorStop(0.55, `rgba(249, 115, 22, ${soot * 0.92})`);
        outerGrad.addColorStop(1, `rgba(234, 88, 12, ${soot * 0.85})`);
      }
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.restore();

      // 5. CAPA 3: Cuerpo radiante principal (Cian celeste brillante en 0g / Amarillo-Blanco incandescente en 1g)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(4.5px)';
      traceFlameContour(
        cx,
        flameBaseY - g * 4,
        baseRx * 0.86,
        heightUp * 0.92,
        bottomBowl * 0.85,
        g,
        time * 1.25,
        3.2,
        windTilt * 0.85
      );
      const bodyGrad = ctx.createLinearGradient(
        cx,
        flameBaseY + bottomBowl * 0.6,
        cx,
        flameBaseY - heightUp * 0.92
      );
      if (soot < 0.18) {
        bodyGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
        bodyGrad.addColorStop(0.45, 'rgba(186, 230, 253, 0.95)');
        bodyGrad.addColorStop(1, 'rgba(224, 242, 254, 0.98)');
      } else {
        bodyGrad.addColorStop(0, 'rgba(96, 165, 250, 0.45)');
        bodyGrad.addColorStop(0.25, `rgba(251, 191, 36, ${0.4 + soot * 0.55})`);
        bodyGrad.addColorStop(0.65, `rgba(254, 240, 138, ${0.65 + soot * 0.35})`);
        bodyGrad.addColorStop(1, `rgba(255, 251, 235, ${0.7 + soot * 0.3})`);
      }
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.restore();

      // 6. CAPA 4: Núcleo de máxima temperatura (Blanco puro en zona de reacción activa)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(2.5px)';
      traceFlameContour(
        cx,
        flameBaseY - 6 - g * 10,
        baseRx * (0.58 - g * 0.14),
        heightUp * 0.68,
        bottomBowl * 0.45,
        g,
        time * 1.4,
        2.2,
        windTilt * 0.65
      );
      ctx.fillStyle =
        soot < 0.2 ? 'rgba(240, 249, 255, 0.92)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ctx.restore();

      // 7. CAPA 5: Copa azul de premezcla y Zona interna de pirólisis (el hueco oscuro real alrededor de la mecha)
      ctx.save();
      ctx.filter = 'blur(4px)';
      ctx.beginPath();
      const darkZoneHeight = 18 + g * 14;
      const darkZoneRx = 11 - g * 2;
      ctx.ellipse(
        cx,
        burnerTopY - darkZoneHeight * 0.45,
        darkZoneRx,
        darkZoneHeight * 0.55,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle =
        g < 0.2 ? 'rgba(12, 28, 64, 0.52)' : 'rgba(15, 23, 42, 0.68)';
      ctx.fill();
      ctx.restore();

      // 8. Quemador cilíndrico metálico y mecha incandescente
      ctx.save();
      ctx.filter = 'none';
      // Mecha
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, burnerTopY);
      ctx.lineTo(cx, burnerTopY - 10);
      ctx.stroke();

      // Punta de la mecha al rojo vivo
      ctx.fillStyle = '#fb923c';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cx, burnerTopY - 10, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cilindro portamuestra (PMMA / Quemador)
      const cylGrad = ctx.createLinearGradient(cx - 8, burnerTopY, cx + 8, burnerTopY);
      cylGrad.addColorStop(0, '#0f172a');
      cylGrad.addColorStop(0.45, '#475569');
      cylGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = cylGrad;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - 7, burnerTopY, 14, 24, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [airflowCms, eFieldActive]);

  return (
    <div className="group relative rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0d1527]/95 to-[#080d19]/95 p-6 shadow-2xl shadow-black/70 backdrop-blur-xl transition-all duration-300 hover:border-sky-500/40">
      {/* Resplandor superior sutil en la tarjeta */}
      <div className="pointer-events-none absolute inset-x-12 -top-px h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      {/* Encabezado con interruptores físicos opcionales */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">
            {" "}{t("PRUÉBALO AHORA")}{" "}</span>
          <h3 className="mt-1 font-display text-lg font-bold text-white">
            {" "}{t("Arrastra la gravedad y mira cómo cambia la llama")}{" "}</h3>
        </div>

        {/* Botones de física experimental (Ventilación ISS y Viento Iónico E-FIELD) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAirflowCms(airflowCms > 0 ? 0 : 10)}
            title={t("Alternar flujo de ventilación de cabina (10 cm/s vs 0 cm/s)")}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${
              airflowCms > 0
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wind className="h-3 w-3" />
            {t(airflowCms > 0 ? '10 cm/s' : 'Sin flujo')}
          </button>
          <button
            type="button"
            onClick={() => setEFieldActive(!eFieldActive)}
            title={t("Activar campo eléctrico E-FIELD (10 kV) que arrastra iones emulando gravedad parcial")}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[10px] font-semibold transition-all ${
              eFieldActive
                ? 'border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3 w-3" />
            {" "}{t("E-FIELD")}{" "}</button>
        </div>
      </div>

      {/* Visor de Simulación Volumétrica */}
      <div className="relative my-4 flex h-[255px] items-center justify-center overflow-hidden rounded-xl border border-slate-800/80 bg-[#050811] shadow-inner">
        <canvas
          ref={canvasRef}
          width={420}
          height={255}
          className="h-full w-full max-w-[420px]"
          aria-label={`Simulación física de llama a ${gravityG} g`}
        />

        {/* Píldoras de telemetría en esquina superior izquierda */}
        <div className="pointer-events-none absolute left-3.5 top-3.5 flex flex-col gap-1.5">
          <div className="rounded-lg border border-slate-800/90 bg-[#0b1120]/85 px-2.5 py-1 font-mono text-[11px] text-slate-300 backdrop-blur-md transition-all">
            {" "}{t("O₂ mín (PMMA):")}{" "}{" "}{t(' ')}{" "}
            <strong className="text-sky-400">{t(currentInfo.loi)}%</strong>
          </div>
          <div className="rounded-lg border border-slate-800/90 bg-[#0b1120]/85 px-2.5 py-1 font-mono text-[11px] text-slate-300 backdrop-blur-md transition-all">
            {" "}{t("Propagación:")}{" "}{" "}{t(' ')}{" "}
            <strong className="text-amber-400">{t(currentInfo.spread)} {" "}{t("mm/s")}{" "}</strong>
          </div>
        </div>

        {/* Etiqueta de régimen dominante en esquina superior derecha */}
        <div className="pointer-events-none absolute right-3.5 top-3.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md transition-all ${
              currentInfo.effectiveG < 0.15
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                : currentInfo.effectiveG < 0.5
                ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
                : 'border-orange-500/40 bg-orange-500/10 text-orange-300'
            }`}
          >
            {t(eFieldActive && gravityG < 0.22
              ? '⚡ Viento iónico (~0.22g eq.)'
              : currentInfo.effectiveG < 0.15
              ? 'Difusión molecular'
              : currentInfo.effectiveG < 0.5
              ? 'Convección parcial'
              : 'Flotabilidad natural')}
          </span>
        </div>
      </div>

      {/* Barra Deslizante de Gravedad */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={gravityG}
          onChange={(e) => onGravityChange(parseFloat(e.target.value))}
          aria-label={t("Ajustar gravedad entre 0g y 1g")}
          className="flare-slider"
        />

        {/* Botones de salto rápido gravitacional */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {FLAME_PHYSICS_STOPS.map((stop) => {
            const isSelected = Math.abs(gravityG - stop.gravityG) < 0.03;
            return (
              <button
                key={stop.id}
                type="button"
                onClick={() => onGravityChange(stop.gravityG)}
                className={`rounded-xl border px-2 py-1.5 font-mono text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'border-sky-400 bg-sky-500/20 text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                    : 'border-slate-800/90 bg-[#070c18] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t(stop.id === 'orbit'
                  ? '0g Órbita'
                  : stop.id === 'moon'
                  ? '0.17g Luna'
                  : stop.id === 'mars'
                  ? '0.38g Marte'
                  : '1g Tierra')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie dinámico con explicación física */}
      <div className="mt-5 border-t border-slate-800/80 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <strong className="font-mono text-base font-bold text-white transition-all">
            {t(currentInfo.title)}
          </strong>
          <span className="text-[11px] text-slate-500">
            {" "}{t("Ilustración física interactiva, no una imagen real")}{" "}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          {t(currentInfo.closest.description)}
        </p>
      </div>
    </div>
  );
}