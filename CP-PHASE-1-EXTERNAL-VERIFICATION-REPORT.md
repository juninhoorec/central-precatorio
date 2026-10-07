# CP Phase 1 — Correction and External Verification Report

**Audit date:** 2026-10-04  
**Scope:** mandatory correction/closure pass within Phase 1; exactly five selected non-demo DEPRE operations. No operational inventory or evidence records were changed by this pass.

## 1. Executive summary

The three original Vitest failures were reproduced and traced to parallel-worker resource contention: the same 17 tests passed with one worker, with original assertions and the default 5-second timeout unchanged. The Vitest runner now uses one worker. A separate E2E setup defect was also found and fixed: the domain migration called a guarded runtime initializer before recording its required migration marker. The complete suite and E2E suite passed after the corrections.

The five selected cases were researched using exact DEPRE lookups against the public TJSP API and previously recorded official municipal/TJSP sources. The TJSP number-search route returned an empty array for all five cases. Public PDF URLs were reached or redirected, but the web extraction tool did not return readable PDF content; no HTTP status was exposed by that tool. One TJSP party-name search returned the exact DEPRE and official process identifier for one case, but it is a search result, not a qualifying requisitório document. No new evidence was created in this correction pass.

**DOCUMENTAÇÃO 2/2: 0/5 cases qualified.** External case-level documentation remains pending. Local acceptance checks and database integrity checks passed.

## 2. Exact five selected cases

| DEPRE | Municipality/debtor | Operation ID | Real/non-demo |
|---|---|---|---|
| 0165056-11.2021.8.26.0500 | Campinas | `120ca91d-ac87-47a9-83d6-765f56828680` | Yes |
| 0061620-12.2016.8.26.0500 | Campinas | `2ade7ad1-a29d-4551-80ab-2ad59058136f` | Yes |
| 0002075-74.2017.8.26.0500 | Guarulhos | `2da66ef7-5c56-43a1-8eb8-f24ce10d98cd` | Yes |
| 0038850-88.2017.8.26.0500 | Campinas | `433c2565-d5d0-424a-b0e1-af7e1d3962b2` | Yes |
| 0196151-64.2018.8.26.0500 | Campinas | `d9f156b3-a743-4591-b0cf-d9626f87086f` | Yes |

## 3. Baseline database state

Read-only reconciliation of `central-precatorios.db` after the corrections returned:

| Measure | Result |
|---|---:|
| Total operations | 77 |
| Real operations | 76 |
| Synthetic/demo operations | 1 |
| Unique real DEPREs | 73 |
| Duplicate real DEPRE groups | 0 |
| Official evidence records | 12 |
| Qualifying official evidence (authoritative counter) | 0 |
| Orphan evidence | 0 |
| CRM records | 15 |
| CRM tasks | 15 |
| Orphan CRM tasks | 0 |
| CRM activities | 0 |
| Automation jobs | 36 |
| Invalid operation-target jobs | 0 |
| Audit events | 96 |
| Migration `20260919_cp21_foundation` | Present |
| Notification deliveries | 0 |

Evidence classification across all 12 persisted records: 11 `OFFICIAL_RECORD / COLLECTED / MEDIUM`, 1 `OFFICIAL_RECORD / FAILED / MEDIUM`. No record is a qualifying `OFICIO_REQUISITORIO` or `OFICIO_COMPLEMENTAR` with `VERIFIED + STRONG` status. No operation, evidence, CRM activity, or notification was created by the read-only reconciliation.

## 4. Source-by-source external result matrix

`VERIFICATION_INSUFFICIENT` is used where a request was made but the available tool did not expose enough content or transport metadata to establish a source result. It is not recast as `NO_RESULT` or `SOURCE_UNAVAILABLE`.

| Case/route | Official URL | Actual result | Canonical result | Evidence created in this pass |
|---|---|---|---|---|
| 0165056 exact DEPRE, TJSP public API | [TJSP number query](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0165056-11.2021.8.26.0500) | Response body `[]` | `NO_RESULT` | No |
| 0061620 exact DEPRE, TJSP public API | [TJSP number query](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0061620-12.2016.8.26.0500) | Response body `[]` | `NO_RESULT` | No |
| 0002075 exact DEPRE, TJSP public API | [TJSP number query](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0002075-74.2017.8.26.0500) | Response body `[]` | `NO_RESULT` | No |
| 0038850 exact DEPRE, TJSP public API | [TJSP number query](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0038850-88.2017.8.26.0500) | Response body `[]` | `NO_RESULT` | No |
| 0196151 exact DEPRE, TJSP public API | [TJSP number query](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0196151-64.2018.8.26.0500) | Response body `[]` | `NO_RESULT` | No |
| 0038850 party-name search, TJSP public API | [TJSP name query](https://api.tjsp.jus.br/processo/cpopg/search/nmparte/Marcos%20Sampaio%20Tocalino) | JSON returned DEPRE `0038850-88.2017.8.26.0500`, code `DW000CR8L0000`, class `Precatório`, forum `DEPRE`, and name `Marcos Sampaio Tocalino`; it also returned a separate Campinas civil case | `RESULT_FOUND` (search-result linkage only) | No; existing `OFFICIAL_RECORD` retained |
| Campinas Diário Oficial PDF referenced by cases 0165056, 0061620, and 0038850 | [Publication PDF](https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/511454721404472145114514.pdf) | Fetcher reported “Failed to extract meaningful content”; HTTP status and PDF body were not exposed | `VERIFICATION_INSUFFICIENT` | No |
| Campinas Diário Oficial PDF referenced by cases 0165056 and 0196151 | [Publication PDF](https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/561915106409510645619126.pdf) | Fetcher reported “Failed to extract meaningful content”; HTTP status and PDF body were not exposed | `VERIFICATION_INSUFFICIENT` | No |
| Guarulhos Diário Oficial, case 0002075 | [Original PDF](https://diariooficial.guarulhos.sp.gov.br/uploads/pdf/1325059861.pdf) redirected to [final PDF route](https://www.guarulhos.sp.gov.br/diario-oficial/uploads/pdf/1325059861.pdf); the final fetch also reported “Failed to extract meaningful content” | Redirect observed; no readable content or HTTP status exposed | `VERIFICATION_INSUFFICIENT` | No |
| Campinas PDF `1882658638.pdf`, persisted for case 0038850 | [Existing PDF URL](https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/1882658638.pdf) | Existing evidence record only; this URL was not fetched during this correction pass | `NOT_ATTEMPTED_IN_THIS_PASS` | No |

No HTTP status was returned for the PDF extraction errors, so this report does not label those routes as HTTP errors or as a source outage. The TJSP exact-number queries returned literal empty arrays and are preserved as `NO_RESULT`, not as proof that a process or creditor does not exist.

## 5. Existing case evidence and result matrix

All rows below were persisted before this correction pass. New evidence created: **none**. Hash is recorded only where shown; blank hashes prevent content-hash independence verification.

| DEPRE | Existing official evidence before pass | Actual case-level result | New evidence | Status / strength / type | Second-independent-evidence classification | 2/2 |
|---|---|---|---|---|---|---|
| 0165056-11.2021.8.26.0500 | `PMC.2023.00021248-18` at the 2023-04-14 Campinas PDF; `PMC.2023.00075698-85` at the separate Campinas PDF (publication date not recorded) | Exact TJSP query `NO_RESULT`; both PDF extraction attempts insufficient | None | Both `COLLECTED / MEDIUM / OFFICIAL_RECORD`; hashes blank | `VERIFICATION INSUFFICIENT`: two distinct stored references and URLs exist, but underlying contents/hash could not be inspected in this pass; neither has a qualifying document type/status. Independence is not claimed. | No |
| 0061620-12.2016.8.26.0500 | `PMC.2023.00019963-91`, 2023-04-14, Campinas PDF `511454721404472145114514.pdf` | Exact TJSP query `NO_RESULT`; the same publication PDF was not readable through the fetcher | None | `COLLECTED / MEDIUM / OFFICIAL_RECORD` | `DUPLICATE / SAME UNDERLYING DOCUMENT` for the attempted repeat of the same publication route; no distinct second requisitório was established. | No |
| 0002075-74.2017.8.26.0500 | Guarulhos `Edital 002/2024-SF`, dated 2024-07-26, PDF `1325059861.pdf` | Exact TJSP query `NO_RESULT`; Guarulhos PDF redirected, then content extraction failed | None | `COLLECTED / MEDIUM / OFFICIAL_RECORD` | `VERIFICATION INSUFFICIENT`: one official notice is persisted; no second independent case-specific qualifying document was obtained. | No |
| 0038850-88.2017.8.26.0500 | (a) TJSP name-search result `DW000CR8L0000`; (b) failed number-search record with the same identifier/reference; (c) Campinas `PMC.2021.00051374-90` at separate PDF `1882658638.pdf`; (d) Campinas `PMC.2023.00023499-09` in PDF `511454721404472145114514.pdf` | Number query `NO_RESULT`; party-name query returned exact DEPRE and `DW000CR8L0000`; 2023 PDF extraction insufficient; 2021 PDF not fetched in this pass | None | Name result and 2021/2023 records `COLLECTED / MEDIUM / OFFICIAL_RECORD`; number-search record `FAILED / MEDIUM / OFFICIAL_RECORD` | `VERIFICATION INSUFFICIENT`: failed and successful TJSP entries share the same identifier/reference and are not independent; the 2023 record shares a publication with other cases; the separate 2021 PDF is not content-verified or established as a qualifying requisitório. | No |
| 0196151-64.2018.8.26.0500 | Campinas Diário Oficial, page 7, order 84/2019, DEPRE exact, SEI `PMC.2023.00073678-24`, published 2023-09-26; stored SHA-256 `95eb132084e84ceff76a16734ef6984a647a74bf6fddbf33d162cedadec04c07` | Exact TJSP query `NO_RESULT`; its Campinas PDF URL is the same underlying PDF already referenced for case 0165056 | None | `COLLECTED / MEDIUM / OFFICIAL_RECORD` | `DUPLICATE / SAME UNDERLYING DOCUMENT`: this is page 7 of the same PDF URL referenced by case 0165056, not an independent document. | No |

### Cross-document independence checks

- The 2023 Campinas PDF URL `511454721404472145114514.pdf` is reused by cases 0165056, 0061620, and 0038850. Multiple references/pages in this one publication are not independent proof.
- The Campinas PDF URL `561915106409510645619126.pdf` is reused by cases 0165056 and 0196151. Case 0196151's page 7 and case 0165056's stored reference are not two independent documents.
- The two TJSP records for 0038850 use the same process identifier/reference. One route returned the party-name result; the exact-number route returned `[]`. The failed record is not an independent document.
- The 2021 Campinas PDF URL for 0038850 is different from the 2023 publication, but its content was not fetched in this pass and its stored type/status/strength remain non-qualifying. Different URLs alone do not satisfy 2/2.
- No persisted evidence hash exists for the other listed records to prove content-level difference. No duplicate pages, repeated references, or URLs were counted as independent evidence.

## 6. Operational field-resolution matrix

Values below come from the read-only operation/workflow snapshot and official results above. Blank/zero imported fields are not external confirmation.

| DEPRE | Titular | Process | Value / balance | Date-base | Lawyer / OAB | Contact | Source coverage | Opportunity / CRM |
|---|---|---|---|---|---|---|---|---|
| 0165056-11.2021.8.26.0500 | Snapshot `Luiz Carlos Lima`; `CURRENT_HOLDER_NOT_CONFIRMED` | Imported origin/requisition process blank; exact TJSP query `NO_RESULT` | Nominal, gross, and available estimate `0`; unverified | Blank; unverified | Blank / blank | Phone/email blank; no confirmed contact | No persisted `acquisition_events`; exact TJSP route `NO_RESULT`; no coverage conclusion | Operation `Entrada`; CRM `NEW`, no opportunity ID, one existing `OPEN` research task |
| 0061620-12.2016.8.26.0500 | Snapshot `Vivian Cristina de Menezes Eugenio Dias`; `CURRENT_HOLDER_NOT_CONFIRMED` | Imported origin/requisition process blank; exact TJSP query `NO_RESULT` | Nominal, gross, and available estimate `0`; unverified | Blank; unverified | Blank / blank | Phone/email blank; no confirmed contact | No persisted `acquisition_events`; exact TJSP route `NO_RESULT`; no coverage conclusion | Operation `Entrada`; CRM `NEW`, no opportunity ID, one existing `OPEN` research task |
| 0002075-74.2017.8.26.0500 | Snapshot `Elson de Souza Moura`; `CURRENT_HOLDER_NOT_CONFIRMED` | Imported origin/requisition process blank; exact TJSP query `NO_RESULT` | Nominal, gross, and available estimate `0`; unverified | Blank; unverified | Blank / blank | Phone/email blank; no confirmed contact | No persisted `acquisition_events`; exact TJSP route `NO_RESULT`; no coverage conclusion | Operation `Entrada`; CRM `NEW`, no opportunity ID, one existing `OPEN` research task |
| 0038850-88.2017.8.26.0500 | Snapshot `Marcos Sampaio Tocalino`; exact TJSP name result matches DEPRE/code, but current-holder status remains unconfirmed | TJSP name result: class `Precatório`, forum `DEPRE`, code `DW000CR8L0000`; origin/requisition process blank | Nominal, gross, and available estimate `0`; unverified | API `dataRecebimento` literal `17/05/2017`; not interpreted as date-base. Date-base remains blank. | Blank / blank | Phone/email blank; no confirmed contact | No persisted `acquisition_events`; number route `NO_RESULT`; name route returned one exact DEPRE result; coverage not calculated | Operation `Entrada`; CRM `NEW`, no opportunity ID, one existing `OPEN` research task |
| 0196151-64.2018.8.26.0500 | Snapshot has seven names; the official page-7 record names Fernando José dos Santos Oliveira, different from that snapshot. **HISTORICAL CONFLICT — TITULAR NOT CONFIRMED.** | Official publication associates the exact DEPRE with order 84/2019 and SEI reference; origin/requisition process blank; TJSP exact query `NO_RESULT` | Nominal, gross, and available estimate `0`; unverified | Blank; publication date `2023-09-26` is not date-base | Operation blank / blank. Page-7 publication names Carlos Eduardo de Oliveira; association to imported titular is unresolved; OAB not present in stored reference | Phone/email blank; no confirmed contact | No persisted `acquisition_events`; exact TJSP route `NO_RESULT`; no coverage conclusion | Operation `Entrada`; no selected-case CRM record or opportunity found |

The three selected records with stored name/party data remain imported snapshots, not current-holder confirmations. No name-only merge or identity upgrade was made.

## 7. CRM, automation, and outreach

Read-only global state: 15 CRM records, 15 CRM tasks, 0 orphan tasks, 0 CRM activities, 36 automation jobs, 0 invalid operation-target jobs, and 0 notification deliveries.

For these five cases, four CRM records are present at stage `NEW`, with no opportunity ID and one `OPEN` task each titled “Executar pesquisa assistida e registrar pendências.” The fifth case has no CRM record/task in the queried rows. These are pre-existing database rows; this correction pass did not create, modify, or delete them. The task timestamps are 2026-10-04 around 13:38–13:39 UTC. No CRM activity or notification delivery was recorded, and no automatic outreach occurred in this pass.

Each selected case has a persisted `SOURCE_ACQUISITION` automation job with status `FAILED`; exact stored error codes are:

| DEPRE | Stored canonical error | Stored message |
|---|---|---|
| 0165056-11.2021.8.26.0500 | `RESEARCH_NOT_ENABLED` | DataJud query blocked pending explicit RESEARCH authorization |
| 0061620-12.2016.8.26.0500 | `MANUAL_REQUIRED` | Automated query disabled; no request sent |
| 0002075-74.2017.8.26.0500 | `MANUAL_REQUIRED` | Automated query disabled; no request sent |
| 0038850-88.2017.8.26.0500 | `MANUAL_REQUIRED` | Automated query disabled; no request sent |
| 0196151-64.2018.8.26.0500 | `RESEARCH_AUTHORIZATION_REQUIRED` | Source not authorized for research in this environment |

These statuses are not reclassified as `NO_RESULT`. The five cases have zero persisted `acquisition_events`, so source coverage is not established from the job failures or from the manual PDF/API attempts.

## 8. DeepSeek status

`DEEPSEEK_API_KEY` was checked directly and is `NOT_SET`. No DeepSeek request was made.

**AI EXTERNAL VERIFICATION PENDING — CREDENTIAL/EXTERNAL ACCESS UNAVAILABLE.** AI did not create, resolve, or upgrade evidence.

## 9. Three original test failures and root causes

All three original failures had the same observed failure message: `Error: Test timed out in 5000ms. If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".` No assertion failed.

| Test file and test | Original stack location | Affected production modules | Classification and root cause | Intended behavior and correction |
|---|---|---|---|---|
| [src/lib/demo.test.ts](src/lib/demo.test.ts#L2) — `carrega idempotente e remove somente demo` | `src/lib/demo.test.ts:2:44` | `src/lib/operations.ts` | Test-runner/resource contention, not a production regression or bad fixture. Concurrent test files performed schema and SQLite `:memory:` setup/work that exceeded the default test window. | Preserve idempotent demo load and remove-only-demo behavior. Configure Vitest `maxWorkers: 1`; no timeout or assertion change. |
| [src/lib/cp21-e2e.test.ts](src/lib/cp21-e2e.test.ts#L2) — `percorre o caso sintético sem vazar para outra organização` | `src/lib/cp21-e2e.test.ts:2:52` | `src/lib/operations.ts`, `src/lib/audit.ts`, `src/lib/document-storage.ts`, operational workflow | Same parallel-worker contention during a multi-step in-memory integration flow; no failing assertion when isolated. | Preserve tenant isolation, audit integrity, document quarantine, and workflow behavior. Configure one Vitest worker; no timeout/assertion change. |
| [src/lib/autonomous-acquisition.test.ts](src/lib/autonomous-acquisition.test.ts#L58) — `enqueues imported cases once, cheap-rejects below-minimum work, and isolates organizations` | `src/lib/autonomous-acquisition.test.ts:58:3` | `src/lib/autonomous-acquisition.ts`, `src/lib/capture-imports.ts`, `src/lib/operations.ts` | Same parallel-worker contention during schema initialization, import setup, and acquisition processing. The expected queue/source/tenant assertions passed when the three files ran with one worker. | Preserve idempotent enqueue, cheap rejection, and tenant isolation. Configure one Vitest worker; no timeout/assertion change. |

Discriminating reproduction: the exact three files passed with `npx vitest run src/lib/demo.test.ts src/lib/cp21-e2e.test.ts src/lib/autonomous-acquisition.test.ts --maxWorkers=1` (3 files, 17 tests). This supports runner contention rather than an implementation/fixture mismatch.

## 10. Additional internally fixable errors found and corrected

- E2E setup failed before scenarios started because `scripts/migrate-domain.mts` called `initializeOperations`, which correctly requires the migration marker that the same script only inserts after initialization. The migration now calls `applyOperationsSchema` for explicit schema bootstrap, initializes document storage/audit, then records the marker. The E2E database is isolated from the operational database.
- ESLint initially reported five errors in existing local `tmp_*.js` research scripts, plus 21 warnings. These scratch artifacts are now ignored as local-only files in `eslint.config.mjs`; none were deleted or edited. Lint then completed with 0 errors and 21 warnings.

## 11. Final regression and quality results

Final commands after the source corrections:

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 49 test files, 283 tests |
| `npm run test:e2e` | PASS — 2 scenarios |
| `npx tsc --noEmit --pretty false` | PASS — no output/errors |
| `npm run lint` | PASS — 0 errors, 21 warnings |
| `git diff --check` | PASS — only Git line-ending conversion warnings (LF to CRLF) |

The 21 lint warnings are unused-variable/import and React hook dependency warnings in untouched files; no warning was suppressed by this correction.

## 12. Final database integrity

The post-correction audit used SELECT-only queries against the operational database. Counts remain at 77 total operations, 76 real, 1 synthetic/demo, 73 unique real DEPREs, 12 official evidence records, and 0 qualifying evidence. There are no duplicate DEPRE groups, orphan evidence, orphan CRM tasks, or invalid operation-target automation jobs. The expected foundation migration marker is present. No operational inventory/evidence mutation was performed; Playwright used its separate E2E database.

## 13. Limitations

- Official PDF content could not be extracted by the available webpage tool; no HTTP status was returned. This report does not treat extraction failure as source absence.
- TJSP exact-number API queries returned `[]` for all five cases. That is `NO_RESULT` for those requests, not proof of nonexistence.
- The 0038850 party-name API result is a meaningful exact DEPRE search-result linkage, not a current-holder determination or qualifying requisitório.
- Existing municipal records are `OFFICIAL_RECORD / COLLECTED / MEDIUM` (or the one preserved `FAILED` record); none is `VERIFIED / STRONG` of a qualifying type.
- Case 0196151 has a documented titular mismatch between the municipal publication and imported snapshot. Current titular remains unconfirmed.
- No value, current balance, date-base, lawyer/OAB (except a name on the conflicting 0196151 publication), or verified contact was established for the selected cases.
- DeepSeek external verification remains pending because the credential is unavailable.

## 14. Final acceptance

- Three original test failures: fixed at the runner configuration root cause; assertions and timeout policy unchanged.
- Full Vitest, E2E, TypeScript, ESLint, and diff checks: passed as reported above.
- Exactly five real DEPREs: researched and represented in the result matrices.
- Evidence independence and qualification: assessed conservatively; no repeated publication/page/URL counted twice.
- DOCUMENTAÇÃO 2/2: **0/5 qualified**; rule unchanged.
- Inventory and evidence baseline: preserved; no duplicate operation or evidence record added.
- CRM/outreach: no CRM activity or notification delivery; no outreach performed in this pass. Existing CRM rows/tasks and failed source-acquisition jobs are explicitly disclosed.
- DeepSeek: pending, no request made without credential.
- Report generated as a project artifact and ready for delivery.

> PHASE 1 COMPLETE — EXTERNAL VERIFICATION PENDING
>
> REPORT GENERATED AND READY FOR DELIVERY — NOT SENT AUTOMATICALLY.
