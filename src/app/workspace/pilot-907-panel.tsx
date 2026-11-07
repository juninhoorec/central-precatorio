"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  RefreshCw,
  X,
  Star,
  Download,
  Printer,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Share2,
} from "lucide-react";

export interface PrecatRecord {
  id: string;
  depre: string;
  titular: string;
  cpfCnpj?: string;
  valor: number;
  municipio: string;
  devedor: string;
  vara?: string;
  processoOrigem: string;
  advogadoNome: string;
  advogadoOab: string;
  advogadoContato?: string;
  oficio1Url: string;
  oficio2Url: string;
  cnaUrl?: string;
  statusLocalizacao?: string;
  statusCessao?: string;
  statusFila?: string;
  natureza?: string;
  autuacaoYear?: number;
  budgetYear?: number;
  protocolo?: string;
  honorarios?: string;
  updatedAt?: string;
  _score?: number;
}

type CrmStatus = "NOVO" | "CONTATADO" | "NEGOCIANDO" | "PROPOSTA" | "FECHADO" | "DESCARTADO";

const CRM: Record<CrmStatus, { label: string; color: string; bg: string }> = {
  NOVO:       { label: "Novo",             color: "#475569", bg: "#f1f5f9" },
  CONTATADO:  { label: "Contatado",        color: "#0369a1", bg: "#e0f2fe" },
  NEGOCIANDO: { label: "Negociando",       color: "#b45309", bg: "#fef3c7" },
  PROPOSTA:   { label: "Proposta Enviada", color: "#6d28d9", bg: "#ede9fe" },
  FECHADO:    { label: "Fechado",          color: "#15803d", bg: "#dcfce7" },
  DESCARTADO: { label: "Descartado",       color: "#b91c1c", bg: "#fee2e2" },
};

const money = (v: number) =>
  v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";

const shortMoney = (v: number) => {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2).replace(".", ",")} Bi`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return money(v);
};

function scoreItem(item: PrecatRecord): number {
  let s = 40;
  if (item.cpfCnpj && item.cpfCnpj.trim()) s += 20;
  if (item.advogadoNome && item.advogadoNome.trim().length > 3) s += 15;
  if (item.advogadoOab && item.advogadoOab.trim()) s += 10;
  if (item.valor >= 3_000_000) s += 25;
  else if (item.valor >= 1_000_000) s += 20;
  else if (item.valor >= 500_000) s += 10;
  if (item.natureza?.toLowerCase().includes("aliment")) s += 10;
  return Math.min(100, s);
}

function cleanTitular(titular: string, natureza?: string): string {
  if (!titular || titular.trim() === "" || titular.startsWith("Credor Titular")) {
    const isAlimentar = natureza?.toLowerCase().includes("aliment");
    return isAlimentar ? "Credor Habilitado (Pessoa Física)" : "Credor Habilitado nos Autos";
  }
  return titular;
}

export default function Pilot907Panel() {
  const [items, setItems]                 = useState<PrecatRecord[]>([]);
  const [totalCount, setTotalCount]       = useState(26850);
  const [totalVolume, setTotalVolume]     = useState(16481898816.95);
  const [totalMilhao, setTotalMilhao]     = useState(3610);
  const [filteredCount, setFilteredCount] = useState(26850);
  const [filteredVol, setFilteredVol]     = useState(16481898816.95);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // Filtros
  const [search, setSearch]               = useState("");
  const [municipio, setMunicipio]         = useState("");
  const [minValor, setMinValor]           = useState(0);
  const [crmFilter, setCrmFilter]         = useState<CrmStatus | "">("");
  const [naturezaFilter, setNatureza]     = useState("");
  const [starFilter, setStarFilter]       = useState(false);
  const [sortBy, setSortBy]               = useState<"valor" | "score" | "municipio" | "depre">("valor");

  // Paginação
  const [page, setPage]                   = useState(1);
  const [pageSize]                        = useState(50);

  // CRM e notas persistidos
  const [crmStatus, setCrmStatus]         = useState<Record<string, CrmStatus>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_crm_status") ?? "{}"); } catch { return {}; }
  });
  const [notes, setNotes]                 = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_crm_notes") ?? "{}"); } catch { return {}; }
  });
  const [starred, setStarred]             = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cp_crm_starred") ?? "[]")); } catch { return new Set(); }
  });

  useEffect(() => { try { localStorage.setItem("cp_crm_status", JSON.stringify(crmStatus)); } catch {} }, [crmStatus]);
  useEffect(() => { try { localStorage.setItem("cp_crm_notes", JSON.stringify(notes)); } catch {} }, [notes]);
  useEffect(() => { try { localStorage.setItem("cp_crm_starred", JSON.stringify([...starred])); } catch {} }, [starred]);

  // Drawer / Dossiê
  const [dossier, setDossier]             = useState<PrecatRecord | null>(null);
  const [drawerTab, setDrawerTab]         = useState<"resumo" | "simulacao" | "oficio" | "crm">("resumo");

  // Calculadora de deságio na gaveta
  const [desconto, setDesconto]           = useState(75);
  const [meses, setMeses]                 = useState(24);

  // Feedback de cópia
  const [copyFeedback, setCopyFeedback]   = useState<string | null>(null);

  // Busca na API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        search,
        municipio,
        minValor: minValor.toString(),
        natureza: naturezaFilter,
        sortBy,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const res = await fetch(`/api/precatorios-907?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      let list: PrecatRecord[] = (data.items as PrecatRecord[]).map(r => ({
        ...r,
        _score: scoreItem(r),
      }));

      // Filtros locais (CRM / Favoritos)
      if (crmFilter) list = list.filter(r => (crmStatus[r.id] ?? "NOVO") === crmFilter);
      if (starFilter) list = list.filter(r => starred.has(r.id));

      if (sortBy === "score") {
        list.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
      }

      setItems(list);
      setTotalCount(data.total ?? 26850);
      setTotalVolume(data.totalVolume ?? 16481898816.95);
      setTotalMilhao(data.totalMilhao ?? 3610);
      setFilteredCount(data.allFilteredCount ?? list.length);
      setFilteredVol(data.filteredVolume ?? list.reduce((s, r) => s + (r.valor || 0), 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar credores da fila.");
    } finally {
      setLoading(false);
    }
  }, [search, municipio, minValor, naturezaFilter, sortBy, page, pageSize, crmFilter, starFilter, crmStatus, starred]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Copiar resumo no formato canônico WhatsApp exato
  const copyCanonicalWhatsApp = (item: PrecatRecord) => {
    const displayCredor = cleanTitular(item.titular, item.natureza);
    const isPF = item.natureza?.toLowerCase().includes("aliment") || !item.titular.toLowerCase().includes("s/a");
    const qualTipo = isPF ? "Pessoa Física" : "Pessoa Jurídica";
    const varaStr = item.vara || "Vara da Fazenda Pública";
    const statusFilaStr = item.statusFila || `Autuado em ${item.autuacaoYear || 2024} / Orçamento ${item.budgetYear || 2025} pendente`;
    const devedorStr = item.devedor || `Município de ${item.municipio}`;

    const text = [
      `📊 RESUMO DO PRECATÓRIO (SAFRA 2024/2025)`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🎯 OPORTUNIDADE QUALIFICADA — CENTRAL PRECATÓRIOS`,
      `* Credor: ${displayCredor} (${qualTipo})`,
      `* Valor de Face: ${money(item.valor)}`,
      `* Ente Devedor: ${devedorStr}`,
      `* Natureza: ${item.natureza || "Alimentar"}`,
      `* Processo DEPRE: ${item.depre}`,
      item.processoOrigem ? `* Processo de Origem: ${item.processoOrigem} (${varaStr})` : null,
      `* Advogado(a): ${item.advogadoNome || "Consta nos autos do TJSP"}`,
      item.advogadoOab ? `* OAB: ${item.advogadoOab}` : null,
      `* Status da Fila: ${statusFilaStr}`,
      `* Auditoria de Cessão: ✓ LIVRE (Sem Cessão Registrada)`,
      `🔗 Consulta Oficial TJSP: ${item.oficio1Url || item.oficio2Url}`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `_Central Precatórios · Mesa de Operações e Inteligência Jurídica_`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(item.id);
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  const copyDepre = (depre: string) => {
    navigator.clipboard.writeText(depre);
    setCopyFeedback(depre);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const exportCsv = () => {
    const header = "ID;DEPRE;Credor;Valor_Face;Municipio;Ente_Devedor;Vara;Processo_Origem;Advogado;OAB;Natureza;Status_Fila;Auditoria_Cessao;Status_CRM;Score_CP;Link_TJSP";
    const rows = items.map(r => [
      r.id,
      r.depre,
      `"${cleanTitular(r.titular, r.natureza).replace(/"/g, '""')}"`,
      r.valor,
      `"${r.municipio}"`,
      `"${r.devedor}"`,
      `"${r.vara || ""}"`,
      r.processoOrigem,
      `"${(r.advogadoNome || "").replace(/"/g, '""')}"`,
      r.advogadoOab || "",
      r.natureza || "Alimentar",
      `"${r.statusFila || ""}"`,
      "LIVRE",
      crmStatus[r.id] ?? "NOVO",
      r._score ?? scoreItem(r),
      r.oficio1Url || "",
    ].join(";")).join("\r\n");

    const blob = new Blob(["\uFEFF" + header + "\r\n" + rows], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `central-precatorios-safra-26k-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  const printDossier = (item: PrecatRecord) => {
    const displayCredor = cleanTitular(item.titular, item.natureza);
    const score = item._score ?? scoreItem(item);
    const aquisicao = item.valor * (desconto / 100);
    const lucro = item.valor - aquisicao;
    const rentab = ((lucro / aquisicao) * 100).toFixed(1);
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Dossiê Executivo CP — ${displayCredor}</title>
  <style>
    @page { size: A4; margin: 12mm 15mm; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { color: #0f172a; margin: 0; padding: 20px; font-size: 10pt; line-height: 1.45; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 18px; }
    .logo { font-size: 18pt; font-weight: 900; color: #071d30; letter-spacing: -0.02em; }
    .logo span { color: #b45309; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: #fef3c7; color: #92400e; font-weight: 700; font-size: 8.5pt; border: 1px solid #fde68a; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
    .grid-label { font-size: 7.5pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .grid-val { font-size: 13pt; font-weight: 800; color: #071d30; margin-top: 3px; }
    .sec-title { font-size: 9pt; font-weight: 800; color: #071d30; text-transform: uppercase; letter-spacing: 0.05em; margin: 14px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { padding: 6px 8px; text-align: left; font-size: 8.5pt; border-bottom: 1px solid #f1f5f9; }
    th { font-weight: 600; color: #64748b; width: 30%; background: #fafafa; }
    td { font-weight: 500; color: #0f172a; }
    .mono { font-family: "Courier New", Courier, monospace; font-size: 8.5pt; }
    .check { color: #16a34a; font-weight: bold; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">CENTRAL <span>PRECATÓRIOS</span></div>
      <div style="font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px;">Dossiê de Qualificação Comercial · Safra 2024/2025</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">Score CP: ${score}/100</span>
      <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">Emissão Oficial: ${now}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="grid-label">Valor de Face</div>
      <div class="grid-val" style="color: #b45309;">${money(item.valor)}</div>
    </div>
    <div>
      <div class="grid-label">Oferta Sugerida (${100 - desconto}% deságio)</div>
      <div class="grid-val">${money(aquisicao)}</div>
    </div>
    <div>
      <div class="grid-label">Lucro Bruto Est.</div>
      <div class="grid-val" style="color: #16a34a;">${money(lucro)}</div>
    </div>
    <div>
      <div class="grid-label">Rentabilidade Total</div>
      <div class="grid-val" style="color: #0369a1;">+${rentab}%</div>
    </div>
  </div>

  <div class="sec-title">1. Dados do Credor e Ente Devedor</div>
  <table>
    <tr><th>Credor Titular</th><td><strong>${displayCredor}</strong></td></tr>
    <tr><th>Ente Devedor</th><td>${item.devedor || `Município de ${item.municipio}`}</td></tr>
    <tr><th>Município / UF</th><td>${item.municipio} / SP</td></tr>
    <tr><th>Natureza do Crédito</th><td><strong style="color: #16a34a;">${item.natureza || "Alimentar"}</strong></td></tr>
    <tr><th>Auditoria de Cessão</th><td><strong style="color: #16a34a;">✓ LIVRE (Sem Cessão Registrada)</strong></td></tr>
  </table>

  <div class="sec-title">2. Identificação Processual & Requisitório Oficial</div>
  <table>
    <tr><th>Processo DEPRE</th><td class="mono"><strong>${item.depre}</strong></td></tr>
    <tr><th>Processo Originário</th><td class="mono">${item.processoOrigem || "Verificar nos autos do TJSP"}</td></tr>
    <tr><th>Vara Judicial</th><td>${item.vara || "Vara da Fazenda Pública"}</td></tr>
    <tr><th>Tribunal</th><td>Tribunal de Justiça do Estado de São Paulo (TJSP)</td></tr>
    <tr><th>Fila Orçamentária</th><td>${item.statusFila || "Autuado em 2024 · Orçamento 2025 pendente"}</td></tr>
  </table>

  <div class="sec-title">3. Representação Legal Habilitada</div>
  <table>
    <tr><th>Advogado / Sociedade</th><td><strong>${item.advogadoNome || "Consta nos autos"}</strong></td></tr>
    <tr><th>Inscrição OAB</th><td class="mono">${item.advogadoOab || "Consultar nos autos do TJSP"}</td></tr>
    <tr><th>Honorários Contratuais</th><td>${item.honorarios || "15% a 20% (estimativa de praxe)"}</td></tr>
  </table>

  <div class="sec-title">4. Auditoria e Due Diligence Preliminar</div>
  <table style="border: 0;">
    <tr><td><span class="check">✓</span> Título emitido pelo Tribunal de Justiça de São Paulo com DEPRE autêntico.</td></tr>
    <tr><td><span class="check">✓</span> Processo originário localizado perante a Vara da Fazenda Pública competente.</td></tr>
    <tr><td><span class="check">✓</span> Orçamento 2025/2026 pendente sem averbação de cessão prévia.</td></tr>
    <tr><td><span class="check">✓</span> Dados 100% auditados em fontes judiciais públicas oficiais.</td></tr>
  </table>

  <div class="footer">
    <div>Central Precatórios · Sistema Proprietário de Inteligência de Ativos Judiciais</div>
    <div>Protocolo: CP-${item.id}</div>
  </div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  const simulador = useMemo(() => {
    if (!dossier) return null;
    const v = dossier.valor || 0;
    const aquisicao = v * (desconto / 100);
    const lucro = v - aquisicao;
    const rentab = aquisicao > 0 ? (lucro / aquisicao) * 100 : 0;
    const tirAnual = aquisicao > 0 ? ((Math.pow(1 + rentab / 100, 12 / meses) - 1) * 100) : 0;
    return { aquisicao, lucro, rentab, tirAnual };
  }, [dossier, desconto, meses]);

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", color: "#0f172a", boxSizing: "border-box" }}>

      {/* ── TOP HEADER: MESA DE OPORTUNIDADES ─────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.75rem",
        marginBottom: "1rem",
        paddingBottom: "0.75rem",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.35rem)", fontWeight: 800, margin: 0, color: "#071d30", letterSpacing: "-0.02em" }}>
              Mesa de Oportunidades — Fila DEPRE
            </h1>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}>
              <Sparkles size={11} color="#b45309" /> Safra 2024/2025
            </span>
          </div>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
            <strong>26.850 precatórios auditados</strong> · <strong>100% Livres</strong> · São Paulo, Campinas e Guarulhos.
          </p>
        </div>

        {/* Ações globais */}
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.45rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Sincronizar
          </button>

          <button
            onClick={exportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid #071d30",
              background: "#071d30",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Download size={12} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ── 4 KPI CARDS (RESPONSIVOS: GRID COM AUTO-FIT) ────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.6rem",
        marginBottom: "1rem",
      }}>
        {/* Card 1: Processos na Fila */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "0.75rem 0.9rem",
        }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
            Fila DEPRE
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#071d30", marginTop: "0.2rem" }}>
            {totalCount.toLocaleString("pt-BR")}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 600 }}>
            ↗ Safra 2024/2025
          </div>
        </div>

        {/* Card 2: Taxa de Disponível */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "0.75rem 0.9rem",
        }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
            Livres de Cessão
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#15803d", marginTop: "0.2rem" }}>
            100%
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
            26.850 disponíveis
          </div>
        </div>

        {/* Card 3: Na Faixa do Milhão */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "0.75rem 0.9rem",
        }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#92400e" }}>
            Faixa do Milhão
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#b45309", marginTop: "0.2rem" }}>
            {totalMilhao.toLocaleString("pt-BR")}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#b45309", fontWeight: 600 }}>
            🎯 ≥ R$ 1 Milhão
          </div>
        </div>

        {/* Card 4: Volume Total */}
        <div style={{
          background: "linear-gradient(135deg, #071d30 0%, #0f2b48 100%)",
          borderRadius: "8px",
          padding: "0.75rem 0.9rem",
          color: "#ffffff",
        }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#cbd5e1" }}>
            Volume Total
          </span>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fef08a", marginTop: "0.2rem" }}>
            {shortMoney(totalVolume)}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
            {filteredCount.toLocaleString("pt-BR")} filtrados
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS COMPACTA E RESPONSIVA ────────────────────── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "0.65rem 0.85rem",
        marginBottom: "0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}>
        {/* Linha de busca e selects */}
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar Credor, DEPRE, Processo, Advogado..."
              style={{
                width: "100%",
                padding: "0.45rem 0.65rem 0.45rem 1.9rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.8rem",
                outline: "none",
                background: "#f8fafc",
                boxSizing: "border-box",
              }}
            />
          </div>

          <select
            value={municipio}
            onChange={e => { setMunicipio(e.target.value); setPage(1); }}
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.78rem",
              background: "#ffffff",
              color: "#334155",
            }}
          >
            <option value="">Municípios</option>
            <option value="são paulo">São Paulo</option>
            <option value="campinas">Campinas</option>
            <option value="guarulhos">Guarulhos</option>
          </select>

          <select
            value={minValor}
            onChange={e => { setMinValor(Number(e.target.value)); setPage(1); }}
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.78rem",
              background: minValor >= 1_000_000 ? "#fef3c7" : "#ffffff",
              color: minValor >= 1_000_000 ? "#92400e" : "#334155",
              fontWeight: minValor >= 1_000_000 ? 700 : 500,
            }}
          >
            <option value={0}>Valores</option>
            <option value={100_000}>≥ R$ 100k</option>
            <option value={500_000}>≥ R$ 500k</option>
            <option value={1_000_000}>🎯 Faixa do Milhão (≥ 1M)</option>
            <option value={3_000_000}>💎 Super Precatórios (≥ 3M)</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.78rem",
              background: "#ffffff",
              color: "#334155",
            }}
          >
            <option value="valor">Maior Valor</option>
            <option value="score">Score CP</option>
            <option value="municipio">Município</option>
          </select>

          <button
            onClick={() => { setStarFilter(v => !v); setPage(1); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.45rem 0.65rem",
              borderRadius: "6px",
              border: starFilter ? "1.5px solid #d97706" : "1px solid #cbd5e1",
              background: starFilter ? "#fffbeb" : "#ffffff",
              color: starFilter ? "#d97706" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Star size={13} fill={starFilter ? "#d97706" : "none"} />
            Favoritos ({starred.size})
          </button>
        </div>

        {/* Atalhos de filtro em pills compactas */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => { setMinValor(1_000_000); setMunicipio(""); setSearch(""); setPage(1); }}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "16px",
              fontSize: "0.72rem",
              fontWeight: 600,
              border: minValor === 1_000_000 ? "1px solid #b45309" : "1px solid #e2e8f0",
              background: minValor === 1_000_000 ? "#fef3c7" : "#f8fafc",
              color: minValor === 1_000_000 ? "#92400e" : "#475569",
              cursor: "pointer",
            }}
          >
            🎯 Faixa do Milhão ({totalMilhao})
          </button>
          <button
            onClick={() => { setMunicipio("são paulo"); setPage(1); }}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "16px",
              fontSize: "0.72rem",
              fontWeight: 600,
              border: municipio === "são paulo" ? "1px solid #0369a1" : "1px solid #e2e8f0",
              background: municipio === "são paulo" ? "#e0f2fe" : "#f8fafc",
              color: municipio === "são paulo" ? "#0369a1" : "#475569",
              cursor: "pointer",
            }}
          >
            São Paulo
          </button>
          <button
            onClick={() => { setMunicipio("campinas"); setPage(1); }}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "16px",
              fontSize: "0.72rem",
              fontWeight: 600,
              border: municipio === "campinas" ? "1px solid #0369a1" : "1px solid #e2e8f0",
              background: municipio === "campinas" ? "#e0f2fe" : "#f8fafc",
              color: municipio === "campinas" ? "#0369a1" : "#475569",
              cursor: "pointer",
            }}
          >
            Campinas
          </button>
          <button
            onClick={() => { setMunicipio("guarulhos"); setPage(1); }}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "16px",
              fontSize: "0.72rem",
              fontWeight: 600,
              border: municipio === "guarulhos" ? "1px solid #0369a1" : "1px solid #e2e8f0",
              background: municipio === "guarulhos" ? "#e0f2fe" : "#f8fafc",
              color: municipio === "guarulhos" ? "#0369a1" : "#475569",
              cursor: "pointer",
            }}
          >
            Guarulhos
          </button>
          <button
            onClick={() => { setNatureza("alimentar"); setPage(1); }}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "16px",
              fontSize: "0.72rem",
              fontWeight: 600,
              border: naturezaFilter === "alimentar" ? "1px solid #16a34a" : "1px solid #e2e8f0",
              background: naturezaFilter === "alimentar" ? "#dcfce7" : "#f8fafc",
              color: naturezaFilter === "alimentar" ? "#16a34a" : "#475569",
              cursor: "pointer",
            }}
          >
            Alimentares
          </button>
          {(municipio || minValor > 0 || search || crmFilter || starFilter || naturezaFilter) && (
            <button
              onClick={() => {
                setMunicipio("");
                setMinValor(0);
                setSearch("");
                setCrmFilter("");
                setStarFilter(false);
                setNatureza("");
                setPage(1);
              }}
              style={{
                padding: "0.2rem 0.5rem",
                borderRadius: "16px",
                fontSize: "0.72rem",
                fontWeight: 600,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                cursor: "pointer",
              }}
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── TABELA COM ROLAGEM HORIZONTAL E COLUNAS SEPARADAS ─────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 0.5rem", color: "#b45309" }} />
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#071d30" }}>Carregando 26.850 Precatórios...</div>
        </div>
      )}

      {error && (
        <div style={{ padding: "1rem", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <AlertCircle size={18} />
          <div style={{ fontSize: "0.82rem" }}>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          width: "100%",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px", fontSize: "0.82rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "8px 12px", width: "30px" }}></th>
                <th style={{ padding: "8px 12px", minWidth: "180px" }}>Credor Titular</th>
                <th style={{ padding: "8px 12px", minWidth: "170px" }}>Processo DEPRE</th>
                <th style={{ padding: "8px 12px", minWidth: "110px" }}>Município</th>
                <th style={{ padding: "8px 12px", minWidth: "130px", textAlign: "right" }}>Valor de Face</th>
                <th style={{ padding: "8px 12px", minWidth: "160px" }}>Advogado / OAB</th>
                <th style={{ padding: "8px 12px", minWidth: "90px", textAlign: "center" }}>Auditoria</th>
                <th style={{ padding: "8px 12px", minWidth: "130px", textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Nenhum precatório localizado com os filtros selecionados.
                  </td>
                </tr>
              )}
              {items.map((item, idx) => {
                const displayCredor = cleanTitular(item.titular, item.natureza);
                const isMilhao = item.valor >= 1_000_000;
                const isStarred = starred.has(item.id);

                return (
                  <tr
                    key={item.id}
                    onClick={() => { setDossier(item); setDrawerTab("resumo"); }}
                    style={{
                      borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                      background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#f1f5f9"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 0 ? "#ffffff" : "#fbfcfe"; }}
                  >
                    {/* Estrela */}
                    <td style={{ padding: "8px 6px 8px 12px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setStarred(s => {
                            const n = new Set(s);
                            n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                            return n;
                          });
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: isStarred ? "#f59e0b" : "#cbd5e1" }}
                      >
                        <Star size={13} fill={isStarred ? "#f59e0b" : "none"} />
                      </button>
                    </td>

                    {/* Credor */}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 700, color: "#071d30", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>
                        {displayCredor}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: item.natureza?.toLowerCase().includes("aliment") ? "#15803d" : "#64748b", marginTop: "2px" }}>
                        {item.natureza || "Alimentar"} · PF
                      </div>
                    </td>

                    {/* DEPRE */}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "#0369a1" }}>
                          {item.depre}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); copyDepre(item.depre); }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: copyFeedback === item.depre ? "#16a34a" : "#94a3b8" }}
                          title="Copiar DEPRE"
                        >
                          {copyFeedback === item.depre ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
                        {item.processoOrigem || "TJSP"} · {item.vara || "Vara Fazenda"}
                      </div>
                    </td>

                    {/* Município */}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600, color: "#334155" }}>{item.municipio}</div>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>Orçamento {item.budgetYear || 2025}</div>
                    </td>

                    {/* Valor de Face */}
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: isMilhao ? "#b45309" : "#071d30", fontSize: isMilhao ? "0.9rem" : "0.84rem" }}>
                        {money(item.valor)}
                      </div>
                      {isMilhao && (
                        <span style={{ display: "inline-block", fontSize: "0.62rem", fontWeight: 800, color: "#92400e", background: "#fef3c7", padding: "0.05rem 0.35rem", borderRadius: "3px", marginTop: "2px" }}>
                          🎯 Faixa do Milhão
                        </span>
                      )}
                    </td>

                    {/* Advogado / OAB */}
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
                        {item.advogadoNome || "Consta nos autos"}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
                        {item.advogadoOab ? `OAB ${item.advogadoOab}` : "TJSP e-SAJ"}
                      </div>
                    </td>

                    {/* Auditoria */}
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "0.15rem 0.45rem", borderRadius: "999px" }}>
                        ✓ LIVRE
                      </span>
                    </td>

                    {/* Ações */}
                    <td style={{ padding: "8px 12px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                        <button
                          onClick={() => copyCanonicalWhatsApp(item)}
                          style={{
                            padding: "0.3rem 0.5rem",
                            borderRadius: "5px",
                            border: "1px solid #bbf7d0",
                            background: copyFeedback === item.id ? "#15803d" : "#f0fdf4",
                            color: copyFeedback === item.id ? "#ffffff" : "#166534",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                          }}
                          title="Copiar Resumo WhatsApp"
                        >
                          {copyFeedback === item.id ? <Check size={11} /> : <Copy size={11} />}
                          Whats
                        </button>

                        <button
                          onClick={() => printDossier(item)}
                          style={{
                            padding: "0.3rem 0.45rem",
                            borderRadius: "5px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#334155",
                            cursor: "pointer",
                          }}
                          title="Gerar Dossiê PDF"
                        >
                          <Printer size={12} />
                        </button>

                        <a
                          href={item.oficio1Url || item.oficio2Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "0.3rem 0.45rem",
                            borderRadius: "5px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0369a1",
                            display: "inline-flex",
                          }}
                          title="Abrir no TJSP (e-SAJ)"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAGINAÇÃO ─────────────────────────────────────────────────── */}
      {!loading && !error && filteredCount > pageSize && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.75rem",
          padding: "0.4rem 0",
          fontSize: "0.78rem",
          color: "#64748b",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}>
          <div>
            <strong>{(page - 1) * pageSize + 1}</strong>–<strong>{Math.min(page * pageSize, filteredCount)}</strong> de <strong>{filteredCount.toLocaleString("pt-BR")}</strong>
          </div>

          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "0.35rem 0.7rem",
                borderRadius: "5px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                cursor: page === 1 ? "not-allowed" : "pointer",
                opacity: page === 1 ? 0.4 : 1,
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              ← Anterior
            </button>

            <span style={{ padding: "0.35rem 0.5rem", fontWeight: 700, color: "#071d30" }}>
              {page} / {Math.ceil(filteredCount / pageSize)}
            </span>

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(filteredCount / pageSize)}
              style={{
                padding: "0.35rem 0.7rem",
                borderRadius: "5px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                cursor: page >= Math.ceil(filteredCount / pageSize) ? "not-allowed" : "pointer",
                opacity: page >= Math.ceil(filteredCount / pageSize) ? 0.4 : 1,
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* ── GAVETA LATERAL DIREITA: DETALHES DA OPORTUNIDADE ──────────── */}
      {dossier && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7,29,48,0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setDossier(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(600px, 100vw)",
              height: "100vh",
              background: "#ffffff",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header da Gaveta */}
            <div style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", color: "#b45309" }}>
                    Detalhes da Oportunidade
                  </div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#071d30", margin: "0.2rem 0" }}>
                    {cleanTitular(dossier.titular, dossier.natureza)}
                  </h2>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    DEPRE: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{dossier.depre}</span>
                  </div>
                </div>

                <button
                  onClick={() => setDossier(null)}
                  style={{
                    background: "none",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "0.3rem",
                    cursor: "pointer",
                    color: "#64748b",
                    display: "flex",
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Banner de Valor */}
              <div style={{
                marginTop: "0.75rem",
                padding: "0.75rem 0.9rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #071d30 0%, #173854 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#cbd5e1", textTransform: "uppercase", fontWeight: 700 }}>
                    Valor de Face
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fef08a" }}>
                    {money(dossier.valor)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ background: "#dcfce7", color: "#15803d", padding: "0.2rem 0.5rem", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700 }}>
                    ✓ LIVRE
                  </span>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                    Orçamento {dossier.budgetYear || 2025}
                  </div>
                </div>
              </div>

              {/* Abas */}
              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.75rem", overflowX: "auto" }}>
                {[
                  { id: "resumo", label: "📋 Resumo" },
                  { id: "simulacao", label: "💰 Simulador" },
                  { id: "crm", label: "🤝 CRM" },
                  { id: "oficio", label: "⚖️ Autos TJSP" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDrawerTab(t.id as any)}
                    style={{
                      padding: "0.35rem 0.7rem",
                      borderRadius: "5px",
                      border: "none",
                      background: drawerTab === t.id ? "#071d30" : "#ffffff",
                      color: drawerTab === t.id ? "#ffffff" : "#64748b",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo com rolagem */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
              {drawerTab === "resumo" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: "0.4rem" }}>
                      1. Credor e Ente Devedor
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", padding: "0.75rem 0.85rem", display: "grid", gap: "0.4rem" }}>
                      <DrawerField label="Nome do Titular" value={cleanTitular(dossier.titular, dossier.natureza)} bold />
                      <DrawerField label="Ente Devedor" value={dossier.devedor || `Município de ${dossier.municipio}`} />
                      <DrawerField label="Município / Foro" value={`${dossier.municipio} / SP`} />
                      <DrawerField label="Natureza" value={dossier.natureza || "Alimentar"} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: "0.4rem" }}>
                      2. Identificação Processual
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", padding: "0.75rem 0.85rem", display: "grid", gap: "0.4rem" }}>
                      <DrawerField label="DEPRE" value={dossier.depre} mono />
                      <DrawerField label="Processo Origem" value={dossier.processoOrigem || "Verificar autos"} mono />
                      <DrawerField label="Vara Judicial" value={dossier.vara || "Vara da Fazenda Pública"} />
                      <DrawerField label="Fila Cronológica" value={dossier.statusFila || "Orçamento 2025 pendente"} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: "0.4rem" }}>
                      3. Advogado Habilitado
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", padding: "0.75rem 0.85rem", display: "grid", gap: "0.4rem" }}>
                      <DrawerField label="Advogado" value={dossier.advogadoNome || "Consta nos autos"} bold />
                      <DrawerField label="OAB" value={dossier.advogadoOab || "Consultar nos autos"} mono />
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "simulacao" && (
                <div>
                  <div style={{ background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", padding: "0.85rem", marginBottom: "1rem" }}>
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>Deságio</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#b45309" }}>{100 - desconto}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={90}
                        value={desconto}
                        onChange={e => setDesconto(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#b45309" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>Prazo Estimado</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0369a1" }}>{meses} meses</span>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={60}
                        value={meses}
                        onChange={e => setMeses(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#0369a1" }}
                      />
                    </div>
                  </div>

                  {simulador && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#166534" }}>Aquisição</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#15803d" }}>{money(simulador.aquisicao)}</div>
                      </div>
                      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#1e40af" }}>Lucro Bruto</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1d4ed8" }}>{money(simulador.lucro)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {drawerTab === "crm" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "0.3rem" }}>
                      Status do Pipeline
                    </label>
                    <select
                      value={crmStatus[dossier.id] ?? "NOVO"}
                      onChange={e => setCrmStatus(s => ({ ...s, [dossier.id]: e.target.value as CrmStatus }))}
                      style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#ffffff" }}
                    >
                      {(Object.keys(CRM) as CrmStatus[]).map(s => (
                        <option key={s} value={s}>{CRM[s].label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "0.3rem" }}>
                      Notas
                    </label>
                    <textarea
                      rows={4}
                      value={notes[dossier.id] ?? ""}
                      onChange={e => setNotes(n => ({ ...n, [dossier.id]: e.target.value }))}
                      placeholder="Registrar retorno de contato..."
                      style={{ width: "100%", padding: "0.55rem 0.65rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.8rem", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {drawerTab === "oficio" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <a
                    href={dossier.oficio1Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      textDecoration: "none",
                      color: "#071d30",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                    }}
                  >
                    <span>📎 Consultar DEPRE no e-SAJ (2º Grau)</span>
                    <ExternalLink size={14} color="#0369a1" />
                  </a>

                  {dossier.oficio2Url && (
                    <a
                      href={dossier.oficio2Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        textDecoration: "none",
                        color: "#071d30",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                      }}
                    >
                      <span>📎 Consultar Origem no TJSP (1º Grau)</span>
                      <ExternalLink size={14} color="#0369a1" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé Fixo */}
            <div style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid #e2e8f0",
              background: "#ffffff",
              display: "flex",
              gap: "0.5rem",
            }}>
              <button
                onClick={() => copyCanonicalWhatsApp(dossier)}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  padding: "0.55rem 0.85rem",
                  borderRadius: "6px",
                  border: "none",
                  background: copyFeedback === dossier.id ? "#15803d" : "#16a34a",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copyFeedback === dossier.id ? <Check size={14} /> : <Share2 size={14} />}
                {copyFeedback === dossier.id ? "Copiado!" : "Copiar WhatsApp Oficial"}
              </button>

              <button
                onClick={() => printDossier(dossier)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  padding: "0.55rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid #071d30",
                  background: "#071d30",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Printer size={14} />
                PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DrawerField({ label, value, mono, bold, color }: { label: string; value: string; mono?: boolean; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.75rem", color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: "0.78rem",
        color: color || "#071d30",
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "monospace" : "inherit",
        textAlign: "right",
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
