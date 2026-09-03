# CP: base SaaS e integrações verificáveis

Pesquisa em fontes oficiais em 9 de setembro de 2026. Este documento é uma recomendação de arquitetura e um roteiro de aceitação; não certifica que os critérios já estejam implementados. Contexto de partida: Next.js 16, LibSQL e administração com Basic compartilhado. Nenhuma contratação, envio para assinatura ou consulta de processo real foi executada nesta pesquisa.

## Identidade e empresas

Recomendação: identidade individual, sessões revogáveis e associação explícita entre usuário e organização. Todas as operações, documentos, exportações e métricas devem ser consultadas pelo escopo da organização autorizado no servidor. Trocar o nome da empresa na interface não prova isolamento. O Basic compartilhado pode servir como controle administrativo transitório, mas não identifica os integrantes de cada cliente.

O [plugin Organization do Better Auth](https://better-auth.com/docs/plugins/organization) fornece organizações, membros, convites e permissões. Há [documentação oficial para SQLite](https://better-auth.com/docs/adapters/sqlite). É uma opção para consolidar autenticação; a compatibilidade exata do adaptador com a conexão LibSQL e as migrações existentes precisa de prova local antes de adoção. O plugin não filtra automaticamente as tabelas comerciais da CP. A sessão deve resolver a associação ativa e cada consulta de dados deve aplicar esse escopo.

O [repositório Better Auth](https://github.com/better-auth/better-auth) tem [licença MIT verificada](https://raw.githubusercontent.com/better-auth/better-auth/main/LICENSE.md). Preservar os avisos da licença ao reutilizar código. A licença do código não inclui um serviço de e-mail nem elimina a necessidade de operar a infraestrutura.

Sem credenciais de terceiros: cadastro/sessão local, hash de senhas, organizações e permissões podem ser implementados e testados no banco de desenvolvimento. Para verificação de e-mail, recuperação e convites enviados de verdade, é necessário configurar um canal de entrega. Não exibir esses fluxos como concluídos por mostrar apenas uma tela de confirmação.

## Consulta judicial

A [API Pública DataJud do CNJ](https://datajud-wiki.cnj.jus.br/api-publica/acesso/) fornece metadados de processos públicos e usa uma chave pública publicada pelo CNJ, que pode ser alterada pelo órgão. Não exige credencial privada de um cliente para esse acesso público, mas exige enviar a chave vigente. Existem [endpoints por tribunal](https://datajud-wiki.cnj.jus.br/api-publica/endpoints/).

Integração recomendada: consulta iniciada por usuário autorizado, tribunal explícito, número de processo normalizado, timeout e tratamento de indisponibilidade. Guardar fonte e data da consulta e mostrar exatamente os campos retornados. Não converter resultado vazio em declaração de inexistência do processo. Não apresentar essa fonte como posição atual de fila, saldo atualizado, titularidade validada ou promessa de pagamento: essas conclusões não decorrem apenas dos metadados públicos.

É possível construir o adaptador e testar uma consulta pública sem conta privada, usando a chave publicada. Cobertura e atualização devem ser avaliadas por caso. Não foi validado um SLA ou limite contratual de requisições nesta pesquisa; não inventar quotas. Usar cache e tentativas com intervalo e respeitar respostas de limitação.

Portais com login, certificado, CAPTCHA ou restrição de acesso continuam sujeitos aos seus controles. A CP pode abrir o portal oficial para consulta humana e registrar fonte/resultado. Não remover CAPTCHA, reutilizar sessão alheia, varrer conteúdo sigiloso ou transformar uma extensão em mecanismo de contorno.

## Assinatura

A [documentação oficial de autenticação JWT da Docusign](https://developers.docusign.com/platform/auth/jwt/) é referência para uma integração de servidor. O fluxo requer configuração no provedor e autorização aplicável. A [orientação oficial de JWT](https://www.docusign.com/blog/developers/integrate-google-workspace-with-docusign-apis-using-jwt-grant-authentication) identifica integration key e distingue ambiente de desenvolvimento e produção.

O [SDK Node oficial](https://github.com/docusign/docusign-esign-node-client) tem [licença MIT verificada](https://github.com/docusign/docusign-esign-node-client/blob/master/LICENSE). Essa licença permite reutilizar o SDK sob seus termos; não fornece credenciais, plano comercial nem envelopes de assinatura.

Sem credenciais: modelo de adaptador, preparação de documento, estados internos e testes simulados explicitamente identificados. Com credenciais e configuração: envio real, autenticação no provedor, consulta de status e recebimento de eventos. Validar autenticidade e repetição dos eventos antes de atualizar o estado. Marcar manualmente uma etapa como finalizada não equivale a assinatura. A adequação jurídica do instrumento e do método de assinatura exige avaliação própria; esta pesquisa não a atesta.

## Extensão de navegador

Recomendação: uma extensão pequena para capturar, por ação explícita do operador, URL, título e trecho selecionado de página que ele está autorizado a consultar. Exibir revisão antes de enviar para uma operação da empresa ativa. Evitar coleta contínua e permissões para todos os sites.

Usar [Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest) e as [permissões documentadas pelo Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions). O [repositório oficial de exemplos](https://github.com/GoogleChrome/chrome-extensions-samples) tem [licença Apache-2.0 verificada](https://github.com/GoogleChrome/chrome-extensions-samples/blob/main/LICENSE); preservar licença e avisos aplicáveis quando reutilizar arquivos.

Sem credenciais externas: protótipo carregado localmente e exportação de um rascunho. O envio à CP exige autenticação própria da CP e autorização por empresa; nunca embutir Basic administrativo ou segredo permanente na extensão. Distribuição pública e conexões com serviços exigem configuração adicional. A extensão não confere acesso adicional a documentos judiciais.

## Critérios de aceitação SaaS

Marcar cada item somente com evidência de implementação e teste. Os 20 itens não têm pesos equivalentes; uma soma não é percentual de segurança, completude ou prontidão comercial.

| # | Critério | Evidência mínima para aceite |
|---|---|---|
| 1 | Identidade individual | Dois usuários entram com contas distintas; falhas não revelam contas existentes. |
| 2 | Sessão segura | Expiração, logout e revogação verificadas; cookies protegidos em produção. |
| 3 | Credenciais | Senhas com hash adequado; nenhum segredo ou senha em texto nos registros. |
| 4 | Organizações | Associação usuário–empresa persistida e validada no servidor. |
| 5 | Isolamento de leitura | Usuário da empresa B não lê operação A por listagem ou ID direto. |
| 6 | Isolamento de escrita | B não altera, cria anexos em, ou exclui recursos de A. |
| 7 | Isolamento de arquivos | Download por ID aplica associação à empresa; URL sozinha não autoriza acesso. |
| 8 | Permissões | Papel de leitura falha ao gravar; administração de membros exige papel apropriado. |
| 9 | Convites e remoção | Convite expira e não é reutilizável; remoção revoga acesso do membro. |
| 10 | Recuperação de conta | Fluxo real de recuperação testado ou indisponibilidade comunicada sem simulação enganosa. |
| 11 | Migração existente | Dados legados atribuídos à organização correta com backup e validação. |
| 12 | Persistência durável | Dados permanecem após reinício e nova implantação no ambiente escolhido. |
| 13 | Restauração | Backup restaurado em ambiente separado e contagem/integridade conferidas. |
| 14 | Concorrência | Duas sessões não sobrescrevem mudanças silenciosamente; conflito é recuperável. |
| 15 | Auditoria | Eventos relevantes registram ator, empresa, recurso e instante, sem alteração livre pelo cliente. |
| 16 | Proteção contra abuso | Login e uploads têm limites e validação de tamanho/tipo; erros preservam dados privados. |
| 17 | Privacidade operacional | Há procedimento verificável para retenção, exportação e exclusão de dados por empresa. |
| 18 | Planos e cobrança | Limites aplicados no servidor; se há cobrança, eventos repetidos não duplicam direitos. Sem cobrança ativa, texto comercial deixa isso explícito. |
| 19 | Integrações honestas | Estado distingue indisponível, simulado e real; erros/credenciais ausentes não viram sucesso. |
| 20 | Operação e interface | Jornada responsiva/acessível testada; erros monitorados, canal de suporte e procedimento de incidente definidos. |

Prioridade recomendada: isolamento e sessões, persistência e restauração, recuperação de conta, depois integrações e cobrança. É possível evoluir uma base SaaS sem ativar todos os fornecedores, desde que a entrega identifique os critérios comprovados e os pendentes.
