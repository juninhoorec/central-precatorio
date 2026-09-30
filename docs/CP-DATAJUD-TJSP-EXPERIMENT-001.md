# DataJud TJSP — Experimento 001

Data: 2026-10-02T14:51:11.360Z

## Objetivo

Descobrir se o identificador 0196151-64.2018.8.26.0500 é diretamente pesquisável no DataJud TJSP e registrar, sem persistência, os resultados das rotas oficiais aplicáveis em sequência.

## Configuração

- Ambiente: RESEARCH experimental.
- Endpoint DataJud: https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search.
- Credencial DataJud: AUSENTE; chave: NÃO EXPOSTA.
- Autorização explícita RESEARCH: AUSENTE.
- Consulta DataJud: numeroProcesso=0196151-64.2018.8.26.0500 (normalizado como 01961516420188260500).
- Validação do identificador CNJ: válido estruturalmente; isso não prova que o CNJ indexe o DEPRE.
- Persistência: nenhuma; nenhuma tabela ou operação foi escrita.

## Matriz de rotas aplicáveis

| Fonte | Resultado | Requisição enviada | HTTP | Total reportado | Observação |
|---|---|---:|---:|---:|---|
| DATAJUD_TJSP | RESEARCH_AUTHORIZATION_REQUIRED | não | — | — | Consulta DataJud bloqueada: defina autorização explícita de uso RESEARCH para este ambiente. |
| DJEN | NO_RESULT | sim | 200 | — | — |
| TJSP_ESAJ | MANUAL_REQUIRED | não | — | — | Consulta automatizada não habilitada; nenhuma requisição foi enviada. |
| TJSP_DEPRE_CAC | CAPTCHA_REQUIRED | não | — | — | A consulta CAC do TJSP requer pesquisa assistida; nenhuma requisição ou CAPTCHA foi executado. |

DataJud é a primeira rota. Zero resultados, configuração ausente ou falha não interrompem o coletor: ele registra a tentativa e continua para a rota seguinte aplicável. e-SAJ/CAC são estados assistidos e não executam automação nem CAPTCHA.

## Resultado DataJud

- Status: RESEARCH_AUTHORIZATION_REQUIRED
- HTTP: —
- Duração: 0 ms
- Requisição DataJud enviada: não
- Total de hits: —
- Hits DataJud: 0
- Correspondências exatas após normalização do numeroProcesso: 0
- Status DataJud do coletor: RESEARCH_NOT_ENABLED

### Campos normalizados observados

```json
null
```

### Payload bruto recebido

O payload é mantido no resultado do adapter em memória e incluído aqui com CPF/CNPJ e qualquer cópia da chave redigidos. Campos não retornados permanecem null; nenhum significado é inferido para dscSistema.

```json
null
```

## Identificação do processo

- A API foi consultada diretamente pelo numeroProcesso normalizado somente se requestAttempted=true.
- DEPRE correspondente diretamente retornado: NÃO TESTADO — DataJud não foi consultado.
- Outros números retornados: nenhum.
- Processos originários: o adapter não infere processo originário; nenhum campo dedicado é normalizado nesta fase.

## Movimentações e metadados

Movimentações, órgão julgador, classe, assuntos, prioridade, formato/sistema e polos são preservados sem interpretação em normalized.processes[].movements e campos relacionados somente quando presentes no payload. dscSistema é registrado literalmente se existir; não há tradução de códigos.

## Fallbacks

- DJEN: NO_RESULT; requestAttempted=true; HTTP=200; resultado(s)=0.
- e-SAJ: MANUAL_REQUIRED; nenhuma requisição automatizada se MANUAL_REQUIRED.
- TJSP/DEPRE CAC: CAPTCHA_REQUIRED; rota CAPTCHA/assistida, sem automação.
- DJe, Campinas DO, Guarulhos DO, São Paulo DO/PGM/PGE, PJe, PROJUDI e eproc: não implementados neste experimento.

### Payload das rotas de fallback

```json
{
  "DJEN": {
    "sourceId": "djen",
    "sourceName": "DJEN",
    "sourceType": "PUBLIC_API",
    "jurisdiction": "BRAZIL",
    "access": "PUBLIC",
    "sourceUrl": "https://hcomunicaapi.cnj.jus.br/api/v1/comunicacao?numeroProcesso=01961516420188260500&pagina=1&itensPorPagina=100",
    "originalIdentifier": "0196151-64.2018.8.26.0500",
    "queryId": "01961516420188260500",
    "queriedAt": "2026-10-02T14:51:03.407Z",
    "resultCount": 0,
    "httpStatus": 200,
    "latencyMs": 7950,
    "requestAttempted": true,
    "rateLimitLimit": 20,
    "rateLimitRemaining": 19,
    "communications": [],
    "status": "NO_RESULT",
    "failureReason": ""
  },
  "ESAJ": {
    "sourceId": "tjsp-esaj",
    "status": "MANUAL_REQUIRED",
    "sourceUrl": "https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do",
    "originalIdentifier": "0196151-64.2018.8.26.0500",
    "queryId": "01961516420188260500",
    "resultCount": 0,
    "httpStatus": null,
    "latencyMs": 0,
    "requestAttempted": false,
    "parties": [],
    "failureReason": "Consulta automatizada não habilitada; nenhuma requisição foi enviada."
  },
  "TJSP_DEPRE_CAC": null
}
```

## Utilidade para CP

- CONFIRMADO: somente o que consta nos campos de retorno e nos hits do endpoint.
- NÃO CONFIRMADO: associação sem hit exato do DEPRE; semelhança de nomes; interpretação de dscSistema; processo originário não explicitamente retornado; precisão/atualidade além do payload.
- Nenhum resultado foi transformado em official_evidence_documents, creditor resolution ou atualização operacional.

## Segurança e escopo

- Consultas limitadas ao DEPRE piloto 0196151-64.2018.8.26.0500.
- O coletor é sequencial; não há retries automáticos nem persistência.
- O valor da credencial não é incluído no relatório; CPF/CNPJ são redigidos.
- Requests DataJud e de fallback são indicados individualmente acima; rotas manuais não enviam request.

## Próximo experimento

Configurar CP_DATAJUD_API_KEY e CP_DATAJUD_RESEARCH_AUTHORIZED no ambiente de teste aprovado. DataJud não foi consultado neste experimento por falta de pré-requisito; não repetir chamadas a outras fontes sem justificativa/limite explícitos.

Tempo total do experimento/coleta de rotas: 7955 ms.
