# CP - Phase 3: Fechamento Final da Qualificacao de Oportunidades

## Status final

**PHASE 3 COMPLETE - EXTERNAL VERIFICATION PENDING**

O fechamento foi executado contra `central-precatorios.db`, com selecao reproduzida do O4 e resultados persistidos na tabela `opportunity_evaluations`.

### FINAL PILOT

- 15 casos reais selecionados
- 0 READY_FOR_ANALYST
- 15 BLOCKED_BY_IDENTITY
- 0 BLOCKED_BY_EVIDENCE

O resultado anterior de 14 bloqueios de identidade e 1 de evidencia foi corrigido. O caso `0513642-74.2019.8.26.0500` tinha uma observacao `HISTORICAL_CONFIRMED`, nao uma confirmacao atual de titularidade. A classificacao final e, portanto, 15 bloqueios de identidade. Os 15 casos tambem falham gates de documentacao, cobertura, valor, data-base, processo, advogado e contato.

## Matriz final do lote

`Documentos` mostra contagem persistida bruta / documentos qualificaveis. Um documento so qualifica se estiver `VERIFIED + STRONG`, distinto por fingerprint/hash/identificador. Todos os 15 casos estao em 0/2 qualificaveis.

| DEPRE | operationId | Municipio | Beneficiario / papel / estado | Docs | Cobertura | Valor / data-base / processo | Advogado / OAB / contato | CRM / tarefa | Automacao / IA | Qualificacao / pronto | Motivo de identidade |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| 0165056-11.2021.8.26.0500 | 120ca91d-ac87-47a9-83d6-765f56828680 | Campinas | Sem observacao de beneficiario | 2/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0149031-15.2024.8.26.0500 | 02fcb9ba-4e32-4a50-b999-c6de044320a5 | Sao Paulo | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0078231-59.2024.8.26.0500 | 0b7595bf-7b90-49e3-9aa7-a08df9efcf3b | Sao Paulo | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0065683-46.2017.8.26.0500 | 0e9d52b7-2eb3-4691-920e-2c46301ff317 | Campinas | Maria Ester Rosa; Marta Diniz Rosa - UNKNOWN / UNVERIFIED_IMPORT | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | MULTIPLE_BENEFICIARIES_UNRESOLVED |
| 7006578-24.2014.8.26.0500 | 13ebb355-9e14-48cf-bc4a-3f14a2471282 | Campinas | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0246430-49.2021.8.26.0500 | 1475ea97-9217-44e0-9c0b-5c0f76e37307 | Guarulhos | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0325500-18.2021.8.26.0500 | 14dcc002-cf54-428c-87ec-0f9063878ece | Guarulhos | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0234462-80.2025.8.26.0500 | 15c336d1-809f-40b1-8c05-a389787f7435 | Sao Paulo | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 7007091-55.2015.8.26.0500 | 1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd | Campinas | Ivelise Poli Barea; Guilherme Barea Filho; Claudia Poli de Almeida Barea Teixeira; Gabriela Barea Teixeira - UNKNOWN / UNVERIFIED_IMPORT | 1/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | MULTIPLE_BENEFICIARIES_UNRESOLVED |
| 0034190-80.2019.8.26.0500 | 2442a714-8aa7-41f0-b1f9-2690acc44fb6 | Guarulhos | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0061620-12.2016.8.26.0500 | 2ade7ad1-a29d-4551-80ab-2ad59058136f | Campinas | Sem observacao de beneficiario | 1/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0002075-74.2017.8.26.0500 | 2da66ef7-5c56-43a1-8eb8-f24ce10d98cd | Guarulhos | Elson de Souza Moura - CREDOR / HISTORICAL_CONFIRMED | 1/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | HISTORICAL_BENEFICIARY_OR_CREDITOR_ONLY |
| 02588958-52.2020.8.26.0500 | 32d9a352-c11d-4778-a82d-d6fc96fddd7f | Guarulhos | Sem observacao de beneficiario | 1/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |
| 0513642-74.2019.8.26.0500 | 33b49922-d550-4af5-ad9a-4f39b9fadf46 | Campinas | Sandra Mara Maschio - TITULAR / HISTORICAL_CONFIRMED | 1/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | HISTORICAL_BENEFICIARY_OR_CREDITOR_ONLY |
| 0066316-47.2023.8.26.0500 | 39e553b2-35ca-432b-a5e0-fc3beca68c42 | Sao Paulo | Sem observacao de beneficiario | 0/0 | INSUFFICIENT_COVERAGE | MISSING / MISSING / PENDING | — / — / NO_CONFIRMED_CONTACT | NEW / OPEN | SOURCE_ACQUISITION:FAILED / PENDING | NO_CURRENT_TITULAR_CONFIRMATION |

Titularidade atual e considerada confirmada somente para `role=TITULAR` e `status=CURRENT_CONFIRMED`. Nao ha nenhum desses estados confirmados neste lote. Ha 11 casos sem observacao atual, 2 com multiplos candidatos importados nao verificados e 2 com observacoes historicas apenas. Os dois casos multiplos recebem tambem `MULTIPLE_BENEFICIARIES_UNRESOLVED`.

### Blockers finais

Todos os 15 resultados persistidos contem estes `blockerCodes`:

`TITULAR_NOT_CONFIRMED`, `DOCUMENTATION_BELOW_2_OF_2`, `INSUFFICIENT_SOURCE_COVERAGE`, `VALUE_NOT_CONFIRMED`, `DATE_BASE_NOT_CONFIRMED`, `PROCESS_NOT_CONFIRMED`, `LAWYER_NOT_CONFIRMED`, `CONTACT_NOT_CONFIRMED`.

Os dois casos com multiplos candidatos adicionam `MULTIPLE_BENEFICIARIES_UNRESOLVED`. Os `blockingReasons` correspondentes sao `TITULAR_NOT_CONFIRMED`, `DOCUMENTATION_INSUFFICIENT`, `INSUFFICIENT_SOURCE_COVERAGE`, `VALUE_NOT_CONFIRMED`, `DATE_BASE_NOT_CONFIRMED`, `PROCESS_NOT_CONFIRMED`, `LAWYER_NOT_CONFIRMED` e `CONTACT_NOT_CONFIRMED`, com `MULTIPLE_BENEFICIARIES_UNRESOLVED` adicional nos dois casos multiplos.

## Verificacao de evidencias

- Os 13 registros globais sao `OFFICIAL_RECORD`; 12 estao `COLLECTED/MEDIUM` e 1 `FAILED/MEDIUM`.
- Registros `COLLECTED`, `FAILED` e/ou `MEDIUM` nao satisfazem `VERIFIED + STRONG`.
- Evidencia qualificavel distinta: 0; duplicidade de evidencias: 0; evidencia orfa: 0.
- No lote, ha 7 documentos brutos persistidos: 2 para `0165056-11.2021.8.26.0500` e 1 para cada um de `7007091-55.2015.8.26.0500`, `0061620-12.2016.8.26.0500`, `0002075-74.2017.8.26.0500`, `02588958-52.2020.8.26.0500` e `0513642-74.2019.8.26.0500`. Todos sao `COLLECTED/MEDIUM`; qualificaveis: 0/2 em cada caso.
- Evidencia de IA nao foi incluida na contagem oficial. A regra 2/2 nao foi enfraquecida.
- Na linha `0513642-74.2019.8.26.0500`, o unico documento e `c6b97a46-6e18-4394-99b7-0a3fc1c84aee`, `OFFICIAL_RECORD/COLLECTED/MEDIUM`, identificador `pmc.2021.00049793-06`, ligado a operacao correta. Conta bruta 1, qualificavel 0. A beneficiaria registrada e historica, portanto o blocker final e de identidade.
- Para `0165056-11.2021.8.26.0500`, os dois documentos sao `ddc2fbd4-26f3-4a0d-b342-adbaa33fcf16` e `86e168a4-4cdc-4709-a20b-9543e27a16e1`; ambos `COLLECTED/MEDIUM`, qualificaveis 0.
- Reconciliacao global: 73/73 operacoes reais estao em 0/2; 1/2 = 0; 2/2 = 0.

## Reconciliacao do banco

Auditoria SQL final, somente leitura, executada apos a qualificacao e apos os gates:

| Medida | Contagem |
| --- | ---: |
| Operacoes totais | 74 |
| Operacoes reais | 73 |
| Operacoes demo | 1 |
| DEPREs reais unicos | 73 |
| Grupos DEPRE duplicados | 0 |
| Evidencias oficiais totais | 13 |
| Evidencias oficiais qualificaveis `VERIFIED + STRONG` | 0 |
| Evidencias orfas | 0 |
| Documentacao 0/2, 1/2, 2/2 | 73, 0, 0 |
| Registros CRM | 16 |
| Tarefas CRM | 16 |
| Tarefas CRM orfas | 0 |
| Grupos duplicados CRM por operacao | 0 |
| Links CRM para oportunidade | 0 |
| Grupos duplicados de tarefas CRM | 0 |
| Jobs de automacao | 36 |
| Alvos de automacao invalidos | 0 |
| Eventos de auditoria | 119 |
| Atividades CRM | 0 |
| Entregas de notificacao | 0 |
| Avaliacoes de qualificacao persistidas | 15 |
| READY_FOR_ANALYST / QUALIFIED / IN_REVIEW / NOT_QUALIFIED | 0 / 0 / 0 / 0 |
| Bloqueios de identidade / documentacao / cobertura | 15 / 15 / 15 |
| Bloqueios de valor / contato / status | 15 / 15 / 0 |
| Blockers de multiplos beneficiarios | 2 |

O estado atual tem 15 registros de CRM do lote, todos `NEW`, cada um com uma tarefa `OPEN`. Um registro CRM anterior, `o4-433c2565-d5d0-424a-b0e1-af7e1d3962b2`, aponta para o DEPRE `0038850-88.2017.8.26.0500`, fora dos 15 casos; ele foi preservado e nao foi alterado nesta execucao. O caso selecionado `0066316-47.2023.8.26.0500` nao tinha CRM/tarefa; a relacao foi criada idempotentemente, sem alterar a operacao. Por isso os totais da organizacao sao 16/16, embora 15/15 do lote estejam relacionados. O evento de auditoria adicional corresponde a essa criacao esperada. A cadeia de auditoria valida.

Os 36 jobs globais sao `SOURCE_ACQUISITION`, alvo `operation`, estado `FAILED`; cada um dos 15 casos selecionados tem um job desse tipo. A tabela `autonomous_acquisition_jobs` tem 0 registros.

## Idempotencia e isolamento

- Duas execucoes integrais independentes produziram a mesma matriz, os mesmos blockers e as mesmas 15 linhas persistidas.
- `UNIQUE(organization_id,operation_id,rule_version)` e o upsert condicional mantiveram 15 avaliacoes, sem duplicatas; repeticao identica nao altera `evaluated_at`.
- O snapshot de operacoes, evidencias, CRM, tarefas, automacao e auditoria permaneceu igual antes/depois de cada avaliacao. Nenhuma operacao ou evidencia foi atualizada/sobrescrita pela qualificacao.
- Selecao com `is_demo=0`; 15 operationIds e 15 DEPREs distintos. A tabela de avaliacao tem trigger de tenant e bloqueia operacoes demo.
- Evidencia, CRM e tarefas sem orfaos; alvos de automacao validos; nenhum link de oportunidade duplicado.

## Bugs, causas e correcoes

- O avaliador anterior reconhecia `HISTORICAL_CONFIRMED` por substring e promoveu uma observacao historica a titular atual. Causa: correspondencia permissiva de texto. Correcao: `deriveTitularStatusFromBeneficiaries` aceita somente `CURRENT_CONFIRMED`; teste cobre observacao historica e importacao nao verificada. O caso `0513642-74.2019.8.26.0500` passou de falso confirmado para identidade nao resolvida.
- Uma avaliacao ad hoc contou qualquer registro oficial, inclusive `COLLECTED/MEDIUM`, como evidencia qualificante. Causa: usar contagem bruta como `qualifyingEvidenceCount`. Correcao da execucao final: contar somente registros `VERIFIED + STRONG`, deduplicados por fingerprint/hash/identificador.
- O engine permitia blockers explicitos coexistirem com `readyForAnalyst=true` e aceitava status legado `READY_FOR_ANALYST` sem titular. Causa: readiness ignorava blockers e status usava fallback legado. Correcao: readiness requer zero blockers; titular ausente bloqueia; status legado `READY_FOR_ANALYST`/`QUALIFIED` nao substitui a derivacao.
- Nao havia persistencia de avaliacao no esquema. Correcao: migration `005_opportunity_evaluations`, unicidade por tenant/operacao/regra, trigger tenant/demo e repositorio idempotente. Os registros guardam resultado, blockers, motivos, regra e payload derivado; operacoes nao sao regravadas.
- Um dos 15 casos estava sem CRM/tarefa; o vinculo foi criado para o caso selecionado com chaves idempotentes. O CRM anterior fora do lote foi mantido sem alteracao.

## Gates finais

- `npm test -- --run`: PASS - 51 arquivos, 297 testes.
- `npm run test:e2e`: PASS - 2/2.
- `npx tsc --noEmit --pretty false`: PASS - 0 erros.
- `npm run lint`: PASS - 0 erros; 21 warnings preexistentes em outros arquivos.
- `git diff --check`: PASS - limpo; apenas avisos Git de conversao LF/CRLF.
- Teste focado do engine: PASS - 9 testes.
- Teste focado de migracao e persistencia: PASS - 5 testes combinados no fechamento.

## Temporarios e verificacao externa

`tmp_phase3_probe.mts` foi removido. Nao restaram `tmp_phase3*`, `phase3_probe*` ou `debug_phase3*` no workspace; temporarios nao relacionados a Phase 3 foram preservados.

Verificacao oficial externa de titularidade/OAB permanece pendente.

EXTERNAL AI CONNECTIVITY VERIFIED GENERICALLY; CASE-LEVEL AI VERIFICATION REMAINS PENDING.

## Aceitacao final

**PHASE 3 COMPLETE - EXTERNAL VERIFICATION PENDING.**

O piloto real foi executado, persistido, repetido e reconciliado. Nenhum caso foi promovido sem suporte documental e de identidade. O resultado de negocio permanece bloqueado para todos os 15 casos ate que a titularidade atual e os demais requisitos sejam confirmados em fontes adequadas. A validacao externa oficial segue explicitamente pendente.

## POST-CLOSURE CARDINALITY RECONCILIATION

### Conclusao

**Nao houve perda de tres operacoes.** A diferenca `77 -> 74` comparava escopos diferentes:

- O baseline historico `77 total / 76 is_demo=0 / 1 is_demo=1` era uma contagem global, sem filtro de `organization_id`.
- A reconciliacao final `74 total / 73 is_demo=0 / 1 is_demo=1` era restrita ao tenant operacional `nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u` (`CP 2.1 Demonstracao`).
- Uma consulta global somente leitura ao mesmo arquivo `central-precatorios.db` continua retornando **77 / 76 / 1**. A consulta do tenant retorna **74 / 73 / 1**.

O arquivo-fonte `data/CP_pacote_completo_73_DEPREs.xlsx` tem 73 DEPREs unicos. A comparacao normalizada com as 73 operacoes reais do tenant ativo produziu `source - current = vazio` e `current - source = vazio`. As outras tres linhas reais globais tem DEPRE vazio e pertencem a `legacy-internal` ou a outros tenants; portanto nao fazem parte do conjunto de 73 casos nem da lista operacional autenticada do tenant ativo.

O baseline historico preserva as contagens, mas nao um snapshot completo dos 76 operationIds. Por isso, uma subtracao historica exata de conjuntos de operationIds nao pode ser reconstruida a partir do relatorio agregado. O que pode ser provado e: os 76 operationIds reais existem hoje; os tres registros que faltam na consulta tenant-scoped estao presentes globalmente, tem datas de criacao anteriores ao baseline e estao detalhados abaixo; a cardinalidade global permaneceu 77; e o conjunto de DEPREs do tenant e identico ao XLSX original. Nenhum registro foi restaurado, recriado, removido, migrado ou alterado nesta investigacao.

### Escopo e ambiente

As consultas atuais e os scripts de dominio usam `file:central-precatorios.db`. Os relatorios antigos registram 77/76/1 sem guardar a SQL nem o organizationId usados. Os probes locais que reproduzem a contagem global filtram `is_demo=0`, mas nao `organization_id`. Em contraste, o relatorio de importacao CP-73 registra que a API autenticada do tenant retornou 74 (73 importadas + 1 demo), e as consultas Phase 3 usam `WHERE organization_id=?`. Essa e a origem exata da diferenca reportada.

| organization_id atual | Organizacao / classe | `is_demo=0` | `is_demo=1` | DEPRE real nao vazio |
| --- | --- | ---: | ---: | ---: |
| `legacy-internal` | Registros tecnicos antigos | 1 | 0 | 0 |
| `nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u` | CP 2.1 Demonstracao, tenant operacional | 73 | 1 | 73 |
| `tDiXCPHCRKFkrm1AbUhAZ6PblVMBDJfq` | Empresa Ficticia A | 1 | 0 | 0 |
| `xT9UjnG9mDD3nVQfCKOmrfdPjkyQuNLM` | Organizacao Demonstracao CP | 1 | 0 | 0 |
| **Global** |  | **76** | **1** | **73** |

Playwright define `DATABASE_URL` como `CP_E2E_DATABASE_URL` ou `file:cp-lead-center-e2e.db`; nao aponta para `central-precatorios.db`. O teste phase7 backup/restore usa `VACUUM INTO` em diretorio temporario e compara fingerprints; nao substitui o banco-fonte. O marcador `20260919_cp21_foundation` permanece presente. As migrations 001-005 criam CRM/guardas/avaliacoes; nenhuma remove linhas de `operations`. A unica rotina encontrada com `DELETE FROM operations` e `resetDemoOperations`, limitada a `organization_id=? AND is_demo=1`; nao se aplica a nenhum dos tres registros abaixo.

### Tres registros fora do escopo tenant

Eles sao as tres linhas que explicam a subtracao entre o total global e a consulta do tenant. Todos existem atualmente com `is_demo=0`, sem DEPRE, devedor ou municipio no registro. Nenhum tem evidencia, CRM, tarefa ou job de automacao vinculado. Nao ha evento em `audit_logs` com o operationId; a coluna `operations.history` e o ultimo historico disponivel.

| operationId | DEPRE / devedor / municipio | `is_demo` | organization_id atual | Existencia / ultimo evento local | Migrado para o tenant CP 2.1? | Classificacao sustentada pelos dados |
| --- | --- | ---: | --- | --- | --- | --- |
| `498ab589-36aa-4f9c-8c12-741faf83d1d1` | Sem DEPRE / vazio / vazio | 0 | `legacy-internal` | Existe; history: criacao em 2026-09-09 11:51:19Z, atualizacao de titulo/responsavel 11:51:31Z, atualizacao de tarefas 11:52:18Z; sem audit_log | Nao; nao pertence ao lote de 73 DEPREs, permanece em `legacy-internal` | Titulo literal `TESTE TECNICO CP - dados ficticios`, responsavel Equipe de teste. Conteudo explicitamente de teste, mas flag `is_demo` continua 0. |
| `82e6882a-2f73-471e-9a25-e83edb6b8975` | Sem DEPRE / vazio / vazio | 0 | `tDiXCPHCRKFkrm1AbUhAZ6PblVMBDJfq` | Existe; history: criacao em 2026-09-09 19:08:02Z; sem audit_log | Nao; pertence ao tenant separado Empresa Ficticia A | Titulo `ISOLAMENTO TESTE A`, source `teste automatizado`; registro de teste em tenant ficticio, mas flag `is_demo` e 0. |
| `4020798b-caa4-4b6e-92e2-7338a96050c6` | Sem DEPRE / vazio / vazio | 0 | `xT9UjnG9mDD3nVQfCKOmrfdPjkyQuNLM` | Existe; history: criacao em 2026-09-14 19:58:29Z; sem audit_log | Nao; pertence a Organizacao Demonstracao CP, tenant separado | Titulo `Nova operacao`, workflow sem credito/DEPRE e devedor vazio. Tenant tem nome de demonstracao, mas a linha nao esta marcada `is_demo`; o banco nao prova outra classificacao. |

Estado das verificacoes solicitadas para os tres: **apagados: nao, estao presentes; merge: nenhum evento/evidencia; duplicados: nao ha DEPRE para duplicar e nenhum grupo duplicado; exclusao por query: sim, filtro `organization_id` deixa de fora os tres; outro tenant: sim; flag sintetica/demo: `is_demo=0` em todos**. Os dois primeiros tem metadados explicitos de teste; o terceiro tem tenant de demonstracao, mas nao se altera sua flag nesta auditoria. Nenhuma migracao moveu ou apagou essas linhas durante o fechamento.

### Set differences e inventario real atual

O conjunto recuperavel de DEPREs anteriores e a aba `Contatos 73` do XLSX, validada no relatorio CP-73. Os 73 DEPREs atuais do tenant correspondem 1:1 ao pacote: diferenca anterior menos atual = 0; atual menos anterior = 0. Os tres operationIds fora do tenant nao tinham DEPRE e nao mudam a cardinalidade de 73.

A lista historica completa dos 76 operationIds nao foi anexada aos relatorios anteriores. Assim, a diferenca de IDs do baseline global original nao e reconstruivel como snapshot independente. O inventario global atual abaixo e o conjunto real presente no banco agora; os tres registros fora do tenant foram identificados diretamente, nao inferidos.

- `baseline_global_real_operationIds - current_global_real_operationIds`: nao computavel como conjunto exato, pois o baseline guardou somente totais e nao o manifesto de IDs. Nenhum dos tres IDs fora do tenant esta ausente globalmente hoje.
- `current_global_real_operationIds - baseline_global_real_operationIds`: igualmente nao computavel por falta do manifesto historico. As 76 linhas reais atuais foram criadas antes da data dos relatorios de baseline; nao ha evento de criacao posterior nem linha real ausente.
- Diferenca operacional reproduzivel entre a consulta global e a consulta do tenant ativo: os tres IDs listados na secao anterior. Eles continuam presentes no banco global, tem DEPRE vazio e nao pertencem aos 73 registros do pacote.
- Diferenca de DEPREs do pacote anterior contra o tenant atual: conjunto vazio nos dois sentidos, validado diretamente contra o XLSX original.

O registro demo atual e `0dea6cb9-81b1-499c-85c0-499a3ddb49ab`, no tenant CP 2.1, com `is_demo=1`. As outras tres linhas fora do tenant estao `is_demo=0`; duas tem metadados explicitamente de teste e uma esta em organizacao com nome de demonstracao, portanto o total global de 76 “reais” representa literalmente a flag, nao 76 precatorios qualificados.

| operationId atual | organization_id (CP21 = tenant ativo) | DEPRE atual |
| --- | --- | --- |
| `498ab589-36aa-4f9c-8c12-741faf83d1d1` | `legacy-internal` | — |
| `02fcb9ba-4e32-4a50-b999-c6de044320a5` | CP21 | 0149031-15.2024.8.26.0500 |
| `0b7595bf-7b90-49e3-9aa7-a08df9efcf3b` | CP21 | 0078231-59.2024.8.26.0500 |
| `0e9d52b7-2eb3-4691-920e-2c46301ff317` | CP21 | 0065683-46.2017.8.26.0500 |
| `120ca91d-ac87-47a9-83d6-765f56828680` | CP21 | 0165056-11.2021.8.26.0500 |
| `13ebb355-9e14-48cf-bc4a-3f14a2471282` | CP21 | 7006578-24.2014.8.26.0500 |
| `1475ea97-9217-44e0-9c0b-5c0f76e37307` | CP21 | 0246430-49.2021.8.26.0500 |
| `14dcc002-cf54-428c-87ec-0f9063878ece` | CP21 | 0325500-18.2021.8.26.0500 |
| `15c336d1-809f-40b1-8c05-a389787f7435` | CP21 | 0234462-80.2025.8.26.0500 |
| `1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd` | CP21 | 7007091-55.2015.8.26.0500 |
| `2442a714-8aa7-41f0-b1f9-2690acc44fb6` | CP21 | 0034190-80.2019.8.26.0500 |
| `2ade7ad1-a29d-4551-80ab-2ad59058136f` | CP21 | 0061620-12.2016.8.26.0500 |
| `2da66ef7-5c56-43a1-8eb8-f24ce10d98cd` | CP21 | 0002075-74.2017.8.26.0500 |
| `32d9a352-c11d-4778-a82d-d6fc96fddd7f` | CP21 | 02588958-52.2020.8.26.0500 |
| `33b49922-d550-4af5-ad9a-4f39b9fadf46` | CP21 | 0513642-74.2019.8.26.0500 |
| `39e553b2-35ca-432b-a5e0-fc3beca68c42` | CP21 | 0066316-47.2023.8.26.0500 |
| `3a575445-01d3-4012-94f7-c0a6efa4503e` | CP21 | 0399126-02.2023.8.26.0500 |
| `3b39611c-5ae9-4e7e-938d-043e5d3c5916` | CP21 | 0109758-63.2023.8.26.0500 |
| `3ddafae4-20b3-448b-b597-fdcedb41900a` | CP21 | 0105609-68.2016.8.26.0500 |
| `3ff28a2c-1b4d-4305-a1b5-9058d6d6cd1f` | CP21 | 0078230-74.2024.8.26.0500 |
| `418abdf4-8605-4685-a507-40b68a9168d4` | CP21 | 0222404-84.2021.8.26.0500 |
| `433c2565-d5d0-424a-b0e1-af7e1d3962b2` | CP21 | 0038850-88.2017.8.26.0500 |
| `4b233c6f-b44d-46c2-9029-fa12f92741cc` | CP21 | 0377880-18.2021.8.26.0500 |
| `4eddba24-3037-4865-8f2a-7d8ad6ac3f98` | CP21 | 0498482-43.2018.8.26.0500 |
| `5afe59dd-0cad-4bab-94d1-8e992cfac17c` | CP21 | 0248001-50.2024.8.26.0500 |
| `5cfb36a0-769b-400d-9147-0eab37fa99da` | CP21 | 0020675-12.2018.8.26.0500 |
| `75ab0ea9-54d2-4b42-9297-f0cdb0758299` | CP21 | 0230923-48.2021.8.26.0500 |
| `77280865-0f94-44b3-abb1-05f07d098d84` | CP21 | 0513646-14.2019.8.26.0500 |
| `7c36ee5d-6419-4605-8ff6-256c792ef5a3` | CP21 | 0377884-55.2021.8.26.0500 |
| `8229a6af-1cd6-44f1-8ed6-c43916834025` | CP21 | 0066968-11.2016.8.26.0500 |
| `861df0cb-05b6-4aa2-b081-d88a51f2219d` | CP21 | 7007092-40.2015.8.26.0500 |
| `87031169-14d0-4bce-ab47-90d9e4ae874c` | CP21 | 0165049-19.2021.8.26.0500 |
| `8cb6a877-2112-4781-8cd9-0e7ce277698f` | CP21 | 0054334-46.2017.8.26.0500 |
| `8d015b5d-50f5-449d-b476-482230f5aa66` | CP21 | 0445548-74.2019.8.26.0500 |
| `91ee8f4c-b53d-43f6-b4c4-08f631502d2c` | CP21 | 0265089-04.2024.8.26.0500 |
| `9c0c1fc9-8564-468d-befa-7bd1a6808150` | CP21 | 0377885-40.2021.8.26.0500 |
| `9e8ee57b-9790-4d1b-bf60-c9e6e3b9dd55` | CP21 | 7002911-93.2015.8.26.0500 |
| `9ee96c56-0451-4a84-9eb6-662651b57ab3` | CP21 | 0089201-55.2023.8.26.0500 |
| `a1ef3749-7f00-4e51-a003-1e2c4a68efbb` | CP21 | 0445544-37.2019.8.26.0500 |
| `a6eed286-5ac2-478e-b126-aadcd06a1517` | CP21 | 0037228-61.2023.8.26.0500 |
| `acc0ae19-fad1-4b1e-bed2-225087c7a3c4` | CP21 | 0222343-29.2021.8.26.0500 |
| `aceba4c2-ab63-4e2d-82e1-b07c91ac16a5` | CP21 | 0038851-73.2017.8.26.0500 |
| `ad72aa6e-0e28-4e0f-ae3a-712bd724492f` | CP21 | 0046135-30.2020.8.26.0500 |
| `ae9c10ab-f7e6-48b9-b3d2-c596af1253ba` | CP21 | 7008115-21.2015.8.26.0500 |
| `b6179099-1ed9-4277-a8b5-5d644dcd71d7` | CP21 | 0165048-34.2021.8.26.0500 |
| `b7388164-7d60-43cc-9271-ac0bb33d9c33` | CP21 | 0240468-16.2019.8.26.0500 |
| `b8188be9-1969-466f-9f1c-46c8ee15f3c5` | CP21 | 0146517-31.2020.8.26.0500 |
| `c365ee49-914d-4718-be8f-b8daa8adc51e` | CP21 | 0279214-11.2023.8.26.0500 |
| `c746848e-dae6-40c7-ad3e-ea4504e85aeb` | CP21 | 0467539-38.2021.8.26.0500 |
| `ca297a97-3a23-446b-b64a-1dd74705c678` | CP21 | 0292016-75.2022.8.26.0500 |
| `ccba64aa-19c8-49a5-af10-0838f56736ec` | CP21 | 0005094-49.2021.8.26.0500 |
| `cdc17a75-5fee-4805-85bc-a5e454b79be4` | CP21 | 0370869-35.2021.8.26.0500 |
| `cdfa9e28-269d-4a3b-9143-92e79b35ce40` | CP21 | 0078242-88.2024.8.26.0500 |
| `d0a4bd0f-d0a2-47f6-a5e9-6e7fd5587665` | CP21 | 7002143-70.2015.8.26.0500 |
| `d12413c0-c613-44e8-bbd0-4f758cdd64f8` | CP21 | 0051883-09.2021.8.26.0500 |
| `d433ce22-44af-4a0c-8847-817c61ef5d0c` | CP21 | 0165055-26.2021.8.26.0500 |
| `d6e98004-0da1-4b4e-a78b-c713239d4f77` | CP21 | 0415905-03.2021.8.26.0500 |
| `d96c930a-f006-4590-a142-d5d006dfee0b` | CP21 | 0078233-29.2024.8.26.0500 |
| `d9f156b3-a743-4591-b0cf-d9626f87086f` | CP21 | 0196151-64.2018.8.26.0500 |
| `da28b600-9f46-4c56-a197-8523f5d4e819` | CP21 | 0147717-34.2024.8.26.0500 |
| `da82b679-43ea-48d5-9e12-0f5a4b0ef60f` | CP21 | 0513631-45.2019.8.26.0500 |
| `dd5990a5-5045-4cc5-8acc-8e849a2be6ab` | CP21 | 0236006-11.2022.8.26.0500 |
| `e16a1a9d-85b4-43b7-9c7c-307142257b5f` | CP21 | 0061624-49.2016.8.26.0500 |
| `e1ad63a5-b468-4101-a9ee-3abf1ac09655` | CP21 | 0346683-45.2021.8.26.0500 |
| `e54844af-aacc-4515-9079-6a76141bb76d` | CP21 | 7005322-80.2013.8.26.0500 |
| `e70f9bd9-685c-401c-83e3-8c4e973e094a` | CP21 | 0221194-95.2021.8.26.0500 |
| `ebd19f6d-a257-4ff2-9889-86257c8bb90a` | CP21 | 0061616-72.2016.8.26.0500 |
| `ec5e0bc4-d2a4-41c0-8eba-732915e1fe35` | CP21 | 0065896-52.2017.8.26.0500 |
| `f26164b8-a186-41c1-aac4-f45e8e2da1e2` | CP21 | 0296875-32.2025.8.26.0500 |
| `f498eb5e-4672-4619-b1bb-0af3cfe67de2` | CP21 | 0299677-13.2019.8.26.0500 |
| `fba96919-6aa1-4608-9739-c6aa85b070c8` | CP21 | 0165045-79.2021.8.26.0500 |
| `fd98c524-36ad-45b6-a22a-bcc310556b7a` | CP21 | 0187219-48.2022.8.26.0500 |
| `fef6cee2-053d-4fd3-8837-111c9bc59c4a` | CP21 | 0005002-08.2020.8.26.0500 |
| `ffcf4c72-faab-43fe-a288-2d7f06b41782` | CP21 | 0500766-24.2018.8.26.0500 |
| `82e6882a-2f73-471e-9a25-e83edb6b8975` | `tDiXCPHCRKFkrm1AbUhAZ6PblVMBDJfq` | — |
| `4020798b-caa4-4b6e-92e2-7338a96050c6` | `xT9UjnG9mDD3nVQfCKOmrfdPjkyQuNLM` | — |

### CRM e auditoria delta

- Baseline documentado: 15 CRM, 15 tarefas, 118 eventos de auditoria.
- Atual: 16 CRM, 16 tarefas, 119 eventos, todos no tenant CP 2.1. O incremento de um em cada tabela e legitimo e pertence ao lote Phase 3; nenhum registro foi apagado para restaurar o numero anterior.
- CRM adicional: `o4-39e553b2-35ca-432b-a5e0-fc3beca68c42`, operationId `39e553b2-35ca-432b-a5e0-fc3beca68c42`, DEPRE `0066316-47.2023.8.26.0500`, tenant `nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u`, stage `NEW`, opportunityId nulo. Foi criado porque o caso selecionado estava sem registro CRM.
- Tarefa adicional: `o4-task-39e553b2-35ca-432b-a5e0-fc3beca68c42`, aponta para o CRM acima, status `OPEN`, idempotency key `o4-manual-review-39e553b2-35ca-432b-a5e0-fc3beca68c42`. Existe exatamente uma vez; o grupo de duplicatas e orfaos e zero.
- Evento adicional: `b842dd19-aeee-4f0a-a8cd-cd02751971b8`, `OPPORTUNITY_CREATED`, entity `crm_record`, 2026-10-05T00:29:26.130Z, source `O4`, metadata `O4_CONTROLLED_PILOT`, requestId `o4-39e553b2-35ca-432b-a5e0-fc3beca68c42`. A cadeia/hash foi mantida valida.
- O registro CRM fora do lote para `0038850-88.2017.8.26.0500` ja existia antes desse delta e nao foi tocado. O incremento para 16 nao e uma duplicata.

### Demais invariantes apos a auditoria

- Automacao: 36 jobs `SOURCE_ACQUISITION`, todos `FAILED` como antes; alvos invalidos = 0. Nenhum job foi criado ou reexecutado nesta investigacao.
- Evidencia: 13 registros, 0 orfaos, 0 `VERIFIED+STRONG`; 0/2 = 73 reais, 1/2 = 0, 2/2 = 0. A qualificacao documental nao mudou.
- Qualificacao: 15 avaliacoes, 15 `BLOCKED_BY_IDENTITY`, 0 `READY_FOR_ANALYST`; 2 blockers de multiplos beneficiarios. Nenhuma observacao historica foi promovida a titular atual, nenhum score/status legado sobrepos a blockers.
- Testes: nenhuma linha operacional foi escrita por esta reconciliação. O E2E usa `cp-lead-center-e2e.db`; Vitest usa fixtures isoladas. Os bancos locais `phase7-restore-test.db` e `phase10-restore-test.db` sao testes de restore, nao snapshots historicos do baseline operacional.
- Migrations atuais: marcador de dominio `20260919_cp21_foundation`; schema migrations 001-005, sendo 005 apenas persistencia de avaliacoes. Nenhuma contem delete/update de operacoes.
- O baseline CP-73 descreve a migracao transacional das 73 linhas do XLSX para o tenant ativo alterando somente `organization_id`; as tres linhas fora do lote nao foram reatribuídas ao tenant CP 2.1.

### Baseline canonico

Para reconciliacoes globais da tabela, o baseline canonico continua **77 total / 76 com `is_demo=0` / 1 com `is_demo=1`**. Para o tenant operacional CP 2.1, o baseline canonico e **74 total / 73 reais / 1 demo**, com 73 DEPREs reais unicos iguais ao XLSX original. A frase anterior “77 para 74 operacoes” misturava a contagem global com a contagem tenant-scoped; ela nao representa remocao nem perda de dados. Nenhuma operacao foi restaurada ou recriada.
