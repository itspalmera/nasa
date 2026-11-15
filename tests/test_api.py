import json
import hashlib
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from flame.main import create_app
from flame.discovery import parse_import
from flame.ingest import ingest
from conftest import make_pdf

def client(cfg):
    app=create_app(cfg)
    make_pdf(cfg.papers_dir/'sample.pdf')
    ingest(app.state.store,dry_run=False)
    return TestClient(app,raise_server_exceptions=False)

def test_required_api_endpoints(cfg):
    c=client(cfg)
    for path in ('/health','/api/documents','/api/experiments','/api/statistics','/api/findings','/openapi.json'):
        assert c.get(path).status_code==200,path
    docs=c.get('/api/documents').json();d=docs[0]
    assert c.get(f'/api/documents/{d["id"]}').status_code==200
    assert c.get(f'/api/documents/{d["id"]}/file').content.startswith(b'%PDF')
    assert c.post('/api/search',json={'query':'flame'}).json()['results']
    assert c.post('/api/chat',json={'query':'flame'}).json()['mode']=='evidence_only'
    assert c.post('/api/ingest',json={}).json()['dry_run']
    stats=c.get('/api/statistics').json()
    assert stats['verified_findings']==0 and stats['total_papers']==1

def test_missing_doc_and_validation_error_shape(cfg):
    c=client(cfg)
    assert c.get('/api/documents/nonexistent').status_code==404
    for payload in ({'query':''},{'query':'flame','limit':100}):
        r=c.post('/api/search',json=payload)
        assert r.status_code==422 and r.json()['error']['code']=='validation_error'

def test_upload_path_guard_and_duplicate(cfg):
    c=client(cfg);source=(cfg.papers_dir/'sample.pdf').read_bytes()
    assert c.post('/api/documents/upload',files={'file':('../escape.pdf',source)}).status_code==400
    assert c.post('/api/documents/upload',files={'file':('invalid.pdf',b'fake')}).status_code==400
    assert c.post('/api/documents/upload',files={'file':('sample.pdf',source)}).status_code==409
    assert c.post('/api/documents/upload',files={'file':('new.pdf',source)}).status_code==200

def test_authentication_and_cross_origin_guard(cfg):
    cfg.flame_api_token='test-secret'
    c=client(cfg)
    assert c.get('/api/documents').status_code==401
    headers={'Authorization':'Bearer test-secret'}
    assert c.get('/api/documents',headers=headers).status_code==200
    assert c.post('/api/ingest',json={},headers=headers|{'Origin':'https://other.example'}).status_code==403
    assert c.post('/api/ingest',json={},headers=headers|{'Origin':'http://testserver'}).status_code==200

def test_invalid_api_credentials_are_sanitized(cfg):
    c=client(cfg)
    c.app.state.store.config.enable_paid_api=True
    c.app.state.store.config.openai_api_key='invalid'
    with patch('flame.assistant.Provider.structured',side_effect=RuntimeError('secret-credential-content')):
        r=c.post('/api/chat',json={'query':'flame','semantic':False})
        assert r.status_code==502
        assert 'secret-credential-content' not in r.text

def test_manual_discovery_deduplication(cfg):
    c=client(cfg)
    payload={'records':[{'title':'Discovery paper','doi':'https://doi.org/10.1234/ABC','authors':['A. Researcher']}]}
    assert c.post('/api/discovery/import',json=payload).json()['result']['added']==1
    payload['records'][0]['doi']='10.1234/abc'
    assert c.post('/api/discovery/import',json=payload).json()['result']['duplicates']==1
    assert len(c.get('/api/discovery').json()['items'])==1
    assert c.get('/api/statistics').json()['total_papers']==1
    csv=b'title,doi,authors,year,url,abstract\nAnother paper,10.1234/xyz,A;B,2024,,Abstract\n'
    assert c.post('/api/discovery/upload',files={'file':('import.csv',csv)}).json()['result']['added']==1

def test_missing_original_file(cfg):
    c=client(cfg);d=c.get('/api/documents').json()[0]
    (cfg.papers_dir/'sample.pdf').unlink()
    assert c.get(f'/api/documents/{d["id"]}/file').status_code==404

def test_oversized_upload(cfg):
    c=client(cfg);cfg.max_file_mb=0
    assert c.post('/api/documents/upload',files={'file':('big.pdf',b'%PDF-123')}).status_code==413


def test_health_reports_configured_model_without_exposing_key(cfg):
    from flame.main import create_app
    from fastapi.testclient import TestClient
    cfg.openai_api_key = 'private-key-never-return'
    cfg.enable_paid_api = True
    response = TestClient(create_app(cfg)).get('/health')
    assert response.status_code == 200
    assert response.json()['synthesis_model'] == 'gpt-4o-mini'
    assert response.json()['synthesis_ready'] is True
    assert response.json()['consensus'] == 'manual_import_only'
    assert cfg.openai_api_key not in response.text


def test_observation_export_preserves_dataset_and_requires_auth(cfg):
    c = client(cfg)
    # Without a local override, export the same source-linked bundle used for fitting.
    fallback = c.get('/api/ood/dataset')
    assert fallback.status_code == 200
    assert fallback.json()['observations']
    assert c.get('/api/ood/status').json()['dataset_sha256'] == hashlib.sha256(fallback.content).hexdigest()
    bundle = Path(__file__).resolve().parents[1] / 'datasets/papers/combustion-observations.json'
    local = json.loads(bundle.read_bytes())
    local['observations'] = local['observations'][:3]
    raw = json.dumps(local).encode()
    (cfg.data_dir / 'combustion-observations.json').write_bytes(raw)
    response = c.get('/api/ood/dataset')
    assert response.status_code == 200
    assert response.content == raw
    assert 'combustion-observations.json' in response.headers['content-disposition']
    assert all(not row['reviewed'] for row in response.json()['observations'])
    cfg.flame_api_token = 'test-secret'
    assert c.get('/api/ood/dataset').status_code == 401
    assert c.get('/api/ood/dataset', headers={'Authorization': 'Bearer test-secret'}).content == raw


def test_legacy_mission_match_uses_psi_and_matches_canonical_ranking(cfg):
    c = TestClient(create_app(cfg))
    investigations = [{
        'id': 'pressure-sensitive', 'acronym': 'TEST', 'name': 'Test investigation',
        'pressure': {'min': 70, 'max': 71}, 'o2': {'min': 29, 'max': 31},
        'flow': {'min': 9, 'max': 11}, 'gravity': 0.167,
        'pillars': ['prevencion'],
    }]
    payload = {'o2': 30, 'pressure_psi': 10.2, 'flow': 10, 'gravity': 0.167}
    with patch('flame.engines.load_psi_catalog', return_value={'investigations': investigations}):
        for legacy_pillar, canonical_pillar in (
            ('all', 'todos'), ('prevention', 'prevencion'),
            ('detection', 'deteccion'), ('suppression', 'supresion'),
        ):
            legacy = c.post('/api/motor1/match-missions', json={
                **payload, 'selected_pillar': legacy_pillar,
            })
            canonical = c.post('/api/motor1/match', json={
                'o2': 30, 'pressure': 10.2 * 6.89476, 'flow': 10, 'gravity': 0.167,
                'selected_pillar': canonical_pillar,
            })
            assert legacy.status_code == canonical.status_code == 200
            assert legacy.json() == canonical.json()
            assert legacy.json()['ranking'][0]['match_breakdown']['pressure_match_pct'] == 100
        for pressure in (None, 0, -1, 'invalid'):
            invalid = {**payload, 'pressure_psi': pressure}
            assert c.post('/api/motor1/match-missions', json=invalid).status_code == 422
        assert c.post('/api/motor1/match-missions', json={'o2': 30}).status_code == 422
