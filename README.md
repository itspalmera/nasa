# FLAME INTELLIGENCE

A local scientific research dashboard for the supplied **Flame in Freefall** brief. FastAPI processes the actual PDF corpus; Next.js presents the library, evidence excerpts, source citations, experiment summaries, and bibliometric charts.

This is a research MVP, not a validated spacecraft fire-safety decision system or an official NASA product. No experimental measurements are synthesized. The official challenge page could not be verified because the environment's HTTPS proxy blocked its domain.

## What is implemented

- Page-by-page PyMuPDF extraction; stable SHA-256 document/chunk identities; extraction warnings; exact-byte duplicate detection; incremental local indexing.
- SQLite metadata, original page text, FTS5 keyword search, usage and caches; ChromaDB persistence for OpenAI embeddings.
- Optional `text-embedding-3-small` embeddings and GPT-4o grounded answers. Paid operations require **both** a key and `ENABLE_PAID_API=true`.
- Hybrid retrieval through reciprocal rank fusion, metadata filters, chunk deduplication, page citations, bilingual query expansion, and explicit insufficient-evidence responses.
- Structured scientific metadata extraction through GPT-4o, Pydantic validation, exact quote/page checks, and a small source-checked curated metadata file.
- Responsive dark dashboard: overview, assistant, research explorer, document/page inspector, experiment comparison, evidence methods, PDF upload, dry-run and local indexing, Consensus CSV/JSON import.
- Scientific confidence remains separate from retrieval relevance and citation traceability. No finding is marked scientifically reviewed by default.
- Local path confinement, bounded uploads/ingestion, same-origin mutation checks, optional API token, bounded provider timeouts/retries, embedding batches, persistent caches, usage and estimated cost accounting.

## Corpus inspected

The initial repository contained only **19 PDF files**, preserved unchanged in `papers/`.

| Actual corpus result | Count |
|---|---:|
| Unique PDFs inventoried | 19 |
| PDFs with indexable text | 17 |
| PDFs without extractable text | 2 |
| Original PDF pages | 358 |
| Indexed evidence chunks | 467 |
| Pages with low/empty-text warnings | 42 |
| Source-checked finding summaries | 4 |
| Independently reviewed findings | 0 |
| API requests made for this implementation | 0 |

One 1987 report contains an existing OCR layer with visible transcription problems. Image-only pages and slide/media pages need OCR or manual review. See [the complete inventory](docs/corpus_inventory.md).

## Requirements

Python 3.11+ (tested with 3.12), Node.js 20.9+ (tested with 24), npm, and a modern browser. PDF ingestion works without external credentials or internet after dependencies are installed. Python uses SQLite with FTS5.

## Install and index

From this repository's root:

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[test]'
cp .env.example .env
npm --prefix frontend ci
.venv/bin/python -m flame.cli ingest --dry-run
.venv/bin/python -m flame.cli ingest
.venv/bin/python -m flame.cli inventory
```

On Windows use `.venv\Scripts\python.exe` and `.venv\Scripts\pip.exe` and the platform's copy command. The default setup intentionally performs **no paid API calls**. Re-running ingestion will not generate embeddings unless requested. `requirements.lock.txt` captures the validated Linux/Python 3.12 dependency versions; optionally install it before the editable package for matching dependencies.

## Run the application

Terminal 1, from the repository root:

```bash
.venv/bin/uvicorn flame.main:app --host 127.0.0.1 --port 8000
```

On Windows PowerShell, from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn flame.main:app --app-dir backend --reload --reload-dir backend --port 8000
```

Keep the `backend/flame` package complete: its storage, ingestion, retrieval and
`ood` modules are required by `flame.main`, even when other backend entry points
are used alongside it.

Terminal 2, from the repository root:

```bash
npm --prefix frontend run dev -- --port 3000
```

Open **http://localhost:3000**. API documentation: **http://127.0.0.1:8000/docs** (also proxied at `/api/docs` through Next.js). The frontend proxies `/api/*` to `http://127.0.0.1:8000`; set server-side `BACKEND_URL` if the backend is elsewhere.

Production build, without deployment:

```bash
npm --prefix frontend run build
npm --prefix frontend run start -- --port 3000
```

Run one backend worker: the ingestion lock is per process. This application is intended for a trusted local workstation. Neither a public deployment nor a multiuser service is configured.

## Enable OpenAI deliberately

Edit `.env` locally; never put credentials in chat, browser code, or Git:

```dotenv
OPENAI_API_KEY=your-local-secret
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ENABLE_PAID_API=true
```

Restart the backend after environment changes, then estimate and index:

```bash
.venv/bin/python -m flame.cli ingest --dry-run --embeddings
.venv/bin/python -m flame.cli ingest --embeddings
```

The API domain must be allowed by your runtime's network policy. No OpenAI secret or domain allowance was available in the implementation session. Live generation and live embedding quality therefore remain **unverified**. The offline assistant returns related source excerpts with `mode=evidence_only`; it does not pretend to generate a scientific answer.

`--force-embeddings --embeddings` explicitly regenerates unchanged embeddings. A persistent model/content cache otherwise avoids repeated embedding charges. Different embedding models use different Chroma collections. Do not delete `data/` if you want to retain caches. Back up SQLite and Chroma together while the app is stopped.

Optional structured metadata extraction for one document:

```bash
curl -X POST http://127.0.0.1:8000/api/documents/DOCUMENT_ID/metadata
```

This is a paid operation when enabled. It uses the first three and last two PDF pages (up to 8,500 characters per selected page), validates exact supporting quotes, and leaves human review pending. It is not automatically run across the whole corpus.

## API examples

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/documents
curl http://127.0.0.1:8000/api/statistics
curl -X POST http://127.0.0.1:8000/api/ingest \
  -H 'Content-Type: application/json' -d '{"dry_run":true}'
curl -X POST http://127.0.0.1:8000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"flame extinction","limit":5,"filters":{},"semantic":false}'
curl -X POST http://127.0.0.1:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"query":"¿Qué se ha observado en SoFIE cerca de la extinción?","language":"es"}'
curl -F 'file=@new-paper.pdf' http://127.0.0.1:8000/api/documents/upload
```

Other endpoints: `GET /api/documents/{id}`, `GET /api/documents/{id}/file`, `GET /api/experiments`, `GET /api/findings`, `GET /api/discovery`, `POST /api/discovery/import`, `POST /api/discovery/upload`. All request/response schemas are in OpenAPI. Errors use an `error` object with a stable code and message. Uploaded PDFs are saved without overwriting existing files; run ingestion separately.

Set `FLAME_API_TOKEN` on a shared workstation, restart the backend, and supply `Authorization: Bearer <token>`. The dashboard accepts the token in its connection screen and keeps it in memory only. Protected source files are opened as authenticated blobs. Direct API/PDF URLs require authentication when the token is enabled. Swagger has no integrated sign-in flow. Keep the backend on loopback and use the Next.js same-origin proxy.

## Consensus without API entitlement

A direct Consensus API connection is not configured. `CONSENSUS_API_KEY` is reserved and is currently unused; setting it does not enable an integration. There is no authenticated scraping or speculative API integration. Manual discovery import works completely independently of normal RAG.

CSV headers:

```csv
title,doi,authors,year,url,abstract
A discovered paper,10.0000/example,Author One;Author Two,2024,https://example.org/paper,Available abstract
```

The row above is a **format example**, not an indexed scientific publication. JSON accepts an array of records or `{"records": [...]}` with `authors` as an array. DOI normalization deduplicates discovery records against the corpus and earlier imports; titles identify records without DOI. Discovery records never become scientific findings or full-text evidence. Attach legally accessible PDFs separately; file hashes deduplicate identical PDF content.

## Validation and evaluation

```bash
.venv/bin/pytest -q
.venv/bin/python -m flame.evaluate
npm --prefix frontend run typecheck
npm --prefix frontend run build
.venv/bin/pip check
```

The tests cover real PDF extraction, page/chunk stability, empty/broken documents, duplicate/incremental indexing, metadata validation, keyword/filtered retrieval, Spanish expansion, citations, API errors and safety boundaries, manual imports, persistent embedding cache, actual local Chroma retrieval with mocked embeddings, and strict provider schemas. Provider-backed tests are skipped by default. Only opt in with `RUN_LIVE_OPENAI_TESTS=1` after configuring paid access and accepting the small test costs.

See [evaluation results and limitations](docs/evaluation.md). Browser UI testing was attempted but the managed preview relay timed out and the shared browser returned `Browser runtime unavailable`; visual layout and interactive browser behavior are **not verified**.

## Cost accounting

No API calls were made; incurred API cost is **$0**. The current dry run estimates 260,207 embedding tokens, approximately **$0.005204** at the configurable assumption of $0.02 per million tokens. This is an estimate, not an invoice or a verified current price. Chunks use an approximate UTF-8-byte/3 token estimator; request usage is logged from actual provider responses when enabled. The GPT-4o budget assumptions are $2.50/million input and $10/million output tokens, configurable in `.env`; a 10,000-input/1,000-output-token query would estimate $0.035. Verify current prices before enabling paid calls.

## Repository structure

```text
backend/flame/
  config.py          environment and local paths
  models.py          validated API/scientific schemas
  ingest.py          extraction, chunking, incremental corpus updates
  store.py           SQLite metadata, page text, FTS, caches, usage
  provider.py        opt-in OpenAI + ChromaDB adapter
  retrieval.py       keyword/semantic fusion and provenance
  assistant.py       bilingual generation and citation validation
  discovery.py       manual Consensus CSV/JSON import
  main.py            FastAPI routes and local security boundaries
  cli.py             ingestion/inventory commands
  inventory.py       reproducible inventory report
  evaluate.py        offline corpus-grounded evaluation
frontend/
  app/               responsive Next.js/TypeScript dashboard
  dev.mjs            Next.js preview flag compatibility
  package-lock.json  frontend dependency lock
papers/              19 unchanged original PDFs
tests/               offline, mocked-provider, and opt-in live tests
evaluation/          human-authored corpus-grounded questions
scripts/             reproducible local HTTP smoke test
docs/                architecture, methodology, inventory, evaluation, limits
  curated_metadata.json     quote-checked metadata candidates
  ingestion_estimate.json   actual dry-run report
  evaluation_results.json   actual offline metrics
  validation_results.json   recorded checks and blockers
data/                ignored local databases and embedding caches
.env.example         safe, paid-disabled default configuration
pyproject.toml       Python package and tests
requirements.lock.txt
README.md
```

Recommended next work: review/OCR the unreadable PDFs; scientifically review metadata and findings; configure and validate live OpenAI access; broaden bilingual and out-of-domain evaluation; improve equation/table segmentation; add reviewed numerical datasets and charts only after source validation. See [known limitations](docs/limitations.md).

## Conectar GPT-4o mini y Consensus

1. Copia `.env.example` a `.env` en la raíz del repositorio (`cp .env.example .env`).
2. Crea una API key en https://platform.openai.com/api-keys y configura facturación en esa plataforma. La suscripción de ChatGPT no incluye saldo de API. Guarda la clave solo en `OPENAI_API_KEY`, conserva `OPENAI_MODEL=gpt-4o-mini` y establece `ENABLE_PAID_API=true`.
3. Ejecuta `.venv/bin/python -m flame.cli connections` para revisar la configuración sin enviar claves ni realizar llamadas externas. Reinicia el backend. `curl http://127.0.0.1:8000/health` indica si existe configuración local; no valida la clave contra OpenAI.
4. Ejecuta `.venv/bin/python -m flame.cli ingest --dry-run --embeddings` para estimar y `.venv/bin/python -m flame.cli ingest --embeddings` para crear el índice semántico. Las llamadas generan cargos.
5. Prueba `/api/chat` con una pregunta sobre los documentos. `mode=hybrid` confirma recuperación híbrida; revisa `limitations` si falla la búsqueda semántica. Si no hay evidencia, el asistente se abstiene.

Busca publicaciones en https://consensus.app/ y prepara sus metadatos con el formato CSV/JSON descrito arriba. Usa el botón **Import Consensus CSV / JSON** o:

```bash
curl -F 'file=@consensus.json' http://127.0.0.1:8000/api/discovery/upload
curl http://127.0.0.1:8000/api/discovery
```

La importación no necesita credenciales de Consensus. Añade los PDF permitidos a `papers/` y repite la indexación para incorporarlos al RAG. Una conexión automática requiere acceso autorizado y documentación de la API de Consensus (URL, autenticación y esquema); una clave por sí sola no basta. No compartas claves por chat.

`RAG_MAX_CONTEXT_TOKENS` limita los pasajes enviados al modelo usando una estimación conservadora de tokens. El índice puede reconstruir vectores ausentes desde su caché sin volver a pagar por embeddings ya almacenados. Los precios del `.env.example` son estimaciones configurables para GPT-4o mini, no una cotización en tiempo real.

### Scientific gravity generalization (OOD)

Overview includes a data-gated gravity module with independent Matérn GPR and histogram gradient boosting, grouped leave-one-gravity-out evaluation, per-source errors, and explicit uncertainty limitations. A [source-linked PDF transcription](datasets/papers/README.md) is bundled with 111 compatible-schema rows pending scientific review; reviewed-mode predictions require reviewed compatible observations. An explicit exploratory opt-in can estimate properties from pending direct transcriptions, with unvalidated labels and scientific validation disabled. Import with `python scripts/import_paper_observations.py` after checking its source notes. Physics-guided regression is disabled pending a documented applicable physical baseline. See [dataset schema, API, methods and limitations](docs/ood-generalization.md). Install optional dependencies with `pip install -e '.[science,test]'`.

The gravity module also includes an interactive response chart with source-matched measurement markers, model intervals and Orbit/Moon/Mars/Earth controls. See [PDF acquisition, conversion and validation requirements](docs/pdf-acquisition-and-validation.md) for the local/public-PDF JSON exporter and why converting more text does not automatically supply independent training data.

## Catálogo de PSI en el asistente (rama `lesic`)

El asistente (`/api/chat`) busca en dos fuentes a la vez:

- **Los papers** de `papers/`, como antes, con cita a la página del PDF.
- **El catálogo de investigaciones de PSI** en `datasets/psi/investigations.json`: 31 investigaciones,
  61 hallazgos con su fuente y página, 5 estudios en tierra que reutilizaron datos de PSI y 12 definiciones
  del enunciado (`background.json`). Ver `datasets/psi/CATALOGO.md`.

Cada hallazgo del catálogo es una evidencia más (`psi:BASS-II#3`, `psi:PSI-117`, `fondo:1`) y pasa por la misma
validación de citas textuales que los papers. La respuesta agrega `physical_alert`: un comportamiento del fuego en
microgravedad que contradice la intuición terrestre, validado igual que las demás afirmaciones, o `null`.

### Usar Anthropic en vez de OpenAI

En `.env`:

```dotenv
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=tu-clave
ENABLE_PAID_API=true
```

Solo cambia la redacción de respuestas. La búsqueda semántica sigue necesitando `OPENAI_API_KEY`; sin ella el
asistente usa la búsqueda por palabras clave, que funciona sin pagar. Pruebas: `pytest tests/test_catalog_chat.py`.

## Predictor conectado en la rama `mey`

Abre **Predecir y preguntar** en la navegación principal. El laboratorio recibe
la gravedad, el oxígeno, la ventilación y la presión del escenario (convierte psi
a kPa). Selecciona explícitamente el material y la configuración experimental:
un material del escenario no identifica por sí solo una geometría de ensayo.

El módulo usa `/api/ood/status`, `/api/ood/predict`, `/api/ood/gravity-sweep` y
`/api/ood/evidence` mediante el proxy de Next.js. No genera curvas en el cliente.
Los controles de Luna, Marte, órbita y Tierra consultan la curva del modelo;
los marcadores muestran únicamente mediciones con condiciones coincidentes.
La pestaña **Extract clean data** descarga el mismo conjunto de observaciones que
usa el backend, incluido el paquete versionado cuando no hay un archivo local.
**Ask Copilot** consulta `/api/chat` y muestra sus citas y limitaciones. El token
API opcional se conserva en memoria y se aplica a las consultas y descargas.

El paquete contiene 111 observaciones pendientes de revisión. Para explorar sus
estimaciones, activa **Use extracted observations for exploratory estimates**.
Las propiedades sin datos compatibles permanecen deshabilitadas. Los intervalos
son intervalos del modelo sin calibración independiente; estimar una gravedad
no probada no demuestra validación ni permite emitir un veredicto de seguridad.
Los datos incluidos no permiten validar Luna o Marte mediante grupos independientes.

Arranque local: backend en el puerto 8000 y `npm --prefix frontend run dev -- --port 3000`.
`BACKEND_URL` configura un backend alternativo. Las fuentes tipográficas están
incluidas en las dependencias para compilar sin descargar desde Google Fonts.

Las configuraciones **observations only**, incluidas las de SIBAL, muestran sus
valores medidos directamente bajo los controles: magnitud, unidades, gravedad,
atmósfera, ventilación, revisión y fuente. Estos valores conservan las condiciones
del ensayo al mover los controles del escenario. El botón de estimación permanece
deshabilitado cuando faltan filas o niveles de gravedad compatibles; la tabla y
la exportación de evidencia siguen disponibles.
