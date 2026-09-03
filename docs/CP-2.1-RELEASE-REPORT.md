# CP 2.1 — Relatório de release

Data da validação: 19/09/2026.

## Baseline

O CP 2.1 evolui diretamente o MVP operacional CP 2.0. Site público, autenticação Better Auth, organizações, isolamento por tenant, operações, documentos, DataJud, tarefas, diligência, precificação, negociação, cessão, monitoramento e compatibilidade legada foram preservados.

## Mudanças verificadas

- Caso demonstrativo sintético, isolado por `isDemo`, carregável com um clique.
- Reset remove somente operações/documentos demonstrativos da organização ativa.
- Aviso persistente: “DADOS DE DEMONSTRAÇÃO — SEM VALIDADE REAL”.
- Criação de oportunidade restrita ao estado `NEW`.
- Gates server-side para jurídico, precificação, oferta, aceite, cessão, monitoramento e conclusão.
- Próxima ação, status documental e confiança manual do analista visíveis no caso.
- Fluxo não permite avançar duas etapas no rascunho sem salvar a primeira.
- `/admin` legado redireciona para o workspace autenticado; a listagem global deixou de integrar o fluxo de produção.
- Verificação de e-mail e recuperação de senha configuradas no Better Auth.
- Recuperação responde com mensagem neutra e usa token temporário do Better Auth.
- Plugin TOTP habilitado; política configurável por `AUTH_MFA_MODE`.
- Entrega de e-mail desacoplada por webhook; desenvolvimento pode usar outbox local, sem registrar tokens em logs.
- Migração de domínio versionada em `cp_migrations` e comando dedicado.

## Segurança documental

Foi criado `StorageAdapter` com upload, metadados, acesso privado, arquivamento, quarentena, restauração, checksum e promoção para armazenamento permanente. O adapter atual preserva o BLOB local para compatibilidade do MVP.

Cada documento registra tamanho, MIME, hash, categoria, versão, status, scan status, notas, retenção configurável, autor e timestamps. Uploads entram em `QUARANTINED`. Em desenvolvimento ficam como `DEMO_SCAN`; em produção, `NOT_SCANNED`. A API proíbe marcar `SAFE` sem `scanStatus=CLEAN`.

Downloads exigem sessão, organização, permissão, pertencimento do objeto e status permitido. Download, upload e revisão geram auditoria.

Limitação: ainda não há antivírus real nem object storage externo. Portanto, o CP 2.1 continua inadequado para documentos reais em produção até esses controles serem configurados.

## Auditoria

`audit_logs` é append-only pela camada da aplicação e encadeado por SHA-256 com `previous_event_hash` e `event_hash`. A serialização é determinística. A leitura é isolada por organização e exige `audit:read`.

Isso oferece detecção de adulteração no nível da aplicação; não impede um administrador do banco de reescrever a tabela e recalcular a cadeia. Não é alegada imutabilidade criptográfica absoluta.

## RBAC

Permissões foram ampliadas para operação, documentos, revisão documental, jurídico, auditoria e demo. Alterações jurídicas são comparadas no servidor e exigem `legal:review`; o payload jurídico não pode alterar silenciosamente outros campos.

Limitação: os papéis customizados ainda precisam de uma experiência completa de provisionamento/convite no Better Auth antes de uso empresarial real.

## E2E e testes

A suíte existente de Vitest foi mantida e ampliada para 25 testes em 13 arquivos. O teste integrado `cp21-e2e.test.ts` percorre:

`demo → triagem → consulta → evidência → validação → documento → jurídico → precificação → oferta → contraproposta → aceite → cessão → monitoramento → auditoria → conclusão`

Também comprova isolamento entre organizações, quarentena documental, cadeia de auditoria e reset exclusivo de demo. A verificação supervisionada no navegador comprovou home, login, organização, workspace, carregamento da demo, persistência da transição, auditoria, redirecionamento de `/admin` e mobile 390 px sem overflow.

## Fontes e custo

O núcleo continua funcionando sem API paga. DataJud permanece uma fonte configurável e não representa cobertura nacional. Consulta assistida/manual continua sendo o fallback de primeira classe. Não foram adicionados conectores fictícios.

## Comandos executados

- `npm run migrate:domain -- --apply` — migração `20260919_cp21_foundation` aplicada.
- `npm test -- --run` — 13 arquivos e 25 testes aprovados, Vitest 4.1.11.
- `npm run lint` — aprovado.
- `npm run build` — aprovado; Next.js 16.3.4, TypeScript e 30 rotas.
- `npm audit fix` — dependências corrigidas.
- `npm audit --omit=dev` antes da correção encontrou vulnerabilidade em Vitest; após `npm audit fix`, o npm reportou 0 vulnerabilidades.
- Verificação agent-browser — conteúdo presente, sem overlay de erro e sem overflow horizontal em 390 × 844.

## Capacidades sem API paga

Captação pública, autenticação, organizações, caso operacional, evidências manuais, validações, documentos em quarentena, jurídico humano, precificação determinística, ofertas, negociação, cessão, monitoramento, dossiê JSON, auditoria, demo e reset.

## Bloqueios restantes para produção real

1. Antivírus/ClamAV ou scanner homologado e object storage privado.
2. Entrega transacional de e-mail configurada, reputação de domínio e testes de expiração/uso único em ambiente implantado.
3. MFA obrigatório efetivamente ativado e testado para proprietários/administradores.
4. Provisionamento completo de papéis, convites e remoção de acesso.
5. Migração dos leads globais para ownership claramente platform/tenant.
6. Auditoria de login/logout/falha e mudanças de membership via hooks de autenticação.
7. Normalização gradual de entidades agregadas em JSON quando volume e BI justificarem.
8. Suite E2E de navegador executável em CI; hoje há E2E de domínio automatizado e verificação de navegador supervisionada.
9. Backup/restauração e observabilidade operacional em infraestrutura de produção.

## Veredito

CP 2.1 está aprovado como **Demonstration Ready** com dados sintéticos: o caso é repetível, isolado, auditável e percorre o fluxo operacional sem API paga ou evidência falsa. Não está aprovado para PII/documentos reais em produção enquanto os bloqueios acima permanecerem.
