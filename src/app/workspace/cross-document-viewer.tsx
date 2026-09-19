"use client";

import { useState, useEffect } from "react";
import { Link2, Users, Activity, Clock, ShieldCheck } from "lucide-react";
import styles from "./operations.module.css";
import type { CrossDocumentAnalysisResult } from "@/lib/ai/cross-document-engine";

export default function CrossDocumentViewer({ operationId }: { operationId: string }) {
  const [analysis, setAnalysis] = useState<CrossDocumentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/ai/documents/cluster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationId })
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erro ao carregar cluster");
        if (active) setAnalysis(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [operationId]);

  if (loading) return <p role="status">Analisando agrupamento de documentos (Cross-Document)...</p>;
  if (error) return <p role="alert" className={styles.error}>{error}</p>;
  if (!analysis) return null;

  return (
    <div className={styles.form}>
      <div className={styles.notice} style={{ background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}>
        <ShieldCheck size={20} />
        <div>
          <b>Cross-Document Intelligence (Determinístico)</b>
          <p>
            {analysis.documentsAnalyzed} documento(s) e {analysis.coverage.pagesAnalyzed} página(s) analisados. {analysis.coverage.partial ? `Análise parcial; não analisados: ${analysis.coverage.documentsNotAnalyzed.join(", ")}.` : ""} As conclusões abaixo são baseadas em extração determinística e não substituem revisão humana.
          </p>
        </div>
      </div>

      <div className={styles.metrics}>
        <article>
          <small>DOCUMENTOS RELACIONADOS</small>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Link2 size={16} /> {analysis.relations.length > 0 ? "Vínculos encontrados" : "Sem vínculo determinístico"}
          </strong>
          <span>{analysis.relations.length} relação(ões) diretas.</span>
        </article>
        
        <article>
          <small>ESTADO DA TITULARIDADE</small>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={16} /> {analysis.currentHolderState.replaceAll("_", " ")}
          </strong>
          <span>Decisão humana necessária.</span>
        </article>
        
        <article>
          <small>CESSÃO / SUCESSÃO</small>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={16} /> 
            {analysis.cessionState.replaceAll("_", " ")}
          </strong>
          <span>
            {analysis.successionState.replaceAll("_", " ")}
          </span>
        </article>
      </div>

      <h3>Matriz de Fontes</h3>
      {analysis.sourceMatrix.length === 0 ? (
        <p>Nenhuma observação extraída no escopo analisado.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                <th style={{ padding: "12px" }}>Campo</th>
                <th style={{ padding: "12px" }}>Documentos Referência</th>
                <th style={{ padding: "12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sourceMatrix.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "12px", fontWeight: "bold" }}>{c.field}</td>
                  <td style={{ padding: "12px" }}>
                    {c.values.map(v => (
                      <div key={`${v.documentId}-${v.value}`} style={{ marginBottom: "8px" }}>
                        <div>Doc: {v.documentId.slice(0,6)}... → {v.value}</div>
                        {v.evidence.map(e => <details key={e.id} style={{ marginTop: "4px" }}><summary style={{ cursor: "pointer" }}>Página {e.page}: evidência</summary><p>{e.textSpan}</p></details>)}
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {c.status === "CONFLICT" ? (
                      <span style={{ color: "#ef4444", fontWeight: "bold" }}>CONFLITO</span>
                    ) : c.status === "AGREEMENT" ? (
                      <span style={{ color: "#22c55e", fontWeight: "bold" }}>DE ACORDO</span>
                    ) : c.status === "ONLY_SOURCE" ? (
                      <span style={{ color: "#64748b" }}>ÚNICA FONTE</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>DESCONHECIDO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Matriz de Partes (Cross-Document)</h3>
      {analysis.partyMatrix.length === 0 ? (
        <p>Nenhuma parte identificada através da evidência estrutural nos documentos analisados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {analysis.partyMatrix.map((p, i) => (
            <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <b>{p.name}</b>
                <span style={{ background: p.role === "ADVOGADO" ? "#fee2e2" : "#dbeafe", color: p.role === "ADVOGADO" ? "#991b1b" : "#1e40af", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                  {p.role}
                </span>
              </div>
              <p style={{ fontSize: "0.85em", color: "#475569", margin: 0 }}>
                Encontrado no documento {p.documentId.slice(0,6)}... com <b>{p.confidence}% de confiança estrutural</b>.
              </p>
              {p.evidence.length > 0 && (
                <details style={{ marginTop: "8px", fontSize: "0.8em" }}>
                  <summary style={{ cursor: "pointer", color: "#2563eb" }}>Ver Evidência</summary>
                  <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: "8px", marginTop: "4px", border: "1px solid #e2e8f0", borderRadius: "4px" }}>
                    {p.evidence.map(e => e.textSpan).join("\n---\n")}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <h3>Timeline do Dossiê</h3>
      <div style={{ borderLeft: "2px solid #e2e8f0", paddingLeft: "16px", marginLeft: "8px", display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
        {analysis.timeline.map((event, i) => (
          <div key={i} style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: "-23px", top: "2px", background: "#fff", color: "#94a3b8" }}>
              <Clock size={14} />
            </div>
            <time style={{ fontSize: "0.75em", color: "#64748b", fontWeight: "bold" }}>
              {new Date(event.date).toLocaleString("pt-BR")}
            </time>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>{event.event}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
