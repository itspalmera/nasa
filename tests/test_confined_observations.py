"""Source and migration checks, not validation of scientific predictive accuracy."""
import csv
import hashlib
import json
import shutil

import pytest
from flame.ood.data import load_dataset
from flame.ood.schema import Query
from flame.ood.service import infer, status
from scripts.extract_confined_observations import GROUP, SOURCES, extract_confined_observations
from scripts.import_paper_observations import BUNDLE, ROOT, import_observations


def test_digitization_reproduces_twenty_published_markers_and_conversions():
    extracted = extract_confined_observations()
    stored = json.loads((BUNDLE / 'confined-digitization.json').read_text())
    assert extracted == stored
    assert len(extracted['observations']) == 20
    assert [len(chart['points']) for chart in stored['charts']] == [9, 11]
    rows = {row['experiment_id']: row for row in stored['observations']}
    assert rows['li2020-fig7a-black-D2cm-flow7']['outputs'] == {'spread_mm_s': .83}
    assert rows['li2020-fig7a-reflective-D4cm-flow7']['outputs'] == {'spread_mm_s': 2.16}
    assert rows['sharma2024-fig13-black-D4cm-flow7.3']['outputs'] == {'spread_mm_s': 1.24}
    assert all(row['pressure_kpa'] == 101.325 and row['oxygen_pct'] == 22 for row in rows.values())
    assert all(not row['reviewed'] and row['uncertainty'] == {} and row['temperature_k'] is None for row in rows.values())
    assert all(row['gravity_g'] == 0 and row['leakage_group'] == GROUP for row in rows.values())
    assert stored['measurement_sd'] is None
    assert len({row['configuration'] for row in rows.values()}) == 13
    # Three ambiguous concurrent D=3 points are not counted; opposed-flow D=3 is distinct.
    assert not any('D3cm' in identifier for identifier in rows if identifier.startswith('li2020'))


def test_source_change_is_rejected_before_extraction(tmp_path):
    papers = tmp_path / 'papers'; papers.mkdir()
    for spec in SOURCES:
        shutil.copyfile(ROOT / 'papers' / spec['source_file'], papers / spec['source_file'])
    (papers / SOURCES[0]['source_file']).write_bytes(b'changed source')
    with pytest.raises(ValueError, match='Source PDF changed'):
        extract_confined_observations(papers)


def test_twenty_new_rows_match_bundle_audit_and_csv():
    extracted = extract_confined_observations()
    bundle = json.loads((BUNDLE / 'combustion-observations.json').read_text())
    audit = json.loads((BUNDLE / 'extraction-audit.json').read_text())
    by_id = {row['experiment_id']: row for row in bundle['observations']}
    records = {row['exported_observation_id']: row for row in audit['records'] if row['exported_observation_id']}
    with (BUNDLE / 'extracted-measurements.csv').open(encoding='utf-8-sig', newline='') as stream:
        csv_rows = {row['id']: row for row in csv.DictReader(stream)}
    assert len(bundle['observations']) == len(by_id) == 111
    assert len(audit['records']) == len(csv_rows) == 143
    for row in extracted['observations']:
        identifier = row['experiment_id']
        assert by_id[identifier] == row
        assert records[identifier]['outputs'] == row['outputs']
        assert float(csv_rows[identifier]['spread_mm_s']) == row['outputs']['spread_mm_s']
        assert json.loads(csv_rows[identifier]['transcribed_cells']) == records[identifier]['transcribed_cells']


def test_upgrade_from_ninety_one_adds_twenty_without_overwriting_review(tmp_path):
    path = tmp_path / 'combustion-observations.json'
    bundle = json.loads((BUNDLE / 'combustion-observations.json').read_text())
    old = bundle['observations'][:91]
    old[0]['reviewed'] = True
    path.write_text(json.dumps({'schema_version': 1, 'observations': old}))
    before = path.read_bytes()
    assert import_observations(path, check=True)['would_add'] == 20
    assert path.read_bytes() == before
    assert import_observations(path)['added'] == 20
    assert json.loads(path.read_text())['observations'][:91] == old
    after = hashlib.sha256(path.read_bytes()).hexdigest()
    assert import_observations(path)['added'] == 0
    assert hashlib.sha256(path.read_bytes()).hexdigest() == after


def test_single_gravity_additions_stay_observations_only(tmp_path):
    path = tmp_path / 'observations.json'
    import_observations(path)
    report = status(path)
    assert report['observations'] == report['unreviewed_observations'] == 111
    assert report['reviewed_direct_observations'] == 0
    assert report['cohorts'] == []
    assert len(report['exploratory_cohorts']) == 19
    additions = [row for row in load_dataset(path)[0] if row.leakage_group == GROUP]
    configs = {row.configuration for row in additions}
    cohorts = [cohort for cohort in report['exploratory_cohorts'] if cohort['configuration'] in configs]
    assert len(cohorts) == 13
    assert all(cohort['availability'] == 'observations_only' for cohort in cohorts)
    assert sum(c['prediction_eligible'] for c in report['exploratory_cohorts']) == 4
    for row in additions:
        query = Query(**{key: getattr(row, key) for key in ('oxygen_pct','pressure_kpa','airflow_cm_s','fuel','configuration')},
                      gravity_g=.165, data_mode='exploratory')
        assert infer(path, query)['status'] == 'unavailable'
