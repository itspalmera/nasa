"""Reproduce 20 manually digitized experimental markers from two local PDFs.

Marker centers and tick anchors below were read from the embedded raster figures,
not from interpolated connecting lines. PDF hashes pin the source and image
geometry; nearby-color checks catch obvious coordinate/series mistakes but are
not an independent scientific review. No repeated burn stages are split into
independent campaigns, and no measured uncertainty is invented.

Run: python scripts/extract_confined_observations.py [manifest.json]
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FUEL = 'Cotton-fiberglass (SIBAL)'
GROUP = 'ISS-Confined-Combustion-SIBAL-campaign'
METHOD = 'Manual raster marker-center digitization; source-pinned native image and linear tick calibration; no intermediate curve samples.'
SOURCES = [
    {
        'source_file': 'Effects of Confinement on Flame Spread in Microgravity.pdf',
        'source_sha256': '3096713e1da5122b0d06235a0194ecc2ccaa0fac0df40d11095241401bfb916a',
        'source': 'ICES-2020-407', 'pdf_page': 8, 'figure': '7a',
        'image_xref': 74, 'image_size': [944, 783],
        'x_anchors': [[125, 0], [910, 8]],
        'y_anchors': [[671, .05], [38, .25]],
        'x_unit': 'inter-baffle distance D, cm', 'y_unit': 'cm/s',
        'citation': 'Y. Li, Y.-T. T. Liao, P. V. Ferkul, M. C. Johnston and C. Bunnell (2020), ICES-2020-407, Fig. 7a, PDF p8; geometry p3; nominal atmosphere p4; measurement definition p6.',
        'series': [
            {'baffle': 'black anodized aluminum', 'color': 'black', 'points': [
                [2, 321, 568], [4, 518, 212], [5, 616, 262]]},
            {'baffle': 'reflective polished aluminum', 'color': 'red', 'points': [
                [2, 321, 575], [4, 518, 147], [5, 616, 212]]},
            {'baffle': 'transparent polycarbonate', 'color': 'blue', 'points': [
                [2, 321, 526], [4, 518, 279], [5, 616, 313]]},
        ],
        'exclusions': ['Three overlapping markers at D=3 cm omitted to avoid ambiguous manual readings.',
                       'The no-baffle point and quench-limit indicator are not exported.',
                       'Figure 7b is a second output of the same conditions, not additional independent observations.'],
    },
    {
        'source_file': 'Effects of Confinement on Opposed-Flow Flame Spread over Cellulose.pdf',
        'source_sha256': '33e95f76b1d149a6a67075900c30cb3f1585bff525ff7e8652e12fecf222063c',
        'source': '10.1007/s12217-024-10106-y', 'pdf_page': 9, 'figure': '13',
        'image_xref': 51, 'image_size': [904, 782],
        'x_anchors': [[184, 6], [889, 11]],
        'y_anchors': [[664, .9], [38, 1.4]],
        'x_unit': 'imposed opposed-flow speed, cm/s', 'y_unit': 'mm/s',
        'citation': 'A. Sharma et al. (2024), Effects of Confinement on Opposed-Flow Flame Spread over Cellulose, Microgravity Science and Technology 36:20, DOI 10.1007/s12217-024-10106-y, Fig. 13, PDF p9; atmosphere/material p3; assembly p4; Table 1 and stepped-flow protocol p5.',
        'series': [
            {'baffle': 'black anodized aluminum', 'color': 'black', 'sample_baffle_cm': 2, 'points': [
                [7.3, 367, 238], [10.3, 791, 214]]},
            {'baffle': 'black anodized aluminum', 'color': 'black', 'sample_baffle_cm': 1.5, 'points': [
                [6.1, 198, 376], [7.3, 367, 301], [10.3, 791, 225]]},
            {'baffle': 'transparent polycarbonate', 'color': 'red', 'sample_baffle_cm': 1.5, 'points': [
                [6.1, 198, 438], [7.3, 367, 400], [10.3, 791, 363]]},
            {'baffle': 'transparent polycarbonate', 'color': 'red', 'sample_baffle_cm': 1, 'points': [
                [7.4, 380, 513], [8.8, 584, 438], [10.5, 814, 513]]},
        ],
        'exclusions': ['Figures 11, 12 and 14 repeat these observations or add literature data; none is counted again.',
                       'PMMA and extinction points in other figures are not part of this extraction.'],
    },
]


def calibrated(pixel, anchors):
    (p0, v0), (p1, v1) = anchors
    return v0 + (pixel - p0) * (v1 - v0) / (p1 - p0)


def check_marker(pixmap, x, y, color):
    """Only a sanity check: marker centers were selected by manual inspection."""
    count = 0
    for py in range(y - 11, y + 12):
        for px in range(x - 11, x + 12):
            red, green, blue = pixmap.pixel(px, py)[:3]
            matched = (max(red, green, blue) < 100 if color == 'black' else
                       red > 180 and green < 130 and blue < 130 if color == 'red' else
                       blue > 180 and red < 140 and green < 140)
            count += bool(matched)
    if count < 25:
        raise ValueError(f'Expected {color} marker near native image pixel ({x}, {y})')


def extract_confined_observations(papers=ROOT / 'papers'):
    import pymupdf
    observations, records, charts = [], [], []
    common_notes = [
        'Digitized published experimental markers, not raw independent run records.',
        'Oxygen is nominally 22%; the sources report daily variation from 21.3% to 22.9%. Per-point oxygen readings were not recovered.',
        'Pressure is explicitly 1 atm, converted to 101.325 kPa. Temperature is not imputed.',
        'Airflow is the reported imposed/section-average speed, not a corrected local near-flame velocity.',
        '0 g is a nominal ISS microgravity coordinate, not a measurement of zero residual acceleration.',
        'Values rounded to 0.01 mm/s reflect digitization resolution, not measurement standard deviation.',
        'All rows share a conservative Confined Combustion campaign dependency group; no independent validation is implied.',
        'These configurations only contain microgravity observations; they do not enable fitting a gravity-generalization model.',
    ]
    for spec in SOURCES:
        path = papers / spec['source_file']
        if hashlib.sha256(path.read_bytes()).hexdigest() != spec['source_sha256']:
            raise ValueError(f'Source PDF changed: {spec["source_file"]}; recheck marker centers and axes')
        with pymupdf.open(path) as doc:
            page = doc[spec['pdf_page'] - 1]
            if spec['image_xref'] not in {im[0] for im in page.get_images()}:
                raise ValueError('Pinned image is not on the expected source page')
            pixmap = pymupdf.Pixmap(doc, spec['image_xref'])
            if [pixmap.width, pixmap.height] != spec['image_size'] or pixmap.n != 3:
                raise ValueError('Pinned source image dimensions or color space changed')
            chart_points = []
            for series in spec['series']:
                for setting, x, y in series['points']:
                    check_marker(pixmap, x, y, series['color'])
                    digitized_x = calibrated(x, spec['x_anchors'])
                    # Table 1 flow settings are reported to 0.1 cm/s; keep those values.
                    tolerance = .03 if spec['x_unit'].startswith('inter-baffle') else .06
                    if abs(setting - digitized_x) > tolerance:
                        raise ValueError('Marker x-coordinate disagrees with stated geometry/flow setting')
                    speed = calibrated(y, spec['y_anchors']) * (10 if spec['y_unit'] == 'cm/s' else 1)
                    speed = round(speed, 2)
                    concurrent = spec['source'] == 'ICES-2020-407'
                    distance = setting if concurrent else 2 * series['sample_baffle_cm']
                    flow = 7 if concurrent else setting
                    slug = 'black' if series['color'] == 'black' else 'reflective' if concurrent and series['color'] == 'red' else 'transparent'
                    prefix = 'li2020-fig7a' if concurrent else 'sharma2024-fig13'
                    identifier = f'{prefix}-{slug}-D{distance:g}cm-flow{flow:g}'
                    configuration = (f'{spec["source"]}; {"concurrent" if concurrent else "opposed"} flow; '
                                     f'double-sided SIBAL; exposed sheet 22x100 mm; {series["baffle"]} baffles; '
                                     f'inter-baffle distance D={distance:g} cm' + ('' if concurrent else '; thickness 0.33 mm'))
                    citation = f'{spec["citation"]} Baffles: {series["baffle"]}; D={distance:g} cm; flow={flow:g} cm/s; digitized experimental marker.'
                    conditions = dict(gravity_g=0.0, oxygen_pct=22.0, pressure_kpa=101.325,
                                      airflow_cm_s=flow, fuel=FUEL, configuration=configuration, temperature_k=None)
                    notes = common_notes + ([
                        'Spread rate is the slope measured over the middle sample region (4–7 cm); Fig. 7 error bars are 95% confidence intervals and are not converted to sigma.'
                    ] if concurrent else [
                        'Flow is changed in steps within a burn, with about 20 s allowed at each setting for SIBAL; stages are not independent experiments.',
                        'The paper lists an exposed width of 22 mm in its methods but uses 21 mm for present-work labels in Fig. 14; the methods value is retained and this discrepancy requires review.'
                    ])
                    outputs = {'spread_mm_s': speed}
                    observations.append(conditions | dict(experiment_id=identifier, source=spec['source'], citation=citation,
                        leakage_group=GROUP, provenance='microgravity', reviewed=False, outputs=outputs, uncertainty={}))
                    point = dict(id=identifier, native_marker_pixel=[x, y], reported_x=setting,
                                 calibrated_x=digitized_x, spread_mm_s=speed, baffle=series['baffle'])
                    chart_points.append(point)
                    records.append(dict(id=identifier, source_file=spec['source_file'], source_sha256=spec['source_sha256'],
                        pdf_pages=[3, 4, 6, 7, 8] if concurrent else [3, 4, 5, 9],
                        location=f'Fig. {spec["figure"]}; {series["baffle"]}; D={distance:g} cm; flow={flow:g} cm/s',
                        evidence_role='primary_experiment_plot' if concurrent else 'primary_experiment_flow_stage',
                        conditions=conditions, outputs=outputs, transcribed_cells=point,
                        extraction_method=METHOD, flags=['raster_digitized', 'nominal_oxygen_condition', 'nominal_microgravity_coordinate',
                            'campaign_dependency_preserved'] + ([] if concurrent else ['within_burn_flow_stage', 'source_width_discrepancy']),
                        notes=notes, review_status='pending_scientific_review', exported_observation_id=identifier, missing_required_inputs=[]))
            charts.append({key: value for key, value in spec.items() if key != 'series'} | {'points': chart_points})
    return dict(version='confined-raster-v1', method=METHOD, value_rounding_mm_s=.01, measurement_sd=None,
                charts=charts, observations=observations, records=records)


if __name__ == '__main__':
    output = json.dumps(extract_confined_observations(), indent=2, ensure_ascii=False) + '\n'
    if len(sys.argv) == 2:
        Path(sys.argv[1]).write_text(output, encoding='utf-8')
    else:
        print(output, end='')
