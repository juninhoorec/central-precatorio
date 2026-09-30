"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Play,
  RefreshCw,
  ExternalLink,
  Download,
  ShieldCheck,
  Bot,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import styles from "./operations.module.css";
import type { AcquisitionJob } from "@/lib/autonomous-acquisition";
import type { Operation } from "@/lib/operations";

type Metrics = {
  total: number;
  analyzed: number;
  inAnalysis: number;
  qualified: number;
  ready: number;
  rejected: number;
  waitingSource: number;
  conflicts: number;
  errors: number;
  revalidation: number;
  byState: Record<string, number>;
};

type SourceEventDetails = {
  requestAttempted?: boolean;
  cached?: boolean;
  communicationCount?: number;
  partyCandidates?: Array<{
    name: string;
    role: string;
    roleEvidence: string;
  }>;
  communications?: Array<{
    id: string;
    hash: string;
    tribunal: string;
    courtUnit: string;
    communicationType: string;
    publicationDate: string;
    text: string;
    textTruncated: boolean;
    certificateUrl: string;
    partyObservations: Array<{
      name: string;
      role: string;
      roleEvidence: string;
    }>;
  }>;
};

type CaseDetailData = {
  operation: Operation;
  officialEvidence: Array<{
    id: string;
    documentType: string;
    title: string;
    source: string;
    sourceUrl: string;
    downloadUrl: string;
    publishedAt: string;
    collectedAt: string;
    documentIdentifier: string;
    reference: string;
    page: number | null;
    hash: string;
    status: string;
    evidenceStrength: string;
    notes: string;
  }>;
  contacts: Array<{
    id: string;
    type: string;
    value: string;
    source: string;
    sourceUrl: string;
    collectedAt: string;
    confidence: number;
  }>;
  sourceEvents: Array<{
    id: string;
    sourceId: string;
    eventType: string;
    status: string;
    queryIdentifier: string;
    sourceUrl: string;
    consultedAt: string;
    httpStatus: number | null;
    accessResult: string;
    failureReason: string;
    details: SourceEventDetails;
  }>;
  readiness: {
    state: string;
    reasons: string[];
    criteria: Array<{
      key: string;
      label: string;
      mandatory: boolean;
      ok: boolean;
      detail: string;
    }>;
    ready: boolean;
    nextAction: string;
  };
  summaryText: {
    header: string;
    creditor: string;
    value: number;
    depre: string;
    process: string;
    debtor: string;
    nature: string;
    contact: Array<Record<string, unknown>>;
    officialEvidenceCount: string;
    primarySource: string;
    referenceDate: string;
    lastUpdated: string;
    identityConfidence: string;
    conflicts: string[];
    status: string;
    nextAction: string;
    evidenceLinks: Array<{
      title: string;
      sourceUrl: string;
      downloadUrl: string | null;
    }>;
  };
};

type DashboardData = {
  metrics: Metrics;
  processingNow: AcquisitionJob | null;
  jobs?: AcquisitionJob[];
  total?: number;
  nextAlertAt?: string;
};

async function fetchDashboardData(
  page: number,
  statusFilter: string,
  debtorFilter: string,
): Promise<DashboardData> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "30");
  if (statusFilter) params.set("status", statusFilter);
  if (debtorFilter) params.set("debtor", debtorFilter);

  const response = await fetch(`/api/autonomous?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar o painel autônomo.");
  }
  return response.json();
}

const money = (n: number) =>
  n ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function AutonomousPanel() {
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    analyzed: 0,
    inAnalysis: 0,
    qualified: 0,
    ready: 0,
    rejected: 0,
    waitingSource: 0,
    conflicts: 0,
    errors: 0,
    revalidation: 0,
    byState: {},
  });
  const [processingNow, setProcessingNow] = useState<AcquisitionJob | null>(
    null,
  );
  const [jobs, setJobs] = useState<AcquisitionJob[]>([]);
  const [nextAlertAt, setNextAlertAt] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [debtorFilter, setDebtorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState("RESUMO");

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboardData(page, statusFilter, debtorFilter);
      setError("");
      setMetrics(data.metrics);
      setProcessingNow(data.processingNow);
      setJobs(data.jobs || []);
      setTotalRecords(data.total || 0);
      setNextAlertAt(data.nextAlertAt || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debtorFilter]);

  useEffect(() => {
    let active = true;
    async function loadInitialDashboard() {
      try {
        const data = await fetchDashboardData(page, statusFilter, debtorFilter);
        if (active) {
          setError("");
          setMetrics(data.metrics);
          setProcessingNow(data.processingNow);
          setJobs(data.jobs || []);
          setTotalRecords(data.total || 0);
          setNextAlertAt(data.nextAlertAt || "");
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Erro desconhecido.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialDashboard();
    return () => {
      active = false;
    };
  }, [page, statusFilter, debtorFilter]);

  async function runWorkerCycle() {
    setExecuting(true);
    setError("");
    try {
      const r = await fetch("/api/autonomous", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao executar ciclo.");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na execução do worker.");
    } finally {
      setExecuting(false);
    }
  }

  async function openCaseDetail(operationId: string) {
    setSelectedCaseId(operationId);
    setLoadingDetail(true);
    setActiveTab("RESUMO");
    try {
      const r = await fetch(`/api/autonomous/cases/${operationId}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("Falha ao carregar detalhes do caso.");
      const data = await r.json();
      setCaseDetail(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir o caso.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  const statusBadges: Record<string, { label: string; color: string }> = {
    DISCOVERED: { label: "DESCOBERTO", color: "#607887" },
    FILTERING: { label: "FILTRANDO", color: "#2563eb" },
    ELIGIBILITY_CHECK: { label: "CHECANDO ELEGIBILIDADE", color: "#2563eb" },
    INVESTIGATING: { label: "EM ANÁLISE", color: "#d97706" },
    RESOLVING_CREDITOR: { label: "RESOLVENDO CREDOR", color: "#d97706" },
    COLLECTING_EVIDENCE: { label: "COLETANDO OFÍCIOS", color: "#2563eb" },
    COLLECTING_CONTACT: { label: "ENRIQUECENDO CONTATO", color: "#2563eb" },
    CROSS_CHECKING: { label: "CRUZANDO EVIDÊNCIAS", color: "#2563eb" },
    QUALIFIED_WITH_PENDING: { label: "QUALIFICADO C/ PENDÊNCIA", color: "#ca8a04" },
    READY_FOR_ANALYST: { label: "READY PARA ANALISTA", color: "#16a34a" },
    REJECTED: { label: "REPROVADO", color: "#dc2626" },
    SOURCE_BLOCKED: { label: "FONTE BLOQUEADA (CAPTCHA)", color: "#9333ea" },
    WAITING: { label: "AGUARDANDO FONTE", color: "#4b5563" },
    ERROR: { label: "ERRO DE PROCESSAMENTO", color: "#dc2626" },
    PAUSED: { label: "PAUSADO", color: "#4b5563" },
  };

  const sections = [
    "RESUMO",
    "IDENTIDADE DO CREDOR",
    "CRÉDITO",
    "PROCESSO",
    "FONTES",
    "OFÍCIOS / DOCUMENTOS OFICIAIS",
    "CONTATOS",
    "CONFLITOS",
    "HISTÓRICO",
    "IA",
    "PRÓXIMA AÇÃO",
    "AUDITORIA",
  ];

  return (
    <div className={styles.leadDashboard}>
      {/* HEADER & METRICS */}
      <div className={styles.leadIntro}>
        <div>
          <span>MOTOR DE CAPTAÇÃO AUTÔNOMA · PRECATÓRIOS SP</span>
          <h2>Captação Autônoma</h2>
          <p>
            Processamento contínuo em background. O analista recebe somente os
            casos qualificados com evidências oficiais verificadas.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void loadDashboard();
            }}
          >
            <RefreshCw size={16} /> Atualizar
          </button>
          <button disabled={executing} onClick={() => void runWorkerCycle()}>
            <Play size={16} />{" "}
            {executing ? "Executando..." : "Executar ciclo autônomo"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* METRICS BAR */}
      <div
        className={styles.leadMetrics}
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
      >
        <article>
          <small>TOTAL NA FILA</small>
          <b>{metrics.total}</b>
        </article>
        <article>
          <small>ANALISADOS</small>
          <b>{metrics.analyzed}</b>
        </article>
        <article>
          <small>EM ANÁLISE</small>
          <b>{metrics.inAnalysis}</b>
        </article>
        <article>
          <small>READY PARA ANALISTA</small>
          <b style={{ color: "#16a34a" }}>{metrics.ready}</b>
        </article>
        <article>
          <small>REPROVADOS</small>
          <b style={{ color: "#dc2626" }}>{metrics.rejected}</b>
        </article>
        <article>
          <small>QUALIFICADOS C/ PENDÊNCIA</small>
          <b>{metrics.qualified}</b>
        </article>
        <article>
          <small>AGUARDANDO FONTE</small>
          <b>{metrics.waitingSource}</b>
        </article>
        <article>
          <small>CONFLITOS</small>
          <b>{metrics.conflicts}</b>
        </article>
        <article>
          <small>ERROS</small>
          <b>{metrics.errors}</b>
        </article>
        <article>
          <small>REVALIDAÇÃO</small>
          <b>{metrics.revalidation}</b>
        </article>
      </div>

      {/* PROCESSAMENTO AGORA & ALERT BANNER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          background: "#f8fafb",
          border: "1px solid #dce4e8",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <div>
          <small
            style={{
              fontWeight: 700,
              color: "#ac481d",
              letterSpacing: "1px",
            }}
          >
            PROCESSAMENTO AGORA
          </small>
          {processingNow ? (
            <div style={{ marginTop: "8px" }}>
              <strong style={{ fontSize: "16px", display: "block" }}>
                DEPRE: {processingNow.summary?.depre as string || "Em resolução"}
              </strong>
              <span style={{ fontSize: "13px", color: "#526c7b" }}>
                Etapa: {processingNow.currentStep} · Fonte: TJSP/e-SAJ ·
                Iniciado: {new Date(processingNow.startedAt).toLocaleTimeString()}
              </span>
            </div>
          ) : (
            <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
              Motor em aguardo · Próximo lote na fila pronto para processamento.
            </p>
          )}
        </div>

        <div style={{ borderLeft: "1px solid #dce4e8", paddingLeft: "16px" }}>
          <small
            style={{
              fontWeight: 700,
              color: "#526c7b",
              letterSpacing: "1px",
            }}
          >
            AGENDA DE ALERTAS (TELEGRAM)
          </small>
          <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
            {nextAlertAt ? (
              <>
                Próximo alerta agendado:{" "}
                <b>{new Date(nextAlertAt).toLocaleString("pt-BR")}</b> (3
                alertas/dia útil)
              </>
            ) : (
              "Nenhum alerta pendente no momento."
            )}
          </p>
          <small style={{ color: "#718096" }}>
            Canal Telegram preparado no modelo; envio desativado até configuração.
          </small>
        </div>
      </div>

      {/* FILTERS & QUEUE TABLE */}
      <div className={styles.leadFilters}>
        <label>
          Filtrar por Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="READY_FOR_ANALYST">READY PARA ANALISTA</option>
            <option value="QUALIFIED_WITH_PENDING">QUALIFICADO C/ PENDÊNCIA</option>
            <option value="INVESTIGATING">EM ANÁLISE</option>
            <option value="WAITING">AGUARDANDO FONTE</option>
            <option value="SOURCE_BLOCKED">FONTE BLOQUEADA (CAPTCHA)</option>
            <option value="REJECTED">REPROVADO</option>
            <option value="ERROR">ERRO</option>
          </select>
        </label>
        <label>
          Busca por Devedora / Entidade
          <input
            placeholder="Ex: Município de São Paulo, Estado de SP..."
            value={debtorFilter}
            onChange={(e) => {
              setDebtorFilter(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ fontSize: "13px", color: "#607887" }}>
            Exibindo {(page - 1) * 30 + 1} - {Math.min(page * 30, totalRecords)}{" "}
            de {totalRecords} casos
          </span>
        </div>
      </div>

      {/* QUEUE TABLE */}
      <div className={styles.leadTableWrap}>
        <table className={styles.leadTable}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Credor</th>
              <th>DEPRE</th>
              <th>Valor</th>
              <th>Devedora</th>
              <th>Identidade</th>
              <th>Ofícios</th>
              <th>Contato</th>
              <th>Atualização</th>
              <th>Próxima Ação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "24px" }}>
                  Carregando fila de captação autônoma...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "24px" }}>
                  Nenhum caso encontrado na fila para os filtros selecionados.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const s = statusBadges[job.status] || {
                  label: job.status,
                  color: "#4b5563",
                };
                const summary = job.summary || {};
                const creditor = (summary.creditor as string) || "Não identificado";
                const depre =
                  (summary.depre as string) ||
                  "Não identificado na fonte consultada";
                const val = (summary.value as number) || 0;
                const debtor = (summary.debtor as string) || "—";
                const oficios = (summary.officialEvidence as string) || "0/2";
                const contactArr = (summary.contact as Array<Record<string, unknown>>) || [];
                const contactText =
                  contactArr.length > 0 ? "Contato localizado" : "Não localizado";

                return (
                  <tr
                    key={job.id}
                    onClick={() => void openCaseDetail(job.operationId)}
                  >
                    <td>
                      <span
                        className={styles.qualityPill}
                        style={{ background: s.color, color: "#fff" }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td>
                      <b>{creditor}</b>
                    </td>
                    <td>
                      <code>{depre}</code>
                    </td>
                    <td>
                      <strong>{money(val)}</strong>
                    </td>
                    <td>{debtor}</td>
                    <td>
                      <small>
                        {(summary.identityState as string) || "Não checado"}
                      </small>
                    </td>
                    <td>
                      <b>Ofícios: {oficios}</b>
                    </td>
                    <td>
                      <small>{contactText}</small>
                    </td>
                    <td>
                      <small>
                        {new Date(job.updatedAt).toLocaleDateString("pt-BR")}
                      </small>
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void openCaseDetail(job.operationId);
                        }}
                      >
                        Investigar caso
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "12px",
        }}
      >
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Página anterior
        </button>
        <span>Página {page}</span>
        <button
          disabled={page * 30 >= totalRecords || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima página
        </button>
      </div>

      {/* CASE INVESTIGATION DETAIL MODAL */}
      {selectedCaseId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "1100px",
              maxHeight: "90vh",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* MODAL HEADER */}
            <div
              style={{
                padding: "20px",
                background: "#071d30",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <small
                  style={{
                    color: "#edca79",
                    fontWeight: 700,
                    letterSpacing: "1px",
                  }}
                >
                  INVESTIGAÇÃO DETALHADA DO CASO
                </small>
                <h3 style={{ margin: "4px 0 0", color: "#fff" }}>
                  {caseDetail?.operation?.title || "Carregando caso..."}
                </h3>
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedCaseId(null)}
              >
                <X size={24} />
              </button>
            </div>

            {loadingDetail || !caseDetail ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                Carregando evidências e 12 seções do caso...
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  flex: 1,
                }}
              >
                {/* QUALIFICATION CHECKLIST TOP BANNER */}
                <div
                  style={{
                    padding: "16px 20px",
                    background: "#f0f4f8",
                    borderBottom: "1px solid #dce4e8",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}
                  >
                    <strong>QUALIFICAÇÃO COMERCIAL</strong>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "999px",
                        background: caseDetail.readiness.ready
                          ? "#16a34a"
                          : "#ca8a04",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      {
                        caseDetail.readiness.criteria.filter((c) => c.ok).length
                      }
                      /8 critérios atendidos — {caseDetail.readiness.state}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {caseDetail.readiness.criteria.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#fff",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #dce4e8",
                        }}
                      >
                        {item.ok ? (
                          <CheckCircle size={16} color="#16a34a" />
                        ) : (
                          <XCircle size={16} color="#dc2626" />
                        )}
                        <div>
                          <b>{item.label}</b>
                          <small
                            style={{
                              display: "block",
                              color: item.mandatory ? "#dc2626" : "#607887",
                            }}
                          >
                            {item.mandatory ? "OBRIGATÓRIO" : "OPCIONAL"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TABS NAVIGATION FOR 12 SECTIONS */}
                <div
                  style={{
                    display: "flex",
                    overflowX: "auto",
                    background: "#fff",
                    borderBottom: "1px solid #dce4e8",
                    padding: "0 10px",
                  }}
                >
                  {sections.map((sec) => (
                    <button
                      key={sec}
                      style={{
                        border: "none",
                        borderBottom:
                          activeTab === sec ? "3px solid #bd4817" : "none",
                        background: "transparent",
                        padding: "12px 14px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: activeTab === sec ? "#bd4817" : "#526c7b",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => setActiveTab(sec)}
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                {/* SECTION CONTENT BODY */}
                <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
                  {activeTab === "RESUMO" && (
                    <div style={{ display: "grid", gap: "16px" }}>
                      <div className={styles.notice}>
                        <ShieldCheck />
                        <div>
                          <b>SUMÁRIO EXECUTIVO PARA ANALISTA</b>
                          <p>
                            Dados estruturados e evidências verificadas são
                            separados; o que ainda não tem prova segue pendente.
                          </p>
                        </div>
                      </div>
                      <div className={styles.caseSummary}>
                        <article>
                          <small>CREDOR</small>
                          <strong>{caseDetail.summaryText.creditor}</strong>
                        </article>
                        <article>
                          <small>VALOR NOMINAL</small>
                          <strong>{money(caseDetail.summaryText.value)}</strong>
                        </article>
                        <article>
                          <small>Nº PROCESSO DEPRE</small>
                          <code>{caseDetail.summaryText.depre}</code>
                        </article>
                        <article>
                          <small>DEVEDORA</small>
                          <strong>{caseDetail.summaryText.debtor}</strong>
                        </article>
                      </div>

                      <h3>Links de Evidência e Consulta Oficial</h3>
                      {caseDetail.summaryText.evidenceLinks?.length === 0 ? (
                        <p>Nenhum documento oficial verificado anexado.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {caseDetail.summaryText.evidenceLinks.map(
                            (
                              link: {
                                title: string;
                                sourceUrl: string;
                                downloadUrl: string | null;
                              },
                              idx: number,
                            ) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "12px",
                                  background: "#fffaf0",
                                  border: "1px solid #ddce9e",
                                  borderRadius: "8px",
                                }}
                              >
                                <div>
                                  <b>{link.title}</b>
                                  <small style={{ display: "block" }}>
                                    Fonte: {link.sourceUrl}
                                  </small>
                                </div>
                                <div style={{ display: "flex", gap: "10px" }}>
                                  <a
                                    href={link.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      color: "#175e81",
                                    }}
                                  >
                                    <ExternalLink size={14} /> Consultar fonte
                                  </a>
                                  {link.downloadUrl && (
                                    <a
                                      href={link.downloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        color: "#16a34a",
                                        fontWeight: 700,
                                      }}
                                    >
                                      <Download size={14} /> Baixar documento
                                    </a>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "IDENTIDADE DO CREDOR" && (
                    <div style={{ display: "grid", gap: "14px" }}>
                      <div className={styles.caseSummary}>
                        <article>
                          <small>NOME DO CREDOR</small>
                          <strong>
                            {caseDetail.operation.workflow.client.name ||
                              "Não informado"}
                          </strong>
                        </article>
                        <article>
                          <small>DOCUMENTO (CPF/CNPJ)</small>
                          <strong>
                            {caseDetail.operation.workflow.client.document ||
                              "Não informado"}
                          </strong>
                        </article>
                        <article>
                          <small>ESTADO DO TITULAR ATUAL</small>
                          <strong>
                            {caseDetail.operation.workflow.creditorResolution.currentHolderStatus.replace(
                              /_/g,
                              " ",
                            )}
                          </strong>
                        </article>
                        <article>
                          <small>CONFIANÇA</small>
                          <strong>
                            {
                              caseDetail.operation.workflow.creditorResolution
                                .confidence
                            }
                          </strong>
                        </article>
                      </div>
                      <p style={{ fontSize: "13px" }}>
                        Nota: A identificação do credor é obtida via resolução
                        conservadora de papéis (CREDOR, BENEFICIÁRIO, AUTOR,
                        CESSIONÁRIO). O titular atual só é marcado como
                        confirmado perante evidência explícita de cessão/sucessão.
                      </p>
                    </div>
                  )}

                  {activeTab === "CRÉDITO" && (
                    <div className={styles.caseSummary}>
                      <article>
                        <small>VALOR DECLARADO</small>
                        <strong>
                          {money(caseDetail.operation.nominal)}
                        </strong>
                      </article>
                      <article>
                        <small>MODALIDADE</small>
                        <strong>
                          {caseDetail.operation.workflow.credit.creditType}
                        </strong>
                      </article>
                      <article>
                        <small>NATUREZA</small>
                        <strong>
                          {caseDetail.operation.workflow.credit.nature ||
                            "Não informada"}
                        </strong>
                      </article>
                      <article>
                        <small>MUNICÍPIO / ENTE</small>
                        <strong>
                          {caseDetail.operation.workflow.credit.municipality ||
                            caseDetail.operation.debtor}
                        </strong>
                      </article>
                    </div>
                  )}

                  {activeTab === "PROCESSO" && (
                    <div className={styles.caseSummary}>
                      <article>
                        <small>Nº PROCESSO DEPRE (MANDATÓRIO)</small>
                        <code>
                          {caseDetail.operation.workflow.credit
                            .numeroProcessoDEPRE ||
                            "Não identificado na fonte consultada"}
                        </code>
                      </article>
                      <article>
                        <small>PROCESSO ORIGINÁRIO</small>
                        <code>
                          {caseDetail.operation.workflow.credit
                            .originProcessNumber || "Não informado"}
                        </code>
                      </article>
                      <article>
                        <small>NÚMERO DO PRECATÓRIO</small>
                        <code>
                          {caseDetail.operation.workflow.credit.precatoryNumber ||
                            "Não informado"}
                        </code>
                      </article>
                      <article>
                        <small>EP/ES</small>
                        <code>
                          {caseDetail.operation.workflow.credit.epesNumber ||
                            "Não informado"}
                        </code>
                      </article>
                    </div>
                  )}

                  {activeTab === "FONTES" && (
                    <div>
                      <h3>Linha do Tempo de Fontes Consultadas</h3>
                      <p>
                        Cada tentativa informa se houve consulta, o resultado e
                        a URL registrada. Estados manuais não significam que a
                        fonte foi acessada.
                      </p>
                      {caseDetail.sourceEvents.length === 0 ? (
                        <p>Nenhuma tentativa de consulta registrada para este caso.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {caseDetail.sourceEvents.map((event) => (
                            <div className={styles.sourceNote} key={event.id}>
                              <b>{event.sourceId} · {event.eventType}</b>
                              <span>
                                Estado: {event.status}
                                {event.httpStatus ? ` · HTTP ${event.httpStatus}` : ""}
                                {event.accessResult ? ` · ${event.accessResult}` : ""}
                              </span>
                              {event.queryIdentifier && (
                                <small>Identificador consultado: {event.queryIdentifier}</small>
                              )}
                              {event.failureReason && (
                                <small>{event.failureReason}</small>
                              )}
                              {event.sourceId === "djen" && (
                                <>
                                  <small>
                                    {event.details.requestAttempted
                                      ? "Consulta externa executada"
                                      : event.details.cached
                                        ? "Resultado reutilizado do cache; sem nova consulta"
                                        : "Nenhuma chamada externa executada"}
                                    {typeof event.details.communicationCount === "number"
                                      ? ` · ${event.details.communicationCount} comunicação(ões)`
                                      : ""}
                                  </small>
                                  {event.details.partyCandidates?.map((party, index) => (
                                    <small key={`${party.name}-${party.role}-${index}`}>
                                      Parte observada: {party.name} · {party.role} · {party.roleEvidence}
                                    </small>
                                  ))}
                                  {event.details.communications?.map((communication, index) => (
                                    <div
                                      className={styles.sourceNote}
                                      key={`${communication.hash || communication.id}-${index}`}
                                    >
                                      <b>
                                        {communication.tribunal} · {communication.communicationType}
                                      </b>
                                      <small>
                                        {communication.courtUnit}
                                        {communication.publicationDate
                                          ? ` · disponibilizada em ${communication.publicationDate}`
                                          : ""}
                                      </small>
                                      {communication.text && (
                                        <small>
                                          {communication.text}
                                          {communication.textTruncated ? " … [trecho]" : ""}
                                        </small>
                                      )}
                                      {communication.partyObservations.map((party, partyIndex) => (
                                        <small key={`${party.name}-${party.role}-${partyIndex}`}>
                                          Observação de destinatário/parte: {party.name} · {party.role}
                                        </small>
                                      ))}
                                      {communication.certificateUrl && (
                                        <a
                                          href={communication.certificateUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Consultar certidão DJEN
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                              {event.sourceUrl && (
                                <a
                                  href={event.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir URL exata da fonte
                                </a>
                              )}
                              <small>
                                {event.consultedAt
                                  ? new Date(event.consultedAt).toLocaleString("pt-BR")
                                  : ""}
                              </small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "OFÍCIOS / DOCUMENTOS OFICIAIS" && (
                    <div>
                      <h3>
                        Documentos Oficiais Rastreáveis (
                        {caseDetail.officialEvidence.length} coletados)
                      </h3>
                      <p style={{ color: "#dc2626", fontWeight: 700 }}>
                        Requisito comercial da empresa: mínimo 2 ofícios/evidências
                        oficiais verificadas.
                      </p>
                      {caseDetail.officialEvidence.length === 0 ? (
                        <p>Nenhum documento anexado ainda.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {caseDetail.officialEvidence.map((doc) => (
                            <div
                              key={doc.id}
                              style={{
                                padding: "14px",
                                border: "1px solid #dce4e8",
                                borderRadius: "8px",
                                background: "#f8fafb",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                }}
                              >
                                <b>
                                  [{doc.documentType}] {doc.title}
                                </b>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color:
                                      doc.status === "VERIFIED"
                                        ? "#16a34a"
                                        : doc.status === "DIVERGENT"
                                          ? "#dc2626"
                                          : "#607887",
                                  }}
                                >
                                  {doc.status}
                                </span>
                              </div>
                              <small
                                style={{
                                  display: "block",
                                  margin: "4px 0",
                                  color: "#526c7b",
                                }}
                              >
                                Fonte: {doc.source} · URL de consulta:{" "}
                                {doc.sourceUrl}
                              </small>
                              <small style={{ display: "block", marginBottom: "4px" }}>
                                Documento: {doc.documentIdentifier || "Identificador não informado"}
                                {doc.reference ? ` · Referência: ${doc.reference}` : ""}
                                {doc.page ? ` · Página: ${doc.page}` : ""}
                                {doc.publishedAt ? ` · Publicado: ${doc.publishedAt}` : ""}
                              </small>
                              {doc.downloadUrl && (
                                <a
                                  href={doc.downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    fontSize: "12px",
                                    color: "#16a34a",
                                    fontWeight: 700,
                                  }}
                                >
                                  Baixar documento oficial
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "CONTATOS" && (
                    <div>
                      <h3>Contatos Públicos Localizados</h3>
                      <p style={{ fontSize: "13px", color: "#526c7b" }}>
                        O CP localiza e preserva dados de contato público. A
                        validação da atividade/disponibilidade é feita pelo
                        analista.
                      </p>
                      {caseDetail.contacts.length === 0 ? (
                        <p>Nenhum contato público localizado para este caso.</p>
                      ) : (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {caseDetail.contacts.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                padding: "12px",
                                border: "1px solid #dce4e8",
                                borderRadius: "8px",
                              }}
                            >
                              <b>
                                Contato localizado [{c.type}]: {c.value}
                              </b>
                              <small style={{ display: "block" }}>
                                Fonte: {c.source} ({c.sourceUrl}) · Coletado em:{" "}
                                {new Date(c.collectedAt).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "CONFLITOS" && (
                    <div>
                      <h3>Divergências e Conflitos Registrados</h3>
                      {caseDetail.readiness.reasons.filter(
                        (r) => r === "IDENTITY_CONFLICT",
                      ).length === 0 ? (
                        <p style={{ color: "#16a34a" }}>
                          ✓ Nenhum conflito crítico de identidade registrado.
                        </p>
                      ) : (
                        <p style={{ color: "#dc2626" }}>
                          ⚠ Conflito de identidade detectado entre documentos da
                          fonte.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === "HISTÓRICO" && (
                    <div>
                      <h3>Histórico de Alterações de Campos</h3>
                      <p>
                        Preservando valores anteriores e novos com carimbo de
                        data/hora.
                      </p>
                    </div>
                  )}

                  {activeTab === "IA" && (
                    <div>
                      <h3>Camada Cognitiva (Ollama / Qwen)</h3>
                      <p style={{ fontSize: "13px", color: "#526c7b" }}>
                        A IA auxilia no resumo e extração de documentos, mas
                        nunca inventa valores canônicos nem sobrepõe regras
                        determinísticas.
                      </p>
                      <div className={styles.notice}>
                        <Bot />
                        <div>
                          <b>Status da IA:</b>
                          <p>
                            IA indisponível — processamento determinístico
                            continua.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "PRÓXIMA AÇÃO" && (
                    <div style={{ padding: "16px", background: "#f8fafb" }}>
                      <h3>Próxima Ação Sugerida</h3>
                      <strong style={{ fontSize: "18px", color: "#bd4817" }}>
                        {caseDetail.readiness.nextAction}
                      </strong>
                    </div>
                  )}

                  {activeTab === "AUDITORIA" && (
                    <div>
                      <h3>Auditoria de Execução</h3>
                      <pre
                        style={{
                          background: "#071d30",
                          color: "#9fb5c5",
                          padding: "14px",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      >
                        {JSON.stringify(caseDetail.readiness, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
