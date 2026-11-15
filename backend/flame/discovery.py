"""Manual Consensus CSV/JSON imports; never scrapes or assumes API entitlement."""
import csv
import hashlib
import io
import json
import re
from .models import DiscoveryRecord

def normalize_doi(doi):
    return re.sub(r'^(https?://(dx\.)?doi\.org/|doi:\s*)', '', (doi or '').strip(), flags=re.I).lower().rstrip(' .')

def import_records(store, records):
    added, duplicates = 0, 0
    corpus_dois = {normalize_doi(d['metadata']['doi']) for d in store.documents() if d['metadata']['doi']}
    with store.connect() as db:
        for raw in records:
            r = DiscoveryRecord.model_validate(raw)
            r.doi = normalize_doi(r.doi) or None
            identity = r.doi or re.sub(r'\W+', '', r.title.lower())
            key = hashlib.sha256(identity.encode()).hexdigest()
            if r.doi in corpus_dois or db.execute('SELECT 1 FROM discovery WHERE id=?', (key,)).fetchone():
                duplicates += 1
                continue
            db.execute('INSERT INTO discovery VALUES (?,?)', (key, r.model_dump_json()))
            added += 1
    return {'added': added, 'duplicates': duplicates, 'status': 'discovery_only_not_scientific_evidence'}

def parse_import(filename, content):
    text = content.decode('utf-8-sig')
    if filename.lower().endswith('.json'):
        value = json.loads(text)
        rows = value.get('records', []) if isinstance(value, dict) else value
    elif filename.lower().endswith('.csv'):
        rows = list(csv.DictReader(io.StringIO(text)))
        for row in rows:
            row['authors'] = [a.strip() for a in row.get('authors', '').split(';') if a.strip()]
            row['year'] = int(row['year']) if row.get('year') else None
    else:
        raise ValueError('Import must be CSV or JSON')
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError('Import must contain at most 500 records')
    return [DiscoveryRecord.model_validate(row).model_dump() for row in rows]
