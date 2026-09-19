# CP 2.4.2A — Ollama Stability Report

## Status
**STABLE READINESS VERIFIED — cold check and post-fix 10-run gate passed.** No CP 2.4.4 corpus inference, benchmark, or AI quality metric was started during this stability gate.
**REVALIDATION REQUIRED — cold-start cause identified and timeout adjusted, but the post-fix 10-run gate is pending.** A previous warm series passed 10/10; a later natural unload reproduced the issue. No CP 2.4.4 corpus inference, benchmark, or AI quality metric was started during this stability gate.

## Verified configuration
The provider health inference timeout is **90 seconds per attempt**. A natural cold request through the CP health route completed in 53,566 ms with `coldStart: true`, no retry, valid structured output, and all four phases `OK`. The following fresh 10-run sequence also passed. The earlier cold request that exceeded 60 seconds occurred under that previous limit; the final 90-second limit covers the measured cold route request. At most one retry remains for a generation timeout. Generation duration accumulates across attempts. If a timed-out attempt is followed by a warm success, `coldStart` is `null` because the first attempt's `load_duration` is unavailable.
- Model: `qwen3:4b`
- Provider path: `POST /api/chat`
- Request fields: `stream: false`, `think: false`, `format: "json"`
3. One minimal structured `/api/chat` request with a 90-second per-attempt timeout.
4. At most one retry, and only when generation times out. Thus generation can consume up to 180 seconds, plus tags/check overhead. There is no separate total-health deadline, and time waiting in the in-process AI queue is not included in `totalHealthMs`.
- Model selection: `CP_AI_MODEL`, then `OLLAMA_MODEL`, then `qwen3:4b`
- Effective Node configuration observed: `http://127.0.0.1:11434`, `qwen3:4b`; no live `OLLAMA_KEEP_ALIVE` override was present. `.env.example` contains an example `OLLAMA_KEEP_ALIVE=5m`, but it is not the running process environment.

## Root-cause evidence

| Cold CP health with 60-second limit | `READY` after one retry; total 76,454 ms; second attempt 16,325 ms; first attempt timed out at 60 seconds |
| Cold CP health with final 90-second limit | `READY`, 53,566 ms; `coldStart: true`; retry false; generation 53,448 ms; structured output 1 ms |
| Post-fix fresh Next health checks | 10/10 `READY`; structured output 10/10; failures 0; retries 0 |
| Post-fix warm health latency | Min 7,431 ms; max 8,694 ms; average 7,806 ms |
| CP restart recovery after final build | Passed: restarted `next dev`, then cold health `READY` and 10/10 subsequent fresh checks |

The cold-start cause was subsequently established: immediately after the later CP health timeout, `/api/ps` showed no loaded model. One isolated Node `/api/chat` request then succeeded in **46,487 ms**, with Ollama reporting `load_duration` **30,296.9 ms** and valid structured JSON. This exceeded the old 15-second per-attempt budget. Health was therefore stopping a valid cold load, not proving the model broken. A subsequent CP request passed once qwen was loaded.

- TypeScript: `npx tsc --noEmit --pretty false` passed after the 90-second policy and health-panel change.
- Production build after the final 90-second policy and health UI changes: passed; TypeScript passed and 49 static pages generated.
- Full lint: failed with 19 errors and 12 warnings, in remaining AI/pilot/document modules (primarily explicit `any`, React effect rules, and unused declarations). Focused lint for provider, health route, tests, and health panel/callers passed. No broad unrelated lint cleanup was undertaken.
- E2E/browser verification of the manual health button: not run in this stability gate.

The health endpoint performs:

The readiness gate is now met: a natural cold CP health returned `READY`, followed by 10/10 fresh warm checks and CP restart recovery. Full lint still has unrelated existing failures; focused lint, tests, typecheck, and build pass. The real CP 2.4.4 pilot was not run here and remains a separate next step, not an automatic side effect of this stability check.
2. Local model-presence validation.
3. One minimal structured `/api/chat` request with a 60-second per-attempt timeout.
4. At most one retry, and only when generation times out. Thus generation can consume up to 120 seconds, plus tags/check overhead. There is no separate total-health deadline, and time waiting in the in-process AI queue is not included in `totalHealthMs`.
5. JSON validation of `message.content`.

The response exposes development diagnostics: `phases`, per-phase timings, `retryUsed`, `coldStart`, `failedPhase`, and total latency. It distinguishes `TAGS_TIMEOUT`, `MODEL_NOT_FOUND`, `GENERATION_TIMEOUT`, `GENERATION_FAILED`, `STRUCTURED_OUTPUT_TIMEOUT`, `STRUCTURED_OUTPUT_FAILED`, and `READY`.

Readiness results are cached for 15 seconds on success and 3 seconds on failure. `GET /api/ai/health?refresh=true` forces a real check. Ordinary concurrent health checks share a request; health checks and structured generation are serialized to one in-process local-AI job. The API route explicitly uses the Node.js runtime. The local route and `next.config.ts` define no `maxDuration`; a deployment adapter may apply its own limit. Development responses include phase timings; production responses omit detailed timing/error internals while retaining status and phase state.

## Stability measurements

| Measure | Result |
| --- | --- |
| Direct PowerShell → `/api/chat` | 5,777 ms; HTTP success; JSON content valid; load duration 25.2 ms |
| Direct Node → `/api/chat` | 11,256 ms; HTTP 200; JSON content valid; load duration 45.4 ms |
| Next route before 10-run series | `READY`, 6,849 ms; generation 6,806 ms; structured output 1 ms |
| Fresh sequential Next health checks before timeout adjustment | 10/10 `READY`; structured output 10/10; failures 0; retries 0 |
| Warm health latency, pre-fix 10-run series | Min 5,213 ms; max 7,522 ms; average 6,938 ms |
| CP dev-server restart recovery | `READY`, 13,496 ms; tags 809 ms; generation 11,637 ms; JSON validation 7 ms; retry false |
| Natural cold Node `/api/chat` | 46,487 ms total; `load_duration` 30,296.9 ms; response JSON valid |
| Cold CP health with old 15-second limit | `GENERATION_TIMEOUT` after two attempts; total 30,262 ms; tags/model OK, generation timed out |
| Cold CP health with new 60-second limit | Not yet measured |
| Historical earlier Node/CP series | 0/10 `READY`; 10/10 generation timeout at two 15-second attempts; retained as incident history, not current result |
| Historical PowerShell failure | Earlier report recorded 43,181 ms and 40,144 ms timeouts; a later direct call in this revalidation succeeded in 5,777 ms |

## Safety and fallback

The intelligence panel shows **“IA local indisponível”** for every non-`READY` status while leaving deterministic CP functionality available. **Verificar IA** triggers a non-cached health check; the panel now also displays the last-check time. No document, Lead Center, search, reconciliation, freshness, or revalidation path was changed.

## Verification

- Provider unit tests: 9 passed, including tags/model/generation/structured phase cases, one bounded retry, cache/shared checks, request settings, and cold-start flag classification.
- Full test suite: 87 passed across 27 files. Evaluator unit tests now mock the extraction-task boundary so `npm test` does not launch real corpus inference; pilot remains a separate operation.
- Ten real sequential Next route checks: 10/10 `READY`, 10/10 structured JSON.
- Node and PowerShell direct chat requests: both returned valid JSON.
- CP dev-server restart recovery: passed once with warm model.
- Cold-start request: directly measured through Node after natural unload; health route has not yet been measured on the cold path with the new 60-second limit.
- TypeScript: `npx tsc --noEmit --pretty false` passed.
- Production build: `npm run build` passed, including TypeScript and generation of 49 pages.
- Full test suite: 88 tests passed; provider-specific suite: 10 tests passed. Evaluator unit tests mock the extraction-task boundary so `npm test` does not launch real corpus inference.
- Full lint: failed with 21 errors and 13 warnings, in AI/pilot/document modules (primarily explicit `any`, React effect rules, and unused declarations). Focused lint for provider, health route, and provider/evaluator test files passed. No broad lint cleanup was undertaken.

## Remaining limitation and release gate

Warm checks passed 10/10 before the timeout fix; cold-start is now measured at 46.5 seconds on direct Node. The 60-second health budget is deployed, but the required post-fix 10/10 series and cold CP health measurement remain pending. Do not resume CP 2.4.4 real inference until those checks pass. Full lint remains unclean; it did not prevent the production build. No pilot was run.
