"""A plotted model curve must never create observations or validation claims."""
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from flame.main import create_app
from flame.ood.data import load_dataset
from flame.ood.schema import GravitySweepQuery, Query
from flame.ood.service import infer
from flame.ood.sweep import gravity_sweep
from scripts.import_paper_observations import BUNDLE, import_observations


def request(**changes):
    rows,_=load_dataset(BUNDLE/'combustion-observations.json')
    row=next(r for r in rows if r.source=='NASA-TM-100195')
    return GravitySweepQuery(**({'fuel':row.fuel,'configuration':row.configuration,'oxygen_pct':21,
        'pressure_kpa':101.325,'airflow_cm_s':0,'data_mode':'exploratory'}|changes))


def test_sweep_fits_once_preserves_dataset_and_agrees_with_point_inference(cfg):
    from flame.ood.models import fit_model
    path=cfg.data_dir/'combustion-observations.json';import_observations(path); original=path.read_bytes()
    with patch('flame.ood.models.fit_model',wraps=fit_model) as fitted:
        report=gravity_sweep(path,request())
        assert fitted.call_count==1
    assert report['status']=='available'
    assert report['curve_is_model_output'] is True
    assert report['scientific_validation']=='not_established'
    assert report['training_n']==37
    assert len(report['points'])==1001
    assert report['points'][0]['gravity_g']==0 and report['points'][-1]['gravity_g']==1
    assert all(p['interval'][0]>0 for p in report['points'])
    assert {r['gravity_g'] for r in report['observations']}=={1}
    assert len(report['observations'])==1
    point=infer(path,Query(**request().model_dump(exclude={'property_name'}),gravity_g=.38))['results']['spread_mm_s']
    assert report['points'][380]['median']==pytest.approx(point['median'])
    assert report['points'][380]['interval']==pytest.approx(point['interval'])
    assert path.read_bytes()==original


def test_sweep_uses_only_supported_outputs_and_real_data_modes(cfg):
    path=cfg.data_dir/'combustion-observations.json';import_observations(path)
    assert gravity_sweep(path,request(data_mode='reviewed'))['status']=='unavailable'
    assert gravity_sweep(path,request(property_name='minimum_oxygen_pct'))['points']==[]
    assert gravity_sweep(path,request(model='physics_gpr'))['status']=='unavailable'
    tree=gravity_sweep(path,request(model='boosting'))
    assert all(p['interval'] is None for p in tree['points'])
    outside=gravity_sweep(path,request(airflow_cm_s=8))
    assert outside['observations']==[]
    assert 'airflow_cm_s' in outside['outside_features']
    with TestClient(create_app(cfg)) as client:
        assert client.post('/api/ood/gravity-sweep',json=request().model_dump()).status_code==200
        assert client.post('/api/ood/gravity-sweep',json=request().model_dump()|{'property_name':'extinction_probability'}).status_code==422
