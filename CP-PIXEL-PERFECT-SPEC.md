# Central Precatórios — Redesign Pixel Perfect (Referência Oficial 6 Telas)

## 1. Visão Geral e Especificação Visual
A imagem de referência oficial (`media_1794059926358_a741ac7f.jpg`) define um padrão SaaS Corporativo Financeiro de altíssimo padrão com 6 telas interligadas pela mesma Sidebar e Topo:

- **Sidebar (Menu Lateral):**
  - Fundo azul-marinho profundo (`#081726` / `#0B1F33`)
  - Identificação institucional no topo: Logo oficial CP em dourado + tipografia limpa "Central Precatórios"
  - Itens de menu com ícone + label:
    1. **Início** (ícone Home/LayoutDashboard)
    2. **Fila DEPRE** (ícone ListOrdered/Table)
    3. **Operações & CRM** (ícone Briefcase/Users)
    4. **Configurações** (ícone Settings)
    5. **Relatórios** (ícone BarChart3/TrendingUp)
    6. **Suporte** (ícone HelpCircle/LifeBuoy)
  - Item ativo destacado em dourado âmbar suave com cantos arredondados (`background: #E8AA42`, texto `#081726`, ou variante idêntica ao design da referência).
  - Rodapé da sidebar: Identificação do usuário institucional com avatar CP e tag de Administrador.

- **Header / Topo:**
  - Saudação e contexto operacional.
  - Notificações (ícone sino com badge).
  - Data atual formatada (ex: `07 de Novembro de 2026`).

- **As 6 Telas Individuais:**
  - **Tela 1 — Dashboard / Início:** 4 KPI cards superiores (Total na Fila, Em Análise, Aguardando, Exportadas), Gráfico de Evolução Mensal (Área/Linha dupla), Gráfico Donut "Por Órgão" (42% TJSP, 28% TRF-3, 20% TST, 10% Outros), Bloco de Atalhos Rápidos, Card promocional inferior institucional ("Seu trabalho mais eficiente com o Central Precatórios").
  - **Tela 2 — Fila DEPRE:** Título e descrição, botões Filtros e Exportar CSV (dourado), Filtros horizontais (Todos os Processos, Órgãos, Status, Busca por nome/processo), Tabela executiva DEPRE completa com badges coloridos (Em Análise, Aguardando, Exportada, Livre), Ações (Ver dossiê/ações rápidas/copiar), Paginação inferior.
  - **Tela 3 — Operações & CRM:** Cabeçalho com Exportar Relatório e + Novo Cliente (dourado), 3 Cards métricos (Clientes Ativos, Operações em Andamento, Conversões), Tabs (Clientes, Operações, Histórico), Tabela de CRM e Funil de Vendas vertical à direita com etapas (Leads, Em Contato, Propostas, Fechados).
  - **Tela 4 — Configurações:** Título e botão dourado "Salvar Alterações", Tabs (Geral, Integrações, Notificações, Permissões, API), Card "Dados da Empresa" (Nome da Empresa, CNPJ, E-mail) e Card "Preferências do Sistema" com toggles ativos (Notificações por e-mail, Alertas no WhatsApp, Modo Escuro).
  - **Tela 5 — Relatórios:** Cabeçalho com seleção de período, órgão e botão "Gerar Relatório", 4 Cards métricos (Processos Processados, Valor Movimentado, Taxa de Conversão, Tempo Médio), Gráfico de Barras duplo de Desempenho Geral por mês, Lista de Relatórios Disponíveis para download imediato.
  - **Tela 6 — Suporte:** Cabeçalho com botão "Abrir Chamado", 4 Cards de canais de atendimento (Central de Ajuda, Fale Conosco, Status do Sistema, FAQ) com ícones e links, Seção "Seus Chamados" com tabela de protocolos e status.

## 2. Preservação Total do Sistema
- Banco de dados LibSQL/Turso e operações mantidas.
- Fila safra 26k (26.969 precatórios reais auditados) continua alimentando a Fila DEPRE.
- Copiar WhatsApp, gerar dossiê PDF e links do TJSP e-SAJ 100% preservados.
- Nenhuma funcionalidade é removida; todas as 6 vistas recebem o acabamento pixel-perfect da referência.
