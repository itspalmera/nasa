# Obtención de PDF, conversión a JSON y cobertura de validación

El JSON existente contiene **91 observaciones**, distribuidas entre seis configuraciones. Eso no equivale a 91 observaciones intercambiables ni a varias campañas independientes por configuración. Por ejemplo, el grupo Kimwipes de 0.152 mm contiene 31 filas y un grupo de dependencia conservador que abarca el estudio. Los únicos niveles nominales son 0 y 1 g. Al excluir un nivel y todos sus grupos relacionados, no quedan filas aptas para entrenar.

Además, la regla de elegibilidad de este protocolo exige al menos tres filas de entrenamiento en dos niveles de gravedad restantes. Con solo dos niveles totales no se cumple. **Es una regla conservadora de esta implementación, no una ley estadística universal**. No debe quitarse para presentar una comprobación débil como validación científica, ni deben renombrarse grupos para fabricar independencia. Puede revisarse la agrupación si las fuentes documentan ejecuciones/campañas realmente independientes. Actualmente faltan esos identificadores detallados para justificar una partición más fina.

## Qué puede automatizarse

Desde la raíz del repositorio, en PowerShell:

```powershell
.\.venv\Scripts\python.exe scripts\papers_to_json.py
```

Esto convierte los PDF locales de `papers/` en `data/paper-source-extractions.json`, con huellas SHA-256, texto por página, metadatos y advertencias sobre páginas sin texto nativo. Se ejecutó sobre los 19 documentos (358 páginas), conservando además el texto posicionado de 28 páginas candidatas a tablas cuando se activó la opción correspondiente. Se señalaron 23 páginas sin texto nativo para posible OCR o inspección (algunas pueden estar en blanco). No escribe en `combustion-observations.json` ni aprueba observaciones.

Para conservar también el texto posicionado de páginas que mencionan tablas, de forma opcional:

```powershell
.\.venv\Scripts\python.exe scripts\papers_to_json.py --include-tables
```

La detección de candidatos es guiada por leyendas. Se conservan las palabras con sus coordenadas nativas, sin adivinar rejillas de celdas que puedan mezclar columnas. Esos candidatos siguen pendientes de segmentación y revisión; no se cubren exhaustivamente tablas sin leyenda o escaneadas. Los gráficos requieren adaptadores como el de PMMA, y los documentos escaneados requieren OCR o inspección manual.

Para añadir un PDF público desde un enlace directo HTTPS:

```powershell
.\.venv\Scripts\python.exe scripts\papers_to_json.py --url "https://servidor-publico.example/articulo.pdf"
```

La URL es un ejemplo de sintaxis, no una fuente científica descargada. Se puede repetir `--url`. La herramienta comprueba que la respuesta sea PDF, limita la descarga a 32 MiB, registra la URL/huella, deduplica archivos idénticos y conserva los fallos. No usa credenciales ni atraviesa pantallas de pago o autenticación. Las descargas y el JSON de texto completo permanecen en `data/`, ignorado por Git; no se publican automáticamente.

El acceso a las búsquedas públicas de NASA NTRS y a la consulta bibliográfica de Crossref desde el entorno de desarrollo devolvió **403 en el túnel del proxy**, antes de llegar al servicio. Por tanto no se recuperaron nuevos papers remotos ni se añadieron mediciones externas. Los intentos y una referencia candidata identificada en los PDF locales constan en `datasets/papers/acquisition-report.json`. La función de descarga puede ejecutarse en el equipo del usuario con un enlace PDF público accesible; los tests de descarga verifican el comportamiento con respuestas controladas, no acceso vivo a NASA.

## Qué hace falta para arreglar la validación

1. Obtener fuentes que aporten observaciones adicionales del mismo combustible, espesor/geometría, mecanismo y condiciones compatibles.
2. Identificar nuevos niveles de gravedad y ejecuciones/campañas independientes, con sus condiciones, unidades y mediciones reales.
3. Evitar duplicar el mismo experimento republicado en varios artículos. Un DOI nuevo no garantiza datos nuevos.
4. Convertir los registros experimentales en el contrato OOD mediante adaptadores con citas y comprobar incertidumbres, aproximaciones y valores ausentes.
5. Revisar los registros y ejecutar la exclusión de gravedad y grupos; reportar métricas solo si queda un conjunto válido.

Un paper con SIBAL, PMMA o simulaciones no completa automáticamente el conjunto Kimwipes. Tampoco una analogía E-FIELD equivale a una observación directa de gravedad parcial. Un conversor de PDF a JSON no crea la cobertura física que falta.

El gráfico interactivo de gravedad implementado junto a esta herramienta representa **predicciones**, no nuevas mediciones o validación. Muestra bandas del propio modelo sin fórmulas arbitrarias de ensanchamiento, y solo superpone observaciones que coinciden exactamente con los otros inputs. Los umbrales de oxígeno, veredictos de extinción y puntos de máxima inflamabilidad permanecen ausentes si no tienen soporte compatible.
