# Relatório de importação do pacote real de 73 DEPREs

## 1) Arquivo base
- Arquivo: `data/CP_pacote_completo_73_DEPREs.xlsx`
- Local real: `C:\Users\Junio Cavalcanti\Downloads\CP_pacote_completo_73_DEPREs.xlsx`
- Copiado para o workspace: sim
- Status: disponibilizado no projeto e processado pela pipeline existente do CP

## 2) Estrutura das abas

### Aba `Contatos 73`
| Coluna | Conteúdo |
| --- | --- |
| A | Município |
| B | DEPRE |
| C | Titular/Credor |
| D | Status de contato |
| E | Rota/Contato público |
| F | Detalhe |
| G | Fonte da busca |

### Outras abas presentes
- `Resumo`
- `Como localizar`
- `Especificação CP`
- `Campos obrigatórios`
- `Regras de validação`

## 3) Quantidade e integridade
- Total de linhas da aba `Contatos 73`: 74 (1 linha de cabeçalho + 73 registros)
- Total de DEPREs: 73
- DEPREs únicos: 73
- Duplicidades: 0
- Registros inválidos ou vazios: 0

## 4) Verificação de duplicidade
O cálculo foi executado diretamente sobre a coluna `DEPRE` da aba real. A chave foi normalizada para remover pontuação e comparar somente o identificador numérico.

Resultado:
- DEPREs detectados: 73
- DEPREs únicos após normalização: 73
- Duplicidades indevidas: 0

## 5) Mapeamento para o modelo de dados do CP
| Campo da planilha | Mapeamento no modelo do CP |
| --- | --- |
| `Município` | `workflow.credit.municipality` |
| `DEPRE` | `workflow.credit.numeroProcessoDEPRE` + `numeroProcessoDEPRENormalizado` |
| `Titular/Credor` | `workflow.client.name` |
| `Status de contato` | preservado em evidência e notas de importação |
| `Rota/Contato público` | preservado em evidência e notas de importação |
| `Detalhe` | preservado em evidência e notas de importação |
| `Fonte da busca` | preservado em evidência e notas de importação |

### Campos sem correspondência direta no modelo atual
- `Status de contato` não tem campo obrigatório no schema do workflow
- `Rota/Contato público` não tem campo obrigatório no schema do workflow
- `Detalhe` não tem campo obrigatório no schema do workflow
- `Fonte da busca` não tem campo obrigatório no schema do workflow

Esses campos foram preservados como rastreio textual na `workflow.evidence` e no `sourceRow` do lote de importação, em vez de serem apagados ou reinterpretações silenciosas.

## 6) Processo de importação utilizado
A ingestão foi feita pela pipeline existente do projeto, com uso do fluxo de criação de operação e registro do lote importado:
- `src/lib/capture-imports.ts`
- `src/lib/operations.ts`
- `src/lib/operational-workflow.ts`

Sem sobrescrita silenciosa de dados existentes.

## 7) Resultado da importação
- Operações criadas no banco: 73
- Registros ignorados por duplicidade: 0
- Lote de importação: `9ad692fe-8444-40ce-94b1-c72b53d59a7b`
- Organização inicial: `legacy-internal` (origem técnica, antes da associação ao tenant interno)
- Organização operacional: `CP 2.1 Demonstração` (`nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u`)

## 8) Observações
- A origem dos registros é exibida como `BASE INICIAL — 73 DEPREs`.
- Estado de estoque derivado dos marcadores de origem: 73 disponíveis.
- Estado de reconferência IA: 73 pendentes; confiança não avaliada em todos; nenhuma reconferência em massa foi executada.
- O tenant operacional tinha 1 operação sintética e 1 membro `owner` antes da migração. Depois: 74 operações no total (73 registros reais + 1 exemplo sintético), sem criar organização ou usuário.
- Disponibilidade e reconferência IA são campos independentes. Qualificação, documentos ou IA pendente não retiram esses registros da lista de estoque.
- A planilha não contém valor do crédito; o painel apresenta esses valores como `Não informado`, sem inferir R$ 0,00 como valor do precatório.
- A migração transacional alterou apenas `organization_id` nas 73 operações, 73 linhas `capture_import_rows` e no lote. Fingerprint de título, credor, município, DEPRE, origem, valor, workflow e flag sintética conferido antes/depois sem alterações.
- Colisões de DEPRE no destino: 0. Registros importados ainda em `legacy-internal`: 0. O exemplo sintético preexistente continua com `isDemo=true`; os 73 reais continuam com `isDemo=false`.
- Origem e disponibilidade são derivadas na leitura a partir dos marcadores existentes; valores, DEPREs, titulares, fontes, evidências e contatos importados não foram modificados.
- O lote e as 73 linhas brutas/normalizadas de captura foram transferidos ao tenant operacional; nenhuma auditoria append-only foi reescrita.
- O owner local foi inicializado pelo comando `npm run auth:bootstrap-local-owner -- --confirm-local-owner`. Apenas o hash da credencial da conta existente foi atualizado; conta, membership e operações foram preservados. A senha temporária não é registrada neste relatório e deve ser trocada após o primeiro login.
- A autenticação local foi alinhada à porta do servidor (`BETTER_AUTH_URL=http://localhost:3110`); a tentativa anterior falhava com `Invalid origin` porque a URL padrão apontava para a porta 3000.
- Confirmação visual autenticada realizada no fluxo normal: login como `auditoria.cp.20260914@example.com`, seleção de `CP 2.1 Demonstração`, abertura de `/workspace` e aba Captação. A lista mostra a base inicial e as colunas DEPRE/credor/devedor/valor/status/disponibilidade/validação IA/confiança/alerta.
- A API `/api/operations` respondeu `200` no tenant ativo com 74 operações: 73 da base inicial e 1 exemplo sintético marcado separadamente. Resultado observado na tabela: 73 `DISPONÍVEL`, 73 `PENDENTE`, 73 `Confiança: não avaliada`, 73 DEPREs únicos e nenhum exemplo sintético misturado na lista operacional.
- Os 73 DEPREs, titulares e municípios foram comparados 1:1 com a planilha. Os valores permanecem ausentes na origem; o painel mostra `Não informado`.
- A rota `/api/operations` sem sessão respondeu `401` e `/workspace` redirecionou para `/conta`, confirmando a proteção de autenticação.
- Testes finais: `npm test -- --run` passou (31 arquivos, 145 testes); `npm run lint` passou sem erros (16 avisos existentes). O Playwright isolado não alcançou assertions: primeiro o Turbopack recusou o junction de `node_modules`; a tentativa com Webpack falhou ao processar `.d.ts` desse junction. O banco protegido `cp-lead-center-e2e.db` não foi usado nem alterado.
- Evento de migração append-only registrado no lote `9ad692fe-8444-40ce-94b1-c72b53d59a7b`; cadeia de auditoria do tenant verificada como válida.
- Nenhuma rotina automática de reconferência IA foi criada ou executada.

## 9) Piloto individual de evidência oficial
- DEPRE escolhido: `0038850-88.2017.8.26.0500`, titular `Marcos Sampaio Tocalino`, devedor `Campinas`. A escolha se baseou na busca individual já disponível no TJSP e no único titular registrado para facilitar o vínculo exato.
- Base antes da pesquisa: valor/data-base, processo originário e advogado/OAB ausentes; operação `Entrada`; disponibilidade `AVAILABLE`; validação IA `PENDING`; confiança `null`; uma evidência manual do XLSX e nenhum documento anexado.
- TJSP: a consulta oficial individual por parte retornou 2 resultados; 1 vinculou exatamente o titular e o DEPRE. Registro: classe `Precatório`, foro `DEPRE`, assunto `Reajustes de Remuneração, Proventos ou Pensão`, `cdProcesso` `DW000CR8L0000`, tipo de busca `NMPARTE`. A API também retornou literalmente `dataRecebimento=17/05/2017`; isso não foi interpretado como data-base.
- TJSP por número do processo e por número do precatório: 0 resultados em cada consulta.
- DJEN/CNJ: consulta independente pelo mesmo número CNJ respondeu HTTP 200 / `NO_RESULT`, sem comunicação retornada.
- Correção de proveniência: a primeira linha foi gravada com a URL `numproc`, mas a pesquisa por essa URL retornou zero resultados. A linha anterior foi preservada e marcada `FAILED`, com nota explicando o erro e referência à correção; não foi apagada.
- Evidência TJSP válida: nova linha `OFFICIAL_RECORD`, status `COLLECTED`, força `MEDIUM`, operação `433c2565-d5d0-424a-b0e1-af7e1d3962b2`, URL efetivamente consultada `https://api.tjsp.jus.br/processo/cpopg/search/nmparte/Marcos%20Sampaio%20Tocalino`, identificador `DW000CR8L0000`. Reconsulta direta confirmou HTTP 200 e vínculo simultâneo do DEPRE, titular e identificador.
- Resultado de suficiência: uma referência TJSP vinculada; DJEN respondeu `NO_RESULT`; nenhuma segunda referência oficial distinta foi comprovada. `countVerifiedOfficialEvidence` permanece 0, 2/2 não foi atingido e a evidência manual do XLSX não foi contada.
- Resultado de suficiência: 1 referência oficial independente; 2/2 não alcançado. `countVerifiedOfficialEvidence` permanece 0, pois o registro não é ofício requisitório/complementar verificado e nenhum documento individual foi obtido. A evidência manual do XLSX não foi contada.
- Resultado IA: **não executado**, conforme a condição de bloqueio. O copiloto atual não pesquisa fontes oficiais nem persiste reconferência individual; a segunda fonte disponível retornou zero e a evidência não é suficiente para 2/2.
- Alterações: 1 linha anterior em `official_evidence_documents` marcada `FAILED` (preservada), 1 nova linha `COLLECTED` na mesma tabela e 1 evento append-only de correção em `audit_logs`; os registros de auditoria anteriores também foram mantidos. A rota de consulta acrescentou 4 eventos individuais em `capture_source_events` e 4 entradas efêmeras em `rate_limits`. Nenhuma linha de `operations`, `capture_import_rows`, documentos ou contatos foi alterada. Nenhum outro DEPRE recebeu evidência ou foi consultado.
- Pós-piloto: os 73 continuam disponíveis, IA pendente e sem confiança avaliada; os outros 72 não foram percorridos por job/batch.
