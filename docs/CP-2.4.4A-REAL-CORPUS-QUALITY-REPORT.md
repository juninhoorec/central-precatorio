# CP-2.4.4A — Real Corpus Quality Report

Date: 2026-09-29

## Status

- **Document ingestion:** 4/4 files registered with SHA-256 matching the supplied manifest.
- **Page extraction/index:** 42,378/42,378 pages indexed; native text extracted.
- **Record segmentation validation:** **FAILED / NOT ACCEPTED.** The existing `parseTjspCacPage` parser emits 271,791 candidate segments, but its current anchor logic does not validate record boundaries against the actual `Ordem de Pagamento:` marker in this compact list layout. The segment count is diagnostic only and must not be treated as parsed CAC records.
- **DATA GATE:** **BLOCKED.** No validated records, clusters, or real Gold items.
- **INFERENCE GATE:** **BLOCKED.** Local Qwen did not answer extraction requests or a minimal health request within the standard request window; the remaining ladder steps were not run.
- **Cross-document scoring:** Not run because both gates are required.

## Registered documents

All source reference dates are 2026-09-04. Acquisition source: user-supplied `CP_REAL_CAC_PILOT_CORPUS.zip`. Organization scope is `legacy-internal`; storage is isolated under `.local-data/real-cac-pilot.db`. Documents remain `QUARANTINED / NOT_SCANNED`; no antivirus scan was run.

| Filename | documentId | Bytes | SHA-256 | Pages indexed | Manifest pages | Candidate segments (unvalidated) |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| ListaPrecatorioPendente_731082.pdf | `83c59305-8374-4ae5-bb10-3090a27716c7` | 51,849,883 | `3d3f3a74b95061870c0798fae25a1e062fa63c4ffa952f44b3039cdfab1bb033` | 29,819 | 29,819 | 194,007 |
| ListaPrecatorioPendente_731655.pdf | `7028b5de-8e41-415b-bd06-5f7e2aaa6bbe` | 20,627,491 | `aacc5c3c343bbe95e15f951d1c5f49b4961f609142a52bc8a472e20903504d82` | 12,317 | 12,317 | 76,072 |
| ListaPrecatorioPendente_731208.pdf | `575bf515-678d-42c1-a269-ac3042a211fb` | 209,078 | `df46a56c9cfbfc643a5ed13cedba80a7d024b0ad3b1a05a5fc38d1021c1d1dac` | 123 | 123 | 911 |
| ListaPrecatorioPendente_731257.pdf | `1c5068d3-9c3d-4583-a260-23c204f80b36` | 207,997 | `deee8bd265b65770d8ff4dce43cb91a7d3237788db92408fd1b297bb14e2ef30` | 119 | 119 | 801 |

`collectedAt` is local registration time on 2026-09-29; it does not claim the court published/collected the file on that date. The supplied manifest is preserved in the local corpus folder.

## Extraction and structural checks

- Extraction failures reported by the completed ingest: 0.
- Native text was available page by page; page counts match the user-provided manifest and `pdfinfo` for all four files.
- A first-page sample from 731208 contained repeated `Ordem de Pagamento:`, `Nº Processo DEPRE`, `Natureza`, value/date labels, and attorney labels. The fields were fragmented across PDF text items, while some report values are inline or on adjacent lines.
- The production parser was designed around positional `Ordem` anchors and was not adapted to the compact report format. Its unvalidated 271,791 candidate segments are excluded from quality rates.
- Exact, independently validated `Ordem de Pagamento:` segment count: **not measured**. Candidate count is not a substitute.
- No report-derived creditor field is exposed by the deterministic parser. Attorney names do occur in the source, so attorney-as-creditor inference is forbidden. No attorney or creditor claims were promoted to canonical fields.
- Debtor appears in the report header and must be annotated with `REPORT_HEADER` when records can be safely segmented; debtor inheritance has not been attached to validated records yet.

## Field coverage

Missing-field rates are **not reportable** while record boundaries and field-to-record assignments remain unvalidated. In particular, `ES/EP`, budget order, protocol data, legacy autos, lawyers, and creditor presence are not asserted as complete or absent per record based on the invalid candidate segmentation.

## Duplicates, identifiers and clusters

- Exact file-hash duplicate candidates among the four expected documents: 0.
- Identifier coverage across validated records: not measured (zero validated records).
- Strong cross-document reconciliations: 0 validated.
- Partial-coverage clusters: 0 validated.
- Evidence-supported discrepancy/anomaly clusters: 0 validated.
- Candidate identifiers found in raw text are not promoted to relations without record-level page evidence.

## Gold

- Previous seed cases 01–08 are not used as real Gold.
- Cases 04 and 08 are not re-used.
- Gold assertions supported by real page + exact span + real documentId: 0.
- Unsupported Gold items admitted: 0.

## Unresolved limitations

1. Adapt the deterministic parser to this report layout using item-position evidence and validate each boundary against `Ordem de Pagamento:` and neighboring fields.
2. Store field-specific source spans and `REPORT_HEADER` debtor provenance only after validation.
3. Reconcile duplicate identifiers across documents and create evidence-backed clusters.
4. Run local antivirus scanning before promoting documents out of quarantine.
5. Re-run Gold annotation from real pages; do not infer creditors from attorneys or names alone.
6. Diagnose Ollama responsiveness before running extraction experiments or a case pilot.
