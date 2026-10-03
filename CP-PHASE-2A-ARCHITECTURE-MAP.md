# CP — Phase 2A Architecture Map

## Executive status

**PHASE 2A DISCOVERY COMPLETE / NOT YET READY FOR PHASE 2B.** The discovery and documentation are complete, but repository-wide readiness remains pending until the pre-existing ESLint errors recorded in the final validation are resolved. Phase 2A documents existing behavior only; it does not connect the prepared evidence pipeline to production.

All findings below are classified explicitly as **CONFIRMED**, **NOT VERIFIED**, **NOT FOUND AFTER READ-ONLY SEARCH**, or **MISSING RUNTIME CONNECTION**.

## Current architecture

### Source acquisition and coverage

**CONFIRMED:** source adapters in `src/lib/acquisition-sources.ts` are used by `src/lib/autonomous-acquisition.ts`. The acquisition worker records source attempts and calls `canonicalizeSourceResult` from `src/lib/source-coverage.ts` for DJEN and DataJud results.

**CONFIRMED:** `SourceSnapshot` is the persisted source-monitoring model in `src/lib/source-monitor.ts` (`capture_source_snapshots`); it captures source health/content metadata. It is distinct from a research/evidence snapshot.

```
Source adapters / source monitor
  -> SourceSnapshot (source-monitor only)
  -> CanonicalSourceResult (acquisition worker)
  -> evaluateSourceCoverage (authoritative evaluator)
```

**MISSING RUNTIME CONNECTION:** `evaluateSourceCoverage` has no production caller found by repository search; its current callers are tests. `canonicalizeSourceResult` is used in production, but its result is not passed to `evaluateSourceCoverage`.

`evaluateSourceCoverage` is the authoritative evaluator for its coverage model. Its status semantics preserve the invariant that `EMPTY_RESPONSE`, `NO_RESULT`, timeout, transport, authorization, rate-limit, and source failures are source-level outcomes; they must not automatically become global `NOT_FOUND`.

### Prepared research/evidence pipeline

```
research-pipeline.ts (types)
  -> EvidenceCandidate
  -> EvidenceResolver
  -> ResolvedEvidence
  -> EvidencePackage
```

**CONFIRMED:** `EvidenceCandidate`, `EvidencePackage`, and `ResearchPipelineResult` are exported types in `src/lib/research-pipeline.ts`.

**NOT FOUND AFTER READ-ONLY SEARCH:** no production construction or return of `EvidenceCandidate`, `EvidencePackage`, or `ResearchPipelineResult` was found. `EvidenceResolver` imports the types only.

**MISSING RUNTIME CONNECTION:** the source acquisition / coverage flow above does not construct candidates or invoke this prepared pipeline.

## EvidenceCandidate

**PREPARED BUT NOT INTEGRATED.**

- **CONFIRMED:** the type exists in `src/lib/research-pipeline.ts` and carries acquisition provenance, document identity, URLs, hashes, and raw payload.
- **NOT FOUND AFTER READ-ONLY SEARCH:** no production construction or production caller was found.
- **MISSING RUNTIME CONNECTION:** there is no production flow from acquired source data to `EvidenceCandidate`.

## EvidenceResolver

**PREPARED BUT NOT INTEGRATED.**

- **CONFIRMED:** `resolveEvidenceCandidates` in `src/lib/evidence-resolver.ts` deterministically matches hash, document identifier, DEPRE/CNJ identifier, source/reference, and official URL; duplicate resolved IDs become unresolved.
- **NOT FOUND AFTER READ-ONLY SEARCH:** no production caller was found.
- **MISSING RUNTIME CONNECTION:** it accepts `OfficialEvidenceDocument[]` as an argument but does not load, persist, or otherwise connect itself to `official_evidence_documents` at runtime.
- **NOT VERIFIED:** isolated consumers outside repository source/tests were not inspected.

## Coverage versus DOCUMENTAÇÃO 2/2

These are separate concepts.

- **Source coverage** evaluates whether independent source attempts have yielded useful, empty, unavailable, or otherwise classified results. Provider, source, and route are distinct: multiple routes to one underlying `sourceId` are not independent documentary sources.
- **DOCUMENTAÇÃO 2/2** counts qualifying persisted official documents. It is not satisfied merely by source coverage, route count, an empty response, or AI interpretation.

## OfficialEvidenceDocument and DOCUMENTAÇÃO 2/2

**CONFIRMED:** `OfficialEvidenceDocument` is the model in `src/lib/autonomous-acquisition.ts`, persisted in `official_evidence_documents` by `recordOfficialEvidence`.

Persistence safeguards:

- tenant and operation ownership are checked;
- source and download URLs must be official URLs;
- a `VERIFIED` document requires an identifier or reference;
- `(organization_id, operation_id, idempotency_key)` has a unique index and writes use `INSERT OR IGNORE`.

`countVerifiedOfficialEvidence` is the authoritative DOCUMENTAÇÃO 2/2 counter. A document qualifies only when all conditions hold:

1. `status === VERIFIED`;
2. `evidenceStrength === STRONG`;
3. `documentType` is `OFICIO_REQUISITORIO` or `OFICIO_COMPLEMENTAR`;
4. `sourceUrl` is an official HTTPS URL;
5. `documentIdentifier` or `reference` is non-empty.

**CONFIRMED:** qualifying documents are deduplicated by hash when present; otherwise by normalized document identifier; otherwise by document type, source URL, and reference. Existing checks are in `src/lib/autonomous-acquisition.test.ts` (the `countVerifiedOfficialEvidence` cases, including duplicate, missing identifier/reference, two-document, and non-qualifying-type cases).

## Normalization audit

`src/lib/identifier-normalizer.ts` is **CANONICAL** for the prepared new evidence pipeline only. It returns `NormalizedIdentifier` with an explicit method and unresolved reason for CNJ, DEPRE, official URLs, and document identifiers. It is currently called by `evidence-resolver.ts` only.

No normalizer was changed or removed in Phase 2A. The following is the complete catalog of normalization implementations identified by read-only repository search. “Replace safely” means whether replacing it with the new pipeline module without a behavior decision could change current behavior.

| File / function | Classification | Input → output and semantics | Current callers | Replace safely? |
| --- | --- | --- | --- | --- |
| `src/lib/identifier-normalizer.ts`: `normalizeCnjIdentifier`, `normalizeDepreIdentifier`, `normalizeOfficialUrl`, `normalizeDocumentIdentifier`, `normalizedIdentifiersMatch` | CANONICAL | Identifier/URL strings → structured normalized value or explicit unresolved result; CNJ validation, DEPRE digit handling, HTTPS URL canonicalization, document whitespace/case comparison | `evidence-resolver.ts` | N/A — canonical only for new pipeline |
| `src/lib/acquisition-sources.ts`: `normalizeCnjProcessNumber` | DUPLICATE_DIFFERENT_SEMANTICS | CNJ string → digits only, with CNJ validity support used by adapters | acquisition adapters, `autonomous-acquisition.ts`, experimental DataJud, tests, and canonical normalizer | No; active adapter query semantics |
| `src/lib/creditor-resolution.ts`: `norm`, `normalizeOfficialProcess` | DUPLICATE_DIFFERENT_SEMANTICS | Names/process strings → accent-free lower-case alphanumeric key for creditor/document correlation | internal creditor resolution | No; conflates free-text comparison with process matching |
| `src/lib/lead-qualification.ts`: `norm` | DUPLICATE_EQUIVALENT | Text → accent-free lower-case alphanumeric key | internal qualification matching | No decision yet; different domain boundary |
| `src/lib/tjsp-import.ts`: `normalize`, `normalizeProcessIdentifier` | LOCAL/SPECIALIZED | CSV values/headers → folded token key; process → digits-only | importer header matching, dataset profiling, tests | No; import parsing rules differ |
| `src/app/api/capture/import/route.ts`: `normalize` | LOCAL/SPECIALIZED | imported capture fields → folded alphanumeric key | capture import deduplication and header matching | No; route-local import behavior |
| `src/lib/tjsp-cac-record-parser.ts`: local `folded` expression | LOCAL/SPECIALIZED | report text → accent-free, whitespace-collapsed display/parser key | CAC report parser | No; parser-specific |
| `src/lib/ai-reconfirmation.ts`: `normalizedObservation` and value normalization helper | LOCAL/SPECIALIZED | observations/values → comparison keys for reconfirmation semantic guards | AI reconfirmation validation | No; not evidence identity normalization |
| `src/lib/ai/document-evidence-engine.ts`: `norm` | LOCAL/SPECIALIZED | document text/query → accent-free lower-case trimmed search key | document-evidence engine | No; text-search semantics |
| `src/lib/ai/cross-document-engine.ts`: `normalizeValue` | LOCAL/SPECIALIZED | extracted document values → locale lower-case alphanumeric comparison key | cross-document comparison | No; comparison semantics |
| `src/lib/ai/ai-evaluator.ts`: `norm` | LOCAL/SPECIALIZED | evaluator text → accent-free lower-case trimmed key | AI evaluator | No; evaluator semantics |
| `src/lib/ai/ai-provider.ts`: `normalize` | LOCAL/SPECIALIZED | JSON Schema object → recursively normalized schema object | provider schema preparation | No; structural JSON, not identifiers |
| `src/lib/pdf-analysis.ts`: local `normalized` | LOCAL/SPECIALIZED | file/office labels → accent-free lower-case containment key | PDF office matching | No; fuzzy containment semantics |
| `src/lib/capture-benchmark.ts`: `norm` | TEST_ONLY | benchmark strings → accent-free alphanumeric key | benchmark module only | No production impact |
| `src/lib/source-coverage.ts`: `normalizeStatus` | LOCAL/SPECIALIZED | raw result/HTTP/result count → canonical source-result status | `canonicalizeSourceResult` | No; status normalization, not identity |
| `src/lib/brl.ts`: local amount normalization | LOCAL/SPECIALIZED | Brazilian money text → numeric parse input | BRL parser | No; numeric semantics |

## Availability

**CONFIRMED:** operational availability is modeled independently in `src/lib/operational-workflow.ts` (`AVAILABLE`, `UNAVAILABLE`, `UNDER_REVIEW`). Acquisition/research/AI do not redefine it. `src/lib/autonomous-acquisition.test.ts` verifies that acquisition processing preserves inventory availability. Phase 2A made no change to the existing 73-case availability behavior.

## AI evidence identity boundary

**CONFIRMED:** AI does not create `OfficialEvidenceDocument` IDs. `src/lib/ai/ai-provider.ts` instructs outputs never to invent IDs. In reconfirmation, the system supplies evidence/document tokens, maps only known tokens to existing UUIDs, and rejects unrecognized or out-of-run references in `src/lib/ai-reconfirmation.ts`.

AI may interpret or reconcile the supplied packet. The system remains authoritative for evidence identity, persistence, validation, and DOCUMENTAÇÃO 2/2; AI does not decide 2/2 alone.

## Database scope

Relevant tables are `official_evidence_documents`, `acquisition_events`, `acquisition_source_cache`, `autonomous_acquisition_jobs`, `acquisition_contacts`, and source-monitor tables including `capture_source_snapshots`. Their roles were inspected only. Phase 2A requires no operational database migration or data mutation.

## Phase 2B candidates (roadmap only)

1. Connect acquisition/`SourceSnapshot` to deterministic normalization.
2. Construct `EvidenceCandidate` deterministically.
3. Invoke `EvidenceResolver`.
4. Connect resolved evidence to official-evidence persistence.
5. Connect the coverage evaluator to the appropriate production flow.
6. Decide how and where duplicate normalizers should be consolidated.

No Phase 2B item is implemented by this document.

## Phase 2B.1 — Deterministic EvidenceCandidate Construction

**CONFIRMED:** `buildEvidenceCandidates` in `src/lib/research-pipeline.ts` is a pure local boundary from the existing `SourceAcquisitionResult` type to `EvidenceCandidate[]`. `SourceSnapshot` remains excluded: it records source-monitor health and does not carry the per-document provenance required by an evidence candidate.

Input is accepted only when `status === "SUCCESS"` and `metadata.evidenceCandidates` explicitly contains document metadata. This prevents extraction or inference from arbitrary raw payloads and prevents HTTP 200, an empty payload, or source failures from manufacturing a candidate. `EMPTY_RESPONSE`, `NO_RESULT`, `TIMEOUT`, `TRANSPORT_FAILURE`, `SOURCE_UNAVAILABLE`, `AUTH_REQUIRED`, `CAPTCHA_REQUIRED`, `MANUAL_REQUIRED`, `HTTP_ERROR`, `ENDPOINT_NOT_FOUND`, and `NETWORK_ERROR` return an empty list.

The function preserves provider, source, sourceId, route, original query identifier, original endpoint URL, source reference, content hash, content fingerprint, and raw document/source payload. It adds deterministic CNJ/DEPRE query normalization, document-identifier normalization, and official-HTTPS URL normalization through `identifier-normalizer.ts`. Invalid or non-HTTPS official URLs remain `null`; no valid URL, identifier, hash, reference, provider, source, route, or evidence ID is invented.

`src/lib/research-pipeline.test.ts` covers valid construction, excluded statuses, empty HTTP 200 results, invalid URLs, CNJ/DEPRE normalization, provenance, determinism, same-source/different-route behavior, and absence of fabrication (18 tests).

**MISSING RUNTIME CONNECTION:** this phase deliberately does not call `resolveEvidenceCandidates`, does not load or persist `OfficialEvidenceDocument`, and does not invoke coverage evaluation. EvidenceResolver integration remains Phase 2B.2; official-evidence persistence remains Phase 2B.3; coverage production integration remains separate work.

## Phase 2B.2 — Deterministic Evidence Resolution

**CONFIRMED:** `resolveEvidenceCandidatesForAcquisition` in `src/lib/research-pipeline.ts` composes `SourceAcquisitionResult` → `buildEvidenceCandidates()` → `EvidenceCandidate[]` → the existing `resolveEvidenceCandidates()` → `ResolvedEvidence[]`. It is pure: the caller supplies the existing `OfficialEvidenceDocument[]` read-only context, and the function neither loads nor persists documents.

The existing resolver remains authoritative and retains its deterministic priority: `HASH_MATCH`, `EXACT_DOCUMENT_IDENTIFIER`, `EXACT_DEPRE_MATCH`, `EXACT_SOURCE_REFERENCE`, `EXACT_OFFICIAL_URL`, then `UNRESOLVED`. The DEPRE/CNJ criterion now consumes the query identifier preserved by B.1, falling back to the prior source URL field only for older candidates that lack it. Unresolved candidates remain unresolved and receive no fabricated evidence ID. Duplicate claimants for one document retain the existing deterministic duplicate protection.

**CONFIRMED:** resolution and DOCUMENTAÇÃO 2/2 remain separate. A resolved document can have `qualifiesForDocumentation: false`; qualification still uses the existing rules and is not changed here. No source coverage, availability, AI, or network behavior is invoked or changed.

`src/lib/evidence-resolution.test.ts` adds isolated object-fixture coverage for the B.1→B.2 composition, all resolver priorities, unresolved handling, duplicate protection, qualification separation, provenance preservation, determinism, and non-mutation (11 tests).

**MISSING RUNTIME CONNECTION:** `OfficialEvidenceDocument` persistence is still not integrated and remains Phase 2B.3. Coverage production integration remains separate work.

## Phase 2B.3 — OfficialEvidenceDocument Persistence

**CONFIRMED:** `persistResolvedOfficialEvidence` in `src/lib/evidence-persistence.ts` is the isolated persistence boundary from `ResolvedEvidence`/`EvidenceCandidate` to the existing authoritative `recordOfficialEvidence` mechanism. It is not wired into automatic acquisition.

- A resolved `evidenceId` short-circuits to the supplied/read-only existing document and performs no insert.
- An unresolved candidate is persisted only when explicit title, document type, official HTTPS URL, identity (identifier or reference), status, and evidence strength are present; missing data returns a deterministic rejection without a placeholder.
- The existing idempotency index and `recordOfficialEvidence` `INSERT OR IGNORE` behavior are reused. Repeating the same candidate does not create duplicate documentary records.
- Existing document type, status, evidence strength, identifiers, reference, hash, source, URL, and provider/source/route provenance are preserved. No promotion to `VERIFIED` or `STRONG` occurs.
- Persistence does not update operations, availability, coverage, AI state, or DOCUMENTAÇÃO 2/2.

`src/lib/evidence-persistence.test.ts` uses an in-memory SQLite database and covers new persistence, three-run idempotency, resolved-document reuse, rejection of incomplete candidates, provenance preservation, and no implicit qualification.

**MISSING RUNTIME CONNECTION:** coverage production integration and duplicate-normalizer decisions remain outside this phase.

## Validation record

## Phase 3 — Typed acquisition boundary and coverage aggregation

**CONFIRMED:** `SourceAcquisitionResult` now exposes optional `canonicalResult` and a typed `documentaryCandidates` collection. Documentary candidates are accepted only when explicit documentary facts are supplied by an adapter; parties, communications, and process metadata are not promoted to documents.

**CONFIRMED:** `evaluateAcquisitionCoverage` is the production-facing orchestration boundary. It delegates to the single authoritative `evaluateSourceCoverage` evaluator, preserves source-level statuses, and never maps an unsuccessful source attempt to global not-found.

**CONFIRMED:** `DataJudNormalizedResult` and `TjspNormalizedResult` are discriminated unions (`kind: "DATAJUD"` / `"TJSP_JUSCRAPER"`). The active CP code no longer uses `normalized?: any`; source-specific consumers must narrow by discriminator.

The acquisition worker still owns provider-specific execution and remains responsible for supplying these typed results. No documentary evidence is inferred from a source response that lacks explicit document identity or official-document URL.

Run after the Phase 2A test repair:

- `npx vitest run`
- `npx tsc --noEmit`
- `npx eslint .`
- `git diff --check`

The final closure report records their outcomes.
