"""Explicitly opt-in integration probes. Never run automatically with a configured key."""
import os
import pytest
from flame.config import settings
from flame.provider import Provider
from flame.store import Store
from flame.models import GeneratedAnswer

pytestmark=pytest.mark.skipif(os.getenv('RUN_LIVE_OPENAI_TESTS')!='1',reason='Live OpenAI integration requires explicit RUN_LIVE_OPENAI_TESTS=1, paid opt-in, credentials, and network access')

def test_live_embedding_roundtrip():
    store=Store(settings())
    vectors=Provider(store).embed(['Scientific source traceability integration test.'])
    assert len(vectors)==1 and len(vectors[0])>100

def test_live_structured_output():
    p=Provider(Store(settings()))
    answer,_=p.structured('Use only supplied evidence. If none is supplied, return no claims and insufficient_evidence=true.','No scientific evidence supplied.',GeneratedAnswer,'integration_test')
    assert not answer.claims and answer.insufficient_evidence
