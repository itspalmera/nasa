import json
from pathlib import Path
from fastapi.testclient import TestClient
from flame.config import ROOT
from flame.investigation_charts import chart_data
from flame.main import create_app

CATALOG = json.loads((ROOT / 'datasets/psi/investigations.json').read_text())
DATASET = ROOT / 'datasets/papers/combustion-observations.json'

def investigation(key):
    return next(row for row in CATALOG['investigations'] if row['id'] == key)

def test_every_ranked_investigation_has_its_own_ranges():
    for inv in CATALOG['investigations']:
        chart = chart_data(inv, CATALOG['sources'], DATASET)
        assert chart['investigation_id'] == inv['id']
        assert {r['variable'] for r in chart['ranges']} == {'o2','pressure','flow','gravity'}
        assert chart['ranges'][0]['min'] == (inv.get('o2') or {}).get('min')
        assert [source['id'] for source in chart['sources']] == inv['sources']
    bass = chart_data(investigation('bass'), CATALOG['sources'], DATASET)
    assert bass['observations'] == []  # Never substitute another paper's data.
    assert bass['chart_kind'] == 'reported_ranges'

def test_measurements_are_scoped_to_source_and_saffire_mission():
    olson = chart_data(investigation('olson1987'), CATALOG['sources'], DATASET)
    assert olson['observations']
    assert {r['source'] for r in olson['observations']} == {'NASA-TM-100195'}
    assert 'spread_mm_s' in olson['outputs']
    for mission in (1,2):
        chart = chart_data(investigation(f'saffire{mission}'), CATALOG['sources'], DATASET)
        assert chart['observations']
        assert all(r['experiment_id'].startswith(f'saffire-{mission}-') for r in chart['observations'])
    pmma = chart_data(investigation('pmmarods'), CATALOG['sources'], DATASET)
    assert pmma['observations']
    assert all('PMMA' in r['fuel'] for r in pmma['observations'])

def test_missing_bounds_and_missing_measurements_remain_missing(tmp_path):
    inv = dict(investigation('bass'), o2={'min':None,'max':None}, gravity=None)
    chart = chart_data(inv, CATALOG['sources'], tmp_path / 'missing.json')
    assert chart['ranges'][0]['min'] is None
    assert chart['ranges'][-1]['min'] is None
    assert chart['observations'] == []
    assert chart['outputs'] == {}

def test_chart_endpoint_identity_and_unknown_id(cfg):
    cfg.supabase_url = ''
    cfg.supabase_key = ''
    with TestClient(create_app(cfg)) as client:
        response = client.get('/api/motor3/chart/BASS-II')
        assert response.status_code == 200
        assert response.json()['investigation_id'] == 'bass2'
        assert client.get('/api/motor3/chart/nonexistent').status_code == 404
        analysis = client.get('/api/motor3/intra/BASS-II').json()
        assert analysis['investigation_id'] == 'bass2'
        assert all(key in analysis for key in ('fixed_conditions','iterated_variables','unreported_variables','measured_outcomes','diagnostics_used'))
        assert 'runs' not in analysis  # Do not resurrect the old six fabricated runs.
        assert client.get('/api/motor3/intra/nonexistent').status_code == 404
