"""Source-pinned adapter for the 20 plotted PMMA measurements in Figure 4.

Extracts only filled marker centers coincident with cubic-path endpoints,
never intermediate points along fitted/smoothed curves or error-bar endpoints.
The PDF reports each plotted value as an average of two repeated experiments.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILE = 'Flame spread over thin circular PMMA rods.pdf'
SHA256 = '5f51872600024b38360fc6f1356bf99508133a2c530e3b7a9c54e13da2b23862'


def extract_figure4(papers=ROOT/'papers'):
    import pymupdf
    path = papers/FILE
    if hashlib.sha256(path.read_bytes()).hexdigest() != SHA256:
        raise ValueError('This adapter is pinned to the inspected PMMA PDF; recheck the axes and marker mapping for any changed source')
    with pymupdf.open(path) as doc:
        page = doc[6]
        drawings = page.get_drawings()
        text = page.get_text()
        if not all(label in text for label in ('1 mm 1g', '1 mm 0g', '0.5 mm 1g', '0.5 mm 0g')):
            raise ValueError('Expected Figure 4 legend not found')
        x0, x25 = drawings[3]['rect'].x0, drawings[3]['rect'].x1
        y4, y0 = drawings[1]['rect'].y0, drawings[1]['rect'].y1
        series = []
        for diameter, gravity, path_index, marker_indices in [
            (1, 1, 31, list(range(32, 38))), (1, 0, 38, list(range(39, 45))),
            (.5, 1, 45, list(range(46, 50))), (.5, 0, 50, list(range(51, 55))),
        ]:
            curve = drawings[path_index]['items']
            if not all(item[0] == 'c' for item in curve):
                raise ValueError('Expected vector curve not found')
            points = [curve[0][1]] + [item[4] for item in curve]
            if len(points) != len(marker_indices):
                raise ValueError('Curve knots and marker counts disagree')
            values = []
            for point, marker_index in zip(points, marker_indices):
                rect = drawings[marker_index]['rect']
                center = pymupdf.Point((rect.x0+rect.x1)/2, (rect.y0+rect.y1)/2)
                # 0.15 PDF points is an alignment check, not measurement uncertainty.
                if abs(point.x-center.x) > .15 or abs(point.y-center.y) > .15:
                    raise ValueError('Curve endpoint does not coincide with its experimental marker')
                flow = (point.x-x0)*25/(x25-x0)
                labeled_flow = min([0,5,10,15,20,25], key=lambda value: abs(value-flow))
                if abs(flow-labeled_flow) > .02:
                    raise ValueError('Marker is not at an expected labeled flow setting')
                rate = (y0-center.y)*4/(y0-y4)
                values.append({'airflow_cm_s': labeled_flow, 'spread_mm_s': round(rate, 2),
                               'endpoint_pdf_points': [round(point.x, 6), round(point.y, 6)],
                               'marker_center_pdf_points': [round(center.x, 6), round(center.y, 6)],
                               'marker_drawing_index': marker_index})
            series.append({'diameter_mm': diameter, 'gravity_g': gravity,
                           'curve_drawing_index': path_index, 'points': values})
    return {
        'version': 'pmma-figure4-v1', 'source_file': FILE, 'source_sha256': SHA256, 'pdf_page': 7,
        'axis_anchors_pdf_points': {'x_0_cm_s': x0, 'x_25_cm_s': x25, 'y_0_mm_s': y0, 'y_4_mm_s': y4},
        'method': 'Filled experimental marker centers checked against vector curve knots and calibrated using labeled linear axes.',
        'value_rounding_mm_s': .01,
        'measurement_sd': None,
        'limitations': ['Digitized plotted averages, not original per-run raw measurements.',
                       'Each plotted point averages two repeats; repeats are not exported as separate invented rows.',
                       'Reading/rounding resolution is not a measured standard deviation. Error-bar meaning is not established here.',
                       '0 g is the figure nominal microgravity coordinate, not an accelerometer measurement.',
                       'Publication metadata and scientific applicability remain pending review.'],
        'series': series,
    }


if __name__ == '__main__':
    result = extract_figure4()
    text = json.dumps(result, indent=2) + '\n'
    if len(sys.argv) == 2:
        Path(sys.argv[1]).write_text(text, encoding='utf-8')
    else:
        print(text, end='')
