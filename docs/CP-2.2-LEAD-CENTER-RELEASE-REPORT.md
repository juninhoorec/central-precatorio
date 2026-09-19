# CP 2.2 Lead Center — relatório de conclusão

## Resultado

O CP agora processa listas fornecidas pela equipe, organiza candidatos em fichas de operação e entrega evidências rastreáveis para triagem humana. A implementação atende o escopo incremental do CP 2.2 sem criar um CRM ou banco paralelo.

## Fluxo entregue

- Importa CSV e Excel (`.xls` e `.xlsx`), permite escolher a planilha, pré-visualizar e mapear colunas antes de gravar.
- Registra lote por organização com origem, arquivo, hash, horário, versão do parser, contagens, erros e URL de origem. Reimportação idêntica é idempotente; divergência crítica fica sinalizada para revisão.
- Mantém linhas originais e valores normalizados para rastrear cada candidato até a linha de origem.
- Preserva cadastros incompletos para revisão; separa RPV da fila de precatórios e do mínimo comercial de R$ 100 mil.
- Extrai texto de PDF sem OCR, registra página e evidência de cada campo, compara identificadores de processo, precatório, DEPRE e ofícios, e não substitui informação conflitante automaticamente.
- Faz busca TJSP pontual e acompanha histórico/saúde de fontes a partir de importações e buscas realizadas.
- Converte candidato em análise por ação explícita, verifica duplicidade, mantém o mesmo registro de operação e audita a transição.
- Mantém triagem, documentos, evidências e auditoria no CP multi-tenant já existente.
- Exibe estado, histórico e evidência em desktop e em viewport móvel.

## Verificações executadas

- TypeScript: `npx tsc --noEmit --pretty false` — passou.
- Testes unitários: `npm test -- --run` — 16 arquivos, 35 testes passaram.
- Lint: `npm run lint` — passou.
- Build de produção: `npm run build` — passou em Next.js 16.3.4.
- Auditoria das dependências de produção: `npm audit --omit=dev` — 0 vulnerabilidades.
- Jornada E2E: `npm run test:e2e` — passou, 1 jornada completa no Chromium; cobre cadastro, importação CSV/XLSX, conflito, histórico, saúde, análise de PDF, conversão e viewport móvel.

## Limites deliberados

- A descoberta de candidatos continua assistida por listas/consultas disponíveis; não foi criado crawler contínuo ou promessa de varredura integral do TJSP, TJs ou TRFs.
- A saúde da fonte descreve somente importações e buscas feitas pelo CP; não comprova disponibilidade ou completude do portal público.
- PDF é extraído por texto. PDF escaneado fica marcado como sem texto/OCR necessário e aguarda revisão; não há OCR ou IA inferindo credor, valor ou contato.
- Nome de credor e dados processuais são evidência para análise, não validação jurídica, intenção de venda ou contato confirmado. Telefone/e-mail não são inferidos.
- RPV permanece identificada e segregada para análise particular; não conta como precatório elegível ao corte comercial.
- Os dois documentos configurados são critérios internos de captação, não apresentados como exigência jurídica universal.

## Dados

Não foram criados leads reais durante a validação. A jornada E2E utiliza banco isolado, organização e usuário de teste próprios.
