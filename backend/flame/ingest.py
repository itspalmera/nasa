"""Page-preserving extraction and local incremental indexing. No API calls by default."""
import hashlib
import json
import math
import re
from pathlib import Path
import pymupdf as fitz
from .models import Metadata, Evidence, IngestResponse
from .store import Store

SUPPORTED = {'.pdf', '.txt', '.md'}
PIPELINE_VERSION = 'page-blocks-v1'

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def normalize(text: str) -> str:
    return '\n'.join(re.sub(r'[^\S\n]+', ' ', line).strip() for line in text.replace('\x00', '').splitlines()).strip()

def token_estimate(text: str) -> int:
    # Deliberately conservative for this English scientific corpus; actual API usage is logged.
    return math.ceil(len(text.encode('utf-8')) / 3)

def extract(path: Path):
    warnings, pages, meta = [], [], {}
    try:
        if path.suffix.lower() == '.pdf':
            with fitz.open(path) as doc:
                if doc.needs_pass:
                    raise ValueError('Encrypted PDF requires a password')
                meta = doc.metadata or {}
                if 'Paper Capture' in meta.get('producer', ''):
                    warnings.append('Existing OCR text layer detected; accuracy is unverified and may contain transcription errors')
                for i, page in enumerate(doc, 1):
                    try:
                        # Blank lines between layout blocks preserve paragraph and table boundaries.
                        text = normalize('\n\n'.join(b[4] for b in page.get_text('blocks', sort=True) if b[6] == 0))
                    except Exception as exc:
                        text = ''
                        warnings.append(f'Page {i}: extraction failed ({type(exc).__name__})')
                    if len(text.strip()) < 30:
                        warnings.append(f'Page {i}: empty/low text; possible scan, OCR needed')
                    pages.append({'page': i, 'text': text})
        else:
            pages = [{'page': 1, 'text': normalize(path.read_text(encoding='utf-8'))}]
            if len(pages[0]['text']) < 30:
                warnings.append('Page 1: empty/low text')
    except Exception as exc:
        warnings.append(f'Document extraction failed ({type(exc).__name__}): {str(exc)[:160]}')
    return pages, meta, warnings

def chunks_for(document_id: str, pages: list[dict], target_chars=2700, overlap_chars=350):
    chunks = []
    for page in pages:
        text = page['text']
        if len(text.strip()) < 30:
            continue
        start = 0
        while start < len(text):
            end = min(start + target_chars, len(text))
            if end < len(text):
                # Favor full blocks, then lines. Exceptionally large tables/equations must split.
                boundary = text.rfind('\n\n', start + target_chars // 2, end)
                if boundary < 0:
                    boundary = text.rfind('\n', start + target_chars // 2, end)
                if boundary >= 0:
                    end = boundary
            part = text[start:end].strip()
            if part:
                cid = digest(f'{PIPELINE_VERSION}:{document_id}:{page["page"]}:{start}:{part}'.encode())
                chunks.append({'id': cid, 'document_id': document_id, 'page': page['page'], 'text': part, 'tokens': token_estimate(part)})
            if end >= len(text):
                break
            next_start = max(start + 1, end - overlap_chars)
            line = text.find('\n', next_start, end)
            start = line + 1 if line >= 0 else next_start
    return chunks

def initial_metadata(document_id, filename, pages, pdf_meta):
    m = Metadata(document_id=document_id, source_file=filename)
    # PDF properties are candidates, never silently promoted to verified bibliography.
    title = (pdf_meta.get('title') or '').strip()
    head_text = ' '.join(p['text'] for p in pages[:2])
    if len(title) > 12 and ' '.join(title.lower().split()) in ' '.join(head_text.lower().split()):
        m.title = title
    head = '\n'.join(p['text'] for p in pages[:2])
    doi = re.search(r'10\.\d{4,9}/[-._;()/:A-Z0-9]+', head, re.I)
    if doi:
        m.doi = doi.group().rstrip('.,;)').lower()
        p = next(p for p in pages[:2] if doi.group() in p['text'])
        m.field_evidence['doi'] = [Evidence(document_id=document_id, page=p['page'], quote=doi.group())]
    # Mention tags are explicitly labeled pending; they are NOT experimental conditions.
    for field, patterns in {
        'experiment': [('Saffire', r'\bSaffire\b'), ('BASS', r'\bBASS\b'), ('FLEX', r'\bFLEX\b'), ('ACME', r'\bACME\b'), ('SoFIE', r'\bSoFIE\b')],
        'research_category': [('Flame spread', r'flame spread'), ('Flammability', r'flammability'), ('Extinction', r'extinction')],
    }.items():
        for value, pattern in patterns:
            found = next(((p, re.search(pattern, p['text'], re.I)) for p in pages[:2] if re.search(pattern, p['text'], re.I)), None)
            if found:
                p, hit = found
                quote = p['text'][max(0, hit.start()-50):hit.end()+70]
                setattr(m, field, value)
                m.field_evidence[field] = [Evidence(document_id=document_id, page=p['page'], quote=quote)]
                break
    m.evidence_pages = sorted({e.page for es in m.field_evidence.values() for e in es})
    return m

def safe_file(root: Path, relative: str) -> Path:
    root = root.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError('Path must remain inside papers directory')
    return path

def curated_metadata(store: Store, m: Metadata, pages):
    path = Path(__file__).resolve().parents[2] / 'docs' / 'curated_metadata.json'
    if not path.exists():
        return m
    override = json.loads(path.read_text()).get(m.source_file)
    if not override:
        return m
    page_text = {p['page']: p['text'] for p in pages}
    data = m.model_dump()
    # Every curated field requires a quote in an existing page; null is preserved otherwise.
    for field, entry in override.get('fields', {}).items():
        if field not in Metadata.model_fields:
            continue
        evs = [Evidence(document_id=m.document_id, **e) for e in entry['evidence']]
        if all(e.quote in page_text.get(e.page, '') for e in evs):
            data[field] = entry['value']
            data['field_evidence'][field] = [e.model_dump() for e in evs]
    findings = []
    for raw in override.get('findings', []):
        raw = dict(raw)
        raw['evidence'] = [dict(e, document_id=m.document_id) for e in raw['evidence']]
        from .models import Finding
        finding = Finding.model_validate(raw)
        if all(e.quote in page_text.get(e.page, '') for e in finding.evidence):
            finding.verification_status = 'source_checked'
            findings.append(finding.model_dump())
    data['key_findings'] = findings
    data['evidence_pages'] = sorted({e['page'] for es in data['field_evidence'].values() for e in es} | {e['page'] for f in findings for e in f['evidence']})
    # Bibliography remains pending unless fully reviewed separately.
    return Metadata.model_validate(data)

def ingest(store: Store, dry_run=True, embeddings=False, force_embeddings=False):
    cfg = store.config
    cfg.papers_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in cfg.papers_dir.rglob('*') if p.is_file() and p.suffix.lower() in SUPPORTED)
    if len(files) > cfg.max_ingest_documents:
        raise ValueError(f'Corpus exceeds MAX_INGEST_DOCUMENTS={cfg.max_ingest_documents}; raise the limit explicitly')
    prepared, seen, warnings = [], {}, []
    response = IngestResponse(dry_run=dry_run, documents=len(files), chunks=0, embedding_tokens=0, estimated_embedding_usd=0)
    for path in files:
        filename = str(path.relative_to(cfg.papers_dir))
        try:
            safe_file(cfg.papers_dir, filename)
            if path.stat().st_size > cfg.max_file_mb * 1024**2:
                raise ValueError(f'File exceeds MAX_FILE_MB={cfg.max_file_mb}')
            hash_ = digest(path.read_bytes())
        except (OSError, ValueError) as exc:
            warnings.append(f'{filename}: {exc}')
            response.failed += 1
            if not dry_run:
                with store.connect() as db:
                    db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?,?)', (filename, None, None, 'failed', json.dumps([str(exc)])))
            continue
        doc_id = hash_[:24]
        if hash_ in seen:
            response.duplicates += 1
            if not dry_run:
                with store.connect() as db:
                    db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?,?)', (filename, hash_, seen[hash_], 'duplicate', '[]'))
            continue
        seen[hash_] = doc_id
        old = store.document(doc_id)
        # Re-extraction is local and cheap; embeddings use persistent per-content caches.
        pages, props, notes = extract(path)
        cs = chunks_for(doc_id, pages)
        base = Metadata.model_validate(old['metadata']) if old and old['metadata'].get('limitations') else initial_metadata(doc_id, filename, pages, props)
        base.source_file = filename
        m = curated_metadata(store, base, pages)
        status = 'failed' if not cs else ('warning' if notes else 'indexed')
        response.failed += int(not cs)
        response.chunks += len(cs)
        with store.connect() as db:
            pending = [c for c in cs if force_embeddings or not db.execute('SELECT 1 FROM chunks WHERE id=? AND embedded_model=?', (c['id'], cfg.openai_embedding_model)).fetchone()]
        response.embedding_tokens += sum(c['tokens'] for c in pending)
        warnings.extend(f'{filename}: {w}' for w in notes)
        prepared.append((doc_id, filename, hash_, status, pages, notes, cs, m, old))
    response.estimated_embedding_usd = round(response.embedding_tokens / 1e6 * cfg.embedding_usd_per_million, 6)
    response.warnings = warnings
    if dry_run:
        return response
    if embeddings:
        if not cfg.enable_paid_api or not cfg.openai_api_key:
            raise ValueError('Embeddings require ENABLE_PAID_API=true and OPENAI_API_KEY')
        if response.embedding_tokens > cfg.max_ingest_tokens:
            raise ValueError('Estimated tokens exceed MAX_INGEST_TOKENS; run dry-run and raise limit explicitly')
    for doc_id, filename, hash_, status, pages, notes, cs, m, old in prepared:
        with store.connect() as db:
            old_models = {r['id']: r['embedded_model'] for r in db.execute('SELECT id,embedded_model FROM chunks WHERE document_id=?', (doc_id,))}
            db.execute('DELETE FROM chunks_fts WHERE id IN (SELECT id FROM chunks WHERE document_id=?)', (doc_id,))
            db.execute('DELETE FROM chunks WHERE document_id=?', (doc_id,))
            db.execute('DELETE FROM pages WHERE document_id=?', (doc_id,))
            db.execute('INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?)', (doc_id, filename, hash_, status, len(pages), json.dumps(notes), m.model_dump_json()))
            db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?,?)', (filename, hash_, doc_id, status, json.dumps(notes)))
            db.executemany('INSERT INTO pages VALUES (?,?,?)', [(doc_id, p['page'], p['text']) for p in pages])
            db.executemany('INSERT INTO chunks VALUES (?,?,?,?,?,?)', [(c['id'], doc_id, c['page'], c['text'], c['tokens'], old_models.get(c['id'])) for c in cs])
            db.executemany('INSERT INTO chunks_fts VALUES (?,?)', [(c['id'], c['text']) for c in cs])
            db.execute('DELETE FROM answer_cache')
        if old:
            response.unchanged += 1
        else:
            response.indexed += 1
    # Remove stale file records and orphaned docs after successful corpus scan (never outside root).
    live_names = [str(p.relative_to(cfg.papers_dir)) for p in files]
    with store.connect() as db:
        for row in db.execute('SELECT source_file FROM files').fetchall():
            if row['source_file'] not in live_names:
                db.execute('DELETE FROM files WHERE source_file=?', (row['source_file'],))
        active_ids = set(seen.values())
        for row in db.execute('SELECT id FROM documents').fetchall():
            if row['id'] not in active_ids:
                db.execute('DELETE FROM chunks_fts WHERE id IN (SELECT id FROM chunks WHERE document_id=?)', (row['id'],))
                db.execute('DELETE FROM chunks WHERE document_id=?', (row['id'],))
                db.execute('DELETE FROM pages WHERE document_id=?', (row['id'],))
                db.execute('DELETE FROM documents WHERE id=?', (row['id'],))
    if embeddings:
        from .provider import Provider
        Provider(store).index(force=force_embeddings)
    return response
