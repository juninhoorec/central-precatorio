"use client";

import { useState } from "react";
import { Search, FileText, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import styles from "./operations.module.css";

interface SearchResult {
  documentId: string;
  query: string;
  matches: Array<{
    pageIndex: number;
    text: string;
    score: number;
    context: string;
    isExact: boolean;
  }>;
  coverage: {
    pagesAnalyzed: number;
    totalPages: number;
    percentAnalyzed: number;
  };
  executionTimeMs: number;
  aiInsights?: Record<string, unknown> | null;
}

export default function DocumentIntelligenceViewer({
  documentId,
}: {
  documentId: string;
}) {
  const [query, setQuery] = useState("");
  const [requireExact, setRequireExact] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          query,
          requireExactMatch: requireExact,
        }),
      });

      const data = (await res.json()) as { error?: string } & SearchResult;
      if (!res.ok) throw new Error(data.error || "Search failed");

      setResult(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred during search";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.documentCard}>
      <div className={styles.documentHead}>
        <div>
          <h3>Document Intelligence & Evidence Engine</h3>
          <p>Localize informações no documento com validação determinística.</p>
        </div>
        <FileText size={24} />
      </div>

      <form onSubmit={handleSearch} className={styles.fields}>
        <label style={{ flex: 1 }}>
          Termo ou nome para buscar
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Banco do Brasil, Honorários..."
            disabled={loading}
          />
        </label>
        
        <label style={{ flex: 0, whiteSpace: "nowrap" }}>
          Busca Exata
          <input
            type="checkbox"
            checked={requireExact}
            onChange={(e) => setRequireExact(e.target.checked)}
            disabled={loading}
          />
        </label>

        <button type="submit" disabled={loading || !query} style={{ alignSelf: "flex-end" }}>
          <Search size={16} /> {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && (
        <div className={styles.error}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "16px" }}>
          <div className={styles.sourceNote}>
            <b>
              {result.coverage.pagesAnalyzed} de {result.coverage.totalPages} páginas analisadas
            </b>
            <span>
              ({Math.round(result.coverage.percentAnalyzed)}% cobertura) · {result.executionTimeMs}ms
            </span>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h4>Resultados ({result.matches.length} encontrados)</h4>
            {result.matches.length === 0 ? (
              <p>Nenhuma correspondência encontrada no documento.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {result.matches.map((match, i) => (
                  <li key={i} style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <b>Página {match.pageIndex + 1}</b>
                      {match.isExact ? (
                        <span style={{ color: "green", fontSize: "0.85em", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={14} /> Exato
                        </span>
                      ) : (
                        <span style={{ color: "#eab308", fontSize: "0.85em", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Search size={14} /> Parcial (Score: {match.score})
                        </span>
                      )}
                    </div>
                    
                    <p style={{ fontSize: "0.9em", fontStyle: "italic", background: "#f8fafc", padding: "8px", borderRadius: "4px", margin: 0 }}>
                      &ldquo;...{match.context}...&rdquo;
                    </p>
                    
                    <div style={{ marginTop: "8px", textAlign: "right" }}>
                      <a 
                        href={`/api/operations/documents?id=${documentId}#page=${match.pageIndex + 1}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: "0.85em", display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", textDecoration: "none" }}
                      >
                        <ExternalLink size={14} /> Ver página original
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {result.aiInsights && (
            <div className={styles.notice} style={{ marginTop: "16px" }}>
              <b>Análise de IA:</b>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85em", marginTop: "8px" }}>
                {JSON.stringify(result.aiInsights, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
