// frontend/src/services/ragService.ts
import { AtmosphereConditions, HabitatPreset, Language, MaterialId } from '../src/Models/scenario';
import { MATERIALS_CATALOG } from '../src/data/scenarioPresets';

export interface RagClaim {
  text: string;
  quote: string;
  citation_ids: string[];
  kind?: string;
  confidence?: string;
}

export interface RagCitation {
  id: string;
  document_id: string;
  title: string;
  source_file: string;
  page: number;
  text: string;
  url: string;
  relevance: number;
  scientific_confidence?: string;
}

export interface RagChatResponse {
  answer: string;
  executive_summary?: string | null;
  language?: 'es' | 'en';
  claims?: RagClaim[];
  physical_alert?: string | null;
  physical_alert_claim?: RagClaim | null;
  citations: RagCitation[];
  limitations: string[];
  conflicts: string[];
  mode: string;
  insufficient_evidence: boolean;
  usage?: {
    cached?: boolean;
    estimated_usd?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface CatalogSourceStatus {
  catalog: 'supabase' | 'local';
  detail: string;
}

export interface HealthStatus {
  status: string;
  paid_api_enabled: boolean;
  synthesis_ready: boolean;
  synthesis_model: string;
  embedding_model: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export type CitationKind = 'psi_catalog' | 'background' | 'catalog_summary' | 'paper';

export function getCitationKind(citationId: string): CitationKind {
  if (citationId.startsWith('fondo:')) return 'background';
  if (citationId === 'catalog:materiales') return 'catalog_summary';
  if (citationId.startsWith('psi:')) return 'psi_catalog';
  return 'paper';
}

export function resolveSourceUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Construye la consulta enriquecida con el contexto del escenario y material activo
 * utilizando las palabras clave que el motor TF-IDF (catalog.py) y el LLM (assistant.py) reconocen.
 */
export function buildContextualizedQuery(
  rawQuestion: string,
  includeContext: boolean,
  habitat: HabitatPreset,
  conditions: AtmosphereConditions,
  materialId: MaterialId,
  lang: Language
): string {
  const cleanQ = rawQuestion.trim();
  if (!includeContext) return cleanQ;

  const mat = MATERIALS_CATALOG[materialId];
  const kpa = (conditions.pressurePsi * 6.89476).toFixed(1);

  if (lang === 'en') {
    return `${cleanQ} (Context: ${habitat.name.en}, material ${mat.name.en} / ${mat.shortName}, atmosphere ${conditions.o2.toFixed(1)}% O2, pressure ${conditions.pressurePsi.toFixed(1)} psi / ${kpa} kPa, airflow ${conditions.airflowCms.toFixed(1)} cm/s, gravity ${conditions.gravityG.toFixed(2)} g)`;
  }

  return `${cleanQ} (Contexto: ${habitat.name.es}, material ${mat.name.es} / ${mat.shortName}, atmósfera ${conditions.o2.toFixed(1)}% O2, presión ${conditions.pressurePsi.toFixed(1)} psi / ${kpa} kPa, flujo ventilación ${conditions.airflowCms.toFixed(1)} cm/s, gravedad ${conditions.gravityG.toFixed(2)} g)`;
}

/**
 * Genera preguntas sugeridas dinámicas adaptadas al hábitat y material seleccionado
 */
export function getDynamicSuggestedQuestions(
  habitat: HabitatPreset,
  conditions: AtmosphereConditions,
  materialId: MaterialId,
  lang: Language
): string[] {
  const matName = MATERIALS_CATALOG[materialId].name[lang];
  const shortMat = MATERIALS_CATALOG[materialId].shortName;

  if (lang === 'en') {
    return [
      `Why can ${matName} pass Earth tests but burn in microgravity with slow airflow?`,
      `What does NASA PSI evidence say about ${shortMat} at ${conditions.o2.toFixed(0)}% O₂ in ${habitat.name.en}?`,
      `What counter-intuitive fire behaviors (cool flames, nitrogen jets, upstream spread) occur in BASS, FLEX, or Saffire?`,
      habitat.backendId === 'mina_tierra'
        ? `How do SAME and DAFT help distinguish smoke from dust in underground mining?`
        : `How do 0 g and 1 g experiments bound fire risk at ${conditions.gravityG.toFixed(2)} g with E-FIELD?`,
    ];
  }

  return [
    `¿Por qué ${matName} puede pasar pruebas terrestres pero arder en microgravedad con flujo lento?`,
    `¿Qué evidencia hay en NASA PSI sobre ${shortMat} con ${conditions.o2.toFixed(0)}% O₂ para ${habitat.name.es}?`,
    `¿Qué fenómenos contraintuitivos (llamas frías en FLEX, chorro de N₂ en BASS o propagación contra el viento) reporta PSI?`,
    habitat.backendId === 'mina_tierra'
      ? `¿Cómo ayudan SAME y DAFT a discriminar entre humo de incendio y polvo en minería subterránea?`
      : `¿Cómo se acota el riesgo de incendio a ${conditions.gravityG.toFixed(2)} g usando datos de 0 g, 1 g y el viento iónico de E-FIELD?`,
  ];
}

export async function queryRagCopilot(params: {
  query: string;
  language: Language;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RagChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      query: params.query,
      limit: params.limit ?? 6,
      filters: {},
      language: params.language,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(
      errBody?.error?.message ||
        errBody?.detail ||
        `Error al consultar el motor RAG (${response.status})`
    );
  }

  return response.json();
}

export async function fetchRagStatus(): Promise<{
  health: HealthStatus | null;
  source: CatalogSourceStatus | null;
}> {
  try {
    const [hRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/health`).catch(() => null),
      fetch(`${API_BASE}/api/catalog/source`).catch(() => null),
    ]);
    const health = hRes && hRes.ok ? ((await hRes.json()) as HealthStatus) : null;
    const source = sRes && sRes.ok ? ((await sRes.json()) as CatalogSourceStatus) : null;
    return { health, source };
  } catch {
    return { health: null, source: null };
  }
}

// ---------------------------------------------------------------------------
// Informe de decisión (Motor 4): POST /api/report
// ---------------------------------------------------------------------------
export interface ReportItem {
  text: string; // afirmación con sus números de cita, p. ej. "... [1, 3]"
  claim: RagClaim;
}

export interface ReportSection {
  id: 'materials' | 'suppression' | 'safety';
  title: string;
  items: ReportItem[];
}

export interface DecisionReport {
  scenario: Record<string, unknown> & { name: string; o2_pct: number; pressure_kpa: number; gravity_g: number; customized?: boolean };
  material: { id: string; name: string; name_en: string; short_name: string };
  language: 'es' | 'en';
  verdict: {
    status: 'flammable' | 'not_flammable_in_tests' | 'insufficient_evidence';
    headline: string;
    text: string | null;
    claim: RagClaim | null;
  };
  sections: ReportSection[];
  read_first: { investigation_id: string; acronym: string; name: string; relevance_score: number; in_psi: string; tests_material: boolean }[];
  coverage: Record<string, unknown>;
  gaps: string[];
  citations: RagCitation[];
  limitations: string[];
  mode: 'generated' | 'evidence_only' | 'declined' | 'no_evidence';
  scenario_source: string;
  usage?: { cached?: boolean };
}

export async function fetchDecisionReport(params: {
  scenarioId: string;
  materialId: string;
  language: Language;
  conditions?: AtmosphereConditions;
  signal?: AbortSignal;
}): Promise<DecisionReport> {
  const c = params.conditions;
  const response = await fetch(`${API_BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      scenario_id: params.scenarioId,
      material_id: params.materialId,
      language: params.language,
      ...(c
        ? {
            o2_pct: Number(c.o2.toFixed(1)),
            pressure_kpa: Number((c.pressurePsi * 6.894757).toFixed(1)),
            flow_cms: Number(c.airflowCms.toFixed(1)),
            gravity_g: Number(c.gravityG.toFixed(3)),
          }
        : {}),
    }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error?.message || errBody?.detail || `Error al generar el informe (${response.status})`);
  }
  return response.json();
}
