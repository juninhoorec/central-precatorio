# CP-2.4.4A — Real Pilot Report

Date: 2026-09-29

## Executive status

**Pilot not successful.** Document ingestion and page-level text extraction completed, but the compact-list record segmentation was not validated and Qwen did not answer within the standard request window. The data and inference gates are both blocked. No real cases were scored, no cross-document scores were generated, and no model accuracy claim is made.

## Deterministic pipeline validation

- Source: four user-supplied official TJSP/DEPRE PDFs in `.local-data/real-cac/`.
- SHA-256 checks matched the supplied `MANIFEST.json` for all 4 files.
- Registered documents: 4, with the document IDs, hashes and page counts in `CP-2.4.4A-REAL-CORPUS-QUALITY-REPORT.md`.
- Page references indexed: 42,378/42,378; native text extraction failures: 0.
- Documents remain `QUARANTINED / NOT_SCANNED`; the app did not perform malware scanning.
- The extraction store is local under `.local-data/` and ignored by Git. The user-supplied real PDFs and extracted personal text were not added to fixtures, commits, screenshots, public/demo data, or application logs.
- Parser produced 271,791 candidate segments; exact `Ordem de Pagamento:` record boundary validation failed. Accepted CAC records: **0**.

## Corpus quality

Four reports refer to pending precatórios in the 2026-09-04 reference list. PDF page counts match the manifest and `pdfinfo`. The raw text shows inline/adjacent field labels and attorney names, but the current positional parser was not built for this compact layout. Candidate field counts from its invalid segments are excluded from missing-field rates.

Creditor labels are not available through the validated parser. Attorney is a separate role and cannot be treated as creditor. A debtor inherited from a report header is only a planned `REPORT_HEADER` provenance value; no validated record currently carries that assertion.

No validated duplicate candidates, identifier coverage, clusters, discrepancies, or Gold cases were produced. Seed Gold cases 04 and 08 were not reused. Valid real Gold assertions: 0. The full corpus-quality table and limitations are in `CP-2.4.4A-REAL-CORPUS-QUALITY-REPORT.md`.

## Qwen inference diagnostics

Configured model: `qwen3:4b`, local Ollama at `127.0.0.1:11434`.

| Experiment | Real pages | Context | Structured result | Timing | Status |
| --- | ---: | ---: | --- | --- | --- |
| A — one page, tiny prompt, minimal schema | 1 | deterministic page 11,813 from document 731082 | No result captured; collector failed after receiving the response but before persisting the measurements | Not measurable | Incomplete; not retried |
| B — one page plus identifiers | 1 | Not run | — | — | Blocked after endpoint stopped responding |
| C — 3–5 relevant pages | 3 | Not run | — | — | Blocked |
| D — deterministic page around record | 1 | Selected page 11,813; 2,678 extracted characters | Not run | — | Blocked |
| E — full relevant context | 1 indexed page available; complete relevant records not validated | Not run | — | — | Blocked |
| Minimal JSON health request | 0 | Tiny health prompt | No response captured within the standard 45-second observation window; request was stopped to avoid a blind retry | >45 seconds, exact endpoint completion time unavailable | Failed |

Schema size, prompt size, token estimate, model load duration, response size, structured-output validation, and error category for extraction A are **not measurable** because its collector terminated before persisting its response. No automatic retry was configured for these direct diagnostic requests. No provider or model changes were made, and timeout was not increased.

The inference gate is **failed**: there is no measurable structured creditor extraction with validated real evidence. The remaining ladder requests and 3–5 case pilot were not sent.

## Evidence validation and AI safety

- AI output remains observational only; no canonical fields were changed.
- No model result was accepted as a factual claim.
- The attorney/creditor distinction remains enforced; no attorney is promoted to creditor.
- Name-only matching and historical-holder inference were not used.
- Evidence validation cases: 0, because there was no persisted structured output and no validated record segment.

## Cross-document findings

Cross-Document Intelligence measurement was **not run**. The DATA GATE lacks validated records, clusters and Gold; the INFERENCE GATE lacks a measurable structured response and evidence validation. No relationship or discrepancy is claimed from matching unvalidated identifiers.

## Verification and failures

- Focused `tjsp-cac-report` tests: **3 passed** after restoring the existing parser behavior.
- Full test suite: not run.
- TypeScript/build/lint: not run; implementation did not reach a validated parser change.
- PDF page totals and source hashes: verified for all four files.
- Parser adaptation test: failed (3/3 tests) for a rejected experimental boundary change; the production parser was restored.
- Inference collector: failed before recording experiment A metrics due to a collector variable error.
- Minimal Qwen health: did not return within the 45-second observation window; stopped without retry.

## Unresolved limitations

1. Implement and test a layout-specific deterministic parser for the real CAC list format; validate boundaries with `Ordem de Pagamento:` and field/value evidence.
2. Attach exact page spans, record IDs and debtor `REPORT_HEADER` provenance after boundaries are validated.
3. Rebuild real Gold from actual pages; unsupported assertions must be rejected.
4. Create only evidence-supported multi-document clusters, including strong identifier, partial coverage and actual discrepancy cases if found.
5. Diagnose Ollama server responsiveness, then execute the full inference ladder with persisted measurements and no blind retries.
6. Run 3–5 real cases only after both data and inference prerequisites pass.
7. Run cross-document scoring only after both gates pass.
