# Contas e organizações CP

## Desenvolvimento

1. Execute `node scripts/auth-migrate.mts --apply` depois de fazer backup do banco.
2. Inicie o projeto e abra `/conta`.
3. Crie uma conta de teste e uma organização. Nenhuma conta real é criada automaticamente.

## Produção

Defina `BETTER_AUTH_SECRET` com no mínimo 32 caracteres, `BETTER_AUTH_URL` com a origem HTTPS pública, `DATABASE_URL` com banco LibSQL durável e, quando necessário, `DATABASE_AUTH_TOKEN`. A aplicação falha fechada se segredo ou URL de autenticação estiverem ausentes.

As operações e os documentos são filtrados pela organização ativa no servidor. Registros antigos ficam em `legacy-internal` e precisam ser atribuídos manualmente, após backup, à organização correta. Não associe dados antigos automaticamente a um cliente recém-criado.

Convites estão bloqueados até existir verificação real de e-mail. Recuperação de senha, MFA, cobrança, backup/restauração testados e administração completa de papéis ainda são itens de produção pendentes.
