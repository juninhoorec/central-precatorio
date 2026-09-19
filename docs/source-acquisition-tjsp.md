# TJSP source acquisition investigation (CP 2.3)

Investigation date: 2026-09-28. This report distinguishes public page availability from data acquisition. No CAPTCHA was solved, bypassed, submitted, or sent to a third party.

## Findings

| Official source | Page | Data mechanism observed | Current status | Useful for current creditor leads? |
|---|---|---|---|---|
| TJSP Credores | `https://www.tjsp.jus.br/Precatorios/Precatorios/Credores` | Static source index; links to lists, searches, maps, and notices | Accessible; navigation page | No records inline |
| Lista Geral | `https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral` | Static category index; categories lead to Comunicados | Accessible; categories are historical archives | No current creditor feed identified |
| Lista Pendentes | `https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes` | Static index linking to CAC and e-SAJ | Accessible; no records inline | No |
| CAC pending list | `https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx` | Public entity selection (684 options observed), legacy GeneXus form, “Listar Todos”, “Busca Avançada”, report generation | Public page accessible; report action is CAPTCHA-protected; `CAPTACAO_ASSISTIDA` | Promising current pending-list path, but no report file or records retrieved in this investigation |
| e-SAJ lists | `https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do` | Public HTML form, entity selector (870 options observed); normal query is GET to `consultarListaPagamentos.do` with selected entity ID | Page/query accessible; `robots.txt` returned HTTP 404 (`ROBOTS_UNVERIFIED`) | In validation; five sample entities had no current pending list or 2026 payments in the displayed response |
| CAC research | Linked from the official Credores page at `/cac/scp/webmenupesquisa.aspx` | Legacy query form for number/name/CPF; CAPTCHA assets are present | Public search, CAPTCHA-protected | Assisted case lookup; not a bulk feed |
| Municipal Comunicados | `https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=113` | Public HTML archive linking to per-entity notices | Accessible; top observed notice dated 2014-08-28 | Historical-only unless a newer record/document is confirmed |
| State Comunicados | `https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=112` | Public HTML archive | Accessible; notices observed through 2013 | Historical-only |

The official Credores page confirms the distinct destinations. The Lista Geral page categorizes State, Municipal and INSS notices. The official FAQ says pending lists are updated monthly around the fifth day and tells users to consult both systems while the transition is underway.

The serial e-SAJ investigation was rerun on 2026-09-28. The same five ordinary public queries returned HTTP 200 and the same entity/year-specific zero-result messages; the observed document request, session-maintenance request and year-filter XHR were unchanged. This repeat does not broaden the five-entity/2026 sample.

## e-SAJ validation sample

The repeatable, serial browser investigation is `npm run source:esaj:investigate`. It selects each entity in the visible public form, presses the ordinary “Pesquisar” control and captures only request path/method/type/status/content type. It does not log cookies, session IDs, hidden fields or creditor names.

Five entity IDs/names were tested:

- Fazenda do Estado de São Paulo (`323322`)
- Município de São Paulo (`323325`)
- Município de Campinas (`324096`)
- CAMPREV (`324145`)
- USP (`323983`)

All five queries returned HTTP 200. Each displayed “Não há lista de precatórios pendentes de pagamento para esta entidade” and “Não foram disponibilizados pagamentos de precatórios para esta entidade no ano de 2026.” Each ordinary query caused a document GET to `/portalDevedor/consultarListaPagamentos.do`, a session-maintenance XHR, and a request to `/portalDevedor/jsp/pagamentos/filtroAno.jsp`. No pagination controls or creditor rows were observed. The result is an observed zero for these entity/year views only; it does not establish that other entities, other years, or records attached to a responsible debtor are empty. The page itself explains that some foundations, autarchies and universities appear under the entity responsible for payment.

Two real official CAC reports were supplied as ZIP/PDF and parsed by the production adapter: 801 records from report 731257 and 911 from report 731208. The reports contain distinct DEPRE identifiers, but no explicitly labeled creditor field; no real record was persisted into an authenticated CP organization and no real acquisition lead was created in this session. The 2014 municipal notice remains historical evidence only and must not enter the current lead profile.

## CP behavior implemented in this phase

- Source snapshots persist independent page health, robots state, page access, final URL/content type, discovery mechanism, acquisition state, form summaries, downloadable links and form-field names. Hidden values are not recorded.
- An unconfirmed `robots.txt` no longer causes the source page itself to be mislabeled inaccessible. The CP checks the small public page and reports both statuses. A `Disallow` rule still prevents that page request.
- CAC is shown as `CAPTACAO_ASSISTIDA`: the person opens the official source, completes any source-requested step, downloads the report, then returns to the Lead Center and imports CSV/XLS/XLSX/PDF/ZIP. PDF/ZIP is restricted to the CAC adapter, which extracts the text-native pending report and delegates normalized rows to the existing importer for normalization, idempotency, deduplication/reconciliation, provenance, qualification and audit.
- The assisted import preview profiles CSV files in full and profiles at most 100 rows per Excel sheet. It reports field types, null/unique rates, duplicate rows, malformed type counts, normalized examples and candidate creditor/process identity fields. Excel profiling is explicitly labeled as a sample; profiling does not validate source authenticity, import records or create leads.
- Source provenance and collection time are preserved in the existing import batch/evidence pipeline. Repeated data contributes an observation to the existing operation; conflicting values are retained for human review.
- e-SAJ zero-result responses remain a validation result, not an unavailable/empty-source claim.
- No always-on worker or scheduler is configured in this project. A watch folder has not been enabled; files are selected explicitly by a user and previewed before processing.
- PDF support is not enabled for dataset ingestion: this investigation did not obtain the CAC output format or a current PDF list, and the existing PDF extractor is for case-document evidence rather than tabular list ingestion. CSV/XLS/XLSX use the established import path.

## Remaining acceptance blockers

1. A human must complete the official CAC CAPTCHA and import the real report within an authenticated organization to verify persisted provenance, qualification, deduplication and lead creation.
2. The parser currently identifies Processo DEPRE, process originário, amount and page/card for all parsed records; creditor names were not explicitly labeled in the supplied reports and must not be inferred.
3. The reports do not establish a source reference date or a new status revalidation; the printed date was mapped as protocol date, not freshness of the list.
4. e-SAJ must be rechecked using the correct responsible-debtor relationships; its result count must remain contextual and must not assume a year filter.
5. The UI E2E exercises a synthetic CAC-shaped ZIP and is a regression test only; it is not the basis for the real record counts above.

## Official references

- [TJSP Credores](https://www.tjsp.jus.br/Precatorios/Precatorios/Credores)
- [TJSP Lista Geral](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral)
- [TJSP Lista Pendentes](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes)
- [TJSP FAQ](https://www.tjsp.jus.br/Precatorios/Precatorios/Faq)
- [TJSP CAC pending consultation](https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx)
- [e-SAJ public lists](https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do)
- [Municipal communications archive](https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=113)
- [State communications archive](https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=112)
