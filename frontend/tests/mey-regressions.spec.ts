import {test, expect} from '@playwright/test';
const records = [
  {id:'bass', acronym:'BASS', name:'Burning and Suppression of Solids', objectives:'BASS-specific objective', fuels:['PMMA'], findings:[{text:'BASS-specific finding', source:'bass-source'}], gravity:0, o2:{min:17,max:21}, pressure:{min:101.3,max:101.3}, flow:{min:1,max:40}},
  {id:'scem', acronym:'SCEM', name:'Cellulose study', objectives:'Cellulose-specific objective', fuels:['cellulose'], findings:[{text:'Cellulose-specific finding',source:'cellulose-source'}], gravity:0, o2:{min:17.5,max:21.1}, pressure:{min:101.3,max:101.3}, flow:{min:1,max:5}},
];
const coverage={spread_mm_s:{observations:12, gravity_levels:[0,1],prediction_eligible:true,folds:[]}};
const cohort={fuel:'Kimwipes cellulose tissue (99% cellulose, 1% polyamide)',configuration:'NASA-TM-100195; quiescent; downward/opposed spread; 30x150 mm sheet; thickness 0.076 mm',temperature_available:false,coverage};
test.beforeEach(async ({page}) => {
  await page.route('**/api/**', async route => {
    const path=new URL(route.request().url()).pathname;
    let data: unknown={};
    if(path==='/api/investigations') data=records;
    if(path==='/api/motor1/match') data={ranking:records.map((entry,i)=>({...entry,investigation_id:entry.id,relevance_score:90-i*10,match_breakdown:{o2_match_pct:90,pressure_match_pct:80,flow_match_pct:70,gravity_match_pct:60}}))};
    if(path.startsWith('/api/motor3/intra/')) {const record=records.find(x=>path.endsWith(x.id))!;data={...record,fixed_conditions:[{variable:'gravity',min:0,max:0,unit:'g',label:'Fixed'}],iterated_variables:[{variable:'o2',min:record.o2.min,max:record.o2.max,unit:'%',label:'Changed'}],unreported_variables:[],diagnostics_used:[],measured_outcomes:record.findings};}
    if(path.startsWith('/api/motor3/chart/')) {
      const record=records.find(item=>path.endsWith(item.id))!;
      data={investigation_id:record.id,acronym:record.acronym,ranges:[
        {variable:'o2',unit:'%',...record.o2,note:null,basis:'medido'},
        {variable:'pressure',unit:'kPa',...record.pressure,note:null,basis:'medido'},
        {variable:'flow',unit:'cm/s',...record.flow,note:null,basis:'medido'},
        {variable:'gravity',unit:'g',min:0,max:0,note:null,basis:'medido'},
      ],observations:record.id==='scem'?[{experiment_id:'scem-row',fuel:'cellulose',configuration:'SCEM measured sample',gravity_g:0,oxygen_pct:21,pressure_kpa:101.3,airflow_cm_s:5,outputs:{spread_mm_s:0.8},citation:'SCEM paper, page 7',reviewed:false}]:[],
      outputs:record.id==='scem'?{spread_mm_s:'mm/s'}:{},sources:[{id:record.id,title:record.name,url:null}]};
    }
    if(path==='/api/ood/status')data={reason:null,reviewed_direct_observations:0,unreviewed_observations:12,dependencies_ready:true,cohorts:[],exploratory_cohorts:[cohort,{...cohort,configuration:'not executable',coverage:{spread_mm_s:{...coverage.spread_mm_s,prediction_eligible:false}}}],provenance_counts:{},dataset_sha256:'test'};
    if(path==='/api/ood/evidence')data={status:'available',reason:null,cohort_observations:12,dependency_groups:2,outputs:{},limitations:[]};
    if(path==='/api/ood/predict')data={status:'available',reason:null,data_mode:'exploratory',model:'gpr',results:{spread_mm_s:{unit:'mm/s',mean:1.2,training_n:12,gravity_position:'interpolation',sources:['NASA-TM-100195']}},request:route.request().postDataJSON()};
    await route.fulfill({json:data});
  });
});
test('cellulose is selectable and exploratory prediction preserves scientific request fields', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/3[. ]+Predecir y preguntar/}).click();
  await expect(page.getByRole('heading',{name:'Explora un experimento en 3 pasos'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Celulosa \(papel/})).toHaveAttribute('aria-pressed','true');
  const experiment=page.getByLabel('Experimento disponible');
  await expect(experiment.locator('option')).toHaveCount(1);
  await expect(experiment).toContainText('0,076 mm');
  const estimate=page.getByRole('button',{name:'Estimar propiedades disponibles'});
  await expect(estimate).toBeDisabled();
  await page.getByLabel('Usar observaciones extraídas para estimaciones exploratorias').check();
  await expect(estimate).toBeEnabled();
  const request=page.waitForRequest(r=>r.url().endsWith('/api/ood/predict'));
  await estimate.click();
  expect((await request).postDataJSON().fuel).toBe(cohort.fuel);
  await expect(page.getByRole('heading',{name:'Tu resultado'})).toBeVisible();
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('heading',{name:'Your result'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Estimate supported properties'})).toBeVisible();
  await expect(page.getByText('Flame-spread velocity',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'ES',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tu resultado'})).toBeVisible();
});
test('ranked investigation selection updates its analysis and comparison', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/2[. ]+Ranking y alertas/}).click();
  const select=page.getByLabel('Investigación',{exact:true});
  await expect(select).toHaveValue('bass');
  await expect(page.locator('blockquote').filter({hasText:'BASS-specific finding'})).toBeVisible();
  await page.getByRole('button',{name:/SCEM Cellulose study/}).click();
  await expect(select).toHaveValue('scem');
  await expect(page.locator('blockquote').filter({hasText:'Cellulose-specific finding'})).toBeVisible();
  await expect(page.locator('blockquote').filter({hasText:'BASS-specific finding'})).not.toBeVisible();
  await page.getByRole('button',{name:'Comparar investigaciones',exact:true}).click();
  await expect(page.getByText('Cellulose-specific objective',{exact:true}).last()).toBeVisible();
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Compare source records'})).toBeVisible();
  await page.getByRole('button',{name:'ES',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Comparar fichas de las fuentes'})).toBeVisible();
});
test('home copy and accessible language labels change in both directions',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Fire behaves differently where there is no up or down.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Configure my scenario'})).toBeVisible();
 await page.getByRole('button',{name:'ES',exact:true}).click();
 await expect(page.getByRole('button',{name:'Configurar mi escenario'})).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('lang','es');
});

test('each ranked paper displays its own chart and sourced measurements',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/2[. ]+Ranking y alertas/}).click();
  const chart=page.getByRole('region',{name:'Gráfico de la investigación'});
  await expect(chart).toHaveAttribute('data-investigation-id','bass');
  await expect(chart.getByRole('heading',{name:'Gráfico del paper · BASS',exact:true})).toBeVisible();
  await expect(chart.getByRole('img',{name:/Oxígeno: 17 – 21 %/})).toBeVisible();
  await expect(chart.getByText(/El conjunto disponible no tiene mediciones numéricas/)).toBeVisible();
  await page.getByRole('button',{name:/SCEM Cellulose study/}).click();
  await expect(chart).toHaveAttribute('data-investigation-id','scem');
  await expect(chart.getByRole('heading',{name:'Gráfico del paper · SCEM',exact:true})).toBeVisible();
  await expect(chart.getByRole('img',{name:/Oxígeno: 17,5 – 21,1 %/})).toBeVisible();
  await expect(chart.getByLabel('Configuración experimental')).toHaveValue('SCEM measured sample');
  await chart.getByText('Mediciones y citas').click();
  await expect(chart.getByText('SCEM paper, page 7')).toBeVisible();
  await expect(chart.getByText('0,8 mm/s',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'EN',exact:true}).click();
  const englishChart=page.getByRole('region',{name:'Investigation chart'});
  await expect(englishChart.getByRole('heading',{name:'Paper chart · SCEM',exact:true})).toBeVisible();
  await expect(englishChart.getByLabel('Horizontal axis')).toBeVisible();
  await englishChart.getByLabel('Horizontal axis').selectOption('airflow_cm_s');
  await expect(englishChart.getByLabel('Horizontal axis')).toHaveValue('airflow_cm_s');
  await page.getByRole('button',{name:/BASS.*Burning and Suppression/}).click();
  await expect(englishChart).toHaveAttribute('data-investigation-id','bass');
  await expect(englishChart.getByRole('heading',{name:'Paper chart · BASS',exact:true})).toBeVisible();
  await expect(englishChart.getByText('SCEM paper, page 7')).toHaveCount(0);
});
