"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  Plus,
  MessageSquare,
  Activity,
  FileQuestion,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Clock,
  Send,
} from "lucide-react";

export default function PixelSupport() {
  const [modalOpen, setModalOpen] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [protocolos, setProtocolos] = useState([
    {
      id: "#2026-0048",
      assunto: "Dúvida sobre precatórios TJSP",
      data: "07/11/2026",
      status: "Resolvido",
    },
    {
      id: "#2026-0045",
      assunto: "Sincronização de processo DEPRE",
      data: "02/11/2026",
      status: "Resolvido",
    },
    {
      id: "#2026-0039",
      assunto: "Auditoria de cessão em lote",
      data: "28/10/2026",
      status: "Resolvido",
    },
  ]);

  const handleCriarChamado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim()) return;
    const novo = {
      id: `#2026-00${protocolos.length + 49}`,
      assunto,
      data: new Date().toLocaleDateString("pt-BR"),
      status: "Em Análise",
    };
    setProtocolos([novo, ...protocolos]);
    setAssunto("");
    setMensagem("");
    setModalOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", maxWidth: "100%" }}>
      {/* ── CABEÇALHO COM BOTÃO ABRIR CHAMADO (DOURADO) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          borderRadius: "14px",
          padding: "18px 22px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#EFF6FF",
              color: "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HelpCircle size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Suporte & Atendimento
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
              Estamos aqui para ajudar você e garantir agilidade operacional em suas cessões.
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#E8AA42",
            color: "#081726",
            fontSize: "0.84rem",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(232, 170, 66, 0.35)",
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Abrir Chamado
        </button>
      </div>

      {/* ── 4 CARDS DE ATENDIMENTO ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Card 1: Central de Ajuda */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#EFF6FF",
                color: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              <HelpCircle size={18} />
            </div>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: "0 0 4px 0" }}>
              Central de Ajuda
            </h3>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748B" }}>
              Tire suas dúvidas operacionais com nossos manuais.
            </p>
          </div>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert("Manuais integrados na plataforma."); }}
            style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0284C7", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
          >
            Acessar →
          </a>
        </div>

        {/* Card 2: Fale Conosco */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#DCFCE7",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              <MessageSquare size={18} />
            </div>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: "0 0 4px 0" }}>
              Fale Conosco
            </h3>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748B" }}>
              Entre em contato direto com nossa equipe jurídica.
            </p>
          </div>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.76rem", fontWeight: 700, color: "#16A34A", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
          >
            Contato WhatsApp →
          </a>
        </div>

        {/* Card 3: Status do Sistema */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#FEF3C7",
                color: "#B45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              <Activity size={18} />
            </div>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: "0 0 4px 0" }}>
              Status do Sistema
            </h3>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748B" }}>
              Todos os serviços públicos TJSP operando normalmente.
            </p>
          </div>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#16A34A", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A" }} />
            100% Operacional
          </span>
        </div>

        {/* Card 4: FAQ */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#EDE9FE",
                color: "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              <FileQuestion size={18} />
            </div>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: "0 0 4px 0" }}>
              Perguntas Frequentes
            </h3>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748B" }}>
              Dúvidas comuns sobre deságio, DEPRE e cessão.
            </p>
          </div>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert("Perguntas frequentes carregadas."); }}
            style={{ fontSize: "0.76rem", fontWeight: 700, color: "#7C3AED", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
          >
            Acessar FAQ →
          </a>
        </div>
      </div>

      {/* ── SEÇÃO: SEUS CHAMADOS ── */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          padding: "20px 22px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#081726", margin: 0 }}>
          Seus Chamados
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontSize: "0.72rem", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px" }}>Protocolo</th>
                <th style={{ padding: "10px 14px" }}>Assunto</th>
                <th style={{ padding: "10px 14px" }}>Data</th>
                <th style={{ padding: "10px 14px" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {protocolos.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: idx < protocolos.length - 1 ? "1px solid #F1F5F9" : "none",
                  }}
                >
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, color: "#0284C7" }}>
                    {p.id}
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#081726" }}>
                    {p.assunto}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#64748B" }}>
                    {p.data}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        color: p.status === "Resolvido" ? "#16A34A" : "#D97706",
                        background: p.status === "Resolvido" ? "#DCFCE7" : "#FEF3C7",
                        padding: "3px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      {p.status === "Resolvido" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); alert(`Protocolo ${p.id}: Histórico verificado com sucesso.`); }}
                      style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0284C7", textDecoration: "none" }}
                    >
                      Ver detalhes →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE ABERTURA DE CHAMADO ── */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(8, 23, 38, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#081726", margin: "0 0 6px 0" }}>
              Novo Chamado de Suporte
            </h2>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.8rem", color: "#64748B" }}>
              Descreva sua dúvida ou solicitação para atendimento técnico/jurídico.
            </p>

            <form onSubmit={handleCriarChamado} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Assunto
                </label>
                <input
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Ex: Auditoria do precatório 0358247..."
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Mensagem Detalhada
                </label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Descreva aqui o que precisa..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#E8AA42",
                    color: "#081726",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Enviar Chamado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
