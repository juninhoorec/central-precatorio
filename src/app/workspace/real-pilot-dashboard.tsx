"use client";

import { useEffect, useState } from "react";
import styles from "./operations.module.css";
import type { AIExperimentResult } from "@/lib/ai/ai-experiment-runner";

export default function RealPilotDashboard() {
  const [experiment, setExperiment] = useState<AIExperimentResult | null>(null);
  const [experimentId, setExperimentId] = useState("CP24-PILOT-001");
  const [promptVersion, setPromptVersion] = useState("v1");
  const [useRegression, setUseRegression] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const runExperiment = async () => {
    setBusy(true);
    setError("");
    setReviewMessage("");
    try {
      const res = await fetch("/api/ai/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId, promptVersion, regression: useRegression }),
      });
      if (!res.ok) throw new Error("Falha ao executar piloto real.");
      const data = await res.json();
      setExperiment(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro de execução do experimento real.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runExperiment();
  }, [promptVersion, useRegression]);

  const recordReview = async (corpusItemId: string, decision: string, reason: string) => {
    if (!experiment?.runId) {
      setReviewMessage("Execute novamente o piloto antes de registrar uma revisão.");
      return;
    }
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corpusItemId,
          experimentId,
          aiRunId: experiment.runId,
          decision,
          reason,
          notes: `Revisado pelo analista via painel CP 2.4.2 em ${new Date().toLocaleTimeString("pt-BR")}`
        })
      });
      if (res.ok) {
        setReviewMessage(`Decisão "${decision}" gravada para o caso com motivo ${reason}.`);
      }
    } catch {
      setReviewMessage("Falha ao registrar decisão humana.");
    }
  };

  if (busy && !experiment) return <div className={styles.form}>Carregando experimento real da IA...</div>;

  return (
    <div className={styles.captureBox}>
      <div>
        <span>PILOTO REAL DE INFERÊNCIA DA IA (CP 2.4.2)</span>
        <h2>Benchmark de Execução Real — Qwen3:4b (Ollama Local)</h2>
        <p>
          Execução de inferência sobre documentos reais com comportamentos medidos, cache e análise de falhas. Nenhuma resposta é forçada.
        </p>
      </div>

      {experiment && (
        <>
          {/* Readiness Gate Status */}
          <div className={styles.caseSummary}>
            <article>
              <small>PORTAL DE PRONTIDÃO (READINESS GATE)</small>
              <strong style={{ color: experiment.readinessGateStatus === "PASSED" ? "green" : "red" }}>
                {experiment.readinessGateStatus === "PASSED" ? "🟢 LIBERADO (READY)" : `🔴 BLOQUEADO: ${experiment.readinessGateReason}`}
              </strong>
              <span>Provedor: {experiment.provider} | Modelo: {experiment.model}</span>
            </article>
            <article>
              <small>COMPOSIÇÃO DO CORPUS</small>
              <strong>{experiment.corpusComposition.totalCases} Casos Reais</strong>
              <span>
                {experiment.corpusComposition.realOfficialCases} Oficiais · {experiment.corpusComposition.realDocumentCases} Documentos · {experiment.corpusComposition.syntheticCases} Sintéticos
              </span>
            </article>
          </div>

          {experiment.readinessGateStatus === "BLOCKED" && (
            <div className={styles.notice} style={{ borderLeft: "4px solid red" }}>
              <div>
                <b>REAL INFERENCE PILOT BLOQUEADO</b>
                <p>
                  O serviço Ollama ou o modelo <code>qwen3:4b</code> não está disponível localmente. 
                  O CP respeita a trava de segurança e <b>NÃO substitui</b> respostas por mocks simulados. O sistema continuará operando com regras determinísticas.
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={styles.captureSearch}>
            <label>ID do Experimento:
              <input value={experimentId} onChange={e => setExperimentId(e.target.value)} style={{ width: "140px", marginLeft: "6px" }} />
            </label>
            <label>Prompt:
              <select value={promptVersion} onChange={e => setPromptVersion(e.target.value)} style={{ marginLeft: "6px" }}>
                <option value="v1">v1 (Prompt Inicial CP 2.4)</option>
                <option value="v2">v2 (Prompt Refinado CP 2.4.2)</option>
              </select>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <input type="checkbox" checked={useRegression} onChange={e => setUseRegression(e.target.checked)} />
              Apenas Conjunto de Regressão
            </label>
            <button disabled={busy} onClick={() => void runExperiment()}>
              {busy ? "Executando..." : "Rodar Experimento Real"}
            </button>
          </div>

          {error && <p role="status" style={{ color: "red" }}>{error}</p>}
          {reviewMessage && <p role="status" style={{ color: "green" }}>{reviewMessage}</p>}

          {/* Task Classification Policy Table */}
          <h3>Classificação de Segurança por Tarefa de IA</h3>
          <div className={styles.fields}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Tarefas da IA</th>
                  <th style={{ padding: "8px" }}>Status de Segurança Atribuído</th>
                  <th style={{ padding: "8px" }}>Diretriz Operacional</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px" }}>RELEVANT_PAGE_FINDING</td>
                  <td style={{ padding: "8px", color: "green", fontWeight: "bold" }}>VALIDATED_FOR_ASSISTED_USE</td>
                  <td style={{ padding: "8px" }}>Uso assistido permitido com citação de página.</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>DOCUMENT_SUMMARY</td>
                  <td style={{ padding: "8px", color: "green", fontWeight: "bold" }}>VALIDATED_FOR_ASSISTED_USE</td>
                  <td style={{ padding: "8px" }}>Uso assistido com amostragem de fatos.</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>CREDITOR_CANDIDATE_EXTRACTION</td>
                  <td style={{ padding: "8px", color: "orange", fontWeight: "bold" }}>EXPERIMENTAL</td>
                  <td style={{ padding: "8px" }}>Exige revisão humana explícita antes de qualquer promoção.</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px" }}>CANONICAL_FIELD_AUTO_WRITE</td>
                  <td style={{ padding: "8px", color: "red", fontWeight: "bold" }}>UNSAFE</td>
                  <td style={{ padding: "8px" }}>Escrita automática desativada e proibida na arquitetura.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Metrics Scorecard */}
          {experiment.scorecard && (
            <>
              <h3>Scorecard do Experimento {experiment.experimentId} ({experiment.scorecard.promptVersion})</h3>
              <div className={styles.leadMetrics}>
                <article>
                  <small>Acurácia Global</small>
                  <b>{experiment.scorecard.metrics.accuracyPercent}%</b>
                </article>
                <article>
                  <small>Falso Credor (Taxa de Erro)</small>
                  <b style={{ color: experiment.scorecard.metrics.falseCreditorRatePercent === 0 ? "green" : "red" }}>
                    {experiment.scorecard.metrics.falseCreditorRatePercent}%
                  </b>
                </article>
                <article>
                  <small>Advogado como Credor (Alvo: 0%)</small>
                  <b style={{ color: experiment.scorecard.metrics.attorneyAsCreditorRatePercent === 0 ? "green" : "red" }}>
                    {experiment.scorecard.metrics.attorneyAsCreditorRatePercent}%
                  </b>
                </article>
                <article>
                  <small>Cache Hit Rate</small>
                  <b>{experiment.cacheMetrics.cacheHitRatePercent}% ({experiment.cacheMetrics.cacheHits} hits)</b>
                </article>
                <article>
                  <small>Latência Média</small>
                  <b>{experiment.latencySummary.averageLatencyMs} ms</b>
                </article>
              </div>

              {/* Case by case review queue */}
              <h3>Fila de Avaliação Humana e Evidências ({experiment.scorecard.results.length} casos)</h3>
              <div className={styles.fields} style={{ flexDirection: "column", gap: "12px" }}>
                {experiment.scorecard.results.map((res) => (
                  <div key={res.corpusItemId} style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "6px", background: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>{res.itemTitle}</b>
                      <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: "#e2e8f0" }}>
                        {res.taskResult.classification}
                      </span>
                    </div>
                    <small>Cenário: {res.scenarioType} | Falha: {res.taskResult.failureCategory} | Latência: {res.taskResult.latencyMs}ms</small>
                    <p style={{ margin: "6px 0", fontSize: "13px" }}>{res.taskResult.reason}</p>

                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button style={{ fontSize: "12px" }} onClick={() => void recordReview(res.corpusItemId, "APROVAR", "CORRECT_EVIDENCE")}>Aprovar</button>
                      <button style={{ fontSize: "12px" }} onClick={() => void recordReview(res.corpusItemId, "REJEITAR", "MODEL_ERROR")}>Rejeitar</button>
                      <button style={{ fontSize: "12px" }} onClick={() => void recordReview(res.corpusItemId, "CORRIGIR", "HUMAN_CORRECTION")}>Corrigir</button>
                      <button style={{ fontSize: "12px" }} onClick={() => void recordReview(res.corpusItemId, "INCONCLUSIVO", "UNSUPPORTED")}>Inconclusivo</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
