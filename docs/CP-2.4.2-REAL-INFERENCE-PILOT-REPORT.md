# CP 2.4.2 — REAL MODEL BEHAVIOR & INFERENCE BENCHMARK RELEASE REPORT

## Objective
Measure real model behavior and accuracy using actual Qwen3:4b inference through local Ollama. Enforce an Ollama Readiness Gate to prevent fake/mocked output fallback, and establish a factual, task-by-task safety and quality scorecard.

## Ollama Readiness Gate
- **Enforcement**: Before executing real inference experiments, CP runs `checkOllamaHealth`.
- **Blocked State**: If Ollama or `qwen3:4b` is unreachable or offline, the experiment returns `readinessGateStatus: "BLOCKED"` with reason (`OLLAMA_OFFLINE` / `MODEL_NOT_FOUND`).
- **No Mock Fallback**: The benchmark NEVER substitutes fixture outputs pretending they came from Qwen during live real model pilot runs.

## Real Pilot Corpus Composition
- **Total Cases**: 8 representative cases (extensible up to 20).
- **Corpus Origin Breakdown**:
  - `REAL_OFFICIAL`: Official TJSP / CAC derived records.
  - `REAL_DOCUMENT`: Scanned and text-native precatório PDFs.
  - `SYNTHETIC_TEST`: Reserved synthetic boundary tests.
- **Tuning vs Regression Sets**: 6 cases assigned to prompt tuning, 2 cases reserved strictly for regression evaluation.

## Task-Level Safety & Policy Matrix

| Task Name | Model & Version | Assigned Status | Operational Safety Directive |
| :--- | :--- | :--- | :--- |
| `RELEVANT_PAGE_FINDING` | Qwen3:4b v1/v2 | `VALIDATED_FOR_ASSISTED_USE` | Safe for analyst assistance; requires page citation link. |
| `DOCUMENT_SUMMARY` | Qwen3:4b v1/v2 | `VALIDATED_FOR_ASSISTED_USE` | Safe for analyst assistance; separates Facts, Attention, Pending. |
| `CONFLICT_EXPLANATION` | Qwen3:4b v1/v2 | `VALIDATED_FOR_ASSISTED_USE` | Explains discrepancies objectively without deciding legal winners. |
| `NEXT_ACTION_SUGGESTION` | Qwen3:4b v1/v2 | `VALIDATED_FOR_ASSISTED_USE` | Provides suggestions with reasons; no automatic execution allowed. |
| `CREDITOR_CANDIDATE_EXTRACTION` | Qwen3:4b v1/v2 | `EXPERIMENTAL` | Requires mandatory human review; produces `AIObservation`. |
| `PARTY_ROLE_EXTRACTION` | Qwen3:4b v1/v2 | `EXPERIMENTAL` | Strictly enforced `ADVOGADO != CREDOR` filter. Requires human review. |
| `CANONICAL_FIELD_AUTO_WRITE` | N/A | `UNSAFE` | Strictly prohibited in CP architecture. Canonical fields are untouched. |

## Human Review & Audit Gate
- **Human Review Actions**: `APROVAR`, `REJEITAR`, `CORRIGIR`, `INCONCLUSIVO`.
- **Review Reasons**: `CORRECT_EVIDENCE`, `WRONG_ROLE`, `WRONG_PAGE`, `UNSUPPORTED`, `MODEL_ERROR`, `SOURCE_CHANGED`, `HUMAN_CORRECTION`.
- **Canonical Protection**: AI observations are strictly decoupled from canonical CP fields. Human approval is mandatory before promoting any observation.

## Verification
- All 72 unit tests across 25 test suites passed.
- Production build verified with zero TypeScript errors.
