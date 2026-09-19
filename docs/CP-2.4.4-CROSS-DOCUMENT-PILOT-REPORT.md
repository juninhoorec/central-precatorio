# CP 2.4.4 — Cross-Document Pilot Report

## Final Status

`REAL_INFERENCE_STATUS: PARTIAL_ATTEMPTED; CROSS_DOCUMENT_EVALUATION_BLOCKED`

The real Ollama readiness gate passed, but the cross-document quality pilot did not complete. One real party-extraction case was attempted and timed out. No AI output was scored, no mock or fallback output was accepted, and no corpus-wide metric is reported as zero. The 2.4.4 pilot must not be called complete.

## Pilot Scope and Corpus

- Experiment ID: `CP24-CROSSDOC-PILOT-001`
- Existing seed corpus: 8 items, declared as 5 `REAL_OFFICIAL`, 3 `REAL_DOCUMENT`, and 0 `SYNTHETIC_TEST`; 6 tuning items and 2 regression items.
- These are source-origin labels in an in-memory seed, not independently verifiable provenance. The records contain a single `documentText` each and no source URL, stored document ID, checksum, or relation IDs.
- Every item has a GoldAnnotation object. Exact gold evidence excerpts occur in the associated text for 6/8 items. Cases 04 and 08 have excerpts that do not occur in their `documentText`; they were excluded from selection.
- Six items have text-valid gold evidence: cases 01, 02, 03, 05, 06, and 07. Case 07 is reserved for regression and was not reached by inference.
- A metadata-only inspection of the local document store found one active PDF in one operation, not a multi-document cluster. No real document pair was available to validate SAME_PRECATORY, cross-document changes, or source conflicts.

## Readiness and Model

- Provider/model: Ollama local, `qwen3:4b`.
- Effective URL: `http://127.0.0.1:11434`.
- API: `POST /api/chat`; `stream:false`, `think:false`, `format:"json"`.
- Health gates immediately before task attempts returned `READY`, with tags/model/generation/structured output all `OK`.
- Observed health requests took 53,113 ms (`coldStart:true`) and 51,895 ms (`coldStart:false`). These are health prompt timings, not pilot task latency.
- No persistent provider or model configuration was changed. The isolated diagnostic used only an in-memory timeout override for one request.

## Gold and Task Selection

The selected, evidence-text-valid cases could support single-document party/creditor extraction. They do not establish a multi-document relationship. The only task attempted was the existing `CREDITOR_CANDIDATE_EXTRACTION` task as a limited `PARTY_RECONCILIATION` probe:

| Case | Origin label | Gold evidence | Selected | AI result |
| --- | --- | --- | --- | --- |
| 01 | REAL_OFFICIAL | Text match | Yes | TIMEOUT |
| 02 | REAL_OFFICIAL | Text match | Eligible, not reached | Not run |
| 03 | REAL_OFFICIAL | Text match | Eligible, not reached | Not run |
| 04 | REAL_DOCUMENT | No text match | Excluded | Not run |
| 05 | REAL_DOCUMENT | Text match | Eligible, not reached | Not run |
| 06 | REAL_OFFICIAL | Text match | Eligible, not reached | Not run |
| 07 | REAL_DOCUMENT | Text match; regression | Reserved; not reached | Not run |
| 08 | REAL_OFFICIAL | No text match | Excluded | Not run |

Prompt/schema were `v1`/`v1`. Case 01 used one document-text field (274 characters; 690-character task prompt; one gold page). The model task output schema has roles and evidence text but no document ID or page field, so it cannot satisfy the requested cross-document evidence contract or page-accuracy measurement by itself.

## Real Inference Attempt

The readiness check passed. Case 01 was then submitted through the existing `creditorExtractionTask` and CP structured provider, with no fixture output:

- Default task run: all 3 HTTP attempts timed out (`timeoutMs: 45,000`, `maxRetries: 2`). The task threw after 2 retries; no structured output was returned.
- Isolated diagnostic run of the same case/task/prompt/schema: one real request with an in-memory per-call diagnostic configuration of 120,000 ms and zero retries also timed out. No source configuration was changed.
- Total task HTTP inference attempts: 4; successful task outputs: 0; schema-valid task results: 0.
- The 120-second diagnostic request establishes a timeout at that configured deadline; exact wall-clock timing was not captured by the command wrapper.
- A later health check passed again. This shows that the tiny health request can succeed while this task request fails; it does not prove task readiness.

This was not a completed quality evaluation. The one attempted case-task has an execution failure (`TIMEOUT`), not an evaluated AI answer. No answer was passed to the evaluator or human review.

## Task Results and Metrics

All cross-document tasks require real document-pair context and usable gold; neither is available here. `NOT_APPLICABLE` below means no valid cross-document sample was available, not a zero error rate.

| Task | Applicable cross-document samples | Completed outputs | Status |
| --- | ---: | ---: | --- |
| `CROSS_DOCUMENT_SUMMARY` | 0 | 0 | NOT_ENOUGH_DATA |
| `PARTY_RECONCILIATION` | 1 single-document probe | 0 | TIMEOUT; quality NOT_ENOUGH_DATA |
| `CHANGE_EXPLANATION` | 0 | 0 | NOT_ENOUGH_DATA |
| `CESSION_ANALYSIS` | 0 | 0 | NOT_ENOUGH_DATA |
| `SUCCESSION_ANALYSIS` | 0 | 0 | NOT_ENOUGH_DATA |
| `CURRENT_HOLDER_ANALYSIS` | 0 | 0 | NOT_ENOUGH_DATA |
| `SOURCE_CONFLICT_EXPLANATION` | 0 | 0 | NOT_ENOUGH_DATA |
| `CASE_NEXT_ACTION` | 0 | 0 | NOT_ENOUGH_DATA |

| Metric | Numerator / denominator | Result |
| --- | ---: | --- |
| `FALSE_CREDITOR_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `ATTORNEY_AS_CREDITOR_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `FALSE_CESSION_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `FALSE_SUCCESSION_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `FALSE_CURRENT_HOLDER_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `FABRICATED_IDENTIFIER_RATE` | 0 / 0 scored outputs | NOT MEASURED |
| `UNSUPPORTED_CLAIM_RATE` | 0 / 0 factual claims | NOT MEASURED |
| `CORRECT_ABSTENTION_RATE` | 0 / 0 scored abstentions | NOT MEASURED |
| Evidence accuracy | 0 / 0 AI evidence spans | NOT MEASURED |
| Page accuracy | 0 / 0 page predictions | NOT MEASURED |

No quality rates are reported as 0%; the model produced no task output to score.

## Latency, Cache, and Resource Use

- Task latency: no successful latency sample. The default request budget was 45 seconds per attempt; the isolated diagnostic request reached its configured 120-second timeout.
- Health latency is reported separately above and is not substituted for task latency.
- Task-cache check: not run. No completed output existed for a cache replay or invalidation comparison.
- Task HTTP calls: 4 unsuccessful new inference attempts; cache hits: 0. These were not successful `NEW_INFERENCE` results.
- Provider concurrency limit remains 1. Ollama reported qwen loaded after the timeout; process inspection found the local `llama-server` process using approximately 2.6 GB resident memory. No controlled GPU/CPU utilization or energy measurement was collected.
- Min/average/median/p95/max task latency: NOT MEASURED because there were no completed task results.

## Failure Analysis

- Case/task: case 01, `CREDITOR_CANDIDATE_EXTRACTION`.
- Context: one short, single-document text; gold evidence excerpt matched the text.
- AI result: none; structured generation timed out.
- Gold: present for the case, but no comparison against AI output was possible.
- Category: `TIMEOUT` / `MODEL_FAILURE` at execution level; no semantic category can be assigned.
- Prompt/model: task prompt `v1`, schema `v1`, `qwen3:4b`.
- Human correction/review: not applicable; no output to review.
- Root cause: isolated to longer task generation versus successful minimal health prompts. The available evidence does not establish whether this is prompt/task inference cost, Ollama scheduling/resource contention, or another runtime issue. Do not claim model-quality failure or health stability for long tasks based on the health check.

## Deterministic vs AI, Human Review, and Usefulness

- Deterministic baseline for a real document cluster: unavailable because the store contains no multi-document operation. No `AI_ADDS_VALUE`, `AI_REPEATS_CP`, `AI_WORSENS_RESULT`, or `AI_UNCLEAR` case could be assigned.
- Human review: 0 results reviewed; no reviewer decision, reason, or timestamp exists for this experiment.
- Analyst time-saving proxy: NOT MEASURED; no result was available for an analyst to use.
- Prompt v1/v2 comparison: not run; no cross-document v2 or usable v1 output exists.
- Regression: case 07 remained reserved and was not run.

## Validation and Safety

- No canonical fields were written or promoted.
- No cross-tenant content was added to a prompt; the selected corpus entries are in-memory seeds, not tenant-linked documents.
- Deterministic relation, source-matrix, and evidence-engine unit tests are not evidence of model quality.
- Latest repository verification before this report: `npm test` 88 passed; TypeScript passed; production build passed; focused lint passed. Full lint remained unclean with 19 errors and 12 warnings in AI/pilot/document modules.
- E2E, human-review workflow, task-cache invalidation, and task-level AI fallback were not exercised in this pilot attempt.

## Recommended Next Step

Do not expand inference or claim 2.4.4 validation yet. First provide an auditable, human-verified set of real document clusters with stable document IDs, source/page references, checksums, and corrected gold evidence (including review of cases 04 and 08). Separately diagnose why the short health call passes while a 690-character extraction task exceeds 120 seconds; capture per-request Ollama timing and resource state without automatic retries. Then rerun one controlled task on one cluster, validate its evidence, and only then expand sequentially to the eligible corpus and human review.