// frontend/src/services/api.ts

// Use the Next.js proxy so local and deployed clients share the same API origin.
const API_BASE_URL = "/api";
const PSI_TO_KPA = 6.89476;
const BACKEND_PILLARS: Record<string, string> = {
  all: "todos",
  prevention: "prevencion",
  detection: "deteccion",
  suppression: "supresion",
};

export interface AtmospherePayload {
  o2: number;
  pressure_psi: number;
  flow: number;
  gravity: number;
  selected_pillar?: string;
}

export async function fetchMissionMatch(conditions: AtmospherePayload) {
  try {
    const response = await fetch(`${API_BASE_URL}/motor1/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        o2: conditions.o2,
        pressure: conditions.pressure_psi * PSI_TO_KPA,
        flow: conditions.flow,
        gravity: conditions.gravity,
        selected_pillar: conditions.selected_pillar
          ? BACKEND_PILLARS[conditions.selected_pillar] ?? conditions.selected_pillar
          : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // Retorna el ranking ordenado desde Python
  } catch (error) {
    console.error("Fallo al conectar con el backend de PyraScope:", error);
    return null;
  }
}
