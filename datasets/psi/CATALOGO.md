# Catálogo de investigaciones (`data/investigations.json`)

Versión 0.4 (con hallazgos de los papers del equipo, 2026-11-14) · Equipo AstroMetric, NASA Space Apps Antofagasta

## Qué es

Un archivo JSON con las investigaciones de combustión en microgravedad relevantes para el desafío
*Flame in Freefall*, todas descritas con los mismos campos para poder compararlas.
Es la **única base de datos** que lee la aplicación (más `background.json` con definiciones generales).

## De dónde salió

1. **PSI.** Los 26 registros de la búsqueda "combustion" de la API pública de PSI (14-11-2026,
   con `fetch_psi.py`), sin modificar en `data/psi_raw.json`. De ahí vienen identificadores, enlaces,
   equipos, hardware y varios rangos.
2. **Papers del repositorio del equipo** (`NASA-SPACE-APPS/papers`, nuevo en la versión 0.4).
   Cada hallazgo indica el PDF y la **página** donde se apoya.
3. **Fichas oficiales de la NASA y páginas de NASA Glenn** (13-11-2026).
4. **Informes en NTRS, tesis de la U. de Maryland y un artículo de *Scientific Reports***.
5. **El enunciado del desafío.**

Las fuentes 3 y 4 se leyeron con una herramienta que resume páginas. En los hallazgos tomados de
los papers (fuente 2), cada cifra se comprobó automáticamente contra el texto de la página citada;
el sentido de cada frase todavía requiere revisión humana.

## Contenido

| | Cantidad |
|---|---|
| Investigaciones | 31 |
| Con ficha en PSI | 19 |
| No están en PSI | 10 |
| Experimentos futuros | 2: FM2 y LUCI |
| Estudios en tierra que reutilizaron datos de PSI | 5 |
| Hallazgos con fuente | 61 (en 21 investigaciones) |
| Fuentes | 56 (11 son PDF de la carpeta `papers`) |

**Dato clave para el pitch:** los únicos ensayos con sólidos dentro de la atmósfera lunar son Saffire-VI
(28,8–31 % de O₂, ~54–55 kPa) y SoFIE (acrílico con 30 % de O₂ a 0,5 y 1 atm), y **ninguno tiene sus
datos en PSI**. SoFIE además encontró llamas que persisten varios minutos sin ventilación.

## Tabla de investigaciones

O₂ en %, presión en kPa, flujo en cm/s. "sin dato" = no aparece en las fuentes revisadas.

| Sigla | PSI | Plataforma | Combustible | O₂ | Presión | Flujo | Hallazgos | Falta completar |
|---|---|---|---|---|---|---|---|---|
| BASS | [PSI-26](https://psi.nasa.gov/physci/repo/data/investigations/PSI-26) | ISS | Sólido | sin dato | sin dato | hasta 40 | 0 | O₂, presión, años de vuelo, hallazgos |
| BASS-II | [PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25) | ISS | Sólido | 15–21 | sin dato | 0–55 | 6 | presión, años de vuelo |
| Saffire-I | [PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98) | Cygnus (tras desacoplarse de la ISS) | Sólido | 21,7 | 101,3 | 20 | 5 | — |
| Saffire-II | [PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99) | Cygnus | Sólido | 22,1 | 101,3 | 20–25 | 3 | — |
| Saffire-III | [PSI-100](https://psi.nasa.gov/physci/repo/data/investigations/PSI-100) | Cygnus | Sólido | 21,2 | 101,3 | 30 | 0 | hallazgos |
| Saffire-IV | No está en PSI | Cygnus (NG-13) | Sólido | 22 | 100 | 20 | 2 | — |
| Saffire-V | No está en PSI | Cygnus | Sólido | 25,4–26,2 | 70,7–72,6 | 20 | 2 | — |
| Saffire-VI | No está en PSI | Cygnus | Sólido | 28,8–31 | 54,1–55,2 | 5–20 | 4 | — |
| SAME | [PSI-102](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102) | ISS (Expedición 15) | Humo / aerosol | sin dato | sin dato | sin dato | 4 | O₂, presión, flujo, años de vuelo |
| SAME-R | [PSI-101](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101) | ISS (Expedición 24) | Humo / aerosol | sin dato | sin dato | sin dato | 1 | O₂, presión, flujo |
| DAFT / DAFT-2 | [PSI-47](https://psi.nasa.gov/physci/repo/data/investigations/PSI-47) | ISS (Expediciones 10-13) | Humo / aerosol | sin dato | sin dato | sin dato | 2 | O₂, presión, flujo, años de vuelo |
| FLEX | [PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) | ISS | Líquido | 10–50 | 50,7–304 | 0 | 3 | años de vuelo |
| FLEX-2 | [PSI-68](https://psi.nasa.gov/physci/repo/data/investigations/PSI-68) | ISS | Líquido | 10–40 | 50,7–304 | sin dato | 0 | flujo, años de vuelo, hallazgos |
| CFI | [PSI-39](https://psi.nasa.gov/physci/repo/data/investigations/PSI-39) | ISS | Líquido | sin dato | 25,3–506,6 | sin dato | 1 | O₂, flujo, años de vuelo |
| ACME-BRE | [PSI-20](https://psi.nasa.gov/physci/repo/data/investigations/PSI-20) | ISS | Gas | 21–40 | 57–100 | 0 | 2 | años de vuelo |
| ACME-CFI-G | [PSI-159](https://psi.nasa.gov/physci/repo/data/investigations/PSI-159) | ISS | Gas | hasta 85 | sin dato | sin dato | 0 | presión, flujo, años de vuelo, hallazgos |
| ACME-CLD Flame | [PSI-21](https://psi.nasa.gov/physci/repo/data/investigations/PSI-21) | ISS | Gas | 21 | sin dato | sin dato | 2 | presión, flujo, años de vuelo |
| ACME-E-FIELD Flames | [PSI-22](https://psi.nasa.gov/physci/repo/data/investigations/PSI-22) | ISS | Gas | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, años de vuelo, hallazgos |
| ACME-Flame Design | [PSI-10](https://psi.nasa.gov/physci/repo/data/investigations/PSI-10) | ISS | Gas | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, años de vuelo, hallazgos |
| ACME-s-Flame | [PSI-23](https://psi.nasa.gov/physci/repo/data/investigations/PSI-23) | ISS | Gas | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, años de vuelo, hallazgos |
| SPICE | [PSI-107](https://psi.nasa.gov/physci/repo/data/investigations/PSI-107) | ISS | Gas | sin dato | sin dato | 5,4–65 | 1 | O₂, presión, años de vuelo |
| SLICE | [PSI-106](https://psi.nasa.gov/physci/repo/data/investigations/PSI-106) | ISS | Gas | sin dato | sin dato | sin dato | 1 | O₂, presión, flujo |
| SoFIE | No está en PSI | ISS | Sólido | 30 | 50,7–101,3 | 0 | 4 | años de vuelo |
| FLARE | No está en PSI | ISS (módulo Kibo, JAXA) | Sólido | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, años de vuelo, hallazgos |
| FM2 | Experimento futuro, sin datos | Superficie lunar | Sólido | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, hallazgos |
| LUCI | Experimento futuro, sin datos | sin dato | Sólido | sin dato | sin dato | sin dato | 0 | O₂, presión, flujo, hallazgos |
| Confined Combustion | No está en PSI | ISS | Sólido | sin dato | sin dato | 2,6–25 | 7 | O₂, presión, años de vuelo |
| SCEM | No está en PSI | ISS (módulo japonés Kibo) | Sólido | 17,5–21,1 | sin dato | 0–20 | 3 | presión, años de vuelo |
| Cables-PE | No está en PSI | Vuelos parabólicos | Sólido | sin dato | sin dato | 5–20 | 2 | O₂, presión, años de vuelo |
| Olson-1987 | No está en PSI | Torres de caída de NASA Lewis (2,2 s y 5,18 s) | Sólido | hasta 100 | 101,3 | 0 | 3 | — |
| Varillas-PMMA | No está en PSI | Torre de caída de 2,5 s | Sólido | 21–40 | 101,3 | 0–25 | 3 | años de vuelo |

Con O₂ y presión registrados: Saffire-I, Saffire-II, Saffire-III, Saffire-IV, Saffire-V, Saffire-VI, FLEX, FLEX-2, ACME-BRE, SoFIE, Varillas-PMMA.

## Estudios en tierra que reutilizaron datos de PSI

| PSI | Estudio | Usa datos de |
|---|---|---|
| [PSI-117](https://psi.nasa.gov/physci/repo/data/investigations/PSI-117) | Efecto de perturbaciones termo-convectivas externas en la dinámica de llamas frías (modelo CFD) | FLEX |
| [PSI-142](https://psi.nasa.gov/physci/repo/data/investigations/PSI-142) | Estudios cuantitativos de transiciones de llama fría en extinción por radiación y estiramiento, con llamas en contraflujo | FLEX |
| [PSI-62](https://psi.nasa.gov/physci/repo/data/investigations/PSI-62) | Modelado de propagación concurrente de llama en microgravedad, comparado con los experimentos BASS | BASS, BASS-II |
| [PSI-60](https://psi.nasa.gov/physci/repo/data/investigations/PSI-60) | Análisis computacional y experimental de los datos de SPICE | SPICE |
| [PSI-115](https://psi.nasa.gov/physci/repo/data/investigations/PSI-115) | Uso de los datos de SAME para modelado y simulación avanzada de la generación de humo en microgravedad | SAME |

## Papers usados como fuente

| Paper | Archivo en el repositorio |
|---|---|
| Carmignani et al. 2026 - Quiescent flame spread and extinction over acrylic sheets in microgravity at increased oxygen concentration (Proc. Combust. Inst.) | `papers/Quiescent flame spread and extinction over acrylic sheets in microgravity at increased oxygen concentration.pdf` |
| Ferkul et al. 2017 - Results of Large-Scale Spacecraft Flammability Tests (ICES 2017, presentación) | `papers/Results of Large-Scale Spacecraft Flammability Tests.pdf` |
| Han et al. 2026 - Numerical study of concurrent flow flame spread over thin solids in normoxic conditions in microgravity (Proc. Combust. Inst.) | `papers/Numerical study of concurrent flow flame spread over thin solids in.pdf` |
| Kobayashi et al. 2026 - Dynamics of flame spread over filter papers in microgravity aboard the ISS (Proc. Combust. Inst.) | `papers/Dynamics of flame spread over filter papers in microgravity aboard the ISS.pdf` |
| Li et al. 2020 - Effects of Confinement on Flame Spread in Microgravity (ICES-2020-407) | `papers/Effects of Confinement on Flame Spread in Microgravity.pdf` |
| Li et al. 2021 - Confined Combustion of Polymeric Solid Materials in Microgravity (manuscrito aceptado) | `papers/Confined Combustion of Polymeric Solid Materials in microgravity.pdf` |
| Manu B V y Amit Kumar - Flame spread over thin circular PMMA rods (manuscrito; datos editoriales sin verificar) | `papers/Flame spread over thin circular PMMA rods.pdf` |
| Nagachi et al. 2018 - Can a spreading flame over electric wire insulation in concurrent flow achieve steady propagation in microgravity? (Proc. Combust. Inst.) | `papers/can spreading flame over electric wire insulation in concurrent flow achieve steady propagation in microgavity.pdf` |
| Olson 1987 - The Effect of Microgravity on Flame Spread Over a Thin Fuel (NASA TM-100195) | `papers/The Effect of Microgravity on Flame Spread over a Thin Fuel.pdf` |
| Sharma et al. 2024 - Effects of Confinement on Opposed-Flow Flame Spread over Cellulose and Polymeric Solids in Microgravity (Microgravity Sci. Technol.) | `papers/Effects of Confinement on Opposed-Flow Flame Spread over Cellulose.pdf` |
| Urban et al. 2024 - Preliminary Results from the Saffire VI Experiment (ICES-2024-365) | `papers/Preliminary results from the saffire VI Experiment.pdf` |

Papers de la carpeta que **no** se usaron: dos estudios numéricos (Li y Liao 2020; combustible
líquido de Wang y Decamps 2024), una presentación de planificación de Saffire (condiciones previstas,
no resultados) y dos vistas previas escaneadas sin texto legible.

## Estructura de una investigación

| Campo | Qué contiene |
|---|---|
| `id`, `acronym`, `name`, `family` | identificador interno, sigla, nombre y grupo |
| `pillars` | `prevencion`, `deteccion`, `supresion`, `fundamental` |
| `directness`, `directness_reason` | 1 a 5. **Criterio del equipo, no dato de la NASA** |
| `fuel_phase`, `fuels`, `geometry` | tipo de combustible, materiales y forma de las muestras |
| `o2`, `pressure`, `flow` | rangos: `{min, max, basis, note}` |
| `gravity`, `platform`, `facility`, `hardware` | gravedad (0 = microgravedad) y dónde se hizo |
| `years`, `pi` | años y equipo |
| `objectives`, `variables`, `diagnostics` | objetivo, qué se varió y qué se midió |
| `findings` | lista de `{text, source, page}` |
| `in_psi`, `psi` | estado en PSI e identificador, enlace, fechas y estudios que reutilizaron sus datos |
| `sources` | claves de la sección `sources` (`url` y, para los papers, `file`) |

## Reglas al editar

1. **`null` significa "no está en las fuentes", no cero.** Nada sin fuente, nada de supuestos.
2. **Hallazgos nuevos siempre al final de la lista.** El copiloto los cita por posición (`BASS-II#3`).
3. **Hallazgos de un PDF llevan `page`** (página del PDF, contando la portada).
4. **Las discrepancias entre fuentes se anotan en `note`, no se resuelven a ojo.** Hoy hay dos:
   flujo de Saffire-II (PSI: 20 o 30 cm/s; Ferkul 2017: 20 y 25) y de Saffire-III (PSI: 30; Han 2026: 25).
5. Después de editar: `python tests.py` y `python test_copilot.py`. **Una sola persona edita a la vez.**

## Lo que falta

- **Rangos vacíos:** O₂ en 15, presión en 18, flujo en 14 investigaciones.
- **Sin hallazgos:** BASS, Saffire-III, FLEX-2, ACME-CFI-G, ACME-E-FIELD Flames, ACME-Flame Design, ACME-s-Flame, FLARE, FM2, LUCI.
- **Revisión humana** de los 61 hallazgos, empezando por los que se mostrarán en la demo.
- **Figuras sin digitalizar** en varios papers (BASS-II, confinamiento, SoFIE): el repositorio del
  equipo ya tiene 91 mediciones transcritas en `datasets/papers/`.
