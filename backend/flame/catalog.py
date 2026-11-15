"""Curated PSI investigation catalog as chat evidence.

The catalog (datasets/psi/investigations.json) describes the NASA PSI combustion investigations with a
common schema: conditions, findings and sources. Each finding, ground study and definition becomes a
Citation so the assistant can cite it exactly like a paper excerpt, with the same verbatim-quote validation.
"""
import json
import logging
import math
import time
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from .models import Citation

log = logging.getLogger(__name__)

STOP = set('''a al algo ante como con cual cuales cuando de del desde donde el ella en entre es esa ese esta este
esto hay la las le lo los mas me mi muy no o para pero por que se segun ser si sin sobre su sus tan te tiene un
una uno y ya the of in and to is are what which how do does for on with from about'''.split())
# Lexical help only (Spanish/English), never evidence.
SYNONYMS = {
    'acrilico': ['pmma'], 'acrylic': ['pmma'], 'tela': ['sibal', 'algodon', 'nomex'], 'fabric': ['sibal', 'nomex'],
    'humo': ['deteccion', 'particulas', 'aerosol', 'smoke'], 'smoke': ['humo', 'deteccion'],
    'detector': ['deteccion', 'ionizacion', 'alarma'], 'detectores': ['deteccion', 'ionizacion', 'alarma'],
    'alarma': ['detector', 'deteccion'], 'apagar': ['supresion', 'extincion'], 'extintor': ['supresion'],
    'luna': ['lunar', 'parcial'], 'lunar': ['luna', 'parcial'], 'moon': ['luna', 'lunar'], 'marte': ['parcial'],
    'mars': ['marte', 'parcial'], 'oxigeno': ['o2'], 'oxygen': ['o2', 'oxigeno'], 'ventilacion': ['flujo', 'ventilador'],
    'ventilation': ['flujo'], 'flow': ['flujo'], 'gota': ['gotas'], 'droplet': ['gota', 'gotas'],
    'inflamabilidad': ['inflamable', 'limites'], 'flammability': ['inflamabilidad'], 'fria': ['frias'],
    'frias': ['fria'], 'cool': ['fria', 'frias'], 'paredes': ['confinamiento', 'deflectores'],
    'confinement': ['confinamiento'], 'cable': ['cables'], 'wire': ['cables'], 'material': ['materiales'],
    'plastico': ['pmma', 'polietileno'], 'gravedad': ['gravity'], 'gravity': ['gravedad'],
}
MATERIALS = [
    ('SIBAL (algodón-fibra de vidrio)', r'sibal|algodon-fibra'), ('PMMA (acrílico)', r'pmma|acrilico'),
    ('Nomex', r'nomex'), ('Algodón', r'^algodon \(jersey\)|^algodon$'), ('Silicona', r'silicona'),
    ('Teflón', r'teflon'), ('Kapton', r'kapton'), ('Celulosa', r'celulosa|kimwipes|papel'),
    ('Polietileno (cables)', r'polietileno'),
]
MATERIAL_WORDS = {'material', 'materiales', 'materials', 'pmma', 'acrilico', 'nomex', 'sibal', 'tela', 'plastico',
                  'silicona', 'algodon', 'solido', 'solidos'}
PSI_STATUS = {'si': 'datos en PSI', 'no': 'no está en PSI', 'no_aun': 'experimento futuro, sin datos'}


def norm(text: str) -> str:
    text = unicodedata.normalize('NFD', text.lower())
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r'[a-z0-9\-]+', norm(text)) if t not in STOP and len(t) > 1]


def rng(r: dict, unit: str) -> str:
    lo, hi = r.get('min'), r.get('max')
    if lo is None and hi is None:
        return 'sin dato'
    f = lambda v: f'{v:g}'.replace('.', ',')
    txt = f'hasta {f(hi)}' if lo is None else f'desde {f(lo)}' if hi is None else f(lo) if lo == hi else f'{f(lo)}–{f(hi)}'
    return f'{txt} {unit} ({r["basis"]})'


@lru_cache(maxsize=4)
def _load(path: str, mtime: float):
    return json.loads(Path(path).read_text(encoding='utf-8'))


_SUPABASE_CACHE: dict = {}  # (url, table) -> {'at', 'value', 'failed_at'}
SUPABASE_TTL = 300  # seconds
# Where the last catalog came from: 'supabase' or 'local'. Shown by /api/catalog/source.
SOURCE = {'catalog': 'local', 'detail': 'datasets/psi/investigations.json'}


def _supabase_rows(url: str, key: str, table: str, params: dict):
    """Rows of one table from Supabase's REST API, cached for a few minutes. Raises when unavailable."""
    now = time.time()
    slot = _SUPABASE_CACHE.setdefault((url, table), {'at': 0.0, 'value': None, 'failed_at': 0.0})
    if slot['value'] is not None and now - slot['at'] < SUPABASE_TTL:
        return slot['value']
    if now - slot['failed_at'] < 60:
        raise ValueError('last attempt failed less than a minute ago')
    import httpx
    try:
        r = httpx.get(url.rstrip('/') + '/rest/v1/' + table, params=params,
                      headers={'apikey': key, 'Authorization': f'Bearer {key}'}, timeout=6)
        r.raise_for_status()
        rows = r.json()
        if not isinstance(rows, list):
            raise ValueError('unexpected response')
    except Exception:
        slot['failed_at'] = now
        raise
    slot.update(at=now, value=rows)
    return rows


def _supabase_investigations(url: str, key: str):
    """Investigation records (raw_json column)."""
    rows = _supabase_rows(url, key, 'investigations', {'select': 'raw_json', 'order': 'investigation_id'})
    return [row['raw_json'] for row in rows if isinstance(row.get('raw_json'), dict)]


def _supabase_on(cfg) -> bool:
    return cfg is not None and bool(getattr(cfg, 'supabase_url', '')) and bool(getattr(cfg, 'supabase_key', ''))


def load(catalog_dir: Path, cfg=None):
    out = {}
    for name in ('investigations', 'background'):
        p = catalog_dir / f'{name}.json'
        out[name] = _load(str(p), p.stat().st_mtime) if p.exists() else None
    cat = out['investigations']
    SOURCE.update(catalog='local', detail='datasets/psi/investigations.json')
    if cat and _supabase_on(cfg):
        try:
            rows = _supabase_investigations(cfg.supabase_url, cfg.supabase_key)
            sources = cat['sources']
            missing = {f['source'] for inv in rows for f in inv.get('findings', [])} - set(sources)
            if not rows:
                raise ValueError('the investigations table is empty')
            if missing:
                raise ValueError(f'findings cite sources missing from the catalog: {sorted(missing)[:5]}')
            cat = dict(cat, investigations=rows)
            SOURCE.update(catalog='supabase', detail=f'{len(rows)} investigations from {cfg.supabase_url}')
        except Exception as error:  # network, permissions or data: keep the local catalog so the chat never breaks
            log.warning('Supabase catalog unavailable, using local JSON: %s', error)
            SOURCE.update(catalog='local', detail=f'Supabase unavailable: {str(error)[:200]}')
    return cat, out['background']


def scenarios(catalog_dir: Path, cfg=None) -> tuple[list[dict], str]:
    """Habitat presets with one schema: Supabase table habitats_presets, else the local catalog's habitats."""
    if _supabase_on(cfg):
        try:
            rows = _supabase_rows(cfg.supabase_url, cfg.supabase_key, 'habitats_presets', {'select': '*', 'order': 'preset_id'})
            out = [{'id': r['preset_id'], 'name': r['name'], 'o2_pct': float(r['o2_pct']), 'pressure_kpa': float(r['pressure_kpa']),
                    'pressure_psi': float(r['pressure_psi']), 'flow_cms': float(r['flow_cms']), 'gravity_g': float(r['gravity_g']),
                    'note': r.get('note')} for r in rows]
            if out:
                return out, 'supabase'
            raise ValueError('the habitats_presets table is empty')
        except Exception as error:
            log.warning('Supabase habitats unavailable, using local JSON: %s', error)
    p = catalog_dir / 'investigations.json'
    cat = _load(str(p), p.stat().st_mtime) if p.exists() else {}
    out = []
    for h in cat.get('habitats', []):
        kpa = float(h['pressure'])
        out.append({'id': h['id'], 'name': h['name'], 'o2_pct': float(h['o2']), 'pressure_kpa': kpa,
                    'pressure_psi': float(h.get('pressure_psi') or round(kpa * 0.1450377, 1)),
                    'flow_cms': float(h['flow']) if h.get('flow') is not None else None,
                    'gravity_g': float(h['gravity']), 'note': h.get('note')})
    return out, 'local'


def tested_by(cat: dict, material: dict) -> list[dict]:
    """Investigations of the catalog whose fuels include the material (regex over normalized fuel names)."""
    return [i for i in cat['investigations'] if any(re.search(material['match'], norm(f)) for f in i.get('fuels', []))]


def materials(catalog_dir: Path, cfg=None) -> list[dict]:
    """Static list of materials to evaluate (datasets/psi/materials.json) plus what the catalog holds on each."""
    p = catalog_dir / 'materials.json'
    if not p.exists():
        return []
    cat, _ = load(catalog_dir, cfg)
    out = []
    for m in _load(str(p), p.stat().st_mtime)['materials']:
        invs = tested_by(cat, m) if cat else []
        done = [i for i in invs if i['in_psi'] != 'no_aun']
        out.append(dict(m, investigations=[i['acronym'] for i in done], planned=[i['acronym'] for i in invs if i['in_psi'] == 'no_aun'],
                        findings=sum(len(i.get('findings', [])) for i in done)))
    return out


def _paper_url(store, file: str | None, page: int | None) -> str | None:
    """Link a finding to the local PDF of the paper corpus when it is indexed."""
    if not file:
        return None
    name = Path(file).name
    for d in store.documents():
        if d['source_file'] == name:
            return f'/api/documents/{d["id"]}/file' + (f'#page={page}' if page else '')
    return None


def _ficha_text(inv: dict) -> str:
    psi = inv.get('psi') or {}
    return (f'Investigación {inv["acronym"]} ({inv["name"]}). Estado: {PSI_STATUS.get(inv["in_psi"], inv["in_psi"])}'
            + (f' ({psi["id"]})' if psi else '') + f'. Objetivo: {inv["objectives"]} '
            f'Combustible: {"; ".join(inv["fuels"]) or "sin dato"}. O2: {rng(inv["o2"], "%")}. '
            f'Presión: {rng(inv["pressure"], "kPa")}. Flujo de aire: {rng(inv["flow"], "cm/s")}. '
            f'Gravedad: {inv["gravity"]:g} g. Plataforma: {inv["platform"] or "sin dato"}.')


def materials_summary(cat: dict) -> str:
    lines = []
    for label, pat in MATERIALS:
        invs = [i for i in cat['investigations'] if i['in_psi'] != 'no_aun'
                and any(re.search(pat, norm(f)) for f in i['fuels'])]
        if not invs:
            continue
        o2 = [(i['o2']['max'], i['acronym'], i['platform']) for i in invs
              if i['o2']['max'] is not None and i['o2']['basis'] == 'medido']
        top = max(o2) if o2 else None
        lines.append(f'{label}: ensayado en {len(invs)} investigaciones ({", ".join(i["acronym"] for i in invs)}); '
                     f'O2 máximo medido: ' + (f'{top[0]:g} % ({top[1]}, {top[2]})' if top else 'sin dato') + '.')
    return ' '.join(lines)


def _units(store, cat: dict, bg: dict):
    """All citable catalog units: (citation, searchable text)."""
    sources = cat['sources']
    studies = {g['psi_id']: g for g in cat.get('ground_studies', [])}
    units = []
    for inv in cat['investigations']:
        psi = inv.get('psi') or {}
        head = f'{inv["acronym"]} · {PSI_STATUS.get(inv["in_psi"], inv["in_psi"])}' + (f' {psi["id"]}' if psi else '')
        ficha = _ficha_text(inv)
        search_base = f'{ficha} {inv["family"]} {inv.get("variables") or ""} {" ".join(inv.get("diagnostics", []))}'
        units.append((Citation(id=f'psi:{inv["acronym"]}', document_id=f'catalog:{inv["id"]}',
            title=f'{head} · ficha del catálogo', source_file='Catálogo PSI (datasets/psi/investigations.json)',
            page=0, text=ficha, url=psi.get('url') or '', relevance=0), search_base, inv['id']))
        for n, f in enumerate(inv['findings'], 1):
            src = sources[f['source']]
            url = _paper_url(store, src.get('file'), f.get('page')) or src.get('url') or psi.get('url') or ''
            ctx = '; '.join(x for x in (
                ('combustible: ' + ', '.join(inv['fuels'])) if inv.get('fuels') else '',
                ('plataforma: ' + inv['platform']) if inv.get('platform') else ''))
            text = f'{inv["acronym"]}' + (f' ({ctx})' if ctx else '') + f': {f["text"]}'
            units.append((Citation(id=f'psi:{inv["acronym"]}#{n}', document_id=f'catalog:{inv["id"]}',
                title=f'{head} · hallazgo {n}', source_file=src['title'], page=f.get('page') or 0,
                text=text, url=url, relevance=0), f'{text} {search_base}', inv['id']))
        for acc in psi.get('reused_by') or []:
            g = studies.get(acc)
            if g:
                text = f'{acc} reutilizó datos de {inv["acronym"]} en PSI: {g["title"]}. {g["summary"]}'
                units.append((Citation(id=f'psi:{acc}', document_id=f'catalog:{acc}', title=f'{acc} · estudio en tierra (PSI)',
                    source_file=g['title_original'], page=0, text=text, url=g['url'], relevance=0),
                    f'{text} {search_base}', inv['id']))
    for n, e in enumerate((bg or {}).get('entries', []), 1):
        src = bg['sources'][e['source']]
        units.append((Citation(id=f'fondo:{n}', document_id='catalog:fondo', title=f'Contexto general · {e["title"]}',
            source_file=src['title'], page=0, text=e['text'], url=src.get('url') or '', relevance=0),
            f'{e["title"]} {e["text"]} {" ".join(e["keywords"]) * 2}', None))
    return units


def search(store, query: str, limit: int = 8) -> list[Citation]:
    """Keyword ranking with IDF and Spanish/English synonyms over catalog units."""
    cat, bg = load(store.config.catalog_dir, store.config)
    if not cat:
        return []
    units = _units(store, cat, bg)
    docs = [tokens(t) for _, t, _ in units]
    df = {}
    for toks in docs:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    q = tokens(query)
    expanded = set(q)
    for t in q:
        expanded.update(SYNONYMS.get(t, []))
    scored = []
    for (cit, _, iid), toks in zip(units, docs):
        tf = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1
        s = sum((1 + math.log(tf[t])) * math.log(1 + len(docs) / df[t]) * (1.0 if t in q else 0.5)
                for t in expanded if t in tf)
        acr = norm(cit.id.split(':', 1)[1].split('#')[0])
        if acr and acr in norm(query):
            s += 6
        if cit.id.startswith('psi:') and '#' in cit.id:
            s *= 1.15  # prefer concrete findings over ficha summaries
        if s > 0:
            scored.append((s, cit))
    scored.sort(key=lambda x: -x[0])
    if not scored or scored[0][0] < 3:
        results = []
    else:
        floor = scored[0][0] * 0.35
        results = [c.model_copy(update={'relevance': round(s, 4)}) for s, c in scored if s >= floor][:limit]
        # Findings of the same investigation complement each other (e.g. the physical alert):
        # add the remaining findings of the two best-ranked investigations.
        top_docs = list(dict.fromkeys(c.document_id for c in results if '#' in c.id))[:2]
        have = {c.id for c in results}
        for s, c in scored:
            if c.document_id in top_docs and '#' in c.id and c.id not in have:
                results.append(c.model_copy(update={'relevance': round(s, 4)}))
                have.add(c.id)
    if set(tokens(query)) & MATERIAL_WORDS:
        results.insert(0, Citation(id='catalog:materiales', document_id='catalog:materiales',
            title='Resumen de materiales (calculado desde el catálogo)', source_file='Catálogo PSI',
            page=0, text=materials_summary(cat), url='', relevance=0))
    return results
