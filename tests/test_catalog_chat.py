"""PSI catalog evidence in the chat, physical alert validation and the Anthropic provider."""
import json
from types import SimpleNamespace
from unittest.mock import patch
from flame import catalog
from flame.assistant import chat
from flame.models import ChatRequest, GeneratedAnswer, AnswerClaim
from flame.config import ROOT


def with_catalog(store):
    store.config.catalog_dir = ROOT / 'datasets' / 'psi'
    return store


def test_catalog_search_finds_findings_and_abstains_off_topic(store):
    with_catalog(store)
    ids = [c.id for c in catalog.search(store, '¿Sirve cortar la ventilación para apagar un fuego?')]
    assert 'psi:BASS-II#3' in ids
    assert catalog.search(store, 'receta de pan amasado') == []
    assert catalog.search(store, '¿Cuáles son los materiales más ensayados?')[0].id == 'catalog:materiales'


def test_psi_citations_link_to_psi_and_keep_page(store):
    with_catalog(store)
    c = next(c for c in catalog.search(store, 'alarma de humo Saffire VI 981') if c.id == 'psi:Saffire-VI#2')
    assert c.page == 6 and 'Urban' in c.source_file
    bass = next(c for c in catalog.search(store, 'BASS-II ventilador') if c.id == 'psi:BASS-II')
    assert bass.url.endswith('/PSI-25')


def test_evidence_only_chat_includes_catalog_without_papers(store):
    with_catalog(store)
    r = chat(store, ChatRequest(query='¿Qué son las llamas frías?', language='es'))
    assert r.mode == 'evidence_only'
    assert any(c.id.startswith('psi:') for c in r.citations)


def test_generated_answer_with_catalog_quotes_and_physical_alert(store):
    with_catalog(store)
    store.config.enable_paid_api = True
    store.config.openai_api_key = 'test'
    def fake(self, system, user, schema, operation):
        ev = {e['id']: e['text'] for e in json.loads(user)['evidence']}
        assert 'psi:BASS-II#3' in ev and 'psi:BASS-II#4' in ev
        claim = AnswerClaim(text='En BASS-II las llamas se apagaron al detener el ventilador.', kind='observation',
                            citation_ids=['psi:BASS-II#3'], quote='Las llamas siempre se apagaron al detener el ventilador')
        alert = AnswerClaim(text='Con flujo muy bajo la llama puede seguir azul y estable.', kind='observation',
                            citation_ids=['psi:BASS-II#4'], quote='puede sostenerse azul, tenue y estable')
        return GeneratedAnswer(claims=[claim], physical_alert=alert, limitations=[], insufficient_evidence=False), {}
    with patch('flame.provider.Provider.structured', fake):
        r = chat(store, ChatRequest(query='¿Sirve cortar la ventilación para apagar un fuego?', language='es'))
    assert 'ventilador' in r.answer and r.physical_alert and '[2]' in r.physical_alert
    assert [c.id for c in r.citations] == ['psi:BASS-II#3', 'psi:BASS-II#4']


def test_physical_alert_with_invented_quote_is_dropped(store):
    with_catalog(store)
    store.config.enable_paid_api = True
    store.config.openai_api_key = 'test'
    def fake(self, system, user, schema, operation):
        claim = AnswerClaim(text='Se apagaron.', kind='observation', citation_ids=['psi:BASS-II#3'],
                            quote='Las llamas siempre se apagaron al detener el ventilador')
        alert = AnswerClaim(text='Invento.', kind='observation', citation_ids=['psi:BASS-II#3'],
                            quote='esta frase no aparece en ninguna evidencia')
        return GeneratedAnswer(claims=[claim], physical_alert=alert, limitations=[], insufficient_evidence=False), {}
    with patch('flame.provider.Provider.structured', fake):
        r = chat(store, ChatRequest(query='¿Sirve cortar la ventilación para apagar un fuego?', language='es'))
    assert r.physical_alert is None and r.answer


def test_anthropic_provider_parses_json_after_reasoning_block(store):
    from flame.provider import Provider
    cfg = store.config
    cfg.enable_paid_api, cfg.llm_provider, cfg.anthropic_api_key = True, 'anthropic', 'test-key'
    assert cfg.synthesis_ready and cfg.synthesis_model == 'claude-haiku-5-5'
    payload = {'claims': [], 'physical_alert': None, 'limitations': [], 'conflicts': [], 'insufficient_evidence': True}
    msg = SimpleNamespace(stop_reason='end_turn', usage=SimpleNamespace(input_tokens=10, output_tokens=5),
                          content=[SimpleNamespace(type='thinking', thinking='...'),
                                   SimpleNamespace(type='text', text='```json\n' + json.dumps(payload) + '\n```')])
    with patch('anthropic.Anthropic') as client:
        client.return_value.messages.create.return_value = msg
        parsed, usage = Provider(store).structured('sys', 'user', GeneratedAnswer, 'chat')
    assert parsed.insufficient_evidence is True and usage['input_tokens'] == 10
    kwargs = client.return_value.messages.create.call_args.kwargs
    assert kwargs['model'] == 'claude-haiku-5-5' and 'JSON schema' in kwargs['system']


def test_health_reports_anthropic_without_exposing_key(cfg):
    from flame.main import create_app
    from fastapi.testclient import TestClient
    cfg.llm_provider, cfg.anthropic_api_key, cfg.enable_paid_api = 'anthropic', 'sk-ant-private', True
    response = TestClient(create_app(cfg)).get('/health')
    assert response.json()['synthesis_ready'] is True
    assert response.json()['synthesis_model'] == 'claude-haiku-5-5'
    assert 'sk-ant-private' not in response.text

def test_executive_summary_is_shown_only_when_its_numbers_are_grounded(store):
    with_catalog(store)
    store.config.enable_paid_api = True
    store.config.openai_api_key = 'test'
    claim = AnswerClaim(text='En BASS-II las llamas se apagaron al detener el ventilador.', kind='observation',
                        citation_ids=['psi:BASS-II#3'], quote='Las llamas siempre se apagaron al detener el ventilador')
    def answer_with(summary):
        def fake(self, system, user, schema, operation):
            return GeneratedAnswer(claims=[claim], executive_summary=summary, limitations=[], insufficient_evidence=False), {}
        return fake
    with patch('flame.provider.Provider.structured', answer_with('Cortar el flujo apagó las llamas en BASS-II (1 experimento en la ISS).')):
        r = chat(store, ChatRequest(query='¿Sirve cortar la ventilación para apagar un fuego?', language='es'))
    assert r.executive_summary and r.executive_summary.startswith('Cortar') and r.language == 'es'
    with patch('flame.provider.Provider.structured', answer_with('Cortar el flujo apagó las llamas en 97 % de los casos.')):
        r = chat(store, ChatRequest(query='¿Sirve apagar la ventilación para extinguir un fuego?', language='es'))
    assert r.executive_summary is None and 'ventilador' in r.answer
