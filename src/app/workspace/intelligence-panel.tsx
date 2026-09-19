"use client";

import { useEffect, useState } from "react";
import styles from "./operations.module.css";
import type { AIHealthStatus } from "@/lib/ai/ollama-provider";
import AIPilotDashboard from "./ai-pilot-dashboard";
import RealPilotDashboard from "./real-pilot-dashboard";

type HealthResponse = Pick<AIHealthStatus, "status"> & Partial<Omit<AIHealthStatus, "status">>;

export default function IntelligencePanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const checkHealth = async (refresh = false) => {
    setCheckingHealth(true);
    try {
      const response = await fetch(`/api/ai/health${refresh ? "?refresh=true" : ""}`);
      setHealth(await response.json() as HealthResponse);
    } catch {
      setHealth({ status: "OLLAMA_OFFLINE", error: "Failed to fetch health check" });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/ai/health")
      .then(async (response) => {
        const result = await response.json() as HealthResponse;
        if (active) setHealth(result);
      })
      .catch(() => {
        if (active) setHealth({ status: "OLLAMA_OFFLINE", error: "Failed to fetch health check" });
      });
    return () => { active = false; };
  }, []);

  if (!health) return <div className={styles.form}>Verificando status da IA local...</div>;

  return (
    <div className={styles.form}>
      <div className={styles.caseSummary}>
        <article>
          <small>STATUS DA IA LOCAL (OLLAMA)</small>
          <strong>{health.status === "READY" ? "🟢 Operacional" : "🔴 Indisponível"}</strong>
          <span>{health.error ? health.error : `${health.model || "qwen3:4b"} · ${health.latencyMs ?? "—"} ms`}</span>
          <small>Última verificação: {health.lastChecked ? new Date(health.lastChecked).toLocaleString("pt-BR") : "Não verificado"}</small>
          <button type="button" onClick={() => void checkHealth(true)} disabled={checkingHealth}>
            {checkingHealth ? "Verificando..." : "Verificar IA"}
          </button>
        </article>
      </div>

      {health.status !== "READY" && (
        <div className={styles.notice}>
          <div>
            <b>IA local indisponível</b>
            <p>O CP continuará operando com regras e dados estruturados.</p>
          </div>
        </div>
      )}

      <h3>Inteligência CP</h3>
      <p>Resumo Inteligente</p>
      <div className={styles.fields}>
        <textarea 
          readOnly 
          rows={5} 
          value="O registro possui Processo DEPRE identificado, mas o relatório não identifica expressamente o credor. Uma consulta complementar encontrou possíveis partes. O papel de beneficiário ainda não foi confirmado."
        />
      </div>
      <button onClick={() => alert("Simulando execução assíncrona...")}>Gerar novo resumo</button>

      <RealPilotDashboard />
      <AIPilotDashboard />
    </div>
  );
}
