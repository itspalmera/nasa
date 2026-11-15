"""Source-scoped chart data for ranked investigations; never infer run-level curves."""
from pathlib import Path
from .ood.data import DIRECT, load_dataset
from .ood.schema import OUTPUTS

# Exact source identities from the versioned transcription audit, not title/fuel matching.
SOURCE_REFS = {
    'p_olson1987': 'NASA-TM-100195',
    'p_manu': 'Manu-BV-Kumar-thin-PMMA-manuscript',
    'p_li2020': 'ICES-2020-407',
    'p_sharma2024': '10.1007/s12217-024-10106-y',
}


def chart_data(investigation: dict, sources: dict, dataset_path: Path) -> dict:
    refs = investigation.get('sources', [])
    identities = {SOURCE_REFS[ref] for ref in refs if ref in SOURCE_REFS}
    rows, digest = load_dataset(dataset_path)
    selected = []
    for row in rows:
        if row.provenance not in DIRECT:
            continue
        linked = row.source in identities
        # The shared Saffire table contains multiple missions: keep the exact mission rows.
        if investigation['id'] in ('saffire1', 'saffire2'):
            mission = '1' if investigation['id'] == 'saffire1' else '2'
            linked = row.source == 'Saffire-I-II-experimental-presentation' and row.experiment_id.startswith(f'saffire-{mission}-')
        if linked:
            selected.append(row.model_dump())
    ranges = []
    for key, unit in [('o2', '%'), ('pressure', 'kPa'), ('flow', 'cm/s')]:
        value = investigation.get(key) or {}
        ranges.append(dict(variable=key, unit=unit, min=value.get('min'), max=value.get('max'),
                           basis=value.get('basis'), note=value.get('note')))
    gravity = investigation.get('gravity')
    ranges.append(dict(variable='gravity', unit='g', min=gravity, max=gravity, basis='reported', note=None))
    return {
        'investigation_id': investigation['id'], 'acronym': investigation['acronym'],
        'name': investigation.get('name'), 'ranges': ranges,
        'observations': selected,
        'outputs': {name: unit for name, unit in OUTPUTS.items() if any(row['outputs'].get(name) is not None for row in selected)},
        'sources': [dict(id=ref, title=sources.get(ref, {}).get('title', ref), url=sources.get(ref, {}).get('url')) for ref in refs],
        'dataset_sha256': digest,
        'chart_kind': 'measurements_and_ranges' if selected else 'reported_ranges',
    }
