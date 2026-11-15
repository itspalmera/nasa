import re
from collections import defaultdict
from .models import SearchRequest, SearchResponse, Citation
from .provider import Provider
from .store import Store

# Lightweight bilingual query expansion is lexical assistance, never scientific evidence.
TRANSLATIONS = {'oxígeno':'oxygen', 'gravedad':'gravity', 'microgravedad':'microgravity', 'llama':'flame', 'llamas':'flame', 'extinción':'extinction', 'cables':'wire', 'cable':'wire', 'propagación':'spread', 'confinamiento':'confinement', 'incendio':'fire', 'seguridad':'safety', 'flujo':'flow', 'celulosa':'cellulose'}
STOP = set('the a an of in on is are what how does do for to and or with from about de la el los las un una en por qué que como cómo cuál cuáles se del y o con'.split())

def terms(query):
    words = re.findall(r'[^\W_]+', query.lower(), re.UNICODE)
    result = []
    for word in words:
        if word not in STOP and len(word) > 1:
            result.extend([word, TRANSLATIONS[word]] if word in TRANSLATIONS else [word])
    return list(dict.fromkeys(result))[:24]

def search(store: Store, request: SearchRequest) -> SearchResponse:
    filters = request.filters.model_dump(exclude_none=True)
    docs = {d['id']: d for d in store.documents() if all(d['metadata'].get(k) == v for k, v in filters.items())}
    if not docs:
        return SearchResponse(results=[], mode='keyword', warnings=['No indexed documents match the filters.'])
    tokens = terms(request.query)
    # Build FTS syntax only from parsed alphanumeric terms; raw user syntax never reaches MATCH.
    expression = ' OR '.join('"' + t + '"' for t in tokens)
    ranks, scores = [], defaultdict(float)
    with store.connect() as db:
        # Filter before LIMIT so unrelated documents cannot crowd out selected sources.
        placeholders = ','.join('?' for _ in docs)
        rows = db.execute(f'SELECT c.*, bm25(chunks_fts) rank FROM chunks_fts JOIN chunks c ON c.id=chunks_fts.id WHERE chunks_fts MATCH ? AND c.document_id IN ({placeholders}) ORDER BY rank, c.id LIMIT 100', (expression, *docs)).fetchall() if tokens else []
    keyword_ids = [r['id'] for r in rows if r['document_id'] in docs][:100]
    ranks.append(keyword_ids)
    warnings, mode = [], 'keyword'
    if request.semantic and store.config.enable_paid_api and store.config.openai_api_key:
        try:
            semantic_ids = Provider(store).semantic(request.query, 100, list(docs))
            if semantic_ids:
                ranks.append(semantic_ids)
                mode = 'hybrid'
            else:
                warnings.append('No vectors indexed for the configured embedding model; keyword retrieval used.')
        except Exception as exc:
            warnings.append(f'Semantic retrieval unavailable ({type(exc).__name__}); keyword retrieval used.')
    elif request.semantic:
        warnings.append('Semantic retrieval disabled; local keyword search with bilingual expansion is active.')
    for ranking in ranks:
        for rank, cid in enumerate(ranking, 1):
            scores[cid] += 1 / (60 + rank)
    results, seen = [], set()
    with store.connect() as db:
        for cid in sorted(scores, key=scores.get, reverse=True):
            r = db.execute('SELECT * FROM chunks WHERE id=?', (cid,)).fetchone()
            if not r or r['document_id'] not in docs:
                continue
            signature = re.sub(r'\s+', ' ', r['text']).strip()
            if signature in seen:
                continue
            seen.add(signature)
            d = docs[r['document_id']]
            results.append(Citation(id=cid, document_id=d['id'], title=d['metadata']['title'] or d['source_file'],
                source_file=d['source_file'], page=r['page'], text=r['text'],
                url=f'/api/documents/{d["id"]}/file#page={r["page"]}', relevance=round(scores[cid], 6)))
            if len(results) == request.limit:
                break
    return SearchResponse(results=results, mode=mode, warnings=warnings)
