# CP 2.3 — relatório desta entrega

## Validação oficial real

`REAL_OFFICIAL_RECORD_VALIDATION = PERFORMED_SUCCESS`

O parser de produção foi executado com sucesso sobre dois ZIPs oficiais TJSP/CAC recebidos em 28/09/2026. Esta flag confirma parsing de registros oficiais, não ingestão persistida em organização CP: `REAL_OFFICIAL_LEADS_CREATED = 0`. A jornada E2E de gravação usa fixture sintética e permanece separada da validação oficial.

| Arquivo oficial | PDF interno | Páginas | Registros | Nº Processo DEPRE | EP/ES | Processo originário | Valor | Devedor rotulado | Credor identificado |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `SCP_DEPRE_LISTAPRECATORIOPENDENTE_731257.ZIP` | `ListaPrecatorioPendente_731257.pdf` | 119 | 801 | 801 únicos | 4 | 801 | 801 | 731 | 0 |
| `SCP_DEPRE_LISTAPRECATORIOPENDENTE_731208.ZIP` | `ListaPrecatorioPendente_731208.pdf` | 123 | 911 | 911 únicos | 3 | 911 | 911 | 0 | 0 |

As duas listas têm 0 identificadores DEPRE em comum. Foram extraídos, por arquivo, 801/911 processos DEPRE únicos, 801/911 processos originários, 801/911 valores, 801/911 ordens de pagamento, 783/885 datas de protocolo e 801/911 localizadores página/cartão; EP/ES está explicitamente presente em 4/3 registros. O devedor aparece rotulado em 731 registros do primeiro arquivo e em nenhum do segundo; credor explicitamente rotulado: zero nos dois PDFs. A data impressa no cartão foi classificada como data do protocolo, não como data-base do valor ou data de atualização da lista. Nenhum telefone, e-mail, CPF ou nome de credor foi inferido.

## Limite operacional atual

- Automático após selecionar um arquivo: validação de CSV/XLS/XLSX/PDF/ZIP, perfilamento, prévia, mapeamento, normalização, deduplicação, reconciliação, proveniência, qualificação e auditoria.
- Assistido: abrir a consulta pública CAC, concluir manualmente a etapa exigida pelo TJSP e baixar o resultado. O CAPTCHA não é automatizado nem contornado.
- Validado: formato text-native dos PDFs CAC enviados; parser PDF/ZIP, campos rotulados, página/cartão, Processo DEPRE, EP/ES quando explícito, processo originário e valor. Ainda não validado: gravação de qualquer registro oficial em uma organização CP autenticada, pois esta sessão não possui tenant autenticado para efetuar a importação real.
- O preview perfila CSV integralmente e até 100 linhas por aba Excel; amostras Excel são identificadas como amostras. Isso não certifica autenticidade ou atualidade do documento.

## Implementado

- Monitoramento manual autenticado de catálogo de sete URLs oficiais TJSP, e-SAJ e DEPRE.
- Snapshots persistentes e isolados por organização; hash, instante, HTTP, latência, links públicos e erro por fonte.
- Comparação determinística de hash com estados de primeira observação, sem mudança, alterado ou falho.
- Execução concorrente protegida por organização; falha parcial não interrompe outras fontes; recuperação de execução presa após dez minutos.
- Interface Central de Captação, histórico de execuções e “O que mudou?” para páginas observadas.
- Auditoria, RBAC e proteção de host/protocolo; política robots conferida antes de cada host.
- Benchmark Mode para importação CSV/XLS/XLSX, comparação de cobertura, duplicidades, conflitos de valor, completude, aderência ao perfil, histórico idempotente por hash e exportação factual CSV.
- Perfil de dataset na prévia assistida: tipos, nulidade, unicidade, duplicatas, valores malformados, exemplos normalizados e candidatos a identificadores.
- `Nº Processo DEPRE` é identificador primário separado de precatório, EP/ES, processo originário e referência DEPRE; aparece na lista, ficha, resumo operacional, evidência e matching/relatório Benchmark.
- A importação CAC preserva checksum/nome do arquivo original, sessão assistida e página/cartão nos valores brutos; a repetição do mesmo arquivo é idempotente.
- Testes unitários para allowlist de links, hash/mudança e robots.

## Ainda não implementado (não declarar CP 2.3 completo)

- Coleta unattended e geração automatizada do relatório continuam indisponíveis por CAPTCHA. O parsing do relatório oficial assistido funciona; a criação de leads reais pelo tenant autenticado e a revalidação posterior ainda não foram demonstradas nesta sessão.
- Agendamento recorrente: não há serviço/cron definido no projeto nem no contexto do deploy.
- Snapshot por credor, reconciliação, frescor por fonte, atualização/qualificação automática de leads e mudanças de campo.
- Benchmark Mode está funcional para comparação resumida, mas ainda não mantém evidência campo a campo da saída externa nem compara frescor da fonte (quando o arquivo não traz coleta/publicação confiável).
- Retry por fonte, cancelamento, filtros/paginação para 100k+, integração e E2E completos da aquisição.

## Verificações executadas

- TypeScript: `npx tsc --noEmit --pretty false` — passou.
- Lint: `npm run lint` — passou, sem erros ou avisos.
- Testes unitários: `npm test -- --run` — 20 arquivos, 53 testes passaram.
- Build: `npm run build` — passou; rotas `/api/capture/sources`, `/api/capture/benchmark` e `/api/capture/import-cac` incluídas.
- Dependências de produção: `npm audit --omit=dev` — zero vulnerabilidades.
- E2E: `npx playwright test e2e/lead-center.spec.ts` — passou, 1 jornada Chromium com upload CSV/XLSX, conflito, PDF de documento, ZIP CAC sintético, exibição DEPRE/EP/ES, reimportação idempotente, conversão e viewport móvel. A fixture CAC é sintética e não conta como ingestão de dados oficiais.
- Smoke real isolado: `npm run source:check` — 7 URLs; seis páginas oficiais responderam HTTP 200 e foram salvos snapshots de catálogo; e-SAJ falhou fechado porque `robots.txt` não pôde ser confirmado; execução `PARTIAL`, nenhum lead descoberto. Usou banco em memória, sem alterar dados CP.

## Evidência de fonte

O portal [TJSP Credores](https://www.tjsp.jus.br/Precatorios/Precatorios/Credores) organiza links para lista geral, listas pendentes, mapas, pesquisa e valores. A [Lista Geral](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral) apresenta categorias por devedor/entidade, não um conjunto universal de registros diretamente no HTML consultado. A página [TJSP Pendentes](https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes) publica destinos separados. O monitor não interpreta estes portais como feed estruturado de credores.

O arquivo [robots.txt do TJSP](https://www.tjsp.jus.br/robots.txt) define restrições para alguns caminhos. O adaptador verifica `robots.txt` no momento da coleta e falha fechado para políticas inacessíveis ou caminhos desautorizados.

No smoke test de 27/09/2026, as seis páginas `www.tjsp.jus.br` / `portal.tjsp.jus.br` configuradas responderam HTTP 200. Para `esaj.tjsp.jus.br`, o smoke test não conseguiu ler `robots.txt`; o adaptador não tentou consultar a página e reportou falha assistida.
