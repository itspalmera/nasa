# API del informe de decisión (Motor 4)

Flujo: el usuario elige un **escenario** y un **material**; el backend devuelve un **informe citado** que se muestra
arriba del Copilot. El chat (`POST /api/chat`) no cambia.

## 1. `GET /api/scenarios`
Hábitats predefinidos. Lee la tabla `habitats_presets` de Supabase; si no está disponible usa `datasets/psi/investigations.json`.

```json
{"source": "supabase",
 "scenarios": [{"id": "luna", "name": "Base lunar / rover presurizado", "o2_pct": 30.0, "pressure_kpa": 70.3,
                "pressure_psi": 10.2, "flow_cms": 10.0, "gravity_g": 0.167, "note": "..."}]}
```

## 2. `GET /api/materials`
Lista estática (`datasets/psi/materials.json`) más lo que el catálogo tiene de cada material.

```json
{"materials": [{"id": "pmma", "name": "Acrílico (PMMA)", "name_en": "Acrylic (PMMA)", "short_name": "PMMA",
                "usage": "Ventanas, paneles, carcasas", "usage_en": "Windows, panels, enclosures",
                "investigations": ["BASS", "BASS-II", "SoFIE", "..."], "planned": [], "findings": 31}]}
```
`usage` es una etiqueta de interfaz, no evidencia. `investigations` = investigaciones completadas que ensayaron el material.

## 3. `POST /api/report` (alias `/api/motor4/report`)
Cuerpo: `{"scenario_id": "luna", "material_id": "pmma", "language": "es"}`.
Opcionales para sliders: `o2_pct`, `pressure_kpa`, `flow_cms`, `gravity_g` (reemplazan el valor del preset).
Tarda varios segundos la primera vez (llama a la IA); después sale de caché. Ids desconocidos devuelven 404.

Respuesta:

| Campo | Qué es | Origen |
| --- | --- | --- |
| `scenario`, `material` | Lo elegido (con `customized: true` si hubo sliders) | Supabase / JSON |
| `verdict.status` | `flammable`, `not_flammable_in_tests` o `insufficient_evidence` | IA, validado |
| `verdict.headline` | Título listo para mostrar | Plantilla según `status` |
| `verdict.text` | Frase del veredicto con sus números de cita, o `null` | IA, validado |
| `sections[]` | `materials`, `suppression`, `safety`: `{id, title, items[{text, claim}]}` | IA, validado |
| `read_first[]` | 3 investigaciones completadas, primero las que ensayaron el material: `acronym`, `relevance_score`, `tests_material` | Motor 1 |
| `coverage` | Qué investigaciones midieron el material dentro del O2, presión, flujo y gravedad del escenario | Calculado del catálogo |
| `gaps[]` | Frases sobre lo que nadie ha medido (por ejemplo, la gravedad del escenario) | Calculado del catálogo |
| `citations[]` | Fuentes citadas; `[n]` en los textos = posición en esta lista (desde 1) | Catálogo PSI y papers |
| `limitations[]` | Límites de la evidencia | IA |
| `mode` | `generated`, `evidence_only` (IA apagada), `declined` (la IA se negó), `no_evidence` | — |

Reglas de confianza:
- Cada afirmación de la IA lleva una cita con frase textual; si la frase no aparece tal cual en la fuente, se descarta.
- Si el veredicto no pasa esa validación, `status` queda en `insufficient_evidence`.
- El informe **no** entrega márgenes de O2 ni intervalos de predicción: el catálogo no tiene límites de oxígeno medidos
  por material y escenario. Una estimación así debe venir del Motor 2 (`/api/motor2/predict`) y mostrarse como estimación.
