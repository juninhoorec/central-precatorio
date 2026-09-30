# CP — Piloto real de captação autônoma

> **Execução isolada e limitada.** Foram usados somente os PDFs CAC 731257 e 731208 (801 + 911 registros); nenhum outro CAC foi processado. Banco: `REAL_AUTONOMOUS_PILOT`, cópia local do banco E2E. Nenhuma base de produção foi acessada ou alterada; o servidor local de desenvolvimento foi conectado somente a essa cópia isolada, e o banco E2E original não foi alterado. Os PDFs fonte não foram alterados. Nenhum pedido HTTP externo foi enviado; nenhum dado foi publicado em páginas públicas ou demo.

## Resultado executivo

O pipeline local importou e filtrou 1.712 registros. A validação CNJ corrigida confirmou **1.712 DEPRE válidos** pelo formato e dígito verificador Módulo 97; **0 inválidos**. Dos elegíveis, o teste de ativação selecionou exatamente um caso. O adapter preservou o DEPRE original e normalizou os dígitos corretamente, mas **não enviou requisição**: `DATAJUD_COMMERCIAL_USE_AUTHORIZED` está falso/não configurado e a chave não foi configurada no ambiente local. Diante da ressalva de uso comercial descrita pelo usuário, o adapter retornou `DATAJUD_USE_NOT_AUTHORIZED`; não se declarou credor ausente, não se testou autenticação HTTP e não se executou e-SAJ. A fonte ficou registrada como **“Disponível tecnicamente / uso comercial sujeito a autorização”**. Nenhuma evidência oficial, contato ou caso READY foi produzido. Isso não é um piloto de fonte bem-sucedido; é uma validação de identificação CNJ, isolamento e bloqueio explícito antes do acesso externo.

## IMPORT

| Arquivo | Registros parseados | Importados | Data-base da fonte | Coletado em | SHA-256 |
|---|---:|---:|---|---|---|
| ListaPrecatorioPendente_731257.pdf | 801 | 801 | 2026-09-04 | 2026-09-30T19:40:32.182Z | `deee8bd265b65770d8ff4dce43cb91a7d3237788db92408fd1b297bb14e2ef30` |
| ListaPrecatorioPendente_731208.pdf | 911 | 911 | 2026-09-04 | 2026-09-30T19:41:13.941Z | `df46a56c9cfbfc643a5ed13cedba80a7d024b0ad3b1a05a5fc38d1021c1d1dac` |

- Total parseado: **1712**.
- Rejeições do parser: **0** de 1712 candidatos detectados.
- Os 1.712 números DEPRE passaram a validação CNJ (estrutura + check digit Módulo 97); o número originário é um identificador distinto e estava ausente nos 908 elegíveis.
- Proveniência por registro: `documentId`, nome do PDF, checksum SHA-256, sessão de captura, URL CAC oficial, página/registro, data-base, data de coleta, versão do parser e trechos de evidência posicional foram mantidos nos metadados de captura.
- Cada operação tem evidência de importação marcada para revisão humana. Essa evidência da lista CAC **não** foi tratada como ofício individual.

## FILTER

| Resultado determinístico | Quantidade |
|---|---:|
| Importados | 1712 |
| Elegíveis para investigação (valor ≥ R$ 100.000, DEPRE CNJ válido, TJSP e devedora presente) | 908 |
| Abaixo de R$ 100.000 | 804 |
| DEPRE CNJ válido por Módulo 97 | 1712 |
| DEPRE inválido/ausente entre registros importados | 0 |
| Falta de devedora entre registros importados | 0 |

## INVESTIGATION / CREDITOR

- Elegíveis processados pelo worker: **908**.
- Credor identificado com evidência: **0**.
- Casos sem resolução de credor comprovada: **908**; a execução antiga não consultou fontes, portanto não significa “credor não encontrado”.
- Processo originário CNJ consultável (20 dígitos) nos 908 elegíveis: **0**.
- DEPRE CNJ consultável (20 dígitos, com check digit) nos 908 elegíveis: **908**; o adapter corrigido usa esse identificador sem confundi-lo com o originário.
- Resolução de identidade/atual titular: não realizada; nenhum titular atual foi inferido.
- AI/Qwen: **não invocado**; não bloqueou a execução.

Os eventos `INVALID_QUERY_IDENTIFIER` e `DAILY_BUDGET_EXHAUSTED` abaixo são da execução anterior, que consultava o processo originário, usava a validação incompleta e contava eventos sem distinguir requisições reais. **Não são resultado de chamadas externas.** A implementação atual valida o DEPRE com Módulo 97 antes do orçamento e contabiliza apenas requisições efetivamente tentadas. A chave e a autorização comercial continuam necessárias para chamar o DataJud.

### Eventos por fonte

| Fonte | Estado | Resultado de acesso | Casos |
|---|---|---|---:|
| datajud | DAILY_BUDGET_EXHAUSTED | DAILY_BUDGET_EXHAUSTED | 883 |
| datajud | INVALID_QUERY_IDENTIFIER | INVALID_QUERY_IDENTIFIER | 25 |
| deterministic-filter | REJECTED | NOT_APPLICABLE | 804 |
| qualification | WAITING | NOT_READY | 908 |
| tjsp-cac-pending | ASSISTED_SOURCE_REQUIRED | NO_REQUEST_MADE | 908 |
| tjsp-esaj | MANUAL_REQUIRED | NO_REQUEST_MADE | 908 |

## CONTROLLED SOURCE ACTIVATION (1 CASE)

- Casos selecionados: **1** (identificador mascarado `035****0500`, valor R$ 378.107.980,27).
- Identificadores DEPRE validados no banco isolado: **1712 válidos / 0 inválidos**.
- Resultado CNJ do caso: válido; identificador original preservado no evento restrito ao banco local e dígitos normalizados para a consulta.
- DataJud: **0 requisições tentadas**, HTTP status **não aplicável**, resultado `DATAJUD_USE_NOT_AUTHORIZED`.
- Motivo: autorização para uso comercial não foi confirmada/configurada; a chave não foi transferida para ambiente ou código. A condição de autorização precede a verificação da chave e o orçamento de requests.
- e-SAJ/TJSP: **não consultado**; status `SKIPPED_DATAJUD_NOT_QUERIED`. Nenhum CAPTCHA foi encontrado ou contornado.
- Partes, credor resolvido, ofícios e contatos: **0**. Não é uma conclusão de ausência nas fontes.
- O caso de teste isolado foi marcado `SOURCE_BLOCKED`, com a razão `DATAJUD_USE_NOT_AUTHORIZED`. Os outros 907 elegíveis não foram reprocessados.
- Expansão para 25 casos: **não executada**; o gate de 5 requisições válidas não se aplica e não foi satisfeito. O escopo mais recente solicitou um único caso e o bloqueio legal interrompeu a consulta antes de qualquer request.
- O resultado detalhado, sem identificador completo, está no arquivo local ignorado pelo Git `.local-data/REAL_AUTONOMOUS_PILOT/source-test-result.json`.

## OFFICIAL EVIDENCE / CONTACT / READY

| Métrica | Quantidade |
|---|---:|
| Documentos/ofícios oficiais coletados pelo worker | 0 |
| Elegíveis com 2/2 ofícios distintos verificados | 0 |
| Contatos localizados | 0 |
| READY_FOR_ANALYST | 0 |
| Bloqueios CAPTCHA confirmados | 0 |

Nenhuma URL de download foi criada e nenhuma evidência sintética foi inserida. A lista CAC importada não satisfaz o gate de dois ofícios.

## REJECTED / QUEUE

- Rejeitados por valor abaixo do mínimo: **804**.
- Jobs aguardando fonte após a execução original: **908**; após o teste bloqueado de um caso: **907 WAITING + 1 SOURCE_BLOCKED**.
- Erros do worker: **0**.
- Tentativas repetidas: **0**.
- Ciclos processados: **36**, limite 50 por ciclo.
- Nova chamada imediata após processamento: **0** jobs; fila idempotente, sem repetição de chamadas.
- Enfileiramento duplicado do mesmo lote: **0** novos jobs.
- Chamadas HTTP externas pelo worker: **0**.
- Duração média por job: **85 ms**; maior duração: **961 ms**; tempo total de execução local: **340134 ms**.
- Dashboard da organização isolada consultado ao final; totais reportados pelo dashboard: `{"total":1712,"analyzed":1712,"inAnalysis":0,"qualified":0,"ready":0,"rejected":804,"waitingSource":908,"conflicts":0,"errors":0,"revalidation":0,"byState":{"REJECTED":804,"WAITING":908}}`.

## ALERTS

- Telegram enabled: **não**.
- Mensagens enfileiradas/enviadas: **0**.
- Nenhuma mensagem externa foi enviada.

## 10 casos representativos (identificadores anonimizados)

Valores e devedoras são os dados publicados na lista CAC; o DEPRE foi mascarado. Não há nomes de credores nem contatos pessoais neste relatório.

| ID seguro | DEPRE | Valor | Devedora | Credor | Ofícios | Contato | Estado | Falha/limitação de fonte |
|---|---|---:|---|---|---|---|---|---|
| PILOTO-731257-01 | *******-**.****.8.26.**** | R$ 378.107.980,27 | MUNICÍPIO DE GUARULHOS | Não resolvido (fonte não consultada) | 0/2 ofícios individualizados | Não localizado | SOURCE_BLOCKED | DEPRE CNJ válido; uso comercial DataJud sem autorização; processo originário ausente |
| PILOTO-731257-02 | *******-**.****.8.26.**** | R$ 270.542.927,86 | MUNICÍPIO DE GUARULHOS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731257-03 | *******-**.****.8.26.**** | R$ 245.069.679,35 | MUNICÍPIO DE GUARULHOS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731257-04 | *******-**.****.8.26.**** | R$ 209.324.702,13 | MUNICÍPIO DE GUARULHOS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731257-05 | *******-**.****.8.26.**** | R$ 147.593.248,91 | MUNICÍPIO DE GUARULHOS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731208-01 | *******-**.****.8.26.**** | R$ 195.349.173,95 | MUNICIPIO DE CAMPINAS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731208-02 | *******-**.****.8.26.**** | R$ 21.319.141,41 | MUNICIPIO DE CAMPINAS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731208-03 | *******-**.****.8.26.**** | R$ 20.113.350,33 | MUNICIPIO DE CAMPINAS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731208-04 | *******-**.****.8.26.**** | R$ 14.285.463,14 | MUNICIPIO DE CAMPINAS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |
| PILOTO-731208-05 | *******-**.****.8.26.**** | R$ 12.337.029,79 | MUNICIPIO DE CAMPINAS | Não resolvido (fontes não consultadas) | 0/2 ofícios individualizados | Não localizado | WAITING | DEPRE CNJ válido; DataJud não consultado; e-SAJ manual |

## QA e limitações

- TypeScript (`npx tsc --noEmit --pretty false`): **PASS**, reexecutado após as últimas alterações.
- Lint (`npm run lint`): **0 erros, 16 avisos** existentes.
- Vitest (`npm test -- --reporter=dot`): **132/132 PASS** (31 arquivos), reexecutado após as últimas alterações.
- Playwright (`npx playwright test lead-center.spec.ts --reporter=line`): **2/2 PASS** após tornar explícita a espera pela navegação a `/workspace`.
- Build (`npm run build`): **PASS**, reexecutado após as últimas alterações.
- Diff check (`git diff --check`): **PASS**, reexecutado após as últimas alterações.
- Testes focados de fonte/worker após correções: **25/25 PASS** na rodada anterior; a suíte completa de 132 testes foi reexecutada.
- Runtime nesta cópia: importação, filtro, worker, dashboard, fila e idempotência concluídos; nenhuma falha de job.
- Navegador autenticado (execução inicial, antes do teste unitário bloqueado): **PASS** em `http://localhost:3111/conta` → organização local `CP Piloto Real` → `/workspace` → `Captação Autônoma`. O painel mostrou **1.712** na fila, **1.712** analisados, **908** aguardando fonte, **804** reprovados, **0** READY, **0** erros e **30** linhas na primeira página. Os cartões de operações exibiram 1.712 operações e excluíram dados marcados como demonstração.
- A organização foi criada na cópia isolada, e as linhas do piloto foram vinculadas a ela para permitir a inspeção autenticada. O rótulo do painel “Operações de produção” significa registros não marcados como demo; esses registros CAC reais foram exibidos somente no servidor local conectado à cópia isolada, não em uma base ou dashboard de produção.
- **BLOQUEADOR:** fonte externa não consultada porque o uso comercial não foi autorizado/configurado e `DATAJUD_PUBLIC_API_KEY` não está no ambiente local. A reachability e autorização HTTP permanecem sem teste. e-SAJ continua manual, sem requisição. Logo, ainda não se provou enriquecimento, coleta de dois ofícios, contato nem geração de caso acionável com fontes reais.
- Comparação com o robô atual: **não realizada**; nenhum arquivo de saída desse processo foi fornecido para cotejar cobertura, identificadores, duplicidades, divergências, evidências ou frescor.
- **NÃO BLOQUEADOR:** contato é opcional; ausência não foi usada para rejeitar.
- **NÃO BLOQUEADOR:** CAPTCHAs não foram contornados nem encontrados; alertas Telegram ficaram desligados.
- A conta e a organização são locais e estão restritas à cópia isolada. O e-mail da conta permanece sem verificação; o servidor de desenvolvimento permite a inspeção autenticada sem alterar esse estado.
- Não foram executadas novas consultas externas nem reprocessado o lote durante a verificação do navegador.
- Para evitar tráfego sem credencial ou acesso não permitido, o worker foi executado com fetch bloqueado explicitamente. Não houve tráfego externo.
