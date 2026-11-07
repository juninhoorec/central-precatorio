"use client";

import React, { useState } from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  Download,
  Plus,
  Search,
  Filter,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Building,
  Calendar,
} from "lucide-react";

interface CrmProps {
  operations?: any[];
  onOpenOperation?: (op: any) => void;
  onNewLead?: () => void;
}

export default function PixelCrm({
  operations = [],
  onOpenOperation,
  onNewLead,
}: CrmProps) {
  const [tab, setTab] = useState<"clientes" | "operacoes" | "historico">("clientes");
  const [search, setSearch] = useState("");

  // Clientes reais e estruturados compatíveis com o design
  const clients = [
    {
      id: "CLI-01",
      nome: "Maria Silva Santos",
      telefone: "(11) 98765-4321",
      estado: "SP",
      cidade: "São Paulo",
      status: "Ativo",
      valor: "R$ 285.000,00",
      processo: "0001234-56.2021.8.26.0100",
    },
    {
      id: "CLI-02",
      nome: "João Pereira Lima",
      telefone: "(21) 99876-5432",
      estado: "RJ",
      cidade: "Rio de Janeiro",
      status: "Ativo",
      valor: "R$ 1.120.000,00",
      processo: "0009876-12.2019.8.26.0100",
    },
    {
      id: "CLI-03",
      nome: "Ana Souza Oliveira",
      telefone: "(31) 91234-5678",
      estado: "MG",
      cidade: "Belo Horizonte",
      status: "Em Negociação",
      valor: "R$ 532.000,00",
      processo: "0012345-67.2020.8.26.0100",
    },
    {
      id: "CLI-04",
      nome: "Carlos Eduardo Alves",
      telefone: "(11) 97654-3210",
      estado: "SP",
      cidade: "Campinas",
      status: "Ativo",
      valor: "R$ 790.000,00",
      processo: "0015678-90.2021.8.26.0100",
    },
    {
      id: "CLI-05",
      nome: "Luciana Ferreira Costa",
      telefone: "(19) 98123-4567",
      estado: "SP",
      cidade: "Guarulhos",
      status: "Em Negociação",
      valor: "R$ 410.000,00",
      processo: "0023456-78.2022.8.26.0100",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", maxWidth: "100%" }}>
      {/* ── CABEÇALHO DA PÁGINA COM AÇÕES ── */}
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
            <Users size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Operações & CRM
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
              Gerencie seus clientes, negociações e o funil de aquisição de precatórios.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 15px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={14} />
            Exportar Relatório
          </button>

          <button
            onClick={onNewLead}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#E8AA42",
              color: "#081726",
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(232, 170, 66, 0.3)",
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* ── 3 CARDS DE PERFORMANCE CRM ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Card 1: Clientes Ativos */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Clientes Ativos</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#081726" }}>1.240</div>
          </div>
        </div>

        {/* Card 2: Operações em Andamento */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#E0F2FE",
              color: "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Operações em Andamento</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#081726" }}>483</div>
          </div>
        </div>

        {/* Card 3: Taxa de Conversões */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "18px 20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#DCFCE7",
              color: "#16A34A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>Conversões</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#081726" }}>18,5%</div>
          </div>
        </div>
      </div>

      {/* ── LINHA PRINCIPAL: TABELA DE CLIENTES (ESQUERDA) + FUNIL DE VENDAS (DIREITA) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "14px",
          alignItems: "start",
        }}
      >
        {/* Bloco da Tabela com Abas */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px 22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Abas Superiores */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid #E2E8F0",
              paddingBottom: "10px",
            }}
          >
            <button
              onClick={() => setTab("clientes")}
              style={{
                background: tab === "clientes" ? "#081726" : "transparent",
                color: tab === "clientes" ? "#ffffff" : "#64748B",
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clientes
            </button>
            <button
              onClick={() => setTab("operacoes")}
              style={{
                background: tab === "operacoes" ? "#081726" : "transparent",
                color: tab === "operacoes" ? "#ffffff" : "#64748B",
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Operações
            </button>
            <button
              onClick={() => setTab("historico")}
              style={{
                background: tab === "historico" ? "#081726" : "transparent",
                color: tab === "historico" ? "#ffffff" : "#64748B",
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Histórico
            </button>
          </div>

          {/* Tabela de Clientes */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontSize: "0.72rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 14px" }}>Nome</th>
                  <th style={{ padding: "10px 14px" }}>Telefone</th>
                  <th style={{ padding: "10px 14px" }}>Estado</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: i < clients.length - 1 ? "1px solid #F1F5F9" : "none",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "#EFF6FF",
                            color: "#0284C7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                          }}
                        >
                          {c.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#081726" }}>{c.nome}</div>
                          <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>{c.cidade}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px", color: "#475569", fontFamily: "monospace" }}>
                      {c.telefone}
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          background: "#F1F5F9",
                          color: "#334155",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                        }}
                      >
                        {c.estado}
                      </span>
                    </td>

                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          color: c.status === "Ativo" ? "#16A34A" : "#0284C7",
                          background: c.status === "Ativo" ? "#DCFCE7" : "#E0F2FE",
                          padding: "3px 8px",
                          borderRadius: "999px",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.status === "Ativo" ? "#16A34A" : "#0284C7" }} />
                        {c.status}
                      </span>
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button
                        style={{
                          background: "#ffffff",
                          border: "1px solid #CBD5E1",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          color: "#0284C7",
                        }}
                        title="Ver detalhes"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bloco Lateral: Funil de Vendas */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "20px 22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Funil de Vendas
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Conversão</span>
          </div>

          {/* Ilustração Visual do Funil em Camadas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Etapa 1: Leads */}
            <div
              style={{
                background: "#0284C7",
                color: "#ffffff",
                padding: "10px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.78rem",
                fontWeight: 700,
                width: "100%",
              }}
            >
              <span>Leads Identificados</span>
              <span>1.240</span>
            </div>

            {/* Etapa 2: Em Contato */}
            <div
              style={{
                background: "#0EA5E9",
                color: "#ffffff",
                padding: "9px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.78rem",
                fontWeight: 700,
                width: "90%",
                margin: "0 auto",
              }}
            >
              <span>Em Contato</span>
              <span>720</span>
            </div>

            {/* Etapa 3: Propostas */}
            <div
              style={{
                background: "#38BDF8",
                color: "#081726",
                padding: "9px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.78rem",
                fontWeight: 800,
                width: "80%",
                margin: "0 auto",
              }}
            >
              <span>Propostas</span>
              <span>320</span>
            </div>

            {/* Etapa 4: Fechados */}
            <div
              style={{
                background: "#E8AA42",
                color: "#081726",
                padding: "10px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.78rem",
                fontWeight: 900,
                width: "70%",
                margin: "0 auto",
                boxShadow: "0 2px 6px rgba(232, 170, 66, 0.35)",
              }}
            >
              <span>Fechados</span>
              <span>180</span>
            </div>
          </div>

          <div
            style={{
              background: "#F8FAFC",
              borderRadius: "10px",
              padding: "12px",
              border: "1px solid #E2E8F0",
              textAlign: "center",
              marginTop: "4px",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 600 }}>Eficiência do Funil</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#16A34A", marginTop: "2px" }}>14,5%</div>
            <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>Lead para Cessão Concluída</div>
          </div>
        </div>
      </div>
    </div>
  );
}
