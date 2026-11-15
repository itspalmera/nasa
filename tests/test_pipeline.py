import json
import shutil
import pytest
from pydantic import ValidationError
from flame.ingest import extract, chunks_for, digest, ingest, safe_file
from flame.models import Metadata, Finding
from conftest import make_pdf

def test_pdf_extraction_and_page_provenance(tmp_path):
    path=make_pdf(tmp_path/'sample.pdf')
    pages,_,warnings=extract(path)
    assert not warnings
    assert pages[0]['page']==1
    assert 'Flame extinction was observed' in pages[0]['text']

def test_chunk_stability_and_no_omitted_tail():
    text='\n\n'.join(f'Section {i}\n'+ ('Research evidence preserves scientific notation 1.2 × 10−3. '*40) for i in range(5))
    pages=[{'page':4,'text':text}]
    a=chunks_for('doc',pages)
    assert a==chunks_for('doc',pages)
    assert len({c['id'] for c in a})==len(a)
    assert all(c['page']==4 and len(c['text'])<=2700 for c in a)
    assert text[-80:] in a[-1]['text']
    assert all(c['id']!=chunks_for('other',pages)[i]['id'] for i,c in enumerate(a))

def test_stable_content_identifiers():
    assert digest(b'paper')==digest(b'paper')
    assert digest(b'paper')!=digest(b'paper changed')

def test_duplicate_detection(indexed):
    shutil.copy(indexed.config.papers_dir/'sample.pdf',indexed.config.papers_dir/'duplicate.pdf')
    report=ingest(indexed,dry_run=False)
    assert report.duplicates==1
    assert len(indexed.documents())==1

def test_incremental_preserves_embedding_state(indexed):
    with indexed.connect() as db:
        db.execute("UPDATE chunks SET embedded_model='text-embedding-3-small'")
    before=indexed.documents()
    result=ingest(indexed,dry_run=False)
    assert result.unchanged==1 and result.embedding_tokens==0
    assert before==indexed.documents()
    with indexed.connect() as db:
        assert db.execute('SELECT embedded_model FROM chunks').fetchone()[0]=='text-embedding-3-small'

def test_dry_run_does_not_mutate(store):
    make_pdf(store.config.papers_dir/'sample.pdf')
    result=ingest(store,dry_run=True)
    assert result.documents==1 and result.chunks>0 and result.estimated_embedding_usd>0
    assert store.documents()==[]

def test_scanned_and_broken_pdf_not_silently_discarded(store):
    import pymupdf
    store.config.papers_dir.mkdir()
    with pymupdf.open() as d:
        d.new_page();d.save(store.config.papers_dir/'blank.pdf')
    (store.config.papers_dir/'broken.pdf').write_bytes(b'%PDF-broken')
    result=ingest(store,dry_run=False)
    assert result.failed==2 and len(store.documents())==2
    assert all(d['warnings'] for d in store.documents())

def test_missing_corpus_returns_empty(store):
    result=ingest(store,dry_run=False)
    assert result.documents==0 and store.documents()==[]

def test_deleted_document_is_removed(indexed):
    (indexed.config.papers_dir/'sample.pdf').unlink()
    ingest(indexed,dry_run=False)
    assert indexed.documents()==[]
    with indexed.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM chunks_fts').fetchone()[0]==0

def test_metadata_validation():
    with pytest.raises(ValidationError):
        Metadata(document_id='x',source_file='x',publication_year=9999)
    with pytest.raises(ValidationError):
        Finding(claim='unsupported',kind='observation',evidence=[])
    m=Metadata(document_id='x',source_file='x')
    assert m.oxygen_concentration is None and m.publication_year is None

def test_path_traversal_and_symlink(cfg,tmp_path):
    cfg.papers_dir.mkdir()
    outside=tmp_path/'private.pdf';outside.write_text('private')
    (cfg.papers_dir/'link.pdf').symlink_to(outside)
    for value in ('../private.pdf',str(outside),'link.pdf'):
        with pytest.raises(ValueError):safe_file(cfg.papers_dir,value)

def test_oversized_file_is_tracked(store):
    store.config.max_file_mb=0
    make_pdf(store.config.papers_dir/'sample.pdf')
    result=ingest(store,dry_run=False)
    assert result.failed==1 and result.warnings
    with store.connect() as db:
        assert db.execute('SELECT status FROM files').fetchone()[0]=='failed'

def test_paid_ingestion_requires_explicit_opt_in(indexed):
    with pytest.raises(ValueError,match='ENABLE_PAID_API'):
        ingest(indexed,dry_run=False,embeddings=True)
