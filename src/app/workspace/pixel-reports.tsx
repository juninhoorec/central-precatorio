"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Building,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from "lucide-react";

export default function PixelReports() {
  const [periodo, setPeriodo] = useState("Últimos 12 meses");
  const [orgao, setOrgao] = useState("Todos os Órgãos");

  const relatorios = [
    { id: "REL-01", titulo: "Relatório Gerencial Mensal", tipo: "PDF & CSV", data: "01/11/2026", tamanho: "2.4 MB" },
    { id: "REL-02", titulo: "Relatório por Órgão e Tribunal (TJSP/TRF3)", tipo: "PDF & Planilha", data: "28/10/2026", tamanho: "4.1 MB" },
    { id: "REL-03", titulo: "Relatório de Clientes e Propostas", tipo: "CSV", data: "25/10/2026", tamanho: "1.8 MB" },
    { id: "REL-04", titulo: "Relatório de Operações Concluídas (Safra 2024)", tipo: "Dossiê Executivo", data: "20/10/2026", tamanho: "5.6 MB" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", maxWidth: "100%" }}>
      {/* ── CABEÇALHO COM FILTROS DE PERÍODO/ÓRGÃO E BOTÃO GERAR RELATÓRIO ── */}
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
              background: "#FEF3C7",
              color: "#B45309",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Relatórios Executivos
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
              Acesse relatórios completos, auditorias e acompanhe os resultados consolidados.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            <option>Últimos 12 meses</option>
            <option>Últimos 6 meses</option>
            <option>Safra 2024/2025</option>
            <option>Este ano</option>
          </select>

          <select
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            <option>Todos os Órgãos</option>
            <option>TJSP (São Paulo)</option>
            <option>Campinas</option>
            <option>Guarulhos</option>
            <option>TRF-3</option>
          </select>

          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#081726",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Gerar Relatório
          </button>
        </div>
      </div>

      {/* ── 4 CARDS DE INDICADORES: PROCESSOS, VALOR, CONVERSÃO, TEMPO MÉDIO ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Card 1: Processos Processados */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Processos Processados</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#081726", marginTop: "4px" }}>12.430</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.74rem", color: "#16A34A", fontWeight: 700 }}>
            <ArrowUpRight size={14} /> +12% vs ano anterior
          </div>
        </div>

        {/* Card 2: Valor Movimentado */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Valor Movimentado</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#081726", marginTop: "4px" }}>R$ 125,8 Mi</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.74rem", color: "#16A34A", fontWeight: 700 }}>
            <ArrowUpRight size={14} /> +16% volume nominal
          </div>
        </div>

        {/* Card 3: Taxa de Conversão */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Taxa de Conversão</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#081726", marginTop: "4px" }}>18,5%</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.74rem", color: "#16A34A", fontWeight: 700 }}>
            <ArrowUpRight size={14} /> +2,1% eficiência
          </div>
        </div>

        {/* Card 4: Tempo Médio */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Tempo Médio</span>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#081726", marginTop: "4px" }}>22 dias</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "0.74rem", color: "#16A34A", fontWeight: 700 }}>
            <ArrowDownRight size={14} /> -5% tempo de ciclo
          </div>
        </div>
      </div>

      {/* ── GRÁFICO DE DESEMPENHO GERAL (BARRAS) + LISTA DE RELATÓRIOS ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "14px",
          alignItems: "stretch",
        }}
      >
        {/* Gráfico de Desempenho Geral */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px 22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            flex: "1 1 500px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#081726", margin: 0 }}>Desempenho Geral</h2>
              <span style={{ fontSize: "0.74rem", color: "#64748B" }}>Processos vs Valor movimentado por mês</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "0.74rem", color: "#475569" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#0284C7" }} />
                Processos
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#E8AA42" }} />
                Valor (R$)
              </span>
            </div>
          </div>

          {/* Gráfico de Barras em SVG */}
          <div style={{ height: "190px", width: "100%" }}>
            <svg viewBox="0 0 550 170" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              {/* Linhas de Grade */}
              <line x1="0" y1="20" x2="550" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="65" x2="550" y2="65" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="110" x2="550" y2="110" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="150" x2="550" y2="150" stroke="#CBD5E1" strokeWidth="1" />

              {/* Barras dos 12 meses */}
              {[
                { m: "Jan", p: 40, v: 55 },
                { m: "Fev", p: 55, v: 70 },
                { m: "Mar", p: 70, v: 85 },
                { m: "Abr", p: 65, v: 90 },
                { m: "Mai", p: 85, v: 110 },
                { m: "Jun", p: 95, v: 118 },
                { m: "Jul", p: 110, v: 125 },
                { m: "Ago", p: 105, v: 130 },
                { m: "Set", p: 115, v: 135 },
                { m: "Out", p: 125, v: 140 },
                { m: "Nov", p: 130, v: 145 },
                { m: "Dez", p: 135, v: 148 },
              ].map((item, idx) => {
                const x = 20 + idx * 43;
                return (
                  <g key={item.m}>
                    {/* Barra Azul (Processos) */}
                    <rect x={x} y={150 - item.p} width="14" height={item.p} fill="#0284C7" rx="3" />
                    {/* Barra Dourada (Valor) */}
                    <rect x={x + 16} y={150 - item.v} width="14" height={item.v} fill="#E8AA42" rx="3" />
                    {/* Label Mês */}
                    <text x={x + 15} y="165" textAnchor="middle" fontSize="10" fill="#94A3B8" fontWeight="600">
                      {item.m}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Lista de Relatórios Disponíveis */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px 22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Relatórios Disponíveis
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>Download</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {relatorios.map((rel) => (
              <div
                key={rel.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={16} color="#0284C7" />
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#081726" }}>{rel.titulo}</div>
                    <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>{rel.tipo} · {rel.tamanho}</div>
                  </div>
                </div>

                <button
                  style={{
                    background: "#ffffff",
                    border: "1px solid #CBD5E1",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "#081726",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  <Download size={13} />
                  Baixar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
