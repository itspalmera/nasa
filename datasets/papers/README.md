# Mediciones extraídas de los PDF de `papers`

Se examinaron los **19 PDF** del repositorio. Este paquete contiene **143 registros de extracción**, no 143 experimentos independientes. Las tablas y los valores seleccionados se transcribieron con sus páginas; las cuatro tablas principales de NASA TM-100195 se comprobaron visualmente. Las ampliaciones de PMMA se digitalizaron desde marcadores vectoriales identificados en la figura original; no se generaron puntos intermedios de curvas ni se inventaron condiciones ausentes.

## Archivos

- `combustion-observations.json`: 111 filas con los campos obligatorios del contrato OOD; todas tienen `reviewed: false`. Contienen 111 velocidades de propagación y 51 longitudes de llama. No contienen umbrales de oxígeno convertidos artificialmente en observaciones puntuales ni temperaturas de llama inventadas.
- `extracted-measurements.csv`: los 143 registros, incluidos resultados incompletos, celdas originales, banderas y campos ausentes; se puede abrir en Excel. Las listas y celdas compuestas están serializadas como JSON en sus columnas.
- `confined-digitization.json`: 20 puntos digitalizados manualmente de combustión confinada; incluye centros en píxeles de las imágenes originales, calibración de ejes, filas exportadas y auditoría. Se reproduce con `python scripts/extract_confined_observations.py`.
- `pmma-figure4-digitization.json`: coordenadas, calibración y puntos reproducibles de la figura de PMMA.
- `extraction-audit.json`: inventario de los 19 documentos, huellas SHA-256, páginas PDF (numeración desde 1), ubicación de cada tabla/fila, valores originales, conversiones, exclusiones y notas. Este archivo permite verificar qué observación procede de qué PDF.

## Cargar el archivo local

Desde la raíz del repositorio, después de actualizar la rama `mey`, en PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\import_paper_observations.py --check
.\.venv\Scripts\python.exe scripts\import_paper_observations.py
```

El importador valida el esquema, comprueba las huellas de los PDF de origen y escribe `combustion-observations.json` en el `DATA_DIR` configurado del backend (por defecto `data/`). Conserva las filas ya existentes, incluidas las revisiones locales, y no duplica identificadores en importaciones posteriores. No modifica los PDF ni concede aprobación científica. Recarga la página después de importar: el panel mostrará las observaciones pendientes de revisión.

El archivo de `datasets/papers/` está versionado en Git; el archivo activo de `data/` permanece ignorado para preservar los cambios locales del usuario. No es necesario instalar el paquete en modo editable: el script encuentra `backend` desde su propia ubicación.

## Qué se extrajo

| Fuente | Registros de extracción | Filas exportadas al contrato OOD |
|---|---:|---:|
| Olson (1987), NASA TM-100195 | 89 | 68 |
| Manu B V y Amit Kumar, PMMA fino (manuscrito suministrado) | 20 | 20 |
| Resultados Saffire I/II (presentación) | 6 | 3 |
| Resultados preliminares Saffire VI, ICES-2024-365 | 5 | 0 |
| Kobayashi et al., SCEM/ISS, Fig. 1A | 2 | 0 |
| Manuscrito de propagación concurrente sobre aislamiento de cables | 1 | 0 |
| Li et al., ICES-2020-407, Fig. 7a | 9 | 9 |
| Sharma et al. (2024), Fig. 13 | 11 | 11 |
| **Total** | **143** | **111** |

Las 89 entradas de Olson son 77 filas individuales de las tablas A-I–A-IV, 4 límites de extinción expresados como intervalos y 8 filas de una tabla secundaria de hipergravedad. De las 77 filas individuales se excluyeron 8 con propagación oscilatoria y 1 con una posible anomalía de impresión; quedan 68. En Olson no se añadieron como experimentos nuevos los promedios de las tablas ni sus repeticiones en la tabla II. En el manuscrito de PMMA, cada punto publicado representa una media de dos repeticiones: se conserva como una única observación agregada, sin inventar las dos filas de origen.

### NASA TM-100195

Sandra L. Olson, *The Effect of Microgravity on Flame Spread Over a Thin Fuel*, diciembre de 1987. Tabla A-I/A-II: página PDF 31 (impresa 26). Tabla A-III/A-IV: página PDF 32 (impresa 27). Condiciones: páginas PDF 11–12. Límites y errores: páginas PDF 33–34.

- Combustible: tejido Kimwipes, 99% celulosa y 1% resina de poliamida; muestras de aproximadamente 30 × 150 mm. Los espesores de 0.076 y 0.152 mm permanecen en configuraciones distintas.
- Presión: 1 atm → 101.325 kPa. Flujo externo impuesto: 0 cm/s (ambiente quiescente). No se confunde este flujo con la convección inducida por flotabilidad.
- El valor `gravity_g=0` es una **coordenada nominal de microgravedad**, coherente con la tabla II de la página PDF 26; no es una lectura de acelerómetro ni implica gravedad residual exactamente nula. El valor 1 identifica la condición de gravedad normal.
- Temperatura inicial: **null**. El informe indica que varió de 290 a 305 K; no se rellenó cada fila con 300 K, que aparece como propiedad para cálculos.
- Conversiones: cm/s × 10 → mm/s; cm × 10 → mm. Las tasas se toman de la columna individual `Vf`, no de `Average Vf`.
- Las longitudes con nota `b` (aún en transición) se conservan en la auditoría y se omiten del campo `length_mm` exportado. En gravedad normal la longitud corresponde al mínimo durante el parpadeo, según la definición de la página PDF 31; no es una media temporal.
- Las notas `a` identifican velocidades oscilatorias: esas filas están en la auditoría, no en el archivo OOD propuesto para propagación estacionaria.
- La segunda fila de 100% O2 en A-III repite el triplete 2.72 cm/s, 4.78 cm, 2.11 cm de otra tabla. Se transcribió como está impreso y se excluyó hasta aclararlo; no se corrigió por conjetura.
- La conclusión en la página PDF 29 asigna 26% al espesor simple, pero el Apéndice B.1.6 dice que este ardió a 21% y se extinguió a 20.5%. La auditoría conserva la evidencia detallada y señala la contradicción. Los cuatro límites se mantienen como pares «ardió a / se extinguió a», no como umbrales exactos ni desviaciones estándar.
- Los errores de repetibilidad (hasta 5.8% o 15%), tolerancias y rangos no se reinterpretaron como sigma gaussiana por observación. Por eso `uncertainty` permanece vacío.
- El grupo de dependencia abarca de forma conservadora todo el estudio. Los identificadores `...rowNN` son índices de transcripción, no números originales de ejecución recuperados.

### Otras fuentes con valores explícitos

**PMMA fino:** 20 valores de propagación promediados sobre dos repeticiones por punto, en varillas de 0.5 y 1 mm, separados por diámetro. La página PDF 1 fija 21% O2 y 1 atm; la página 3 especifica la misma cámara en gravedad normal y torre de caída. Se preservan las dos cifras explícitas del texto (0.68 mm/s a 0 cm/s y 0.53 mm/s a 25 cm/s para 1 mm a 1 g), sin duplicarlas. Se añaden 18 puntos de Fig. 4, página 7, con el adaptador reproducible `scripts/extract_pmma_figure4.py`.

El adaptador comprueba la huella del PDF, los ejes, las etiquetas y la coincidencia de los centros de marcadores con los nodos de las curvas vectoriales. Extrae únicamente los puntos experimentales señalados; no muestrea el interior de líneas suavizadas ni los extremos de las barras de error. `pmma-figure4-digitization.json` conserva los anclajes, índices y coordenadas. Los valores se redondean a 0.01 mm/s; esa resolución de lectura **no es una desviación estándar de medida**. No se inventan las dos repeticiones como filas independientes. El 0 g del gráfico es nominal y los metadatos editoriales del manuscrito siguen sin verificar.

**Saffire I/II:** la tabla I de la presentación (página PDF 29) aporta velocidades y geometrías. Han et al. (2026), DOI 10.1016/j.proci.2026.106327, tabla 1 (página PDF 2 del documento también incluido), aporta las condiciones experimentales nominales de los vuelos I/II: 1 atm, 21.7%/22.1% de oxígeno y 20/25 cm/s. Esto permite completar tres observaciones **concurrentes de SIBAL**: muestra 1-1, 1.8 mm/s; 2-5, 2.1 mm/s; 2-6, 2.6 mm/s. La primera tiene además una longitud de llama aproximada de 40 mm. Las anchuras de 406 y 50 mm permanecen en dos configuraciones distintas. El oxígeno se registra como condición inicial nominal, con advertencia sobre su variación temporal; no se presenta como una medida constante exacta.

La presión no se dedujo de la palabra «ambiente»: está explícita en la tabla secundaria. El importador verifica también la huella de ese PDF complementario. No se importó ninguna columna de simulación ni longitud de pirólisis como longitud de llama. No se mezclaron los resúmenes discrepantes de Saffire IV/VI entre fuentes. Las dos filas de silicona corresponden a controles terrestres cuyos valores de presión/oxígeno no pueden completarse con una tabla de condiciones de vuelo; continúan excluidas. La muestra opuesta 1-2 también permanece en la auditoría incompleta.

Los dos conjuntos nuevos de SIBAL solo cubren un nivel nominal de gravedad y menos de tres filas: son **observations only**, con gráficos y tablas disponibles, pero sin estimación a otras gravedades bajo el protocolo actual.

**Saffire IV–VI:** las tablas 1 y 2 (páginas PDF 3 y 6) permiten asociar cinco muestras con presión, oxígeno, flujo, duración y calorimetría. La temperatura de salida del SFU **no es temperatura de llama**. No se convirtió longitud/duración en velocidad medida, ni potencia calorimétrica en otra salida del modelo.

**SCEM/ISS:** Fig. 1A, página PDF 7: pendientes explícitas de 1.47 mm/s (20 cm/s, 17.5% O2, modo 2D) y 0.56 mm/s (0 cm/s, 21.1% O2, modo flamelet). La presión de 101.3 kPa se menciona como máximo operativo, no como lectura de esas ejecuciones; permanece ausente. El ancho de muestra y la aceleración residual no están ligados inequívocamente a estas dos curvas. Los modos 2D y flamelet no se combinan.

**Aislamiento de cables:** la leyenda de Fig. 7 (página PDF 14) identifica 2.6 mm/s como experimental a 150 mm/s de flujo (=15 cm/s), 18% O2. La página 7 fija 1 atm. Se conserva como candidato incompleto por faltar la aceleración y la vinculación exacta de núcleo/geometría. Los valores cercanos de 1.2 mm/s, 11.4 mm y 1500 K corresponden a cálculos o suposiciones, no a tres mediciones adicionales.

## Estado de revisión y entrenamiento

**No se marcó ninguna extracción propia como revisada.** El JSON ya contiene observaciones reales transcritas; eso no equivale a validar su uso conjunto para regresión. Una revisión científica debe comprobar las fuentes, las convenciones de gravedad, las definiciones de salida, la compatibilidad y los grupos de dependencia antes de aprobar filas en el archivo activo. No basta con cambiar todos los `reviewed` a `true` para quitar el bloqueo.

No se ha establecido validación científica independiente con estas extracciones pendientes. La casilla **Use extracted observations for exploratory estimates** permite ajustes exploratorios explícitos sin aprobar filas; los resultados quedan señalados como no validados y la validación LOGO permanece bloqueada en ese modo. Las pruebas de integración comprueban que ambos modelos pueden devolver estimaciones exploratorias sin modificar los archivos ni conceder aprobación. En los subconjuntos NASA y PMMA solo existen dos niveles nominales de gravedad; además, el grupo conservador del estudio excluye todas sus filas al retener uno de esos niveles. Por tanto **no hay evidencia LOGO independiente** con este paquete. Las observaciones de hipergravedad citadas por Olson proceden de otro trabajo y otros materiales: no se mezclaron con Kimwipes para crear artificialmente más niveles.

El paquete no contiene observaciones directas de la Luna o Marte. Los resultados numéricos, las analogías, las previsiones de ensayos y las figuras aún no digitalizadas permanecen separados.

## Inventario de los 19 PDF

| PDF | Páginas | Registros / filas OOD | Evaluación de esta extracción |
|---|---:|---:|---|
| Combustion of Solids in Microgravity Results from the.pdf | 21 | 0 / 0 | Experimental presentation with plots/images; plotted output values not digitized in this pass. |
| Confined Combustion of Polymeric Solid Materials in microgravity.pdf | 37 | 0 / 0 | Experimental test matrix plus figures; no table of directly linked exact output values transcribed. Requires figure digitization, not trend-to-number conversion. |
| Dynamics of flame spread over filter papers in microgravity aboard the ISS.pdf | 8 | 2 / 0 | Two Figure 1A explicitly labeled slopes extracted. Run pressure and specimen width unresolved. |
| Effects of Ambient Conditions on Concurrent-Flow Flame Spread over a wide thin solid in microgravity.pdf | 22 | 0 / 0 | Numerical simulations with comparisons to prior Saffire data; do not count simulations or repeated literature data as new direct measurements. |
| Effects of Confinement on Flame Spread in Microgravity.pdf | 10 | 9 / 9 | Nine Fig. 7a SIBAL marker readings, separated by baffle type and distance. Nominal ISS atmosphere; overlapping D=3 cm markers excluded. |
| Effects of Confinement on Opposed-Flow Flame Spread over Cellulose.pdf | 13 | 11 / 11 | Eleven Fig. 13 SIBAL flow-stage readings linked to Table 1. Repeated figures excluded; stages share campaign dependence. |
| Effects of oxygen concentration of oxidizer flow on laminar diffusion flame established over liquid fuel beds at microgravity.pdf | 25 | 0 / 0 | Numerical liquid-fuel study; incompatible mechanism, no simulated values promoted to observations. |
| Fire Safety in Space – Beyond Flammability Testing of Small.pdf | 17 | 0 / 0 | Background/design and literature discussion. No additional unambiguous run-level numerical output rows extracted. |
| Fire safety in space – Investigating flame spread interaction over wires.pdf | 7 | 0 / 0 | Image-only ScienceDirect article preview; OCR recovered abstract/snippets/recommendations, not a full experimental table. Full article needed. |
| Flame spread Effects of microgravity and scale.pdf | 15 | 0 / 0 | Image-only ScienceDirect article preview; OCR recovered preview content. Overlaps Saffire campaigns; not counted as an independent dataset. |
| Flame spread over thin circular PMMA rods.pdf | 9 | 20 / 20 | 20 plotted experimental averages: two textual anchors preserved, 18 additional marker values vector-digitized. Diameters 0.5/1 mm kept separate; nominal 0/1 g, 21% O2, 1 atm. Publication metadata pending review. |
| Numerical study of concurrent flow flame spread over thin solids in.pdf | 9 | 0 / 0 | Simulation paper, used only for explicitly tabulated experimental Saffire I/II conditions (Table 1), with supplementary citation hashes. No numerical model outputs promoted to observations; conflicting IV/VI condition summaries not merged. |
| Preliminary results from the saffire VI Experiment.pdf | 7 | 5 / 0 | Five Table 1/2 samples extracted; output temperatures are at SFU outlet, not flame temperatures. Calorimetry is unsupported by current regression. |
| Quiescent flame spread and extinction over acrylic sheets in microgravity at increased oxygen concentration.pdf | 8 | 0 / 0 | SoFIE/RTDFS experimental curves with changing pressure/thickness; pointwise values require graph digitization and condition linkage. No invented graph coordinates. |
| Results of Large-Scale Spacecraft Flammability Tests.pdf | 36 | 6 / 3 | Three concurrent SIBAL records completed with nominal pressure/oxygen from Han et al. Table 1. Remaining silicone controls and opposed sample remain incomplete. No gravity-dependent fit for single-level SIBAL cohorts. |
| Saffire A Novel Approach to Study of Spacecraft Fire Safety Using Un-Manned Spacecraft.pdf | 32 | 0 / 0 | Experiment design/planning presentation. Planned test conditions are not completed experimental measurements. |
| The Effect of Microgravity on Flame Spread over a Thin Fuel.pdf | 50 | 89 / 68 | Four primary Appendix A tables fully transcribed, individual rows only; averages and duplicate Table II summaries excluded. Additional extinction brackets and secondary hypergravity table retained separately. |
| can spreading flame over electric wire insulation in concurrent flow achieve steady propagation in microgavity.pdf | 23 | 1 / 0 | One explicitly experimental spread rate extracted; nearby theoretical spread/length values excluded. |
| the effect of gravity on flame spread over pmma cylinders.pdf | 9 | 0 / 0 | Screened native text; further source-specific table or graph extraction required. No additional unambiguous run-level numeric outputs transcribed. |

Dos archivos eran impresiones de vistas previas de ScienceDirect y no ofrecían texto nativo; se aplicó OCR para identificar su contenido. Sus recomendaciones y fragmentos no se trataron como tablas del artículo completo. En otros documentos los valores están en gráficos: todavía requieren digitalización y enlace a cada condición; «0 filas exportadas» no significa que el artículo carezca de datos experimentales.

Para probar la importación sin escribir, usa `--check`. Para verificar conversiones, exclusiones, conservación de revisiones locales, huellas de origen y bloqueo de entrenamiento, ejecuta `pytest tests/test_paper_observations.py` con las dependencias de pruebas y ciencia instaladas.

## Configuraciones disponibles tras ampliar el paquete

| Material y configuración | Filas | Gravedades nominales | Uso actual |
|---|---:|---|---|
| Kimwipes, lámina 0.076 mm, quiescente | 37 | 0, 1 g | Estimación exploratoria |
| Kimwipes, lámina 0.152 mm, quiescente | 31 | 0, 1 g | Estimación exploratoria |
| PMMA transparente, varilla 1 mm, flujo opuesto | 12 | 0, 1 g | Estimación exploratoria de velocidad |
| PMMA transparente, varilla 0.5 mm, flujo opuesto | 8 | 0, 1 g | Estimación exploratoria de velocidad |
| SIBAL, lámina 406 mm de ancho, concurrente | 1 | 0 g | Observaciones únicamente |
| SIBAL, lámina 50 mm de ancho, concurrente | 2 | 0 g | Observaciones únicamente |

Para PMMA, el rango de flujo observado es 0–25 cm/s, mientras que oxígeno y presión están fijos a 21% y 101.325 kPa. El panel muestra estos rangos y advierte al consultar fuera de ellos. Más configuraciones no equivalen a validación independiente. Todas las filas nuevas permanecen pendientes de revisión científica.

Ejecuta de nuevo `python scripts/import_paper_observations.py` después de actualizar Git: añade 20 filas a la versión anterior de 91 (41 si conservas la versión de 70) y conserva todas las filas y revisiones locales existentes. Una segunda importación no duplica registros.

## Ampliación: 20 observaciones de combustión confinada

Se conservan intactas las primeras 91 filas y se añaden **20 velocidades de
propagación**, para un total de **111 observaciones**:

- **9 puntos** de Li et al., *Effects of Confinement on Flame Spread in Microgravity*,
  ICES-2020-407, Fig. 7a, página PDF 8. Son mediciones con flujo concurrente
  impuesto de 7 cm/s sobre SIBAL expuesto de 22 × 100 mm, con tres tipos de
  baffle y distancias entre baffles de 2, 4 y 5 cm. Se excluyen los tres puntos
  superpuestos de 3 cm. El eje está en cm/s: se convierte a mm/s multiplicando por 10.
- **11 puntos** de Sharma et al. (2024), DOI `10.1007/s12217-024-10106-y`, Fig. 13,
  página PDF 9, enlazados a la tabla 1 de la página 5. Son etapas de flujo opuesto
  de cuatro configuraciones SIBAL, no once ensayos independientes. Se conservan
  los valores nominales de flujo de la tabla; no se añaden otra vez las figuras
  11, 12 o 14 que repiten estas mediciones. La sección de métodos indica 22 mm
  de ancho expuesto, mientras que la leyenda de la figura 14 dice 21 mm: se
  registra esta discrepancia para revisión.

Ambos documentos especifican 1 atm y aproximadamente 22% O₂, con variaciones
diarias de 21.3–22.9%. Se conserva **22% como condición nominal**, no como lectura
exacta de cada punto. La temperatura no se imputa. El valor de gravedad 0 g
representa microgravedad nominal de la ISS; no se inventan mediciones lunares o
marcianas.

La digitalización es **manual sobre marcadores raster**, con reproducción de las
conversiones mediante coordenadas y ejes registrados. El adaptador verifica la
huella del PDF, la imagen y la presencia del color cerca de cada coordenada;
esas comprobaciones no constituyen revisión científica independiente. Se redondea
a 0.01 mm/s, que es resolución de lectura, no desviación estándar. Las barras de
intervalos al 95% de la figura de 2020 no se convierten en sigma por punto.

Las 20 filas quedan en `reviewed: false` y comparten un grupo conservador de
dependencia de la campaña Confined Combustion. Añaden **13 configuraciones**
(19 en total), todas con datos nuevos solo en microgravedad: permiten inspeccionar
evidencia, pero no cumplen los dos niveles de gravedad requeridos para predecir
otras gravedades. Las cuatro configuraciones ya aptas para estimación exploratoria
siguen siendo las de Kimwipes y PMMA fino.
