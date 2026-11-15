"""Decision report: scenario + material -> cited summary; scenarios from Supabase with local fallback."""
import json
from unittest.mock import patch
import pytest
from flame import catalog
from flame.config import ROOT
from flame.models import AnswerClaim
from flame.report import ReportRequest, GeneratedReport, build


@pytest.fixture
def rstore(store):
    store.config.catalog_dir = ROOT / 'datasets' / 'psi'
    return store


def test_scenarios_and_materials_come_from_catalog_files(rstore):
    items, origin = catalog.scenarios(rstore.config.catalog_dir, rstore.config)
    assert origin == 'local' and {'luna', 'marte', 'iss'} <= {s['id'] for s in items}
    luna = next(s for s in items if s['id'] == 'luna')
    assert luna['o2_pct'] == 30.0 and luna['pressure_kpa'] == 70.3 and luna['gravity_g'] == 0.167
    mats = {m['id']: m for m in catalog.materials(rstore.config.catalog_dir, rstore.config)}
    assert set(mats) == {"cellulose", "pmma", "sibal", "nomex"} and 'SoFIE' in mats['pmma']['investigations'] and mats['sibal']['planned'] == ['FM2']


def test_scenarios_prefer_supabase_and_fall_back(rstore):
    rstore.config.supabase_url, rstore.config.supabase_key = 'https://x.supabase.co', 'k'
    class R:
        def __init__(self, data, code=200): self.data, self.code = data, code
        def raise_for_status(self):
            if self.code >= 400: raise RuntimeError(f'HTTP {self.code}')
        def json(self): return self.data
    row = {'preset_id': 'luna', 'name': 'Base lunar', 'o2_pct': 30, 'pressure_kpa': 70.3, 'pressure_psi': 10.2, 'flow_cms': 10, 'gravity_g': 0.167, 'note': None}
    catalog._SUPABASE_CACHE.clear()
    with patch('httpx.get', return_value=R([row])):
        items, origin = catalog.scenarios(rstore.config.catalog_dir, rstore.config)
    assert origin == 'supabase' and items == [dict(id='luna', name='Base lunar', o2_pct=30.0, pressure_kpa=70.3, pressure_psi=10.2, flow_cms=10.0, gravity_g=0.167, note=None)]
    catalog._SUPABASE_CACHE.clear()
    with patch('httpx.get', return_value=R({'message': 'denied'}, 401)):
        items, origin = catalog.scenarios(rstore.config.catalog_dir, rstore.config)
    assert origin == 'local' and len(items) >= 6
    catalog._SUPABASE_CACHE.clear()


def test_report_without_llm_is_deterministic_and_states_gaps(rstore):
    r = build(rstore, ReportRequest(scenario_id='luna', material_id='pmma'))
    assert r.mode == 'evidence_only' and r.verdict.status == 'insufficient_evidence'
    assert 'SoFIE' in r.coverage['covered_by']['oxygen'] and r.coverage['covered_by']['gravity'] == []
    assert any('0.167 g' in g for g in r.gaps)
    assert len(r.read_first) == 3 and all('relevance_score' in x for x in r.read_first)
    assert any(c.id.startswith('psi:') for c in r.citations) and 'match' not in r.material


def test_generated_report_keeps_only_verbatim_cited_claims(rstore):
    rstore.config.enable_paid_api = True
    rstore.config.openai_api_key = 'test'
    def fake(self, system, user, schema, operation):
        data = json.loads(user)
        assert schema is GeneratedReport and data['scenario']['o2_pct'] == 30.0 and data['coverage']['gaps']
        ev = {e['id']: e['text'] for e in data['evidence']}
        assert 'psi:BASS-II#2' in ev
        good = AnswerClaim(text='En BASS-II el PMMA sostuvo la llama con 17 % de O2 en microgravedad.', kind='observation',
                           citation_ids=['psi:BASS-II#2'], quote='la llama se sostuvo con 17% de O2 en microgravedad')
        invented = AnswerClaim(text='El margen es de 13,4 puntos.', kind='observation', citation_ids=['psi:BASS-II#2'], quote='el margen es de 13,4 puntos de oxígeno')
        return GeneratedReport(verdict_status='flammable', verdict=good, materials=[good, invented], suppression=[], safety=[], limitations=['Sin datos a 0,167 g.']), {}
    with patch('flame.provider.Provider.structured', fake):
        r = build(rstore, ReportRequest(scenario_id='luna', material_id='pmma'))
    assert r.mode == 'generated' and r.verdict.status == 'flammable' and r.verdict.text.endswith('[1]')
    assert [len(s.items) for s in r.sections] == [1, 0, 0] and [c.id for c in r.citations] == ['psi:BASS-II#2']
    assert any('verificar' in l for l in r.limitations)


def test_verdict_without_valid_quote_becomes_insufficient(rstore):
    rstore.config.enable_paid_api = True
    rstore.config.openai_api_key = 'test'
    def fake(self, system, user, schema, operation):
        bad = AnswerClaim(text='El Nomex no arde.', kind='observation', citation_ids=['psi:Saffire-II#1'], quote='esta frase no existe en la fuente citada')
        return GeneratedReport(verdict_status='not_flammable_in_tests', verdict=bad, materials=[], suppression=[], safety=[], limitations=[]), {}
    with patch('flame.provider.Provider.structured', fake):
        r = build(rstore, ReportRequest(scenario_id='marte', material_id='nomex', language='en'))
    assert r.verdict.status == 'insufficient_evidence' and r.verdict.claim is None and 'not enough' in r.verdict.headline


def test_unknown_ids_and_overrides(rstore):
    with pytest.raises(KeyError):
        build(rstore, ReportRequest(scenario_id='venus', material_id='pmma'))
    r = build(rstore, ReportRequest(scenario_id='luna', material_id='sibal', o2_pct=40))
    assert r.scenario['o2_pct'] == 40 and r.scenario['customized'] and any('40 %' in g for g in r.gaps)


def test_motors_1_and_3_read_the_same_catalog_as_the_chat(rstore):
    from flame import engines
    rstore.config.supabase_url, rstore.config.supabase_key = 'https://x.supabase.co', 'k'
    local = json.loads((ROOT / 'datasets' / 'psi' / 'investigations.json').read_text(encoding='utf-8'))
    only = [i for i in local['investigations'] if i['id'] in ('bass', 'sofie')]
    row = {'preset_id': 'luna', 'name': 'Base lunar', 'o2_pct': 30, 'pressure_kpa': 70.3, 'pressure_psi': 10.2, 'flow_cms': 10, 'gravity_g': 0.167, 'note': None}
    class R:
        def __init__(self, data): self.data = data
        def raise_for_status(self): pass
        def json(self): return self.data
    def fake_get(url, **kw):
        return R([{'raw_json': i} for i in only] if url.endswith('/investigations') else [row])
    catalog._SUPABASE_CACHE.clear()
    with patch('httpx.get', side_effect=fake_get):
        cat = engines.load_psi_catalog(rstore)
    catalog._SUPABASE_CACHE.clear()
    assert [i['id'] for i in cat['investigations']] == ['bass', 'sofie']
    assert cat['habitats'] == [{'id': 'luna', 'name': 'Base lunar', 'o2': 30.0, 'pressure': 70.3, 'pressure_psi': 10.2, 'flow': 10.0, 'gravity': 0.167, 'note': None}]
    ranking = engines.calculate_mission_match({'o2': 30, 'pressure': 70.3, 'flow': 10, 'gravity': 0.167}, cat['investigations'])
    assert {r['acronym'] for r in ranking} == {'BASS', 'SoFIE'}


def test_motor2_reads_only_source_linked_runs_from_supabase(rstore):
    from flame import runs
    from flame.ood.data import load_dataset
    rstore.config.supabase_url, rstore.config.supabase_key = 'https://x.supabase.co', 'k'
    bundle = json.loads(runs.BUNDLE.read_text(encoding='utf-8'))['observations']
    def as_row(o, reviewed=True):
        out = o['outputs']
        return {'experiment_id': o['experiment_id'], 'fuel': o['fuel'], 'configuration': o['configuration'], 'gravity_g': o['gravity_g'],
                'oxygen_pct': o['oxygen_pct'], 'pressure_kpa': o['pressure_kpa'], 'pressure_psi': 14.7, 'airflow_cm_s': o['airflow_cm_s'],
                'spread_mm_s': out.get('spread_mm_s'), 'minimum_oxygen_pct': out.get('minimum_oxygen_pct'), 'length_mm': out.get('length_mm'),
                'provenance': o['provenance'], 'reviewed': reviewed, 'source': o['source'], 'citation': o['citation']}
    invented = dict(as_row(bundle[0]), experiment_id='bass2-pmma-0g-flow10', spread_mm_s=1.15, minimum_oxygen_pct=16.3)
    class R:
        def raise_for_status(self): pass
        def json(self): return [as_row(o) for o in bundle] + [invented]
    catalog._SUPABASE_CACHE.clear(); runs._LAST['at'] = 0
    with patch('httpx.get', return_value=R()):
        path = runs.observations_path(rstore.config)
    catalog._SUPABASE_CACHE.clear()
    rows, _ = load_dataset(path)
    assert path.name == 'combustion-observations.supabase.json' and runs.SOURCE['observations'] == 'supabase'
    assert len(rows) == len(bundle) and 'bass2-pmma-0g-flow10' not in {r.experiment_id for r in rows}
    assert not any(r.reviewed for r in rows) and 'bass2-pmma-0g-flow10' in runs.SOURCE['detail']
    original = {o['experiment_id']: o for o in bundle}
    assert all(r.outputs == original[r.experiment_id]['outputs'] and r.leakage_group == original[r.experiment_id]['leakage_group'] for r in rows)


def test_motor2_falls_back_to_the_bundle_without_supabase(rstore):
    from flame import runs
    assert runs.observations_path(rstore.config) == runs.BUNDLE and runs.SOURCE['observations'] == 'local'
