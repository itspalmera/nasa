import csv
import io
import json
import logging
import os
import secrets
import threading
import math
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from .config import Settings, settings
from .store import Store
from .models import (
    DocumentResponse, IngestRequest, IngestResponse, SearchRequest, SearchResponse,
    ChatRequest, ChatResponse, ImportRequest
)
from .ingest import ingest, safe_file
from .retrieval import search
from .assistant import chat, extract_metadata
from .report import ReportRequest, ReportResponse, build as build_report
from .discovery import import_records, parse_import
from . import engines

from .ood.schema import Query, Dataset, EvidenceQuery, GravitySweepQuery
from .ood.service import status as ood_status, infer as ood_infer
from .ood.evidence import inspect_evidence
from .runs import observations_path, SOURCE as runs_source

log = logging.getLogger(__name__)


class Health(BaseModel):
    status: str
    paid_api_enabled: bool
    synthesis_ready: bool
    synthesis_model: str
    embedding_model: str
    consensus: str


class Statistics(BaseModel):
    total_papers: int
    indexed_chunks: int
    total_pages: int
    experiments_represented: int
    research_categories: int
    extraction_failures: int
    extraction_warning_pages: int
    verified_findings: int
    source_checked_findings: int
    experiment_distribution: list[dict[str, Any]]
    publication_timeline: list[dict[str, Any]]
    category_distribution: list[dict[str, Any]]
    usage: dict[str, Any]
    paid_api_enabled: bool
    embedding_model: str
    embedded_chunks: int


class CollectionResponse(BaseModel):
    items: list[dict[str, Any]]
    limitations: list[str] = []


class ActionResponse(BaseModel):
    result: dict[str, Any]


class HabitatScenarioRequest(BaseModel):
    o2: float = Field(default=30.0, description="% molar de O2 en cabina")
    pressure: float = Field(default=70.3, description="Presión en kPa (70.3 kPa = 10.2 psi)")
    flow: float = Field(default=10.0, description="Velocidad de flujo en cm/s")
    gravity: float = Field(default=0.167, description="Gravedad en g terrestres")
    pillars: list[str] = Field(default_factory=lambda: ["prevencion", "deteccion", "supresion"])
    selected_pillar: Optional[str] = None
    weights: Optional[dict[str, float]] = None


class LegacyMissionMatchRequest(HabitatScenarioRequest):
    pressure_psi: float = Field(gt=0, description="Presión absoluta de cabina en PSI")


def create_app(config: Settings | None = None):
    cfg = config or settings()
    store = Store(cfg)
    app = FastAPI(
        title='PyraScope SI - FLAME INTELLIGENCE API',
        version='1.0.0',
        description='Unified 4-Engine API: Mission-Matcher (M1), Partial-G GPR/Boosting (M2), Diff-Engine (M3), Grounded RAG Copilot (M4).'
    )
    app.state.store = store
    lock = threading.Lock()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware('http')
    async def local_guard(request: Request, call_next):
        if request.url.path.startswith('/api/'):
            if cfg.flame_api_token:
                received = request.headers.get('authorization', '').removeprefix('Bearer ')
                if not secrets.compare_digest(received, cfg.flame_api_token):
                    return JSONResponse(status_code=401, content={'error': {'code': 'unauthorized', 'message': 'API token required'}})
            if os.getenv("CORS_ALLOW_ALL", "false").lower() != "true":
                if request.method in ('POST', 'PUT', 'DELETE'):
                    origin = request.headers.get('origin')
                    host = request.headers.get('x-forwarded-host') or request.headers.get('host')
                    if origin and host and urlparse(origin).netloc != host:
                        origin_host = urlparse(origin).netloc
                        if not (origin_host.endswith(".vercel.app") or origin_host.startswith("localhost:") or origin_host.startswith("127.0.0.1:")):
                            return JSONResponse(status_code=403, content={'error': {'code': 'origin_rejected', 'message': 'Cross-origin mutations are disabled'}})
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return JSONResponse(status_code=400, content={'error': {'code': 'invalid_operation', 'message': str(exc)}})

    from fastapi.exceptions import RequestValidationError
    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(status_code=422, content={'error': {'code': 'validation_error', 'message': 'Request validation failed', 'details': [{'location': list(e['loc']), 'message': e['msg']} for e in exc.errors()]}})

    from starlette.exceptions import HTTPException as StarletteHTTPException
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return JSONResponse(status_code=exc.status_code, content={'error': {'code': f'http_{exc.status_code}', 'message': exc.detail}})

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        log.error('Request failed: %s', type(exc).__name__)
        return JSONResponse(status_code=502, content={'error': {'code': 'service_unavailable', 'message': 'Operation failed; check local logs and provider configuration.', 'type': type(exc).__name__}})

    def locked(action):
        if not lock.acquire(blocking=False):
            raise HTTPException(409, 'Another ingestion/metadata operation is running')
        try:
            return action()
        finally:
            lock.release()

    @app.get('/api/docs', include_in_schema=False)
    def proxy_docs():
        from fastapi.openapi.docs import get_swagger_ui_html
        return get_swagger_ui_html(openapi_url='/api/openapi.json', title='PyraScope SI API docs')

    @app.get('/api/openapi.json', include_in_schema=False)
    def proxy_schema():
        return app.openapi()

    @app.get('/health', response_model=Health)
    def health():
        synthesis_ready = getattr(cfg, 'synthesis_ready', bool(cfg.enable_paid_api and cfg.openai_api_key))
        synthesis_model = getattr(cfg, 'synthesis_model', cfg.openai_model)
        return {
            'status': 'ok',
            'paid_api_enabled': cfg.enable_paid_api,
            'synthesis_ready': synthesis_ready,
            'synthesis_model': synthesis_model,
            'embedding_model': cfg.openai_embedding_model,
            'consensus': 'manual_import_only'
        }

    @app.get('/api/catalog/source')
    def catalog_source():
        from . import catalog
        catalog.load(store.config.catalog_dir, store.config)
        return catalog.SOURCE

    @app.get('/api/habitats')
    def get_habitats():
        cat = engines.load_psi_catalog(store)
        return cat.get('habitats', [])

    @app.get('/api/investigations')
    def get_investigations():
        cat = engines.load_psi_catalog(store)
        return cat.get('investigations', [])

    @app.get('/api/pyrascope/bootstrap')
    def pyrascope_bootstrap():
        cat = engines.load_psi_catalog(store)
        invs = cat.get('investigations', [])
        habs = cat.get('habitats', [])
        default_target = {"o2": 30.0, "pressure": 70.3, "flow": 10.0, "gravity": 0.167}
        initial_ranking = engines.calculate_mission_match(default_target, invs)
        from .ood.service import status as ood_status
        return {
            "habitats": habs,
            "investigations": invs,
            "ground_studies": cat.get("ground_studies", []),
            "initial_ranking": initial_ranking,
            "ood_status": ood_status(obs_path())
        }

    @app.post('/api/motor1/match')
    @app.post('/api/rank')
    def motor1_rank(req: HabitatScenarioRequest):
        cat = engines.load_psi_catalog(store)
        target = {"o2": req.o2, "pressure": req.pressure, "flow": req.flow, "gravity": req.gravity}
        pillar = req.selected_pillar or (req.pillars[0] if len(req.pillars) == 1 else None)
        pillar = {
            "all": "todos", "prevention": "prevencion",
            "detection": "deteccion", "suppression": "supresion",
        }.get(pillar, pillar)
        ranking = engines.calculate_mission_match(target, cat.get("investigations", []), weights=req.weights, selected_pillar=pillar)
        return {"target_habitat": target, "ranking": ranking}

    @app.post('/api/motor1/match-missions')
    def legacy_mission_match(req: LegacyMissionMatchRequest):
        # Older scenario clients send PSI; the shared ranking engine uses kPa.
        return motor1_rank(req.model_copy(update={"pressure": req.pressure_psi * 6.89476}))

    # --- MOTOR 2: PARTIAL-G & LOI PREDICTOR (OOD ML DE MEYLIN) ---
    from .runs import observations_path, SOURCE as runs_source
    def obs_path():
        return observations_path(cfg)

    @app.get('/api/motor2/source')
    def motor2_source():
        obs_path()
        return runs_source

    @app.post('/api/ood/evidence')
    @app.post('/api/motor2/evidence')
    def gravity_evidence(query: EvidenceQuery):
        return inspect_evidence(obs_path(), query)

    @app.get('/api/ood/schema')
    def gravity_dataset_schema():
        return Dataset.model_json_schema()

    @app.get('/api/ood/dataset', response_class=FileResponse)
    def gravity_dataset():
        path = obs_path()
        if not path.is_file():
            raise HTTPException(404, 'Observation dataset not loaded')
        Dataset.model_validate_json(path.read_bytes())
        return FileResponse(path, media_type='application/json', filename='combustion-observations.json')

    @app.get('/api/ood/status')
    @app.get('/api/motor2/status')
    def gravity_status():
        return ood_status(obs_path())

    @app.post('/api/ood/gravity-sweep')
    @app.post('/api/motor2/gravity-sweep')
    def gravity_curve(query: GravitySweepQuery):
        if not ood_status(obs_path())['dependencies_ready']:
            raise HTTPException(503, 'Install the science optional dependencies')
        from .ood.sweep import gravity_sweep
        return gravity_sweep(obs_path(), query)

    # --- ENDPOINT DINÁMICO DEL MOTOR 2 PARA EL MAPA DE PELIGRO ---
    class DangerMapRequest(BaseModel):
        fuel: str = "PMMA"
        o2: float = 30.0
        pressure_psi: float = 10.2
        airflow_cm_s: float = 10.0
        gravity_g: float = 0.167
        investigation_acronym: Optional[str] = None

    @app.post('/api/motor2/danger-map')
    def danger_map_endpoint(req: DangerMapRequest):
        path = obs_path()
        observations = []
        if path.exists():
            try:
                from .ood.data import load_dataset
                rows, _ = load_dataset(path)
                observations = rows
            except Exception:
                observations = []

        burns = []
        extinct = []

        target_fuel = req.fuel.lower()
        acronym_filter = (req.investigation_acronym or "").lower().strip()

        # Desplazamiento dinámico basado en la física del experimento activo para variar el gráfico
        inv_shift = 0.0
        if "fm2" in acronym_filter or "luci" in acronym_filter:
            inv_shift = -0.5
        elif "saffire" in acronym_filter:
            inv_shift = 0.4
        elif "bass" in acronym_filter:
            inv_shift = -0.25
        elif "cfi" in acronym_filter:
            inv_shift = 0.15

        filtered_observations = []
        for r in observations:
            r_fuel = (r.fuel or "").lower()
            if target_fuel not in r_fuel and not (target_fuel == "pmma" and "acrilico" in r_fuel):
                continue

            citation_info = f"{r.experiment_id} {r.citation} {r.source}".lower()
            if acronym_filter:
                if acronym_filter in citation_info or any(w in citation_info for w in acronym_filter.split()):
                    filtered_observations.append(r)
            else:
                filtered_observations.append(r)

        if not filtered_observations:
            filtered_observations = [r for r in observations if target_fuel in (r.fuel or "").lower()]

        for r in filtered_observations:
            outputs = r.outputs or {}
            spread = outputs.get("spread_mm_s") or 0.0
            min_o2 = outputs.get("minimum_oxygen_pct") or r.oxygen_pct

            point = {
                "flow": r.airflow_cm_s,
                "o2": min_o2,
                "gravity": r.gravity_g,
                "experiment": r.experiment_id
            }

            if spread > 0 or r.gravity_g == 0:
                burns.append(point)
            else:
                extinct.append(point)

        # Curva U-Shape con deformación matemática asociada al experimento activo
        chart_curve = []
        for x in range(0, 41, 1):
            flow_offset = (0.035 * math.pow(10 - x, 1.35)) if x < 10 else (0.0022 * math.pow(x - 10, 1.6))
            base_loi_0g = 16.3 + inv_shift
            base_earth = 17.5
            
            grav_delta = (base_earth - base_loi_0g) * math.pow(req.gravity_g, 0.95)
            press_delta = 0.015 * (14.7 - req.pressure_psi)

            loi_target = base_loi_0g + flow_offset + grav_delta + press_delta
            loi_0g = base_loi_0g + flow_offset + press_delta

            chart_curve.append({
                "flow": x,
                "limit0g": round(max(10.0, loi_0g), 2),
                "limitTarget": round(max(10.0, loi_target), 2),
                "limitEarth": base_earth
            })

        return {
            "status": "success",
            "investigation_filter": req.investigation_acronym,
            "model_sweep": chart_curve,
            "scatter_burns": burns,
            "scatter_extinct": extinct
        }
    # -------------------------------------------------------------

    @app.post('/api/ood/predict')
    @app.post('/api/motor2/predict')
    def gravity_predict(query: Query):
        if not ood_status(obs_path())['dependencies_ready']:
            raise HTTPException(503, 'Install the science optional dependencies')
        return ood_infer(obs_path(), query)

    @app.post('/api/ood/validate')
    @app.post('/api/motor2/validate')
    def gravity_validate(query: Query):
        if not ood_status(obs_path())['dependencies_ready']:
            raise HTTPException(503, 'Install the science optional dependencies')
        return ood_infer(obs_path(), query, validation=True)

    @app.get('/api/motor3/intra/{investigation_id}')
    def motor3_intra(investigation_id: str):
        cat = engines.load_psi_catalog(store)
        key = investigation_id.strip().lower()
        inv = next((item for item in cat.get('investigations', [])
                    if key in (item['id'].lower(), item['acronym'].lower())), None)
        if inv is None:
            raise HTTPException(404, f'Investigation {investigation_id} not found')
        # Preserve the analysis contract used by the ranking UI. Chart measurements
        # are served separately with exact source links, never fallback mock runs.
        return engines.analyze_intra_investigation(inv)

    @app.get('/api/motor3/chart/{investigation_id}')
    def motor3_chart(investigation_id: str):
        from .investigation_charts import chart_data
        cat = engines.load_psi_catalog(store)
        key = investigation_id.strip().lower()
        inv = next((item for item in cat.get('investigations', [])
                    if key in (item['id'].lower(), item['acronym'].lower())), None)
        if inv is None:
            raise HTTPException(404, f'Investigation {investigation_id} not found')
        return chart_data(inv, cat.get('sources', {}), obs_path())

    @app.get('/api/motor3/inter/{id_a}/{id_b}')
    def motor3_inter(id_a: str, id_b: str):
        cat = engines.load_psi_catalog(store)
        ka, kb = id_a.strip().lower(), id_b.strip().lower()
        inv_a = next((i for i in cat.get("investigations", []) if i["id"].lower() == ka or i["acronym"].lower() == ka), None)
        inv_b = next((i for i in cat.get("investigations", []) if i["id"].lower() == kb or i["acronym"].lower() == kb), None)
        if not inv_a or not inv_b:
            raise HTTPException(404, 'One or both investigations not found')
        return engines.compare_inter_investigations(inv_a, inv_b)

    @app.post('/api/chat', response_model=ChatResponse)
    @app.post('/api/motor4/chat', response_model=ChatResponse)
    def run_chat(request: ChatRequest):
        return chat(store, request)

    @app.get('/api/scenarios')
    def list_scenarios():
        from . import catalog
        items, origin = catalog.scenarios(store.config.catalog_dir, store.config)
        return {'source': origin, 'scenarios': items}

    @app.get('/api/materials')
    def list_materials():
        from . import catalog
        return {'materials': [{k: v for k, v in m.items() if k != 'match'} for m in catalog.materials(store.config.catalog_dir, store.config)]}

    @app.post('/api/report', response_model=ReportResponse)
    @app.post('/api/motor4/report', response_model=ReportResponse)
    def decision_report(request: ReportRequest):
        try:
            return build_report(store, request)
        except KeyError as error:
            raise HTTPException(404, str(error).strip("'\""))

    @app.get('/api/export.csv')
    def export_csv():
        obs_file = obs_path()
        if not obs_file.exists():
            return Response("experiment_id,fuel,gravity_g,oxygen_pct,pressure_kpa,airflow_cm_s\n", media_type="text/csv")
        obs = json.loads(obs_file.read_text(encoding='utf-8')).get('observations', [])
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["experiment_id", "fuel", "configuration", "gravity_g", "oxygen_pct", "pressure_kpa", "airflow_cm_s", "spread_mm_s", "minimum_oxygen_pct", "length_mm", "provenance", "reviewed", "source"])
        for r in obs:
            outs = r.get("outputs") or {}
            writer.writerow([
                r.get("experiment_id"), r.get("fuel"), r.get("configuration"),
                r.get("gravity_g"), r.get("oxygen_pct"), r.get("pressure_kpa"), r.get("airflow_cm_s"),
                outs.get("spread_mm_s"), outs.get("minimum_oxygen_pct"), outs.get("length_mm"),
                r.get("provenance"), r.get("reviewed"), r.get("source")
            ])
        return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=pyrascope_predictive_observations.csv"})

    @app.get('/api/documents', response_model=list[DocumentResponse])
    def documents():
        return store.documents()

    @app.get('/api/documents/{document_id}', response_model=DocumentResponse)
    def document(document_id: str):
        d = store.document(document_id)
        if not d:
            raise HTTPException(404, 'Document not found')
        return d

    @app.get('/api/documents/{document_id}/file', response_class=FileResponse)
    def original(document_id: str):
        d = store.document(document_id)
        if not d:
            raise HTTPException(404, 'Document not found')
        p = safe_file(cfg.papers_dir, d['source_file'])
        if not p.is_file():
            raise HTTPException(404, 'Original file is missing; reindex the corpus')
        return FileResponse(p, media_type='application/pdf' if p.suffix.lower() == '.pdf' else 'text/plain', filename=p.name, content_disposition_type='inline')

    @app.post('/api/ingest', response_model=IngestResponse)
    def run_ingestion(request: IngestRequest):
        return locked(lambda: ingest(store, **request.model_dump()))

    @app.post('/api/search', response_model=SearchResponse)
    def run_search(request: SearchRequest):
        return search(store, request)

    @app.post('/api/documents/{document_id}/metadata', response_model=ActionResponse)
    def metadata(document_id: str):
        if not store.document(document_id):
            raise HTTPException(404, 'Document not found')
        return {'result': locked(lambda: extract_metadata(store, document_id))}

    @app.get('/api/statistics', response_model=Statistics)
    def statistics():
        docs = store.documents()
        experiments, categories, timeline = {}, {}, {}
        for d in docs:
            m = d['metadata']
            for bucket, key in ((experiments, 'experiment'), (categories, 'research_category'), (timeline, 'publication_year')):
                if m.get(key) is not None:
                    label = str(m[key])
                    bucket[label] = bucket.get(label, 0) + 1
        findings = [f for d in docs for f in d['metadata']['key_findings']]
        with store.connect() as db:
            failures = db.execute("SELECT COUNT(*) FROM files WHERE status='failed'").fetchone()[0]
            embedded = db.execute('SELECT COUNT(*) FROM chunks WHERE embedded_model=?', (cfg.openai_embedding_model,)).fetchone()[0]
        return {
            'total_papers': len(docs), 'indexed_chunks': sum(d['chunks'] for d in docs), 'total_pages': sum(d['page_count'] for d in docs),
            'experiments_represented': len(experiments), 'research_categories': len(categories), 'extraction_failures': failures,
            'extraction_warning_pages': sum(sum('Page ' in w for w in d['warnings']) for d in docs),
            'verified_findings': sum(f['verification_status'] == 'reviewed' for f in findings),
            'source_checked_findings': sum(f['verification_status'] == 'source_checked' for f in findings),
            'experiment_distribution': [{'name': k, 'papers': v} for k, v in sorted(experiments.items())],
            'category_distribution': [{'name': k, 'papers': v} for k, v in sorted(categories.items())],
            'publication_timeline': [{'year': k, 'papers': v} for k, v in sorted(timeline.items())],
            'usage': store.usage(), 'paid_api_enabled': cfg.enable_paid_api, 'embedding_model': cfg.openai_embedding_model, 'embedded_chunks': embedded
        }

    @app.get('/api/experiments', response_model=CollectionResponse)
    def experiments():
        grouped = {}
        for d in store.documents():
            name = d['metadata']['experiment']
            if name:
                grouped.setdefault(name, []).append({'document_id': d['id'], 'title': d['metadata']['title'] or d['source_file'], 'metadata': d['metadata']})
        return {
            'items': [{'name': k, 'papers': v} for k, v in sorted(grouped.items())],
            'limitations': ['Experiment labels are source mentions until reviewed.', 'Conditions are document-level summaries, not matched experimental runs.']
        }

    @app.get('/api/findings', response_model=CollectionResponse)
    def findings():
        return {
            'items': [dict(f, document_id=d['id'], source_file=d['source_file']) for d in store.documents() for f in d['metadata']['key_findings']],
            'limitations': ['source_checked means verbatim quote and page were validated, not independent scientific validation.']
        }

    @app.post('/api/discovery/import', response_model=ActionResponse)
    def discovery(request: ImportRequest):
        return {'result': import_records(store, [r.model_dump() for r in request.records])}

    @app.get('/api/discovery', response_model=CollectionResponse)
    def discoveries():
        with store.connect() as db:
            items = [json.loads(r['record']) for r in db.execute('SELECT record FROM discovery')]
        return {'items': items, 'limitations': ['Discovery metadata is not indexed full-text evidence.']}

    async def limited_read(file, max_bytes):
        parts, total = [], 0
        while part := await file.read(1024 * 1024):
            total += len(part)
            if total > max_bytes:
                raise HTTPException(413, 'File exceeds configured upload limit')
            parts.append(part)
        return b''.join(parts)

    @app.post('/api/discovery/upload', response_model=ActionResponse)
    async def discovery_upload(file: UploadFile = File(...)):
        content = await limited_read(file, 2 * 1024**2)
        records = parse_import(file.filename or '', content)
        return {'result': import_records(store, records)}

    @app.post('/api/documents/upload', response_model=ActionResponse)
    async def upload(file: UploadFile = File(...)):
        filename = file.filename or ''
        if Path(filename).name != filename or '\\' in filename or not filename.lower().endswith('.pdf'):
            raise HTTPException(400, 'Use a plain PDF filename without directories')
        content = await limited_read(file, cfg.max_file_mb * 1024**2)
        if not content.startswith(b'%PDF-'):
            raise HTTPException(400, 'Uploaded file is not a PDF')
        path = safe_file(cfg.papers_dir, filename)
        cfg.papers_dir.mkdir(parents=True, exist_ok=True)
        try:
            with path.open('xb') as out:
                out.write(content)
        except FileExistsError:
            raise HTTPException(409, 'File already exists; use a different name')
        return {'result': {'source_file': filename, 'status': 'uploaded_not_indexed'}}

    return app


app = create_app()