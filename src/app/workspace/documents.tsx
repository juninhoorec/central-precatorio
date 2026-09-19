"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert, Search } from "lucide-react";
import styles from "./operations.module.css";
import DocumentIntelligenceViewer from "./document-intelligence-viewer";

type Document = {
  id: string;
  name: string;
  hash: string;
  size: number;
  status: "UPLOADED" | "QUARANTINED" | "SCANNING" | "SAFE" | "REJECTED" | "ARCHIVED";
  scanStatus: string;
  category: string;
  version: number;
  reviewerNotes: string;
  retentionUntil: string;
  createdAt: string;
  analysis?: {
    status: string;
    pages: number;
    fields: { field: string; value: string; page: number; confidence: number; method: string }[];
    matchStatus: string;
    matchReason: string;
    autoCategory: string;
  } | null;
};

const statusLabels: Record<string, string> = {
  UPLOADED: "Recebido",
  QUARANTINED: "Em quarentena",
  SCANNING: "Em verificação",
  SAFE: "Validado pelo fluxo configurado",
  REJECTED: "Rejeitado",
  ARCHIVED: "Arquivado",
};

const categories = [
  "IDENTIDADE",
  "CPF_CNPJ",
  "COMPROVANTE_ENDERECO",
  "PRECATORIO",
  "PROCESSO",
  "PROCURACAO",
  "PARECER_JURIDICO",
  "PROPOSTA",
  "CESSAO",
  "OUTRO",
];

export default function Documents({ operation }: { operation: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openViewerId, setOpenViewerId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`/api/operations/documents?operation=${operation}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDocs(d.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  }, [operation]);

  useEffect(() => {
    let active = true;
    fetch(`/api/operations/documents?operation=${operation}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d.documents as Document[];
      })
      .then((d) => {
        if (active) setDocs(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Falha ao carregar documentos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [operation]);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > 5 * 1024 * 1024) throw Error("O limite é de 5 MB por arquivo.");
      if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf"))
        throw Error("Selecione um arquivo PDF.");
      const r = await fetch(`/api/operations/documents?operation=${operation}`, {
        method: "POST",
        headers: { "content-type": "application/pdf", "x-file-name": encodeURIComponent(file.name) },
        body: file,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage("PDF recebido em quarentena. Nenhuma varredura real foi executada.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setBusy(false);
    }
  }

  async function review(doc: Document, patch: Partial<Document>) {
    setBusy(true);
    setError("");
    try {
      const payload = {
        id: doc.id,
        status: patch.status || doc.status,
        category: patch.category || doc.category,
        reviewerNotes: patch.reviewerNotes ?? doc.reviewerNotes,
        retentionUntil: patch.retentionUntil ?? doc.retentionUntil,
      };
      const r = await fetch("/api/operations/documents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDocs((v) => v.map((x) => (x.id === doc.id ? d.document : x)));
      setMessage("Classificação documental atualizada e auditada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na revisão.");
    } finally {
      setBusy(false);
    }
  }

  const active = docs.filter((d) => !["ARCHIVED", "REJECTED"].includes(d.status));
  const complete = active.length
    ? Math.round(
        (active.filter((d) => d.category !== "OUTRO" && ["UPLOADED", "SAFE"].includes(d.status)).length /
          active.length) *
          100
      )
    : 0;

  return (
    <div>
      <div className={styles.documentHead}>
        <div>
          <h3>Central de documentos</h3>
          <p>
            Completude operacional: <b>{complete}%</b> · {active.length} arquivo(s) ativo(s).
          </p>
        </div>
        <button onClick={() => void refresh()} disabled={loading || busy}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className={styles.notice}>
        <ShieldAlert />
        <div>
          <b>Armazenamento privado do MVP</b>
          <p>
            Downloads exigem sessão, organização e permissão. Sem antivírus configurado, novos arquivos permanecem
            em quarentena — nunca são marcados como seguros automaticamente.
          </p>
        </div>
      </div>

      <label>
        Adicionar PDF de até 5 MB
        <input
          disabled={busy}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </label>

      {busy && <p role="status">Processando documento…</p>}
      {loading && <p role="status">Carregando documentos…</p>}
      {error && (
        <div className={styles.error} role="alert">
          {error} <button onClick={() => void refresh()}>Tentar novamente</button>
        </div>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}

      {!loading && !error && docs.length === 0 ? (
        <p>Nenhum PDF anexado. A lista de documentos necessários deve ser definida para este caso.</p>
      ) : (
        docs.map((d) => (
          <article key={d.id} className={styles.documentCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <a href={`/api/operations/documents?id=${d.id}`} download>
                  {d.name}
                </a>
                <p>
                  {statusLabels[d.status]} · {d.scanStatus} · versão {d.version} · {(d.size / 1024).toFixed(1)} KB
                </p>
                <small>SHA-256: {d.hash}</small>
              </div>
              <button 
                onClick={() => setOpenViewerId(openViewerId === d.id ? null : d.id)}
                style={{ background: openViewerId === d.id ? "#e2e8f0" : undefined, color: openViewerId === d.id ? "#0f172a" : undefined }}
              >
                <Search size={14} style={{ marginRight: 6 }} /> 
                {openViewerId === d.id ? "Fechar Pesquisa" : "Pesquisar (IA)"}
              </button>
            </div>

            {openViewerId === d.id && (
              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <DocumentIntelligenceViewer documentId={d.id} />
              </div>
            )}

            {d.analysis && (
              <div className={styles.sourceNote}>
                <b>
                  {d.analysis.status} · {d.analysis.pages} página(s) · correspondência {d.analysis.matchStatus}
                </b>
                <span>
                  {d.analysis.matchReason} · Categoria sugerida: {d.analysis.autoCategory}
                </span>
                {d.analysis.status === "NO_TEXT" && (
                  <span>Este PDF parece digitalizado ou sem texto extraível. OCR será necessário.</span>
                )}
                {d.analysis.fields.map((f, i) => (
                  <p key={`${f.field}-${i}`}>
                    <b>{f.field}:</b> {f.value} · página {f.page} · confiança {f.confidence}% · {f.method}{" "}
                    <a href={`/api/operations/documents?id=${d.id}`} target="_blank" rel="noreferrer">
                      Ver evidência
                    </a>
                  </p>
                ))}
              </div>
            )}

            <div className={styles.fields}>
              <label>
                Categoria
                <select
                  disabled={busy}
                  value={d.category}
                  onChange={(e) => void review(d, { category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  disabled={busy}
                  value={d.status}
                  onChange={(e) => void review(d, { status: e.target.value as Document["status"] })}
                >
                  {["UPLOADED", "QUARANTINED", "SCANNING", "SAFE", "REJECTED", "ARCHIVED"].map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Retenção até
                <input
                  type="date"
                  value={d.retentionUntil}
                  onChange={(e) => void review(d, { retentionUntil: e.target.value })}
                />
              </label>
            </div>
            <label>
              Notas do revisor
              <textarea
                value={d.reviewerNotes}
                onChange={(e) =>
                  setDocs((v) => v.map((x) => (x.id === d.id ? { ...x, reviewerNotes: e.target.value } : x)))
                }
                onBlur={() => void review(d, { reviewerNotes: d.reviewerNotes })}
              />
            </label>
          </article>
        ))
      )}
    </div>
  );
}
