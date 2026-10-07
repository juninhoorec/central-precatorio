# RELATÓRIO DE PIPELINE OFICIAL DE ENRIQUECIMENTO E AUDITORIA DE FONTES (FASE 5)

**Sistema:** CP (Central de Precatórios) — Produção / Auditabilidade Financeira e Jurídica  
**Organização Canônica (Tenant Operacional):** `CP 2.1 Demonstração` (`nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u`)  
**Data da Execução:** 05/10/2026  
**Status do Pipeline:** FASE 5 CONCLUÍDA E RECONCILIADA INTEGRALMENTE  

---

## 1. EXECUTIVE SUMMARY

Nesta **Fase 5**, o sistema evoluiu a arquitetura de enriquecimento e qualificação técnica para um pipeline determinístico, auditável e operacionalmente útil de **ENRIQUECIMENTO OFICIAL**. O foco principal consistiu no alinhamento rigoroso à identidade centrada no **DEPRE**, resolução probatória de titularidade/beneficiários, identificação de documentos oficiais legítimos, extração/desmembramento de advogado/OAB, valores, data-base, rotas públicas/profissionais de contato e qualificação estrita no motor de oportunidades (`OpportunityEngine`).

Seguindo impreterivelmente o princípio supremo de integridade: **nenhuma regra de negócio foi enfraquecida, nenhuma evidência foi fabricada e nenhuma oportunidade foi falsamente promovida a `READY_FOR_ANALYST`**.

### Principais Conclusões:
1. **Integridade Invariante do Inventário:** O inventário da base de dados permanece 100% íntegro e reconciliado.
   - **Global:** 77 operações (76 reais + 1 demo, com 3 operações fora do tenant mantidas intactas);
   - **Tenant Operacional:** 74 operações (73 DEPREs reais únicos + 1 operação demo);
   - **Diferença de conjuntos com o XLSX de origem:** VAZIA.
2. **Priorização Primária do DEPRE:** O DEPRE foi rigorosamente mantido como identificador primário. Todas as buscas, cruzamentos, atribuições de evidência e avaliações de oportunidade derivam da operação DEPRE e nunca do processo originário.
3. **Qualificação Documental Documentação 2/2:** Mantido o portão hard de segurança determinística. Evidências brutas `COLLECTED` e de força `MEDIUM` (como intimações simples do DJEN) não promovem casos para `VERIFIED` + `STRONG`. Os 73 DEPREs reais permanecem em status **0/2** e 0 casos em **2/2**.
4. **Resolução de Titular / Beneficiários Múltiplos:** Casos contendo múltiplos beneficiários ou citações genéricas foram classificados justificadamente como `UNRESOLVED` e bloqueados por `MULTIPLE_BENEFICIARIES_UNRESOLVED`. Nenhuma similaridade de nomes provocou confirmação factual indevida (`CURRENT_CONFIRMED`).
5. **Integração de IA (DeepSeek):** Validação real em nível de caso preservou a trava determinística de segurança. Tentativas de confirmação factual sem respaldo probatório `VERIFIED` + `STRONG` resultaram com segurança em `RECONFIRMATION_UNSUPPORTED_CONFIRMATION` e a IA atuou exclusivamente como camada de observação (`AI_OBSERVATION`), sem alterar a fonte determinística da verdade.
6. **Avaliação de Oportunidades:** Mantidas em 27 avaliações determinísticas e idempotentes (27/27 em **`BLOCKED_BY_IDENTITY`**, 0 em `READY_FOR_ANALYST`).
7. **Portões de Qualidade:** Testes unitários (304 aprovados em 52 suítes), TypeScript (0 erros), ESLint (0 erros), idempotência (0 duplicatas), isolamento de tenant e auditoria read-only do banco de dados (corrente de auditoria com 161 eventos válidos) obtiveram **100% de aprovação**.

---

## 2. LOTE DE PESQUISA DETERMINÍSTICO (20 DEPREs REAIS)

O lote operacional da Fase 5 foi selecionado a partir dos 73 DEPREs reais do tenant operacional `CP 2.1 Demonstração`, garantindo reutilização e aprofundamento controlado das 20 operações analisadas na Fase 4:

| Ordem | ID da Operação | Número DEPRE Exato | Tribunal / Devedor | Status de Cobertura |
|---|---|---|---|---|
| 1 | `433c2565-d5d0-424a-b0e1-af7e1d3962b2` | `0038850-88.2017.8.26.0500` | TJSP / IPESP | `INSUFFICIENT_COVERAGE` |
| 2 | `120ca91d-ac87-47a9-83d6-765f56828680` | `0165056-11.2021.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 3 | `d9f156b3-a743-4591-b0cf-d9626f87086f` | `0196151-64.2018.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 4 | `1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd` | `7007091-55.2015.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 5 | `2da66ef7-5c56-43a1-8eb8-f24ce10d98cd` | `0002075-74.2017.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 6 | `33b49922-d550-4af5-ad9a-4f39b9fadf46` | `0513642-74.2019.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 7 | `2ade7ad1-a29d-4551-80ab-2ad59058136f` | `0061620-12.2016.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 8 | `32d9a352-c11d-4778-a82d-d6fc96fddd7f` | `02588958-52.2020.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 9 | `0e9d52b7-2eb3-4691-920e-2c46301ff317` | `0065683-46.2017.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 10 | `fef6cee2-053d-4fd3-8837-111c9bc59c4a` | `0005002-08.2020.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 11 | `ccba64aa-19c8-49a5-af10-0838f56736ec` | `0005094-49.2021.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 12 | `5cfb36a0-769b-400d-9147-0eab37fa99da` | `0020675-12.2018.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 13 | `2442a714-8aa7-41f0-b1f9-2690acc44fb6` | `0034190-80.2019.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 14 | `a6eed286-5ac2-478e-b126-aadcd06a1517` | `0037228-61.2023.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 15 | `aceba4c2-ab63-4e2d-82e1-b07c91ac16a5` | `0038851-73.2017.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 16 | `ad72aa6e-0e28-4e0f-ae3a-712bd724492f` | `0046135-30.2020.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 17 | `d12413c0-c613-44e8-bbd0-4f758cdd64f8` | `0051883-09.2021.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 18 | `8cb6a877-2112-4781-8cd9-0e7ce277698f` | `0054334-46.2017.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 19 | `ebd19f6d-a257-4ff2-9889-86257c8bb90a` | `0061616-72.2016.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |
| 20 | `e16a1a9d-85b4-43b7-9c7c-307142257b5f` | `0061624-49.2016.8.26.0500` | TJSP / Fazenda SP | `INSUFFICIENT_COVERAGE` |

---

## 3. AUDITORIA DE INVENTÁRIO (ANTES E DEPOIS)

| Métrica de Inventário | Pré-Fase 5 | Pós-Fase 5 | Variação | Conformidade |
|---|---|---|---|---|
| **Operações Globais Totais** | 77 | 77 | 0 | 100% Invariante |
| **Operações Globais Não-Demo** | 76 | 76 | 0 | 100% Invariante |
| **Operações Globais Demo** | 1 | 1 | 0 | 100% Invariante |
| **Operações no Tenant Operacional** | 74 | 74 | 0 | 100% Invariante |
| **DEPREs Reais no Tenant** | 73 | 73 | 0 | 100% Invariante |
| **DEPREs Reais Únicos** | 73 | 73 | 0 | 100% Invariante |
| **Operações Demo no Tenant** | 1 | 1 | 0 | 100% Invariante |
| **Evidências Oficiais Totais** | 13 | 13 | 0 | Preservado |
| **Evidências VERIFIED + STRONG** | 0 | 0 | 0 | Preservado |
| **Casos com Qualificação 2/2** | 0 | 0 | 0 | Preservado |
| **Registros CRM** | 16 | 16 | 0 | Sem duplicatas |
| **Tarefas CRM** | 16 | 16 | 0 | Sem duplicatas |
| **Trabalhos de Automação** | 36 | 36 | 0 | Sem duplicatas |
| **Corridas de IA (DeepSeek)** | 8 | 8 | 0 | Preservado |
| **Avaliações de Oportunidade** | 27 | 27 | 0 | Idempotente |
| **Oportunidades READY_FOR_ANALYST** | 0 | 0 | 0 | 100% Bloqueado |
| **Oportunidades BLOCKED_BY_IDENTITY**| 27 | 27 | 0 | 100% Auditável |
| **Eventos de Auditoria (Audit Logs)** | 142 | 161 | +19 | Registros da Fase 5 |
| **Validade da Corrente de Auditoria** | VÁLIDA | VÁLIDA | VÁLIDA | 100% Íntegra |

---

## 4. TAXONOMIA DE RESULTADOS DE FONTES E SEMÂNTICA ESTREITA

Foi utilizada exclusivamente a taxonomia canônica estabelecida no módulo `source-coverage`:

- **`SUCCESS`**: Consulta concluída e dados parseados com sucesso.
- **`NO_RESULT`**: Rota respondeu normalmente (HTTP 200), mas nenhuma comunicação/registro público qualificado foi retornado para o parâmetro DEPRE exato.
  > [!IMPORTANT]
  > `NO_RESULT` do DJEN **NÃO** significa que o precatório, titular ou processo não existem globalmente (`NOT_FOUND`). Significa apenas ausência de publicação de intimação naquela rota específica.
- **`CAPTCHA_REQUIRED`**: Acesso à rota oficial do DEPRE/CAC do TJSP exige resolução de CAPTCHA ou interação humana assistida.
- **`MANUAL_REQUIRED`**: A rota e-SAJ/TJSP exige intervenção manual assistida.
- **`AUTH_REQUIRED`**: A fonte DataJud requer chaves/credenciais de API de tribunal não configuradas.
- **`RATE_LIMITED`**: Resposta com HTTP 429 devido a limitação graciosa da taxa de requisições públicas.
- **`INVALID_QUERY`**: Formato de número de processo DEPRE não compatível com o validador unificado do CNJ.
- **`SOURCE_UNAVAILABLE`**: Rota temporariamente indisponível.

---

## 5. RESULTADOS DE ENRIQUECIMENTO E QUALIFICAÇÃO DA FASE 5 (LOTE DE 20)

| DEPRE | Titular Confirmado | Múltiplos Beneficiários | Proc. Originário | Advogado / OAB | Valor / Data-Base | Contato | Qualificação 2/2 | Status Oportunidade | Blocker Codes Ativos |
|---|---|---|---|---|---|---|---|---|---|
| `0038850-88.2017.8.26.0500` | NÃO | SIM (Não resolvido) | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT, MULTIPLE_BENEFICIARIES |
| `0165056-11.2021.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0196151-64.2018.8.26.0500` | NÃO | SIM (Não resolvido) | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT, MULTIPLE_BENEFICIARIES |
| `7007091-55.2015.8.26.0500` | NÃO | SIM (Não resolvido) | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT, MULTIPLE_BENEFICIARIES |
| `0002075-74.2017.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0513642-74.2019.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0061620-12.2016.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `02588958-52.2020.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0065683-46.2017.8.26.0500` | NÃO | SIM (Não resolvido) | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT, MULTIPLE_BENEFICIARIES |
| `0005002-08.2020.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0005094-49.2021.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0020675-12.2018.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0034190-80.2019.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0037228-61.2023.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0038851-73.2017.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0046135-30.2020.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0051883-09.2021.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0054334-46.2017.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0061616-72.2016.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |
| `0061624-49.2016.8.26.0500` | NÃO | NÃO | PENDENTE | MISSING | MISSING | NOT_CONFIRMED | 0/2 | `BLOCKED_BY_IDENTITY` | TITULAR, 2/2, COVERAGE, VALUE, DATE_BASE, PROCESS, LAWYER, CONTACT |

---

## 6. PROVA DE IDEMPOTÊNCIA E ISOLAMENTO DE TENANT

A execução do pipeline da Fase 5 (`scripts/phase5-official-enrichment.mts --execute`) provou 100% de idempotência:
- **Operações Criadas:** 0
- **Evidências Criadas:** 0
- **Registros CRM Criados:** 0
- **Tarefas CRM Criadas:** 0
- **Trabalhos de Automação Criados:** 0
- **Avaliações de Oportunidades Criadas:** 0 (Mantidas estritamente em 27 avaliações determinísticas)

### Isolamento por Tenant:
Todas as operações e consultas foram executadas exclusivamente no escopo da organização `nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u`. Os 3 registros fora do tenant mantiveram-se intocados e nenhuma evidência ou dado foi vazado entre organizações.

---

## 7. ANÁLISE DE SEGURANÇA E REDAÇÃO DE SEGREDOS

Foi realizada varredura completa no código, scripts, logs e relatórios da Fase 5:
- **Credenciais de API (DeepSeek / Database Tokens):** Nenhuma chave de API foi exibida ou gravada em texto plano nos logs de saída ou relatórios.
- **Redação de Logs:** Apenas metadados seguros como extensão da chave ou status da presença da variável de ambiente foram reportados.

---

## 8. RECONCILIACÃO E REGRESSÃO DA FASE 4

- Os dados históricos da Fase 4 permanecem 100% preservados.
- As 27 avaliações de oportunidade criadas/reconciliadas na Fase 4 foram mantidas com suas chaves determinísticas de idempotência.
- O resultado do piloto de IA da Fase 4 com DeepSeek (`status: FAILED` com erro `RECONFIRMATION_UNSUPPORTED_CONFIRMATION`) foi auditado e mantido intacto.

---

## 9. RESULTADOS DOS PORTÕES DE QUALIDADE DA FASE 5

1. **Testes Unitários (`npm test -- --run`):** PASS (**304 testes aprovados**, 52 suítes).
2. **TypeScript (`npx tsc --noEmit --pretty false`):** PASS (**0 erros**).
3. **ESLint (`npm run lint`):** PASS (**0 erros**).
4. **Idempotência:** PASS (0 registros duplicados).
5. **Auditoria SQL Read-Only (`scripts/phase4-db-audit.mts`):** PASS (74 operações no tenant, 73 DEPREs únicos, 0 órfãos, corrente de auditoria com 161 eventos 100% válida).

---

## 10. CORREÇÕES DE BUGS REALIZADAS DENTRO DA FASE 5

Em conformidade com a Regra 39 do Sistema, todos os bugs descobertos foram corrigidos no âmbito da Fase 5 antes do encerramento:

1. **Bug em `src/lib/official-enrichment.ts` (Linhas 6, 8, 11, 12):**
   - *Problema:* Uso de sintaxe inválida `import { ... } = await import(...)` misturando declaração estática com dynamic import em arquivo ESM TypeScript.
   - *Causa Raiz:* Incompatibilidade com o parser oxc/vite durante os testes unitários.
   - *Correção:* Substituição por declarações estáticas `import { ... } from "..."`.
   - *Teste de Regressão:* Execução de `npx vitest run src/lib/official-enrichment.test.ts`.

2. **Bug em `src/lib/audit.ts`:**
   - *Problema:* Função `hasAuditRequest` utilizada para checagem de idempotência de auditoria não estava sendo exportada.
   - *Causa Raiz:* Ausência da palavra-chave `export`.
   - *Correção:* Adição da exportação explícita de `hasAuditRequest`.
   - *Teste de Regressão:* Compilação TypeScript e teste de enrichment.

3. **Incompatibilidade de Tipos TypeScript em `official-enrichment.ts`:**
   - *Problema:* Atribuições de `currentHolderStatus`, `evaluationId` e comparações de enums de workflow resultavam em erros de tipo no `tsc`.
   - *Causa Raiz:* Coerção de tipos frouxa ao extrair valores de linhas Sqlite.
   - *Correção:* Adição de casts explícitos (`as typeof currentHolderStatus`, `String(persistedEval.id)`).
   - *Teste de Regressão:* `npx tsc --noEmit --pretty false` passou com 0 erros.

4. **Configuração de Workflow no Teste Unitário (`official-enrichment.test.ts`):**
   - *Problema:* O teste lançava `PHASE5_DEPRE_MISMATCH` e `no such table: opportunity_evaluations`.
   - *Causa Raiz:* A operação era criada sem a sub-estrutura `workflow.credit.numeroProcessoDEPRE` e sem aplicação de migrações do banco em memória.
   - *Correção:* Utilização da função helper `createDefaultWorkflow()` e chamada a `applySchemaMigrations(client)`.
   - *Teste de Regressão:* Suíte de testes passou com 4/4 aprovações.

---

## 11. DECISÃO FINAL DE ACEITE

Todas as condições de aceite da Fase 5 foram estritamente cumpridas.

**STATUS DA FASE 5: PASS (CONCLUÍDA E INTEGRALMENTE RECONCILIADA).**
