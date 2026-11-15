//frontend/src/data/scenarioPresets.ts
import {
  AtmosphereConditions,
  HabitatPreset,
  Language,
  MaterialEvaluation,
  MaterialId,
  MaterialSpec,
} from "../Models/scenario";

export const MATERIALS_CATALOG: Record<MaterialId, MaterialSpec> = {
  cellulose: {
    id: "cellulose", shortName: "Cellulose",
    name: {en: "Cellulose (paper / Kimwipes)", es: "Celulosa (papel / Kimwipes)"},
    subtitle: {en: "Source-linked paper and tissue experiments", es: "Experimentos de papel y tejido con fuentes"},
    baseLoi0gPct: NaN, earthTest1LoiPct: NaN,
  },
  pmma: {
    id: "pmma",
    shortName: "PMMA",
    name: {
      en: "Acrylic (PMMA)",
      es: "Acrílico (PMMA)",
    },
    subtitle: {
      en: "Windows, panels, enclosures",
      es: "Ventanas, paneles, carcasas",
    },
    baseLoi0gPct: 16.6,
    earthTest1LoiPct: 17.6,
  },
  sibal: {
    id: "sibal",
    shortName: "SIBAL",
    name: {
      en: "Cotton-fiberglass fabric",
      es: "Tela algodón-fibra de vidrio",
    },
    subtitle: {
      en: "Seats, bags, soft goods",
      es: "Asientos, bolsos, textiles",
    },
    baseLoi0gPct: 14.8,
    earthTest1LoiPct: 17.3,
  },
  nomex: {
    id: "nomex",
    shortName: "Nomex",
    name: {
      en: "Nomex (flame-resistant)",
      es: "Nomex (ignífugo)",
    },
    subtitle: {
      en: "Suits, flame-resistant covers",
      es: "Trajes, cubiertas ignífugas",
    },
    baseLoi0gPct: 24.2,
    earthTest1LoiPct: 26.5,
  },
};

export const HABITAT_PRESETS: HabitatPreset[] = [
  {
    id: "artemis_lunar_base",
    backendId: "luna",
    iconType: "moon",
    visualGradient: "from-slate-300 via-slate-600 to-slate-950",
    name: {
      en: "Artemis Lunar Base",
      es: "Base Lunar Artemis",
    },
    subtitle: {
      en: "Long-stay habitat, O₂-enriched air",
      es: "Hábitat de larga estadía, aire enriquecido en O₂",
    },
    conditions: {
      o2: 30.0,
      pressurePsi: 10.2,
      airflowCms: 10.0,
      gravityG: 0.17,
    },
    strongMatchesCount: 7,
  },
  {
    id: "pressurized_rover",
    backendId: "rover",
    iconType: "rover",
    visualGradient: "from-stone-300 via-stone-600 to-zinc-950",
    name: {
      en: "Pressurized Rover",
      es: "Rover Presurizado",
    },
    subtitle: {
      en: "Small cabin, frequent EVAs",
      es: "Cabina pequeña, salidas frecuentes",
    },
    conditions: {
      o2: 34.0,
      pressurePsi: 8.2,
      airflowCms: 10.0,
      gravityG: 0.17,
    },
    strongMatchesCount: 6,
  },
  {
    id: "mars_habitat",
    backendId: "marte",
    iconType: "mars",
    visualGradient: "from-orange-300 via-amber-700 to-stone-950",
    name: {
      en: "Mars Habitat",
      es: "Hábitat en Marte",
    },
    subtitle: {
      en: "Partial gravity, months from help",
      es: "Gravedad parcial, a meses de ayuda",
    },
    conditions: {
      o2: 26.5,
      pressurePsi: 10.2,
      airflowCms: 10.0,
      gravityG: 0.38,
    },
    strongMatchesCount: 6,
  },
  {
    id: "iss_cabin",
    backendId: "iss",
    iconType: "iss",
    visualGradient: "from-amber-300 via-blue-900 to-slate-950",
    name: {
      en: "ISS / Spacecraft Cabin",
      es: "ISS / Cabina de Nave",
    },
    subtitle: {
      en: "Earth-like air, no buoyancy",
      es: "Aire terrestre, sin flotabilidad",
    },
    conditions: {
      o2: 21.0,
      pressurePsi: 14.7,
      airflowCms: 10.0,
      gravityG: 0.0,
    },
    strongMatchesCount: 11,
  },
  {
    id: "spacesuit_eva",
    backendId: "traje",
    iconType: "suit",
    visualGradient: "from-sky-300 via-blue-800 to-black",
    name: {
      en: "Spacesuit (EVA)",
      es: "Traje Espacial (EVA)",
    },
    subtitle: {
      en: "Pure oxygen at low pressure",
      es: "Oxígeno puro a baja presión",
    },
    conditions: {
      o2: 100.0,
      pressurePsi: 4.3,
      airflowCms: 10.0,
      gravityG: 0.17,
    },
    strongMatchesCount: 4,
  },
  {
    id: "earth_mine",
    backendId: "mina_tierra",
    iconType: "mine",
    visualGradient: "from-amber-400 via-yellow-800 to-stone-950",
    name: {
      en: "Earth: Underground Mine",
      es: "Tierra: Mina Subterránea",
    },
    subtitle: {
      en: "Spinoff · Antofagasta, ~2,750 m",
      es: "Spinoff · Antofagasta, ~2.750 m",
    },
    conditions: {
      o2: 20.9,
      pressurePsi: 10.6,
      airflowCms: 10.0,
      gravityG: 1.0,
    },
    strongMatchesCount: 5,
  },
];

export const GRAVITY_QUICK_STOPS = [
  { id: "orbit", g: 0.0, label: { en: "Orbit 0 g", es: "Órbita 0 g" } },
  { id: "moon", g: 0.17, label: { en: "Moon 0.17 g", es: "Luna 0.17 g" } },
  { id: "mars", g: 0.38, label: { en: "Mars 0.38 g", es: "Marte 0.38 g" } },
  { id: "earth", g: 1.0, label: { en: "Earth 1 g", es: "Tierra 1 g" } },
];

// Puntos ancla calibrados exactamente con el mockup para que cada hábitat coincida al 100%
const CALIBRATED_LOI_ANCHORS: {
  psi: number;
  g: number;
  loi: Record<Exclude<MaterialId, "cellulose">, number>;
}[] = [
  { psi: 10.2, g: 0.17, loi: { pmma: 16.6, sibal: 15.4, nomex: 25.1 } }, // Base Lunar Artemis
  { psi: 8.2,  g: 0.17, loi: { pmma: 16.9, sibal: 16.0, nomex: 25.5 } }, // Rover Presurizado
  { psi: 10.2, g: 0.38, loi: { pmma: 16.9, sibal: 15.9, nomex: 25.4 } }, // Hábitat en Marte
  { psi: 14.7, g: 0.0,  loi: { pmma: 16.6, sibal: 14.8, nomex: 24.2 } }, // ISS / Cabina de Nave
  { psi: 4.3,  g: 0.17, loi: { pmma: 18.1, sibal: 17.3, nomex: 26.7 } }, // Traje Espacial (EVA)
  { psi: 10.6, g: 1.0,  loi: { pmma: 17.6, sibal: 17.3, nomex: 26.5 } }, // Tierra: Mina Subterránea
];

/**
 * Calcula el Límite Mínimo de Oxígeno (LOI) y el Margen de Quemado en tiempo real.
 * Coincide exactamente al décimo de punto con los valores del mockup en los 6 hábitats
 * e interpola suavemente cuando el usuario mueve los sliders de presión, flujo o gravedad.
 */
export function evaluateMaterialInAtmosphere(
  materialId: MaterialId,
  conditions: AtmosphereConditions
): MaterialEvaluation {
  const spec = MATERIALS_CATALOG[materialId];
  if (materialId === "cellulose") return {
    materialId, shortName: spec.shortName, minO2ToBurnPct: NaN, earthTest1Pct: NaN,
    burnMarginPts: NaN, blindSpotPts: NaN, burns: false, available: false,
  };
  const { o2, pressurePsi, airflowCms, gravityG } = conditions;

  // Efecto de curva en "U" del flujo de ventilación respecto a 10.0 cm/s
  const flowOffset =
    airflowCms < 10.0
      ? 0.032 * Math.pow(10.0 - airflowCms, 1.35)
      : 0.0022 * Math.pow(airflowCms - 10.0, 1.6);

  // Interpolación ponderada por distancia inversa (IDW) en el plano (presión, gravedad)
  let num = 0.0;
  let den = 0.0;
  let exactAnchorLoi: number | null = null;

  for (const anchor of CALIBRATED_LOI_ANCHORS) {
    const dPsi = (pressurePsi - anchor.psi) / 10.4;
    const dG = (gravityG - anchor.g) / 1.0;
    const distSq = dPsi * dPsi + dG * dG;
    if (distSq < 1e-6) {
      exactAnchorLoi = anchor.loi[materialId];
      break;
    }
    const weight = 1.0 / Math.pow(distSq, 2);
    num += weight * anchor.loi[materialId];
    den += weight;
  }

  const baseLoi = exactAnchorLoi !== null ? exactAnchorLoi : num / den;
  const minO2ToBurnPct = Number((baseLoi + flowOffset).toFixed(1));
  const burnMarginPts = Number((o2 - minO2ToBurnPct).toFixed(1));
  const blindSpotPts = Number((spec.earthTest1LoiPct - minO2ToBurnPct).toFixed(1));

  return {
    materialId,
    shortName: spec.shortName,
    minO2ToBurnPct,
    earthTest1Pct: spec.earthTest1LoiPct,
    burnMarginPts,
    blindSpotPts,
    burns: burnMarginPts >= 0,
  };
}

/**
 * Texto descriptivo exacto del comportamiento físico de la llama según gravedad.
 */
export function describeFlamePhysics(conditions: AtmosphereConditions, lang: Language): string {
  const { gravityG } = conditions;
  if (gravityG <= 0.03) {
    return lang === "en"
      ? "Microgravity: a spherical blue diffusion flame. Without buoyancy, hot gases do not rise and fresh oxygen arrives only by slow ventilation."
      : "Microgravedad: una esfera azul difusiva. Sin flotabilidad, los gases calientes no suben y el oxígeno llega solo por ventilación lenta.";
  }
  if (gravityG <= 0.25) {
    return lang === "en"
      ? "Partial gravity: a weak, rounder teardrop. There is some buoyancy, but far less fresh air reaches the flame than on Earth."
      : "Gravedad parcial: una lágrima débil y redondeada. Hay algo de flotabilidad, pero llega mucho menos aire fresco que en la Tierra.";
  }
  if (gravityG <= 0.5) {
    return lang === "en"
      ? "Martian partial gravity: an intermediate teardrop plume. Buoyant convection is stronger than on the Moon, but still weaker than on Earth."
      : "Gravedad parcial marciana: una lágrima intermedia. La convección por flotabilidad es mayor que en la Luna, pero menor que en la Tierra.";
  }
  return lang === "en"
    ? "Earth gravity (1 g): strong natural buoyancy pulls hot gases upward into a tall, flickering yellow-orange flame."
    : "Gravedad terrestre (1 g): la fuerte flotabilidad natural eleva los gases calientes formando una llama alta y amarilla.";
}