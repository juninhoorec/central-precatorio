# CP Phase 2 — Titular / Beneficiary Enrichment Report

**Fase:** seleção controlada, congelada antes de qualquer mutação operacional  
**Data:** 2026-10-04  
**Primary key:** DEPRE exato; processo originário não será usado como chave.

## Pre-mutation target selection

A seleção foi derivada de consultas `SELECT` ao banco atual. No momento do registro desta lista, nenhuma operação, evidência, tarefa CRM, atividade, job ou evento de auditoria foi criada/alterada pela Fase 2.

Prioridade aplicada: (1) operação real com referência oficial previamente persistida; (2) titular ainda não confirmado; (3) complementaridade por risco de múltiplos titulares ou confusão entre DEPREs. Os identificadores abaixo foram lidos do snapshot operacional; todos os dez registros são `is_demo=0`, têm DEPRE único e formato processual com sete dígitos antes do dígito verificador.

| # | DEPRE | Operação | Município/devedor | Razão objetiva de seleção antes da pesquisa |
|---:|---|---|---|---|
| 1 | 0165056-11.2021.8.26.0500 | `120ca91d-ac87-47a9-83d6-765f56828680` | Campinas | Duas referências oficiais municipais já persistidas em publicações distintas; titular importado e titularidade atual não confirmada. |
| 2 | 0061620-12.2016.8.26.0500 | `2ade7ad1-a29d-4551-80ab-2ad59058136f` | Campinas | Referência oficial municipal persistida com DEPRE exato; titular atual, advogado e dados financeiros pendentes. |
| 3 | 0002075-74.2017.8.26.0500 | `2da66ef7-5c56-43a1-8eb8-f24ce10d98cd` | Guarulhos | Edital municipal oficial persistido; possibilidade de validar referência do credor por DEPRE e contexto municipal. |
| 4 | 0038850-88.2017.8.26.0500 | `433c2565-d5d0-424a-b0e1-af7e1d3962b2` | Campinas | Resultado oficial TJSP por nome já vincula DEPRE e código `DW000CR8L0000`; há registros de rotas divergentes e referências municipais. |
| 5 | 0196151-64.2018.8.26.0500 | `d9f156b3-a743-4591-b0cf-d9626f87086f` | Campinas | Publicação oficial já persistida com DEPRE, ordem 84/2019 e SEI; há divergência entre titular publicado e snapshot de sete nomes. |
| 6 | 7007091-55.2015.8.26.0500 | `1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd` | Campinas | Referência municipal oficial persistida com quatro SEIs na mesma publicação e múltiplos beneficiários aparentes; exige estrutura sem colapsar titulares. |
| 7 | 0513642-74.2019.8.26.0500 | `33b49922-d550-4af5-ad9a-4f39b9fadf46` | Campinas | Referência oficial municipal persistida com DEPRE exato e titular importada; lawyer/OAB snapshot vazios, current holder e dados financeiros pendentes. |
| 8 | 0065683-46.2017.8.26.0500 | `0e9d52b7-2eb3-4691-920e-2c46301ff317` | Campinas | Sem evidência oficial persistida; snapshot de titular contém dois nomes concatenados, caso prioritário para verificar representação de múltiplos beneficiários. |
| 9 | 0500766-24.2018.8.26.0500 | `ffcf4c72-faab-43fe-a288-2d7f06b41782` | Campinas | Sem evidência oficial persistida; titular importado também aparece no snapshot de outro DEPRE (0196151), risco concreto de associação cruzada/histórica. |
| 10 | 7007092-40.2015.8.26.0500 | `861df0cb-05b6-4aa2-b081-d88a51f2219d` | Campinas | Sem evidência oficial persistida; DEPRE Campinas de 2015 selecionado para testar, sem presumir, se o índice oficial municipal usado no caso 7007091 oferece registro independente. |

**Exclusão por integridade do identificador:** a operação `02588958-52.2020.8.26.0500` não foi selecionada porque o primeiro campo tem oito dígitos, incompatível com o formato CNJ usual de sete dígitos antes do dígito verificador. A operação e sua evidência foram preservadas; nenhuma normalização foi inferida. Exige validação com documento oficial.

## Baseline capturado antes de qualquer escrita operacional

A reconciliação read-only disponível no início desta fase registrou: 77 operações (76 reais, 1 demo), 73 DEPREs reais únicos, zero grupos de DEPRE duplicados, 12 evidências oficiais (0 qualificáveis, 0 órfãs), 15 registros CRM, 15 tarefas (0 órfãs), 36 jobs de automação (0 alvos inválidos), 96 eventos de auditoria, 0 atividades CRM, 0 entregas/notificações e marcador de migração `20260919_cp21_foundation` presente.

**Status da seleção:** exatamente 10 alvos reais congelados antes da mutação. A lista acima não foi alterada após a pesquisa.

## Executive summary

Foram processados os dez DEPREs selecionados, todos reais, não-demo e únicos. Cada caso recebeu uma consulta exata por número DEPRE na API pública do TJSP; todas retornaram `[]` (`NO_RESULT`). Também foram consultadas cinco publicações oficiais associadas aos alvos: duas leituras binárias tiveram sucesso (Guarulhos e Diário Oficial de Campinas `4444946.pdf`), e três rotas Campinas expiraram por timeout. A busca CNA/OAB identificou duas inscrições com resultado único para nomes de advogados publicados; o nome comum “Carlos Eduardo de Oliveira” excedeu o limite de resultados e não recebeu OAB.

Foram preservados 18 registros de beneficiário em seis operações: quatro afirmações históricas ligadas a documento oficial, uma divergência histórica e 13 nomes de snapshots importados mantidos explicitamente como `UNVERIFIED_IMPORT / UNKNOWN`. Nenhuma titularidade atual foi confirmada. Um novo documento municipal oficial foi persistido pelo pipeline por não haver correspondência determinística anterior; as outras evidências foram reutilizadas. A regra de DOCUMENTAÇÃO 2/2 permaneceu inalterada e nenhum dos dez casos chegou a 1/2 ou 2/2.

O banco manteve o inventário 77/76/1 e 73 DEPREs reais únicos. Não houve criação de operação, outreach, atividade CRM, job de automação ou notificação. A verificação externa permanece pendente.

## Before / after

| Medida | Antes | Depois da fase |
|---|---:|---:|
| Operações totais / reais / demo | 77 / 76 / 1 | 77 / 76 / 1 |
| DEPREs reais únicos / grupos duplicados | 73 / 0 | 73 / 0 |
| Evidências oficiais / órfãs | 12 / 0 | 13 / 0 |
| Evidências qualificáveis | 0 | 0 |
| CRM records / órfãos | 15 / 0 | 15 / 0 |
| CRM tasks / órfãs | 15 / 0 | 15 / 0 |
| CRM activities | 0 | 0 |
| Jobs de automação / alvos inválidos | 36 / 0 | 36 / 0 |
| Eventos de auditoria | 96 | 118 |
| Notification deliveries | 0 | 0 |
| Acquisition events persistidos | 0 | 0 |
| Marcador `20260919_cp21_foundation` | presente | presente |

O único aumento de evidência foi um `OFFICIAL_RECORD` do Diário Oficial de Campinas, PDF `4444946.pdf`, referência `PMC.2021.00051365-07`, página 34, ligado ao DEPRE 0038850. Status `COLLECTED`, força `MEDIUM`; não qualifica 2/2. A evidência foi primeiro `UNRESOLVED` contra o conjunto anterior, persistida com provenance oficial, e em nova resolução ficou associada pelo identificador documental exato. Os demais candidatos reutilizaram IDs existentes. Nenhum PDF ou referência repetida foi contado duas vezes.

Os 22 novos registros de auditoria correspondem a 18 observações criadas, três reconciliações de provenance e uma correção de papel documental de `TITULAR` para `CREDOR`. A cadeia de auditoria da organização foi validada como íntegra.

## Source-by-source result matrix

### Consultas TJSP por DEPRE exato

Cada uma foi uma requisição pública distinta para `GET /processo/cpopg/search/numproc/{DEPRE}`. O corpo retornado foi literalmente `[]`. O cliente de consulta não expôs código HTTP; por isso ele permanece `null` e não é inventado. `NO_RESULT` descreve somente aquela busca, não inexistência do processo.

| DEPRE | URL oficial consultada | Resultado da fonte | Resultado canônico | Evidência documental nova |
|---|---|---|---|---|
| 0165056-11.2021.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0165056-11.2021.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0061620-12.2016.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0061620-12.2016.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0002075-74.2017.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0002075-74.2017.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0038850-88.2017.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0038850-88.2017.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0196151-64.2018.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0196151-64.2018.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 7007091-55.2015.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/7007091-55.2015.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0513642-74.2019.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0513642-74.2019.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0065683-46.2017.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0065683-46.2017.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 0500766-24.2018.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/0500766-24.2018.8.26.0500) | `[]` | `NO_RESULT` | Não |
| 7007092-40.2015.8.26.0500 | [TJSP API](https://api.tjsp.jus.br/processo/cpopg/search/numproc/7007092-40.2015.8.26.0500) | `[]` | `NO_RESULT` | Não |

### Publicações e rotas profissionais

| Fonte/URL | Resultado observado | Status canônico/decisão |
|---|---|---|
| Campinas DOM `511454721404472145114514.pdf` | Download direto abortado pelo timeout de 30 s; sem status HTTP ou conteúdo | `TRANSPORT_FAILURE`; refs preexistentes mantidas, sem novas alegações |
| Campinas DOM `561915106409510645619126.pdf` | Download direto abortado pelo timeout de 30 s; sem status HTTP ou conteúdo | `TRANSPORT_FAILURE`; a linha de 0196151 veio somente do documento já persistido, marcada `NOT_ATTEMPTED` nesta fase |
| [Diário Oficial de Guarulhos, PDF 1325059861](https://www.guarulhos.sp.gov.br/diario-oficial/uploads/pdf/1325059861.pdf) | HTTP 200, PDF, 49 páginas; p. 42 contém Elson de Souza Moura, DEPRE exato, ordem cronológica 11/2018-alimentar e homologação provisória | `SUCCESS`; candidato resolvido por `EXACT_DOCUMENT_IDENTIFIER`, evidência existente `6f67ae09-020e-455b-9281-315c1bfde2c6` reutilizada |
| Campinas DOM `1882658638.pdf` | Rota direta abortada pelo timeout de 30 s | `TRANSPORT_FAILURE`; não usada como fonte da extração nova de Lúcia/Nelson |
| [Campinas DOM, PDF 4444946](https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/4444946.pdf) | HTTP 200, PDF, 69 páginas; p. 34 lista Lúcia Helena Silveira de Freitas Blandy e Nelson Barthelson no DEPRE 0038850, com refs SEI separadas; p. 35 lista Sandra Mara Maschio no DEPRE 0513642 | `SUCCESS`; Lúcia/Sandra resolveram por identificador. Nelson foi inicialmente `UNRESOLVED`, depois persistido como novo `OFFICIAL_RECORD` e reconciliado por identificador exato. |
| CNA/OAB, Daniel Krahembuhl Wanderley | Uma inscrição retornada: advogado, SP, nº 307900 | `SUCCESS`; armazenada como dado profissional, não como identidade de titular ou contato |
| CNA/OAB, Eneida Rute Manfredini Barbosa | Uma inscrição retornada: advogada, SP, nº 128909 | `SUCCESS`; armazenada como dado profissional, não como identidade de titular ou contato |
| CNA/OAB, Carlos Eduardo de Oliveira | Busca excedeu 10 resultados; houve nome igual na lista truncada | Consulta retornou resultado, mas identidade profissional ficou ambígua; OAB mantida vazia e `lawyerSourceStatus=MANUAL_REQUIRED` |

O PDF 4444946 foi lido em memória com `pdfjs-dist`; CP não copiou CPF/CNPJ público para o banco ou relatório. Não foi calculado SHA-256 nesta extração. A evidência nova é `COLLECTED / MEDIUM / OFFICIAL_RECORD`, página 34, URL oficial 4444946, ref `PMC.2021.00051365-07`. A URL anterior `1882658638.pdf` não é apresentada como origem desta extração. Para Lúcia, o resolvedor reutilizou a evidência preexistente pelo SEI exato; para Nelson, a ref distinta exigiu persistir a nova evidência. Repetições do mesmo PDF não são independentes.

## Titular / beneficiary matrix

`HISTORICAL_CONFIRMED` significa que uma publicação relaciona historicamente aquela pessoa ao DEPRE; não significa titularidade atual. `UNVERIFIED_IMPORT` significa apenas que o nome existia no campo importado e foi separado estruturalmente, sem validar o papel.

| DEPRE | Resultado por pessoa / importação | Relação/documento | Estado do titular atual |
|---|---|---|---|
| 0165056-11.2021.8.26.0500 | Snapshot importado “Luiz Carlos Lima”; fonte atual `NO_RESULT` | Refs municipais preexistentes `PMC.2023.00021248-18` e `PMC.2023.00075698-85`; PDFs não extraídos nesta fase | `PENDENTE`; nome importado não promovido |
| 0061620-12.2016.8.26.0500 | Snapshot “Vivian Cristina de Menezes Eugenio Dias”; fonte atual `NO_RESULT` | Ref municipal preexistente `PMC.2023.00019963-91`; PDF compartilhado não extraído | `PENDENTE` |
| 0002075-74.2017.8.26.0500 | Elson de Souza Moura — papel `CREDOR`, relação histórica `HISTORICAL_CONFIRMED` | Edital municipal, DEPRE exato, ordem 11/2018-alimentar, habilitação provisória; current holder ainda não confirmado | `PENDENTE` |
| 0038850-88.2017.8.26.0500 | Lúcia Helena Silveira de Freitas Blandy e Nelson Barthelson — duas observações distintas `HISTORICAL_CONFIRMED`; snapshot anterior Marcos Sampaio Tocalino preservado | Publicação Campinas p. 34, ordem 89/2020, refs `PMC.2021.00051374-90` e `PMC.2021.00051365-07`; PDF direto 4444946 | `DIVERGÊNCIA` com o snapshot/import e resultado TJSP anterior; nenhuma pessoa foi promovida a titular atual |
| 0196151-64.2018.8.26.0500 | Fernando José dos Santos Oliveira — `DIVERGENT`; sete nomes importados preservados como sete `UNVERIFIED_IMPORT`/`UNKNOWN` | Documento preexistente, p. 7, ordem 84/2019, SEI `PMC.2023.00073678-24`; titulares divergem do snapshot | `DIVERGÊNCIA`; titular atual não confirmado |
| 7007091-55.2015.8.26.0500 | Quatro nomes do snapshot, agora separados como quatro `UNVERIFIED_IMPORT`/`UNKNOWN` | Refs oficiais preexistentes pertencem ao mesmo PDF; fonte direta timeout. Nenhum nome promovido | `PENDENTE` |
| 0513642-74.2019.8.26.0500 | Sandra Mara Maschio — `HISTORICAL_CONFIRMED` | Publicação Campinas p. 35, ordem 24/2021, SEI `PMC.2021.00049793-06` | `PENDENTE` para titularidade atual |
| 0065683-46.2017.8.26.0500 | Maria Ester Rosa e Marta Diniz Rosa — duas `UNVERIFIED_IMPORT`/`UNKNOWN` | Nomes copiados literalmente do snapshot; nenhuma relação oficial localizada | `PENDENTE` |
| 0500766-24.2018.8.26.0500 | José Alexandre da Graça Bento — snapshot somente | Mesmo nome aparece no snapshot de 0196151; isso não prova identidade compartilhada. Nenhuma união feita | `DIVERGÊNCIA` de associação potencial; titular atual não confirmado |
| 7007092-40.2015.8.26.0500 | João Batista Borges — snapshot somente | TJSP `NO_RESULT`; nenhum registro municipal para DEPRE exato nos PDFs lidos | `PENDENTE` |

### Field classification by target

| DEPRE | Titular | Processo originário | Advogado / OAB | Valor / data-base | Contato | Cobertura | Oportunidade/CRM |
|---|---|---|---|---|---|---|---|
| 0165056-11.2021.8.26.0500 | `PENDENTE` — snapshot somente | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, PDF timeout | Operação `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0061620-12.2016.8.26.0500 | `PENDENTE` — snapshot somente | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, PDF timeout | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0002075-74.2017.8.26.0500 | Credor `LOCALIZADO` historicamente; habilitação provisória, titular atual pendente | `LOCALIZADO` DEPRE/order; originário `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, PDF `SUCCESS` | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0038850-88.2017.8.26.0500 | `DIVERGÊNCIA` — duas titulares históricas publicadas e snapshot nominal distinto; atuais pendentes | Relação ao DEPRE `LOCALIZADA`; originário `NÃO LOCALIZADO` | `LOCALIZADO` Daniel Krahembuhl Wanderley / OAB `LOCALIZADO` 307900/SP | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` — CNA não expôs canal de contato | `INSUFFICIENT_COVERAGE`; TJSP número `NO_RESULT`, name search e PDF `SUCCESS` | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0196151-64.2018.8.26.0500 | `DIVERGÊNCIA` — registro oficial cita Fernando; snapshot possui sete nomes; atuais pendentes | DEPRE/order/SEI `LOCALIZADOS`; originário `NÃO LOCALIZADO` | Nome Carlos Eduardo de Oliveira `LOCALIZADO`; OAB `PENDENTE` por homônimos | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, linha oficial preexistente `NOT_ATTEMPTED` | `Entrada`; sem CRM record/opportunity |
| 7007091-55.2015.8.26.0500 | `PENDENTE` — quatro importados `UNVERIFIED_IMPORT` | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` nesta fase | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, PDF timeout | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0513642-74.2019.8.26.0500 | `LOCALIZADO` historicamente; atual pendente | Relação ao DEPRE/order/SEI `LOCALIZADA`; originário `NÃO LOCALIZADO` | `LOCALIZADO` Eneida Rute Manfredini Barbosa / OAB `LOCALIZADO` 128909/SP | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` — CNA não expôs canal de contato | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT`, PDF `SUCCESS` | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0065683-46.2017.8.26.0500 | `PENDENTE` — dois importados `UNVERIFIED_IMPORT` | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT` | `Entrada`; CRM `NEW`, task `OPEN`; sem opportunity |
| 0500766-24.2018.8.26.0500 | `PENDENTE` — snapshot, não unido ao mesmo nome de outro DEPRE | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT` | `Entrada`; sem CRM record/opportunity |
| 7007092-40.2015.8.26.0500 | `PENDENTE` — snapshot somente | `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `NÃO LOCALIZADO` / `NÃO LOCALIZADO` | `SEM CONTATO CONFIRMADO` | `INSUFFICIENT_COVERAGE`; TJSP `NO_RESULT` | `Entrada`; sem CRM record/opportunity |

### Processo, chronology, value and date-base

| DEPRE | Processo/origem | Ordem/natureza/status encontrado | Valor/data-base |
|---|---|---|---|
| 0165056-11.2021.8.26.0500 | Originário e requisitório não localizados | Refs municipais armazenadas; resultado TJSP `NO_RESULT` | Valor atual e data-base `NÃO LOCALIZADO`; campos importados continuam zero/vazios, não são tratados como R$ 0 confirmado |
| 0061620-12.2016.8.26.0500 | Não localizado | Ref municipal `PMC.2023.00019963-91` | Valor/data-base `NÃO LOCALIZADO` |
| 0002075-74.2017.8.26.0500 | Relação direta com DEPRE e ordem cronológica 11/2018-alimentar; processo originário não localizado | Credor provisoriamente habilitado no edital | Valor atual/data-base `NÃO LOCALIZADO` |
| 0038850-88.2017.8.26.0500 | TJSP por nome em fase anterior retornou DEPRE exato/code `DW000CR8L0000`; a busca numérica desta fase foi `NO_RESULT`; processo originário não localizado | Ordem 89/2020; duas refs SEI distintas na p.34 | Valor/data-base `NÃO LOCALIZADO`; `dataRecebimento` anterior não é data-base |
| 0196151-64.2018.8.26.0500 | DEPRE exato | Ordem 84/2019; SEI `PMC.2023.00073678-24` | Valor/data-base `NÃO LOCALIZADO` |
| 7007091-55.2015.8.26.0500 | Originário não localizado | Refs municipais existentes; conteúdo do PDF compartilhado indisponível nesta fase | Valor/data-base `NÃO LOCALIZADO` |
| 0513642-74.2019.8.26.0500 | DEPRE exato; processo originário não localizado | Ordem 24/2021; SEI `PMC.2021.00049793-06` | Valor/data-base `NÃO LOCALIZADO` |
| 0065683-46.2017.8.26.0500 | Não localizado | API `NO_RESULT`; nenhum vínculo oficial no PDF lido | Valor/data-base `NÃO LOCALIZADO` |
| 0500766-24.2018.8.26.0500 | Não localizado | API `NO_RESULT`; sem publicação localizada nos documentos acessíveis | Valor/data-base `NÃO LOCALIZADO` |
| 7007092-40.2015.8.26.0500 | Não localizado | API `NO_RESULT`; sem publicação localizada nos documentos acessíveis | Valor/data-base `NÃO LOCALIZADO` |

Nenhum campo de valor ou data-base foi alterado. A lista municipal Guarulhos é provisória; as publicações de Campinas são históricas. Nenhuma delas confirma saldo atual. A data impressa no PDF 4444946 (14/10/2021) é data do documento/publicação e não foi usada como data-base.

## Lawyers, OAB and contact

- Advogado de Lúcia e Nelson na publicação do DEPRE 0038850: Daniel Krahembuhl Wanderley. CNA/OAB retornou um resultado exato de nome, advogado SP `307900`; gravado nas observações como provenance profissional separada.
- Advogada de Sandra no DEPRE 0513642: Eneida Rute Manfredini Barbosa. CNA/OAB retornou um resultado exato de nome, advogada SP `128909`; gravado separadamente.
- Advogado da linha histórica de 0196151: Carlos Eduardo de Oliveira. A consulta CNA excedeu 10 resultados e trouxe nomes homônimos; nenhuma OAB foi atribuída.
- O CNA identificou registros profissionais, mas não apresentou canal de contato (telefone, e-mail, endereço profissional ou site de escritório) para estes resultados. A inscrição OAB não é por si só uma rota de contato.
- Não foi confirmado telefone, e-mail, WhatsApp, endereço ou contato direto do titular. Contatos globais do cliente permaneceram vazios.
- Classificação mutuamente exclusiva: `CONTATO CONFIRMADO` 0; `ROTA PROFISSIONAL` 0; `SEM CONTATO CONFIRMADO` 10. Telefone/e-mail de titular permanecem ausentes nas dez operações.
- Não houve contato, mensagem, e-mail, ligação, atribuição de lead para solicitação ou atividade comercial.

## Evidence and DOCUMENTAÇÃO 2/2

| DEPRE | Fonte/identificador | URL oficial | Tipo / status / força | Resolver | Qualifica? |
|---|---|---|---|---|---|
| 0002075-74.2017.8.26.0500 | Edital 002/2024-SF; p.42; ordem 11/2018 | Guarulhos `1325059861.pdf` | `OFFICIAL_RECORD / COLLECTED / MEDIUM` existente | `EXACT_DOCUMENT_IDENTIFIER`; reutilizada `6f67ae09-020e-455b-9281-315c1bfde2c6` | Não: tipo/status/força |
| 0038850-88.2017.8.26.0500 | `PMC.2021.00051374-90`; p.34; ordem 89/2020 | Campinas `4444946.pdf` | `OFFICIAL_RECORD / COLLECTED / MEDIUM` | `EXACT_DOCUMENT_IDENTIFIER`; reutilizada `9b11d011-955a-48b7-859a-06ad5878301b` | Não |
| 0038850-88.2017.8.26.0500 | `PMC.2021.00051365-07`; p.34; ordem 89/2020 | Campinas `4444946.pdf` | Novo `OFFICIAL_RECORD / COLLECTED / MEDIUM` | Primeiro `UNRESOLVED` por documento/ref/URL distintos; persistido como `174e6787-a9bf-401a-a8b2-53b45ad4a0e9`; replay exato por identifier | Não |
| 0196151-64.2018.8.26.0500 | p.7; ordem 84/2019; SEI `PMC.2023.00073678-24` | Campinas `561915106409510645619126.pdf` | `OFFICIAL_RECORD / COLLECTED / MEDIUM` anterior | Evidência preexistente `e18443ce-f203-4c36-8736-50ce43f28678`; nesta fase `NOT_ATTEMPTED` | Não |
| 0513642-74.2019.8.26.0500 | `PMC.2021.00049793-06`; p.35; ordem 24/2021 | Campinas `4444946.pdf` | `OFFICIAL_RECORD / COLLECTED / MEDIUM` anterior | `EXACT_DOCUMENT_IDENTIFIER`; reutilizada `c6b97a46-6e18-4394-99b7-0a3fc1c84aee` | Não |

Os demais alvos têm apenas evidências preexistentes `OFFICIAL_RECORD/COLLECTED/MEDIUM` ou nenhuma; nenhum registro foi promovido a `VERIFIED/STRONG`. A nova evidência de Nelson é do mesmo PDF oficial que contém a linha de Lúcia, mas é uma única publicação compartilhada: não é contada como uma segunda evidência independente para Lúcia, Nelson ou 2/2. Não foi criado documento sintético.

**DOCUMENTAÇÃO 2/2: 0/10 casos. Casos com 1/2: 0. Casos com 2/2: 0.** A regra imutável permanece: dois documentos distintos, oficiais, `VERIFIED`, `STRONG`, de tipos qualificadores e não duplicados.

## Canonical source coverage

O avaliador `evaluateSourceCoverage` recebeu os dez resultados TJSP `NO_RESULT` com uma `sourceId` independente (`tjsp-processual`) e **sem policy de fontes obrigatórias configurada**. Resultado: `INSUFFICIENT_COVERAGE`; blocker `EXPLICIT_COVERAGE_POLICY_REQUIRED`; source consultada `tjsp-processual`; `sourcesWithNoResult=["tjsp-processual"]`. Um resultado sem linha continua `NO_RESULT`, não `NOT_FOUND`.

Os resultados detalhados por URL/status estão nas duas matrizes anteriores. Os downloads de documentos e buscas CNA foram executados fora do worker automatizado; por isso `acquisition_events` continua com 0 registros. Não foi fabricado job para encobrir esse limite. Resultados factuais persistidos em observações têm status/proveniência individual; resultados sem evidência permanecem no presente relatório.

## Multiple-beneficiary data model

`workflow.client.name` foi mantido sem alteração para compatibilidade e preservação do snapshot original. O workflow agora tem `client.beneficiaries[]`, cada item ancorado ao DEPRE e contendo nome, papel, classificação temporal, fonte, URL (vazia apenas para snapshot importado), provider, sourceId, route, status canônico, identifier/reference, timestamp, evidenceId/strength e provenance de advogado/OAB.

- 13 nomes dos snapshots de 0065683, 7007091 e 0196151 foram representados individualmente como `UNVERIFIED_IMPORT`, papel `UNKNOWN`, status de fonte `NOT_ATTEMPTED`, sem URL oficial, sem evidenceId e sem força documental.
- Quatro observações `HISTORICAL_CONFIRMED`: Elson, Lúcia, Nelson e Sandra.
- Uma observação `DIVERGENT`: Fernando, contra a lista importada de sete titulares de 0196151.
- Não houve observação `CURRENT_CONFIRMED`. Todos os dez estados de titular atual permanecem não confirmados.

## Automation, CRM and AI

- Novos jobs de pesquisa: 0 (limite era 10). Nenhuma tentativa foi repetida por automação; os 36 jobs existentes permaneceram sem retry/alteração. Nove dos dez alvos têm um job `SOURCE_ACQUISITION` preexistente em `FAILED`; 0500766 não tem job correspondente.
- Estados canônicos dos jobs preexistentes:

| DEPRE | Código do job anterior | Resultado/mensagem |
|---|---|---|
| 0165056-11.2021.8.26.0500 | `RESEARCH_NOT_ENABLED` | DataJud bloqueado sem autorização explícita de pesquisa |
| 0061620-12.2016.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |
| 0002075-74.2017.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |
| 0038850-88.2017.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |
| 0196151-64.2018.8.26.0500 | `RESEARCH_AUTHORIZATION_REQUIRED` | Fonte não autorizada para pesquisa pelo worker |
| 7007091-55.2015.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |
| 0513642-74.2019.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |
| 0065683-46.2017.8.26.0500 | `RESEARCH_NOT_ENABLED` | DataJud bloqueado sem autorização explícita de pesquisa |
| 0500766-24.2018.8.26.0500 | Sem job | Nenhuma tentativa do worker persistida |
| 7007092-40.2015.8.26.0500 | `MANUAL_REQUIRED` | Consulta automatizada desabilitada; nenhuma requisição do worker |

- `acquisition_events`: 0; detalhes das chamadas manuais estão nesta matriz. A policy de cobertura não está configurada, portanto cobertura permanece insuficiente.
- CRM global: 15 records, 15 tasks, 0 órfãos, 0 activities. Nenhuma etapa, oportunidade, tarefa ou contato foi alterado nesta fase.
- Notificações: 0 entregas. Outreach: nenhum.
- `DEEPSEEK_API_KEY=NOT_SET`. Nenhuma chamada de IA foi feita. **EXTERNAL AI VERIFICATION PENDING**; IA não resolveu identidade nem evidência.

## Final database integrity

Auditoria final somente leitura após as mutações:

| Medida | Resultado |
|---|---:|
| Operações totais / reais / demo | 77 / 76 / 1 |
| DEPREs reais únicos / grupos duplicados | 73 / 0 |
| Evidências / qualificáveis / órfãs | 13 / 0 / 0 |
| CRM records / órfãos | 15 / 0 |
| CRM tasks / órfãs | 15 / 0 |
| Jobs / alvos inválidos | 36 / 0 |
| Audit events / integrity | 118 / cadeia válida |
| CRM activities / notification deliveries | 0 / 0 |
| Acquisition events | 0 |
| Alvos Phase 2 reais, únicos | 10 / 10 |
| Beneficiários estruturados | 18 (13 importados não verificados, 4 históricos confirmados, 1 divergente) |
| Operações-alvo com observações estruturadas | 6 |
| Titular atual confirmado / não confirmado | 0 / 10 |
| Operações com advogado identificado / observações OAB | 3 / 3 (2 inscrições únicas) |
| Contatos confirmados / rotas profissionais / sem contato confirmado | 0 / 0 / 10 |
| Casos 1/2 / 2/2 | 0 / 0 |
| Migração `20260919_cp21_foundation` | presente |

O aumento de evidência de 12 para 13 é explicado pelo novo registro oficial do PDF 4444946, página 34, ref `PMC.2021.00051365-07`. Não foram criadas operações, alterados dados demo, jobs, contatos, CRM ou notificações. As 13 observações de snapshots preservam os nomes que já existiam no campo original e não são consideradas prova oficial.

## Bugs/errors found and fixes

| Problema encontrado na fase | Causa | Correção nesta mesma fase |
|---|---|---|
| Campo legado só aceitava `client.name` escalar, sem fonte/estado por beneficiário | O schema do workflow não representava múltiplas relações ou status temporal | Lista tipada `client.beneficiaries[]`; parse legado preenche lista vazia; serviço exige DEPRE exato; teste com duas pessoas no mesmo DEPRE |
| Nomes múltiplos importados não eram individualizáveis sem promover identidade | Separador da planilha preservado apenas como texto | 13 observações `UNVERIFIED_IMPORT/UNKNOWN`, idempotentes, sem URL, evidência ou confirmação; string original mantida |
| Rota usada no primeiro lote ligava Lúcia/Nelson ao PDF 1882658638, apesar da extração desta fase vir do PDF 4444946 | Mapeamento incorreto entre URL examinada e fato retornado | URL corrigida; resolver reutilizou Lúcia pelo SEI exato, persistiu a ref distinta de Nelson no PDF realmente lido e reconciliou as observações sem duplicar linhas |
| `requestId` de auditoria poderia superar o limite com referências longas | Referência documental concatenada no ID | ID determinístico SHA-256 de tamanho fixo |
| Guarda de snapshot exigia a fonte no campo workflow, mas o dado real estava em `operation.source` | Origem gravada em campos alternativos existentes | Validação agora aceita um dos dois campos e ainda exige nome literal no snapshot |
| Teste do novo schema omitiu campos de provenance obrigatórios; primeiro teste de snapshot teve import ausente e depois falhou na origem | Fixtures incompletos e guarda que verificava apenas `workflow.credit.sourceName`, não `operation.source` | Fixtures completados, import corrigido e guarda passou a validar os dois campos existentes; assertions mantidas |
| Primeiro `tsc` encontrou status tipado para snapshot incompatível, literal vazio alargado, comparação inalcançável no batch e erros no auditor temporário | Tipo de input de snapshot herdava a união histórica; constantes literais inferidas como `string`; ternário ficou inalcançável após `continue`; auditor exploratório era temporário e não tipado | Tipo específico `ImportedBeneficiarySnapshotInput`, `as const`, remoção da comparação morta e remoção do auditor temporário; typecheck subsequente passou |
| Papel de Elson foi inicialmente gravado como `TITULAR`, mas o edital diz “credor provisoriamente habilitado” | A enumeração não possuía papel `CREDOR` e o comparador idempotente ignorava mudança do papel | Papel `CREDOR` adicionado; mesmo ID reconciliado in-place e current holder mantido `CURRENT_HOLDER_NOT_CONFIRMED`; teste cobre sem duplicação |
| Auditor read-only temporário reportou 9/10 alvos válidos em uma rodada | O ID digitado nesse auditor era `...4aa1...`; o ID canônico é `...4aa2...` | ID corrigido e consulta read-only refeita: 10/10 IDs reais únicos existem; inventário operacional não foi alterado |
| CNA para Carlos Eduardo de Oliveira retornou lista acima de 10 nomes | Consulta nominal pública não desambigua a pessoa | OAB não atribuída; status mantido manual/ambíguo, sem dado no workflow |
| Um DEPRE candidato fora do lote (`02588958-52.2020.8.26.0500`) tem oito dígitos no primeiro segmento | Identificador importado fora do formato CNJ usual | Preservado sem normalização; excluído antes da seleção; requer validação por documento oficial, não corrigível sem evidência |

## Phase 1 carry-forward

As correções/condições da Fase 1 permanecem: worker Vitest único para evitar os timeouts em `demo.test.ts`, `cp21-e2e.test.ts` e `autonomous-acquisition.test.ts`; migração E2E aplica esquema antes de escrever marcador; cinco `tmp_*.js` locais seguem ignorados pelo lint; 21 warnings previamente existentes são reportados separadamente. O baseline à entrada era 283 testes aprovados, 2 E2E, TypeScript sem erro, lint 0 erros/21 warnings e `git diff --check` aprovado. Os resultados desta rodada final estão abaixo.

## External limitations and final acceptance

- Os dez números consultados na API TJSP retornaram `NO_RESULT`; nenhuma conclusão de inexistência foi feita.
- Três PDFs Campinas sofreram timeout de transporte de 30 s. Dois PDFs oficiais foram acessados com HTTP 200 e conteúdo extraído.
- Status atual/titularidade sucessória, processo originário, valor atualizado, data-base e contato dos dez alvos permanecem pendentes.
- 0196151 tem divergência histórica oficial/importada; 0038850 tem titulares históricos publicados distintos do snapshot, sem confirmação atual.
- A cobertura externa é `INSUFFICIENT_COVERAGE` porque não há policy canônica explícita configurada e várias fontes/documentos continuam pendentes.

Critérios internos: dez alvos reais processados; multiple beneficiaries preservados; provenance corrigida; pipeline determinístico executado; 2/2 inalterado; nenhum registro de operação duplicado/órfão; CRM sem atividade; zero outreach; audit chain íntegra; validações finais a seguir.

## Final validation sequence

| Comando | Resultado final |
|---|---|
| `npm test -- --run` | PASS — 50 arquivos, 291 testes |
| `npm run test:e2e` | PASS — 2 cenários, 2 aprovados |
| `npx tsc --noEmit --pretty false` | PASS — sem erros |
| `npm run lint` | PASS — 0 erros, 21 warnings |
| `git diff --check` | PASS — apenas avisos de conversão LF→CRLF do Git no Windows |

Os 21 warnings são os mesmos apontados no fechamento da Fase 1, em arquivos não alterados nesta fase; não foram ocultados. O E2E emitiu somente os avisos existentes do Next sobre `scroll-behavior`.

> PHASE 2 COMPLETE — EXTERNAL VERIFICATION PENDING
