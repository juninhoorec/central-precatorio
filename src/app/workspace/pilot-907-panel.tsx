"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search, ExternalLink, RefreshCw, FileText, Copy, Check,
  ChevronRight, ChevronDown, X, Calculator, MessageCircle,
  Star, StarOff, Clock, CheckCircle, PhoneCall, TrendingUp,
  Building, DollarSign, Scale, Sparkles, Download, UserCheck,
  ShieldCheck, AlertCircle, Eye, SlidersHorizontal
} from "lucide-react";
import styles from "./operations.module.css";
import { dataQuality, nextBestAction, priorityScore as intelligencePriority, slaState } from "@/lib/cp-intelligence";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface PrecatRecord {
  id: string;
  depre: string;
  titular: string;
  cpfCnpj?: string;
  valor: number;
  municipio: string;
  devedor: string;
  processoOrigem: string;
  advogadoNome: string;
  advogadoOab: string;
  advogadoContato: string;
  oficio1Url: string;
  oficio2Url: string;
  cnaUrl?: string;
  statusLocalizacao: "LOCALIZADO" | "PENDENTE" | "DISPONIVEL";
  prioridade: number;
  natureza?: string;
  honorarios?: string;
  updatedAt?: string;
}

type CrmStatus = "NOVO" | "CONTATADO" | "NEGOCIANDO" | "PROPOSTA" | "FECHADO" | "DESCARTADO";

const CRM_STATUS_CONFIG: Record<CrmStatus, { label: string; color: string; bg: string }> = {
  NOVO:        { label: "🆕 Novo",          color: "#64748b", bg: "#f8fafc" },
  CONTATADO:   { label: "📞 Contatado",      color: "#0369a1", bg: "#e0f2fe" },
  NEGOCIANDO:  { label: "💬 Negociando",     color: "#b45309", bg: "#fef3c7" },
  PROPOSTA:    { label: "📄 Proposta Enviada",color: "#7c3aed", bg: "#ede9fe" },
  FECHADO:     { label: "✅ Fechado",         color: "#166534", bg: "#dcfce7" },
  DESCARTADO:  { label: "🚫 Descartado",     color: "#dc2626", bg: "#fee2e2" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const money = (v: number) => v > 0
  ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  : "≥ R$ 100.000,00";

function scorePrioridade(item: PrecatRecord): number {
  return intelligencePriority(item);
}

function scoreLabel(s: number): { label: string; color: string } {
  if (s >= 80) return { label: "🔥 Altíssima", color: "#dc2626" };
  if (s >= 60) return { label: "⬆️ Alta",       color: "#d97706" };
  if (s >= 40) return { label: "➡️ Média",      color: "#0369a1" };
  return              { label: "⬇️ Baixa",      color: "#64748b" };
}

function buildOabSearchUrl(oab: string, nome: string): string {
  // Link direto de busca no CNA com OAB pré-preenchida
  const clean = oab.replace(/[^0-9A-Za-z/]/g, "");
  if (clean) return `https://cna.oab.org.br/#/consulta-advogado?nome=${encodeURIComponent(nome)}&uf=SP`;
  return `https://cna.oab.org.br/#/consulta-advogado?nome=${encodeURIComponent(nome)}`;
}

// ─── Componente Principal ─────────────────────────────────────────────────
export default function Pilot907Panel() {
  const [items, setItems]               = useState<PrecatRecord[]>([]);
  const [total, setTotal]               = useState(0);
  const [localizados, setLocalizados]   = useState(0);
  const [loading, setLoading]           = useState(true);
  const [copiedId, setCopiedId]         = useState<string | null>(null);

  // Filtros
  const [municipio, setMunicipio]       = useState("");
  const [minValor, setMinValor]         = useState(100000);
  const [searchTerm, setSearchTerm]     = useState("");
  const [sortBy, setSortBy]             = useState<"valor" | "prioridade" | "municipio">("prioridade");
  const [showFilters, setShowFilters]   = useState(false);

  // Estado CRM — persiste em localStorage
  const [crmStatus, setCrmStatus]       = useState<Record<string, CrmStatus>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_crm_status") ?? "{}"); } catch { return {}; }
  });
  const [notes, setNotes]               = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_crm_notes") ?? "{}"); } catch { return {}; }
  });
  const [starred, setStarred]           = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("cp_crm_starred") ?? "[]")); } catch { return new Set(); }
  });
  const [crmFilter, setCrmFilter]       = useState<CrmStatus | "">("");
  const [nextAction, setNextAction]     = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_next_action") ?? "{}"); } catch { return {}; }
  });
  const [history, setHistory]           = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("cp_case_history") ?? "{}"); } catch { return {}; }
  });

  // Persistir CRM no localStorage sempre que mudar
  useEffect(() => { try { localStorage.setItem("cp_crm_status", JSON.stringify(crmStatus)); } catch {} }, [crmStatus]);
  useEffect(() => { try { localStorage.setItem("cp_crm_notes", JSON.stringify(notes)); } catch {} }, [notes]);
  useEffect(() => { try { localStorage.setItem("cp_crm_starred", JSON.stringify([...starred])); } catch {} }, [starred]);
  useEffect(() => { try { localStorage.setItem("cp_next_action", JSON.stringify(nextAction)); } catch {} }, [nextAction]);
  useEffect(() => { try { localStorage.setItem("cp_case_history", JSON.stringify(history)); } catch {} }, [history]);

  // Gaveta de Detalhes
  const [drawer, setDrawer]             = useState<PrecatRecord | null>(null);
  const [drawerTab, setDrawerTab]       = useState<"info" | "oficio" | "calc">("info");

  // Busca de contato do advogado via CNA/OAB
  const [advContato, setAdvContato]     = useState<Record<string, unknown> | null>(null);
  const [advContatoLoading, setAdvContatoLoading] = useState(false);

  // Calculadora
  const [calcDesconto, setCalcDesconto] = useState(80);
  const [calcMeses, setCalcMeses]       = useState(24);

  // Paginação
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(50);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const recordHistory = (id: string, event: string) => {
    const stamp = new Date().toLocaleString("pt-BR");
    setHistory((h) => ({ ...h, [id]: [...(h[id] ?? []), `${stamp} — ${event}`].slice(-20) }));
  };
  const updateCrmStatus = (id: string, status: CrmStatus) => {
    setCrmStatus((s) => ({ ...s, [id]: status }));
    recordHistory(id, `Status alterado para ${CRM_STATUS_CONFIG[status].label}`);
  };
  const printDossier = (item: PrecatRecord) => {
    setDrawer(item); setDrawerTab("info");
    window.setTimeout(() => window.print(), 250);
  };
  const shareDossier = async (item: PrecatRecord) => {
    const text = `Dossiê Central Precatórios — DEPRE ${item.depre} — ${money(item.valor)} — ${item.municipio}`;
    const url = `${window.location.origin}/workspace#depre=${encodeURIComponent(item.depre)}`;
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setCopiedId(item.id); } catch { window.prompt("Link do dossiê", url); }
    recordHistory(item.id, "Dossiê compartilhado");
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        municipio,
        minValor: minValor.toString(),
        search: searchTerm,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      const res = await fetch(`/api/precatorios-907?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let list: PrecatRecord[] = (data.items as PrecatRecord[]).map((r) => ({
          ...r,
          _score: scorePrioridade(r),
        }));

        // Filtro CRM local
        if (crmFilter) {
          list = list.filter((r) => (crmStatus[r.id] ?? "NOVO") === crmFilter);
        }

        // Ordenação
        list.sort((a, b) => {
          if (sortBy === "valor") return b.valor - a.valor;
          if (sortBy === "municipio") return a.municipio.localeCompare(b.municipio);
          return scorePrioridade(b) - scorePrioridade(a);
        });

        setItems(list);
        setTotal(data.total);
        setLocalizados(data.localizados);
        setTotalFiltered(data.allFilteredCount || data.total);
      }
    } catch (e) {
      console.error("Erro ao buscar fila 907:", e);
    } finally {
      setLoading(false);
    }
  }, [municipio, minValor, searchTerm, sortBy, crmFilter, crmStatus, page, pageSize]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [fetchData]);

  // ─── Ações ──────────────────────────────────────────────────────────────
  const copyPitch = (item: PrecatRecord) => {
    const s = crmStatus[item.id] ?? "NOVO";
    const score = scorePrioridade(item);
    const text =
      `*CENTRAL PRECATÓRIOS — DOSSIÊ COMERCIAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Credor Titular:* ${item.titular}\n` +
      (item.cpfCnpj ? `• *Documento:* ${item.cpfCnpj}\n` : "") +
      `• *DEPRE:* ${item.depre}\n` +
      `• *Processo Origem:* ${item.processoOrigem || "Verificar nos autos"}\n` +
      `• *Valor Requisitado:* ${money(item.valor)}\n` +
      (item.natureza ? `• *Natureza:* ${item.natureza}\n` : "") +
      `• *Ente Devedor:* ${item.municipio} (${item.devedor})\n` +
      `• *Advogado / OAB:* ${item.advogadoNome} ${item.advogadoOab ? `(${item.advogadoOab})` : ""}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Ofício Requisitório (TJSP):* ${item.oficio1Url}\n` +
      `• *Processo Origem (e-SAJ):* ${item.oficio2Url}\n` +
      `• *Score Comercial CP:* ${score}/100 — ${scoreLabel(score).label}\n` +
      (notes[item.id] ? `• *Nota interna:* ${notes[item.id]}\n` : "");
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const exportCsv = () => {
    const header = "DEPRE,Titular,CPF/CNPJ,Valor,Municipio,Advogado,OAB,Processo Origem,Status CRM,Score,Oficio 1,Oficio 2";
    const rows = items.map((r) => [
      r.depre, `"${r.titular}"`, r.cpfCnpj ?? "",
      r.valor, r.municipio, `"${r.advogadoNome}"`, r.advogadoOab,
      r.processoOrigem, crmStatus[r.id] ?? "NOVO", scorePrioridade(r),
      r.oficio1Url, r.oficio2Url
    ].join(",")).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `central-precatorios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Busca contato do advogado via CNA público
  const fetchAdvogadoContato = useCallback(async (item: PrecatRecord) => {
    if (!item.advogadoNome && !item.advogadoOab) return;
    setAdvContato(null);
    setAdvContatoLoading(true);
    try {
      const q = new URLSearchParams();
      if (item.advogadoOab) q.set("oab", item.advogadoOab);
      if (item.advogadoNome) q.set("nome", item.advogadoNome);
      const res = await fetch(`/api/advogado-contato?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdvContato(data);
      }
    } catch (e) {
      console.error("Erro ao buscar contato advogado:", e);
    } finally {
      setAdvContatoLoading(false);
    }
  }, []);

  const openDrawer = useCallback((item: PrecatRecord, tab: "info" | "oficio" | "calc" = "info") => {
    setDrawer(item);
    setDrawerTab(tab);
    setAdvContato(null);
    fetchAdvogadoContato(item);
  }, [fetchAdvogadoContato]);


  // ─── Calculadora ROI ──────────────────────────────────────────────────
  const calcROI = (valor: number) => {
    const aquisicao = valor * (calcDesconto / 100);
    const lucro = valor - aquisicao;
    const rentabilidade = ((lucro / aquisicao) * 100).toFixed(1);
    const anualEquiv = ((Math.pow(1 + lucro / aquisicao, 12 / calcMeses) - 1) * 100).toFixed(1);
    return { aquisicao, lucro, rentabilidade, anualEquiv };
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  const totalValor = items.reduce((s, r) => s + (r.valor || 0), 0);

  return (
    <div className={`${styles.captureBox} ${styles.pilotShell}`} style={{ position: "relative" }}>

      {/* ── CABEÇALHO ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
              100% PÚBLICO · SEM LOGIN
            </span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7c3aed", background: "#ede9fe", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
              CRM INTEGRADO
            </span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0369a1", background: "#dbeafe", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
              OFÍCIO INLINE · CALCULADORA
            </span>
          </div>
          <h2 style={{ margin: "0.5rem 0 0.2rem", fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={22} color="#eab308" />
            Central Precatórios · Mesa de Oportunidades
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            Dossiês comerciais prontos para análise manual. O CP organiza e acelera a pesquisa; a confirmação final fica com o analista.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={exportCsv} style={btnStyle("#16a34a", "#dcfce7")} title="Exportar lista filtrada para Excel/CSV">
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={() => window.print()} style={btnStyle("#7c3aed", "#ede9fe")} title="Salvar a fila como PDF pelo diálogo de impressão">
            <FileText size={14} /> Exportar PDF
          </button>
          <button onClick={fetchData} style={btnStyle("#0369a1", "#e0f2fe")} title="Recarregar">
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      <div style={{ marginTop: "1rem", padding: "0.8rem 1rem", borderRadius: "8px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", fontSize: "0.82rem", lineHeight: 1.5 }}>
        <strong>Como usar esta fila:</strong> cada linha é um dossiê de prospecção com os dados disponíveis associados ao DEPRE. Nome, CPF/CNPJ, valor e documentos devem ser conferidos pelo analista antes de qualquer proposta. Essa conferência não impede a entrega do dossiê.
      </div>

      {/* ── MÉTRICAS ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "0.75rem", margin: "1.25rem 0" }}>
        <MetricCard icon={<Building size={14}/>} label="Precatórios na Fila" value={`${total}`} bg="#f8fafc" color="#0f172a" border="#e2e8f0" />
        <MetricCard icon={<CheckCircle size={14}/>} label="Dossiês Disponíveis" value={`${localizados} (${Math.round(localizados/(total||1)*100)}%)`} bg="#f0fdf4" color="#16a34a" border="#bbf7d0" />
        <MetricCard icon={<Scale size={14}/>} label="Advogados Mapeados" value="913" bg="#f0f9ff" color="#0284c7" border="#bae6fd" />
        <MetricCard icon={<DollarSign size={14}/>} label="Volume Filtrado Total" value={totalValor > 0 ? money(totalValor) : "—"} bg="#fefce8" color="#b45309" border="#fde68a" />
        <MetricCard icon={<TrendingUp size={14}/>} label="Fechados (CRM)" value={`${Object.values(crmStatus).filter(s => s === "FECHADO").length}`} bg="#ede9fe" color="#7c3aed" border="#ddd6fe" />
        <MetricCard icon={<Star size={14}/>} label="Favoritos" value={`${starred.size}`} bg="#fff7ed" color="#c2410c" border="#fed7aa" />
        <MetricCard icon={<Clock size={14}/>} label="Em análise" value={`${Object.values(crmStatus).filter(s => s === "CONTATADO" || s === "NEGOCIANDO").length}`} bg="#fefce8" color="#a16207" border="#fde68a" />
        <MetricCard icon={<UserCheck size={14}/>} label="Propostas" value={`${Object.values(crmStatus).filter(s => s === "PROPOSTA").length}`} bg="#f5f3ff" color="#6d28d9" border="#ddd6fe" />
      </div>

      {/* ── FILTROS ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 280px", position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text" placeholder="Buscar DEPRE, Titular, Advogado, OAB, Processo..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.8rem 0.55rem 2.1rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
          />
        </div>

        <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} style={selectStyle}>
          <option value="">Todos os Municípios</option>
          <option value="São Paulo">São Paulo</option>
          <option value="Guarulhos">Guarulhos</option>
          <option value="Campinas">Campinas</option>
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={selectStyle}>
          <option value="prioridade">Ordenar: Prioridade CP</option>
          <option value="valor">Ordenar: Maior Valor</option>
          <option value="municipio">Ordenar: Município</option>
        </select>

        <button onClick={() => setShowFilters(!showFilters)} style={btnStyle("#475569", "#f1f5f9")}>
          <SlidersHorizontal size={14} /> {showFilters ? "Menos filtros" : "Mais filtros"}
        </button>
      </div>

      {showFilters && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", color: "#374151" }}>
            Valor mínimo
            <select value={minValor} onChange={(e) => setMinValor(Number(e.target.value))} style={selectStyle}>
              <option value={100000}>R$ 100 mil</option>
              <option value={200000}>R$ 200 mil</option>
              <option value={500000}>R$ 500 mil</option>
              <option value={1000000}>R$ 1 milhão</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", color: "#374151" }}>
            Status CRM
            <select value={crmFilter} onChange={(e) => setCrmFilter(e.target.value as CrmStatus | "")} style={selectStyle}>
              <option value="">Todos os status</option>
              {(Object.keys(CRM_STATUS_CONFIG) as CrmStatus[]).map((k) => (
                <option key={k} value={k}>{CRM_STATUS_CONFIG[k].label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── TABELA ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} /><br/>Carregando dossiês da fila...
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 0.5rem" }}>
            Exibindo <strong>{items.length}</strong> de <strong>{total}</strong> registros
          </p>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={th}>⭐</th>
                  <th style={th}>Credor / Titular</th>
                  <th style={th}>DEPRE & Processo</th>
                  <th style={th}>Município</th>
                  <th style={th}>Valor informado</th>
                  <th style={th}>Score CP</th>
                  <th style={th}>Advogado / OAB</th>
                  <th style={th}>Status CRM</th>
                  <th style={th}>Ofícios</th>
                  <th style={{ ...th, textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = crmStatus[item.id] ?? "NOVO";
                  const cfg = CRM_STATUS_CONFIG[status];
                  const score = scorePrioridade(item);
                  const sl = scoreLabel(score);
                  const isStar = starred.has(item.id);
                  const isClosed = status === "FECHADO";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => openDrawer(item, "info")}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: isClosed ? "#f0fdf4" : item.id.includes("EXCELENCIA") ? "#fefce8" : "#fff",
                        cursor: "pointer",
                        opacity: status === "DESCARTADO" ? 0.5 : 1,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f0f9ff"; }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = isClosed ? "#f0fdf4" : item.id.includes("EXCELENCIA") ? "#fefce8" : "#fff";
                      }}
                    >
                      {/* Estrela */}
                      <td style={{ ...td, textAlign: "center" }} onClick={(e) => { e.stopPropagation(); setStarred((s) => { const n = new Set(s); isStar ? n.delete(item.id) : n.add(item.id); return n; }); }}>
                        {isStar ? <Star size={15} fill="#f59e0b" color="#f59e0b" /> : <StarOff size={15} color="#cbd5e1" />}
                      </td>

                      {/* Titular */}
                      <td style={td}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.titular}</div>
                        {item.cpfCnpj && <div style={{ fontSize: "0.74rem", color: "#0369a1" }}>{item.cpfCnpj}</div>}
                        {item.natureza && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{item.natureza}</div>}
                      </td>

                      {/* DEPRE */}
                      <td style={{ ...td, fontFamily: "monospace" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{item.depre}</div>
                        {item.processoOrigem && <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Origem: {item.processoOrigem.slice(0, 22)}…</div>}
                      </td>

                      {/* Município */}
                      <td style={td}>
                        <span style={{
                          padding: "0.2rem 0.55rem", borderRadius: "4px", fontSize: "0.74rem", fontWeight: 700,
                          background: item.municipio === "São Paulo" ? "#f1f5f9" : item.municipio === "Guarulhos" ? "#ecfeff" : "#fef3c7",
                          color: item.municipio === "São Paulo" ? "#334155" : item.municipio === "Guarulhos" ? "#0e7490" : "#b45309",
                        }}>
                          {item.municipio}
                        </span>
                      </td>

                      {/* Valor */}
                      <td style={{ ...td, fontWeight: 700, color: "#166534" }}>
                        {money(item.valor)}
                      </td>

                      {/* Score */}
                      <td style={td}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: sl.color }}>{sl.label}</div>
                        <div style={{ background: "#e2e8f0", borderRadius: "4px", height: "4px", width: "60px", marginTop: "3px" }}>
                          <div style={{ background: sl.color, width: `${score}%`, height: "4px", borderRadius: "4px" }} />
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{score}/100</div>
                      </td>

                      {/* Advogado */}
                      <td style={td}>
                        <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{item.advogadoNome || "Habilitado nos autos"}</div>
                        {item.advogadoOab && (
                          <a href={buildOabSearchUrl(item.advogadoOab, item.advogadoNome)} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: "0.72rem", color: "#0369a1", textDecoration: "underline" }}>
                            {item.advogadoOab} → Buscar CNA ↗
                          </a>
                        )}
                      </td>

                      {/* CRM Status */}
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={status}
                          onChange={(e) => updateCrmStatus(item.id, e.target.value as CrmStatus)}
                          style={{
                            padding: "0.25rem 0.4rem", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600,
                            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, cursor: "pointer"
                          }}
                        >
                          {(Object.keys(CRM_STATUS_CONFIG) as CrmStatus[]).map((k) => (
                            <option key={k} value={k}>{CRM_STATUS_CONFIG[k].label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Ofícios rápidos */}
                      <td style={td} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <a href={item.oficio1Url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "0.72rem", color: "#0369a1", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none" }}>
                            <FileText size={11} /> Ofício 1 ↗
                          </a>
                          <a href={item.oficio2Url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "0.72rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none" }}>
                            <FileText size={11} /> Ofício 2 ↗
                          </a>
                        </div>
                      </td>

                      {/* Ações */}
                      <td style={{ ...td, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                          <button onClick={() => openDrawer(item, "oficio")}
                            style={miniBtn("#0369a1", "#e0f2fe")} title="Ver ofício inline">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => openDrawer(item, "calc")}
                            style={miniBtn("#7c3aed", "#ede9fe")} title="Calculadora de rentabilidade">
                            <Calculator size={13} />
                          </button>
                          <button onClick={() => copyPitch(item)}
                            style={miniBtn(copiedId === item.id ? "#16a34a" : "#475569", copiedId === item.id ? "#dcfce7" : "#f1f5f9")}
                            title="Copiar dossiê para WhatsApp/CRM">
                            {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <button onClick={() => printDossier(item)} style={miniBtn("#7c3aed", "#ede9fe")} title="Exportar dossiê em PDF"><FileText size={13} /></button>
                          <button onClick={() => shareDossier(item)} style={miniBtn("#0369a1", "#e0f2fe")} title="Compartilhar dossiê"><ExternalLink size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── BARRA DE PAGINAÇÃO ────────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Mostrando {items.length > 0 ? (page - 1) * pageSize + 1 : 0} até {Math.min(page * pageSize, totalFiltered)} de <strong>{totalFiltered}</strong> registros
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
              </select>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                style={{
                  ...btnStyle("#475569", "#f1f5f9"),
                  opacity: page <= 1 ? 0.4 : 1,
                  cursor: page <= 1 ? "not-allowed" : "pointer"
                }}
              >
                ◀ Anterior
              </button>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", padding: "0 0.4rem" }}>
                Página {page} de {Math.max(1, Math.ceil(totalFiltered / pageSize))}
              </span>
              <button
                disabled={page >= Math.ceil(totalFiltered / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  ...btnStyle("#475569", "#f1f5f9"),
                  opacity: page >= Math.ceil(totalFiltered / pageSize) ? 0.4 : 1,
                  cursor: page >= Math.ceil(totalFiltered / pageSize) ? "not-allowed" : "pointer"
                }}
              >
                Próxima ▶
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── GAVETA DE DETALHES ─────────────────────────────────────── */}
      {drawer && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", justifyContent: "flex-end"
        }} onClick={() => setDrawer(null)}>
          <div
            style={{
              width: "min(700px, 96vw)", height: "100vh", background: "#fff",
              overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gaveta Header */}
            <div style={{ padding: "1.25rem 1.5rem 0", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>DEPRE {drawer.depre}</div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>{drawer.titular}</h3>
                  {drawer.cpfCnpj && <div style={{ fontSize: "0.8rem", color: "#0369a1", marginTop: "0.2rem" }}>{drawer.cpfCnpj}</div>}
                  <div style={{ marginTop: "0.3rem", fontWeight: 700, color: "#166534", fontSize: "1.1rem" }}>
                    {money(drawer.valor)}
                  </div>
                </div>
                <button onClick={() => setDrawer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  <X size={22} />
                </button>
              </div>

              {/* Abas */}
              <div style={{ display: "flex", gap: "0", marginTop: "1rem" }}>
                {([
                  ["info", "📋 Dossiê", "info"],
                  ["oficio", "📄 Ver Ofício", "oficio"],
                  ["calc", "💰 Simulação", "calc"],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDrawerTab(key)}
                    style={{
                      padding: "0.6rem 1rem", border: "none", borderBottom: drawerTab === key ? "2px solid #2563eb" : "2px solid transparent",
                      background: "transparent", fontWeight: 600, fontSize: "0.85rem",
                      color: drawerTab === key ? "#2563eb" : "#64748b", cursor: "pointer"
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gaveta Conteúdo */}
            <div style={{ flex: 1, padding: "1.25rem 1.5rem", overflowY: "auto" }}>

              {/* ABA DOSSIÊ */}
              {drawerTab === "info" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Dados Principais */}
                  <Section title="🏛️ Dados do Precatório">
                    <div style={{ padding: "0.55rem 0.7rem", borderRadius: "6px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "0.78rem", lineHeight: 1.45 }}>
                      <strong>Conferência do analista:</strong> confirme titular, CPF/CNPJ, valor e conteúdo do ofício diretamente nos autos antes de avançar.
                    </div>
                    <Row label="Município / Devedor" value={`${drawer.municipio} — ${drawer.devedor}`} />
                    <Row label="DEPRE" value={drawer.depre} mono />
                    <Row label="Processo Origem" value={drawer.processoOrigem || "Verificar nos autos"} mono />
                    {drawer.natureza && <Row label="Natureza" value={drawer.natureza} />}
                    {drawer.honorarios && <Row label="Honorários" value={drawer.honorarios} />}
                    <Row label="Score Comercial CP" value={`${scorePrioridade(drawer)}/100 — ${scoreLabel(scorePrioridade(drawer)).label}`} />
                    <Row label="Completude do dossiê" value={`${dataQuality(drawer).percent}% (${dataQuality(drawer).complete}/${dataQuality(drawer).total} campos essenciais)`} />
                    <Row label="Próxima melhor ação" value={nextBestAction(drawer).replaceAll("_", " ")} />
                    <Row label="SLA" value={slaState(drawer.updatedAt).label} />
                    <div style={{ marginTop: "0.55rem", padding: "0.55rem 0.7rem", background: "#f8fafc", borderRadius: "6px", fontSize: "0.76rem", color: "#475569" }}>
                      <strong>Como o score é calculado:</strong> valor ≥ R$ 1 mi (+40), ≥ R$ 500 mil (+25), OAB (+20), CPF/CNPJ disponível (+15), natureza alimentar (+10), São Paulo (+5).
                    </div>
                  </Section>

                  {/* Advogado */}
                  <Section title="⚖️ Advogado Habilitado">
                    <Row label="Nome" value={drawer.advogadoNome || "Ver nos autos"} />
                    {drawer.advogadoOab && <Row label="OAB" value={drawer.advogadoOab} />}

                    {/* Contato via CNA/OAB público */}
                    {advContatoLoading && (
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Buscando contato no CNA/OAB...
                      </div>
                    )}
                    {advContato && !advContatoLoading && (
                      <div style={{ marginTop: "0.6rem", background: "#f0fdf4", borderRadius: "6px", padding: "0.6rem 0.85rem", border: "1px solid #bbf7d0" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#166534", marginBottom: "0.35rem" }}>📋 Dados CNA/OAB — Cadastro Público</div>
                        {advContato.advogado && (advContato.advogado as Record<string, unknown>) ? (
                          <>
                            {(advContato.advogado as Record<string, unknown>).situacao && (
                              <div style={{ fontSize: "0.78rem", color: "#374151" }}>Situação: <strong>{String((advContato.advogado as Record<string, unknown>).situacao)}</strong></div>
                            )}
                            {(advContato.advogado as Record<string, unknown>).email && (
                              <div style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}>
                                📧 <a href={`mailto:${String((advContato.advogado as Record<string, unknown>).email)}`} style={{ color: "#1d4ed8" }}>{String((advContato.advogado as Record<string, unknown>).email)}</a>
                              </div>
                            )}
                            {((advContato.advogado as Record<string, unknown>).celular || (advContato.advogado as Record<string, unknown>).telefone) && (
                              <div style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}>
                                📞 {String((advContato.advogado as Record<string, unknown>).celular || (advContato.advogado as Record<string, unknown>).telefone)}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            Dados não encontrados automaticamente. Consulte diretamente em cna.oab.org.br com a OAB {drawer.advogadoOab}.
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                      {drawer.advogadoOab && (
                        <a href={buildOabSearchUrl(drawer.advogadoOab, drawer.advogadoNome)} target="_blank" rel="noopener noreferrer"
                          style={{ ...pillLink, background: "#e0f2fe", color: "#0369a1" }}>
                          🔍 Buscar no CNA/OAB ↗
                        </a>
                      )}
                      {/* WhatsApp com número real se disponível */}
                      {advContato?.whatsappUrl ? (
                        <a href={String(advContato.whatsappUrl)} target="_blank" rel="noopener noreferrer"
                          style={{ ...pillLink, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>
                          📲 WhatsApp Direto (número CNA) ↗
                        </a>
                      ) : (
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Olá ${drawer.advogadoNome.split(" ")[0]}, tudo bem? Estou entrando em contato pois identificamos o precatório ${drawer.depre} (${money(drawer.valor)}) em nome do(a) ${drawer.titular}. Temos interesse em apresentar uma proposta de cessão. Podemos conversar?`)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ ...pillLink, background: "#dcfce7", color: "#166534" }}>
                          💬 WhatsApp (texto pronto sem número) ↗
                        </a>
                      )}
                    </div>
                  </Section>

                  {/* Ofícios Públicos */}
                  <Section title="📑 Acesso Público aos Ofícios (TJSP/e-SAJ)">
                    <a href={drawer.oficio1Url} target="_blank" rel="noopener noreferrer"
                      style={{ ...pillLink, background: "#dbeafe", color: "#1d4ed8", display: "block", marginBottom: "0.5rem" }}>
                      <FileText size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                      Ofício Requisitório (DEPRE no TJSP/e-SAJ) ↗
                    </a>
                    <a href={drawer.oficio2Url} target="_blank" rel="noopener noreferrer"
                      style={{ ...pillLink, background: "#f1f5f9", color: "#334155", display: "block" }}>
                      <FileText size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                      Processo Originário / Portal Devedor ↗
                    </a>
                  </Section>

                  {/* CRM e Notas */}
                  <Section title="📊 CRM — Acompanhamento Comercial">
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Status do Caso</label>
                    <select
                      value={crmStatus[drawer.id] ?? "NOVO"}
                      onChange={(e) => updateCrmStatus(drawer.id, e.target.value as CrmStatus)}
                      style={{ ...selectStyle, marginTop: "0.4rem", marginBottom: "0.75rem", width: "100%" }}
                    >
                      {(Object.keys(CRM_STATUS_CONFIG) as CrmStatus[]).map((k) => (
                        <option key={k} value={k}>{CRM_STATUS_CONFIG[k].label}</option>
                      ))}
                    </select>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Anotações internas</label>
                    <textarea
                      rows={3}
                      value={notes[drawer.id] ?? ""}
                      onChange={(e) => { setNotes((n) => ({ ...n, [drawer.id]: e.target.value })); recordHistory(drawer.id, "Anotação atualizada"); }}
                      placeholder="Ex: Liguei para o advogado — aguardando retorno. Dr. João disse que considera a proposta."
                      style={{ width: "100%", marginTop: "0.4rem", padding: "0.6rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", resize: "vertical" }}
                    />
                    <label style={{ display: "block", marginTop: "0.75rem", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Próxima ação</label>
                    <div style={{ fontSize: "0.76rem", color: "#475569", marginTop: "0.3rem" }}>Recomendação automática: <strong>{nextBestAction(drawer).replaceAll("_", " ")}</strong></div>
                    <select value={nextAction[drawer.id] ?? nextBestAction(drawer)} onChange={(e) => { setNextAction((a) => ({ ...a, [drawer.id]: e.target.value })); recordHistory(drawer.id, `Próxima ação: ${e.target.options[e.target.selectedIndex].text}`); }} style={{ ...selectStyle, width: "100%", marginTop: "0.4rem" }}>
                      <option value="CONFERIR_CPF">Conferir CPF/CNPJ</option>
                      <option value="CONFIRMAR_CREDOR">Confirmar credor</option>
                      <option value="ABORDAR_ADVOGADO">Abordar advogado</option>
                      <option value="CONFERIR_OFICIO">Conferir ofício</option>
                      <option value="DESCARTAR">Descartar caso</option>
                    </select>
                  </Section>

                  <Section title="🕘 Histórico do caso">
                    {(history[drawer.id] ?? []).length === 0 ? <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Nenhuma alteração registrada ainda.</div> : (history[drawer.id] ?? []).slice().reverse().map((event, index) => <div key={`${event}-${index}`} style={{ fontSize: "0.76rem", color: "#475569", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9" }}>{event}</div>)}
                  </Section>

                  <Section title="✉️ Modelos de abordagem">
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Olá, ${drawer.advogadoNome || "Dr(a)."}. Identificamos o precatório DEPRE ${drawer.depre}, no valor informado de ${money(drawer.valor)}, vinculado a ${drawer.titular}. Podemos confirmar os dados e conversar sobre uma possível cessão?`)}`} target="_blank" rel="noopener noreferrer" style={{ ...pillLink, background: "#dcfce7", color: "#166534" }}>WhatsApp comercial ↗</a>
                      <a href={`mailto:?subject=${encodeURIComponent(`Consulta sobre o precatório ${drawer.depre}`)}&body=${encodeURIComponent(`Olá, ${drawer.advogadoNome || "Dr(a)."}.\n\nEstamos analisando o precatório DEPRE ${drawer.depre}, associado a ${drawer.titular}, com valor informado de ${money(drawer.valor)}. Gostaríamos de confirmar os dados e avaliar uma possível cessão.\n\nAtenciosamente,\nCentral Precatórios`)}`} style={{ ...pillLink, background: "#dbeafe", color: "#1d4ed8" }}>E-mail comercial ↗</a>
                    </div>
                  </Section>

                  {/* Botão Copiar Dossiê */}
                  <button onClick={() => copyPitch(drawer)}
                    style={{ ...btnStyle("#0f172a", "#f8fafc"), width: "100%", justifyContent: "center", padding: "0.75rem" }}>
                    {copiedId === drawer.id ? <><Check size={15} /> Copiado! Cole no WhatsApp ou CRM</> : <><Copy size={15} /> Copiar Dossiê Completo (WhatsApp/CRM)</>}
                  </button>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => printDossier(drawer)} style={{ ...btnStyle("#7c3aed", "#ede9fe"), flex: 1, justifyContent: "center" }}><FileText size={14} /> PDF</button>
                    <button onClick={() => shareDossier(drawer)} style={{ ...btnStyle("#0369a1", "#e0f2fe"), flex: 1, justifyContent: "center" }}><ExternalLink size={14} /> Compartilhar</button>
                  </div>
                </div>
              )}

              {/* ABA OFÍCIO INLINE */}
              {drawerTab === "oficio" && (
                <div>
                  <div style={{ background: "#dbeafe", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.84rem", color: "#1e40af" }}>
                    <ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: "0.4rem" }} />
                    <strong>Documento oficial público</strong> do TJSP/e-SAJ. 100% verificável. Nenhum login necessário.
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <a href={drawer.oficio1Url} target="_blank" rel="noopener noreferrer"
                      style={{ ...pillLink, background: "#dbeafe", color: "#1d4ed8" }}>
                      <ExternalLink size={13} style={{ verticalAlign: "middle" }} /> Ofício 1 — Abrir em nova aba ↗
                    </a>
                    <a href={drawer.oficio2Url} target="_blank" rel="noopener noreferrer"
                      style={{ ...pillLink, background: "#f1f5f9", color: "#334155" }}>
                      <ExternalLink size={13} style={{ verticalAlign: "middle" }} /> Ofício 2 — Abrir em nova aba ↗
                    </a>
                  </div>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                    <iframe
                      src={drawer.oficio1Url}
                      title={`Ofício — ${drawer.depre}`}
                      style={{ width: "100%", height: "520px", border: "none" }}
                    />
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                    Se o documento não carregar no iframe (alguns tribunais bloqueiam embedding), use o link acima para abrir direto.
                  </p>
                </div>
              )}

              {/* ABA CALCULADORA */}
              {drawerTab === "calc" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <Section title="💰 Simulação de Rentabilidade da Cessão">
                    <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "0 0 1rem" }}>
                      Simule a compra do precatório de <strong>{drawer.titular}</strong> no valor de <strong>{money(drawer.valor)}</strong>.
                    </p>

                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
                      % de desconto ofertado ao credor (você paga X% do valor face)
                    </label>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.3rem", marginBottom: "1rem" }}>
                      <input type="range" min={50} max={95} value={calcDesconto}
                        onChange={(e) => setCalcDesconto(Number(e.target.value))}
                        style={{ flex: 1 }} />
                      <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a", minWidth: "40px" }}>{calcDesconto}%</span>
                    </div>

                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
                      Prazo estimado para recebimento (meses)
                    </label>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.3rem", marginBottom: "1rem" }}>
                      <input type="range" min={6} max={60} step={6} value={calcMeses}
                        onChange={(e) => setCalcMeses(Number(e.target.value))}
                        style={{ flex: 1 }} />
                      <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f172a", minWidth: "60px" }}>{calcMeses} meses</span>
                    </div>

                    {(() => {
                      const roi = calcROI(drawer.valor);
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                          <CalcCard label="💸 Valor de Aquisição" value={money(roi.aquisicao)} color="#0369a1" bg="#e0f2fe" />
                          <CalcCard label="🤑 Lucro Estimado" value={money(roi.lucro)} color="#166534" bg="#dcfce7" />
                          <CalcCard label="📈 Retorno Total (%)" value={`+${roi.rentabilidade}%`} color="#7c3aed" bg="#ede9fe" />
                          <CalcCard label="📅 Taxa Equiv. Anual" value={`${roi.anualEquiv}% a.a.`} color="#b45309" bg="#fef3c7" />
                        </div>
                      );
                    })()}

                    <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#94a3b8", background: "#f8fafc", borderRadius: "6px", padding: "0.6rem" }}>
                      ⚠️ Simulação para fins indicativos. Resultado real depende de prazo efetivo de pagamento, honorários do advogado ({drawer.honorarios || "a verificar"}), impostos e condições da cessão.
                    </div>
                  </Section>

                  <button onClick={() => copyPitch(drawer)}
                    style={{ ...btnStyle("#0f172a", "#f8fafc"), justifyContent: "center", padding: "0.7rem" }}>
                    <Copy size={14} /> Copiar Dossiê para enviar proposta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────
function MetricCard({ icon, label, value, bg, color, border }: {
  icon: React.ReactNode; label: string; value: string;
  bg: string; color: string; border: string;
}) {
  return (
    <div style={{ background: bg, padding: "0.85rem 1rem", borderRadius: "8px", border: `1px solid ${border}` }}>
      <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.3rem" }}>{icon}{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color, marginTop: "0.2rem" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
      <div style={{ background: "#f8fafc", padding: "0.6rem 1rem", fontSize: "0.82rem", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e2e8f0" }}>{title}</div>
      <div style={{ padding: "0.85rem 1rem" }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.4rem", fontSize: "0.84rem" }}>
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#0f172a", textAlign: "right", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

function CalcCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: "8px", padding: "0.75rem 1rem" }}>
      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ─── Estilos inline reutilizáveis ─────────────────────────────────────────
const th: React.CSSProperties = { padding: "0.75rem 0.85rem", fontWeight: 700, fontSize: "0.8rem", color: "#374151", textAlign: "left", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "0.7rem 0.85rem", verticalAlign: "top" };
const selectStyle: React.CSSProperties = { padding: "0.55rem 0.7rem", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.86rem", background: "#fff" };
const pillLink: React.CSSProperties = { padding: "0.3rem 0.7rem", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" };

function btnStyle(color: string, bg: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.85rem", borderRadius: "6px", border: `1px solid ${color}30`, background: bg, color, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" };
}
function miniBtn(color: string, bg: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "5px", border: `1px solid ${color}30`, background: bg, color, cursor: "pointer" };
}
