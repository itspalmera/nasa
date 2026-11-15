import json
from types import SimpleNamespace
from unittest.mock import patch, Mock
from openai import OpenAI
from flame.provider import Provider
from flame.models import ExtractionMetadata, NamedFieldEvidence, Evidence, SearchRequest, Metadata
from flame.retrieval import search
from flame.assistant import extract_metadata

def test_embedding_batches_cache_and_model_separation(indexed):
    indexed.config.enable_paid_api=True;indexed.config.openai_api_key='test'
    calls=[]
    def create(**kw):
        calls.append(kw)
        return SimpleNamespace(data=[SimpleNamespace(index=i,embedding=[float(i+1),1.0,0.5]) for i,_ in enumerate(kw['input'])],usage=SimpleNamespace(total_tokens=len(kw['input'])*10))
    client=SimpleNamespace(embeddings=SimpleNamespace(create=create))
    p=Provider(indexed);p._client=client
    texts=[f'chunk {i}' for i in range(35)]
    first=p.embed(texts);second=p.embed(texts)
    assert first==second and len(calls)==2
    assert [len(c['input']) for c in calls]==[32,3]
    assert indexed.usage()['requests']==2
    indexed.config.openai_embedding_model='different-model'
    p.embed([texts[0]])
    assert len(calls)==3

def test_actual_chroma_index_and_hybrid_retrieval(indexed):
    indexed.config.enable_paid_api=True;indexed.config.openai_api_key='test'
    vector=[0.2,0.8,0.4]
    with patch.object(Provider,'embed',side_effect=lambda texts,force=False:[vector for t in texts]) as embed:
        p=Provider(indexed);p.index()
        assert p.collection().count()==1
        p.index()
        assert embed.call_count==1
        found=search(indexed,SearchRequest(query='flame'))
        assert found.mode=='hybrid' and found.results
        assert embed.call_count==2
        assert found.results[0].document_id==indexed.documents()[0]['id']

def test_metadata_removes_unsupported_fields_and_findings(indexed):
    d=indexed.documents()[0];doc_id=d['id'];quote='Flame extinction was observed in this experiment.'
    result=ExtractionMetadata(document_id=doc_id,source_file='sample.pdf',title='Microgravity combustion research',oxygen_concentration='99%',
        field_evidence=[NamedFieldEvidence(field='title',evidence=[Evidence(document_id=doc_id,page=1,quote='Microgravity combustion research.')])])
    with patch.object(Provider,'structured',return_value=(result,{'estimated_usd':0})):
        output=extract_metadata(indexed,doc_id)['metadata']
        assert output['oxygen_concentration'] is None
        assert output['title']=='Microgravity combustion research'
        assert output['verification_status']=='pending'

def test_strict_provider_schemas_do_not_have_arbitrary_maps():
    from openai.lib._pydantic import to_strict_json_schema
    from flame.models import GeneratedAnswer
    for cls in (ExtractionMetadata,GeneratedAnswer):
        schema=to_strict_json_schema(cls)
        def check(node):
            if isinstance(node,dict):
                if node.get('type')=='object':assert node.get('additionalProperties') is False
                for v in node.values():check(v)
            elif isinstance(node,list):
                for v in node:check(v)
        check(schema)


def test_missing_vectors_are_restored_from_embedding_cache(indexed):
    indexed.config.enable_paid_api = True
    indexed.config.openai_api_key = 'test'
    client = SimpleNamespace(embeddings=SimpleNamespace(create=Mock(return_value=SimpleNamespace(
        data=[SimpleNamespace(index=0, embedding=[0.2, 0.8, 0.4])],
        usage=SimpleNamespace(total_tokens=20)))))
    with patch.object(Provider, 'client', client):
        provider = Provider(indexed)
        provider.index()
        ids = provider.collection().get()['ids']
        provider.collection().delete(ids=ids)
        provider.index()
        assert provider.collection().get()['ids'] == ids
        assert client.embeddings.create.call_count == 1


def test_default_model_and_client_configuration(cfg):
    assert cfg.openai_model == 'gpt-4o-mini'
    cfg.enable_paid_api = True
    cfg.openai_api_key = 'test-key'
    cfg.openai_timeout_seconds = 12
    cfg.openai_max_retries = 1
    from flame.store import Store
    with patch('flame.provider.OpenAI') as client:
        Provider(Store(cfg)).client
        client.assert_called_once_with(api_key='test-key', timeout=12, max_retries=1)
