# Evaluation

Validation date: 2026-11-13. Results are recorded in `validation_results.json`, `http_smoke_results.json`, and `evaluation_results.json`; no scores are inferred from publication prestige or embedding similarity.

## Automated checks

| Check actually run | Result |
|---|---|
| `pytest -q -ra` | 35 passed, 2 explicitly skipped, 0 failures |
| `npm --prefix frontend run typecheck` | Passed |
| `npm --prefix frontend run build` | Passed; Next.js production output generated |
| `pip check` | No broken requirements |
| Real local HTTP smoke test through uvicorn | 11 checks passed |
| Live OpenAI embedding probe | Skipped: no credentials/domain access and explicit opt-in absent |
| Live GPT-4o structured-output probe | Skipped for the same reason |
| Managed browser UI QA | Attempted, blocked by preview relay and browser runtime |

Offline tests exercise actual PDF extraction; stable chunks/document identities; duplicate, incremental, deleted, missing, malformed and low-text files; page provenance; metadata schemas; filters/FTS syntax; Spanish keyword expansion; evidence-only behavior; citation rejection; generated-answer caching with mocks; source file paths/uploads/auth/origin checks; manual discovery imports; invalid provider credentials with mocks; batched persistent embedding caching; actual local Chroma indexing/query with deterministic mocked vectors; and strict structured-output schema compatibility. Mocked provider results validate code paths, not actual provider performance.

The HTTP test used an ephemeral loopback port and the real local corpus. It checked health, document listing, actual statistics, keyword search, excerpt/page identity, original PDF bytes, Spanish evidence-only chat, four source-checked findings, dry-run ingestion, missing-document errors, and proxied API documentation/schema. It made no external API calls. The script is `scripts/smoke_api.py` and expects the supplied corpus to be ingested.

## Retrieval dataset and metrics

`evaluation/questions.json` contains seven answerable questions linked to exact document/page/quote evidence and one explicitly out-of-domain question. Evaluation validates each reference quote against the actual corpus before scoring. Questions cover SCEM flame modes, SoFIE extinction, Saffire VI scope, CFD methodology, confinement materials, PMMA gravity comparisons, and one Spanish query.

| Measured offline metric | Result | Denominator / interpretation |
|---|---:|---|
| Recall@5 | 6/7 = 0.8571 | Expected source page among five retrieved chunks |
| Citation traceability | 35/35 = 1.0000 | Each retrieved excerpt occurs at its referenced PDF page |
| Out-of-domain insufficient-evidence handling | 1/1 | One question returned no excerpts and an insufficient-evidence response |
| Generated-answer groundedness | Not measured | No live GPT-4o generation |

The PMMA comparison question missed the expected page 1 within the top five, although page 2 of the correct document was retrieved. That miss remains in the dataset and report. Retrieval questions were not rewritten to conceal it.

These are small development-set results, not statistically meaningful generalization claims. Several chunks can come from one document/page. Traceability does not evaluate whether a source supports a generated claim, or whether the source is correct. One out-of-domain example cannot establish calibrated abstention performance. Offline evidence mode intentionally does not synthesize scientific answers and marks the evidence insufficient for a generated answer even when passages exist.

## Reproduce

From the repository root:

```bash
.venv/bin/python -m flame.cli ingest
.venv/bin/pytest -q -ra
.venv/bin/python -m flame.evaluate
.venv/bin/python scripts/smoke_api.py
npm --prefix frontend run typecheck
npm --prefix frontend run build
.venv/bin/pip check
```

Two live probes exist in `tests/test_live_openai.py` and remain disabled by default. Set `RUN_LIVE_OPENAI_TESTS=1` only after configuring credentials, API-domain access and `ENABLE_PAID_API=true`, and deliberately accepting the small API costs.

## Browser attempt

The managed preview initially rejected Vite-shaped daemon flags; `frontend/dev.mjs` translates those flags for Next.js. A subsequent attempt failed with `relay could not open browser port 4173: timed out waiting for relay readiness`; status reported the preview stopped. The shared browser then returned `Browser runtime unavailable`. No separate browser-control path was substituted. No screenshot, desktop/mobile layout verification or browser interaction success is claimed.

Next validation should independently assess answer entailment, conflicting evidence, experimental-condition interpretation, bilingual coverage, partial-gravity generalization and refusal/abstention errors, followed by real browser QA.
