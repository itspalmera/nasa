"""Evidence inspection uses real source rows; no model metrics are fabricated."""
from unittest.mock import patch
from fastapi.testclient import TestClient
from flame.main import create_app
from flame.ood.data import load_dataset
from flame.ood.evidence import inspect_evidence
from flame.ood.schema import EvidenceQuery
from scripts.import_paper_observations import BUNDLE, import_observations


def nasa_query(**changes):
    rows, _ = load_dataset(BUNDLE/'combustion-observations.json')
    row = next(r for r in rows if r.source == 'NASA-TM-100195')
    return EvidenceQuery(**({'fuel': row.fuel, 'configuration': row.configuration,
                            'data_mode': 'exploratory', 'gravity_g': 0} | changes))


def test_evidence_reports_actual_observations_and_the_full_exclusion_plan(cfg):
    destination = cfg.data_dir/'combustion-observations.json'
    import_observations(destination)
    with patch('flame.ood.models.fit_model', side_effect=AssertionError('Inspection must not fit models')):
        with TestClient(create_app(cfg)) as client:
            response = client.post('/api/ood/evidence', json=nasa_query().model_dump())
    assert response.status_code == 200
    report = response.json()
    assert report['model_fitted'] is False
    assert report['dependency_groups'] == 1
    assert report['cohort_observations'] == 37
    assert set(report['outputs']) == {'spread_mm_s', 'length_mm'}
    spread = report['outputs']['spread_mm_s']
    assert len(spread['observations']) == 37
    assert sum(level['observations'] for level in spread['by_gravity']) == 37
    assert spread['fold_preview']['held_out_n'] == 22
    assert spread['fold_preview']['remaining_before_group_exclusion'] == 15
    assert spread['fold_preview']['related_rows_removed'] == 15
    assert spread['fold_preview']['remaining_training_n'] == 0
    assert spread['fold_preview']['validation_allowed'] is False
    assert spread['fold_preview']['remaining_gravity_levels'] == []
    assert 'predicted' not in spread and 'metrics' not in spread
    assert all(not row['reviewed'] and row['measurement_sd'] is None for row in spread['observations'])
    row = next(row for row in spread['observations'] if row['id'] == 'olson1987-A-II-row04')
    assert row['observed'] == 11.2
    assert row['gravity_g'] == 1 and row['oxygen_pct'] == 21 and row['pressure_kpa'] == 101.325
    assert 'Table A-II' in row['citation']
    assert 'nominal microgravity' in report['gravity_note']


def test_inspection_does_not_silently_approve_or_invent_a_gravity(cfg):
    destination = cfg.data_dir/'combustion-observations.json'
    import_observations(destination)
    original = destination.read_bytes()
    assert inspect_evidence(destination, nasa_query(data_mode='reviewed'))['outputs'] == {}
    report = inspect_evidence(destination, nasa_query(gravity_g=.165))
    preview = report['outputs']['spread_mm_s']['fold_preview']
    assert preview['held_out_n'] == 0
    assert preview['data_split_eligible'] is False
    assert any('No observations' in reason for reason in preview['reasons'])
    assert {row['gravity_g'] for row in report['outputs']['spread_mm_s']['observations']} == {0, 1}
    assert destination.read_bytes() == original
    assert inspect_evidence(destination, nasa_query(fuel='unsupported'))['status'] == 'unavailable'


def test_evidence_endpoint_respects_authentication_and_requires_only_inspection_inputs(cfg):
    cfg.flame_api_token = 'local-test-token'
    # Explicit empty override isolates inspection from the bundled fallback dataset.
    cfg.data_dir.mkdir(parents=True, exist_ok=True)
    (cfg.data_dir / 'combustion-observations.json').write_text('{"schema_version":1,"observations":[]}')
    with TestClient(create_app(cfg)) as client:
        assert client.post('/api/ood/evidence', json=nasa_query().model_dump()).status_code == 401
        headers = {'Authorization': 'Bearer local-test-token'}
        assert client.post('/api/ood/evidence', headers=headers, json=nasa_query().model_dump()).json()['status'] == 'unavailable'
        assert client.post('/api/ood/evidence', headers=headers, json={}).status_code == 422
        assert client.post('/api/ood/evidence', headers=headers, json=nasa_query().model_dump() | {'gravity_g': -1}).status_code == 422
