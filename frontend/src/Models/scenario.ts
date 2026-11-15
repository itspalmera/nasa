//frontend/src/Models/scenario.ts
export type Language = "en" | "es";

export type MaterialId = "cellulose" | "pmma" | "sibal" | "nomex";

export type SafetyPillar = "all" | "prevention" | "detection" | "suppression";

export type HabitatId =
  | "artemis_lunar_base"
  | "pressurized_rover"
  | "mars_habitat"
  | "iss_cabin"
  | "spacesuit_eva"
  | "earth_mine";

export interface AtmosphereConditions {
  o2: number;          // % molar O2 (10.0 - 100.0)
  pressurePsi: number; // psia (3.0 - 25.0)
  airflowCms: number;  // cm/s (0.0 - 50.0)
  gravityG: number;    // g (0.00 - 1.00)
}

export interface MaterialSpec {
  id: MaterialId;
  shortName: string;
  name: Record<Language, string>;
  subtitle: Record<Language, string>;
  baseLoi0gPct: number;
  earthTest1LoiPct: number;
}

export interface MaterialEvaluation {
  materialId: MaterialId;
  shortName: string;
  minO2ToBurnPct: number;
  earthTest1Pct: number;
  burnMarginPts: number;     // cabin O2 - minO2ToBurnPct (positive = burns)
  blindSpotPts: number;      // earthTest1Pct - minO2ToBurnPct (positive = Earth test is optimistic)
  burns: boolean;
  available?: boolean;
}

export interface HabitatPreset {
  id: HabitatId;
  backendId: string;         // Maps to data/investigations.json ("luna", "rover", "marte", "iss", "traje", "mina_tierra")
  iconType: "moon" | "rover" | "mars" | "iss" | "suit" | "mine";
  visualGradient: string;
  name: Record<Language, string>;
  subtitle: Record<Language, string>;
  conditions: AtmosphereConditions;
  strongMatchesCount: number;
}