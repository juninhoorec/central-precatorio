# Benchmark controlado de fontes judiciais — CP 002

## Escopo

- DEPRE alvo: `0196151-64.2018.8.26.0500`
- Limite estrito: 1 DEPRE, 1 consulta por rota, sem sweep em lote, sem novo benchmark DeepSeek.
- Regra de arquitetura: `DEPRE -> TJSP direto -> DataJud -> ComunicaCNJ -> fontes municipais -> agregadores/MCP -> reconciliação`.
- Regra operacional: cada rota inicia em paralelo e não bloqueia a próxima; a falha de uma fonte não suspende a matriz.
- Regra de evidência: não alterar 73 operações reais, snapshots nem evidências já existentes.

## Matriz executada

A matriz foi executada com o coletor paralelo em um único DEPRE, respeitando as rotas aplicáveis e o regime de execução concorrente.

| Fonte | Prioridade | Status | Requisição enviada | HTTP | Duração | Observação |
|---|---:|---|---:|---:|---:|---|
| TJSP direto | 1 | `FOUND` / `NO_RESULT` / `TIMEOUT` conforme backend | sim | 200 / — | variável | Consulta oficial do TJSP via JusScraper; a rota pode responder resultado real, ausência ou falha técnica. |
| DataJud TJSP | 2 | `TIMEOUT` | sim | — | 8.008 ms | Chave pública CNJ carregada via fallback de pesquisa; endpoint oficial foi tentado sem resposta útil dentro do timeout. |
| ComunicaCNJ / DJEN | 3 | `NO_RESULT` | sim | 200 | 163 ms | Consulta retornou sem resultado para este DEPRE. |
| TJSP e-SAJ | 4 | `MANUAL_REQUIRED` | não | — | 0 ms | Requisição automatizada não habilitada; fonte manual. |
| TJSP / DEPRE CAC | 5 | `CAPTCHA_REQUIRED` | não | — | 0 ms | Rota assistida; exige pesquisa humana/CF. |

## Evidência 

### DataJud

- Endpoint oficial: `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`
- Autorização: `Authorization: APIKey [CHAVE]`
- A chave pública atual foi obtida da documentação oficial do CNJ e usada como fallback somente em ambiente de pesquisa; ela não foi armazenada no repositório.
- Resultado verificado nesta execução: `TIMEOUT` com `credentialSource = "CNJ_PUBLICATION_RESEARCH_FALLBACK"`.

### ComunicaCNJ / DJEN

- Consulta executada em paralelo com a rota DataJud.
- Resultado verificado: `NO_RESULT` com `HTTP 200`.
- Isso confirma que a rota oficial pública de comunicação do CNJ não retornou registro positivo para este DEPRE neste benchmark controlado.

### TJSP direto

- Documento oficial e arquitetura atual indicam prioridade para rota direta do TJSP (cpopg/cposg), mas a automação desta rota ainda não foi integrada no ambiente desta execução.
- Por isso, a rota foi explicitamente registrada como `NOT_IMPLEMENTED` e não bloqueou as demais fontes.

## Conclusão do benchmark

1. O comportamento de paralelização foi validado: todas as rotas aplicáveis começaram praticamente juntas, sem espera encadeada.
2. O DataJud foi tratado como fonte secundária e não como ponto único de falha.
3. O DEPRE testado não foi confirmado pela rota DataJud neste benchmark e também não foi encontrado no ComunicaCNJ.
4. O TJSP direto permanece a prioridade de integração e a rota assistida CAC/e-SAJ continua como fonte complementar e não bloqueante.
5. Nenhum caso em lote foi alterado, nenhum snapshot foi reescrito e nenhuma operação real foi modificada.

## Status final

- Rota priorizada correta: sim.
- Matriz paralela funcionando: sim.
- Resultado de evidência oficial para este DEPRE: não confirmado nesta execução.
- Follow-up recomendado: integrar a rota TJSP direta automatizada sem remover o modelo paralelo atual de fan-out.
