# CP 2.4.4A — Pilot Data and Inference Diagnostics

## Executive Status

- `CORPUS_DATA_GATE: BLOCKED`
- `INFERENCE_DIAGNOSTICS: PARTIAL; ROOT_CAUSE_NOT_IDENTIFIED`
- `CROSS_DOCUMENT_PILOT: NOT_STARTED`

The readiness check proves the minimal health prompt can work. It does not prove a document task works. No CAC PDF with a verifiable document ID/page was found in the workspace, Downloads, Desktop, OneDrive, or Documents. Accordingly, the requested real-page inference ladder was not run and no quality metrics were produced.

## A. Corpus Gate

### Corpus quality

| Measure | Result |
| --- | ---: |
| Existing in-memory pilot seeds | 8 |
| Declared `REAL_OFFICIAL` | 5 |
| Declared `REAL_DOCUMENT` | 3 |
| Declared `SYNTHETIC_TEST` | 0 |
| Items with any GoldAnnotation object | 8/8 |
| Gold excerpts found verbatim in the seed text | 6/8 |
| Gold evidence meeting document + page + text support rule | 0/8 verified |
| Real CAC PDFs found under the four supplied filenames | 0 |
| Real PDF document IDs available for pilot | 0 |
| Valid multi-document clusters | 0 |
| Cases requiring Gold/source repair | At least 2/8 |

The origin labels belong to an in-memory seed corpus. The seed records do not contain source URLs, actual stored document IDs, checksums, or source-linked page records; the labels could not be verified as source provenance in this workspace. Six evidence excerpts are present in their associated seed strings, but a string match alone does not prove a page in an actual document. Cases 04 and 08 have excerpts absent from their seed text and are explicitly excluded; they are not silently re-annotated as positive or `NOT_ESTABLISHED` without source evidence.

### Operational document store

A metadata-only inspection found one active row:

- Filename: `TESTE-TECNICO.pdf`
- Document ID: `33108138-3455-40e5-9842-e175e223b4a0`
- Organization: `legacy-internal`
- Operation: `498ab589-36aa-4f9c-8c12-741faf83d1d1`
- Size: `0` bytes
- Status: `UPLOADED`
- Scan status: `NOT_SCANNED`
- Category: `OUTRO`

This is not a CAC report and is not eligible for pilot use. The operation has no second document. The named CAC PDFs `ListaPrecatorioPendente_731082.pdf`, `_731655.pdf`, `_731208.pdf`, and `_731257.pdf` were not present in the searched folders. No `PilotCase` or cluster was created, avoiding document IDs disconnected from real files.

## B. Inference Diagnostics

### Runtime configuration observed

- Model: `qwen3:4b`
- URL: `http://127.0.0.1:11434`
- API: `/api/chat`
- `think:false`, `stream:false`, `format:"json"`
- Task config: `timeoutMs=45,000`, `maxRetries=2` (three request attempts maximum)
- Temperature and `top_p`: not configured by the existing provider/task.
- Output-token cap: not configured.
- Existing provider concurrency limit: 1.
- No provider/model setting was changed during this diagnostic.

### Existing real request observations

Readiness calls passed at `READY`, with the minimal `{ "ok": true }` structured health response. The recorded health examples include a warm series around 5.2–8.7 seconds and a natural cold health around 53.1 seconds. Health uses a different, tiny prompt and 90-second limit; it is not evidence that the extraction task works.

A prior real call used seed case 01's unverified 274-character text, not a verified PDF page. It is retained only as an execution diagnostic and excluded from corpus/quality metrics:

- Existing task: `CREDITOR_CANDIDATE_EXTRACTION`, prompt/schema `v1`/`v1`.
- Reconstructed task prompt: 690 characters; task document text: 274 characters.
- JSON Schema serialized size: 697 characters / 697 bytes.
- The default task path timed out on all three requests at the configured 45-second request limit.
- A single diagnostic request with an in-memory 120-second limit and zero retries also timed out without a structured response. Its exact wall-clock duration was not captured by the command wrapper.
- Successful task outputs: 0. Output length, task `load_duration`, and generation time: unavailable because no response was returned.

These measurements show the task input and schema are not large by character count. They do not identify the root cause. Potential causes such as task prompt/schema decoding, Ollama scheduling, model-server resource contention, or request behavior remain unverified. `think:false` and `stream:false` were confirmed; no claim is made that output length, CPU saturation, or GPU configuration caused the timeout.

### Diagnostic ladder

Each row requires a real CAC page. Because no eligible PDF/page was found, these experiments were not sent to Qwen. No synthetic page or seed string was substituted.

| Experiment | Pages | Context chars | Schema bytes | Latency | Result |
| --- | ---: | ---: | ---: | --- | --- |
| 1. Minimal explicit extraction / keyword smoke | 0 eligible real pages | N/A | N/A | N/A | BLOCKED: source PDF unavailable |
| 2. One page plus DEPRE/origin/debtor | 0 eligible real pages | N/A | N/A | N/A | BLOCKED: source PDF unavailable |
| 3. Three to five relevant pages | 0 eligible real pages | N/A | N/A | N/A | BLOCKED: source PDF unavailable |
| 4. Existing creditor task on one real page | 0 eligible real pages | N/A | 697 for existing task schema | Prior unverified seed attempts timed out at configured limits | Not a valid real-page experiment |
| 5. Full relevant context | 0 eligible real pages | N/A | 697 for existing task schema | N/A | BLOCKED: no real cluster/retrieval references |

Exact token counts were not available from this stack and are not estimated. No task-cache test was performed. No case-level output was available for evidence validation, human review, or quality scoring.

## Resource Observation

Ollama reported `qwen3:4b` loaded after the task timeout. A process snapshot showed `llama-server` at approximately 2.6 GB resident memory and `size_vram: 0`; CPU was a cumulative process counter, not a current utilization measurement. These observations are insufficient to attribute the timeout to CPU, GPU, or memory pressure. No benchmark request was run concurrently.

## Safety and Metrics

- No mocks or fixture outputs were substituted for Qwen.
- No task output was scored and no rate was fabricated as zero.
- `FALSE_CREDITOR_RATE`, `ATTORNEY_AS_CREDITOR_RATE`, `FALSE_CESSION_RATE`, `FALSE_SUCCESSION_RATE`, `FALSE_CURRENT_HOLDER_RATE`, `FABRICATED_IDENTIFIER_RATE`, unsupported-claim rate, correct-abstention rate, evidence/page accuracy, and task latency distribution: **NOT MEASURED**.
- No canonical fields were changed.
- No human review, cross-tenant retrieval, or cross-document AI prompt occurred.

## Repository Verification

Latest available verification from the stability phase: 88 tests passed; TypeScript passed; production build passed; focused lint passed. Full lint had 19 errors and 12 warnings in other AI/pilot/document modules. This diagnostics pass changed documentation only; no provider timeout, model parameter, schema, or prompt was changed.

## Safe Next Step

1. Make the four CAC PDFs available in the workspace or identify their exact local paths. Verify file bytes, checksum, page count, and extraction state before registration.
2. Register each actual PDF in the existing document store with its real `documentId`, organization, source metadata, checksum, and extraction/page records; do not use the zero-byte test file.
3. Build the first cluster only after two actual documents share an exact canonical identifier, saving relation evidence from both documents and pages.
4. Repair or exclude the Gold entries for cases 04 and 08 only after inspecting their actual source pages.
5. Run the requested diagnostic ladder sequentially on real pages with one request per experiment and no automatic retry. Record request/response bytes, context characters/pages, schema bytes, time to headers, JSON parse time, Ollama load duration when returned, total latency, and timeout result.
6. Diagnose the long-task timeout before changing provider timeouts or claiming the cross-document inference gate passed.
