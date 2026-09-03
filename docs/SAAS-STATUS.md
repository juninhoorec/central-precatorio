# Estado verificável do SaaS CP — 9 de setembro de 2026

Percentual estrito atual: **40% (8 de 20 critérios integralmente aprovados)**. Itens parciais contam como zero para evitar uma nota inflada. A porcentagem mede o checklist técnico de `SAAS-RESEARCH.md`; não é certificação jurídica, de segurança ou de produção.

| # | Critério | Estado | Evidência / falta |
|---|---|---|---|
| 1 | Identidade individual | Aprovado | Duas contas de teste entraram separadamente. |
| 2 | Sessão segura | Parcial | Expiração e logout implementados; revogação sem teste automatizado. |
| 3 | Credenciais | Aprovado | Hash de senha e mínimo de 12 caracteres. |
| 4 | Organizações | Aprovado | Organização ativa e associação validadas no servidor. |
| 5 | Isolamento de leitura | Aprovado | Empresa B não listou operação da A. |
| 6 | Isolamento de escrita | Aprovado | Alteração cruzada retornou 404. |
| 7 | Isolamento de arquivos | Aprovado | Anexo cruzado retornou 404; download filtra empresa. |
| 8 | Permissões | Pendente | Faltam papéis de leitura/edição/admin e testes. |
| 9 | Convites e remoção | Pendente | Convites bloqueados até existir verificação real de e-mail. |
| 10 | Recuperação de conta | Pendente | Depende de canal de e-mail configurado. |
| 11 | Migração existente | Parcial | Legado em `legacy-internal`; atribuição assistida e backup pendentes. |
| 12 | Persistência durável | Pendente | Banco remoto de produção não provisionado. |
| 13 | Restauração | Pendente | Falta executar restauração real. |
| 14 | Concorrência | Aprovado | Versão otimista e conflito 409 testados. |
| 15 | Auditoria | Parcial | Alterações registram usuário; falta trilha completa e imutável. |
| 16 | Proteção contra abuso | Parcial | Limites em login, payload, PDF e DataJud; falta antivírus/WAF. |
| 17 | Privacidade operacional | Pendente | Retenção, exportação e exclusão por empresa não automatizadas. |
| 18 | Planos e cobrança | Pendente | Página comercial existe; cobrança e limites no servidor não. |
| 19 | Integrações honestas | Aprovado | DataJud real; KYC, assinatura e pagamento aparecem pendentes. |
| 20 | Operação e interface | Parcial | Responsividade/build testados; falta monitoramento e processo de incidente. |

## O que falta para 100%

RBAC completo; verificação/recuperação por e-mail; convites seguros; migração formal do legado; banco remoto durável; backup e restauração; trilha integral; antivírus/WAF e monitoramento; retenção/exportação/exclusão LGPD; cobrança e limites; MFA; assinatura eletrônica, KYC/KYB e pagamentos contratados; homologação jurídica e operacional.

Uma extensão pode capturar URL e trecho selecionado por ação do operador, mas não resolve autenticação, isolamento, assinatura ou acesso protegido. Ela não deve contornar CAPTCHA, login ou restrições dos tribunais.
