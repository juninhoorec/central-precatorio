"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Bell,
  Search,
  Plus,
  FileText,
  Settings,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users,
  Layers,
} from "lucide-react";

interface DashboardProps {
  totalFila: number;
  totalVolume: number;
  onNavigate: (view: string) => void;
}

export default function PixelDashboard({
  totalFila = 26850,
  totalVolume = 16481898816.95,
  onNavigate,
}: DashboardProps) {
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%", maxWidth: "100%" }}>
      {/* ── TOPO: BOAS-VINDAS INSTITUCIONAL + DATA + SINO ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          background: "#ffffff",
          borderRadius: "12px",
          padding: "12px 18px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0B1F33 0%, #173854 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid #E8AA42",
              boxShadow: "0 2px 6px rgba(232, 170, 66, 0.2)",
              color: "#E8AA42",
              fontWeight: 800,
              fontSize: "0.85rem",
            }}
          >
            CP
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#081726",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Mesa de Gestão & Operações
            </h1>
            <p style={{ margin: "1px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
              Acompanhe o desempenho, volume e tramitação das suas operações de precatórios.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Sino Notificações */}
          <div
            style={{
              position: "relative",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#475569",
            }}
          >
            <Bell size={15} />
            <span
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#EF4444",
                border: "1px solid #ffffff",
              }}
            />
          </div>

          {/* Data */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            <Calendar size={13} color="#E8AA42" />
            <span style={{ textTransform: "capitalize" }}>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* ── 4 CARDS DE INDICADORES (KPIs) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        {/* Card 1: Total na Fila */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>Total na Fila</span>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "6px",
                background: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={14} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#081726", letterSpacing: "-0.03em" }}>
              {totalFila.toLocaleString("pt-BR")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", fontSize: "0.7rem", color: "#16A34A", fontWeight: 700 }}>
              <ArrowUpRight size={12} />
              <span>+12% este mês</span>
            </div>
          </div>
        </div>

        {/* Card 2: Em Análise */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>Em Análise</span>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "6px",
                background: "#E0F2FE",
                color: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={14} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#081726", letterSpacing: "-0.03em" }}>
              12.430
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", fontSize: "0.7rem", color: "#16A34A", fontWeight: 700 }}>
              <ArrowUpRight size={12} />
              <span>Diligência ativa</span>
            </div>
          </div>
        </div>

        {/* Card 3: Aguardando */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>Aguardando</span>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "6px",
                background: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle size={14} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#081726", letterSpacing: "-0.03em" }}>
              8.720
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", fontSize: "0.7rem", color: "#D97706", fontWeight: 700 }}>
              <ArrowDownRight size={12} />
              <span>-2% pendências</span>
            </div>
          </div>
        </div>

        {/* Card 4: Exportadas */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "12px 14px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>Exportadas</span>
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "6px",
                background: "#DCFCE7",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#081726", letterSpacing: "-0.03em" }}>
              5.700
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", fontSize: "0.7rem", color: "#16A34A", fontWeight: 700 }}>
              <ArrowUpRight size={12} />
              <span>+8% dossiês concluídos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── LINHA DO MEIO: EVOLUÇÃO MENSAL (GRÁFICO) + POR ÓRGÃO (DONUT) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: "10px",
        }}
      >
        {/* Gráfico de Evolução Mensal */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "14px 16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div>
              <h2 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#081726", margin: 0 }}>
                Evolução Mensal
              </h2>
              <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Volume de precatórios processados vs credores</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#475569" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#0284C7" }} />
                <span>Processos</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#475569" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#E8AA42" }} />
                <span>Clientes</span>
              </div>
            </div>
          </div>

          {/* Ilustração Visual Vetorial do Gráfico com Curvas Reais em SVG */}
          <div style={{ height: "140px", width: "100%", position: "relative" }}>
            <svg viewBox="0 0 500 130" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <linearGradient id="gradProcessos" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradClientes" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#E8AA42" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#E8AA42" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Linhas de Grade Horizontais */}
              <line x1="0" y1="15" x2="500" y2="15" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="50" x2="500" y2="50" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="85" x2="500" y2="85" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#F1F5F9" strokeWidth="1" />

              {/* Área e Linha de Processos (Azul) */}
              <path
                d="M 20,110 C 90,95 150,100 220,70 C 290,45 360,55 420,35 C 460,20 480,18 490,15 L 490,120 L 20,120 Z"
                fill="url(#gradProcessos)"
              />
              <path
                d="M 20,110 C 90,95 150,100 220,70 C 290,45 360,55 420,35 C 460,20 480,18 490,15"
                fill="none"
                stroke="#0284C7"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Área e Linha de Clientes (Dourado) */}
              <path
                d="M 20,118 C 90,110 150,108 220,90 C 290,75 360,82 420,68 C 460,55 480,48 490,42 L 490,120 L 20,120 Z"
                fill="url(#gradClientes)"
              />
              <path
                d="M 20,118 C 90,110 150,108 220,90 C 290,75 360,82 420,68 C 460,55 480,48 490,42"
                fill="none"
                stroke="#E8AA42"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Pontos de Destaque */}
              <circle cx="490" cy="15" r="4" fill="#0284C7" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx="490" cy="42" r="4" fill="#E8AA42" stroke="#ffffff" strokeWidth="1.5" />
            </svg>

            {/* Labels dos Meses */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "2px",
                fontSize: "0.68rem",
                color: "#94A3B8",
                fontWeight: 600,
              }}
            >
              <span>Jan</span>
              <span>Fev</span>
              <span>Mar</span>
              <span>Abr</span>
              <span>Mai</span>
              <span>Jun</span>
            </div>
          </div>
        </div>

        {/* Gráfico Donut: Por Órgão */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "14px 16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ marginBottom: "6px" }}>
            <h2 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Por Órgão
            </h2>
            <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Distribuição por tribunal</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            {/* SVG Donut Chart */}
            <div style={{ width: "95px", height: "95px", position: "relative", flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                {/* Background Ring */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="4"
                />
                {/* TJSP 42% (Azul) */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="4"
                  strokeDasharray="42, 100"
                />
                {/* TRF-3 28% (Dourado) */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E8AA42"
                  strokeWidth="4"
                  strokeDasharray="28, 100"
                  strokeDashoffset="-42"
                />
                {/* TST 20% (Roxo) */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="4"
                  strokeDasharray="20, 100"
                  strokeDashoffset="-70"
                />
                {/* Outros 10% (Verde) */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeDasharray="10, 100"
                  strokeDashoffset="-90"
                />
              </svg>
              {/* Texto Central */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#081726" }}>42%</div>
                <div style={{ fontSize: "0.58rem", color: "#64748B", fontWeight: 700 }}>TJSP</div>
              </div>
            </div>

            {/* Legenda */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.72rem", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284C7" }} />
                  TJSP
                </span>
                <strong style={{ color: "#081726" }}>42%</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#E8AA42" }} />
                  TRF-3
                </span>
                <strong style={{ color: "#081726" }}>28%</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366F1" }} />
                  TST
                </span>
                <strong style={{ color: "#081726" }}>20%</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
                  Outros
                </span>
                <strong style={{ color: "#081726" }}>10%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LINHA INFERIOR: ATALHOS RÁPIDOS + BANNER INSTITUCIONAL ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          alignItems: "stretch",
        }}
      >
        {/* Atalhos Rápidos */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            padding: "14px 16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <span style={{ color: "#E8AA42", fontWeight: 800 }}>✦</span>
            <h3 style={{ fontSize: "0.86rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Atalhos Rápidos
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            <button
              onClick={() => onNavigate("Fila DEPRE")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Search size={14} color="#0284C7" />
              <span>Consultar Fila</span>
            </button>

            <button
              onClick={() => onNavigate("Operações & CRM")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Plus size={14} color="#E8AA42" />
              <span>Nova Operação</span>
            </button>

            <button
              onClick={() => onNavigate("Relatórios")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FileText size={14} color="#10B981" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => onNavigate("Configurações")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Settings size={14} color="#6366F1" />
              <span>Configurações</span>
            </button>
          </div>
        </div>

        {/* Card Institucional Inferior */}
        <div
          style={{
            background: "linear-gradient(135deg, #081726 0%, #102A43 100%)",
            borderRadius: "12px",
            padding: "14px 18px",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(8, 23, 38, 0.15)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#E8AA42", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Inteligência & Segurança Jurídica
            </div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "2px 0", color: "#ffffff" }}>
              Seu trabalho mais eficiente com a Central Precatórios.
            </h3>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#94A3B8", maxWidth: "340px" }}>
              Mais de R$ 16,48 bilhões em ativos catalogados com due diligence 100% pública e sem login.
            </p>
          </div>

          <button
            onClick={() => onNavigate("Fila DEPRE")}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#E8AA42",
              color: "#081726",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(232, 170, 66, 0.4)",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
