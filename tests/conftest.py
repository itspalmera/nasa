from pathlib import Path
import pytest
import pymupdf
from flame.config import Settings
from flame.store import Store
from flame.ingest import ingest

@pytest.fixture
def cfg(tmp_path):
    return Settings(_env_file=None,papers_dir=tmp_path/'papers',data_dir=tmp_path/'data',enable_paid_api=False,openai_api_key='')

@pytest.fixture
def store(cfg):
    return Store(cfg)

def make_pdf(path: Path, text='Microgravity combustion research. Flame extinction was observed in this experiment. Evidence is limited to the tested material.'):
    path.parent.mkdir(parents=True,exist_ok=True)
    with pymupdf.open() as doc:
        p=doc.new_page()
        p.insert_textbox(p.rect+ (35,35,-35,-35),text,fontsize=12)
        doc.save(path)
    return path

@pytest.fixture
def indexed(store):
    make_pdf(store.config.papers_dir/'sample.pdf')
    ingest(store,dry_run=False)
    return store
