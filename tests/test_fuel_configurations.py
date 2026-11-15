"""Source-linked additional material configurations, never synthetic benchmarks."""
import json
from pathlib import Path
import shutil

import pytest
from flame.ood.data import load_dataset
from flame.ood.schema import Query
from flame.ood.service import infer, status
from scripts.extract_pmma_figure4 import extract_figure4
from scripts.import_paper_observations import BUNDLE, ROOT, import_observations


def test_pmma_vector_adapter_reproduces_only_observed_markers_and_preserves_text_anchors():
    stored = json.loads((BUNDLE/'pmma-figure4-digitization.json').read_text())
    current = extract_figure4()
    assert current['source_sha256'] == stored['source_sha256']
    assert [len(s['points']) for s in current['series']] == [6, 6, 4, 4]
    for original, generated in zip(stored['series'], current['series']):
        assert original['diameter_mm'] == generated['diameter_mm']
        assert original['gravity_g'] == generated['gravity_g']
        assert [(p['airflow_cm_s'],p['spread_mm_s']) for p in original['points']] == [(p['airflow_cm_s'],p['spread_mm_s']) for p in generated['points']]
    anchors = current['series'][0]['points']
    assert anchors[0]['spread_mm_s'] == .68
    assert anchors[-1]['spread_mm_s'] == .53
    assert current['measurement_sd'] is None


def test_new_pmma_configurations_fit_separately_but_sibal_is_evidence_only(tmp_path):
    path = tmp_path/'observations.json'
    import_observations(path)
    report = status(path)
    assert len(report['exploratory_cohorts']) == 19
    eligible = [c for c in report['exploratory_cohorts'] if c['prediction_eligible']]
    assert len(eligible) == 4
    pmma = [c for c in eligible if c['fuel'] == 'Cast clear PMMA']
    assert len(pmma) == 2
    for cohort in pmma:
        assert cohort['observed_ranges']['oxygen_pct'] == [21,21]
        assert cohort['observed_ranges']['pressure_kpa'] == [101.325,101.325]
        assert cohort['observed_ranges']['airflow_cm_s'] == [0,25]
        prediction = infer(path, Query(fuel=cohort['fuel'], configuration=cohort['configuration'],
            gravity_g=.38, oxygen_pct=21, pressure_kpa=101.325, airflow_cm_s=5, data_mode='exploratory'))
        assert set(prediction['results']) == {'spread_mm_s'}
        assert prediction['results']['spread_mm_s']['interval'][0] > 0
        assert prediction['results']['spread_mm_s']['training_n'] in [8,12]
    sibal = [c for c in report['exploratory_cohorts'] if c['fuel']=='Cotton-fiberglass (SIBAL)']
    assert len(sibal) == 15
    assert all(c['availability']=='observations_only' for c in sibal)
    assert all(c['coverage']['spread_mm_s']['gravity_levels']==[0] for c in sibal)
    assert not any(r.reviewed for r in load_dataset(path)[0])


def test_import_merges_new_rows_into_old_seventy_without_changing_existing_reviews(tmp_path):
    seed = json.loads((BUNDLE/'combustion-observations.json').read_text())
    old = seed['observations'][:70]
    old[0]['reviewed'] = True
    path = tmp_path/'observations.json'
    path.write_text(json.dumps({'schema_version':1,'observations':old}))
    assert import_observations(path)['added'] == 41
    merged = json.loads(path.read_text())
    assert merged['observations'][:70] == old
    assert import_observations(path)['added'] == 0


def test_import_verifies_supplementary_conditions_pdf_before_writing(tmp_path):
    papers = tmp_path/'papers';papers.mkdir()
    sources = ['The Effect of Microgravity on Flame Spread over a Thin Fuel.pdf',
               'Flame spread over thin circular PMMA rods.pdf',
               'Results of Large-Scale Spacecraft Flammability Tests.pdf',
               'Numerical study of concurrent flow flame spread over thin solids in.pdf']
    for name in sources:shutil.copyfile(ROOT/'papers'/name,papers/name)
    (papers/sources[-1]).write_bytes(b'changed secondary conditions table')
    destination=tmp_path/'observations.json'
    with pytest.raises(ValueError,match='Source PDF changed'):
        import_observations(destination,papers=papers)
    assert not destination.exists()
