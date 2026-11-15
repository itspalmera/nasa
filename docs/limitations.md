# Known limitations and next improvements

## Validation limits

- No OpenAI credentials or outbound API-domain allowance were provided. No live GPT-4o answer, live embedding, live structured extraction, API latency, or real model grounding quality was verified. Local Chroma was tested with deterministic mocked vectors; this verifies plumbing, not semantic quality.
- Browser verification was attempted through `sites-preview` and the shared cloud browser. The initial preview flag mismatch was repaired by translating daemon flags for Next.js. The preview relay then timed out; `sites-preview status` reported stopped and the browser tool returned `Browser runtime unavailable`. No screenshot or successful interactive UI session exists. TypeScript and production build checks do not substitute for browser QA.
- The official 2026 challenge URL returned an HTTPS proxy CONNECT 403. Exact challenge scope/eligibility/submission rules remain unverified.
- The retrieval evaluation is a small hand-authored set (seven answerable cases and one out-of-domain case), not a scientific benchmark. Quote traceability is not answer groundedness. No generated-answer groundedness score is reported.

## Scientific and extraction limits

- Two PDFs have no extractable text; 42 pages across the corpus have low/empty-text warnings. Some may be image-only, blank, or embedded-media slides. An older report has an unverified OCR layer. Neither OCR nor graphical/experimental figure interpretation is implemented.
- Metadata is incomplete and pending review. Experiment tags can represent background mentions, not experiments performed by the authors. No source's affiliation is used as proof of scientific confidence.
- Only four conservative source-checked summaries are included. They are not a systematic evidence synthesis. No finding has independent scientific review.
- Chunk token counts are approximate. Page boundaries and short slides force some chunks below the target size. Large equations/tables may split or extract in the wrong reading order.
- Existing first-page DOI matches can include bibliographic ambiguity. Different-byte revisions with the same DOI retain distinct file-based provenance; they are reported as potential duplicates, not silently collapsed into one set of pages. Exact duplicate files and discovery DOI duplicates are deduplicated.
- Structured extraction checks quote existence, not semantic support. It examines selected pages only. Chat sees selected excerpts rather than all methods/figures. Contradictions can be missed and subtle unsupported interpretations can survive quote validation.
- No experimentally verified numerical dataset was reconstructed. Only corpus metadata distributions are plotted. Partial-gravity habitat conclusions are not established by this microgravity corpus.

## Operational limits

- Trusted local workstation design, one backend process; no production auth provider, distributed ingestion lock, background task queue, or public deployment. Same-origin checks trust forwarded host headers only because the documented backend is loopback behind the local frontend.
- PDF parsing is not isolated in a container. Use trusted or appropriately vetted PDFs. Upload limits mitigate size, not every malformed document attack. No antivirus/OCR sandbox is provided.
- Filesystem documents and vectors should be backed up together while stopped. Changed/deleted PDFs can invalidate old page links; retain versioned corpus snapshots for archival citations.
- The in-process ingestion lock does not cover simultaneous writes from an independent CLI process. Do not ingest through CLI and API concurrently.
- Direct API source links require a bearer token if token auth is enabled. The dashboard uses authenticated blob viewers after a token is entered. Swagger has no token sign-in flow; use a bearer-capable client for protected calls.
- Embedding markers assume Chroma and SQLite are kept together. If Chroma is manually deleted, use explicit forced vector regeneration or restore a matching backup. Answer cache invalidation is conservative.
- Pricing estimates are user-configurable assumptions, not live prices or actual billing. Paid calls remain opt-in; no paid operations were initiated here.
- Consensus adapter is manual CSV/JSON import only because official API entitlement was not established. A Free account is not presumed to have API access. Imports are discovery data and never automatically evidence. No authenticated pages are scraped.

## Recommended next improvements

1. Obtain readable/open-access versions or run carefully reviewed OCR for failed pages. Review metadata, author completeness, experiment assignments, and all four source-checked summaries with a domain expert.
2. Confirm the official challenge details and paper licenses. Configure outbound OpenAI access and secret bindings locally, then deliberately run the two opt-in integration probes and inspect grounded answers.
3. Complete desktop/mobile browser QA once the shared runtime is restored, including keyboard navigation, source viewers, file upload, filters, charts and API errors.
4. Expand bilingual, conflicting-evidence, partial-gravity and unanswerable questions; independently label relevance and claim entailment. Report precision/recall and abstention false positives with meaningful sample sizes.
5. Improve section/table-aware chunking and exact local tokenization; use structured per-run numeric datasets with units, uncertainty and sources before adding experimental measurement charts.
6. Add human review workflows for metadata and findings, immutable citation snapshots, and resumable background ingestion if the corpus grows.
7. Introduce a documented official Consensus adapter only after confirmed API entitlement and published contract/rate limits are available.
