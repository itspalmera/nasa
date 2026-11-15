from unittest.mock import patch
import pytest
from flame.models import ChatRequest, SearchRequest, Filters, GeneratedAnswer, AnswerClaim
from flame.retrieval import search
from flame.assistant import chat, validate_claims

def test_local_search_source_integrity(indexed):
    result=search(indexed,SearchRequest(query='flame extinction'))
    assert result.mode=='keyword' and result.results
    c=result.results[0]
    d=indexed.document(c.document_id)
    assert c.text in d['pages'][c.page-1]['text']
    assert c.url.endswith('#page=1')
    assert c.scientific_confidence=='not_assessed'

def test_metadata_filter(indexed):
    result=search(indexed,SearchRequest(query='flame',filters=Filters(experiment='FLEX')))
    assert not result.results

def test_empty_search_and_fts_injection(indexed):
    for q in ('unfindablezz', '" OR * ^ NEAR()', 'a de la'):
        assert search(indexed,SearchRequest(query=q)).results==[]

def test_spanish_lexical_query(indexed):
    assert search(indexed,SearchRequest(query='extinción llama')).results

def test_no_api_evidence_mode_and_spanish(indexed):
    response=chat(indexed,ChatRequest(query='¿Qué llama hay en microgravedad?'))
    assert response.mode=='evidence_only'
    assert response.insufficient_evidence
    assert response.citations and 'Encontré' in response.answer
    assert indexed.usage()['requests']==0

def test_insufficient_evidence(indexed):
    r=chat(indexed,ChatRequest(query='quantumzz copperzz'))
    assert r.insufficient_evidence and not r.citations

def test_invalid_citations_and_non_verbatim_quotes_removed(indexed):
    citations=search(indexed,SearchRequest(query='flame')).results
    c=citations[0]
    good=AnswerClaim(text='Extinction was observed.',kind='observation',citation_ids=[c.id],quote='Flame extinction was observed')
    wrong=good.model_copy(update={'citation_ids':['fabricated-id']})
    fabricated=good.model_copy(update={'quote':'Unreported experimental measurement'})
    assert validate_claims(GeneratedAnswer(claims=[good,wrong,fabricated],limitations=[],insufficient_evidence=False),citations)==[good]

def test_generation_is_validated_and_cached(indexed):
    indexed.config.enable_paid_api=True;indexed.config.openai_api_key='mock-key'
    c=search(indexed,SearchRequest(query='flame',semantic=False)).results[0]
    output=GeneratedAnswer(claims=[AnswerClaim(text='Extinction was observed.',kind='observation',citation_ids=[c.id],quote='Flame extinction was observed')],limitations=['Single test source.'],insufficient_evidence=False)
    with patch('flame.assistant.Provider.structured',return_value=(output,{'estimated_usd':0.001})) as mocked:
        request=ChatRequest(query='flame',semantic=False)
        first=chat(indexed,request);second=chat(indexed,request)
        assert mocked.call_count==1
        assert first.claims and '[1]' in first.answer
        assert second.usage['cached'] is True

def test_provider_failure_is_not_reported_as_success(indexed):
    indexed.config.enable_paid_api=True;indexed.config.openai_api_key='invalid-key'
    with patch('flame.assistant.Provider.structured',side_effect=RuntimeError('bad credentials')):
        with pytest.raises(RuntimeError):chat(indexed,ChatRequest(query='flame',semantic=False))

def test_conflicting_evidence_retains_both_source_citations(indexed):
    from conftest import make_pdf
    from flame.ingest import ingest
    from flame.models import GeneratedConflict, ConflictQuote
    make_pdf(indexed.config.papers_dir/'second.pdf','Flame extinction evidence differs in this separate experimental context. The results are limited to this tested sample.')
    ingest(indexed,dry_run=False)
    citations=search(indexed,SearchRequest(query='flame',semantic=False)).results
    assert len(citations)==2
    a,b=citations
    qa=a.text[:30];qb=b.text[:30]
    output=GeneratedAnswer(claims=[AnswerClaim(text='The reported context is limited.',kind='interpretation',citation_ids=[a.id],quote=qa)],
        limitations=[],insufficient_evidence=False,conflicts=[GeneratedConflict(text='The reported contexts differ.',citation_ids=[a.id,b.id],evidence=[ConflictQuote(citation_id=a.id,quote=qa),ConflictQuote(citation_id=b.id,quote=qb)])])
    indexed.config.enable_paid_api=True;indexed.config.openai_api_key='mock-key'
    with patch('flame.assistant.Provider.structured',return_value=(output,{})):
        response=chat(indexed,ChatRequest(query='flame',semantic=False))
    assert len(response.citations)==2
    assert response.conflicts and '[1, 2]' in response.conflicts[0]


def test_semantic_search_without_lexical_terms(indexed):
    indexed.config.enable_paid_api = True
    indexed.config.openai_api_key = 'test'
    cid = search(indexed, SearchRequest(query='flame', semantic=False)).results[0].id
    with patch('flame.retrieval.Provider.semantic', return_value=[cid]) as semantic:
        result = search(indexed, SearchRequest(query='how does do'))
    assert semantic.call_count == 1
    assert result.mode == 'hybrid' and result.results[0].id == cid


def test_semantic_failure_warning_survives_generation(indexed):
    indexed.config.enable_paid_api = True
    indexed.config.openai_api_key = 'test'
    c = search(indexed, SearchRequest(query='flame', semantic=False)).results[0]
    output = GeneratedAnswer(claims=[AnswerClaim(text='Observed extinction.', kind='observation',
        citation_ids=[c.id], quote='Flame extinction was observed')], limitations=[], insufficient_evidence=False)
    with patch('flame.retrieval.Provider.semantic', side_effect=RuntimeError('unavailable')), \
         patch('flame.assistant.Provider.structured', return_value=(output, {})):
        result = chat(indexed, ChatRequest(query='flame'))
    assert result.claims
    assert any('Semantic retrieval unavailable' in warning for warning in result.limitations)


def test_context_budget_limits_complete_excerpts(indexed):
    from conftest import make_pdf
    from flame.ingest import ingest
    make_pdf(indexed.config.papers_dir / 'long.pdf', 'Flame observations and evidence. ' * 100)
    ingest(indexed, dry_run=False)
    indexed.config.rag_max_context_tokens = 1000
    indexed.config.enable_paid_api = True
    indexed.config.openai_api_key = 'test'
    output = GeneratedAnswer(claims=[], limitations=[], insufficient_evidence=True)
    with patch('flame.assistant.Provider.structured', return_value=(output, {})) as generate:
        result = chat(indexed, ChatRequest(query='flame', limit=20, semantic=False))
    import json
    from flame.ingest import token_estimate
    evidence = json.loads(generate.call_args.args[1])['evidence']
    assert evidence
    assert sum(token_estimate(c['text']) for c in evidence) <= 1000
    assert any('RAG_MAX_CONTEXT_TOKENS' in warning for warning in result.limitations)


def test_pdf_whitespace_quote_recovers_original_span(indexed):
    from flame.models import Citation
    from flame.assistant import source_quote
    text = 'Microgravity flame\n extinction was observed in this experiment.'
    c = Citation(id='source', document_id='doc', title='Paper', source_file='paper.pdf',
                 page=1, text=text, url='/file', relevance=1)
    claim = AnswerClaim(text='Observed.', kind='observation', citation_ids=['source'],
                        quote='flame extinction was observed')
    result = validate_claims(GeneratedAnswer(claims=[claim], limitations=[], insufficient_evidence=False), [c])
    assert result[0].quote == 'flame\n extinction was observed'
    assert result[0].quote in text
    assert source_quote('flame extinction was NOT observed', text) is None
    assert source_quote('Se observó la extinción', text) is None
    assert source_quote('flame', text) is None


def test_all_invalid_claims_preserve_sources_and_report_validation_failure(indexed):
    indexed.config.enable_paid_api = True
    indexed.config.openai_api_key = 'test'
    output = GeneratedAnswer(claims=[AnswerClaim(text='Una observación.', kind='observation',
        citation_ids=['invented-id'], quote='An invented supporting quote.')],
        limitations=[], insufficient_evidence=False)
    with patch('flame.assistant.Provider.structured', return_value=(output, {})) as generate:
        result = chat(indexed, ChatRequest(query='microgravedad', language='es', semantic=False))
    assert generate.call_count == 1
    assert result.mode == 'citation_validation_failed'
    assert result.citations and not result.claims
    assert 'no superó la validación' in result.answer
