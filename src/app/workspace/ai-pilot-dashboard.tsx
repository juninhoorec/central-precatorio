"use client";

import { useEffect, useState } from "react";
import styles from "./operations.module.css";
import type { PilotScorecard } from "@/lib/ai/ai-evaluator";
import type { PilotCorpusItem } from "@/lib/ai/ai-pilot-corpus";

export default function AIPilotDashboard() {
  const [scorecard, setScorecard] = useState<PilotScorecard | null>(null);
  const [items, setItems] = useState<PilotCorpusItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState("v1");
  const [error, setError] = useState("");

  const loadData = async (version = selectedPrompt) => {
    setBusy(true);
    setError("");
    try {
      const [resScore, resItems] = await Promise.all([
        fetch(`/api/ai/evaluate?promptVersion=${version}`),
        fetch("/api/ai/pilot")
      ]);
      if (resScore.ok) setScorecard(await resScore.json());
      if (resItems.ok) {
        const d = await resItems.json();
        setItems(d.items || []);
      }
    } catch {
      setError("Falha ao carregar benchmark de avaliação da IA.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [selectedPrompt]);

  return (
    <div className={styles.captureBox}>
      <div>
        <span>PILOTO DE QUALIDADE IA (CP 2.4.1)</span>
        <h2>Avaliação Objetiva do Qwen3:4b sobre Corpus Real</h2>
        <p>
          Medição de acurácia, falsos credores, confusão de advogados e taxa de abstenção em corpus anotado por humanos.
        </p>
      </div>

      <div className={styles.captureSearch}>
        <label>Versão do Prompt: </label>
        <select value={selectedPrompt} onChange={e => setSelectedPrompt(e.target.value)}>
          <option value="v1">v1 (Prompt Inicial CP 2.4)</option>
          <option value="v2">v2 (Prompt Refinado CP 2.4.1)</option>
        </select>
        <button disabled={busy} onClick={() => void loadData(selectedPrompt)}>
          {busy ? "Avaliando Corpus..." : "Executar Benchmark"}
        </button>
      </div>

      {error && <p className={styles.notice} style={{ color: "red" }}>{error}</p>}

      {scorecard && (
        <>
          <div className={styles.leadMetrics}>
            <article>
              <small>Casos no Corpus Pilot</small>
              <b>{scorecard.totalCases}</b>
            </article>
            <article>
              <small>Acurácia Geral</small>
              <b style={{ color: scorecard.metrics.accuracyPercent >= 80 ? "green" : "orange" }}>
                {scorecard.metrics.accuracyPercent}%
              </b>
            </article>
            <article>
              <small>Falso Credor (Taxa de Erro)</small>
              <b style={{ color: scorecard.metrics.falseCreditorRatePercent === 0 ? "green" : "red" }}>
                {scorecard.metrics.falseCreditorRatePercent}%
              </b>
            </article>
            <article>
              <small>Advogado como Credor (Alvo: 0%)</small>
              <b style={{ color: scorecard.metrics.attorneyAsCreditorRatePercent === 0 ? "green" : "red" }}>
                {scorecard.metrics.attorneyAsCreditorRatePercent}%
              </b>
            </article>
            <article>
              <small>Abstenção Correta</small>
              <b>{scorecard.metrics.correctAbstentionRatePercent}%</b>
            </article>
          </div>

          <h3>Detalhamento por Caso do Corpus ({scorecard.results.length} casos)</h3>
          <div className={styles.fields} style={{ flexDirection: "column", gap: "10px" }}>
            {scorecard.results.map((res) => {
              const isOk = res.taskResult.classification === "CORRECT" || res.taskResult.classification === "ABSTAINED_CORRECTLY";
              return (
                <div key={res.corpusItemId} style={{ padding: "12px", border: "1px solid #ccc", borderRadius: "6px", background: isOk ? "#f0fff4" : "#fff5f5" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <strong>{res.itemTitle}</strong>
                    <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: isOk ? "#c6f6d5" : "#fed7d7", color: isOk ? "#22543d" : "#742a2a" }}>
                      {res.taskResult.classification}
                    </span>
                  </div>
                  <small style={{ color: "#666" }}>Cenário: {res.scenarioType} | Falha: {res.taskResult.failureCategory}</small>
                  <p style={{ marginTop: "6px", fontSize: "13px" }}>{res.taskResult.reason}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
