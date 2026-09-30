# CP 2.4.5 - Benchmark controlado de provider AI

## Escopo

Esta preparação não troca o provider de produção: `CP_AI_PROVIDER` continua com default `ollama`. O benchmark externo não é executado automaticamente. A execução persistida continua usando o snapshot, as referências de evidência/documento, o prompt `reconfirmation-v1`, o schema Zod, a validação semântica, a persistência e a auditoria existentes.

O dry-run usa somente o segundo attempt histórico `f6302d0d-d0d6-40a9-b95e-f018ce2b5d8f`, confirma o DEPRE `0038850-88.2017.8.26.0500` e lê operação/documentos com consultas `SELECT`. Não cria attempt, não grava resultados e não envia requisição HTTP.

## Providers preparados

| Provider | Modelo padrão | Structured output | Timeout | Retries |
| --- | --- | --- | ---: | ---: |
| Ollama | `qwen3:4b` | JSON mode local + validação Zod | 120 s | 0 na reconfirmação |
| OpenAI | `gpt-5-nano` | JSON Schema estrito + validação Zod | 120 s | 0 |
| DeepSeek | `deepseek-flash` | JSON mode + validação Zod local | 120 s | 0 |

Os adapters externos usam Chat Completions. GPT-5 nano recebe uma projeção estrita do schema para o subconjunto JSON Schema suportado; a validação Zod completa continua no servidor. DeepSeek não recebe JSON Schema nesta integração: recebe o mesmo prompt e as instruções de JSON, e sua saída é validada contra o mesmo schema local. Os campos e regras de negócio são iguais; somente a capacidade de imposição estrutural durante a geração difere. Não há fallback automático entre providers.

## Configuração segura

As chaves são lidas em runtime e nunca fazem parte do payload ou dos logs:

- OpenAI: `CP_AI_OPENAI_API_KEY` ou `OPENAI_API_KEY`.
- DeepSeek: `CP_AI_DEEPSEEK_API_KEY` ou `DEEPSEEK_API_KEY`.
- Seleção explícita para uma execução autorizada: `CP_AI_PROVIDER=openai` ou `CP_AI_PROVIDER=deepseek`.
- Modelos opcionais: `CP_AI_OPENAI_MODEL` e `CP_AI_DEEPSEEK_MODEL`.
- Timeouts opcionais: `CP_AI_OPENAI_TIMEOUT_MS` e `CP_AI_DEEPSEEK_TIMEOUT_MS`.

Não definir um provider externo mantém Ollama como padrão. Não colocar chaves em código, argumentos de linha de comando, arquivos versionados ou relatórios.

## Dry-run

```powershell
npm run ai:reconfirmation:dry-run -- --provider=openai
npm run ai:reconfirmation:dry-run -- --provider=deepseek
```

O relatório inclui o attempt/DEPRE, tamanho em bytes do prompt, contexto e schema, estimativa aproximada de tokens, modo de structured output, timeout, retries, tamanho/hash SHA-256 do corpo da requisição e teto estimado de custo. A estimativa usa bytes UTF-8 / 4 como aproximação de tokens e assume o limite de até 4.096 tokens de saída; uso e custo reais dependem dos tokens informados pelo provider e das tarifas vigentes. `--show-payload` imprime o corpo em memória, portanto deve ser usado apenas localmente e com cuidado com dados pessoais.

## Referências de preço consultadas em 2026-10-02

- GPT-5 nano: US$ 0,05 / 1M tokens de entrada e US$ 0,40 / 1M tokens de saída. Fonte: https://developers.openai.com/api/docs/pricing
- DeepSeek Flash: fora do pico US$ 0,15 / 1M tokens de entrada não cacheados e US$ 0,60 / 1M tokens de saída; no pico US$ 0,30 e US$ 1,20, respectivamente. Fonte: https://api-docs.deepseek.com/quick_start/pricing

Com a estimativa atual de entrada do dry-run e o teto de 4.096 tokens de saída, a execução custa no máximo aproximadamente US$ 0,00175 no GPT-5 nano. No DeepSeek Flash, a estimativa é aproximadamente US$ 0,00272 fora do pico ou US$ 0,00544 no pico. Não inclui impostos, tarifas futuras, retries (desativados) nem diferenças de tokenização; custo final deve ser calculado com o uso real retornado pela API.

## Gate do benchmark real

O primeiro benchmark externo deve aguardar autorização explícita. Após autorização, executar somente o DEPRE piloto, com provider/model escolhidos, novo attempt auditável e o mesmo pacote histórico. Registrar duração, resultado, validade JSON, validade do schema, 12 field results, divergências, tokens/custo quando fornecidos e retries. Não processar os outros 72 casos, não alterar a operação original e não fazer pesquisa externa do DEPRE.