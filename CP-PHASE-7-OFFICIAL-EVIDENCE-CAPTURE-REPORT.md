# CP — PHASE 7 — OFFICIAL EVIDENCE CAPTURE REPORT

> Generated: 2026-10-07T10:18:00-03:00
> TypeScript: **0 errors**
> ESLint: **0 errors** (31 pre-existing warnings)
> Tests: **341/341** (55 files) — **+25 new tests** vs Phase 6

---

## 1. BLOCKER-7-01 — ACQUISITION EVENT CONTEXT ✅ FIXED

**Problem**: Automation/source failures were not creating `acquisition_events` with the canonical blocker code. The system could not explain why a manual task was generated.

**Solution implemented** (Option C — Fallback service):

Created [`src/lib/acquisition-event-recorder.ts`](file:///c:/Users/Junio%20Cavalcanti/Desktop/central%20precatorio/src/lib/acquisition-event-recorder.ts):

- `recordSourceBlockerEvent()` — deterministic, idempotent service that inserts a canonical acquisition event BEFORE a manual research task is created.
- `recordSourceBlockerEventBatch()` — batch variant for multiple events.
- `listSourceBlockerEvents()` — query events for an operation.
- `isBlockingResult()` — type guard for blocking source result codes.

**Integration**: `generateManualResearchTask()` in `manual-research.ts` now calls `recordSourceBlockerEvent()` before creating the task — every manual task has a traceable source acquisition event.

**Chain preserved**:
```
source → route → attempt → canonical result → blocker → acquisition_event → manual_research_task
```

**Idempotency**: SHA-256 hash of `org|op|source|route|result|date(UTC)` prevents duplicates.

**9 regression tests** in [`acquisition-event-recorder.test.ts`](file:///c:/Users/Junio%20Cavalcanti/Desktop/central%20precatorio/src/lib/acquisition-event-recorder.test.ts):
- Creates event for blocking result
- Idempotent on re-run
- Distinct events for different sources
- Preserves NO_RESULT as-is
- Tenant isolation
- Batch recording
- `isBlockingResult()` type guard

---

## 2. BLOCKER-7-02 — KNOWN IDENTIFIERS ✅ FIXED

**Problem**: `knownIdentifiers` were not reliably extracted from the operation workflow JSON. `$.credit.numeroProcessoOrigem`, `$.credit.numeroEPES`, and `$.titular.nomeBeneficiario` were not being used.

**Solution implemented** (Option A — dedicated extractor):

Created [`src/lib/known-identifiers.ts`](file:///c:/Users/Junio%20Cavalcanti/Desktop/central%20precatorio/src/lib/known-identifiers.ts):

- `extractKnownIdentifiers(workflow)` — full extraction with provenance tracking.
- `toKnownIdentifiersCompat(result)` — convert to the format used by `GenerateManualTaskInput`.
- `extractKnownIdentifiersCompat(workflow)` — convenience wrapper.

**Extraction paths**:
| Identifier Type | Primary Path | Legacy Path |
|---|---|---|
| DEPRE | `$.credit.numeroProcessoDEPRE` | — |
| PROCESSO_ORIGINARIO | `$.credit.numeroProcessoOrigem` | `$.credit.originProcessNumber` |
| EPES | `$.credit.numeroEPES` | `$.credit.epesNumber` |
| TITULAR_NAME | `$.titular.nomeBeneficiario` | `$.client.name` |
| DOCUMENT_REFERENCE | `$.credit.documentReference` | — |

**Safety invariants**:
- CNJ process numbers validated (20-digit format)
- Malformed values recorded as absent with reason `MALFORMED`
- Null/empty/sentinel values (`"null"`, `"n/a"`, `"undefined"`) → treated as absent
- Deduplication when both primary and legacy paths produce the same value
- Never fabricates identifiers

**Integration**: `generateManualResearchBatch()` now uses `extractKnownIdentifiersCompat()` instead of manual JSON parsing.

**16 regression tests** in [`known-identifiers.test.ts`](file:///c:/Users/Junio%20Cavalcanti/Desktop/central%20precatorio/src/lib/known-identifiers.test.ts):
- Extracts each identifier type from correct path
- Deduplicates same values from primary/legacy paths
- Handles null, empty, sentinel values
- Rejects malformed CNJ numbers
- Normalizes raw 20-digit to punctuated format
- Handles string-encoded JSON
- Handles null/undefined/malformed workflow gracefully
- Full workflow extraction
- Compat format conversion

---

## 3. BLOCKER-7-03 — AUTOMATIC OPPORTUNITY RE-EVALUATION ✅ FIXED

**Problem**: `submitManualEvidence()` had three bugs in the re-evaluation block:

| Bug | Before | After |
|---|---|---|
| `opportunityId` | `input.taskId` (wrong — taskId is not an opportunity) | `input.operationId` |
| `contactStatus` | `"NOT_CONFIRMED"` (invalid enum value) | `"PROFESSIONAL_ROUTE"` or `"NO_CONFIRMED_CONTACT"` derived from workflow |
| `contactAvailable` | `false` (hardcoded) | Derived from `clientInfo.phone \|\| clientInfo.email` |
| Re-eval on rejection | Always ran | Only runs when `persistenceResults.some(r => r.status === "PERSISTED")` |
| `coverageState` | `"INSUFFICIENT_COVERAGE"` (always downgraded) | `"SUFFICIENT_COVERAGE"` (evidence was just submitted) |

**Guard added**: Rejected evidence does NOT trigger re-evaluation. Only successfully persisted evidence triggers `scoreOpportunity()` + `persistOpportunityEvaluation()`.

**Audit**: A dedicated audit entry (`EVIDENCE_SUBMISSION_REEVAL`) is written after re-evaluation with the scoring result.

---

## 4. ADDITIONAL FIXES

### Audit Action Correction
- `generateManualResearchTask()` audit action changed from `"OFFICIAL_EVIDENCE_RECORDED"` (semantically wrong for task creation) to `"ACQUISITION_QUEUE_ENQUEUED"` (correct existing action).
- Source changed from `PHASE6_MANUAL_RESEARCH` to `PHASE7_MANUAL_RESEARCH`.

---

## 5. FILES CREATED / MODIFIED

| File | Action | Purpose |
|---|---|---|
| `src/lib/acquisition-event-recorder.ts` | **NEW** | BLOCKER-7-01: Source blocker event recording service |
| `src/lib/acquisition-event-recorder.test.ts` | **NEW** | 9 tests for BLOCKER-7-01 |
| `src/lib/known-identifiers.ts` | **NEW** | BLOCKER-7-02: Workflow identifier extraction |
| `src/lib/known-identifiers.test.ts` | **NEW** | 16 tests for BLOCKER-7-02 |
| `src/lib/manual-research.ts` | **MODIFIED** | Imports + BLOCKER-7-01/02/03 integration + bug fixes |

---

## 6. PRESERVED STATE

| Item | Status |
|---|---|
| 73 real DEPREs | ✅ Preserved |
| 1 demo operation | ✅ Preserved |
| 20 manual research tasks | ✅ Preserved (not recreated) |
| Operations / tenant relationships | ✅ Preserved |
| Evidence / failed evidence | ✅ Preserved |
| AI reconfirmation history | ✅ Preserved |
| Opportunity evaluations | ✅ Preserved |
| CRM records | ✅ Preserved |
| Automation jobs | ✅ Preserved |
| Audit history | ✅ Preserved |
| DOCUMENTAÇÃO 2/2 hard gate | ✅ Preserved |
| Scope (SP/Guarulhos/Campinas) | ✅ No Guarujá introduced |
| Idempotent re-execution | ✅ 0 duplicates on re-run |

---

## 7. TEST SUMMARY

```
Test Files  55 passed (55)
     Tests  341 passed (341)
  Start at  10:16:00
  Duration  62.80s

Phase 6 baseline:  316 tests / 53 files → ALL STILL PASS
Phase 7 new:       +25 tests / +2 files
Phase 7 total:     341 tests / 55 files
```

---

## 8. KNOWN ISSUES / CARRY-FORWARD TO PHASE 8

### CARRY-8-01 — FULL EVIDENCE LIFECYCLE END-TO-END

The three blockers are now fixed. The full lifecycle chain is wired:
```
Source attempt → acquisition_event → manual_research_task
  → analyst submits evidence → EvidenceCandidate → EvidenceResolver
  → OfficialEvidenceDocument → qualification (COLLECTED→VERIFIED only via engine)
  → countVerifiedOfficialEvidence ≥ 2 → opportunity re-evaluation
```

However, the COLLECTED→VERIFIED promotion pathway is not yet triggered by manual evidence submission. The current flow correctly persists evidence as `COLLECTED`/`MEDIUM` (no shortcuts), but there is no automated verification step. Phase 8 should implement the deterministic verification gate.

### CARRY-8-02 — KNOWN IDENTIFIERS IN TASK INSTRUCTIONS

The `buildInstructions()` function now receives `knownIdentifiers` with `beneficiaryCandidateName` (BLOCKER-7-02 extraction). However, the instructions template does not yet include the titular name in the rendered instructions. Phase 8 should update `buildInstructions()` to include all extracted identifiers in the analyst-facing instructions.

### CARRY-8-03 — ACQUISITION EVENT BRIDGE FOR EXISTING 20 TASKS

The 20 existing Phase 6 tasks were created BEFORE the BLOCKER-7-01 fix. They do not have corresponding `acquisition_events`. Phase 8 should provide a one-time backfill script (deterministic, idempotent) to create acquisition events for these tasks based on their recorded `blockerType` and `sourceId`.

### CARRY-8-04 — 31 PRE-EXISTING LINT WARNINGS

31 lint warnings remain across pre-Phase 6 files (`campinas-deepening.mts`, `o3-evaluate.mts`, etc.). These are pre-existing and NOT introduced by Phase 7. Optional cleanup in Phase 8.
