"""Import source-linked PDF transcriptions without granting scientific approval.

Run from the repository root on Windows or Linux:
    python scripts/import_paper_observations.py
An existing local dataset is merged by experiment_id; existing rows are preserved.
"""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

from flame.config import settings
from flame.ood.data import load_dataset
from flame.ood.schema import Dataset

BUNDLE = ROOT / 'datasets' / 'papers'


def import_observations(destination: Path, *, check=False, bundle=BUNDLE, papers=ROOT / 'papers'):
    seed_path = bundle / 'combustion-observations.json'
    incoming, _ = load_dataset(seed_path)
    if not incoming:
        raise ValueError('The source-linked observation bundle is empty or missing')
    if any(row.reviewed for row in incoming):
        raise ValueError('Transcribed observations must remain unreviewed; approve only the local dataset after scientific review')
    ids = [row.experiment_id for row in incoming]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate experiment_id in observation bundle')
    audit = json.loads((bundle / 'extraction-audit.json').read_text(encoding='utf-8'))
    evidence = {r['exported_observation_id']: r for r in audit['records'] if r['exported_observation_id']}
    checked_sources = set()
    for row in incoming:
        entry = evidence.get(row.experiment_id)
        if not entry:
            raise ValueError(f'Missing source evidence for {row.experiment_id}')
        excluded = {'oscillatory_spread', 'suspected_source_table_anomaly'}
        if excluded.intersection(entry['flags']):
            raise ValueError(f'Excluded source row in bundle: {row.experiment_id}')
        expected_outputs = {key: value for key, value in entry['outputs'].items() if value is not None}
        if 'length_in_transition' in entry['flags']:
            expected_outputs.pop('length_mm', None)
        if row.outputs != expected_outputs:
            raise ValueError(f'Observation differs from the extraction audit: {row.experiment_id}')
        for key in ('gravity_g', 'oxygen_pct', 'pressure_kpa', 'airflow_cm_s', 'fuel', 'configuration', 'temperature_k'):
            if getattr(row, key) != entry['conditions'].get(key):
                raise ValueError(f'Condition differs from the extraction audit: {row.experiment_id} / {key}')
        for source_entry in [entry] + entry.get('additional_sources', []):
            source = papers / source_entry['source_file']
            if source.parent.resolve() != papers.resolve():
                raise ValueError('Invalid source filename')
            source_key = (source, source_entry['source_sha256'])
            if source_key not in checked_sources:
                if hashlib.sha256(source.read_bytes()).hexdigest() != source_entry['source_sha256']:
                    raise ValueError(f'Source PDF changed: {source.name}; recheck the transcription before importing')
                checked_sources.add(source_key)
    existing, _ = load_dataset(destination)
    known = {row.experiment_id for row in existing}
    if len(known) != len(existing):
        raise ValueError('Existing dataset has duplicate experiment_id values; resolve before merging')
    additions = [row for row in incoming if row.experiment_id not in known]
    merged = Dataset(schema_version=1, observations=existing + additions)
    if not check and additions:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destination.parent, suffix='.tmp', delete=False) as temporary:
                temporary.write(merged.model_dump_json(indent=2) + '\n')
                temporary_path = Path(temporary.name)
            os.replace(temporary_path, destination)
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink()
    return {
        'mode': 'check_only' if check else 'merged', 'destination': str(destination),
        'added' if not check else 'would_add': len(additions), 'preserved_existing': len(existing),
        'total': len(merged.observations), 'reviewed': sum(r.reviewed for r in merged.observations),
        'sources': dict(Counter(r.source for r in merged.observations)),
        'notice': 'Imported rows remain reviewed=false. Scientific review is required for reviewed-mode training; explicit exploratory estimates remain unvalidated. See datasets/papers/README.md and extraction-audit.json.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Defaults to the backend DATA_DIR/combustion-observations.json')
    parser.add_argument('--check', action='store_true', help='Validate sources and report changes without writing')
    args = parser.parse_args()
    try:
        result = import_observations(args.output or settings().data_dir / 'combustion-observations.json', check=args.check)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Import failed: {error}\n')
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
