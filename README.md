# Central Precatórios — CP 2.0

Plataforma em Next.js 16 para captação e organização do ciclo operacional de oportunidades: um caso, um histórico e uma próxima ação.

## Executar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, crie uma conta em `/conta`, crie ou selecione uma organização e abra `/workspace`.

## Incluído

- Home premium responsiva
- Ferramentas, assistente, pré-análise e simulador progressivos
- Recuperação local do progresso e captura persistente
- Lead scoring e atribuição UTM centralizados
- Workspace por organização, máquina de estados, evidências e validações
- Documentos, jurídico, precificação, negociação, cessão e monitoramento
- Guia, checklist, privacidade, termos, sitemap e robots

## Persistência

O progresso público é salvo temporariamente no navegador. A operação usa LibSQL local no desenvolvimento ou remoto quando configurado. Operações e documentos são isolados por organização.

## Antes de produção

Configurar banco remoto, Better Auth, e-mail/MFA, storage privado com antivírus, migrações, auditoria e revisão jurídica. `/admin` e o armazenamento de PDFs no banco são recursos transitórios do MVP e não devem receber PII real em produção.

## Qualidade

```bash
npm test
npm run lint
npm run build
```

## CP 2.1 — demonstração

No workspace, proprietários e administradores podem usar **Carregar demonstração** e **Limpar demo**. O caso é sintético, isolado por organização e sempre identificado como sem validade real.

Antes da primeira execução ou após atualizar o código:

```bash
npm run auth:migrate -- --apply
npm run migrate:domain -- --apply
```

Faça backup do banco antes de aplicar migrações.

## E-mail e MFA

`AUTH_EMAIL_WEBHOOK_URL` pode apontar para um conector HTTP autorizado. Sem conector, desenvolvimento usa uma outbox local; produção falha fechado. `AUTH_MFA_MODE` aceita `OFF`, `OPTIONAL`, `REQUIRED_FOR_PRIVILEGED` ou `REQUIRED_FOR_ALL`.

Escopo e limitações: `docs/CP-2.1-RELEASE-REPORT.md`.
