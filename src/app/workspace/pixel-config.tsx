"use client";

import React, { useState } from "react";
import {
  Settings,
  Save,
  Building2,
  Bell,
  Lock,
  Link2,
  Code,
  Shield,
  Check,
  Moon,
  Smartphone,
  Mail,
} from "lucide-react";

export default function PixelConfig() {
  const [activeTab, setActiveTab] = useState<"geral" | "integracoes" | "notificacoes" | "permissoes" | "api">("geral");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhats, setNotifWhats] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", maxWidth: "100%" }}>
      {/* ── CABEÇALHO COM BOTÃO SALVAR ALTERAÇÕES (DOURADO) ── */}
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
              background: "#F1F5F9",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Configurações
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
              Personalize sua plataforma, integrações públicas e preferências institucionais.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
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
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Alterações Salvas!" : "Salvar Alterações"}
        </button>
      </div>

      {/* ── ABAS SUPERIORES ── */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          background: "#ffffff",
          borderRadius: "12px",
          padding: "6px 8px",
          border: "1px solid #E2E8F0",
          overflowX: "auto",
        }}
      >
        {[
          { id: "geral", label: "Geral" },
          { id: "integracoes", label: "Integrações" },
          { id: "notificacoes", label: "Notificações" },
          { id: "permissoes", label: "Permissões" },
          { id: "api", label: "API" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === item.id ? "#E8AA42" : "transparent",
              color: activeTab === item.id ? "#081726" : "#64748B",
              fontSize: "0.82rem",
              fontWeight: activeTab === item.id ? 800 : 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── CARDS EM DUAS COLUNAS: DADOS DA EMPRESA + PREFERÊNCIAS DO SISTEMA ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "14px",
          alignItems: "start",
        }}
      >
        {/* Card 1: Dados da Empresa */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
            <Building2 size={18} color="#0284C7" />
            <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Dados da Empresa
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                Nome da Empresa
              </label>
              <input
                defaultValue="Central Precatórios Operações Judiciais Ltda."
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  color: "#081726",
                  background: "#F8FAFC",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                CNPJ
              </label>
              <input
                defaultValue="12.345.678/0001-90"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  color: "#081726",
                  background: "#F8FAFC",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                E-mail Institucional
              </label>
              <input
                defaultValue="contato@centralprecatorios.com.br"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  color: "#081726",
                  background: "#F8FAFC",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Preferências do Sistema */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            padding: "22px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
            <Settings size={18} color="#E8AA42" />
            <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#081726", margin: 0 }}>
              Preferências do Sistema
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Toggle 1: Notificações por e-mail */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#081726" }}>Notificações por e-mail</div>
                <div style={{ fontSize: "0.74rem", color: "#64748B" }}>Receber resumos de novos precatórios na fila</div>
              </div>
              <button
                onClick={() => setNotifEmail(!notifEmail)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "999px",
                  background: notifEmail ? "#0284C7" : "#CBD5E1",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: notifEmail ? "23px" : "3px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {/* Toggle 2: Alertas no WhatsApp */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#081726" }}>Alertas no WhatsApp</div>
                <div style={{ fontSize: "0.74rem", color: "#64748B" }}>Alertas imediatos para precatórios prioritários (≥ 1M)</div>
              </div>
              <button
                onClick={() => setNotifWhats(!notifWhats)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "999px",
                  background: notifWhats ? "#0284C7" : "#CBD5E1",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: notifWhats ? "23px" : "3px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {/* Toggle 3: Modo Escuro */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#081726" }}>Modo Escuro</div>
                <div style={{ fontSize: "0.74rem", color: "#64748B" }}>Interface executiva noturna de alto contraste</div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "999px",
                  background: darkMode ? "#0284C7" : "#CBD5E1",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: darkMode ? "23px" : "3px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
