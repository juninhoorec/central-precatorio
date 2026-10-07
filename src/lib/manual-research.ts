/**
 * PHASE 6 — MANUAL RESEARCH ASSISTANCE
 *
 * Converts machine-detected source blockers into deterministic, case-specific,
 * auditable analyst research routes.
 *
 * CANONICAL FLOW:
 *   Automated source attempt
 *   → canonical SourceResultStatus (MANUAL_REQUIRED / CAPTCHA_REQUIRED / AUTH_REQUIRED / NO_RESULT …)
 *   → generateManualResearchTask()          ← THIS MODULE
 *   → ManualResearchTask (persisted, idempotent)
 *   → Analyst opens task, reads instructions, searches official source
 *   → Analyst submits evidence reference
 *   → submitManualEvidence()                ← THIS MODULE
 *   → EvidenceCandidate → EvidenceResolver → OfficialEvidenceDocument
 *   → persistOpportunityEvaluation()        ← existing authority
 *   → READY_FOR_ANALYST only if all gates actually satisfied
 *
 * INVARIANTS:
 *   1. Never convert MANUAL_REQUIRED / CAPTCHA_REQUIRED / AUTH_REQUIRED into NOT_FOUND.
 *   2. Never invent search identifiers, titular names, or process numbers.
 *   3. Same organization+operation+source+route+blocker generates AT MOST one open task (idempotent).
 *   4. EvidenceResolver remains the single authority for qualification.
 *   5. DOCUMENTAÇÃO 2/2 gate remains VERIFIED + STRONG — this module cannot bypass it.
 *   6. Tasks are tenant-scoped; cross-tenant access is blocked at DB trigger level.
 *   7. Audit events are written for every material state change.
 */

import { createHash, randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { appendAudit } from "./audit";
import { buildEvidenceCandidates, resolveEvidenceCandidatesForAcquisition } from "./research-pipeline";
import { listOfficialEvidence } from "./autonomous-acquisition";
import { persistResolvedOfficialEvidence } from "./evidence-persistence";
import { persistOpportunityEvaluation } from "./opportunity-evaluations";
import { scoreOpportunity } from "./opportunity-engine";
import { getOperation } from "./operations";
import { recordSourceBlockerEvent, isBlockingResult } from "./acquisition-event-recorder";
import { extractKnownIdentifiersCompat } from "./known-identifiers";
import type { SourceAcquisitionResult } from "./research-pipeline";
import type { OpportunityBlockerCode } from "./opportunity-engine";

const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function applyManualResearchSchema(client: Client = db) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS manual_research_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      opportunity_id TEXT,
      depre TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      route TEXT NOT NULL,
      blocker_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      last_attempt_at TEXT,
      completed_at TEXT,
      completed_reason TEXT,
      instructions_json TEXT NOT NULL,
      idempotency_key TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_tasks_idempotency 
    ON manual_research_tasks(idempotency_key, organization_id);
  `);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical status of a manual research task. NOT to be confused with source blocker status. */
export type ManualTaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";

/** Priority derived deterministically from the blocker codes present. */
export type ManualTaskPriority = "HIGH" | "MEDIUM" | "LOW";

/**
 * Reason a task was completed without yielding qualifying evidence.
 * Must be explicit and auditable.
 */
export type ManualTaskCompletionReason =
  | "EVIDENCE_SUBMITTED"
  | "DOCUMENT_NOT_FOUND_AFTER_MANUAL_SEARCH"
  | "ACCESS_STILL_BLOCKED"
  | "SOURCE_RETURNED_NO_QUALIFYING_RECORD"
  | "DUPLICATE_DOCUMENT_ALREADY_EXISTS"
  | "INSUFFICIENT_IDENTIFICATION"
  | "OTHER_REVIEW_REQUIRED";

/** A structured search strategy for one specific identifier. */
export type SearchStrategy = {
  label: string;
  identifier: string;
  identifierType: "DEPRE" | "PROCESS" | "BENEFICIARY_NAME" | "DOCUMENT_REFERENCE" | "EPES" | "OTHER";
  instruction: string;
};

/** The human-readable, case-specific instructions embedded in the task. */
export type ResearchInstructions = {
  /** One-line description of what the analyst must do. */
  objective: string;
  /** Canonical source to consult first. */
  primarySource: string;
  /** Exact URL or base URL to open. */
  primaryUrl: string;
  /** Official priority-ordered search strategies derived from real case data only. */
  strategies: SearchStrategy[];
  /** Source result codes already attempted — must not be repeated. */
  alreadyAttempted: string[];
  /** What specific official document/record/event must be located. */
  whatToLookFor: string;
  /** Fields the analyst must capture from the official document. */
  captureFields: string[];
  /** Exact condition that counts as task success. */
  successCondition: string;
  /** Actions that must NOT be repeated or assumed. */
  doNotRepeat: string[];
  /** What happens to the case after evidence is submitted. */
  nextStepAfterSubmission: string;
  /** Active blocker codes from the opportunity engine that this task targets. */
  targetBlockerCodes: OpportunityBlockerCode[];
};

/** A persisted manual research task record. */
export type ManualResearchTask = {
  id: string;
  organizationId: string;
  operationId: string;
  opportunityId: string | null;
  depre: string;
  source: string;
  sourceId: string;
  route: string;
  blockerType: string;
  priority: ManualTaskPriority;
  status: ManualTaskStatus;
  generatedAt: string;
  lastAttemptAt: string | null;
  completedAt: string | null;
  completedReason: ManualTaskCompletionReason | null;
  instructions: ResearchInstructions;
  idempotencyKey: string;
};

/** Input for generating or refreshing a manual research task. */
export type GenerateManualTaskInput = {
  organizationId: string;
  operationId: string;
  depre: string;
  source: string;
  sourceId: string;
  route: string;
  blockerType: string;
  sourceResult: string;
  blockerCodes: readonly OpportunityBlockerCode[];
  actorUserId: string;
  /** Known supporting identifiers (process, EPES, etc.) — must be real, not invented. */
  knownIdentifiers?: {
    originProcessNumber?: string;
    epesNumber?: string;
    beneficiaryCandidateName?: string;
    documentReference?: string;
  };
  /** Source results already attempted (for the "do not repeat" list). */
  previousAttempts?: Array<{ source: string; route: string; result: string; attemptedAt: string }>;
  opportunityId?: string;
};

/** Input for submitting evidence from a manually completed research task. */
export type SubmitManualEvidenceInput = {
  taskId: string;
  organizationId: string;
  operationId: string;
  depre: string;
  actorUserId: string;
  officialUrl: string;
  documentIdentifier: string;
  documentReference: string;
  documentDate: string;
  source: string;
  evidenceNotes: string;
  rawExcerpt?: string;
  qualificationStatus?: "COLLECTED" | "VERIFIED" | "DIVERGENT" | "FAILED";
  evidenceStrength?: "STRONG" | "MEDIUM" | "WEAK";
  documentType?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ikey = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\0")).digest("hex");

function fromRow(row: Record<string, unknown>): ManualResearchTask {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    operationId: String(row.operation_id),
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : null,
    depre: String(row.depre),
    source: String(row.source),
    sourceId: String(row.source_id),
    route: String(row.route),
    blockerType: String(row.blocker_type),
    priority: String(row.priority) as ManualTaskPriority,
    status: String(row.status) as ManualTaskStatus,
    generatedAt: String(row.generated_at),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedReason: row.completed_reason
      ? (String(row.completed_reason) as ManualTaskCompletionReason)
      : null,
    instructions: JSON.parse(String(row.instructions_json || "{}")),
    idempotencyKey: String(row.idempotency_key),
  };
}

/**
 * Derive deterministic priority from blocker codes.
 * Identity/documentation blockers = HIGH; secondary enrichment = LOW.
 */
function derivePriority(blockerCodes: readonly OpportunityBlockerCode[]): ManualTaskPriority {
  const high: OpportunityBlockerCode[] = [
    "TITULAR_NOT_CONFIRMED",
    "MULTIPLE_BENEFICIARIES_UNRESOLVED",
    "DOCUMENTATION_BELOW_2_OF_2",
    "MISSING_DEPRE",
  ];
  const medium: OpportunityBlockerCode[] = [
    "PROCESS_NOT_CONFIRMED",
    "VALUE_NOT_CONFIRMED",
    "DATE_BASE_NOT_CONFIRMED",
    "INSUFFICIENT_SOURCE_COVERAGE",
  ];
  if (blockerCodes.some((c) => high.includes(c))) return "HIGH";
  if (blockerCodes.some((c) => medium.includes(c))) return "MEDIUM";
  return "LOW";
}

/**
 * Map source + blocker type to the canonical official URL / search instructions.
 * Only real, publicly accessible official routes are listed here.
 * NO invented URLs. NO scraping services.
 */
function officialRouteForSource(source: string, route: string): { name: string; url: string } {
  const normalized = source.toUpperCase();
  if (normalized.includes("ESAJ") || normalized.includes("TJSP_ESAJ") || route.includes("esaj")) {
    return { name: "TJSP / e-SAJ", url: "https://esaj.tjsp.jus.br/cpopg/open.do" };
  }
  if (normalized.includes("DEPRE") || normalized.includes("CAC") || route.includes("cac")) {
    return { name: "TJSP / Precatórios CAC", url: "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx" };
  }
  if (normalized.includes("DATAJUD") || normalized.includes("CNJ")) {
    return { name: "DataJud / CNJ", url: "https://datajud-wiki.cnj.jus.br/" };
  }
  if (normalized.includes("DJEN") || route.includes("djen")) {
    return { name: "DJEN / CNJ", url: "https://www.cnj.jus.br/djen/" };
  }
  if (normalized.includes("CAMPINAS") || normalized.includes("PMC")) {
    return { name: "Diário Oficial de Campinas", url: "https://www.campinas.sp.gov.br/diario-oficial/" };
  }
  if (normalized.includes("GUARULHOS")) {
    return { name: "Diário Oficial de Guarulhos", url: "https://www.guarulhos.sp.gov.br/diario-oficial" };
  }
  if (normalized.includes("SAO_PAULO") || normalized.includes("PMSP") || normalized.includes("SÃO PAULO")) {
    return { name: "Diário Oficial de São Paulo", url: "https://diariooficial.prefeitura.sp.gov.br/" };
  }
  // Default: TJSP main portal
  return { name: "TJSP — Portal de Serviços", url: "https://www.tjsp.jus.br" };
}

/**
 * Build deterministic, case-specific research instructions.
 * Never invents identifiers — only uses data actually present in the input.
 */
function buildInstructions(input: GenerateManualTaskInput): ResearchInstructions {
  const { depre, source, route, blockerCodes, knownIdentifiers = {}, previousAttempts = [] } = input;

  const official = officialRouteForSource(source, route);

  // Build strategies ONLY from real identifiers
  const strategies: SearchStrategy[] = [];
  strategies.push({
    label: "Estratégia A — DEPRE exato",
    identifier: depre,
    identifierType: "DEPRE",
    instruction: `Abrir ${official.name} e pesquisar o número DEPRE exato: ${depre}. Usar exatamente esse número, incluindo a pontuação original.`,
  });
  if (knownIdentifiers.originProcessNumber) {
    strategies.push({
      label: "Estratégia B — Processo originário",
      identifier: knownIdentifiers.originProcessNumber,
      identifierType: "PROCESS",
      instruction: `Se o DEPRE não retornar resultado, pesquisar pelo número do processo originário: ${knownIdentifiers.originProcessNumber}.`,
    });
  }
  if (knownIdentifiers.epesNumber) {
    strategies.push({
      label: "Estratégia C — Número EPES",
      identifier: knownIdentifiers.epesNumber,
      identifierType: "EPES",
      instruction: `Pesquisar pelo número EPES associado: ${knownIdentifiers.epesNumber}.`,
    });
  }
  if (knownIdentifiers.beneficiaryCandidateName) {
    strategies.push({
      label: "Estratégia D — Nome do beneficiário (observação)",
      identifier: knownIdentifiers.beneficiaryCandidateName,
      identifierType: "BENEFICIARY_NAME",
      instruction: `Como estratégia de verificação APENAS, pesquisar o nome do beneficiário candidato: ${knownIdentifiers.beneficiaryCandidateName}. ATENÇÃO: o nome por si só NÃO confirma a identidade. Exigir vínculo documental ao DEPRE.`,
    });
  }
  if (knownIdentifiers.documentReference) {
    strategies.push({
      label: "Estratégia E — Referência documental conhecida",
      identifier: knownIdentifiers.documentReference,
      identifierType: "DOCUMENT_REFERENCE",
      instruction: `Pesquisar a referência documental conhecida: ${knownIdentifiers.documentReference}.`,
    });
  }

  const alreadyAttempted = previousAttempts.map(
    (a) => `${a.source} / ${a.route} em ${a.attemptedAt}: ${a.result}`,
  );

  // Objective and what to look for derive from the primary blockers
  const hasIdentityBlocker = blockerCodes.includes("TITULAR_NOT_CONFIRMED") || blockerCodes.includes("MULTIPLE_BENEFICIARIES_UNRESOLVED");
  const hasDocumentationBlocker = blockerCodes.includes("DOCUMENTATION_BELOW_2_OF_2");
  const hasProcessBlocker = blockerCodes.includes("PROCESS_NOT_CONFIRMED");
  const hasLawyerBlocker = blockerCodes.includes("LAWYER_NOT_CONFIRMED");
  const hasValueBlocker = blockerCodes.includes("VALUE_NOT_CONFIRMED") || blockerCodes.includes("DATE_BASE_NOT_CONFIRMED");

  const objectives: string[] = [];
  if (hasIdentityBlocker) objectives.push("confirmar titular/beneficiário atual");
  if (hasDocumentationBlocker) objectives.push("obter documento oficial qualificado para DOCUMENTAÇÃO 2/2");
  if (hasProcessBlocker) objectives.push("identificar processo originário e processo incidente");
  if (hasLawyerBlocker) objectives.push("identificar advogado/OAB atual");
  if (hasValueBlocker) objectives.push("verificar valor requisitado e data-base");

  const objective = objectives.length > 0
    ? `Pesquisa oficial para DEPRE ${depre}: ${objectives.join("; ")}.`
    : `Pesquisa oficial para DEPRE ${depre}: verificar situação processual e obter evidência documental.`;

  const captureFields = [
    "URL oficial do documento/página",
    "Identificador/referência do documento",
    "Data do documento ou publicação",
    "Número DEPRE conforme consta no documento",
  ];
  if (hasIdentityBlocker) {
    captureFields.push("Nome completo do titular/beneficiário conforme consta no documento oficial");
    captureFields.push("Qualidade do titular: atual/histórico/cessão");
  }
  if (hasProcessBlocker) captureFields.push("Número do processo originário e/ou incidente conforme documento");
  if (hasLawyerBlocker) captureFields.push("Nome do advogado e número OAB conforme documento");
  if (hasValueBlocker) {
    captureFields.push("Valor principal requisitado (R$)");
    captureFields.push("Data-base do cálculo");
  }

  const successCondition = hasDocumentationBlocker
    ? `Localizar e capturar DOIS documentos oficiais DISTINTOS vinculados ao DEPRE ${depre}, cada um com: URL oficial HTTPS, identificador/referência único, data e nome do titular/processo conforme consta no documento. Documentos que representem o mesmo instrumento físico não contam como dois.`
    : `Localizar e capturar ao menos UM documento oficial vinculado ao DEPRE ${depre} que resolva o(s) bloqueio(s): ${blockerCodes.join(", ")}.`;

  const doNotRepeat = [
    `Repetir consulta automática ao ${source} (já retornou: ${input.sourceResult})`,
    "Usar Escavador ou Jusbrasil como evidência oficial",
    "Confirmar titular apenas pelo nome sem vínculo documental ao DEPRE",
    "Inferir número de processo sem fonte oficial",
    ...alreadyAttempted,
  ];

  return {
    objective,
    primarySource: official.name,
    primaryUrl: official.url,
    strategies,
    alreadyAttempted,
    whatToLookFor: `Ofício requisitório, despacho, publicação em Diário Oficial, ou qualquer comunicação oficial que mencione o DEPRE ${depre} e vincule documentalmente ao titular, processo e valor.`,
    captureFields,
    successCondition,
    doNotRepeat,
    nextStepAfterSubmission: `Ao submeter a evidência, o sistema executará: (1) EvidenceCandidate → EvidenceResolver → OfficialEvidenceDocument; (2) verificação de duplicidade; (3) reavaliação de blockers pelo motor de oportunidades. A oportunidade passará a READY_FOR_ANALYST APENAS se todos os portões determinísticos forem satisfeitos.`,
    targetBlockerCodes: blockerCodes.filter(Boolean) as OpportunityBlockerCode[],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or reuse if already open) a manual research task for a given
 * source blocker. Idempotent: same org+op+source+route+blocker generates
 * at most one open task.
 *
 * PHASE 7 — BLOCKER-7-01:
 * Before creating the task, record a canonical acquisition event so the
 * source attempt history is always preserved and queryable separately from
 * the task itself.
 */
export async function generateManualResearchTask(
  input: GenerateManualTaskInput,
  client: Client = db,
): Promise<{ task: ManualResearchTask; created: boolean }> {
  const key = ikey(
    input.organizationId,
    input.operationId,
    input.sourceId,
    input.route,
    input.blockerType,
  );

  // Idempotency: return existing open/in-progress task if present
  const existing = await client.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE idempotency_key=? AND organization_id=?",
    args: [key, input.organizationId],
  });
  if (existing.rows[0]) {
    return { task: fromRow(existing.rows[0] as Record<string, unknown>), created: false };
  }

  // PHASE 7 — BLOCKER-7-01:
  // Record a canonical acquisition event for this source blocker attempt.
  // This ensures the attempt history is traceable separately from the task.
  // Only record if this is a genuinely blocking result.
  if (isBlockingResult(input.sourceResult) || isBlockingResult(input.blockerType)) {
    await recordSourceBlockerEvent(
      {
        organizationId: input.organizationId,
        operationId: input.operationId,
        depre: input.depre,
        sourceId: input.sourceId,
        sourceName: input.source,
        route: input.route,
        canonicalResult: (isBlockingResult(input.sourceResult) ? input.sourceResult : input.blockerType) as Parameters<typeof recordSourceBlockerEvent>[0]["canonicalResult"],
        failureReason: `Task generated from blocker: ${input.blockerType}`,
        queryIdentifier: input.depre,
        attemptedAt: new Date().toISOString(),
        details: {
          blockerCodes: input.blockerCodes,
          taskIdempotencyKey: key,
        },
      },
      client,
    );
  }

  const instructions = buildInstructions(input);
  const priority = derivePriority(input.blockerCodes);
  const now = new Date().toISOString();
  const id = randomUUID();

  await client.execute({
    sql: `INSERT INTO manual_research_tasks
      (id, organization_id, operation_id, opportunity_id, depre, source, source_id, route, blocker_type,
       priority, status, generated_at, instructions_json, idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      input.organizationId,
      input.operationId,
      input.opportunityId ?? null,
      input.depre,
      input.source,
      input.sourceId,
      input.route,
      input.blockerType,
      priority,
      "OPEN",
      now,
      JSON.stringify(instructions),
      key,
    ],
  });

  await appendAudit(
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "ACQUISITION_QUEUE_ENQUEUED",
      entityType: "manual_research_task",
      entityId: id,
      previousStateSummary: {},
      nextStateSummary: {
        taskId: id,
        depre: input.depre,
        source: input.source,
        route: input.route,
        blockerType: input.blockerType,
        priority,
        status: "OPEN",
      },
      metadata: {
        depre: input.depre,
        source: input.source,
        sourceResult: input.sourceResult,
        blockerCodes: input.blockerCodes.join(","),
      },
      requestId: `phase7-task-create-${key}`,
      source: "PHASE7_MANUAL_RESEARCH",
    },
    client,
  );

  const row = await client.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE id=? AND organization_id=?",
    args: [id, input.organizationId],
  });

  return { task: fromRow(row.rows[0] as Record<string, unknown>), created: true };
}

/**
 * List all manual research tasks for an organization, optionally filtered by status.
 */
export async function listManualResearchTasks(
  organizationId: string,
  filters: { operationId?: string; status?: ManualTaskStatus } = {},
  client: Client = db,
): Promise<ManualResearchTask[]> {
  let sql = "SELECT * FROM manual_research_tasks WHERE organization_id=?";
  const args: string[] = [organizationId];
  if (filters.operationId) { sql += " AND operation_id=?"; args.push(filters.operationId); }
  if (filters.status) { sql += " AND status=?"; args.push(filters.status); }
  sql += " ORDER BY generated_at DESC";
  const result = await client.execute({ sql, args });
  return result.rows.map((r) => fromRow(r as Record<string, unknown>));
}

/**
 * Update task status. Validates tenant ownership.
 * A task may not be COMPLETED without a completedReason.
 */
export async function updateManualTaskStatus(
  taskId: string,
  organizationId: string,
  newStatus: ManualTaskStatus,
  actorUserId: string,
  completedReason?: ManualTaskCompletionReason,
  client: Client = db,
): Promise<ManualResearchTask> {
  const row = await client.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE id=? AND organization_id=?",
    args: [taskId, organizationId],
  });
  if (!row.rows[0]) throw new Error("MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT");

  const task = fromRow(row.rows[0] as Record<string, unknown>);
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new Error(`MANUAL_TASK_TERMINAL_STATE:${task.status}`);
  }
  if (newStatus === "COMPLETED" && !completedReason) {
    throw new Error("MANUAL_TASK_COMPLETED_REASON_REQUIRED");
  }

  const now = new Date().toISOString();
  await client.execute({
    sql: `UPDATE manual_research_tasks SET status=?, last_attempt_at=?,
          completed_at=?, completed_reason=? WHERE id=? AND organization_id=?`,
    args: [
      newStatus,
      now,
      newStatus === "COMPLETED" || newStatus === "CANCELLED" ? now : null,
      completedReason ?? null,
      taskId,
      organizationId,
    ],
  });

  await appendAudit(
    {
      organizationId,
      actorUserId,
      action: "OPPORTUNITY_STATUS_CHANGED",
      entityType: "manual_research_task",
      entityId: taskId,
      previousStateSummary: { status: task.status },
      nextStateSummary: { status: newStatus, completedReason: completedReason ?? null },
      metadata: { depre: task.depre, source: task.source },
      requestId: `phase6-task-status-${taskId}-${newStatus}-${now}`,
      source: "PHASE6_MANUAL_RESEARCH",
    },
    client,
  );

  const updated = await client.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE id=? AND organization_id=?",
    args: [taskId, organizationId],
  });
  return fromRow(updated.rows[0] as Record<string, unknown>);
}

/**
 * Submit evidence from a completed manual research task.
 * Routes through the canonical pipeline:
 *   SubmitManualEvidenceInput
 *   → SourceAcquisitionResult (provider=ANALYST_ASSISTED)
 *   → buildEvidenceCandidates
 *   → resolveEvidenceCandidatesForAcquisition
 *   → persistResolvedOfficialEvidence
 *   → opportunity re-evaluation (scoreOpportunity → persistOpportunityEvaluation)
 *
 * NEVER bypasses EvidenceResolver.
 * NEVER marks evidence VERIFIED+STRONG directly.
 */
export async function submitManualEvidence(
  input: SubmitManualEvidenceInput,
  client: Client = db,
): Promise<{
  persistenceResults: Array<{ status: string }>;
  qualifyingEvidenceCount: number;
  evaluationId: string | null;
}> {
  // 1. Verify tenant ownership of the task
  const taskRow = await client.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE id=? AND organization_id=?",
    args: [input.taskId, input.organizationId],
  });
  if (!taskRow.rows[0]) throw new Error("MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT");

  const task = fromRow(taskRow.rows[0] as Record<string, unknown>);
  if (task.depre !== input.depre) {
    throw new Error(`MANUAL_EVIDENCE_DEPRE_MISMATCH:task=${task.depre}:input=${input.depre}`);
  }

  // 2. Build a canonical SourceAcquisitionResult (provider = ANALYST_ASSISTED)
  const acquisitionResult: SourceAcquisitionResult = {
    provider: "ANALYST_ASSISTED",
    source: input.source,
    sourceId: `manual-${task.sourceId}`,
    route: `manual-${task.route}`,
    requestedIdentifier: input.depre,
    normalizedIdentifier: input.depre.replace(/\D/g, ""),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    status: "SUCCESS",
    requestAttempted: true,
    httpStatus: 200,
    sourceUrl: input.officialUrl,
    officialSourceUrl: input.officialUrl,
    errorCode: null,
    errorMessage: null,
    rawPayload: { excerpt: input.rawExcerpt ?? "" },
    metadata: {
      documentIdentifier: input.documentIdentifier,
      reference: input.documentReference,
      documentDate: input.documentDate,
      submittedByTask: input.taskId,
      analystNotes: input.evidenceNotes,
    },
    documentaryCandidates: [
      {
        documentType: input.documentType ?? "OFFICIAL_RECORD",
        documentIdentifier: input.documentIdentifier,
        reference: input.documentReference,
        officialSourceUrl: input.officialUrl,
        title: `${input.source} — ${input.documentReference}`,
        status: input.qualificationStatus ?? "COLLECTED",
        evidenceStrength: input.evidenceStrength ?? "MEDIUM",
        notes: `Evidência submetida por analista via tarefa ${input.taskId}. ${input.evidenceNotes}`,
      },
    ],
    canonicalResult: {
      provider: "ANALYST_ASSISTED",
      source: input.source,
      sourceId: `manual-${task.sourceId}`,
      route: `manual-${task.route}`,
      queryIdentifier: input.depre,
      status: "SUCCESS",
      category: "APPLICATION_RESULT",
      requestAttempted: true,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      httpStatus: 200,
      officialUrl: input.officialUrl,
      resultCount: 1,
      errorCategory: null,
      errorMessage: null,
      legacyStatus: null,
    },
  };

  // 3. Route through canonical evidence pipeline
  const existing = await listOfficialEvidence(input.operationId, input.organizationId, client);
  const candidates = buildEvidenceCandidates(acquisitionResult);
  const resolved = resolveEvidenceCandidatesForAcquisition(acquisitionResult, existing);

  const persistenceResults: Array<{ status: string }> = [];
  for (const item of resolved) {
    const result = await persistResolvedOfficialEvidence(
      item,
      { organizationId: input.organizationId, operationId: input.operationId, client },
      existing,
    );
    persistenceResults.push({ status: result.status });
  }

  // 4. Temporarily removed eager task completion to move it after re-evaluation

  // 5. Audit
  await appendAudit(
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "OFFICIAL_EVIDENCE_RECORDED",
      entityType: "operation",
      entityId: input.operationId,
      previousStateSummary: {},
      nextStateSummary: {
        source: input.source,
        url: input.officialUrl,
        reference: input.documentReference,
        candidatesBuilt: candidates.length,
        resolvedCount: resolved.length,
        persistenceStatuses: persistenceResults.map((r) => r.status).join(","),
      },
      metadata: {
        taskId: input.taskId,
        depre: input.depre,
        documentIdentifier: input.documentIdentifier,
        documentDate: input.documentDate,
      },
      requestId: `phase6-evidence-submit-${input.taskId}-${input.documentIdentifier}`,
      source: "PHASE6_MANUAL_RESEARCH",
    },
    client,
  );

  // 6. PHASE 7 — BLOCKER-7-03: Re-evaluate opportunity ONLY when evidence was actually persisted.
  //    Rejected evidence must NOT trigger re-evaluation.
  const anyPersisted = persistenceResults.some((r) => r.status === "PERSISTED");
  let qualifyingEvidenceCount = 0;
  let evaluationId: string | null = null;
  let enrichResult: any = null;

  if (anyPersisted) {
    const { countVerifiedOfficialEvidence } = await import("./autonomous-acquisition");
    const freshDocs = await listOfficialEvidence(input.operationId, input.organizationId, client);
    qualifyingEvidenceCount = countVerifiedOfficialEvidence(freshDocs);

    // PHASE 9 - AUTOMATIC OPPORTUNITY RE-EVALUATION
    const { enrichOpportunityFromEvidence } = await import("./opportunity-enrichment");
    enrichResult = await enrichOpportunityFromEvidence(input.operationId, input.organizationId, input.actorUserId, client);
    
    // We already have eval IDs handled inside enrichOpportunityFromEvidence
    // We can just query the latest eval id
    const finalEvalRow = await client.execute({
      sql: "SELECT id FROM opportunity_evaluations WHERE operation_id = ? ORDER BY evaluated_at DESC LIMIT 1",
      args: [input.operationId]
    });
    evaluationId = finalEvalRow.rows[0] ? String(finalEvalRow.rows[0].id) : null;

      // Audit the re-evaluation trigger
      await appendAudit(
        {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "OFFICIAL_EVIDENCE_RECORDED",
          entityType: "opportunity_evaluation",
          entityId: evaluationId ?? input.operationId,
          previousStateSummary: {},
          nextStateSummary: {
            qualifyingEvidenceCount,
            readyForAnalyst: enrichResult.readyForAnalyst,
            status: enrichResult.opportunityStatus,
          },
          metadata: { taskId: input.taskId, depre: input.depre, trigger: "EVIDENCE_SUBMISSION_REEVAL" },
          requestId: `phase7-reeval-${input.taskId}-${input.documentIdentifier}`,
          source: "PHASE7_MANUAL_RESEARCH",
        },
        client,
      );
  }

  // Auto-complete if opportunity is ready or primary blocker is resolved, otherwise IN_PROGRESS
  const isStillBlocked = enrichResult 
    ? enrichResult.blockers.some(b => task.instructions.targetBlockerCodes.includes(b))
    : true;
  
  const newStatus = isStillBlocked ? "IN_PROGRESS" : "COMPLETED";
  const completedReason = newStatus === "COMPLETED" ? "EVIDENCE_SUBMITTED" : undefined;

  await updateManualTaskStatus(
    input.taskId,
    input.organizationId,
    newStatus,
    input.actorUserId,
    completedReason,
    client,
  );

  return { persistenceResults, qualifyingEvidenceCount, evaluationId };
}

/**
 * Generate manual research tasks for all blocked DEPREs in a given pilot lot.
 * Idempotent — re-running will reuse existing tasks.
 */
export async function generateManualResearchBatch(
  cases: Array<{
    operationId: string;
    depre: string;
    blockerCodes: readonly OpportunityBlockerCode[];
    sourceAttempts: Array<{ source: string; sourceId: string; route: string; result: string; attemptedAt: string }>;
  }>,
  organizationId: string,
  actorUserId: string,
  client: Client = db,
): Promise<Array<{ operationId: string; depre: string; tasks: ManualResearchTask[]; created: number; reused: number }>> {
  const summary = [];

  for (const c of cases) {
    const tasks: ManualResearchTask[] = [];
    let created = 0;
    let reused = 0;

    // Get known identifiers from DB
    const opRow = await client.execute({
      sql: "SELECT workflow FROM operations WHERE id=? AND organization_id=?",
      args: [c.operationId, organizationId],
    });
    // PHASE 7 — BLOCKER-7-02: Extract known identifiers safely from workflow JSON
    // Never fabricates values; missing fields remain absent.
    let knownIdentifiers: GenerateManualTaskInput["knownIdentifiers"] = {};
    if (opRow.rows[0]) {
      const rawWorkflow = (opRow.rows[0] as Record<string, unknown>).workflow;
      knownIdentifiers = extractKnownIdentifiersCompat(rawWorkflow);
    }

    // Generate one task per source blocker (e.g. e-SAJ, CAC, DataJud)
    const attemptsToProcess = [...c.sourceAttempts];
    if (attemptsToProcess.length === 0 && c.blockerCodes.some(b => 
      ["INSUFFICIENT_SOURCE_COVERAGE", "DOCUMENTATION_BELOW_2_OF_2", "TITULAR_NOT_CONFIRMED", "PROCESS_NOT_CONFIRMED", "VALUE_NOT_CONFIRMED"].includes(b)
    )) {
      // Default task if no attempts but blockers exist
      attemptsToProcess.push({
        source: "TJSP / e-SAJ",
        sourceId: "tjsp-esaj-fallback",
        route: "search-fallback",
        result: "MANUAL_REQUIRED",
        attemptedAt: new Date().toISOString()
      });
    }

    for (const attempt of attemptsToProcess) {
      const isBlocked = [
        "MANUAL_REQUIRED", "CAPTCHA_REQUIRED", "AUTH_REQUIRED",
        "NO_RESULT", "RATE_LIMITED", "INVALID_QUERY", "INSUFFICIENT_COVERAGE"
      ].includes(attempt.result) || attempt.result === "INSUFFICIENT_COVERAGE" || attempt.result === "DOCUMENTATION_BELOW_2_OF_2";

      if (!isBlocked) continue;

      const { task, created: wasCreated } = await generateManualResearchTask(
        {
          organizationId,
          operationId: c.operationId,
          depre: c.depre,
          source: attempt.source,
          sourceId: attempt.sourceId,
          route: attempt.route,
          blockerType: attempt.result,
          sourceResult: attempt.result,
          blockerCodes: c.blockerCodes,
          actorUserId,
          knownIdentifiers,
          previousAttempts: c.sourceAttempts.map((a) => ({
            source: a.source,
            route: a.route,
            result: a.result,
            attemptedAt: a.attemptedAt,
          })),
        },
        client,
      );

      tasks.push(task);
      if (wasCreated) created++; else reused++;
    }

    summary.push({ operationId: c.operationId, depre: c.depre, tasks, created, reused });
  }

  return summary;
}
