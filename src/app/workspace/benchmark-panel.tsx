"use client";
import { useEffect, useState } from "react";
import styles from "./operations.module.css";
type Summary = {
  totalExternal: number;
  totalCp: number;
  matches: number;
  matchesByDEPRE?: number;
  onlyExternal: number;
  onlyCp: number;
  duplicates: number;
  conflicts: number;
  incomplete: number;
  qualified: number;
  reviewRequired: number;
  rpvs: number;
  notice: string;
};
type Report = {
  id: string;
  fileName: string;
  createdAt: string;
  contentHash: string;
  actorUserId: string;
  summary: Summary;
};
type Sheet = { name: string; rows: string[][]; recordsFound: number };
export default function BenchmarkPanel() {
  const [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<Sheet[]>([]),
    [sheet, setSheet] = useState(""),
    [report, setReport] = useState<Report | null>(null),
    [history, setHistory] = useState<Report[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function refresh() {
    const r = await fetch("/api/capture/benchmark", { cache: "no-store" });
    if (r.ok) setHistory((await r.json()).reports);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/capture/benchmark", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setHistory(d.reports);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function preview(next: File) {
    setFile(next);
    setReport(null);
    setMessage("");
    const form = new FormData();
    form.set("file", next);
    const r = await fetch("/api/capture/preview", {
        method: "POST",
        body: form,
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Não foi possível ler a planilha.");
      return;
    }
    const list = (d.sheets || []) as Sheet[];
    setSheets(list);
    setSheet(d.kind === "csv" ? "CSV" : list.length === 1 ? list[0].name : "");
  }
  async function compare() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("sheet", sheet);
      const r = await fetch("/api/capture/benchmark", {
          method: "POST",
          body: form,
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setReport(d.report);
      setMessage(
        d.alreadyProcessed
          ? "Este arquivo já foi comparado; exibindo o relatório existente."
          : `${d.report.summary.totalExternal} linhas comparadas. ${d.errors?.length || 0} erro(s) de leitura foram registrados.`,
      );
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Falha ao comparar os arquivos.",
      );
    } finally {
      setBusy(false);
    }
  }
  function exportReport() {
    if (!report) return;
    const rows = [
      ["Métrica", "CP", "Fonte externa", "Resultado"],
      [
        "Registros",
        String(report.summary.totalCp),
        String(report.summary.totalExternal),
        "Volumes observados",
      ],
      ["Correspondências", "", "", String(report.summary.matches)],
      ["Correspondências por Nº Processo DEPRE", "", "", String(report.summary.matchesByDEPRE || 0)],
      ["Somente na fonte externa", "", "", String(report.summary.onlyExternal)],
      ["Somente no CP", "", "", String(report.summary.onlyCp)],
      ["Duplicidades externas", "", "", String(report.summary.duplicates)],
      ["Conflitos de valor", "", "", String(report.summary.conflicts)],
      ["Registros incompletos", "", "", String(report.summary.incomplete)],
      ["Qualificados pelo perfil CP", "", "", String(report.summary.qualified)],
      ["Revisão necessária", "", "", String(report.summary.reviewRequired)],
      ["RPVs", "", "", String(report.summary.rpvs)],
    ];
    const csv = rows
        .map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(";"))
        .join("\r\n"),
      url = URL.createObjectURL(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `benchmark-captacao-${report.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <details className={styles.benchmarkPanel}>
      <summary>Benchmark Mode · comparar saída externa com CP</summary>
      <div>
        <p>
          Importe um CSV/XLS/XLSX exportado pelo captador atual. O CP compara
          identificadores e valores com os registros da organização, sem alterar
          oportunidades nem atribuir vencedor. Leads externos sem
          identificadores suficientes ficam incompletos.
        </p>
        <label className={styles.importButton}>
          Selecionar arquivo de benchmark
          <input
            id="benchmark-file"
            type="file"
            accept=".csv,.xls,.xlsx,text/csv"
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) void preview(next);
            }}
          />
        </label>
        {file && (
          <>
            <b>{file.name}</b>
            {sheets.length > 1 && (
              <label>
                Planilha
                <select
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value)}
                >
                  <option value="">Escolha uma aba</option>
                  {sheets.map((s) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button disabled={busy || !sheet} onClick={() => void compare()}>
              {busy ? "Comparando…" : "Gerar comparação factual"}
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
        {report && (
          <>
            <div className={styles.benchmarkMetrics}>
              {[
                ["Registros CP", report.summary.totalCp],
                ["Fonte externa", report.summary.totalExternal],
                ["Correspondências", report.summary.matches],
                ["Correspondências por Nº Processo DEPRE", report.summary.matchesByDEPRE || 0],
                ["Somente externo", report.summary.onlyExternal],
                ["Somente CP", report.summary.onlyCp],
                ["Duplicidades", report.summary.duplicates],
                ["Conflitos", report.summary.conflicts],
                ["Incompletos", report.summary.incomplete],
                ["Qualificados no perfil", report.summary.qualified],
                ["Revisão necessária", report.summary.reviewRequired],
                ["RPVs", report.summary.rpvs],
              ].map(([label, value]) => (
                <article key={String(label)}>
                  <small>{label}</small>
                  <b>{value}</b>
                </article>
              ))}
            </div>
            <p>{report.summary.notice}</p>
            <button onClick={exportReport}>
              Exportar relatório comparativo CSV
            </button>
          </>
        )}
      </div>
      <details>
        <summary>Histórico de benchmarks ({history.length})</summary>
        {history.length ? (
          history.map((item) => (
            <article className={styles.sourceChange} key={item.id}>
              <b>
                {item.fileName} ·{" "}
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </b>
              <span>
                {item.summary.matches} correspondências ·{" "}
                {item.summary.conflicts} conflitos · {item.summary.qualified}{" "}
                qualificados no perfil
              </span>
              <code>SHA-256 {item.contentHash}</code>
            </article>
          ))
        ) : (
          <p>Nenhuma comparação importada nesta organização.</p>
        )}
      </details>
    </details>
  );
}
