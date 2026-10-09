"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Download,
  Search,
  ArrowLeft,
  Save,
  ClipboardList,
  Layers,
  Link2,
  FlaskConical,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import styles from "./operations.module.css";
import Documents from "./documents";
import DataJudSearch from "./datajud-search";
import OperationalCase from "./operational-case";
import {
  createDefaultWorkflow,
  initialInventoryOrigin,
  type OperationalWorkflow,
} from "@/lib/operational-workflow";
import AuditTrail from "./audit-trail";
import SourceMonitorPanel from "./source-monitor-panel";
import BenchmarkPanel from "./benchmark-panel";
import AutonomousPanel from "./autonomous-panel";
import {
  defaultAcquisitionProfile,
  evaluateLead,
  findLeadDuplicates,
  type AcquisitionProfile,
} from "@/lib/lead-qualification";
import type { DatasetProfile } from "@/lib/tjsp-import";
import { isInitialDepreStock } from "@/lib/initial-stock";

type Operation = {
  id: string;
  version: number;
  title: string;
  debtor: string;
  tribunal: string;
  process: string;
  owner: string;
  source: string;
  stage: string;
  nominal: number;
  notes: string;
  tasks: { id: string; title: string; due: string; done: boolean }[];
  checks: { id: string; title: string; done: boolean }[];
  proposals: {
    id: string;
    buyer: string;
    price: number;
    costs: number;
    months: number;
    receipt: number;
    validUntil: string;
    conditions: string;
  }[];
  history: { at: string; text: string }[];
  workflow: OperationalWorkflow;
  isDemo: boolean;
};
function datasetProfileSummary(profile: DatasetProfile, sampled: boolean) {
  const columns = profile.fields
    .slice(0, 8)
    .map(
      (field) =>
        `${field.name}: ${field.type}, vazio ${(field.nullRate * 100).toFixed(1)}%, único ${(field.uniqueRate * 100).toFixed(1)}%, malformado ${field.malformed}${field.candidateField ? `, identidade ${field.candidateField}` : ""}${field.samples.length ? `, exemplo ${field.samples[0]}` : ""}`,
    )
    .join(" · ");
  return `${profile.recordCount} registros perfilados${sampled ? " (amostra de até 100 linhas)" : " (arquivo completo)"} · ${profile.duplicateRows} linhas duplicadas · ${columns}${profile.fields.length > 8 ? ` · +${profile.fields.length - 8} colunas` : ""}`;
}
function OperationCopilot({
  operation,
  mode,
}: {
  operation: Operation;
  mode: "document_extract" | "next_action";
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [result, setResult] = useState<Record<string, unknown> | null>(null);
  async function analyze() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const r = await fetch("/api/ai/copilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, operationId: operation.id }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error || "Copiloto indisponível.");
      setResult(d.result);
      setMessage(`${d.notice} · ${d.model}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Copiloto indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.captureBox}>
      <div>
        <b>Copiloto desta oportunidade</b>
        <span>
          Revê os campos da ficha e até 10 PDFs legíveis já anexados. PDFs
          digitalizados, protegidos ou sem texto extraível devem ser transcritos
          por uma pessoa; nada é alterado automaticamente.
        </span>
      </div>
      <button disabled={busy} onClick={() => void analyze()}>
        {busy ? "Analisando…" : "Analisar ficha e documentos"}
      </button>
      {message && <p role="status">{message}</p>}
      {result && (
        <pre className={styles.aiResult}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
function LeadDashboard({
  items,
  onOpen,
  onCreate,
  onImported,
  demoMode,
  onDemoModeChange,
}: {
  items: Operation[];
  onOpen: (item: Operation) => void;
  onCreate: () => void;
  onImported: (items: Operation[]) => void;
  demoMode: boolean;
  onDemoModeChange: (enabled: boolean) => void;
}) {
  const [profile, setProfile] = useState<AcquisitionProfile>(
      defaultAcquisitionProfile,
    ),
    [minimum, setMinimum] = useState(
      defaultAcquisitionProfile.minimumPrecatory,
    ),
    [profileBusy, setProfileBusy] = useState(false),
    [profileMessage, setProfileMessage] = useState("");
  const [type, setType] = useState("ALL"),
    [place, setPlace] = useState("");
  const [importing, setImporting] = useState(false),
    [importSource, setImportSource] = useState("tjsp-lista-geral"),
    [dataAsOf, setDataAsOf] = useState(""),
    [importMessage, setImportMessage] = useState(""),
    [importError, setImportError] = useState(""),
    [filePreview, setFilePreview] = useState<{
      name: string;
      sheets: {
        name: string;
        rows: string[][];
        recordsFound: number;
        profile?: DatasetProfile;
        profileSampled?: boolean;
      }[];
      selected: string;
      headers: string[];
      records: number;
      kind: string;
      profile?: DatasetProfile;
      profileSampled: boolean;
    } | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [history, setHistory] = useState<Record<string, unknown>[]>([]),
    [health, setHealth] = useState<Record<string, unknown>[]>([]);
  const [searchKind, setSearchKind] = useState("precatorio"),
    [searchTerm, setSearchTerm] = useState(""),
    [searchBusy, setSearchBusy] = useState(false),
    [searchRows, setSearchRows] = useState<Record<string, string>[]>([]),
    [searchMessage, setSearchMessage] = useState("");
  const [aiText, setAiText] = useState(""),
    [aiBusy, setAiBusy] = useState(false),
    [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null),
    [aiMessage, setAiMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/capture/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active && d.profile) {
          setProfile(d.profile);
          setMinimum(d.profile.minimumPrecatory);
        }
      })
      .catch(() =>
        setProfileMessage(
          "Critérios padrão locais em uso; não foi possível carregar o perfil salvo.",
        ),
      )
      .finally(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("#lead-import-file");
    if (input)
      input.accept =
        importSource === "tjsp-cac-assisted"
          ? ".csv,.xls,.xlsx,.pdf,.zip,text/csv,application/pdf,application/zip"
          : ".csv,.xls,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }, [importSource]);
  async function saveProfile() {
    setProfileBusy(true);
    setProfileMessage("");
    try {
      const r = await fetch("/api/capture/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            minimumPrecatory: minimum,
            minimumOfficialEvidence: profile.minimumOfficialEvidence,
            state: profile.state,
            tribunal: profile.tribunal,
            officeLabels: profile.officeLabels,
            freshDays: profile.freshDays,
            recentDays: profile.recentDays,
          }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setProfile({ ...profile, ...d.profile });
      setProfileMessage(`Perfil ${d.profile.version} salvo.`);
    } catch (e) {
      setProfileMessage(
        e instanceof Error ? e.message : "Falha ao salvar perfil.",
      );
    } finally {
      setProfileBusy(false);
    }
  }
  async function previewList(file: File) {
    setImporting(true);
    setImportError("");
    setImportMessage("");
    try {
      if (file.size > 20_000_000) throw Error("O arquivo excede 20 MB.");
      const detectedSource = /\.(pdf|zip)$/i.test(file.name)
        ? "tjsp-cac-assisted"
        : importSource;
      if (detectedSource !== importSource) setImportSource(detectedSource);
      const form = new FormData();
      form.set("file", file);
      form.set("sourceId", detectedSource);
      const r = await fetch("/api/capture/preview", {
          method: "POST",
          body: form,
        }),
        d = await r.json();
      if (!r.ok)
        throw Error(d.error || "Não foi possível interpretar a planilha.");
      const sheet = d.sheets?.[0],
        headers = d.kind === "csv" ? d.headers : sheet?.rows?.[0] || [];
      setFilePreview({
        name: file.name,
        sheets: d.sheets || [],
        selected:
          d.kind === "csv"
            ? "CSV"
            : d.sheets?.length === 1
              ? d.sheets[0].name
              : "",
        headers,
        records: d.kind === "csv" ? d.recordsFound : sheet?.recordsFound || 0,
        kind: d.kind,
        profile: d.profile || sheet?.profile,
        profileSampled: d.profileSampled ?? sheet?.profileSampled ?? false,
      });
      setMapping({});
      const summaries =
        d.kind === "csv"
          ? datasetProfileSummary(d.profile, false)
          : (d.sheets || [])
              .slice(0, 3)
              .map(
                (item: {
                  name: string;
                  profile: DatasetProfile;
                  profileSampled: boolean;
                }) =>
                  `${item.name}: ${datasetProfileSummary(item.profile, item.profileSampled)}`,
              )
              .join(" | ");
      setImportMessage(
        `${d.kind === "csv" ? `${d.recordsFound} registros encontrados · ` : "Perfis por aba: "} ${summaries}${d.sheets?.length > 3 ? ` · mais ${d.sheets.length - 3} abas` : ""}`,
      );
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : "Falha ao abrir arquivo.",
      );
    } finally {
      setImporting(false);
    }
  }
  async function importList() {
    if (!filePreview) return;
    const input =
      document.querySelector<HTMLInputElement>("#lead-import-file")?.files?.[0];
    if (!input) return;
    setImporting(true);
    setImportError("");
    try {
      const form = new FormData();
      form.set("file", input);
      form.set("minimum", String(minimum));
      form.set("sourceId", importSource);
      form.set(
        "sourceUrl",
        importSource === "esaj-listas"
          ? "https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do"
          : importSource === "tjsp-cac-assisted"
            ? "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx"
            : "https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral",
      );
      form.set("sheet", filePreview.selected);
      form.set("mapping", JSON.stringify(mapping));
      if (dataAsOf) form.set("dataAsOf", dataAsOf);
      const endpoint =
          importSource === "tjsp-cac-assisted" &&
          /\.(pdf|zip)$/i.test(input.name)
            ? "/api/capture/import-cac"
            : "/api/capture/import",
        response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Falha na importação.");
      const s = data.summary;
      setImportMessage(
        data.alreadyProcessed
          ? data.notice
          : `${s.created} novos · ${s.updated} atualizados · ${s.duplicates} duplicados · ${s.conflicts} conflitos · ${s.errors} erros · ${s.incomplete} incompletos · ${s.rpvs} RPVs encaminhadas à fila particular. ${data.notice}`,
      );
      const fileInput = document.querySelector<HTMLInputElement>("#lead-import-file");
      if (fileInput) fileInput.value = "";
      setFilePreview(null);
      const latest = await fetch("/api/operations", { cache: "no-store" });
      if (latest.ok) onImported((await latest.json()).operations);
      await refreshImportPanels();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setImporting(false);
    }
  }
  async function refreshImportPanels() {
    const [h, s] = await Promise.all([
      fetch("/api/capture/batches", { cache: "no-store" }),
      fetch("/api/capture/health", { cache: "no-store" }),
    ]);
    if (h.ok) setHistory((await h.json()).batches);
    if (s.ok) setHealth((await s.json()).sources);
  }
  useEffect(() => {
    void refreshImportPanels();
  }, []);
  async function searchTjsp() {
    setSearchBusy(true);
    setSearchMessage("");
    setSearchRows([]);
    try {
      const response = await fetch("/api/capture/tjsp-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: searchKind, query: searchTerm }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSearchRows(data.results);
      setSearchMessage(
        `${data.results.length} resultado(s) · ${new Date(data.consultedAt).toLocaleString("pt-BR")}. ${data.notice}`,
      );
    } catch (e) {
      setSearchMessage(e instanceof Error ? e.message : "Falha na busca.");
    } finally {
      setSearchBusy(false);
    }
  }
  async function addSearchLead(row: Record<string, string>) {
    const process = row.numeProcesso || row.cdProcesso || "",
      name = searchKind === "parte" ? row.nome || "" : "",
      w = createDefaultWorkflow(0);
    w.client.name = name;
    w.credit.legalRepName = ["advogado", "oab"].includes(searchKind)
      ? row.nome || ""
      : "";
    w.credit.precatoryNumber = searchKind === "precatorio" ? searchTerm : "";
    w.credit.issuingCourt = "TJSP";
    w.credit.debtorState = "SP";
    w.credit.sourceUrl = "https://api.tjsp.jus.br/processo/cpopg/search";
    w.credit.sourceName = "Consulta pública TJSP";
    w.credit.checkedAt = new Date().toISOString();
    w.evidence = [
      {
        id: crypto.randomUUID(),
        source: "API pública de consulta processual · TJSP",
        sourceType: "OFFICIAL",
        reference: "https://api.tjsp.jus.br/processo/cpopg/search",
        retrievedAt: new Date().toISOString(),
        confidence: 70,
        status: "REVISÃO HUMANA NECESSÁRIA",
        notes:
          "Registro encontrado em busca pontual; confirmar se há precatório expedido, Nº Processo DEPRE, valor e beneficiário nas fontes do DEPRE e nos documentos.",
      },
    ];
    const payload = {
      title: `Lead TJSP · ${row.numeProcesso || searchTerm}`,
      debtor: "Ente devedor a confirmar no DEPRE",
      tribunal: "TJSP",
      process,
      owner: "",
      source: "Consulta pública TJSP",
      stage: "Entrada",
      nominal: 0,
      notes: `Resultado processual público. Foro: ${row.nmForo || "não informado"}. Tipo: ${row.tipo || "não informado"}. Classe: ${row.classe || "não informada"}. Assunto: ${row.assunto || "não informado"}. Valor do precatório não fornecido pela busca.`,
      tasks: [],
      checks: [
        "Confirmar que há precatório expedido e validar Nº Processo DEPRE",
        "Localizar e conferir os dois ofícios exigidos pela empresa",
        "Confirmar nome do credor/beneficiário nos autos ou lista do DEPRE",
        "Confirmar valor e data-base em fonte oficial atual",
        "Verificar município/ente devedor paulista",
        "Validar advogado representante e canal profissional de contato",
      ].map((title) => ({ id: crypto.randomUUID(), title, done: false })),
      proposals: [],
      workflow: w,
      isDemo: false,
    };
    const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Não foi possível salvar o lead.");
    onImported([data.operation, ...items]);
    onOpen(data.operation);
    setSearchMessage(
      "Lead criado para conferência. Valor, Nº Processo DEPRE, ofícios e contato ainda precisam de comprovação.",
    );
  }
  async function askAi() {
    setAiBusy(true);
    setAiMessage("");
    setAiResult(null);
    try {
      const r = await fetch("/api/ai/copilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "lead_review", text: aiText }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setAiResult(d.result);
      setAiMessage(d.notice);
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : "Copiloto indisponível.");
    } finally {
      setAiBusy(false);
    }
  }
  const candidates = items.filter((item) => item.isDemo === demoMode),
    rpvs = candidates.filter((x) => x.workflow.credit.creditType === "RPV"),
    precatorios = candidates.filter(
      (x) => x.workflow.credit.creditType !== "RPV",
    ),
    duplicates = findLeadDuplicates(precatorios),
    qualified = new Map(
      precatorios.map((item, index) => [
        item.id,
        evaluateLead(
          {
            type: "PRECATORY",
            amount: item.nominal,
            debtor: item.debtor,
            tribunal: item.tribunal,
            process: item.process,
            workflow: item.workflow,
            checkedAt: item.workflow.credit.checkedAt,
            duplicate: duplicates.has(index),
          },
          profile,
        ),
      ]),
    ),
    leads = precatorios
      .filter((item) => demoMode || item.workflow.stage === "NEW" || isInitial73(item))
      .filter((item) => isInitial73(item) || type === "ALL" || item.nominal >= minimum)
      .filter(
        (item) =>
          !place ||
          item.workflow.credit.municipality
            .toLowerCase()
            .includes(place.toLowerCase()) ||
          item.debtor.toLowerCase().includes(place.toLowerCase()) ||
          item.tribunal.toLowerCase().includes(place.toLowerCase()),
      )
      .toSorted(
        (a, b) =>
          Number(isInitial73(b)) - Number(isInitial73(a)) ||
          (qualified.get(b.id)?.score || 0) - (qualified.get(a.id)?.score || 0),
      ),
    initialStockCount = precatorios.filter(isInitial73).length,
    initialStockPendingAi = precatorios.filter(
      (item) => isInitial73(item) && item.workflow.inventory.aiValidation === "PENDING",
    ).length;
  const highQuality = [...qualified.values()].filter(
      (x) => x.status === "QUALIFICADO",
    ).length,
    reviewCount = [...qualified.values()].filter(
      (x) => x.status === "REVISAO_HUMANA",
    ).length,
    pendingCount = [...qualified.values()].filter(
      (x) =>
        x.status === "QUALIFICADO_COM_PENDENCIAS" ||
        x.status === "EM_QUALIFICACAO",
    ).length;
  return (
    <div className={demoMode ? `${styles.leadDashboard} ${styles.demoLeadDashboard}` : styles.leadDashboard}>
      {!demoMode && <SourceMonitorPanel />}
      {!demoMode && <BenchmarkPanel />}
      <div className={styles.demoMode} role="group" aria-label="Base de oportunidades">
        <button aria-pressed={!demoMode} onClick={() => onDemoModeChange(false)}>Base operacional</button>
        <button aria-pressed={demoMode} onClick={() => onDemoModeChange(true)}>Exemplos sintéticos</button>
        {demoMode && <div className={styles.demoBanner}>DADOS SINTÉTICOS — SEM VALIDADE REAL · SEPARADOS DA BASE OPERACIONAL</div>}
      </div>
      <div className={styles.leadIntro}>
        <div>
          <span>LEAD CENTER · PERFIL {profile.version}</span>
          <h2>{demoMode ? "Lead captado · demonstração" : "Oportunidades disponíveis"}</h2>
          <p>
            {demoMode
              ? "Veja como o CP organiza a origem, evidencia os dados, qualifica o lead e o transforma em operação."
              : `${initialStockCount} casos da base inicial disponíveis; validação IA independente.`}
          </p>
        </div>
        <button onClick={onCreate}>
          <Plus size={16} /> Cadastrar candidato
        </button>
      </div>
      <div className={styles.profileSummary}>
        <span>
          Perfil <b>{demoMode ? "Demonstração sintética" : "Precatórios SP"}</b>
        </span>
        <span>
          Valor mínimo <b>{money(minimum)}</b>
        </span>
        <span>
          Tribunal <b>{demoMode ? "Critério simulado" : "TJSP"}</b>
        </span>
        <span>
          Documentação <b>{profile.officeLabels.join(" + ")}</b>
        </span>
        <span>
          RPV <b>Análise particular</b>
        </span>
      </div>
      <div className={styles.leadMetrics}>
        <article>
          <small>Candidatos encontrados</small>
          <b>{precatorios.length}</b>
        </article>
        <article>
          <small>Qualificados</small>
          <b>{highQuality}</b>
        </article>
        <article>
          <small>Pendentes</small>
          <b>{pendingCount}</b>
        </article>
        <article>
          <small>Revisão humana</small>
          <b>{reviewCount}</b>
        </article>
        <article>
          <small>RPV · análise particular</small>
          <b>{rpvs.length}</b>
        </article>
        <article>
          <small>Possíveis duplicados</small>
          <b>{duplicates.size}</b>
        </article>
        <article>
          <small>Disponíveis · base inicial</small>
          <b>{initialStockCount}</b>
        </article>
        <article>
          <small>Validação IA pendente · base inicial</small>
          <b>{initialStockPendingAi}</b>
        </article>
      </div>
      <details className={styles.captureBox}>
        <summary>Critérios de aquisição · perfil configurável</summary>
        <div className={styles.profileFields}>
          <label>
            Valor mínimo de precatório
            <input
              type="number"
              min="0"
              step="10000"
              value={minimum}
              onChange={(e) => setMinimum(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            Estado do perfil comercial
            <input
              maxLength={2}
              value={profile.state}
              onChange={(e) => setProfile({ ...profile, state: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Tribunal do perfil comercial
            <input
              value={profile.tribunal}
              onChange={(e) => setProfile({ ...profile, tribunal: e.target.value })}
            />
          </label>
          <label>
            Documentos oficiais mínimos
            <input
              type="number"
              min="2"
              max="10"
              value={profile.minimumOfficialEvidence}
              onChange={(e) => setProfile({ ...profile, minimumOfficialEvidence: Math.max(2, Number(e.target.value) || 2) })}
            />
          </label>
          <label>
            Nome do documento 1
            <input
              value={profile.officeLabels[0]}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  officeLabels: [e.target.value, profile.officeLabels[1]],
                })
              }
            />
          </label>
          <label>
            Nome do documento 2
            <input
              value={profile.officeLabels[1]}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  officeLabels: [profile.officeLabels[0], e.target.value],
                })
              }
            />
          </label>
          <label>
            Fonte atualizada até (dias)
            <input
              type="number"
              min="1"
              max="365"
              value={profile.freshDays}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  freshDays: Number(e.target.value) || 7,
                })
              }
            />
          </label>
          <label>
            Fonte recente até (dias)
            <input
              type="number"
              min="1"
              max="730"
              value={profile.recentDays}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  recentDays: Number(e.target.value) || 30,
                })
              }
            />
          </label>
          <button disabled={profileBusy} onClick={() => void saveProfile()}>
            {profileBusy ? "Salvando…" : "Salvar critérios"}
          </button>
          {profileMessage && <p role="status">{profileMessage}</p>}
        </div>
        <p>
          Os dois documentos são política comercial da empresa. Não indicam uma
          exigência jurídica universal. Alterações permitidas a
          proprietários/administradores.
        </p>
      </details>
      <div className={styles.captureBox}>
        <div>
          <b>Busca pública TJSP</b>
          <span>
            Pesquise número de precatório, processo, nome da parte ou
            advogado/OAB. A busca localiza processos; não fornece lista de todos
            os credores, saldo, valor atualizado ou telefone.
          </span>
        </div>
        <div className={styles.captureSearch}>
          <select
            aria-label="Tipo de busca TJSP"
            value={searchKind}
            onChange={(e) => setSearchKind(e.target.value)}
          >
            <option value="precatorio">Número de precatório</option>
            <option value="processo">Número do processo</option>
            <option value="parte">Nome da parte</option>
            <option value="advogado">Nome do advogado</option>
            <option value="oab">OAB</option>
          </select>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Número, nome ou OAB"
          />
          <button
            disabled={searchBusy || searchTerm.trim().length < 2}
            onClick={() => void searchTjsp()}
          >
            {searchBusy ? "Buscando…" : "Buscar no TJSP"}
          </button>
        </div>
        {searchMessage && <p role="status">{searchMessage}</p>}
        {searchRows.map((row, i) => (
          <article
            className={styles.searchResult}
            key={`${row.cdProcesso}-${i}`}
          >
            <div>
              <b>{row.nome || "Parte sem identificação"}</b>
              <span>
                {row.numeProcesso || row.cdProcesso} ·{" "}
                {row.nmForo || "Foro não informado"} ·{" "}
                {row.classe || "Classe não informada"}
              </span>
            </div>
            <button onClick={() => void addSearchLead(row)}>
              Criar lead para conferência
            </button>
          </article>
        ))}
      </div>
      <div id="lead-list-import" className={styles.captureBox}>
        <div>
          <b>Importar resultado oficial do TJSP</b>
          <span>
            Consulta assistida: abra o CAC em outra aba, conclua o CAPTCHA
            manualmente e gere o relatório. Depois importe aqui; o CP processa o
            arquivo sem automatizar o CAPTCHA.
          </span>
        </div>
        <label>
          Fonte desta lista
          <select
            value={importSource}
            onChange={(e) => setImportSource(e.target.value)}
          >
            <option value="tjsp-cac-assisted">
              TJSP/CAC · Captura assistida
            </option>
            <option value="tjsp-lista-geral">TJSP · Lista Geral</option>
            <option value="esaj-listas">
              TJSP/e-SAJ · Lista de pagamentos
            </option>
          </select>
        </label>
        {importSource === "tjsp-cac-assisted" && (
          <p>
            O CP abre a consulta oficial em outra aba. Resolva o CAPTCHA e gere
            o relatório manualmente; depois volte aqui para importar. O CP não
            automatiza o CAPTCHA.
          </p>
        )}
        <label>
          Data da lista/publicação (se indicada no relatório)
          <input
            type="date"
            value={dataAsOf}
            onChange={(e) => setDataAsOf(e.target.value)}
          />
        </label>
        <p>
          Sem uma data-base identificável no próprio arquivo, a atualização do
          registro permanece desconhecida. A data de importação não será usada
          como data da lista.
        </p>
        <div className={styles.captureLinks}>
          <a
            href="https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir consulta CAC para validar CAPTCHA ↗
          </a>
          <a
            href="https://www.tjsp.jus.br/Precatorios/Precatorios/ListaGeral"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lista geral · sistema A ↗
          </a>
          <a
            href="https://esaj.tjsp.jus.br/portalDevedor/consultarListaPagamentos.do"
            target="_blank"
            rel="noopener noreferrer"
          >
            e-SAJ · sistema B ↗
          </a>
          <a
            href="https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mapas orçamentários ↗
          </a>
          <a
            href="https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes"
            target="_blank"
            rel="noopener noreferrer"
          >
            Pendentes de pagamento ↗
          </a>
          <label className={styles.importButton}>
            {importing ? "Lendo arquivo…" : "Selecionar relatório / planilha"}
            <input
              id="lead-import-file"
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void previewList(f);
              }}
            />
          </label>
          {filePreview && (
            <div className={styles.captureBox}>
              <b>Prévia: {filePreview.name}</b>
              <span>
                {filePreview.sheets.length} planilha(s) · selecione
                explicitamente uma aba e confirme as colunas. A prévia mostra
                até 5 registros.
              </span>
              {filePreview.sheets.length > 1 && (
                <label>
                  Planilha
                  <select
                    value={filePreview.selected}
                    onChange={(e) => {
                      const selected = e.target.value,
                        sh = filePreview.sheets.find(
                          (x) => x.name === selected,
                        );
                      setFilePreview({
                        ...filePreview,
                        selected,
                        headers: sh?.rows?.[0] || [],
                        records: sh?.recordsFound || 0,
                      });
                    }}
                  >
                    <option value="">Escolha a planilha</option>
                    {filePreview.sheets.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <p>
                Registros na prévia: {filePreview.records} · Cabeçalhos:{" "}
                {filePreview.headers.join(" · ") || "selecione planilha"}
              </p>
              <div className={styles.fields}>
                {[
                  ["creditorName", "Credor"],
                  ["grossAmount", "Valor bruto"],
                  ["debtorName", "Devedor"],
                  ["tribunal", "Tribunal"],
                  ["numeroProcessoDEPRE", "Nº Processo DEPRE"],
                  ["epesNumber", "EP/ES"],
                  ["epesYear", "Ano EP/ES"],
                  ["paymentOrder", "Ordem de Pagamento"],
                  ["precatoryNumber", "Número do precatório"],
                  ["precatoryYear", "Ano"],
                  ["officeNumber", "Ofício"],
                  ["officeDate", "Data do ofício"],
                  ["processOrigin", "Processo originário"],
                  ["requisitionProcess", "Processo requisitório"],
                  ["depre", "Referência DEPRE"],
                  ["sourceStatus", "Situação"],
                  ["creditType", "Tipo de crédito"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={mapping[key] || ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [key]: e.target.value })
                      }
                    >
                      <option value="">Detecção automática</option>
                      {filePreview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {filePreview.sheets[0]?.rows.slice(1, 6).map((row, i) => (
                <p key={i}>{row.join(" · ")}</p>
              ))}
              <button
                disabled={importing || !filePreview.selected}
                onClick={() => void importList()}
              >
                {importing ? "Importando…" : "Importar planilha"}
              </button>
              <button onClick={() => setFilePreview(null)}>Cancelar</button>
            </div>
          )}
        </div>
        {importMessage && (
          <p role="status" className={styles.success}>
            {importMessage}
          </p>
        )}
        {importError && (
          <p role="alert" className={styles.error}>
            {importError}
          </p>
        )}
      </div>
      <div className={styles.captureBox}>
        <b>Saúde das fontes · estado derivado de consultas reais</b>
        {health.length ? (
          health.map((x, i) => (
            <p key={i}>
              <b>{String(x.name)}</b> · {String(x.status)} ·{" "}
              {x.lastSuccess
                ? `última importação ${new Date(String(x.lastSuccess)).toLocaleString("pt-BR")}`
                : "sem importação concluída"}{" "}
              · {String(x.notice)}
            </p>
          ))
        ) : (
          <p>Carregando registros de atividade das fontes…</p>
        )}
      </div>
      <details className={styles.captureBox}>
        <summary>Histórico de importações ({history.length})</summary>
        {history.length ? (
          history.map((entry) => {
            const b = entry as {
              id: string;
              sourceName: string;
              fileName: string;
              startedAt: string;
              finishedAt: string;
              status: string;
              summary: {
                read: number;
                created: number;
                updated: number;
                duplicates: number;
                conflicts: number;
                errors: number;
              };
              actorUserId: string;
              sourceReference: string;
              contentHash: string;
              parserVersion: string;
              errors: unknown[];
            };
            return (
              <article className={styles.event} key={b.id}>
                <div>
                  <b>
                    {b.sourceName} · {b.status}
                  </b>
                  <p>
                    {b.fileName} ·{" "}
                    {new Date(b.startedAt).toLocaleString("pt-BR")} · usuário{" "}
                    {b.actorUserId}
                  </p>
                  <p>
                    Lidos {b.summary.read} · novos {b.summary.created} ·
                    atualizados {b.summary.updated} · duplicados{" "}
                    {b.summary.duplicates} · conflitos {b.summary.conflicts} ·
                    erros {b.summary.errors}
                  </p>
                  <details>
                    <summary>Ver detalhes</summary>
                    <p>
                      Importação {b.id} · início{" "}
                      {new Date(b.startedAt).toLocaleString("pt-BR")} · fim{" "}
                      {b.finishedAt
                        ? new Date(b.finishedAt).toLocaleString("pt-BR")
                        : "em andamento"}
                    </p>
                    <p>
                      Referência:{" "}
                      <a
                        href={b.sourceReference}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {b.sourceReference}
                      </a>
                    </p>
                    <p>
                      SHA-256 {b.contentHash} · parser {b.parserVersion}
                    </p>
                    {b.errors.map((e, index) => (
                      <p key={index}>{JSON.stringify(e)}</p>
                    ))}
                  </details>
                </div>
              </article>
            );
          })
        ) : (
          <p>Nenhum lote importado nesta organização.</p>
        )}
      </details>
      <div className={styles.captureBox}>
        <div>
          <b>Copiloto local para análise de listas e documentos</b>
          <span>
            Usa Ollama no servidor que hospeda o CP. Texto enviado só ao modelo
            local configurado. Ele extrai campos, compara com critérios e lista
            pendências; toda informação exige conferência humana.
          </span>
        </div>
        <textarea
          rows={5}
          maxLength={20000}
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Cole um trecho de lista, ofício ou dossiê (remova dados que não sejam necessários)."
        />
        <button
          disabled={aiBusy || aiText.trim().length < 20}
          onClick={() => void askAi()}
        >
          {aiBusy ? "Analisando…" : "Analisar com copiloto"}
        </button>
        {aiMessage && <p role="status">{aiMessage}</p>}
        {aiResult && (
          <pre className={styles.aiResult}>
            {JSON.stringify(aiResult, null, 2)}
          </pre>
        )}
      </div>
      <div className={styles.leadFilters}>
        <label>
          Fila
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PRECATORY">Precatórios dentro do perfil</option>
            <option value="ALL">Todos os precatórios</option>
          </select>
        </label>
        <label>
          Município, devedor ou tribunal
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Ex.: Campinas, TJSP"
          />
        </label>
        <label>
          Valor mínimo (R$)
          <input
            type="number"
            min="0"
            step="10000"
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className={styles.sourceNote}>
        <b>Atualidade e evidência</b>
        <span>
          Valor, situação e representação precisam de rechecagem no TJSP. O CP
          conserva link e instante de cada busca/importação e não infere canais
          pessoais.
        </span>
        <a
          href="https://www.tjsp.jus.br/Precatorios/Precatorios/Credores"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir consultas oficiais ↗
        </a>
      </div>
      {leads.length === 0 ? (
        <div className={styles.leadEmpty}>
          <h3>Nenhum lead nesse filtro ainda</h3>
          <p>
            Pesquise no TJSP, importe uma lista oficial CSV ou cadastre um lead.
          </p>
        </div>
      ) : (
        <div className={styles.leadTableWrap}>
          <table className={styles.leadTable}>
            <thead>
              <tr>
                <th>Credor</th>
                <th>Identificadores</th>
                <th>Devedor</th>
                <th>Valor atualizado</th>
                <th>Status</th>
                <th>Disponibilidade</th>
                <th>Validação IA</th>
                <th>Qualificação</th>
                <th>Contato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((item) => {
                const c = qualified.get(item.id)!;
                const score = c.score;
                return (
                  <tr key={item.id} onClick={() => onOpen(item)}>
                    <td>
                      <b>{item.workflow.client.name || "Credor a confirmar"}</b>
                      {demoMode && <small>DADOS DE DEMONSTRAÇÃO — SEM VALIDADE REAL</small>}
                      {isInitial73(item) && <small>{initialInventoryOrigin}</small>}
                      <small>
                        {item.workflow.credit.sourceName || "Fonte não informada"}
                      </small>
                    </td>
                    <td>
                      <b>Nº Processo DEPRE</b>
                      <small>
                        {item.workflow.credit.numeroProcessoDEPRE ||
                          "Não identificado na fonte consultada."}
                      </small>
                      <small>
                        EP/ES: {item.workflow.credit.epesNumber
                          ? `${item.workflow.credit.epesNumber}${item.workflow.credit.epesYear ? `/${item.workflow.credit.epesYear}` : ""}`
                          : "Não identificado na fonte consultada."}
                      </small>
                      <small>
                        Processo originário: {item.workflow.credit.originProcessNumber ||
                          "Não identificado na fonte consultada."}
                      </small>
                      <small>Natureza: {item.workflow.credit.nature || "A confirmar"}</small>
                      <small>
                        Precatório: {item.workflow.credit.precatoryNumber ||
                          "Não identificado na fonte consultada."}
                      </small>
                    </td>
                    <td>
                      {item.debtor || "A confirmar"}
                      <small>{item.tribunal || "Tribunal pendente"}</small>
                    </td>
                    <td>
                      <b>{item.nominal > 0 ? money(item.nominal) : "Não informado"}</b>
                      <small>
                        {item.nominal <= 0
                          ? "Valor ausente na base de origem"
                          : item.workflow.credit.valueDate
                          ? `data-base ${item.workflow.credit.valueDate}`
                          : "valor listado · conferir data-base"}
                      </small>
                    </td>
                    <td>{item.stage}</td>
                    <td>
                      <span className={styles.stockPill}>
                        {item.workflow.inventory.availability === "AVAILABLE"
                          ? "DISPONÍVEL"
                          : item.workflow.inventory.availability === "UNAVAILABLE"
                            ? "INDISPONÍVEL"
                            : "EM REVISÃO"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.aiValidationPill}>
                        {aiValidationLabels[item.workflow.inventory.aiValidation]}
                      </span>
                      <small>
                        Confiança: {item.workflow.inventory.aiConfidence === null
                          ? "não avaliada"
                          : `${item.workflow.inventory.aiConfidence}%`}
                      </small>
                      <small>
                        {item.workflow.inventory.divergenceAlert
                          ? <span className={styles.divergenceAlert}>ALERTA: {item.workflow.inventory.divergenceAlert}</span>
                          : "Nenhum alerta registrado"}
                      </small>
                    </td>
                    <td>
                      <span className={styles.qualityPill}>{demoMode && c.status === "QUALIFICADO_COM_PENDENCIAS" ? "PERFIL ADERENTE · PENDÊNCIAS" : c.status.replaceAll("_", " ")} · {score}/100</span>
                      <small>
                        {c.officeCount}/2 documentos · {c.freshness}
                      </small>
                      {demoMode && <small>{c.reasons.join(" · ") || "Atende aos critérios do perfil simulado."}</small>}
                    </td>
                    <td>
                      {item.workflow.client.phone ||
                        item.workflow.client.email ||
                        "Canal pendente"}
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(item);
                        }}
                      >
                        Abrir ficha
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rpvs.length > 0 && (
        <details className={styles.captureBox}>
          <summary>RPV · análise particular ({rpvs.length})</summary>
          {rpvs.map((item) => (
            <button
              className={styles.rpvCard}
              key={item.id}
              onClick={() => onOpen(item)}
            >
              <b>{item.workflow.client.name || "Credor a confirmar"}</b>
              <span>
                {money(item.nominal)} ·{" "}
                {item.process || "Processo não identificado"}
              </span>
              <span>
                {item.debtor || "Devedor a confirmar"} ·{" "}
                {item.workflow.credit.precatoryNumber ||
                  "Requisitório não identificado"}
              </span>
              <span>
                Avaliação de RPV conforme regra aplicável ao ente devedor; o CP
                não infere limite legal.
              </span>
            </button>
          ))}
        </details>
      )}
      <p className={styles.leadFoot}>
        Nome encontrado publicamente é candidato identificado, não credor
        interessado em vender. Contato não disponível até ser fornecido ou
        confirmado em canal profissional permitido.
      </p>
    </div>
  );
}
const stages = [
  "Entrada",
  "Análise",
  "Diligência",
  "Proposta",
  "Formalização",
  "Acompanhamento",
  "Encerrado",
];
const tabs = [
  "Visão geral",
  "Consulta e validação",
  "Qualificação",
  "Inteligência",
  "Documentos",
  "Jurídico",
  "Precificação",
  "Negociação",
  "Cessão",
  "Monitoramento",
  "Cadastro",
  "Contato",
  "Tarefas",
  "Diligência",
  "Histórico",
];
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isInitial73 = (item: Operation) => isInitialDepreStock(item);
const aiValidationLabels = {
  PENDING: "PENDENTE",
  RECONFIRMED: "RECONFIRMADO",
  UPDATED: "ATUALIZADO",
  DIVERGENCE: "DIVERGÊNCIA",
  NOT_FOUND: "NÃO LOCALIZADO",
} as const;
function LeadQualificationEditor({
  operation,
  onChange,
  onConverted,
}: {
  operation: Operation;
  onChange: (next: Operation) => void;
  onConverted: (next: Operation) => void;
}) {
  const [convertBusy, setConvertBusy] = useState(false),
    [convertMessage, setConvertMessage] = useState("");
  const q = evaluateLead({
    type: operation.workflow.credit.creditType,
    amount: operation.nominal,
    debtor: operation.debtor,
    tribunal: operation.tribunal,
    process: operation.process,
    workflow: operation.workflow,
    checkedAt: operation.workflow.credit.checkedAt,
  });
  const fields = [
    ["numeroProcessoDEPRE", "Nº Processo DEPRE"],
    ["epesNumber", "EP/ES"],
    ["epesYear", "Ano EP/ES"],
    ["originProcessNumber", "Processo originário"],
    ["precatoryNumber", "Número do precatório"],
    ["precatoryYear", "Ano"],
    ["principalRequisitionOfficeNumber", "Ofício requisitório principal"],
    ["requisitionOfficeDate", "Data do ofício"],
    ["requisitionProcessNumber", "Processo de requisitório"],
    ["chronologicalOrderNumber", "Ordem cronológica"],
    ["depreReference", "Referência DEPRE"],
    ["depreReferenceSource", "Fonte da referência DEPRE"],
  ] as const;
  const credit = operation.workflow.credit;
  const patchCredit = (key: string, value: string) =>
    onChange({
      ...operation,
      workflow: {
        ...operation.workflow,
        credit: {
          ...credit,
          [key]: value,
          ...(key === "numeroProcessoDEPRE"
            ? { numeroProcessoDEPRENormalizado: value.replace(/\D/g, "") }
            : {}),
        },
      },
    });
  async function convert() {
    setConvertBusy(true);
    setConvertMessage("");
    try {
      let r = await fetch("/api/capture/convert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: operation.id }),
        }),
        d = await r.json();
      if (
        r.status === 409 &&
        Array.isArray(d.possibleDuplicates) &&
        window.confirm(
          `${d.error}\n\n${d.possibleDuplicates.map((x: { title: string; process: string }) => `${x.title} · ${x.process}`).join("\n")}\n\nDeseja confirmar que revisou os possíveis duplicados?`,
        )
      ) {
        r = await fetch("/api/capture/convert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: operation.id,
            allowDuplicateReview: true,
          }),
        });
        d = await r.json();
      }
      if (!r.ok) throw Error(d.error || "Não foi possível converter.");
      onConverted(d.operation);
      setConvertMessage(
        "Lead convertido em oportunidade. O CP manteve o mesmo registro, documentos e evidências.",
      );
    } catch (e) {
      setConvertMessage(e instanceof Error ? e.message : "Falha na conversão.");
    } finally {
      setConvertBusy(false);
    }
  }
  return (
    <div className={styles.form}>
      <div className={styles.sourceNote}>
        <b>
          Qualificação operacional · {q.status.replaceAll("_", " ")} · {q.score}
          /100
        </b>
        <span>
          Comparação com o perfil comercial; não é conclusão jurídica nem
          previsão de pagamento.
        </span>
      </div>
      <h3>Critérios e próxima ação</h3>
      {q.criteria.map((c) => (
        <p key={c.key}>
          {c.ok ? "✓" : "⚠"} <b>{c.label}</b> — {c.detail}
        </p>
      ))}
      <p>
        <b>Próxima ação:</b> {q.nextAction}
      </p>
      <h3>Identificadores do crédito</h3>
      <div className={styles.sourceNote}>
        <b>Nº Processo DEPRE</b>
        <span>
          {credit.numeroProcessoDEPRE ||
            "Não identificado na fonte consultada."}
        </span>
        <small>
          Valor normalizado: {credit.numeroProcessoDEPRENormalizado || "—"}
        </small>
        <span>
          EP/ES: {credit.epesNumber
            ? `${credit.epesNumber}${credit.epesYear ? `/${credit.epesYear}` : ""}`
            : "Não identificado na fonte consultada."}
        </span>
        <span>
          Processo originário: {credit.originProcessNumber ||
            "Não identificado na fonte consultada."}
        </span>
      </div>
      <div className={styles.fields}>
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={credit[key]}
              onChange={(e) => patchCredit(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <h3>Documentação da empresa · Ofícios</h3>
      <p>
        {q.officeCount}/2 recebidos ou em conferência · requisito comercial, não
        regra jurídica universal.
      </p>
      {credit.qualityOffices.slice(0, 2).map((office, index) => {
        const patchOffice = (patch: Partial<typeof office>) =>
          onChange({
            ...operation,
            workflow: {
              ...operation.workflow,
              credit: {
                ...credit,
                qualityOffices: credit.qualityOffices.map((o, i) =>
                  i === index ? { ...o, ...patch } : o,
                ),
              },
            },
          });
        return (
          <div className={styles.fields} key={office.id}>
            <label>
              Nome
              <input
                value={office.label}
                onChange={(e) => patchOffice({ label: e.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                value={office.status}
                onChange={(e) =>
                  patchOffice({
                    status: e.target.value as typeof office.status,
                    receivedAt:
                      e.target.value === "PENDENTE"
                        ? ""
                        : office.receivedAt || new Date().toISOString(),
                  })
                }
              >
                {[
                  "PENDENTE",
                  "RECEBIDO",
                  "EM_CONFERENCIA",
                  "VALIDADO_PARA_TRIAGEM",
                  "DIVERGENTE",
                  "NAO_APLICAVEL",
                  "REVISAO_HUMANA",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Origem
              <input
                value={office.source}
                onChange={(e) => patchOffice({ source: e.target.value })}
              />
            </label>
            <label>
              Observações
              <textarea
                value={office.notes}
                onChange={(e) => patchOffice({ notes: e.target.value })}
              />
            </label>
          </div>
        );
      })}
      {operation.workflow.stage === "NEW" ? (
        <div className={styles.captureBox}>
          <b>Avançar para oportunidade</b>
          <p>
            Cria uma oportunidade no mesmo registro, conserva as evidências e
            documentos anexados e inicia a triagem no fluxo existente.
          </p>
          <button disabled={convertBusy} onClick={() => void convert()}>
            {convertBusy ? "Convertendo…" : "Converter lead em oportunidade"}
          </button>
          {convertMessage && <p role="status">{convertMessage}</p>}
        </div>
      ) : (
        <div className={styles.sourceNote}>
          <b>Origem: Lead Center</b>
          <span>
            Este registro já está na etapa {operation.workflow.stage} do fluxo
            de oportunidades.
          </span>
        </div>
      )}
    </div>
  );
}
function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function OperationsClient() {
  const [items, setItems] = useState<Operation[]>([]),
    [draft, setDraft] = useState<Operation | null>(null),
    [tab, setTab] = useState(tabs[0]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [view, setView] = useState("Operações"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    fetch("/api/operations", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            "Não foi possível abrir as operações. Verifique o acesso e tente novamente.",
          );
        return r.json();
      })
      .then((d) => setItems(d.operations))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function change(next: Operation) {
    if (busy) return;
    setDraft(next);
    setDirty(true);
    setMessage("");
  }
  function select(item: Operation) {
    if (busy) return;
    if (dirty && !window.confirm("Descartar alterações ainda não salvas?"))
      return;
    setDraft(structuredClone(item));
    setDirty(false);
    setTab(tabs[0]);
    setMessage("");
  }
  async function refresh(preserveSelection = false) {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          "Recarregar a versão salva e descartar o rascunho atual? Exporte o dossiê antes se quiser preservá-lo.",
        ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      if (!response.ok) throw Error("Não foi possível atualizar as operações.");
      const data = await response.json();
      setItems(data.operations);
      if (preserveSelection && draft)
        setDraft(
          data.operations.find((o: Operation) => o.id === draft.id) || null,
        );
      else setDraft(null);
      setDirty(false);
      setMessage("Registros atualizados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }
  async function demo(method: "POST" | "DELETE") {
    if (
      method === "DELETE" &&
      !window.confirm(
        "Limpar apenas os registros marcados como demonstração desta organização?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo", { method });
      const d = await r.json();
      if (!r.ok)
        throw Error(d.error || "Não foi possível atualizar a demonstração.");
      if (method === "POST") {
        setItems((prev) => [
          d.operation,
          ...prev.filter((o) => o.id !== d.operation.id),
        ]);
        setDraft(d.operation);
        setTab("Visão geral");
        setDemoMode(true);
        setView("Captação");
        setMessage(
          "Operação sintética carregada. Nenhum dado possui validade real.",
        );
      } else {
        setItems((prev) => prev.filter((o) => !o.isDemo));
        setDraft((v) => (v?.isDemo ? null : v));
        setDemoMode(false);
        setMessage(
          "Registros demonstrativos removidos. Registros normais foram preservados.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na demonstração.");
    } finally {
      setBusy(false);
    }
  }
  async function save(create = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = create
        ? {
            title: "Nova operação",
            debtor: "",
            tribunal: "",
            process: "",
            owner: "",
            source: "",
            stage: "Entrada",
            nominal: 0,
            notes: "",
            tasks: [],
            checks: [
              "Confirmar titularidade e representação",
              "Conferir ofício requisitório",
              "Conferir decisões e trânsito em julgado",
              "Revisar cálculo e data-base",
              "Verificar cessões, penhoras e impedimentos",
              "Revisar honorários, tributos e valor disponível",
            ].map((title) => ({ id: crypto.randomUUID(), title, done: false })),
            proposals: [],
          }
        : draft;
      const r = await fetch("/api/operations", {
        method: create ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Não foi possível salvar.");
      const item = data.operation || data;
      setItems((prev) =>
        create
          ? [item, ...prev]
          : prev.map((o) => (o.id === item.id ? item : o)),
      );
      setDraft(item);
      setDirty(false);
      setMessage("Operação salva no banco de dados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  const dashboardItems = items.filter((o) => o.isDemo === demoMode);
  const visible = dashboardItems.filter(
    (o) =>
      (!filter || o.workflow.stage === filter) &&
      [
        o.id,
        o.title,
        o.workflow.client.name,
        o.workflow.credit.precatoryNumber,
        o.process,
        o.owner,
        o.tribunal,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const tasks = dashboardItems.flatMap((o) =>
    o.tasks.map((t) => ({ ...t, operation: o })),
  );
  const overdue = tasks.filter(
    (t) => !t.done && t.due && t.due < new Date().toISOString().slice(0, 10),
  );
  function exportCsv() {
    const cell = (v: unknown) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    download(
      "cp-operacoes.csv",
      "\uFEFF" +
        [
          [
            "Operação",
            "Devedor",
            "Tribunal",
            "Responsável",
            "Etapa",
            "Valor nominal",
          ],
          ...visible.map((o) => [
            o.title,
            o.debtor,
            o.tribunal,
            o.owner,
            o.stage,
            o.nominal,
          ]),
        ]
          .map((row) => row.map(cell).join(";"))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <main className={styles.app}>
      <aside className={styles.sidebar}>
        <Link href="/">
          <ArrowLeft size={16} /> Central Precatórios
        </Link>
        <div className={styles.brand}>
          CP<span>CENTRAL OPERACIONAL</span>
        </div>
        <nav>
          {[
            "Captação Autônoma",
            "Captação",
            "Operações",
            "Pipeline",
            "Agenda",
            "Relatórios",
            "Integrações",
          ].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v ? "page" : undefined}
            >
              {v}
            </button>
          ))}
        </nav>
        <p>Área autenticada e isolada por organização.</p>
        <Link href="/conta">Conta e organização</Link>
      </aside>
      <section className={styles.main}>
        <div className={styles.heading}>
          <div>
            <small>UMA OPORTUNIDADE · UM HISTÓRICO · UM PRÓXIMO PASSO</small>
            <h1>{view}</h1>
            <p>
              {view === "Captação Autônoma"
                ? "Motor de aquisição e qualificação contínua de precatórios paulistas."
                : view === "Captação"
                ? "Encontre e priorize credores de precatórios paulistas com evidências rastreáveis."
                : "Cada oportunidade com contexto, evidências e ação prioritária."}
            </p>
          </div>
          <div className={styles.headingActions}>
            <button disabled={busy || dirty} onClick={() => demo("POST")}>
              <FlaskConical size={17} /> Carregar demonstração
            </button>
            <button
              disabled={busy || dirty || !items.some((o) => o.isDemo)}
              onClick={() => demo("DELETE")}
            >
              <Trash2 size={17} /> Limpar demo
            </button>
            <button disabled={busy || dirty} onClick={() => save(true)}>
              <Plus size={18} /> Novo lead
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className={styles.error}>
            {error}{" "}
            <button disabled={busy} onClick={() => void refresh()}>
              Recarregar registros
            </button>
          </div>
        )}
        {message && (
          <p role="status" className={styles.success}>
            {message}
          </p>
        )}
        <div className={styles.metricScope}>
          {demoMode
            ? "DADOS DE DEMONSTRAÇÃO — totais abaixo consideram somente registros sintéticos."
            : "MÉTRICAS DE PRODUÇÃO — registros de demonstração excluídos."}
        </div>
        <div className={styles.metrics}>
          <article>
            <small>{demoMode ? "Operações demonstrativas" : "Operações de produção"}</small>
            <strong>{dashboardItems.length}</strong>
          </article>
          <article>
            <small>Valor nominal declarado</small>
            <strong>{money(dashboardItems.reduce((s, o) => s + o.nominal, 0))}</strong>
          </article>
          <article>
            <small>Tarefas em atraso</small>
            <strong>{overdue.length}</strong>
          </article>
          <article>
            <small>Propostas/ofertas registradas</small>
            <strong>{dashboardItems.reduce((s, o) => s + o.workflow.negotiations.length, 0)}</strong>
          </article>
        </div>
        {view === "Captação Autônoma" ? (
          <section className={styles.card}>
            <AutonomousPanel />
          </section>
        ) : view === "Captação" ? (
          <section className={styles.card}>
            <LeadDashboard
              items={items}
              demoMode={demoMode}
              onDemoModeChange={setDemoMode}
              onOpen={(item) => {
                select(item);
                setView("Operações");
              }}
              onCreate={() => void save(true)}
              onImported={setItems}
            />
          </section>
        ) : view === "Integrações" ? (
          <section className={styles.card}>
            <h2>Fontes e serviços</h2>
            <DataJudSearch />
            <h3>Portais oficiais</h3>
            <p>
              Consultas oficiais abrem no portal de origem. Registre a fonte e o
              resultado no cadastro da operação.
            </p>
            {[
              [
                "TJSP · precatórios e credores",
                "https://www.tjsp.jus.br/Precatorios/Precatorios/Credores",
              ],
              [
                "TRF3 · RPV e precatórios",
                "https://www.trf3.jus.br/carta-servicos/rpv-e-precatorios/",
              ],
              [
                "CNJ · regras de gestão",
                "https://atos.cnj.jus.br/atos/detalhar/3130",
              ],
            ].map(([label, url]) => (
              <p key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Link2 size={16} /> {label}
                </a>
              </p>
            ))}
            <h3>Conexões ainda não ativadas</h3>
            <p>
              KYC/KYB, assinatura eletrônica, pagamentos e protocolos precisam
              de provedores e credenciais. A mesa permite registrar o
              acompanhamento; não executa esses serviços.
            </p>
          </section>
        ) : view === "Relatórios" ? (
          <section className={styles.card}>
            <h2>Distribuição por etapa</h2>
            {stages.map((s) => (
              <p key={s}>
                {s}: <b>{dashboardItems.filter((o) => o.stage === s).length}</b> ·{" "}
                {money(
                  dashboardItems
                    .filter((o) => o.stage === s)
                    .reduce((sum, o) => sum + o.nominal, 0),
                )}
              </p>
            ))}
            <button onClick={exportCsv}>
              <Download size={16} /> Exportar operações CSV
            </button>
            <h3>Origem das oportunidades</h3>
            {Array.from(
              new Set(dashboardItems.map((o) => o.source || "Não informada")),
            ).map((s) => (
              <p key={s}>
                {s}:{" "}
                {
                  dashboardItems.filter((o) => (o.source || "Não informada") === s)
                    .length
                }
              </p>
            ))}
          </section>
        ) : (
          <>
            <div className={styles.toolbar}>
              <label>
                <Search size={16} />
                <input
                  aria-label="Buscar operações"
                  placeholder="Buscar ID, cliente, processo ou precatório"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Filtrar etapa"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todas as etapas</option>
                {[
                  "NEW",
                  "TRIAGE",
                  "QUERY",
                  "VALIDATION",
                  "DOCUMENTS",
                  "LEGAL_REVIEW",
                  "APPROVED",
                  "PROPOSAL",
                  "NEGOTIATION",
                  "ACCEPTED",
                  "CESSION",
                  "POST_CESSION",
                  "COMPLETED",
                  "BLOCKED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button onClick={exportCsv}>
                <Download size={16} /> CSV
              </button>
            </div>
            {view === "Pipeline" && (
              <div className={styles.board}>
                {stages.map((stage) => (
                  <section key={stage}>
                    <h3>
                      {stage}{" "}
                      <small>
                        {visible.filter((o) => o.stage === stage).length}
                      </small>
                    </h3>
                    {visible
                      .filter((o) => o.stage === stage)
                      .map((o) => (
                        <button key={o.id} onClick={() => select(o)}>
                          <b>{o.title}</b>
                          <span>{o.debtor || "Devedor pendente"}</span>
                          <span>{money(o.nominal)}</span>
                          <small>{o.owner || "Sem responsável"}</small>
                        </button>
                      ))}
                  </section>
                ))}
              </div>
            )}
            {view === "Agenda" && (
              <section className={styles.card}>
                <h2>Agenda de acompanhamento</h2>
                {tasks.length === 0 ? (
                  <p>
                    Nenhuma tarefa cadastrada. Abra uma operação e adicione a
                    próxima ação.
                  </p>
                ) : (
                  tasks
                    .toSorted((a, b) => a.due.localeCompare(b.due))
                    .map((t) => (
                      <button
                        className={styles.agenda}
                        key={t.id}
                        onClick={() => select(t.operation)}
                      >
                        <span>{t.done ? "Concluída" : "Pendente"}</span>
                        <b>{t.title}</b>
                        <span>
                          {t.due || "Sem prazo"} · {t.operation.title}
                        </span>
                      </button>
                    ))
                )}
              </section>
            )}
            <div className={styles.columns}>
              {view === "Operações" && (
                <section className={styles.list}>
                  {loading ? (
                    <p role="status">Carregando oportunidades…</p>
                  ) : error ? null : visible.length === 0 ? (
                    <div className={styles.card}>
                      <ClipboardList />
                      <h2>
                        {items.length
                          ? "Nenhum resultado"
                          : "Sua central está pronta."}
                      </h2>
                      <p>
                        {items.length
                          ? "Ajuste a busca ou limpe os filtros."
                          : "Crie uma operação ou carregue o caso sintético para demonstrar o fluxo."}
                      </p>
                      {items.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("");
                            setFilter("");
                          }}
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  ) : (
                    visible.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => select(o)}
                        aria-pressed={draft?.id === o.id}
                      >
                        <small>
                          {o.workflow.stage}
                          {o.isDemo ? " · DEMO" : ""}
                        </small>
                        <b>{o.title}</b>
                        <span>
                          {o.workflow.client.name ||
                            o.debtor ||
                            "Cliente não informado"}
                        </span>
                        <strong>{money(o.nominal)}</strong>
                        <span>
                          {o.workflow.nextAction.title ||
                            "Defina o próximo passo"}
                        </span>
                      </button>
                    ))
                  )}
                </section>
              )}
              {draft && (
                <section className={styles.detail}>
                  {draft.isDemo && (
                    <div className={styles.demoBanner}>
                      DADOS DE DEMONSTRAÇÃO — SEM VALIDADE REAL
                    </div>
                  )}
                  <div className={styles.detailHead}>
                    <div>
                      <small>
                        ID {draft.id.slice(0, 8).toUpperCase()} ·{" "}
                        {draft.workflow.stage} · VERSÃO {draft.version} ·{" "}
                        {dirty ? "ALTERAÇÕES NÃO SALVAS" : "REGISTRO SALVO"}
                      </small>
                      <h2>{draft.title}</h2>
                      <p>
                        {draft.workflow.nextAction.title ||
                          "Defina o próximo passo"}
                      </p>
                    </div>
                    <button disabled={busy || !dirty} onClick={() => save()}>
                      <Save size={16} />
                      {busy ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                  <nav
                    className={styles.tabs}
                    role="tablist"
                    aria-label="Áreas da oportunidade"
                  >
                    {tabs.map((t) => (
                      <button
                        role="tab"
                        aria-selected={tab === t}
                        key={t}
                        onClick={() => setTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </nav>
                  {tab === "Qualificação" && (
                    <LeadQualificationEditor
                      operation={draft}
                      onChange={(next) => change(next)}
                      onConverted={(next) => {
                        setDraft(next);
                        setItems((v) =>
                          v.map((o) => (o.id === next.id ? next : o)),
                        );
                        setDirty(false);
                        setMessage(
                          "Lead convertido em oportunidade mantendo o mesmo registro e histórico.",
                        );
                      }}
                    />
                  )}
                  {[
                    "Visão geral",
                    "Consulta e validação",
                    "Jurídico",
                    "Precificação",
                    "Negociação",
                    "Cessão",
                    "Monitoramento",
                  ].includes(tab) && (
                    <OperationalCase
                      workflow={draft.workflow}
                      debtor={draft.debtor}
                      nominal={draft.nominal}
                      isDemo={draft.isDemo}
                      persistedStage={
                        items.find((o) => o.id === draft.id)?.workflow.stage ||
                        draft.workflow.stage
                      }
                      mode={tab}
                      onChange={(workflow) => change({ ...draft, workflow })}
                      onContinue={setTab}
                    />
                  )}
                  {tab === "Cadastro" && (
                    <div className={styles.form}>
                      <div className={styles.fields}>
                        {(
                          [
                            ["title", "Nome da operação"],
                            ["debtor", "Ente devedor"],
                            ["tribunal", "Tribunal"],
                            ["process", "Processo / precatório"],
                            ["owner", "Responsável"],
                            ["source", "Origem / fonte consultada"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              value={draft[key]}
                              maxLength={
                                key === "source"
                                  ? 240
                                  : key === "tribunal" || key === "process"
                                    ? 100
                                    : 160
                              }
                              onChange={(e) =>
                                change({ ...draft, [key]: e.target.value })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Etapa legada
                          <select
                            value={draft.stage}
                            onChange={(e) =>
                              change({ ...draft, stage: e.target.value })
                            }
                          >
                            {stages.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Valor nominal (R$)
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.nominal}
                            onChange={(e) =>
                              change({
                                ...draft,
                                nominal: Number(e.target.value),
                                workflow: {
                                  ...draft.workflow,
                                  credit: {
                                    ...draft.workflow.credit,
                                    grossAmount: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Notas, fontes, protocolo e próximos passos
                        <textarea
                          rows={6}
                          value={draft.notes}
                          maxLength={12000}
                          onChange={(e) =>
                            change({ ...draft, notes: e.target.value })
                          }
                        />
                      </label>
                      <p>
                        Etapas são registros de acompanhamento interno. Marcar
                        “Encerrado” não transfere o crédito ou movimenta
                        dinheiro.
                      </p>
                      <button
                        onClick={() =>
                          download(
                            `dossie-${draft.id}-v${draft.version}.json`,
                            JSON.stringify(
                              {
                                ...draft,
                                dossier: {
                                  generatedAt: new Date().toISOString(),
                                  version: draft.version,
                                  warning:
                                    "Dossiê operacional. Revisão jurídica humana permanece obrigatória.",
                                },
                              },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} /> Gerar dossiê versionado
                      </button>
                    </div>
                  )}
                  {tab === "Contato" && (
                    <div className={styles.form}>
                      <div className={styles.notice}>
                        <ShieldCheck />
                        <div>
                          <b>Contato rastreável e respeitoso</b>
                          <p>
                            Registre apenas dados encontrados em fonte permitida
                            ou fornecidos pelo credor/representante. Anote a
                            origem e a data; evite dados sensíveis e respeite
                            pedidos para não contatar.
                          </p>
                        </div>
                      </div>
                      <div className={styles.fields}>
                        <label>
                          Representante / advogado
                          <input
                            value={
                              draft.workflow.client.name
                                ? draft.workflow.client.name
                                : ""
                            }
                            placeholder="Nome conforme fonte ou informado"
                            onChange={(e) =>
                              change({
                                ...draft,
                                workflow: {
                                  ...draft.workflow,
                                  client: {
                                    ...draft.workflow.client,
                                    name: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          OAB / identificação profissional
                          <input
                            value={draft.workflow.client.document}
                            placeholder="Somente se necessário e validado"
                            onChange={(e) =>
                              change({
                                ...draft,
                                workflow: {
                                  ...draft.workflow,
                                  client: {
                                    ...draft.workflow.client,
                                    document: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Telefone obtido com autorização ou em canal público
                          <input
                            value={draft.workflow.client.phone}
                            onChange={(e) =>
                              change({
                                ...draft,
                                workflow: {
                                  ...draft.workflow,
                                  client: {
                                    ...draft.workflow.client,
                                    phone: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          E-mail de contato
                          <input
                            type="email"
                            value={draft.workflow.client.email}
                            onChange={(e) =>
                              change({
                                ...draft,
                                workflow: {
                                  ...draft.workflow,
                                  client: {
                                    ...draft.workflow.client,
                                    email: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Canal e permissão de contato
                          <input
                            value={draft.workflow.nextAction.reason || ""}
                            placeholder="Fonte do contato, contexto e preferência"
                            onChange={(e) =>
                              change({
                                ...draft,
                                workflow: {
                                  ...draft.workflow,
                                  nextAction: {
                                    ...draft.workflow.nextAction,
                                    reason: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <p>
                        O DataJud fornece metadados processuais, não um
                        diretório de telefones ou e-mails. Para confirmar
                        representante, use o processo e a documentação oficial;
                        para dados de contato, priorize canais profissionais
                        publicados pelo próprio representante ou informação
                        fornecida diretamente.
                      </p>
                    </div>
                  )}
                  {tab === "Tarefas" && (
                    <div className={styles.form}>
                      <button
                        onClick={() =>
                          change({
                            ...draft,
                            tasks: [
                              ...draft.tasks,
                              {
                                id: crypto.randomUUID(),
                                title: "Nova tarefa",
                                due: "",
                                done: false,
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={16} /> Adicionar tarefa
                      </button>
                      {draft.tasks.map((t, i) => (
                        <div className={styles.task} key={t.id}>
                          <input
                            type="checkbox"
                            aria-label={`Concluir ${t.title}`}
                            checked={t.done}
                            onChange={(e) =>
                              change({
                                ...draft,
                                tasks: draft.tasks.map((v, j) =>
                                  j === i
                                    ? { ...v, done: e.target.checked }
                                    : v,
                                ),
                              })
                            }
                          />
                          <input
                            aria-label="Descrição da tarefa"
                            value={t.title}
                            onChange={(e) =>
                              change({
                                ...draft,
                                tasks: draft.tasks.map((v, j) =>
                                  j === i ? { ...v, title: e.target.value } : v,
                                ),
                              })
                            }
                          />
                          <input
                            aria-label="Prazo da tarefa"
                            type="date"
                            value={t.due}
                            onChange={(e) =>
                              change({
                                ...draft,
                                tasks: draft.tasks.map((v, j) =>
                                  j === i ? { ...v, due: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "Diligência" && (
                    <div className={styles.form}>
                      <h3>
                        {draft.checks.filter((c) => c.done).length} de{" "}
                        {draft.checks.length} verificações concluídas
                      </h3>
                      <p>
                        Checklist de trabalho preenchido pela equipe; não valida
                        automaticamente documentos.
                      </p>
                      {draft.checks.map((c, i) => (
                        <label className={styles.check} key={c.id}>
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={(e) =>
                              change({
                                ...draft,
                                checks: draft.checks.map((v, j) =>
                                  j === i
                                    ? { ...v, done: e.target.checked }
                                    : v,
                                ),
                              })
                            }
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                  {tab === "Documentos" && (
                    <div className={styles.form}>
                      <Documents key={draft.id} operation={draft.id} />
                      {draft.isDemo && <button onClick={() => setTab("Jurídico")}>Abrir revisão jurídica</button>}
                      <OperationCopilot
                        operation={draft}
                        mode="document_extract"
                      />
                    </div>
                  )}
                  {tab === "Histórico" && (
                    <div className={styles.form}>
                      <AuditTrail operationId={draft.id} />
                      <h3>Histórico legado da operação</h3>
                      {draft.history.toReversed().map((h, i) => (
                        <article className={styles.event} key={i}>
                          <Layers size={16} />
                          <div>
                            <b>{h.text}</b>
                            <p>{new Date(h.at).toLocaleString("pt-BR")}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
