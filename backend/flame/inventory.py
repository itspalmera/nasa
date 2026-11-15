import json
from pathlib import Path
from .config import ROOT

def write_inventory(store):
    docs = store.documents()
    with store.connect() as db:
        files = [dict(r) for r in db.execute('SELECT * FROM files ORDER BY source_file')]
    chunks = sum(d['chunks'] for d in docs)
    lines = ['# Corpus inventory', '', 'Generated from local ingestion records. No missing bibliographic metadata is inferred from file timestamps, filenames, reference lists, or PDF author properties.', '',
             f'{len(files)} source files; {len(docs)} unique documents; {chunks} indexed chunks; {sum(d["page_count"] for d in docs)} PDF pages.', '',
             f'Exact-byte duplicate files: {sum(f["status"] == "duplicate" for f in files)}. Failed files: {sum(f["status"] == "failed" for f in files)}.', '',
             '## Repository audit', '', 'The initial repository contained only Git metadata and 19 PDFs in `papers/`. No application code, AGENTS.md, or existing functionality was found. Original PDFs were preserved.', '',
             '## Document inventory', '', '| File | Title | Authors | Year | DOI | Experiment mention | Topic | Institution | Pages / chunks | Extraction | Metadata completeness | Relevance |', '|---|---|---|---|---|---|---|---|---|---|---|---|']
    def cell(v):
        if v is None or v == []: return 'Unavailable'
        if isinstance(v, list): v = '; '.join(v)
        return str(v).replace('|', '\\|').replace('\n', ' ')
    for d in docs:
        m = d['metadata']
        fields = ['title','authors','publication_year','doi','experiment','research_category','source_institution']
        completeness = f'{sum(bool(m.get(k)) for k in fields)}/{len(fields)} populated; review pending'
        relevant = 'Relevant to microgravity combustion; full-text evidence available' if d['chunks'] else 'Potential relevance from filename only; content unverified'
        row = [d['source_file'],m['title'],m['authors'],m['publication_year'],m['doi'],m['experiment'],m['research_category'],m['source_institution'],f'{d["page_count"]} / {d["chunks"]}',d['status'],completeness,relevant]
        lines.append('| ' + ' | '.join(cell(v) for v in row) + ' |')
    lines += ['', '## Extraction warnings', '', 'Low-text pages may be image-only, embedded media, or blank slides. No OCR was generated. Existing OCR text is retained with an accuracy warning. PDF page numbers include covers.', '']
    for d in docs:
        if d['warnings']:
            lines += [f'### {d["source_file"]}', ''] + ['- ' + w for w in d['warnings']] + ['']
    for f in files:
        if not f['document_id']:
            lines += [f'- {f["source_file"]}: ' + '; '.join(json.loads(f['warnings']))]
    doi_groups = {}
    for d in docs:
        if d['metadata'].get('doi'):
            doi_groups.setdefault(d['metadata']['doi'].lower(), []).append(d['source_file'])
    duplicate_dois = {doi: names for doi, names in doi_groups.items() if len(names)>1}
    lines += ['', '## Potential duplicate publications by DOI', '']
    lines += [f'- {doi}: ' + '; '.join(names) for doi, names in duplicate_dois.items()] if duplicate_dois else ['No repeated non-null DOI found in the extracted metadata. Missing DOI values prevent a complete publication-level duplicate audit.']
    lines += ['', '## Metadata provenance', '', 'Human-curated candidates are stored in `docs/curated_metadata.json`. Every populated override is accepted only when its exact quote occurs on the cited page. Bibliographic verification remains pending. Partial author lists are not promoted to complete lists. Numeric conditions are populated only where explicitly reported and are not parsed into synthetic measurement datasets.', '',
              'Automatic experiment and category tags refer to mentions in the first two pages. A mention is not proof that the experiment was performed by that paper. Missing gravity/fuel/oxygen/pressure values stay null. No FLEX or ACME results are synthesized merely to fill comparison cards.', '',
              '## Challenge verification', '', 'Requested URL: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/?tab=details', '', 'On 2026-11-13 the HTTPS proxy returned 403 CONNECT denial for this domain. The official challenge description was not read. Challenge existence, exact 2026 requirements, eligibility, judging criteria, data-use constraints, and submission format remain unverified. Scope follows the supplied brief and local corpus only.', '']
    path = ROOT / 'docs' / 'corpus_inventory.md'
    path.write_text('\n'.join(lines))
    print(path)
