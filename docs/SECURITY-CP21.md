# Segurança operacional CP 2.1

- Organização e usuário são derivados da sessão, nunca do payload.
- APIs críticas revalidam membership e permissão.
- Documentos usam acesso privado, escopo por organização e quarentena.
- `SAFE` exige resultado real `CLEAN`; `DEMO_SCAN` não equivale a antivírus.
- Auditoria é append-only e tamper-evident na camada da aplicação.
- Recuperação de senha não revela se o e-mail existe.
- Segredos permanecem em variáveis de ambiente.
- Dados demonstrativos usam `isDemo` e podem ser removidos sem atingir registros normais.

Antes de PII real: configurar e-mail, MFA obrigatório, storage privado, scanner, backup/restauração, retenção LGPD, observabilidade e testes de intrusão/IDOR em ambiente implantado.
