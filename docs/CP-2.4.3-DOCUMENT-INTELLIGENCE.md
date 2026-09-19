# CP 2.4.3 — Document Intelligence & Evidence Engine

## Objetivo

Transformar os documentos anexados ao CP em evidências rastreáveis e estruturadas, integrando a validação determinística de PDF com recursos de análise inteligente assistida por IA local, garantindo que "A IA encontra, o CP valida e o Humano decide".

## Componentes

### 1. Motor de Evidências (Document Evidence Engine)
- **`src/lib/ai/document-evidence-engine.ts`**
- **Busca Determinística e Proteção:** Implementa busca determinística, com prioridade de exatidão.
- **Proteção do Advogado:** Garante que o advogado (`ADVOGADO|PROCURADOR|OAB`) nunca seja sugerido como credor pelo sistema.
- **Indicadores de Qualidade e Cobertura:** Cada busca informa a página, confiança, força da evidência (EXPLICIT, STRONG_CONTEXT) e cobertura de busca (`100% páginas analisadas`).

### 2. Rotas de API
- **`POST /api/ai/documents/search`**: Executa a busca baseada no motor de evidências extraindo texto direto do SQLite de maneira determinística, e devolve as correspondências exatas/parciais do termo buscado ou indícios estruturais (sucessão, cessão).
- **`POST /api/ai/documents/compare`**: Avalia dois documentos extraindo seus números (ex: Processo DEPRE e Valor), detectando diferenças críticas.

### 3. Viewer Integrado (UI)
- **`src/app/workspace/document-intelligence-viewer.tsx`**
- Injetado nativamente na aba "Documentos" do Lead Center (`src/app/workspace/documents.tsx`).
- Permite pesquisa determinística do conteúdo do documento.
- Informa os acertos classificados por "Exato" ou "Parcial" com o score da confiança, exibindo um fragmento contextual para rápida localização sem necessidade de ler todo o PDF.
- Acesso à página original com o clique (Deep link `?id=X#page=Y`).

## Estratégia de Processamento

A aplicação lê os arquivos em quarentena do SQLite e extrai as páginas de texto *on the fly* (ou cache via BD). O `Document Evidence Engine` cria o vetor em runtime (devido aos PDFs leves do MVP) com o motor regex/estrutural.
O LLM atua apenas via Copilot explícito (via Inteligência Panel), ou para insights avançados da mesma busca. Essa estratégia garante 0% de falsa alucinação nos termos exatos ou números.
