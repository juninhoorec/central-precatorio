# CP DJEN Real Pilot Report

## Scope

The public DJEN connector was added to the acquisition source adapters and autonomous worker. The only real-source run used one eligible record from the isolated `REAL_AUTONOMOUS_PILOT` database. No production database, remaining queue records, DataJud request, or e-SAJ request was used.

The connector follows the official [DJEN Swagger](https://hcomunicaapi.cnj.jus.br/swagger/index.html) query contract: `GET /api/v1/comunicacao`, `numeroProcesso`, `pagina=1`, and `itensPorPagina=100`. CNJ identifiers are validated before a request and sent as 20 digits; the original formatted value is kept separately. Requests are sequential, cached, and use the documented rate-limit headers. HTTP 429 or a zero remaining count pauses subsequent requests for at least 60 seconds.

## One-case real source test

| Field | Result |
|---|---|
| Isolated eligible candidates inspected | 908 |
| Real records selected | 1 |
| Identifier | DEPRE, masked as `035*************0500` |
| Origin process available | No |
| Requests attempted | 1 |
| Endpoint | `GET https://hcomunicaapi.cnj.jus.br/api/v1/comunicacao` |
| HTTP status | No response before the 12-second client timeout |
| Response state | `SOURCE_UNAVAILABLE` |
| Measured latency | 12.6 seconds |
| Process found / communications / party data / creditor candidate | Unknown; no response body was received |
| Official documents collected | 0 |
| Contacts located | Unknown; no response body was received |
| Five-case and 25-case expansions | Not run; the one-case stability gate failed |

The timeout is not evidence that the process or creditor is absent from DJEN. The query is recorded as attempted, and the case was not classified as `NO_RESULT` or `CREDITOR_NOT_FOUND`. The real result, including the masked identifier and diagnostics, is kept in the ignored local pilot artifact `djen-source-test-result.json`.

## Identifier availability in the isolated 908

The read-only check found 908 eligible rows and 908 valid DEPRE CNJ identifiers. It found no populated `originProcessNumber` in either the operation workflow or normalized CAC import rows, and no origin process in the operation `process` field. Therefore, no real DEPRE/origin-process pair can be selected from this isolated dataset.

## Persisted evidence and qualification semantics

- Successful DJEN responses are preserved as communication evidence with their publication date, tribunal, unit, communication type, hash, text excerpt, source link, and the official certificate route when a hash exists.
- Recipient and attorney names remain role observations. A recipient is not promoted to the current creditor; only an explicit role label in the communication text yields a corresponding role candidate.
- Email/phone strings found in a communication are stored as “Contato localizado” and explicitly marked unverified.
- DJEN communications do not count as requisition/official-letter evidence for `READY_FOR_ANALYST`; the existing requirement for two distinct verified official documents remains unchanged.
- A successful HTTP 200 with `items: []` is `NO_RESULT` for that query. HTTP/network failures, malformed responses, and rate limits remain distinct source outcomes.

## Quality checks

- Focused acquisition and regression tests: 33 passed.
- Full Vitest suite, serial run: 140 passed across 31 files.
- Next.js build's TypeScript check: passed.
- Standalone `npx tsc --noEmit`: reports existing diagnostics in `src/lib/pdf-analysis.ts` (unresolved aliases and implicit `x` types); that file was not changed for DJEN.
- Production build: passed (`npm run build`).
- ESLint on touched application files: 0 errors; 3 existing warnings remain in `autonomous-acquisition.ts`.
- `git diff --check`: passed; only existing LF/CRLF notices were emitted.

## Next integration gate

Do not expand the pilot yet. First establish why the configured official host did not answer from the runtime environment. After connectivity is available, use a different eligible isolated record for the next controlled query rather than repeating this timed-out DEPRE. Resume with five cases only after a parsed HTTP 200 is persisted and the rate-limit headers allow continuing; run 25 only after the five-case batch remains stable.
