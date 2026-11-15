"""Opt-in OpenAI/Anthropic calls, persistent embedding cache, isolated Chroma collections."""
import hashlib
import json
import logging
import re
from openai import OpenAI
from .store import Store

log = logging.getLogger(__name__)

class Provider:
    def __init__(self, store: Store):
        self.store = store
        self.cfg = store.config
        self._client = None

    @property
    def client(self):
        if not self.cfg.enable_paid_api or not self.cfg.openai_api_key:
            raise ValueError('Paid API is disabled or OPENAI_API_KEY is missing')
        if self._client is None:
            # SDK retries connection, rate-limit and 5xx errors with exponential backoff.
            self._client = OpenAI(api_key=self.cfg.openai_api_key, timeout=self.cfg.openai_timeout_seconds, max_retries=self.cfg.openai_max_retries)
        return self._client

    def collection(self):
        import chromadb
        from chromadb.config import Settings as ChromaSettings
        client = chromadb.PersistentClient(path=str(self.cfg.data_dir / 'chroma'), settings=ChromaSettings(anonymized_telemetry=False))
        name = 'flame-' + hashlib.sha256(self.cfg.openai_embedding_model.encode()).hexdigest()[:16]
        return client.get_or_create_collection(name, embedding_function=None, metadata={'hnsw:space': 'cosine'})

    def log_usage(self, operation, model, input_tokens, output_tokens=0):
        cost = input_tokens / 1e6 * (self.cfg.embedding_usd_per_million if operation == 'embedding' else self.cfg.input_usd_per_million)
        cost += output_tokens / 1e6 * self.cfg.output_usd_per_million
        with self.store.connect() as db:
            db.execute('INSERT INTO usage(operation,model,input_tokens,output_tokens,estimated_usd) VALUES (?,?,?,?,?)', (operation, model, input_tokens, output_tokens, cost))
        log.info('API usage operation=%s model=%s input_tokens=%s output_tokens=%s estimated_usd=%s', operation, model, input_tokens, output_tokens, cost)
        return {'input_tokens': input_tokens, 'output_tokens': output_tokens, 'estimated_usd': cost}

    def embed(self, texts, force=False):
        keys = [hashlib.sha256((self.cfg.openai_embedding_model + '\0' + t).encode()).hexdigest() for t in texts]
        vectors = [None] * len(texts)
        with self.store.connect() as db:
            for i, key in enumerate(keys):
                row = None if force else db.execute('SELECT vector FROM embeddings WHERE cache_key=?', (key,)).fetchone()
                if row:
                    vectors[i] = json.loads(row['vector'])
        missing = [i for i, v in enumerate(vectors) if v is None]
        for start in range(0, len(missing), 32):
            batch = missing[start:start+32]
            result = self.client.embeddings.create(model=self.cfg.openai_embedding_model, input=[texts[i] for i in batch])
            if len(result.data) != len(batch):
                raise ValueError('Incomplete embedding response')
            self.log_usage('embedding', self.cfg.openai_embedding_model, result.usage.total_tokens)
            with self.store.connect() as db:
                for item in result.data:
                    i = batch[item.index]
                    vectors[i] = item.embedding
                    db.execute('INSERT OR REPLACE INTO embeddings VALUES (?,?)', (keys[i], json.dumps(item.embedding)))
        return vectors

    def index(self, force=False):
        collection = self.collection()
        indexed_ids = set(collection.get()['ids'])
        with self.store.connect() as db:
            all_rows = [dict(r) for r in db.execute('SELECT * FROM chunks')]
        live_ids = {r['id'] for r in all_rows}
        rows = [r for r in all_rows if force or r['embedded_model'] != self.cfg.openai_embedding_model or r['id'] not in indexed_ids]
        stale = list(indexed_ids - live_ids)
        if stale:
            collection.delete(ids=stale)
        for start in range(0, len(rows), 32):
            batch = rows[start:start+32]
            vectors = self.embed([r['text'] for r in batch], force=force)
            collection.upsert(ids=[r['id'] for r in batch], embeddings=vectors,
                documents=[r['text'] for r in batch], metadatas=[{'document_id': r['document_id'], 'page': r['page']} for r in batch])
            with self.store.connect() as db:
                db.executemany('UPDATE chunks SET embedded_model=? WHERE id=?', [(self.cfg.openai_embedding_model, r['id']) for r in batch])

    def semantic(self, query, limit, document_ids):
        collection = self.collection()
        if not collection.count() or not document_ids:
            return []
        vector = self.embed([query])[0]
        result = collection.query(query_embeddings=[vector], n_results=min(collection.count(), limit), where={'document_id': {'$in': document_ids}}, include=['distances'])
        return result['ids'][0]

    def structured(self, system, user, schema, operation):
        if self.cfg.llm_provider == 'anthropic':
            return self._structured_anthropic(system, user, schema, operation)
        result = self.client.chat.completions.parse(model=self.cfg.openai_model, temperature=0.1,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            response_format=schema, max_completion_tokens=2500)
        usage = self.log_usage(operation, self.cfg.openai_model, result.usage.prompt_tokens, result.usage.completion_tokens)
        parsed = result.choices[0].message.parsed
        if parsed is None:
            raise ValueError('Provider returned no validated structured answer')
        return parsed, usage

    @property
    def anthropic_client(self):
        if not self.cfg.enable_paid_api or not self.cfg.anthropic_api_key:
            raise ValueError('Paid API is disabled or ANTHROPIC_API_KEY is missing')
        if getattr(self, '_anthropic', None) is None:
            import anthropic
            self._anthropic = anthropic.Anthropic(api_key=self.cfg.anthropic_api_key,
                timeout=self.cfg.openai_timeout_seconds, max_retries=self.cfg.openai_max_retries)
        return self._anthropic

    def _structured_anthropic(self, system, user, schema, operation):
        """JSON output validated with the same Pydantic schema used for OpenAI."""
        instructions = (system + '\n\nReturn ONLY one JSON object that validates against this JSON schema, '
                        'with no text before or after it:\n' + json.dumps(schema.model_json_schema()))
        messages = [{'role': 'user', 'content': user}]
        last_error = None
        for attempt in range(3):
            budget = self.cfg.anthropic_max_tokens
            while True:
                msg = self.anthropic_client.messages.create(model=self.cfg.anthropic_model,
                    max_tokens=budget, system=instructions, messages=messages)
                usage = self.log_usage(operation, self.cfg.anthropic_model, msg.usage.input_tokens, msg.usage.output_tokens)
                if msg.stop_reason != 'max_tokens':
                    break
                # Truncated: retry with a larger budget before giving up.
                if budget >= 32000:
                    raise ValueError('Provider answer was truncated; raise ANTHROPIC_MAX_TOKENS')
                budget = min(budget * 2, 32000)
            if msg.stop_reason == 'refusal':
                raise ValueError('The model declined to answer this question')
            # Responses can include reasoning blocks before the text block.
            text = ''.join(b.text for b in msg.content if getattr(b, 'type', '') == 'text')
            try:
                start = text.find('{')
                if start < 0:
                    raise ValueError('no JSON object in the answer')
                obj, _ = json.JSONDecoder().raw_decode(text[start:])
                return schema.model_validate(obj), usage
            except Exception as error:  # empty answer, broken JSON or schema mismatch: ask once more
                last_error = error
                log.warning('Invalid structured answer (attempt %s): %s', attempt + 1, error)
                messages = [{'role': 'user', 'content': user}]
                if text.strip():
                    messages += [{'role': 'assistant', 'content': text},
                                 {'role': 'user', 'content': f'Your previous answer was not valid: {str(error)[:800]}. '
                                  'Return ONLY the corrected JSON object.'}]
        raise ValueError(f'Provider returned invalid JSON after 3 attempts: {str(last_error)[:300]}')
