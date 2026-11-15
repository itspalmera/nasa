"""Export local/public PDF source material to page-linked JSON for review.

This is not an experimental observation dataset. It never marks measurements
reviewed, infers missing physical conditions or changes the OOD training file.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import os
import re
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MAX_PDF_BYTES = 32 * 1024 * 1024


def download_public_pdf(url, destination):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Use a public HTTPS PDF link without embedded credentials')
    with urlopen(Request(url, headers={'User-Agent':'Flame-Research-Source-Extraction/1.0'}), timeout=30) as response:
        if urlparse(response.geturl()).scheme != 'https':
            raise ValueError('Only HTTPS downloads are accepted')
        content = bytearray()
        while block := response.read(1024 * 1024):
            content.extend(block)
            if len(content) > MAX_PDF_BYTES:
                raise ValueError('PDF exceeds the 32 MiB download limit')
    if not content.startswith(b'%PDF-'):
        raise ValueError('The URL did not return a PDF; use a public direct PDF URL, not an abstract/login/paywall page')
    digest = hashlib.sha256(content).hexdigest()
    destination.mkdir(parents=True, exist_ok=True)
    path = destination/f'{digest}.pdf'
    if not path.exists():
        path.write_bytes(content)
    return path


def extract_pdf(path, *, source_url=None, include_tables=False):
    import pymupdf
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    pages, warnings = [], []
    with pymupdf.open(path) as document:
        if document.needs_pass:
            raise ValueError('Encrypted PDF requires authorized local decryption before extraction')
        for index, page in enumerate(document):
            text = page.get_text(sort=True)
            tables = []
            scan_tables = include_tables and bool(re.search(r'\btable\s+[a-z0-9]+', text, re.IGNORECASE))
            if scan_tables:
                # Preserve exact native positions instead of guessing a table grid.
                # Multi-column/cell interpretation belongs in reviewed adapters.
                words = page.get_text('words')
                tables.append({'bbox_pdf_points':list(page.rect), 'cells':[],
                               'native_words':[{'bbox_pdf_points':list(word[:4]), 'text':word[4],
                                                'block':word[5], 'line':word[6], 'word':word[7]} for word in words],
                               'method':'caption-guided native word layout; table grid not inferred', 'reviewed':False})
            pages.append({'pdf_page':index+1, 'text':text, 'tables':tables, 'table_scan':'caption_guided_native_layout' if scan_tables else 'not_scanned', 'requires_ocr':not bool(text.strip())})
        metadata = {key:document.metadata.get(key) for key in ['title','author','subject']}
    return {'filename':path.name,'source_url':source_url,'sha256':digest,'metadata':metadata,'pages':pages,
            'warnings':warnings,'reviewed':False,
            'limitations':['Caption-bearing pages retain native word positions as unsegmented table candidates. Cell grids are not guessed; uncaptioned/image tables require separate review.',
                           'OCR and graph digitization require separate source-specific checks.',
                           'A document may repeat another experiment or contain simulations, previews or planned tests.',
                           'This source JSON does not establish independent runs, physical compatibility or model validation.']}


def export_papers(papers_dir, output, *, urls=(), include_tables=False):
    paths = [(path,None) for path in sorted(papers_dir.glob('*.pdf'))]
    failures = []
    for url in urls:
        try:
            paths.append((download_public_pdf(url, output.parent/'downloaded-papers'),url))
        except Exception as error:
            failures.append({'source_url':url,'stage':'download','error':str(error)})
    documents, duplicates, seen = [], [], set()
    for path, url in paths:
        try:
            extracted = extract_pdf(path, source_url=url, include_tables=include_tables)
            if extracted['sha256'] in seen:
                duplicates.append({'filename':path.name,'sha256':extracted['sha256'],'source_url':url})
            else:
                documents.append(extracted); seen.add(extracted['sha256'])
        except Exception as error:
            failures.append({'filename':path.name,'source_url':url,'stage':'extract','error':str(error)})
    report = {'schema_version':1,'extraction_version':'source-material-v1','is_training_dataset':False,
              'documents':documents,'duplicate_files':duplicates,'failures':failures,
              'training_observations':[],
              'notice':'Unreviewed source material only. Use source-linked experimental adapters and scientific review before importing training observations.'}
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=output.parent,delete=False,suffix='.tmp') as stream:
            temporary=Path(stream.name); json.dump(report,stream,ensure_ascii=False,indent=2);stream.write('\n')
        os.replace(temporary,output)
    finally:
        if temporary and temporary.exists():temporary.unlink()
    return {'output':str(output),'documents':len(documents),'pages':sum(len(d['pages']) for d in documents),
            'table_candidate_pages':sum(len(page['tables']) for d in documents for page in d['pages']),
            'ocr_pages':sum(page['requires_ocr'] for d in documents for page in d['pages']),
            'duplicate_files':len(duplicates),'failures':len(failures),'training_observations_added':0}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--papers-dir',type=Path,default=ROOT/'papers')
    parser.add_argument('--output',type=Path,default=ROOT/'data'/'paper-source-extractions.json')
    parser.add_argument('--include-tables',action='store_true')
    parser.add_argument('--url',action='append',default=[],help='Public direct HTTPS PDF URL; repeat to download more sources')
    args=parser.parse_args()
    print(json.dumps(export_papers(args.papers_dir,args.output,urls=args.url,include_tables=args.include_tables),indent=2))
