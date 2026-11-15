from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class Evidence(BaseModel):
    document_id: str
    page: int = Field(ge=1)
    quote: str = Field(min_length=12)

class Finding(BaseModel):
    claim: str
    kind: Literal['observation', 'interpretation', 'hypothesis', 'engineering_implication']
    evidence: list[Evidence] = Field(min_length=1)
    experimental_context: str | None = None
    limitations: list[str] = []
    verification_status: Literal['pending', 'source_checked', 'reviewed'] = 'pending'
    scientific_confidence: Literal['not_assessed', 'limited', 'moderate', 'high'] = 'not_assessed'

class Metadata(BaseModel):
    model_config = ConfigDict(extra='forbid')
    document_id: str
    title: str | None = None
    authors: list[str] = []
    publication_year: int | None = Field(default=None, ge=1900, le=2100)
    doi: str | None = None
    experiment: str | None = None
    research_category: str | None = None
    gravity_condition: str | None = None
    fuel_type: str | None = None
    oxygen_concentration: str | None = None
    airflow_velocity: str | None = None
    pressure: str | None = None
    experimental_method: str | None = None
    source_institution: str | None = None
    key_findings: list[Finding] = []
    limitations: list[str] = []
    source_file: str
    evidence_pages: list[int] = []
    field_evidence: dict[str, list[Evidence]] = {}
    verification_status: Literal['pending', 'source_checked', 'reviewed'] = 'pending'

class NamedFieldEvidence(BaseModel):
    field: str
    evidence: list[Evidence]

class ExtractionMetadata(Metadata):
    # A list is used in the provider schema because strict structured output
    # cannot express arbitrary-key dictionaries. Convert to Metadata after parsing.
    field_evidence: list[NamedFieldEvidence] = []

class Filters(BaseModel):
    experiment: str | None = None
    research_category: str | None = None
    publication_year: int | None = None
    gravity_condition: str | None = None
    fuel_type: str | None = None

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=5, ge=1, le=20)
    filters: Filters = Field(default_factory=Filters)
    semantic: bool = True

class ChatRequest(SearchRequest):
    language: Literal['auto', 'en', 'es'] = 'auto'

class IngestRequest(BaseModel):
    dry_run: bool = True
    embeddings: bool = False
    force_embeddings: bool = False

class Citation(BaseModel):
    id: str
    document_id: str
    title: str
    source_file: str
    page: int
    text: str
    url: str
    relevance: float
    evidence_completeness: str = 'excerpt_only'
    scientific_confidence: str = 'not_assessed'

class SearchResponse(BaseModel):
    results: list[Citation]
    mode: str
    warnings: list[str] = []

class AnswerClaim(BaseModel):
    text: str
    kind: Literal['observation', 'interpretation', 'hypothesis', 'engineering_implication']
    citation_ids: list[str] = Field(min_length=1)
    quote: str
    experimental_context: str | None = None

class ConflictQuote(BaseModel):
    citation_id: str
    quote: str = Field(min_length=12)

class GeneratedConflict(BaseModel):
    text: str
    citation_ids: list[str] = Field(min_length=2)
    evidence: list[ConflictQuote] = Field(min_length=2)

def _summary_required(schema, *_):
    # Keep a default for code and tests, but tell the model the field is mandatory.
    if 'executive_summary' not in schema.setdefault('required', []):
        schema['required'].append('executive_summary')

class GeneratedAnswer(BaseModel):
    model_config = ConfigDict(json_schema_extra=_summary_required)
    claims: list[AnswerClaim]
    # Counter-intuitive microgravity fire behavior relevant to the question, if the evidence states one.
    physical_alert: AnswerClaim | None = None
    # One or two sentences: the bottom line and how strong the evidence is. Restates claims only.
    executive_summary: str = ''
    limitations: list[str]
    conflicts: list[GeneratedConflict] = []
    insufficient_evidence: bool

class ChatResponse(BaseModel):
    answer: str
    executive_summary: str | None = None
    language: str | None = None
    claims: list[AnswerClaim] = []
    physical_alert: str | None = None
    physical_alert_claim: AnswerClaim | None = None
    citations: list[Citation]
    limitations: list[str]
    conflicts: list[str] = []
    mode: str
    insufficient_evidence: bool
    usage: dict = {}

class DocumentResponse(BaseModel):
    id: str
    source_file: str
    content_hash: str
    status: str
    page_count: int
    warnings: list[str]
    metadata: Metadata
    chunks: int
    pages: list[dict] | None = None

class IngestResponse(BaseModel):
    dry_run: bool
    documents: int
    chunks: int
    embedding_tokens: int
    estimated_embedding_usd: float
    indexed: int = 0
    unchanged: int = 0
    duplicates: int = 0
    failed: int = 0
    warnings: list[str] = []

class DiscoveryRecord(BaseModel):
    title: str = Field(min_length=1)
    doi: str | None = None
    authors: list[str] = []
    year: int | None = None
    url: str | None = None
    abstract: str | None = None

class ImportRequest(BaseModel):
    records: list[DiscoveryRecord] = Field(max_length=500)
