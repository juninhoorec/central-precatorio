# Benchmark controlado de fontes judiciais — CP 003

## Escopo e integridade

- DEPRE piloto: `0196151-64.2018.8.26.0500`.
- Uma única rodada controlada; cinco handlers de rota chamados uma vez cada.
- Sem retry, sem sweep dos 73 DEPREs, sem DeepSeek ou nova AI reconfirmation.
- Nenhuma operação, snapshot, evidência, disponibilidade ou workflow foi alterado.
- O coletor executou `Promise.allSettled`; cada rota preservou seu resultado independentemente.
- O tempo entre o primeiro e o último início observado foi `120.323 ms`. O início do TJSP_DIRECT ocorreu em `15:33:57.355Z`, DJEN em `15:33:57.403Z`, e o TJSP_DIRECT permaneceu ativo até `15:33:57.711Z`. Há sobreposição observada entre handlers, mas apenas DJEN enviou uma requisição de rede; não se afirma que cinco consultas externas ocorreram em paralelo.

## TJSP DIRECT — JUSCRAPER

### Registro inicial — antes da instalação do runtime

- Provider: `JUSCRAPER`.
- Fonte subjacente: `TJSP`.
- Método solicitado: `cpopg("0196151-64.2018.8.26.0500")`.
- Status: `NOT_CONFIGURED`.
- `requestAttempted`: `false`; a consulta `cpopg` não chegou a ser executada porque não existe runtime Python disponível.
- HTTP: não disponível; nenhuma requisição foi enviada ao TJSP.
- Duração medida pelo handler: `356.255 ms` (resultado do adapter: `354 ms`).
- Número de resultados: `0` retornados; isso não representa `NO_RESULT`, pois a consulta não foi executada.
- URL oficial: `null`; `officialUrlStatus = NOT_RETURNED`. Nenhuma URL foi fabricada.

### Execução real controlada — 2026-10-02

- Executável: `.venv/Scripts/python.exe`, selecionado exclusivamente por `CP_JUSCRAPER_PYTHON`.
- Chamada única: `scraper.cpopg("0196151-64.2018.8.26.0500")`; argumento `method` omitido, portanto usado o padrão documentado `html`.
- Nenhuma chamada a `cposg`, retry ou fallback foi executada.
- Resultado: `ERROR`. `requestAttempted=true`: o JusScraper iniciou o downloader e registrou a tentativa para o CNJ normalizado `01961516420188260500`.
- Início: `2026-10-02T15:46:13.997166+00:00`; fim: `2026-10-02T15:46:15.626214+00:00`; duração: `1629.036 ms`.
- HTTP status: indisponível; o método não expôs o status da resposta.
- O log diz `Nenhum link encontrado`, mas o parser lançou `IndexError` antes de retornar um resultado vazio. Por isso, o status é `ERROR`, não `NO_RESULT`.
- `numeroProcessoDEPRE`: `0196151-64.2018.8.26.0500` (identificador consultado, mantido como DEPRE).
- `numeroProcessoEncontrado`: não retornado. O número sem pontuação no log é o identificador da consulta, não um processo encontrado.
- `numeroProcessoOriginario`: não retornado nem inferido. `numeroPrecatorio`: não retornado.
- Classe, assunto, foro, unidade/vara, partes e movimentos: não retornados.
- URL oficial: `null`; nenhuma URL foi retornada pelo método e nenhuma foi construída.
- Limitação: a página/estrutura consultada não produziu links que o downloader reconhecesse e o parser da versão 0.4.0 falhou ao indexar a lista vazia (`result[0]`). A execução não confirma ausência judicial do processo.
- Nenhuma evidência foi gravada no banco; nenhuma operação, disponibilidade, workflow ou histórico de IA foi alterado.

Registro bruto capturado da única execução:

```json
{
  "method": "TJSP.cpopg",
  "numeroProcessoDEPRE": "0196151-64.2018.8.26.0500",
  "status": "ERROR",
  "requestAttempted": true,
  "startedAt": "2026-10-02T15:46:13.997166+00:00",
  "finishedAt": "2026-10-02T15:46:15.626214+00:00",
  "durationMs": 1629.036,
  "httpStatus": null,
  "officialUrl": null,
  "resultType": null,
  "rawResult": null,
  "capturedStdout": "",
  "capturedStderr": "\\rBaixando processos:   0%|          | 0/1 [00:00<?, ?it/s]Nenhum link encontrado para o processo 01961516420188260500.\\nErro ao baixar o processo 0196151-64.2018.8.26.0500: Nenhum link encontrado para o processo 01961516420188260500.\\n\\rBaixando processos: 100%|##########| 1/1 [00:01<00:00,  1.45s/it]\\rBaixando processos: 100%|##########| 1/1 [00:01<00:00,  1.45s/it]\\n\\rProcessando documentos: 0it [00:00, ?it/s]\\rProcessando documentos: 0it [00:00, ?it/s]\\n",
  "error": {
    "type": "IndexError",
    "message": "list index out of range",
    "traceback": "Traceback (most recent call last):\\n  File \"<string>\", line 14, in <module>\\n  File \"C:\\Users\\Junio Cavalcanti\\Desktop\\central precatorio\\.venv\\Lib\\site-packages\\juscraper\\courts\\tjsp\\client.py\", line 602, in cpopg\\n    result = self.cpopg_parse(self.download_path)\\n  File \"C:\\Users\\Junio Cavalcanti\\Desktop\\central precatorio\\.venv\\Lib\\site-packages\\juscraper\\courts\\tjsp\\client.py\", line 638, in cpopg_parse\\n    return cpopg_parse_manager(path)\\n  File \"C:\\Users\\Junio Cavalcanti\\Desktop\\central precatorio\\.venv\\Lib\\site-packages\\juscraper\\courts\\tjsp\\cpopg_parse.py\", line 77, in cpopg_parse_manager\\n    keys = result[0].keys()\\n           ~~~~~~^^^\\nIndexError: list index out of range\\n"
  }
}
```

### Resultado bruto/normalizado do registro inicial

O DEPRE permanece preservado no campo próprio. O retorno não identificou processo encontrado, processo originário, precatório ou dados processuais.

```json
{
  "provider": "JUSCRAPER",
  "underlyingSource": "TJSP",
  "status": "NOT_CONFIGURED",
  "requestAttempted": false,
  "httpStatus": null,
  "numeroProcessoDEPRE": "0196151-64.2018.8.26.0500",
  "numeroProcessoEncontrado": null,
  "numeroProcessoOriginario": null,
  "numeroPrecatorio": null,
  "officialUrl": null,
  "officialUrlStatus": "NOT_RETURNED",
  "normalized": {
    "processNumber": "0196151-64.2018.8.26.0500",
    "relatedProcessNumber": null,
    "className": null,
    "subject": null,
    "forum": null,
    "courtUnit": null,
    "parties": null,
    "movements": null,
    "identifiers": {
      "numeroProcessoDEPRE": "0196151-64.2018.8.26.0500",
      "numeroProcessoEncontrado": null,
      "numeroProcessoOriginario": null,
      "numeroPrecatorio": null
    },
    "officialUrl": null
  },
  "rawPayload": {
    "status": "NOT_CONFIGURED",
    "message": "Python runtime não encontrado; os comandos python3 --version e python --version falharam.",
    "runtimeDiagnostics": {
      "command": "python3 -c \"import juscraper as jus; scraper=jus.scraper('tjsp'); scraper.cpopg('0196151-64.2018.8.26.0500')\" (não executado: nenhum interpretador Python disponível)",
      "executable": null,
      "version": null,
      "error": "Python runtime não encontrado; os comandos python3 --version e python --version falharam.",
      "missingDependency": "Python runtime (juscraper não pôde ser verificado sem Python)",
      "stdout": "",
      "stderr": "Python n�o foi encontrado; executar sem argumentos para instalar do Microsoft Store ou desabilitar este atalho em Configura��es > Aplicativos > Configura��es avan�adas do aplicativo > Aliases de execu��o do aplicativo.\r\n\nPython n�o foi encontrado; executar sem argumentos para instalar do Microsoft Store ou desabilitar este atalho em Configura��es > Aplicativos > Configura��es avan�adas do aplicativo > Aliases de execu��o do aplicativo.\r\n"
    }
  },
  "error": {
    "code": "PYTHON_NOT_AVAILABLE",
    "message": "Python runtime não encontrado; os comandos python3 --version e python --version falharam."
  }
}
```

### Diagnóstico de runtime

- Comando de benchmark executado: `node --import tsx scripts/cp-judicial-sources-benchmark-003.mts`.
- Verificações de runtime executadas dentro da rodada: `python3 --version` e `python --version`.
- Executáveis resolvidos: `C:\Users\Junio Cavalcanti\AppData\Local\Microsoft\WindowsApps\python3.exe` e `C:\Users\Junio Cavalcanti\AppData\Local\Microsoft\WindowsApps\python.exe` (aliases da Microsoft Store, não interpretadores instalados).
- Versão: indisponível.
- Código de saída de ambas as verificações: `9009`.
- `stdout`: vazio nas duas verificações.
- `stderr` observado nas duas: `Python n�o foi encontrado; executar sem argumentos para instalar do Microsoft Store ou desabilitar este atalho em Configura��es > Aplicativos > Configura��es avan�adas do aplicativo > Aliases de execu��o do aplicativo.`
- Dependência ausente confirmada: runtime Python. A presença/ausência do pacote `juscraper` não pôde ser verificada sem interpretador.
- O comando `cpopg` indicado acima não foi executado; não houve alternativa de método, retry ou consulta manual ao TJSP.
- Limitação: não há dados brutos do TJSP além do diagnóstico local. A integração não pode produzir sucesso nem URL oficial neste ambiente até existir Python com JusScraper instalado.

## FAN-OUT REAL

Janela total: `2026-10-02T15:33:57.354Z` a `2026-10-02T15:33:57.711Z`; duração `356.764 ms`; cinco rotas.

| Rota | Início | Fim | Duração | Status | HTTP | Resultado |
|---|---|---|---:|---|---:|---|
| TJSP_DIRECT | 2026-10-02T15:33:57.355Z | 2026-10-02T15:33:57.711Z | 356.255 ms | `NOT_CONFIGURED` | — | `cpopg` não executado; runtime Python ausente; `requestAttempted=false`. |
| DATAJUD_TJSP | 2026-10-02T15:33:57.402Z | 2026-10-02T15:33:57.475Z | 73.532 ms | `RESEARCH_AUTHORIZATION_REQUIRED` | — | Autorização de pesquisa não habilitada; nenhuma requisição enviada. |
| DJEN / ComunicaCNJ | 2026-10-02T15:33:57.403Z | 2026-10-02T15:33:57.621Z | 218.342 ms | `NO_RESULT` | 200 | Zero comunicações; resposta oficial CNJ recebida. |
| TJSP_ESAJ | 2026-10-02T15:33:57.475Z | 2026-10-02T15:33:57.475Z | 0.451 ms | `MANUAL_REQUIRED` | — | Automação não habilitada; nenhuma requisição enviada. |
| TJSP_DEPRE_CAC | 2026-10-02T15:33:57.475Z | 2026-10-02T15:33:57.475Z | 0.211 ms | `CAPTCHA_REQUIRED` | — | Pesquisa assistida requerida; nenhum CAPTCHA ou pedido executado. |

O resultado de uma rota não cancelou as demais. As rotas que não tinham autorização/configuração ou exigiam pesquisa assistida foram invocadas e registradas, mas não enviaram requisições externas.

## Evidência e URLs

- Evidência oficial encontrada: resposta DJEN/ComunicaCNJ `HTTP 200`, `NO_RESULT`, `resultCount=0`, consultada às `2026-10-02T15:33:57.403Z`.
- Endpoint retornado pelo adapter CNJ: https://hcomunicaapi.cnj.jus.br/api/v1/comunicacao?numeroProcesso=01961516420188260500&pagina=1&itensPorPagina=100
- URL oficial TJSP retornada: nenhuma. Para TJSP_DIRECT, `officialUrl=null`.
- A URL do endpoint DJEN é evidência da consulta CNJ, não evidência de consulta direta ao TJSP.
- Resposta bruta DJEN: `status=NO_RESULT`, `httpStatus=200`, `resultCount=0`, `communications=[]`, `originalIdentifier=0196151-64.2018.8.26.0500`.

## Verificações executadas

- `npx vitest run src/lib/tjsp-juscraper-adapter.test.ts`: 1 arquivo passou, 10 testes passaram.
- Benchmark controlado: `node --import tsx scripts/cp-judicial-sources-benchmark-003.mts`; cinco rotas invocadas, sem retry.

## Investigação local do JusScraper 0.4.0 — `cpopg` HTML/API

Investigação somente dos arquivos instalados em `.venv/Lib/site-packages/juscraper`; nenhuma conexão foi feita e nenhum método `cpopg`/`cposg` foi executado nesta investigação.

### Factory e dispatch

- `juscraper.scraper("tjsp")` mapeia a sigla para `juscraper.courts.tjsp.client:TJSPScraper` e instancia essa classe (`juscraper/__init__.py:21,52`).
- `TJSPScraper` define `cpopg(id_cnj, method="html")`. `set_method` aceita somente `"html"` ou `"api"`; `cpopg_download` despacha para um helper diferente conforme o valor (`courts/tjsp/client.py:135,598,612-627`).
- Após o download, `cpopg` chama o parser e só remove o diretório temporário se o parser retornar (`courts/tjsp/client.py:601-603`).

### Caminho `method="html"`

- Base configurada: `https://esaj.tjsp.jus.br/` (`courts/tjsp/client.py:76`).
- Endpoint montado: `https://esaj.tjsp.jus.br/cpopg/search.do` (`courts/tjsp/cpopg_download.py:85`). O CNJ é limpo/formatado e enviado em parâmetros de busca `NUMPROC`; o código não contém uma URL de resultado fixa.
- Após `session.get`, `get_cpopg_download_links` procura os links na resposta. Se a lista vier vazia, o código registra `Nenhum link encontrado para o processo ...` e lança `RuntimeError` (`courts/tjsp/cpopg_download.py:112-115`). O handler por processo captura esse erro e continua; ele não é convertido em uma resposta normal vazia.
- Como nenhum arquivo de processo fica disponível para o parser, `result` permanece vazio. `cpopg_parse_manager` mesmo assim acessa `result[0].keys()` (`courts/tjsp/cpopg_parse.py:77`), causando o `IndexError: list index out of range` observado.

### Caminho `method="api"`

- `TJSPScraper.api_base` é `https://api.tjsp.jus.br/` (`courts/tjsp/client.py:107`); trata-se de um host sob o domínio TJSP, diferente do eSAJ HTML.
- O código constrói um GET para `https://api.tjsp.jus.br/processo/cpopg/search/numproc/{CNJ_sem_máscara}` (`courts/tjsp/cpopg_download.py:189,196`). Se houver processos na resposta, segue com POST para `/processo/cpopg/dadosbasicos/{cdProcesso}` e GETs para `/processo/cpopg/partes/{cdProcesso}`, `/movimentacao/{cdProcesso}`, `/incidente/{cdProcesso}` e `/audiencia/{cdProcesso}` (`courts/tjsp/cpopg_download.py:211-227`). Esses caminhos são os templates encontrados no código instalado; nenhum foi requisitado ou confirmado nesta investigação.
- A opção API é implementada para JSON pelo pacote, mas o README empacotado não documenta o parâmetro `method="api"` nem esses endpoints. O `METADATA` aponta a documentação oficial geral em https://jtrecenti.github.io/juscraper/; para esta opção específica, a referência local encontrada é a implementação/docstring instalada em `courts/tjsp/cpopg_download.py:149-190`.

### Sessão e pré-requisitos

- O cliente herda uma `requests.Session` criada por `HTTPScraper`; o setup local configura User-Agent e o hook padrão `_configure_session` é vazio (`core/http.py:93-103`).
- Os helpers API recebem essa sessão; suas docstrings a descrevem como `requests.Session authenticated` (`courts/tjsp/cpopg_download.py:149-158,185`). Porém, neste fluxo o pacote não configura `Authorization`, API key, login nem cookie prévio. A sessão pode manter cookies recebidos normalmente durante a sequência de respostas, mas não há carregamento explícito de cookies no caminho `cpopg`.
- Portanto, pré-requisito demonstrado pelo código: JusScraper instalado, scraper TJSP criado, e sessão HTTP do cliente; selecionar `method="api"` aciona o fluxo JSON. O código local não esclarece se o servidor aceita a sessão anônima padrão ou exige autenticação/cookie, nem demonstra que o endpoint seja uma API pública documentada. Isso só poderia ser determinado por documentação específica adicional ou teste externo autorizado.

### Avaliação para próximo teste

`method="api"` é uma opção tecnicamente legítima para um próximo teste controlado: é um branch suportado do `cpopg` que aponta para `api.tjsp.jus.br` e não envolve outro tribunal ou provedor. Não é possível afirmar, somente pela instalação local, que o endpoint seja público/estável ou que dispense autenticação. Não executar nesta etapa; eventual tentativa requer autorização separada e deve tratar a possível sequência de chamadas HTTP do helper como parte de uma única execução `cpopg`.

## Execução real única — `cpopg(method="api")`

- Python: exclusivamente `.venv/Scripts/python.exe`, via `CP_JUSCRAPER_PYTHON`.
- Chamada: uma invocação de `scraper.cpopg("0196151-64.2018.8.26.0500", method="api")`; nenhum `html`, `cposg` ou outro provider foi executado.
- Início: `2026-10-02T15:55:01.768987+00:00`; fim: `2026-10-02T15:55:02.463088+00:00`; duração: `694.088 ms`.
- Uma requisição HTTP observada: `GET https://api.tjsp.jus.br/processo/cpopg/search/numproc/01961516420188260500`.
- HTTP: `200 OK`; headers não sensíveis: `Content-Type: application/json; charset=utf-8`, `Server: Kestrel`, `Date: Fri, 02 Oct 2026 15:55:02 GMT`.
- Corpo bruto: `[]`; quantidade de registros na resposta de busca: `0`.
- Classificação: `EMPTY_RESPONSE`, não `NO_RESULT` nem inexistência do processo. O servidor respondeu HTTP 200 com array vazio.
- Autenticação: nenhuma indicação explícita de autenticação requerida. Não foram configurados auth, Authorization header ou cookies; a sessão tinha zero cookies antes da chamada. Isso não prova que o endpoint seja publicamente documentado ou estável.
- Retries HTTP: `0`; redirects automáticos desabilitados para não seguir resposta a outro destino.
- O stderr informou `Nenhum dado encontrado para o processo 01961516420188260500.`. Não houve erro de rede nem traceback do pacote.
- O parser nativo foi interceptado somente na instância, em memória, após capturar a resposta HTTP. `cpopgReturnType=dict` é o objeto do capturador, não o DataFrame normal do JusScraper; o parser não foi executado e não houve `IndexError`.
- `numeroProcessoDEPRE` permanece `0196151-64.2018.8.26.0500`; nenhum processo encontrado/originário ou número de precatório foi retornado. Nenhuma URL de processo foi retornada além do endpoint requisitado.
- Não houve chamadas POST/GET adicionais, pois a resposta inicial foi vazia. Nenhum banco, operação, evidência ou estado de IA foi alterado.

Registro HTTP bruto:

```json
{
  "method": "GET",
  "requestedUrl": "https://api.tjsp.jus.br/processo/cpopg/search/numproc/01961516420188260500",
  "responseUrl": "https://api.tjsp.jus.br/processo/cpopg/search/numproc/01961516420188260500",
  "status": 200,
  "reason": "OK",
  "headers": {
    "Content-Type": "application/json; charset=utf-8",
    "Server": "Kestrel",
    "Date": "Fri, 02 Oct 2026 15:55:02 GMT"
  },
  "bodyText": "[]",
  "jsonBody": [],
  "responseHistoryCount": 0
}
```

## Taxonomia para cobertura de pesquisa

Manter separados falha de transporte, falha HTTP, resultado da aplicação e necessidade de acesso assistido. Um resultado indisponível não é uma consulta conclusiva sem achados.

```text
TRANSPORT_FAILURE
└─ SOURCE_UNAVAILABLE

HTTP_FAILURE
├─ TIMEOUT
├─ 401/403
├─ 404
└─ 5xx

APPLICATION_RESULT
├─ SUCCESS
├─ EMPTY_RESPONSE
└─ NO_RESULT

ACCESS_ASSISTED
├─ MANUAL_REQUIRED
└─ CAPTCHA_REQUIRED
```

- O MCP-Brasil/Querido Diário deste benchmark é `TRANSPORT_FAILURE → SOURCE_UNAVAILABLE`; o texto de fallback “nenhum diário” não deve ser contabilizado como `NO_RESULT`.
- O timeout do DataJud é inconclusivo; não prova indisponibilidade definitiva do DataJud nem ausência do DEPRE.
- Os vazios TJSP/JusScraper e `NO_RESULT` do DJEN são somente estados de suas consultas/fontes. Não reduzem disponibilidade e não criam `NOT_FOUND_GLOBAL`.
- Cobertura atual do piloto: `INSUFFICIENT_COVERAGE`. Documentação/evidência oficial e disponibilidade do inventário permanecem dimensões distintas.

## Encerramento do Benchmark 003

Benchmark encerrado para o DEPRE piloto `0196151-64.2018.8.26.0500`. Não serão feitas novas tentativas neste ciclo. As respostas documentadas não autorizam “DEPRE não localizado”; nenhum `NOT_FOUND_GLOBAL` foi criado e nenhuma operação, evidência existente, disponibilidade, workflow ou registro dos 73 DEPREs foi alterado.

## Catálogo real de adapters e fontes

Classificação do código disponível no workspace e das execuções registradas neste benchmark. Uma rota, nome no catálogo ou diagnóstico de página, isoladamente, não é evidência de aquisição operacional.

| Classificação | Adapter/fonte | Situação real |
|---|---|---|
| `IMPLEMENTADO_E_EXECUTÁVEL` | DJEN / ComunicaCNJ (`djenAdapter`) | Requisição real executada para o piloto; HTTP 200, `NO_RESULT`. Resultado limitado à consulta/comunicações dessa fonte. |
| `IMPLEMENTADO_E_EXECUTÁVEL` | TJSP/JusScraper (`cpopg` HTML/API e `cposg` API) | Métodos funcionais e executados. As três rotas são um provedor TJSP/JusScraper, não fontes independentes. `cpopg` HTML terminou em erro do parser; as rotas API retornaram HTTP 200 com `[]`. |
| `IMPLEMENTADO_MAS_NÃO_CONFIGURADO` | DataJud TJSP (`DataJudTJSPAdapter`) | Adapter funcional e consulta real tentada, mas configuração persistente de autorização/chave ausente. O benchmark habilitou RESEARCH e obteve chave pública somente em memória; POST ao endpoint oficial terminou em `TIMEOUT`. |
| `IMPLEMENTADO_MAS_NÃO_CONFIGURADO` | e-SAJ automático | O adapter deliberadamente responde `MANUAL_REQUIRED`, sem pedido automatizado. O monitor identifica uma consulta por entidade, mas marca `QUERY_ADAPTER_NOT_IMPLEMENTED`; requer implementação/configuração antes de aquisição automática. |
| `SOMENTE_DIAGNÓSTICO` | TJSP/CAC | O coletor registra requisito de fluxo assistido/CAPTCHA; nenhuma consulta automática é feita. |
| `SOMENTE_DIAGNÓSTICO` | Monitor de fontes TJSP (`source-monitor`) | Lê catálogo oficial, saúde HTTP, robots, links e sinais de formulário/download. Não baixa, interpreta nem associa registros ao DEPRE; `leadsDiscovered=0`. |
| `SOMENTE_DIAGNÓSTICO` | TJSP · Lista Geral e Comunicados municipais (`tjsp-general`, `tjsp-notices`) | Catálogos e arquivos históricos conhecidos, não um adapter de saldo/registro atual. Exigem parser/adaptação de aquisição antes de servirem como evidência atual do piloto. |
| `SOMENTE_DIAGNÓSTICO` | Índices TJSP Pendentes/Credores e cadastro de devedores | Páginas de navegação ou referência; não contêm, por si, registro individual de credor do piloto. |
| `CANDIDATO_NÃO_IMPLEMENTADO` | JusScraper-MCP, mcp-brasil, ComunicaCNJ-MCP | Nenhuma integração/adaptador correspondente encontrada no código do workspace. ComunicaCNJ já é consultado via `djenAdapter`; a alternativa MCP não é integração ativa. |
| `CANDIDATO_NÃO_IMPLEMENTADO` | Aquisição de dados municipais atuais / Câmara de Conciliação | Nenhum adapter de busca por DEPRE ou extração de documentos atuais identificado. Catálogo de PDFs históricos não equivale a aquisição. |
| `CANDIDATO_NÃO_IMPLEMENTADO` | TJSP/DEPRE · Comunicados (`tjsp-depre-notices`) como dataset pesquisável | O monitor tem a URL inicial e retorna `NOT_DISCOVERED`; destino/estrutura de dados não foram confirmados. |

### Invariantes aplicadas à leitura do catálogo

- **Provedor ≠ rota:** `cpopg` e `cposg` são agrupados como um único provedor TJSP/JusScraper.
- **Cobertura ≠ documentação:** status de fonte, inclusive vazio/timeout, não entra em `countVerifiedOfficialEvidence`. `DOCUMENTAÇÃO 2/2` conta documentos fortes `VERIFIED`, dos tipos requisitórios permitidos, com identidade documental; não conta chamadas nem respostas vazias.
- **Disponibilidade ≠ localização documental:** disponibilidade é estado do inventário/workflow e não é alterada pelos adapters de consulta. O resultado de cobertura deste piloto permanece `INSUFFICIENT_COVERAGE`; `NOT_FOUND_GLOBAL` não está implementado.

### Próximo candidato complementar

O caminho local mais concreto ainda não testado para informação complementar é o catálogo oficial **TJSP · Comunicados de precatórios** (`tjsp-notices`), já acessível pelo monitor como `PUBLIC_HTML_CATALOG` e limitado a material histórico. Um próximo benchmark nele deve ser classificado como diagnóstico de descoberta de links/documentos, não como busca processual nem confirmação do DEPRE. Não executei esse benchmark nesta etapa. JusScraper-MCP e mcp-brasil permanecem candidatos sem integração local.

## MCP-Brasil — busca complementar em diário municipal

- Provider: `MCP-Brasil` (`mcp-brasil==0.14.0`), iniciado localmente em venv temporário fora do workspace; nenhum cliente/configuração foi adicionado ao CP.
- Tool MCP chamada uma vez: `diario_oficial_buscar_diarios`.
- Fonte consultada: Querido Diário, índice de diários oficiais municipais. O publisher municipal específico só poderia ser determinado por um registro retornado.
- Argumentos: `texto="0196151-64.2018.8.26.0500"`, `busca_exata=true`, `pagina=0`, `ordenar_por="relevance"`; sem território, sem fallback para DOU/DataJud e sem outra tool.
- Política HTTP: `MCP_BRASIL_HTTP_MAX_RETRIES=0`, timeout 8 s, PII override desativado, sem credencial ou chave DataJud.
- Uma tentativa upstream: `GET https://api.queridodiario.ok.org.br/gazettes`. A tentativa falhou durante o handshake TLS (`httpx.ConnectError: [SSL: SSLV3_ALERT_HANDSHAKE_FAILURE] sslv3 alert handshake failure (_ssl.c:1032)`) em `61.701 ms`; HTTP status e headers não disponíveis. O cliente registrou `Request to https://api.queridodiario.ok.org.br/gazettes failed after 1 attempts`.
- Início da chamada MCP: `2026-10-02T16:25:26.550173+00:00`; fim: `2026-10-02T16:25:28.506456+00:00`; duração total: `1956.265 ms`.
- Classificação correta: `SOURCE_UNAVAILABLE`; quantidade de diários **não observada**. Não classificar como `NO_RESULT`.
- O MCP retornou o texto `Nenhum diário oficial encontrado para '0196151-64.2018.8.26.0500'.`, mas a implementação captura `HttpClientError` e converte o erro em lista vazia. Esse texto é fallback do wrapper, não evidência de ausência no Querido Diário.
- Nenhum publisher, documento individualizável, URL oficial ou evidência foi retornado. O provider é MCP-Brasil; a source planejada é Querido Diário, sem registro upstream verificável.
- Nenhum processo TJSP/DataJud/DJEN foi consultado nesta chamada. Nenhum banco, operação, documento/evidência ou registro dos 73 DEPREs foi alterado.

Resumo da captura:

```json
{
  "method": "scraper.cpopg(\"0196151-64.2018.8.26.0500\", method=\"api\")",
  "status": "EMPTY_RESPONSE",
  "requestAttempted": true,
  "durationMs": 694.088,
  "retryPolicy": {
    "httpAdapterMaxRetries": 0,
    "automaticRedirects": false
  },
  "credentialStateBeforeCall": {
    "sessionAuthConfigured": false,
    "cookieCountBeforeCall": 0,
    "authorizationHeaderPresent": false,
    "cookieHeaderPresent": false
  },
  "primaryEndpointResponseRecordCount": 0,
  "requestErrors": [],
  "callError": null,
  "parserCapture": {
    "called": true,
    "parserInvoked": false
  }
}
```

## DataJud TJSP — consulta real controlada

- DEPRE consultado: `0196151-64.2018.8.26.0500`; identificador mantido, sem alteração de operação.
- Autorização de pesquisa habilitada somente como opção em memória para esta execução. As variáveis de ambiente permaneceram inalteradas; nenhuma chave foi impressa ou persistida.
- Chave pública: obtida por um GET à documentação oficial CNJ `https://datajud-wiki.cnj.jus.br/api-publica/acesso/` (HTTP 200; 291.627 ms). `credentialSource=CNJ_PUBLICATION_RESEARCH_FALLBACK`.
- Uma única tentativa de consulta DataJud TJSP: POST para `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`; `requestAttempted=true`, contador de chamadas DataJud `1`, sem retry.
- Início do fluxo: `2026-10-02T15:59:09.413Z`; fim: `2026-10-02T15:59:17.747Z`; duração total: `8330.118 ms`. Duração reportada pelo adapter para a consulta: `8023 ms`; o instante separado de início do POST não foi capturado pelo wrapper e não é inferido.
- Status: `TIMEOUT`; HTTP status `null`; erro: `This operation was aborted`. Nenhum corpo ou resultado foi recebido da API DataJud.
- A resposta da documentação CNJ para buscar a chave não é resultado processual. Não houve chamada a DJEN, e-SAJ, CAC, JusScraper, nem a outro endpoint DataJud.
- Resultado interpretativo: DataJud permanece inconclusivo para este DEPRE; timeout não é `NO_RESULT` nem `NOT_FOUND`.
- No worker de aquisição, `PROCESS_NOT_FOUND` permanece como resultado de uma fonte (`Processo não encontrado nesta fonte; outras fontes ainda podem ser consultadas`); não vira estado global `NOT_FOUND`. A elegibilidade é separada e exige pelo menos duas evidências oficiais (`minimumOfficialEvidence >= 2`).
- Limite da regra atual: esse mínimo de evidências não define uma política formal de cobertura para declarar ausência global. Um futuro `NOT_FOUND` global deve exigir conjunto mínimo de fontes oficiais aplicáveis consultadas e ausência de evidência contraditória. O `TIMEOUT` DataJud desta execução não satisfaz qualquer critério de ausência.
- Nenhuma operação, evidência, disponibilidade, workflow ou histórico de IA foi alterado.

Registro do resultado do adapter:

```json
{
  "source": "DATAJUD_TJSP",
  "status": "TIMEOUT",
  "requestAttempted": true,
  "credentialSource": "CNJ_PUBLICATION_RESEARCH_FALLBACK",
  "httpStatus": null,
  "durationMs": 8023,
  "endpoint": "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search",
  "query": {
    "processNumber": "0196151-64.2018.8.26.0500"
  },
  "error": {
    "code": "TIMEOUT",
    "message": "This operation was aborted"
  }
}
```

## JusScraper TJSP — rota adicional `cposg(method="api")`

- Chamada única pelo `.venv`: `scraper.cposg("0196151-64.2018.8.26.0500", method="api")`.
- `cposg` é o caminho de processos de 2º grau; o registro é apenas resultado dessa rota TJSP. Não implica que o DEPRE seja processo originário ou de 2º grau.
- Início: `2026-10-02T16:02:33.506315+00:00`; fim: `2026-10-02T16:02:34.712465+00:00`; duração: `1206.133 ms`.
- Uma requisição observada, sem retry ou redirect: `GET https://api.tjsp.jus.br/processo/cposg/search/numproc/01961516420188260500`.
- HTTP: `200 OK`; headers não sensíveis: `Content-Type: application/json; charset=utf-8`, `Server: Kestrel`, `Date: Fri, 02 Oct 2026 16:02:34 GMT`.
- Corpo bruto: `[]`; registros: `0`; classificação: `EMPTY_RESPONSE`, não `NOT_FOUND`.
- Nenhuma credencial ou cookie configurado/encaminhado. Parser nativo interceptado em memória após captura; nenhuma evidência ou operação foi alterada.

## Cobertura atual do DEPRE

`coverageStatus = INSUFFICIENT_COVERAGE` para qualquer conclusão global de não localização.

| Rota/fonte | Resultado atual | Interpretação |
|---|---|---|
| TJSP/JusScraper `cpopg` HTML | `ERROR` (`IndexError` depois de “Nenhum link encontrado”) | Falha do scraper/parser; inconclusivo. |
| TJSP/JusScraper `cpopg` API | `EMPTY_RESPONSE` (HTTP 200, `[]`) | Resposta vazia somente nessa rota. |
| TJSP/JusScraper `cposg` API | `EMPTY_RESPONSE` (HTTP 200, `[]`) | Rota de 2º grau do mesmo TJSP; não é fonte independente. |
| DJEN/ComunicaCNJ | `NO_RESULT` (HTTP 200, consulta anterior) | Ausência de comunicação nessa consulta. |
| DataJud TJSP | `TIMEOUT`, sem HTTP status | Consulta inconclusiva; não significa que DataJud não funciona nem que o processo não existe. |
| MCP-Brasil / Querido Diário | `SOURCE_UNAVAILABLE` (`ConnectError`, handshake TLS) | Uma tentativa GET, sem HTTP status; a mensagem vazia do MCP foi fallback após erro, não resultado de busca. |
| TJSP e-SAJ | `MANUAL_REQUIRED` | Consulta automática não realizada. |
| TJSP DEPRE CAC | `CAPTCHA_REQUIRED` / assistida | Consulta automática não realizada. |

Nenhuma fonte isolada com zero resultados estabelece `NOT_FOUND_GLOBAL`. A política atual mantém resultados por fonte e exige evidências oficiais para elegibilidade; ainda falta definir uma política formal de cobertura mínima, incluindo fontes críticas bloqueadas, contradições e cobertura por tipo de caso. JusScraper-MCP e outros candidatos municipais não foram consultados nesta rodada.

Registro HTTP bruto do `cposg`:

```json
{
  "method": "GET",
  "requestedUrl": "https://api.tjsp.jus.br/processo/cposg/search/numproc/01961516420188260500",
  "responseUrl": "https://api.tjsp.jus.br/processo/cposg/search/numproc/01961516420188260500",
  "status": 200,
  "reason": "OK",
  "headers": {
    "Content-Type": "application/json; charset=utf-8",
    "Server": "Kestrel",
    "Date": "Fri, 02 Oct 2026 16:02:34 GMT"
  },
  "bodyText": "[]",
  "jsonBody": [],
  "responseHistoryCount": 0
}
```