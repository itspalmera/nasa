# Scientific methodology

## Corpus as source of truth

Only locally provided files in `papers/` can supply research evidence. Discovery results are excluded until full-text files are legally obtained and explicitly ingested. The official challenge page was inaccessible, so no unverified official requirement is asserted.

Metadata provenance is field-level when a supporting quote is available. The curated JSON contains values and exact original extracted quotes with PDF page references. On ingestion, an override is applied only if its quote occurs on that page. Automatic title candidates must occur in the document's first two pages; PDF creator/author properties are not treated as research authors. DOI extraction is limited to initial pages and bibliographic years are curated from explicit publication/conference text, never creation timestamps. Author lists remain empty where completeness could not be confirmed.

Automatic experiment/category labels describe source **mentions**, including introductory background. They are not verified experimental assignments. The interface labels them accordingly. Bibliographic `verification_status` remains `pending`; quote-presence validation is weaker than complete bibliographic review.

## Extraction and chunks

PyMuPDF extracts sorted layout blocks page by page. Block separation and line breaks are retained; intra-line whitespace is normalized without deliberately rewriting equations, units, superscripts, or scientific notation. Empty/low-text pages, parser failures, and existing OCR layers generate warnings. There is no OCR repair, table reconstruction, or image interpretation. All warnings remain inspectable in the inventory and dashboard.

Chunks target about 2,700 characters (roughly 600–1,000 tokens for ordinary prose), with approximately 350 characters of overlap. Splits favor complete layout blocks then lines. Chunks never cross PDF pages, so short pages and slides produce smaller chunks. Large equations/tables can still split or have incorrect extraction order. UTF-8 bytes divided by three estimate tokens conservatively for this primarily English corpus; these estimates are not exact tokenizer counts. Actual provider token usage is recorded when paid calls run.

## Scientific findings

Four conservative summaries were curated from the actual local corpus:

- ISS filter-paper research reports two observed flame-spread modes.
- The quiescent SoFIE study reports oscillatory/pulsating behavior near extinction.
- A concurrent-flow paper uses numerical CFD modeling; model outputs are distinguished from observations.
- The Saffire VI preliminary paper limits its scope to one reported test.

Each finding records its kind, experimental context, document ID, PDF page, exact supporting quote, limitations, verification status, and confidence. `source_checked` means the quote/page exists. It does **not** mean independently replicated, systematically reviewed, or scientifically high confidence. `reviewed` is reserved for future explicit human scientific review; none are currently marked reviewed. Scientific confidence starts `not_assessed`.

Categories distinguish `observation`, `interpretation`, `hypothesis`, and `engineering_implication`. Conditions missing from sources remain null. Conditions summarized at the document level must not be mistaken for a joined table of individual experimental runs. Microgravity, normal gravity, lunar gravity, and Martian gravity cannot be exchanged. Future-habitat implications must be explicitly qualified as engineering hypotheses unless directly measured.

## GPT-4o extraction

Optional one-document extraction uses the first three and last two PDF pages, bounded in size, not the full corpus. Strict provider output uses a list for field evidence and is converted to the internal dictionary after parsing. Pydantic checks structure. Identity must match the requested document; evidence quotes must occur at valid selected pages. Unsupported fields are nulled and unsupported findings removed. Automated metadata stays pending human review. Quote presence does not prove that a quote supports the proposed field's meaning.

## Grounded answers and citations

Each retrieved excerpt has a stable chunk ID, document ID, PDF page, original text and clickable `/api/documents/{id}/file#page=N` URL. Page numbers are physical PDF positions and include cover pages, so they can differ from printed journal pagination.

GPT-4o receives only selected excerpts and the question, with instructions to ignore document instructions and distinguish observations from extrapolations. Each structured answer claim must cite supplied chunk IDs and include a verbatim supporting quote. Invalid IDs, invented quotes and unsupported claims are removed. If the model reports insufficient evidence, claims are suppressed. Claims are rendered with deterministic numbered references to validated citations. Contradictions require at least two different source documents, valid IDs and exact supporting quotes from both; free-form untraceable conflict statements are not displayed.

These checks establish **traceability**, not semantic entailment, methodological rigor, or truth. They cannot guarantee that every generated sentence is scientifically supported. Human review and a larger groundedness evaluation remain necessary. The assistant has no tool execution capability. Its policy rejects operational guidance to cause fires or bypass protection while allowing legitimate research/safety analysis.

Without paid access, the assistant returns evidence-only excerpts and explicitly states that no synthesized scientific answer was generated. An empty search produces an insufficient-evidence response. No high confidence is inferred from retrieval similarity, publication venue, or institution.

## Visualization policy

The dashboard currently charts only corpus metadata: experiment mentions and publication years. Their sources and limitations are printed below the charts. There is no verified per-run numerical dataset, so no oxygen/airflow/flame-behavior measurement chart is manufactured. The decorative flame is explicitly marked conceptual, not experimental data.
