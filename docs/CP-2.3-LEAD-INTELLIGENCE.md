# CP 2.3 — Lead Intelligence & aquisição

## Estado desta entrega

Esta entrega adiciona observação de fontes, captura CAC assistida e parsing de relatórios oficiais PDF/ZIP ao Lead Center. Ela **não conclui CP 2.3**: aquisição recorrente e revalidação não estão configuradas, e os relatórios CAC analisados não identificam nominalmente o credor por cartão. Nenhum dado de credor é inventado a partir de alterações de página ou inferido de campos sem rótulo.

## Identificadores do crédito

- `Nº Processo DEPRE` é um campo primário próprio (`numeroProcessoDEPRE`) e aparece na lista de captação, ficha, resumo operacional, evidência e comparação Benchmark com esse rótulo exato.
- O valor bruto da fonte é preservado; `numeroProcessoDEPRENormalizado` contém apenas dígitos para matching determinístico. A normalização não substitui o valor apresentado.
- `EP/ES`, `Processo originário`, `Número do precatório/ano`, `Nº do Ofício Requisitório` e `Referência DEPRE` permanecem campos separados. Processo DEPRE não é armazenado em `precatoryNumber` nem em `depreReference`.
- Quando o Processo DEPRE não é encontrado, a interface mostra “Não identificado na fonte consultada.”
- O Benchmark prioriza Processo DEPRE; segue com EP/ES + devedor, precatório + tribunal + devedor e, por último, processo originário + credor. O relatório expõe correspondências específicas por DEPRE.

## O que funciona agora

- Central de Captação com verificação manual de sete páginas oficiais TJSP/DEPRE/e-SAJ.
- Cada resposta confirmada como HTML público produz snapshot por organização: URL, HTTP, instante de coleta, duração, hash SHA-256, links oficiais identificados e estado `FIRST_SEEN`, `UNCHANGED`, `CHANGED` ou `FAILED`.
- Histórico de execução, mudança de hash, links da página e falha individual são visíveis na interface.
- A falha de uma fonte não interrompe a leitura das seguintes; a execução termina `PARTIAL` quando aplicável.
- Fontes são allowlisted; apenas HTTPS nos hosts exatos cadastrados. Redirecionamentos são interrompidos, resposta maior que 12 MB é recusada, timeout é limitado e o adaptador verifica `robots.txt`, falhando fechado se não puder confirmar a regra de acesso.
- Isolamento por organização, RBAC `operation:write` para execução, `operation:read` para histórico e eventos de auditoria.
- Motor sem dependência de IA ou provedor pago.

## Adaptadores oficiais monitorados

| Fonte | URL | Capacidade efetiva |
|---|---|---|
| TJSP Credores | https://www.tjsp.jus.br/Precatorios/Precatorios/Credores | monitor HTML e links |
| TJSP Lista Geral | https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral | monitor HTML e links |
| TJSP Pendentes | https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes | monitor HTML e links |
| TJSP/e-SAJ listas | https://esaj.tjsp.jus.br/portalDevedor/consultarListaPagamentos.do | monitor HTML público; falha fechada se robots inacessível |
| TJSP Entidades Devedoras | https://www.tjsp.jus.br/Precatorios/Precatorios/EntidadesDevedoras | monitor HTML e links |
| TJSP Comunicados | https://www.tjsp.jus.br/Precatorios/Comunicados | monitor HTML e links |
| DEPRE Comunicados | https://portal.tjsp.jus.br/Depre/Comunicados/Comunicado | monitor HTML público; falha fechada se robots inacessível |

O monitor identifica mudanças no catálogo/página, não mudanças de saldo ou situação de um precatório. “O que mudou?” mostra a página, horário, hash e links observados; não apresenta contagens de novos credores.

## Dados e isolamento

As tabelas `capture_source_runs` e `capture_source_snapshots` são criadas de modo idempotente pelo repositório de monitoramento. Ambas levam `organization_id`; índices permitem obter histórico recente. Snapshots antigos não são sobrescritos. A chave de execução impede duas sincronizações simultâneas da mesma organização e execuções abandonadas por mais de dez minutos são marcadas como falha antes de nova tentativa.

Cada execução registra `runId`, organização, ator, horários, estado, fonte, HTTP, hash, duração, erro e links coletados. Logs estruturados não incluem dados de credores. Eventos `SOURCE_SYNC_STARTED`, `SOURCE_SYNC_COMPLETED` e `SOURCE_SYNC_FAILED` entram na trilha de auditoria.

## Frescor, saúde e reconciliação

O horário `collectedAt` é o horário em que o CP consultou a página ou recebeu o arquivo. A data “Data” do cartão CAC é tratada como data do protocolo, não como data-base do valor. Os relatórios não identificam uma data de referência de lista uniforme; por isso a interface não afirma quando cada lista ou credor foi atualizado pelo Tribunal. A evidência de importação inclui nome do arquivo, checksum, sessão e página/cartão. Ainda não há reconciliação automática entre fontes nem estado jurídico derivado de desaparecimento.

## Agendamento e operação

“Executar verificação agora” chama `POST /api/capture/sources`. Execução recorrente não está configurada: o repositório não identifica um executor (Vercel Cron, serviço gerenciado ou worker persistente). Para habilitar frequência diária sem prometer uma agenda inoperante, primeiro precisa existir e ser configurado um executor no ambiente de implantação. Não se requer credencial de fonte.

Para uma conferência manual das respostas públicas sem usar o banco da empresa, `npm run source:check` executa as mesmas regras em banco LibSQL em memória.

## Benchmark Mode

A Central aceita CSV/XLS/XLSX exportado de outra ferramenta, pede seleção explícita de aba quando necessário, compara sem alterar operações e guarda relatório resumido por organização com hash idempotente. A comparação mostra volumes CP/externo, correspondências totais e por Nº Processo DEPRE, exclusivos, repetidos externos, diferenças de valor, incompletos, aderência ao perfil atual e revisão necessária. Identidade determinística prioriza Nº Processo DEPRE; depois EP/ES + devedor, número do precatório + tribunal + devedor e processo originário + credor. Nome ou valor isolado nunca vira chave. RPV fica contada separadamente.

O relatório não persiste cópia de toda a lista de terceiro e não dá pontuação de vencedor. Registro externo sem data de coleta não é promovido artificialmente a qualificado; requer revisão quando frescor/documentos/identificadores não estiverem comprovados. O CSV exportado apresenta os totais da comparação.

## Limitações e segurança

- Não há varredura automática de toda a base, geração automatizada do relatório CAC, revalidação atual ou lead de aquisição real gravado a partir dos arquivos analisados. O parser atual extrai o universo de registros dos dois relatórios CAC reais disponíveis; o campo credor permanece vazio porque não está explicitamente rotulado nesses PDFs.
- Consulta que dependa de formulário dinâmico, autenticação ou interação do usuário aparece como assistida. Não há bypass de CAPTCHA/autenticação, endpoint privado ou bloqueio.
- Não há OCR, inferência de contato, decisão jurídica, merge automático incerto ou integração com a IA local.
- RPV, perfil comercial de R$ 100 mil, dois documentos internos e workflow existente permanecem no Lead Center CP 2.2.

## Próximos itens necessários para declarar CP 2.3 completo

1. Confirmar com o TJSP/e-SAJ um canal público/permitido que exponha arquivos ou consultas estruturadas de lista; testar a estabilidade e guardar fixture real permitida.
2. Implementar parser de registros e snapshots por registro com proveniência por campo, normalização, dedupe, reconciliação e mudança de valores.
3. Configurar executor recorrente efetivo para o deploy real e retry/cancelamento compatíveis com esse runtime.
4. Implementar fila automática de leads, RPV segregada e critérios de qualidade explicáveis sobre dados efetivamente extraídos.
5. Acrescentar cobertura E2E autenticada para execução, mudança, falha/retry, tenant, RBAC e viewport móvel; o E2E atual cobre upload e relatório básico de benchmark.

## Verificação

O conjunto exato de testes e comandos desta entrega está em `docs/CP-2.3-LEAD-INTELLIGENCE-RELEASE-REPORT.md`.
