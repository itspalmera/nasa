import json
import sqlite3
from contextlib import contextmanager
from .config import Settings

class Store:
    def __init__(self, config: Settings):
        self.config = config
        config.data_dir.mkdir(parents=True, exist_ok=True)
        self.path = config.data_dir / 'corpus.sqlite3'
        with self.connect() as db:
            db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS documents (
              id TEXT PRIMARY KEY, source_file TEXT UNIQUE, content_hash TEXT,
              status TEXT, page_count INTEGER, warnings TEXT, metadata TEXT);
            CREATE TABLE IF NOT EXISTS pages (document_id TEXT, page INTEGER, text TEXT,
              PRIMARY KEY(document_id,page));
            CREATE TABLE IF NOT EXISTS chunks (id TEXT PRIMARY KEY, document_id TEXT, page INTEGER,
              text TEXT, tokens INTEGER, embedded_model TEXT);
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(id UNINDEXED,text, tokenize='unicode61');
            CREATE TABLE IF NOT EXISTS files (source_file TEXT PRIMARY KEY, content_hash TEXT,
              document_id TEXT, status TEXT, warnings TEXT);
            CREATE TABLE IF NOT EXISTS embeddings (cache_key TEXT PRIMARY KEY, vector TEXT);
            CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY, created TEXT DEFAULT CURRENT_TIMESTAMP,
              operation TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, estimated_usd REAL);
            CREATE TABLE IF NOT EXISTS discovery (id TEXT PRIMARY KEY, record TEXT);
            CREATE TABLE IF NOT EXISTS answer_cache (cache_key TEXT PRIMARY KEY, response TEXT);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def documents(self):
        with self.connect() as db:
            return [self.decode(row) for row in db.execute('''SELECT d.*,
              (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) chunks
              FROM documents d ORDER BY source_file''')]

    @staticmethod
    def decode(row):
        d = dict(row)
        for key in ('warnings', 'metadata'):
            d[key] = json.loads(d[key])
        return d

    def document(self, document_id):
        with self.connect() as db:
            row = db.execute('SELECT d.*, (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) chunks FROM documents d WHERE id=?', (document_id,)).fetchone()
            if not row:
                return None
            d = self.decode(row)
            d['pages'] = [dict(r) for r in db.execute('SELECT page,text FROM pages WHERE document_id=? ORDER BY page', (document_id,))]
            return d

    def usage(self):
        with self.connect() as db:
            return dict(db.execute('SELECT COUNT(*) requests, COALESCE(SUM(input_tokens),0) input_tokens, COALESCE(SUM(output_tokens),0) output_tokens, COALESCE(SUM(estimated_usd),0) estimated_usd FROM usage').fetchone())
