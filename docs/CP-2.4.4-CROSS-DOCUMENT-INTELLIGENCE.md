# CP 2.4.4 — Cross-Document Intelligence

## Status

Implementação parcial da camada determinística de reconciliação entre documentos. A fase completa depende do piloto cross-document com inferência real, gold standard e revisão humana; consulte o [relatório do piloto](CP-2.4.4-CROSS-DOCUMENT-PILOT-REPORT.md).

## Entregue nesta fatia

- Reconciliação por identificadores encontrados no conteúdo: processo DEPRE, EP/ES, precatório, processo originário e devedor. Nomes de arquivos não criam relações.
- Relações determinísticas carregam evidência dos dois documentos, incluindo página e trecho.
- Matriz de fontes para credor/beneficiário, DEPRE, EP/ES, origem, valor, devedor, status, prioridade e titular. Divergências são preservadas; nenhuma fonte é escolhida automaticamente.
- Matriz de partes com papel e evidência por página. ADVOGADO permanece distinto de CREDOR.
- Menções a cessão e sucessão geram hipóteses, não confirmação de transferência ou de titular atual. Uma menção narrativa não é classificada como instrumento encontrado.
- Cobertura informa documentos e páginas analisados e documentos cuja leitura falhou.
- API de cluster e comparação requer permissão `document:read`, opera na organização ativa, não serve resposta cacheável e registra execução em auditoria. A comparação rejeita documentos de operações distintas.
- A interface existente exibe cobertura, matriz de fontes, estados cautelosos e trechos de evidência.

## Limites conhecidos

- O agrupamento atual é escopado à operação; relações e clusters ainda não são entidades persistidas com ciclo de revisão próprio.
- A matriz é determinística e limitada aos padrões textuais implementados. Ausência significa “não encontrado no escopo analisado”, não inexistência do fato.
- Relações ambíguas propostas por IA, grafo persistido, timeline de eventos de fonte, cache por hashes, invalidação incremental, análise semântica cross-document, priorização de documentos e workflow de revisão para relações ainda não foram implementados nesta fase.
- A comparação existente ainda não oferece diffs completos de partes/status nem sincronização de páginas no visualizador.
- O copiloto não foi alterado para responder pelo grafo cross-document.
- Não existe gold standard cross-document validado nesta entrega; métricas do piloto são pendentes.

## Segurança e autoridade

A análise não atualiza campos canônicos. Divergências permanecem expostas. A evidência estrutural é observacional e não constitui conclusão jurídica. Recuperação de documentos é restrita pela permissão e pelo `organizationId` ativo; a comparação também exige a mesma operação.

## Verificação

- `npx vitest run src/lib/ai/cross-document-engine.test.ts src/lib/ai/document-evidence-engine.test.ts`: 11 testes aprovados.
- `npm test`: 83 testes aprovados.
- Lint focado nos arquivos desta fatia: sem erros ou avisos após os ajustes.
- TypeScript global permanece bloqueado por dois erros já presentes em `operational-case.tsx` e `operations-client.tsx` relativos à prop `operationId`; nenhum diagnóstico aponta os módulos cross-document alterados.
