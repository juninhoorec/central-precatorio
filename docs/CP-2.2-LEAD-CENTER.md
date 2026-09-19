# CP 2.2 Lead Center — etapa comercial

## Objetivo

Organizar candidatos paulistas para análise comercial em uma única fila CP, sem criar um CRM paralelo. Os registros capturados permanecem no modelo operacional multi-tenant existente e começam em triagem. Candidato encontrado em fonte pública não significa credor interessado em vender.

## Critérios de aquisição

Perfil inicial por organização: Precatórios SP, TJSP, estado SP, mínimo comercial de R$ 100 mil, frescor operacional até 7 dias e janela recente até 30 dias. Owner/admin pode configurar mínimo, rótulos dos dois documentos e janelas de frescor. A configuração tem versão e evento de auditoria. O mínimo vale somente para precatórios; RPVs são contadas em uma fila separada de análise particular.

O score operacional (0–100) explica 7 dimensões: valor 25, aderência ao perfil 20, frescor 15, identificadores 15, documentação recebida 10, 2/2 documentos 10 e ausência de conflitos/duplicidade 5. Não mede segurança jurídica, probabilidade de pagamento ou interesse de venda.

## Ofícios da empresa

Cada crédito possui dois slots independentes, com rótulo, categoria, exigência comercial, estado, documento relacionado, origem, timestamps, revisor, divergência e notas. Estados: PENDENTE, RECEBIDO, EM_CONFERENCIA, VALIDADO_PARA_TRIAGEM, DIVERGENTE, NAO_APLICAVEL e REVISAO_HUMANA. O painel aceita 0/2, 1/2 e 2/2. Esses slots representam política documental interna; não afirmam que todo precatório tenha dois ofícios por lei.

## Identificadores

Número de precatório, ano, EP/ES, ano EP/ES, ofício requisitório principal, data do ofício, processo originário, processo de requisitório, ordem cronológica, referência DEPRE e origem dessa referência são campos distintos. Valores ausentes permanecem vazios. Não inferir um identificador a partir de outro.

## Fontes e ingestão

O CP oferece consulta pontual pela API pública de processos do TJSP (número, processo, parte, advogado/OAB), consulta assistida aos portais TJSP e e-SAJ, e importação assistida de CSV com proveniência e timestamp. A busca pontual não é uma lista de todos os credores nem retorna necessariamente saldo atualizado ou contato.

Fontes vinculadas no painel: [Credores TJSP](https://www.tjsp.jus.br/Precatorios/Precatorios/Credores), [Lista Geral](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral), [Pendentes](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes), [e-SAJ pagamentos](https://esaj.tjsp.jus.br/portalDevedor/consultarListaPagamentos.do) e [Mapas orçamentários](https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159). O portal principal aponta listas, mapas, planos, pesquisa e valores. Os dois sistemas são apresentados para consulta assistida durante a transição; CP não presume que um contém a base completa.

CSV/XLS/XLSX usam prévia antes da gravação; múltiplas abas exigem escolha explícita. Os cabeçalhos são sugeridos deterministicamente e podem ser mapeados para credor, valor, devedor, tribunal, precatório, ano, ofício, processos e DEPRE. O CP preserva a linha original nas notas/evidências e inclui seu número no apontamento de origem. XLSX aceita até 20 MB; XLS/CSV são conferidos pelo conteúdo/formato. Não se combinam abas automaticamente.

Cada importação grava um lote isolado por organização com hash SHA-256, fonte, URL de referência, nome do arquivo, ator, horários, versão do parser, estado e relatório efetivo. O mesmo arquivo na mesma fonte/organização é idempotente. Repetir o arquivo informa que já foi processado; um snapshot com conteúdo diferente é processado e divergências de valor são preservadas como revisão humana. O histórico mostra lidos, novos, atualizados, duplicados, conflitos, erros e status.

O painel Saúde das fontes deriva suas datas e estados da atividade persistida. Importações manuais aparecem como ASSISTED; sem lotes aparecem NOT_CONFIGURED; falhas posteriores e lotes antigos reduzem o estado. A consulta processual é sob demanda, não um robô recorrente. Link disponível não é tratado como sinal de saúde.

## Duplicidade e qualificação

Comparação determinística por TJSP + precatório + ano, EP/ES + ano, requisitório e processo/devedor/credor. Possíveis duplicidades ficam para revisão e nunca são mescladas automaticamente. A qualificação é regra operacional, não validação jurídica. Precatório abaixo do mínimo fica fora do perfil comercial, não é declarado inválido. RPVs não são reprovadas pelo mínimo de precatório.

## Documentos, contato e conversão

Os PDFs continuam privados, organizados por operação e sujeitos ao fluxo de quarentena existente (máximo 5 MB). Ao receber um PDF, o CP tenta extrair texto por página com pdfjs-dist e aplica padrões determinísticos para processo CNJ, número de precatório, data, ofício, moeda e DEPRE. Cada campo guarda valor, página, confiança e método. A comparação de processo/precatorio pode indicar compatibilidade parcial, compatibilidade ou divergência; valores isolados nunca vinculam o arquivo. Rótulo de ofício só pode ser associado quando o nome do arquivo coincide claramente com um dos dois rótulos configurados e o identificador do documento é compatível. A sugestão permanece para revisão humana.

PDF sem texto extraível aparece como NO_TEXT com aviso de que OCR será necessário; OCR não está incluído. Texto extraído não significa antivírus, validação jurídica ou confirmação do conteúdo. A categoria sugerida é apenas indicação de triagem. O arquivo permanece ligado ao mesmo registro quando o lead é convertido. Contato não é enriquecido automaticamente e nome em lista não equivale a consentimento/interesse.

Na aba Qualificação existe conversão explícita para TRIAGE. A ação atualiza o mesmo registro de operação no banco, acrescenta evidência de conversão, história e anotação de origem Lead Center, sem duplicar o cliente/arquivo. Se houver candidato duplicado provável, a interface exige revisão e confirmação adicional antes de avançar. Documentos e evidências permanecem no registro e podem ser abertos no fluxo existente.

## Segurança e limitações

Toda leitura de lotes, saúde e documentos usa organização ativa. Escrita de critérios exige owner/admin. Consulta TJSP respeita rate limit e não contorna CAPTCHA, autenticação ou bloqueios. A descoberta de listas continua assistida: o operador consulta e seleciona os arquivos públicos para importar. Não existe varredura automática completa/agendada, API paga, scraping de contato ou promessa de atualização contínua.

## IA

A IA continua opcional. A qualificação e as regras funcionam sem modelo. O copiloto pode auxiliar resumo, nunca preencher identificadores ou valores como fato, validar juridicamente ou inferir contato.

## Próximas etapas

1. Expandir fixtures de demonstração sintéticas para diferentes tipos de conflito e documentação.
2. Melhorar paginação e desempenho para arquivos/listas muito grandes além do limite atual de 20 MB.
3. Somente avaliar automação de fontes se o TJSP publicar um canal permitido, estável e documentado para esse uso.

## Teste de navegador

`npm run test:e2e` inicializa banco isolado de teste, aplica migrações, abre o CP local e executa Chromium headless. O fluxo usa apenas conta e dados sintéticos; não acessa tribunais nem provedores externos. Para CI Windows/Linux, instalar Chromium com `npx playwright install chromium` antes do comando.
