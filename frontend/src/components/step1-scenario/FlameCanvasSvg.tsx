import {useT} from '../../i18n/useT';
import React from "react";

interface FlameCanvasSvgProps {
  gravityG: number;
  o2Pct: number;
  airflowCms: number;
  size?: "sm" | "md" | "lg";
  variant?: "earth-1g" | "scenario";
}

/**
 * Renderizador SVG de llama con halo difuso realista (fiel al mockup image_b17a5f.png):
 * - En Tierra (1g, 20.9% O2): Llama alta anaranjada-amarilla con base azulada.
 * - En Gravedad Parcial (0.17g / 0.38g): Lágrima redondeada azul-celeste brillante con núcleo blanco.
 * - En Microgravedad (0g): Esfera azul difusiva suspendida alrededor de la mecha.
 */
export const FlameCanvasSvg: React.FC<FlameCanvasSvgProps> = ({
  gravityG,
  o2Pct,
  airflowCms,
  size = "md",
  variant = "scenario",
}) => {
  const t = useT();

  const isEarthRef = variant === "earth-1g" || gravityG >= 0.85;

  // Elongación vertical según gravedad (0g = esfera 1.0, 0.17g = lágrima corta 1.22, 1g = vela alta 2.05)
  const stretchY = isEarthRef
    ? 2.05
    : 1.0 + Math.min(1.0, Math.max(0.0, gravityG)) * 1.15;

  // Ancho de la llama (más redondeada y ancha en baja gravedad)
  const widthFactor = isEarthRef
    ? 0.68
    : 1.05 - Math.min(1.0, Math.max(0.0, gravityG)) * 0.3;

  // Brillo adicional por enriquecimiento de O2
  const o2Glow = Math.min(1.35, Math.max(0.85, o2Pct / 26.0));
  const flowStretch = 1.0 + Math.min(0.15, airflowCms / 160.0);

  const sizeClasses =
    size === "sm"
      ? "h-24 w-24"
      : size === "lg"
      ? "h-32 w-32"
      : "h-28 w-28";

  // Geometría del contorno de la llama centrada en (50, 62)
  const bottomY = 70;
  const flameHeight = 22 * stretchY * flowStretch;
  const topY = Math.max(12, bottomY - flameHeight);
  const halfW = 19 * widthFactor * Math.min(1.12, o2Glow);

  const outerFlamePath = `
    M 50 ${topY}
    C ${50 + halfW * 0.85} ${topY + flameHeight * 0.35},
      ${50 + halfW * 1.12} ${bottomY - flameHeight * 0.18},
      50 ${bottomY}
    C ${50 - halfW * 1.12} ${bottomY - flameHeight * 0.18},
      ${50 - halfW * 0.85} ${topY + flameHeight * 0.35},
      50 ${topY}
    Z
  `;

  const midTopY = topY + flameHeight * 0.22;
  const midHalfW = halfW * 0.72;
  const midFlamePath = `
    M 50 ${midTopY}
    C ${50 + midHalfW * 0.85} ${midTopY + (bottomY - midTopY) * 0.38},
      ${50 + midHalfW * 1.05} ${bottomY - 4},
      50 ${bottomY - 1}
    C ${50 - midHalfW * 1.05} ${bottomY - 4},
      ${50 - midHalfW * 0.85} ${midTopY + (bottomY - midTopY) * 0.38},
      50 ${midTopY}
    Z
  `;

  const coreTopY = topY + flameHeight * 0.44;
  const coreHalfW = halfW * 0.45;
  const coreFlamePath = `
    M 50 ${coreTopY}
    C ${50 + coreHalfW} ${coreTopY + (bottomY - coreTopY) * 0.45},
      ${50 + coreHalfW} ${bottomY - 3},
      50 ${bottomY - 2}
    C ${50 - coreHalfW} ${bottomY - 3},
      ${50 - coreHalfW} ${coreTopY + (bottomY - coreTopY) * 0.45},
      50 ${coreTopY}
    Z
  `;

  const uid = `flame-${variant}-${Math.round(gravityG * 100)}-${Math.round(o2Pct)}-${size}`;

  return (
    <div
      className={`relative flex items-center justify-center rounded-full border border-slate-800/90 bg-[#050B18] shadow-[inset_0_0_24px_rgba(0,0,0,0.85)] ${sizeClasses}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          {/* Halo radial atmosférico */}
          <radialGradient id={`${uid}-ambient`} cx="50%" cy="54%" r="46%">
            {isEarthRef ? (
              <>
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
                <stop offset="55%" stopColor="#D97706" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#050B18" stopOpacity="0" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.48 * o2Glow} />
                <stop offset="55%" stopColor="#2563EB" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#050B18" stopOpacity="0" />
              </>
            )}
          </radialGradient>

          {/* Gradiente del manto exterior */}
          <linearGradient id={`${uid}-outer`} x1="0%" y1="0%" x2="0%" y2="100%">
            {isEarthRef ? (
              <>
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.88" />
                <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.85" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
                <stop offset="65%" stopColor="#2E96F5" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.9" />
              </>
            )}
          </linearGradient>

          {/* Gradiente intermedio */}
          <linearGradient id={`${uid}-mid`} x1="0%" y1="0%" x2="0%" y2="100%">
            {isEarthRef ? (
              <>
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.95" />
                <stop offset="75%" stopColor="#FDE047" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.9" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.95" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Resplandor difuso de fondo */}
        <circle cx="50" cy="52" r="42" fill={`url(#${uid}-ambient)`} />

        {/* Manto externo de la llama */}
        <path d={outerFlamePath} fill={`url(#${uid}-outer)`} />

        {/* Capa intermedia luminosa */}
        <path d={midFlamePath} fill={`url(#${uid}-mid)`} />

        {/* Núcleo incandescente blanco/azul */}
        <path
          d={coreFlamePath}
          fill={isEarthRef ? "#FEF9C3" : "#F0F9FF"}
          fillOpacity="0.96"
        />

        {/* Punto de anclaje azul en la base de la mecha */}
        <ellipse
          cx="50"
          cy={bottomY - 1}
          rx={halfW * 0.35}
          ry="2.5"
          fill="#38BDF8"
          fillOpacity="0.85"
        />

        {/* Mecha / Soporte cilíndrico inferior */}
        <rect x="48" y="69" width="4" height="13" rx="1.5" fill="#475569" />
      </svg>
    </div>
  );
};