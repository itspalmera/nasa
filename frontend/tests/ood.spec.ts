/** Synthetic API fixtures verify software behavior, never scientific performance. */
import {expect, test, type Page} from '@playwright/test';

const coverage = {
  spread_mm_s: {
    observations: 5, gravity_levels: [0, .2, .5, 1], prediction_eligible: true,
    folds: [0, .2, .5, 1].map(gravity_g => ({gravity_g, eligible: gravity_g !== .2, training_n: 3, test_n: 1})),
  },
  length_mm: {observations: 0, gravity_levels: [], prediction_eligible: false, folds: []},
};
const loaded = {
  reason: null, reviewed_direct_observations: 6, dependencies_ready: true, dataset_sha256: 'software-fixture-only',
  provenance_counts: {partial_gravity: 6},
  cohorts: [
    {fuel: 'Software test fuel', configuration: 'Test configuration', temperature_available: false, coverage},
    {fuel: 'Other test fuel', configuration: 'Other configuration', temperature_available: false,
      coverage: {spread_mm_s: {observations: 1, gravity_levels: [.8], prediction_eligible: false,
        folds: [{gravity_g: .8, eligible: false, training_n: 0, test_n: 1}]}}},
  ],
};
const empty = {...loaded, reason: 'No reviewed run-level experimental observations supplied.', reviewed_direct_observations: 0, cohorts: [], dataset_sha256: null, provenance_counts: {}};
const statistics = {
  total_papers: 0, indexed_chunks: 0, total_pages: 0, experiments_represented: 0, research_categories: 0,
  extraction_failures: 0, extraction_warning_pages: 0, verified_findings: 0, source_checked_findings: 0,
  experiment_distribution: [], publication_timeline: [], category_distribution: [], usage: {},
  paid_api_enabled: false, embedded_chunks: 0,
};

async function setup(page: Page, status: (typeof loaded | typeof empty) & {observations?: number; unreviewed_observations?: number; exploratory_cohorts?: typeof loaded.cohorts} = loaded) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = path === '/api/ood/status' ? status : path === '/api/statistics' ? statistics :
      path === '/api/documents' ? [] : path === '/api/ood/gravity-sweep' ? {status:'unavailable',reason:'No model curve supplied in this software fixture.',points:[],observations:[],unit:'mm/s',training_n:0,warning:'Software fixture only.'} : path === '/api/ood/evidence' ? {status: 'unavailable', reason: 'No fixture observations supplied for this test.', cohort_observations: 0, dependency_groups: 0, outputs: {}, gravity_note: null, limitations: [], model_fitted: false, dataset_sha256: null} : path === '/api/ood/schema' ? {title: 'Dataset', type: 'object'} : {items: []};
    await route.fulfill({json});
  });
  await page.goto('/');
  await page.getByRole('button', {name: /Predecir y preguntar/}).first().click();
  const panel = page.getByRole('region', {name: 'Predict fire behaviour at gravities never tested'});
  // The app supplies the lunar scenario; scientific fixture cases use a fixed atmosphere.
  await expect(panel.getByLabel('Oxygen (%)')).toHaveValue('30');
  await panel.getByLabel('Oxygen (%)').fill('21');
  await panel.getByRole('slider', {name: 'Gravitational acceleration'}).fill('0.38');
  return panel;
}

function prediction(mean: number, oxygen: number) {
  return {
    status: 'available', reason: null, model: 'gpr', dataset_sha256: 'software-fixture-only', artifact_version: 'ood-v2',
    package_versions: {'scikit-learn': 'test'}, request: {oxygen_pct: oxygen},
    results: {spread_mm_s: {unit: 'mm/s', mean, interval: [mean - .1, mean + .1], gravity_position: 'interpolation',
      training_n: 5, outside_features: [], sources: ['Synthetic software test fixture'], interval_interpretation: 'Uncalibrated software fixture'}},
  };
}

test('empty state offers a measurement-free template and blocks fitting', async ({page}) => {
  const panel = await setup(page, empty);
  await expect(panel.getByText('Bring observations, then test generalization.')).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
  await expect(panel.getByRole('button', {name: 'Compare held-out predictions'})).toBeDisabled();
  const downloadEvent = page.waitForEvent('download');
  await panel.getByRole('button', {name: 'Empty dataset template'}).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({schema_version: 1, observations: []});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('validation levels belong to selected cohort and honor group exclusions', async ({page}) => {
  const panel = await setup(page);
  const levels = panel.getByLabel('Gravity to hold out');
  await expect(levels.locator('option[value="0.8"]')).toHaveCount(0);
  await levels.selectOption('0.2');
  await expect(panel.getByRole('button', {name: 'Compare held-out predictions'})).toBeDisabled();
  await expect(panel.getByText(/after excluding related groups, no output retains/)).toBeVisible();
  await panel.getByLabel('Fuel / experimental configuration').selectOption('1');
  await expect(levels).toHaveValue('');
  await expect(levels.locator('option[value="0.8"]')).toHaveCount(1);
  await expect(levels.locator('option[value="0.2"]')).toHaveCount(0);
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
});

test('validation cannot bypass required physical inputs', async ({page}) => {
  let requests = 0;
  const panel = await setup(page);
  await page.route('**/api/ood/validate', async route => {requests++; await route.fulfill({json: {results: {}}});});
  await panel.getByLabel('Gravity to hold out').selectOption('0');
  await panel.getByLabel('Oxygen (%)').fill('');
  await panel.getByRole('button', {name: 'Compare held-out predictions'}).click();
  expect(await panel.getByLabel('Oxygen (%)').evaluate(input => (input as HTMLInputElement).validity.valueMissing)).toBe(true);
  expect(requests).toBe(0);
});

test('late predictions cannot overwrite changed conditions and exports retain provenance', async ({page}) => {
  const panel = await setup(page);
  let release!: () => void;
  let fulfilled!: () => void;
  let started = false;
  const pending = new Promise<void>(resolve => {release = resolve;});
  const completed = new Promise<void>(resolve => {fulfilled = resolve;});
  await page.route('**/api/ood/predict', async route => {
    const oxygen = route.request().postDataJSON().oxygen_pct;
    if (oxygen === 21) {
      started = true;
      await pending;
      await route.fulfill({json: prediction(777, oxygen)}).catch(() => {});
      fulfilled();
    } else await route.fulfill({json: prediction(1.234, oxygen)});
  });
  await panel.getByRole('button', {name: 'Estimate supported properties'}).click();
  await expect.poll(() => started).toBe(true);
  await panel.getByLabel('Oxygen (%)').fill('22');
  await panel.getByRole('button', {name: 'Estimate supported properties'}).click();
  await expect(panel.locator('.ood-estimate-value')).toContainText('1.23');
  release();
  await completed;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(panel.locator('.ood-estimate-value')).toContainText('1.23');
  const downloadEvent = page.waitForEvent('download');
  await panel.getByRole('button', {name: 'Export prediction'}).click();
  const stream = await (await downloadEvent).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.request.oxygen_pct).toBe(22);
  expect(report.dataset_sha256).toBe('software-fixture-only');
  expect(report.artifact_version).toBe('ood-v2');
  expect(report.package_versions).toBeTruthy();
});

test('held-out comparison renders both models, intervals and accessible pairs', async ({page}) => {
  const panel = await setup(page);
  await page.route('**/api/ood/validate', async route => {
    const model = route.request().postDataJSON().model;
    const metrics = {n: 1, mae: .1, rmse: .1, normalized_mae: .1, r2: null, coverage: model === 'gpr' ? 1 : null, interval_width: model === 'gpr' ? .4 : null};
    await route.fulfill({json: {
      ...prediction(1.234, 21), model,
      results: {spread_mm_s: {unit: 'mm/s', folds: [{gravity_g: 0, status: 'evaluated', position: 'extrapolation', training_n: 3,
        metrics, by_source: {'Synthetic software fixture': metrics},
        points: [{source: 'Synthetic software fixture', observed: 1.1, predicted: 1.2, interval: model === 'gpr' ? [1, 1.4] : null}]}]}},
    }});
  });
  await panel.getByLabel('Gravity to hold out').selectOption('0');
  await panel.getByRole('button', {name: 'Compare held-out predictions'}).click();
  await expect(panel.getByRole('heading', {name: 'Standard GPR', exact: true})).toBeVisible();
  await expect(panel.getByRole('heading', {name: 'Gradient Boosting', exact: true})).toBeVisible();
  await expect(panel.getByRole('table')).toHaveCount(2);
  await expect(panel.getByRole('cell', {name: '1.000 to 1.400', exact: true})).toBeVisible();
  await expect(panel.getByRole('cell', {name: 'Unavailable', exact: true})).toBeVisible();
  await expect(panel.locator('.ood-scatter svg.recharts-surface')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('imported measurements are distinguished from an empty dataset and stay blocked', async ({page}) => {
  const panel = await setup(page, {...empty, observations: 70, unreviewed_observations: 70,
    reason: '70 observation rows loaded; 70 await scientific review. Unreviewed records are excluded from training.'});
  await expect(panel.getByRole('heading', {name: 'Measurements extracted; scientific review pending.'})).toBeVisible();
  await expect(panel.getByText('70 observations awaiting review', {exact: true})).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Empty dataset template'})).toHaveCount(0);
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
  await expect(panel.getByRole('button', {name: 'Compare held-out predictions'})).toBeDisabled();
});


test('exploratory estimates require opt-in, choose an eligible cohort and never enable validation', async ({page}) => {
  const panel = await setup(page, {...empty, observations: 70, unreviewed_observations: 70,
    exploratory_cohorts: [loaded.cohorts[1], loaded.cohorts[0]]});
  const toggle = panel.getByRole('checkbox', {name: 'Use extracted observations for exploratory estimates'});
  await expect(toggle).not.toBeChecked();
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
  await toggle.check();
  await expect(panel.getByLabel('Fuel / experimental configuration')).toHaveValue('1');
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeEnabled();
  await expect(panel.getByRole('button', {name: 'Compare held-out predictions'})).toBeDisabled();
  await expect(panel.getByLabel('Gravity to hold out')).toBeEnabled();
  let receivedMode = '';
  await page.route('**/api/ood/predict', async route => {
    receivedMode = route.request().postDataJSON().data_mode;
    const report = prediction(1.234, 21);
    await route.fulfill({json: {...report, data_mode: 'exploratory',
      warning: 'Unreviewed software fixture. No independent validation.',
      results: {spread_mm_s: {...report.results.spread_mm_s, unreviewed_training_n: 5}}}});
  });
  await panel.getByRole('button', {name: 'Estimate supported properties'}).click();
  await expect(panel.locator('.ood-estimate-value')).toContainText('1.23');
  expect(receivedMode).toBe('exploratory');
  await expect(panel.getByText('Exploratory estimate · not experimentally validated', {exact: true})).toBeVisible();
  await toggle.uncheck();
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
  await expect(panel.locator('.ood-estimate')).toHaveCount(0);
});


test('positive-target estimates distinguish median, mean, calibration and joint support', async ({page}) => {
  const panel = await setup(page);
  await page.route('**/api/ood/predict', async route => {
    const report = prediction(25, 21);
    await route.fulfill({json: {...report, artifact_version: 'ood-v4', results: {length_mm: {
      ...report.results.spread_mm_s, unit: 'mm', mean: 25, median: 20, interval: [4, 60], target_transform: 'log',
      training_gravity_levels: [0, 1], matching_conditions_gravity_levels: [1],
      interval_interpretation: 'Uncalibrated lognormal posterior interval; not clipped.',
    }}}});
  });
  await panel.getByRole('button', {name: 'Estimate supported properties'}).click();
  await expect(panel.locator('.ood-estimate-value')).toContainText('20');
  await expect(panel.getByText('Posterior median', {exact: true})).toBeVisible();
  await expect(panel.getByText(/Posterior mean: 25 mm/)).toBeVisible();
  await expect(panel.getByText('Uncalibrated 95% model interval', {exact: true})).toBeVisible();
  await expect(panel.getByText('Gravity inside observed range', {exact: true})).toBeVisible();
  await expect(panel.getByText(/No matching set of the other input conditions/)).toBeVisible();
  await expect(panel.getByText('Empirical coverage has not been established. This is not a validated safety range.', {exact: true})).toBeVisible();
});

function evidenceReport(gravity: number | null) {
  const observations = [
    {id: 'software-fixture-micro', gravity_g: 0, oxygen_pct: 30, pressure_kpa: 101.325, airflow_cm_s: 0,
      temperature_k: null, observed: 2, measurement_sd: null, source: 'Software fixture', citation: 'Synthetic test table, not experimental evidence',
      reviewed: false, provenance: 'microgravity', leakage_group: 'shared-software-campaign'},
    {id: 'software-fixture-ground', gravity_g: 1, oxygen_pct: 21, pressure_kpa: 101.325, airflow_cm_s: 0,
      temperature_k: null, observed: 3, measurement_sd: null, source: 'Software fixture', citation: 'Synthetic test table, not experimental evidence',
      reviewed: false, provenance: 'ground', leakage_group: 'shared-software-campaign'},
  ];
  return {status: 'available', reason: null, model_fitted: false, dataset_sha256: 'software-fixture-only', cohort_observations: 2, dependency_groups: 1,
    request: {gravity_g: gravity}, gravity_note: '0 g denotes nominal microgravity.', limitations: ['Software fixture only.'],
    outputs: {spread_mm_s: {unit: 'mm/s', observations,
      by_gravity: [{gravity_g: 0, observations: 1, reviewed: 0}, {gravity_g: 1, observations: 1, reviewed: 0}],
      fold_preview: gravity == null ? null : {gravity_g: gravity, held_out_n: 1, remaining_before_group_exclusion: 1,
        related_rows_removed: 1, remaining_training_n: 0, remaining_gravity_levels: [], excluded_groups: ['shared-software-campaign'],
        data_split_eligible: false, validation_allowed: false, reasons: ['1 observation shares a dependency group with the held-out rows and must also be excluded.']},
    }}};
}

test('exploratory gravity inspection expands real-evidence UI without enabling validation or clearing predictions', async ({page}) => {
  const panel = await setup(page, {...empty, observations: 70, unreviewed_observations: 70, exploratory_cohorts: loaded.cohorts});
  const evidenceRequests: number[] = [];
  await page.route('**/api/ood/evidence', async route => {
    const gravity = route.request().postDataJSON().gravity_g;
    if (gravity != null) evidenceRequests.push(gravity);
    await route.fulfill({json: evidenceReport(gravity)});
  });
  await page.route('**/api/ood/predict', async route => route.fulfill({json: {...prediction(1.234, 21), data_mode: 'exploratory'}}));
  await panel.getByRole('checkbox', {name: 'Use extracted observations for exploratory estimates'}).check();
  await panel.getByRole('button', {name: 'Estimate supported properties'}).click();
  await expect(panel.locator('.ood-estimate-value')).toContainText('1.23');
  await panel.getByLabel('Gravity to hold out').selectOption('0');
  const evidence = panel.locator('.ood-evidence');
  await expect(evidence).toHaveAttribute('open', '');
  await expect(evidence.getByRole('heading', {name: 'What happens if 0 g is held out?'})).toBeVisible();
  await expect(evidence.getByRole('table')).toBeVisible();
  await expect(evidence.getByText('software-fixture-micro', {exact: true})).toBeVisible();
  await expect(evidence.getByText('software-fixture-ground', {exact: true})).toHaveCount(0);
  await expect(evidence.locator('.ood-evidence-chart .recharts-wrapper > svg.recharts-surface')).toHaveCount(1);
  await expect(evidence.getByText(/observation shares a dependency group/)).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Compare held-out predictions'})).toBeDisabled();
  await expect(panel.locator('.ood-estimate-value')).toContainText('1.23');
  await panel.getByLabel('Gravity to hold out').selectOption('1');
  await expect(evidence.getByRole('heading', {name: 'What happens if 1 g is held out?'})).toBeVisible();
  await expect(evidence.getByText('software-fixture-ground', {exact: true})).toBeVisible();
  await expect(evidence.getByText('software-fixture-micro', {exact: true})).toHaveCount(0);
  expect(evidenceRequests).toEqual([0, 1]);
  const downloadEvent = page.waitForEvent('download');
  await evidence.getByRole('button', {name: 'Export observed evidence'}).click();
  const stream = await (await downloadEvent).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.model_fitted).toBe(false);
  expect(exported.dataset_sha256).toBe('software-fixture-only');
  expect(exported.request.gravity_g).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('material options distinguish estimates from observations-only and show recorded input ranges', async ({page}) => {
  const pmma = {...loaded.cohorts[0], fuel: 'Cast clear PMMA', configuration: 'Software fixture: 0.5 mm rod',
    observed_ranges: {oxygen_pct: [21,21], pressure_kpa: [101.325,101.325], airflow_cm_s: [0,25]}};
  const sibal = {...loaded.cohorts[0], fuel: 'SIBAL', configuration: 'Software fixture: 406 mm sheet',
    coverage: {spread_mm_s: {observations: 1, gravity_levels: [0], prediction_eligible: false,
      folds: [{gravity_g: 0, eligible: false, training_n: 0, test_n: 1}]},
      length_mm: {observations: 0, gravity_levels: [], prediction_eligible: false, folds: []}}};
  const panel = await setup(page, {...empty, observations: 91, unreviewed_observations: 91, exploratory_cohorts: [pmma, sibal]});
  await page.route('**/api/ood/evidence', async route => {
    const report = evidenceReport(null);
    report.cohort_observations = 1;
    report.outputs.spread_mm_s.observations = report.outputs.spread_mm_s.observations.slice(0,1);
    report.outputs.spread_mm_s.by_gravity = report.outputs.spread_mm_s.by_gravity.slice(0,1);
    await route.fulfill({json: report});
  });
  await panel.getByRole('checkbox', {name: 'Use extracted observations for exploratory estimates'}).check();
  const materials = panel.getByLabel('Fuel / experimental configuration');
  await expect(materials.locator('option[value="0"]')).toContainText('estimates available');
  await expect(materials.locator('option[value="1"]')).toContainText('observations only');
  await expect(panel.getByText('Oxygen (%): 21 only', {exact: true})).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeEnabled();
  await materials.selectOption('1');
  await expect(panel.getByRole('button', {name: 'Estimate supported properties'})).toBeDisabled();
  await expect(panel.getByText(/Observations-only configuration: inspect its measurements below/)).toBeVisible();
  await expect(panel.locator('.ood-evidence').getByRole('table')).toBeVisible();
});

test('gravity response shows model bands, probes without refitting and flags unsupported airflow', async ({page}) => {
  const material = {...loaded.cohorts[0], coverage:{...coverage, length_mm:{...coverage.spread_mm_s,observations:4}}};
  const panel = await setup(page, {...empty,observations:70,unreviewed_observations:70,exploratory_cohorts:[material]});
  const requests: {property_name:string;airflow_cm_s:number}[] = [];
  await page.route('**/api/ood/gravity-sweep', async route => {
    const query = route.request().postDataJSON(); requests.push(query);
    const points = Array.from({length:1001},(_,i)=>({gravity_g:i/1000,median:2+2*i/1000,mean:2.05+2*i/1000,interval:[1.75+2*i/1000,2.25+2*i/1000]}));
    await route.fulfill({json:{status:'available',reason:null,unit:query.property_name==='length_mm'?'mm':'mm/s',points,
      training_n:5,dataset_sha256:'software-fixture-only',training_gravity_levels:[0,1],outside_features:query.airflow_cm_s===8?['airflow_cm_s']:[],
      observations:query.airflow_cm_s===8?[]:[{id:'software-ground',gravity_g:1,observed:4,source:'Synthetic software fixture',provenance:'ground',reviewed:false}],
      warning:'Synthetic software fixture; not experimental evidence.',interval_interpretation:'Uncalibrated model interval.',limitations:['No independent validation.']}});
  });
  await panel.getByRole('checkbox',{name:'Use extracted observations for exploratory estimates'}).check();
  const chart=panel.getByRole('region',{name:'Explore fire behaviour across gravity'});
  await expect(chart.locator('.ood-curve-value')).toContainText('2.76');
  await expect(chart.getByRole('button',{name:'Min. O₂ to burn',exact:true})).toBeDisabled();
  await expect(chart.getByText(/no compatible threshold observations/)).toBeVisible();
  await chart.getByRole('button',{name:'MOON 0.165',exact:true}).click();
  await expect(chart.locator('.ood-curve-value')).toContainText('2.33');
  await expect(chart.locator('.recharts-area-area')).toHaveCount(1);
  const plot=chart.locator('.ood-curve-chart .recharts-wrapper > svg.recharts-surface');
  await plot.click({position:{x:180,y:100}});
  await expect(chart.getByLabel('Probe gravity curve')).not.toHaveValue('0.165');
  expect(requests.length).toBe(1);
  await chart.getByRole('button',{name:'Fans 8 cm/s',exact:true}).click();
  await expect(panel.getByLabel('Airflow (cm/s)',{exact:true})).toHaveValue('8');
  await expect(chart.getByText('Outside recorded ranges: airflow_cm_s.',{exact:true})).toBeVisible();
  expect(requests.length).toBe(2);
  await chart.getByRole('button',{name:'Flame length',exact:true}).click();
  await expect.poll(()=>requests.at(-1)?.property_name).toBe('length_mm');
  await expect(chart.locator('.ood-curve-value')).toContainText('mm');
  const downloadEvent=page.waitForEvent('download');
  await chart.getByRole('button',{name:'Export model curve'}).click();
  const stream=await (await downloadEvent).createReadStream();const chunks=[];
  for await(const chunk of stream!) chunks.push(chunk);
  const report=JSON.parse(Buffer.concat(chunks).toString());
  expect(report.points).toHaveLength(1001);
  expect(report.dataset_sha256).toBe('software-fixture-only');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('SIBAL measured results remain visible without fitting or relabeling them as target-gravity predictions', async ({page}) => {
  const measuredCoverage = {observations: 1, gravity_levels: [0], prediction_eligible: false,
    folds: [{gravity_g: 0, eligible: false, training_n: 0, test_n: 1}]};
  const sibal = {...loaded.cohorts[0], fuel: 'Cotton-fiberglass (SIBAL)', configuration: 'Saffire I/II 406 mm sheet',
    coverage: {spread_mm_s: measuredCoverage, length_mm: measuredCoverage}};
  const panel = await setup(page, {...empty, observations: 1, unreviewed_observations: 1, exploratory_cohorts: [sibal]});
  let modelRequests = 0;
  page.on('request', request => {if (/\/api\/ood\/(predict|gravity-sweep)$/.test(new URL(request.url()).pathname)) modelRequests++;});
  const observation = {id: 'saffire-1-1', gravity_g: 0, oxygen_pct: 21.7, pressure_kpa: 101.325, airflow_cm_s: 20,
    temperature_k: null, observed: 1.8, measurement_sd: null, source: 'Saffire', citation: 'Source-linked Saffire measurement fixture',
    reviewed: false, provenance: 'microgravity', leakage_group: 'saffire-campaign'};
  const evidence = {status:'available', reason:null, dataset_sha256:'sibal-fixture', model_fitted:false,
    cohort_observations:1, dependency_groups:1, gravity_note:'Nominal ISS microgravity.', limitations:[],
    outputs:{spread_mm_s:{unit:'mm/s',observations:[observation],fold_preview:null,
      by_gravity:[{gravity_g:0,observations:1,reviewed:0}]},
      length_mm:{unit:'mm',observations:[{...observation,observed:40}],fold_preview:null,
        by_gravity:[{gravity_g:0,observations:1,reviewed:0}]}}};
  await page.route('**/api/ood/evidence', route => route.fulfill({json:evidence}));
  await panel.getByRole('checkbox', {name:'Use extracted observations for exploratory estimates'}).check();
  const measured = panel.getByRole('region', {name:'Measured results · not predictions'});
  await expect(measured.getByRole('article', {name:'Measured Flame-spread velocity'}).locator('.ood-estimate-value')).toHaveText('1.8 mm/s');
  await expect(measured.getByRole('article', {name:'Measured Flame length'}).locator('.ood-estimate-value')).toHaveText('40 mm');
  await expect(measured.getByText('0 g · 21.7% O₂ · 101.3 kPa · 20 cm/s')).toHaveCount(2);
  await expect(panel.getByRole('button', {name:'Estimate supported properties'})).toBeDisabled();
  await expect(panel.getByRole('region', {name:'Explore fire behaviour across gravity'})).toHaveCount(0);
  await panel.getByRole('slider', {name:'Gravitational acceleration'}).fill('0.165');
  await panel.getByLabel('Oxygen (%)').fill('30');
  await expect(measured.getByText('0 g · 21.7% O₂ · 101.3 kPa · 20 cm/s')).toHaveCount(2);
  await expect(measured.getByText(/Transcription pending scientific review/)).toHaveCount(2);
  await measured.getByText('Source · saffire-1-1', {exact:true}).first().click();
  await expect(measured.getByText('Source-linked Saffire measurement fixture').first()).toBeVisible();
  await expect(panel.locator('.ood-evidence')).toHaveCount(1);
  const downloadEvent = page.waitForEvent('download');
  await panel.getByRole('button', {name:'Export observed evidence'}).click();
  const stream = await (await downloadEvent).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(evidence);
  expect(modelRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
