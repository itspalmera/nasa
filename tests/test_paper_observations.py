"""Regression checks for the real PDF transcription; no accuracy benchmarks."""
import hashlib
import json
from pathlib import Path
import shutil

import pytest
from flame.ood.data import load_dataset
from flame.ood.service import infer, status
from flame.ood.schema import Query
from scripts.import_paper_observations import BUNDLE, ROOT, import_observations


def test_export_preserves_source_cells_and_exclusions():
    rows, _ = load_dataset(BUNDLE / 'combustion-observations.json')
    audit = json.loads((BUNDLE / 'extraction-audit.json').read_text())
    by_id = {row.experiment_id: row for row in rows}
    assert len(rows) == len(by_id) == 111
    assert len(audit['sources']) == 19
    assert len(audit['records']) == 143
    assert not any(row.reviewed for row in rows)
    assert by_id['olson1987-A-II-row04'].outputs['spread_mm_s'] == 11.2
    assert by_id['olson1987-A-II-row04'].outputs['length_mm'] == 17
    assert by_id['olson1987-A-II-row04'].pressure_kpa == 101.325
    assert by_id['pmma-thin-1mm-ground-flow25'].outputs['spread_mm_s'] == .53
    for entry in audit['records']:
        identifier = entry['exported_observation_id']
        if identifier:
            row = by_id[identifier]
            assert hashlib.sha256((ROOT/'papers'/entry['source_file']).read_bytes()).hexdigest() == entry['source_sha256']
            assert row.outputs['spread_mm_s'] == round(entry['transcribed_cells'].get('spread_cm_s', row.outputs['spread_mm_s'] / 10) * 10, 8)
            if 'length_in_transition' in entry['flags']:
                assert 'length_mm' not in row.outputs
            assert not {'oscillatory_spread', 'suspected_source_table_anomaly'} & set(entry['flags'])
        if {'oscillatory_spread', 'suspected_source_table_anomaly'} & set(entry['flags']):
            assert identifier is None
    # No unknown uncertainty was fabricated as a per-row standard deviation.
    assert all(row.uncertainty == {} for row in rows)
    assert sum('length_mm' in row.outputs for row in rows) == 51


def test_import_is_idempotent_preserves_local_reviews_and_stays_data_gated(tmp_path):
    destination = tmp_path/'combustion-observations.json'
    assert import_observations(destination, check=True)['would_add'] == 111
    assert not destination.exists()
    assert import_observations(destination)['added'] == 111
    assert import_observations(destination)['added'] == 0
    loaded = status(destination)
    assert loaded['observations'] == loaded['unreviewed_observations'] == 111
    assert loaded['reviewed_direct_observations'] == 0
    assert 'await scientific review' in loaded['reason']
    rows, _ = load_dataset(destination)
    query = Query(**{key: getattr(rows[0], key) for key in ('gravity_g','oxygen_pct','pressure_kpa','airflow_cm_s','fuel','configuration')})
    assert infer(destination, query)['status'] == 'unavailable'
    payload = json.loads(destination.read_text())
    # Simulate a pre-existing custodian review; importer must preserve it.
    payload['observations'][0]['reviewed'] = True
    destination.write_text(json.dumps(payload))
    import_observations(destination)
    assert load_dataset(destination)[0][0].reviewed is True


def test_import_rejects_changed_pdf_without_modifying_dataset(tmp_path):
    papers = tmp_path/'papers'
    papers.mkdir()
    for name in ['The Effect of Microgravity on Flame Spread over a Thin Fuel.pdf', 'Flame spread over thin circular PMMA rods.pdf']:
        shutil.copyfile(ROOT/'papers'/name, papers/name)
    (papers/'The Effect of Microgravity on Flame Spread over a Thin Fuel.pdf').write_bytes(b'changed')
    destination = tmp_path/'observations.json'
    original = '{"schema_version":1,"observations":[]}'
    destination.write_text(original)
    with pytest.raises(ValueError, match='Source PDF changed'):
        import_observations(destination, papers=papers)
    assert destination.read_text() == original


def test_import_rejects_values_that_no_longer_match_audit(tmp_path):
    bundle = tmp_path/'bundle'
    shutil.copytree(BUNDLE, bundle)
    seed = bundle/'combustion-observations.json'
    payload = json.loads(seed.read_text())
    payload['observations'][0]['outputs']['spread_mm_s'] = 777
    seed.write_text(json.dumps(payload))
    destination = tmp_path/'observations.json'
    with pytest.raises(ValueError, match='differs from the extraction audit'):
        import_observations(destination, bundle=bundle)
    assert not destination.exists()


def test_exploration_is_explicit_does_not_approve_data_and_cannot_validate(tmp_path):
    from flame.main import create_app
    from flame.config import Settings
    from fastapi.testclient import TestClient
    path = tmp_path/'data'/'combustion-observations.json'
    import_observations(path)
    original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    rows, _ = load_dataset(path)
    source = next(row for row in rows if row.source == 'NASA-TM-100195')
    query = Query(**{key: getattr(source, key) for key in ('gravity_g','oxygen_pct','pressure_kpa','airflow_cm_s','fuel','configuration')})
    config = Settings(_env_file=None, data_dir=path.parent, papers_dir=tmp_path/'papers', enable_paid_api=False, openai_api_key='')
    with TestClient(create_app(config)) as client:
        availability = client.get('/api/ood/status').json()
        assert availability['cohorts'] == []
        assert len(availability['exploratory_cohorts']) == 19
        assert client.post('/api/ood/predict', json=query.model_dump()).json()['status'] == 'unavailable'
        body = query.model_dump() | {'data_mode': 'exploratory', 'gravity_g': .38, 'oxygen_pct': 21}
        for model in ('gpr', 'boosting'):
            report = client.post('/api/ood/predict', json=body | {'model': model}).json()
            assert report['status'] == 'available'
            assert report['data_mode'] == 'exploratory'
            assert report['scientific_validation'] == 'not_established'
            assert 'pending scientific review' in report['warning']
            assert set(report['results']) == {'spread_mm_s', 'length_mm'}
            assert report['request']['data_mode'] == 'exploratory'
            assert all(r['matching_conditions_gravity_levels'] == [1] for r in report['results'].values())
            if model == 'gpr':
                assert all(r['target_transform'] == 'log' and r['interval'][0] > 0 for r in report['results'].values())
            assert all(r['reviewed_training_n'] == 0 and r['unreviewed_training_n'] > 0 for r in report['results'].values())
        assert client.post('/api/ood/validate', json=body).status_code == 400
        assert client.post('/api/ood/predict', json=body | {'data_mode': 'approved'}).status_code == 422
    assert hashlib.sha256(path.read_bytes()).hexdigest() == original_hash
    assert not any(row.reviewed for row in load_dataset(path)[0])
