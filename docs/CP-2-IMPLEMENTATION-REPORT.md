# Relatório de implementação — CP 2.0

Verificado em 14/09/2026.

## Implementado

- Operação existente preservada e evoluída com workflow validado.
- Máquina de estados com transições permitidas e bloqueio no servidor.
- Credor, crédito, prioridade, confiança e próxima ação estruturados.
- Evidências com fonte, referência, data, confiança e status.
- Validações por severidade e revisão humana explícita.
- Pedido e parecer jurídico versionados, sem decisão legal automática.
- Precificação determinística com fórmula, custos, margem e premissas.
- Oferta, contraproposta, aceite, rejeição, cessão e monitoramento manual.
- Dossiê JSON versionado e identificado como operacional.
- RBAC server-side nas APIs de operações e documentos.
- Leitura compatível com registros legados e migração idempotente da coluna workflow.
- Interface verificada em desktop e viewport móvel de 390 × 844.

## Preservado

Site público, aquisição, autenticação, organizações, isolamento por organização, DataJud, documentos, tarefas, diligência, propostas legadas, agenda, pipeline, relatórios, CSV, histórico e concorrência otimista.

## Validação executada

- `npm test -- --run`: 8 arquivos e 19 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build`: aprovado; Next.js 16.3.4, TypeScript e 27 rotas.
- Navegador: home e workspace carregaram, sem overlay de erro.
- Mobile: confirmado sem overflow horizontal em 390 px após correção.

## Sem API paga

O CP capta leads, organiza oportunidades, recebe PDFs, registra evidências, validações, pareceres, cenários, negociações, cessão e monitoramento manualmente. Fonte indisponível não bloqueia o caso: o fluxo assistido permanece disponível.

## Limitações antes de produção real

1. `/admin` legado usa Basic Auth e leads globais; precisa migrar para identidade individual e tenancy.
2. PDFs precisam de storage privado, antivírus/quarentena, retenção e auditoria.
3. A trilha histórica precisa evoluir para AuditLog imutável e pesquisável.
4. Entidades críticas estão agregadas em JSON para evolução segura do MVP; normalizar conforme volume e BI.
5. Assinatura, KYC/KYB, pagamento, protocolo, OCR, e-mail e WhatsApp automáticos exigem conectores.
6. Não há monitoramento nacional automático nem alegação de cobertura nacional.
7. Verificação de e-mail, recuperação de senha e MFA devem anteceder operação de PII em escala.
8. Ainda falta suíte E2E automatizada; a verificação atual foi supervisionada.

## Demonstração segura

Use somente dados sintéticos. Crie conta e organização, abra `/workspace`, crie uma operação marcada como demonstração e percorra: Visão geral → Consulta e validação → Documentos → Jurídico → Precificação → Negociação → Cessão → Monitoramento. Salve entre transições.

## Veredito

Aprovado como MVP operacional avançado para demonstração sintética. Ainda não aprovado como SaaS production-grade para documentos reais até concluir segurança documental, identidade, auditoria e infraestrutura.
