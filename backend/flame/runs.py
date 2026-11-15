"""Motor 2 observations from Supabase (table experimental_runs), restricted to source-linked rows.

Only rows that also exist in the repository's source-linked bundle (datasets/papers/combustion-observations.json,
each with its paper, page and table row) are used. Rows without that link are excluded, and the review flag is
taken from the bundle (False until a scientist reviews them), not from the table. Columns the table lacks
(leakage_group, uncertainty, temperature_k) also come from the bundle.

The result is written to data/combustion-observations.supabase.json so the Motor 2 code keeps reading a file.
If Supabase is not configured or fails, Motor 2 uses data/combustion-observations.json, or the bundle itself.
"""
import json
import logging
import time
from pathlib import Path
from . import catalog
from .config import ROOT
from .ood.schema import Dataset

log = logging.getLogger(__name__)
BUNDLE = ROOT / 'datasets' / 'papers' / 'combustion-observations.json'
OUTPUT_COLUMNS = ('spread_mm_s', 'minimum_oxygen_pct', 'length_mm')
# Where the last Motor 2 dataset came from. Shown by /api/motor2/source.
SOURCE = {'observations': 'local', 'detail': ''}
_LAST = {'at': 0.0}


def _bundle() -> dict:
    if not BUNDLE.exists():
        return {}
    return {r['experiment_id']: r for r in json.loads(BUNDLE.read_text(encoding='utf-8'))['observations']}


def from_supabase(cfg) -> tuple[list[dict], list[str]]:
    """Observations built from experimental_runs; returns (observations, excluded experiment ids)."""
    rows = catalog._supabase_rows(cfg.supabase_url, cfg.supabase_key, 'experimental_runs', {'select': '*', 'order': 'experiment_id'})
    linked = _bundle()
    observations, excluded = [], []
    for r in rows:
        base = linked.get(r.get('experiment_id'))
        if base is None:
            excluded.append(r.get('experiment_id'))
            continue
        outputs = {k: float(r[k]) for k in OUTPUT_COLUMNS if r.get(k) is not None}
        observations.append({
            'gravity_g': float(r['gravity_g']), 'oxygen_pct': float(r['oxygen_pct']), 'pressure_kpa': float(r['pressure_kpa']),
            'airflow_cm_s': float(r['airflow_cm_s']), 'fuel': r['fuel'], 'configuration': r['configuration'],
            'temperature_k': base.get('temperature_k'), 'experiment_id': r['experiment_id'],
            'source': r.get('source') or base['source'], 'citation': r.get('citation') or base['citation'],
            'leakage_group': base['leakage_group'], 'provenance': r.get('provenance') or base['provenance'],
            'reviewed': bool(base.get('reviewed', False)), 'outputs': outputs,
            'uncertainty': {k: v for k, v in (base.get('uncertainty') or {}).items() if k in outputs},
        })
    return observations, excluded


def observations_path(cfg) -> Path:
    """Path of the dataset Motor 2 should read right now."""
    local = cfg.data_dir / 'combustion-observations.json'
    fallback = local if local.exists() else BUNDLE
    if not catalog._supabase_on(cfg):
        SOURCE.update(observations='local', detail=str(fallback.relative_to(ROOT)) if fallback.is_relative_to(ROOT) else str(fallback))
        return fallback
    target = cfg.data_dir / 'combustion-observations.supabase.json'
    if target.exists() and time.time() - _LAST['at'] < catalog.SUPABASE_TTL:
        return target
    try:
        observations, excluded = from_supabase(cfg)
        if not observations:
            raise ValueError('experimental_runs has no source-linked rows')
        payload = Dataset.model_validate({'schema_version': 1, 'observations': observations}).model_dump_json(indent=2)
        cfg.data_dir.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_text(encoding='utf-8') != payload:
            target.write_text(payload, encoding='utf-8')  # unchanged content keeps the same file (and dataset hash)
        _LAST['at'] = time.time()
        SOURCE.update(observations='supabase', detail=f'{len(observations)} source-linked runs from experimental_runs; '
                      f'{len(excluded)} excluded without a source link: {", ".join(sorted(excluded))}')
        return target
    except Exception as error:
        log.warning('Supabase experimental_runs unavailable, using local observations: %s', error)
        SOURCE.update(observations='local', detail=f'Supabase unavailable: {str(error)[:200]}')
        return fallback
