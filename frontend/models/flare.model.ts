// frontend/models/flare.model.ts

export type ViewStep = 'home' | 'scenario' | 'ranking' | 'predict' | 'copilot';
export type Language = 'es' | 'en';
export type SafetyPillar = 'all' | 'prevention' | 'detection' | 'suppression';
export type MaterialId = 'pmma' | 'sibal' | 'nomex';

export interface MaterialMargin {
  id: MaterialId;
  name: string;
  shortName: string;
  usage: string;
  earthLoiPct: number;       // Límite de O2 en NASA Test 1 (1g)
  scenarioLoiPct: number;    // Límite de O2 real/predicho en el escenario
  marginPts: number;         // O2_cabina - O2_min_escenario (Positivo = Arde)
  burnsInScenario: boolean;
}

export interface HabitatPreset {
  id: string;
  name: string;
  subtitle: string;
  badgeText: string;
  o2Pct: number;
  pressurePsi: number;
  pressureKpa: number;
  airflowCms: number;
  gravityG: number;
  gravityLabel: string;
  planetTone: 'moon' | 'rover' | 'mars' | 'iss' | 'eva' | 'earth';
  earthTestGapPts: number;   // Brecha de peligro oculto entre Test 1 (1g) y microgravedad
  o2VsEarthPct: number;      // Incremento relativo de O2 vs 21% terrestre
  matchingInvestigations: number;
  totalInvestigations: number;
  materials: Record<MaterialId, MaterialMargin>;
}

export interface FlamePhysicsRegime {
  id: string;
  label: string;
  gravityG: number;
  shortTag: string;
  description: string;
  dominantMechanism: string;
  pmmaLoiPct: number;
  spreadRateMms: number;
  flameColorHex: string;
  coreColorHex: string;
  aspectRatio: number; // 1.0 = esfera perfecta (0g), > 2.2 = lágrima alargada (1g)
}

export interface CopilotPresetQuestion {
  id: string;
  question: string;
  synthesis: string;
  physicalAlert: string;
  engineeringRecommendation: string;
  citations: { code: string; title: string; detail: string }[];
}