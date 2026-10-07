import { createClient, type Client } from "@libsql/client";
import { z } from "zod";
import { appendAudit } from "./audit";
import { listOfficialEvidence, countVerifiedOfficialEvidence, type OfficialEvidenceDocument } from "./autonomous-acquisition";
import { documentStorage, type DocumentMetadata, type StorageAdapter } from "./document-storage";
import { getOperation, type Operation } from "./operations";
import { isOfficialSourceUrl } from "./acquisition-sources";
import { generateStructuredWithProvider, resolveAIProvider, type ConfiguredAIProvider, type ProviderMetrics } from "./ai/ai-provider";
import type { AIProviderConfig } from "./ai/ollama-provider";
import { extractPdfText } from "./pdf-analysis";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });

export const reconfirmationFieldNames = [
  "numeroProcessoDEPRE",
  "titular",
  "devedor",
  "valor",
  "dataBase",
  "processoOriginario",
  "advogado",
  "oab",
  "epes",
  "numeroPrecatorio",
  "contato",
  "statusOperacional",
] as const;

export const reconfirmationFieldResultSchema = z.object({
  field: z.enum(reconfirmationFieldNames),
  originalValue: z.unknown(),
  observedValue: z.unknown(),
  status: z.enum(["CONFIRMADO", "NÃO_CONFIRMADO", "DIVERGENTE", "ATUALIZADO"]),
  confidence: z.number().min(0).max(100).nullable(),
  evidenceIds: z.array(z.string().uuid()).max(50).default([]),
  documentIds: z.array(z.string().uuid()).max(50).default([]),
  /** Source tokens from the model output — resolved deterministically to UUIDs by the system. */
  sourceTokens: z.array(z.string()).max(100).optional(),
  observation: z.string().trim().max(2000).default(""),
}).strict();

export type ReconfirmationFieldResult = z.infer<typeof reconfirmationFieldResultSchema>;

export const reconfirmationOverallStatusSchema = z.enum(["RECONFIRMADO", "PARCIAL", "ATUALIZADO", "DIVERGÊNCIA", "NÃO LOCALIZADO"]);
export const reconfirmationAttemptStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

const evidenceReferenceSchema = z.object({
  id: z.string().uuid(),
  documentType: z.string(),
  source: z.string(),
  sourceUrl: z.string().url(),
  documentIdentifier: z.string(),
  reference: z.string(),
  collectedAt: z.string(),
  status: z.string(),
  evidenceStrength: z.string(),
  hash: z.string(),
  contentFingerprint: z.string(),
}).strict();
const documentReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hash: z.string(),
  size: z.number().int().nonnegative(),
  mime: z.string(),
  category: z.string(),
  status: z.string(),
  scanStatus: z.string(),
  version: z.number().int().positive(),
  createdAt: z.string(),
}).strict();

export type AiReconfirmationPreview = {
  previewOnly: true;
  attemptCreated: false;
  operationId: string;
  operationVersion: number;
  model: string;
  promptVersion: string;
  originalSnapshot: Operation;
  officialEvidenceReferences: z.infer<typeof evidenceReferenceSchema>[];
  excludedOfficialEvidenceIds: string[];
  documentReferences: z.infer<typeof documentReferenceSchema>[];
  documentationCoverage: { verifiedDistinctDocuments: number; requiredDocuments: number; status: "0/2" | "1/2" | "2/2" };
  canStartExecution: boolean;
  blockers: string[];
};

export type AiReconfirmationAttempt = {
  id: string;
  organizationId: string;
  operationId: string;
  actorUserId: string;
  startedAt: string;
  completedAt: string;
  status: z.infer<typeof reconfirmationAttemptStatusSchema>;
  model: string;
  promptVersion: string;
  originalSnapshot: Operation;
  officialEvidenceReferences: z.infer<typeof evidenceReferenceSchema>[];
  documentReferences: z.infer<typeof documentReferenceSchema>[];
  overallStatus: z.infer<typeof reconfirmationOverallStatusSchema> | null;
  confidence: number | null;
  summary: string;
  error: string;
  fieldResults: ReconfirmationFieldResult[];
};

const observedValueSchema = z.union([
  z.string().trim().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.object({ phone: z.string().max(32), email: z.string().max(254) }).strict(),
]);
const modelFieldSchema = z.object({
  field: z.enum(reconfirmationFieldNames),
  observedValue: observedValueSchema,
  status: z.enum(["CONFIRMADO", "NÃO_CONFIRMADO", "DIVERGENTE", "ATUALIZADO"]),
  confidence: z.number().min(0).max(100).nullable(),
  sourceTokens: z.array(z.string()).max(100).default([]),
  observation: z.string().trim().max(2000),
}).passthrough();

export const reconfirmationModelOutputSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  fields: z.array(modelFieldSchema).length(reconfirmationFieldNames.length),
}).strict();
export type ReconfirmationModelOutput = z.infer<typeof reconfirmationModelOutputSchema>;

function rowAttempt(row: Record<string, unknown>, fieldRows: Record<string, unknown>[]): AiReconfirmationAttempt {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    operationId: String(row.operation_id),
    actorUserId: String(row.actor_user_id),
    startedAt: String(row.started_at),
    completedAt: String(row.completed_at || ""),
    status: reconfirmationAttemptStatusSchema.parse(String(row.status)),
    model: String(row.model),
    promptVersion: String(row.prompt_version),
    originalSnapshot: JSON.parse(String(row.original_snapshot_json)) as Operation,
    officialEvidenceReferences: JSON.parse(String(row.evidence_refs_json)) as AiReconfirmationAttempt["officialEvidenceReferences"],
    documentReferences: JSON.parse(String(row.document_refs_json)) as AiReconfirmationAttempt["documentReferences"],
    overallStatus: row.result_status ? reconfirmationOverallStatusSchema.parse(String(row.result_status)) : null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    summary: String(row.summary),
    error: String(row.error),
    fieldResults: fieldRows.map((field) => reconfirmationFieldResultSchema.parse({
      field: String(field.field_name),
      originalValue: JSON.parse(String(field.original_value_json)),
      observedValue: JSON.parse(String(field.observed_value_json)),
      status: String(field.status),
      confidence: field.confidence === null || field.confidence === undefined ? null : Number(field.confidence),
      evidenceIds: JSON.parse(String(field.evidence_ids_json)),
      documentIds: JSON.parse(String(field.document_ids_json)),
      observation: String(field.observation),
    })),
  };
}

async function fieldRowsForRun(runId: string, organizationId: string, client: Client) {
  const result = await client.execute({
    sql: "SELECT * FROM ai_reconfirmation_field_results WHERE run_id=? AND organization_id=? ORDER BY rowid",
    args: [runId, organizationId],
  });
  return result.rows as Record<string, unknown>[];
}

export async function initializeAiReconfirmation(client: Client = db) {
  await client.execute(`CREATE TABLE IF NOT EXISTS ai_reconfirmation_runs(
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    original_snapshot_json TEXT NOT NULL,
    evidence_refs_json TEXT NOT NULL,
    document_refs_json TEXT NOT NULL,
    result_status TEXT NOT NULL DEFAULT '',
    confidence REAL,
    summary TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT ''
  )`);
  await client.execute("CREATE INDEX IF NOT EXISTS ai_reconfirmation_operation_history_idx ON ai_reconfirmation_runs(organization_id,operation_id,started_at DESC)");
  await client.execute(`CREATE TABLE IF NOT EXISTS ai_reconfirmation_field_results(
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value_json TEXT NOT NULL,
    observed_value_json TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL,
    evidence_ids_json TEXT NOT NULL,
    document_ids_json TEXT NOT NULL,
    observation TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(run_id,field_name)
  )`);
  await client.execute("CREATE INDEX IF NOT EXISTS ai_reconfirmation_fields_operation_idx ON ai_reconfirmation_field_results(organization_id,operation_id,run_id)");
}

function operationSnapshot(operation: Operation): Operation {
  return structuredClone(operation);
}

function originalValueForField(operation: Operation, field: ReconfirmationFieldResult["field"]): unknown {
  const credit = operation.workflow.credit;
  switch (field) {
    case "numeroProcessoDEPRE": return credit.numeroProcessoDEPRE;
    case "titular": return operation.workflow.client.name;
    case "devedor": return operation.debtor;
    case "valor": return operation.nominal;
    case "dataBase": return credit.valueDate;
    case "processoOriginario": return credit.originProcessNumber || operation.process;
    case "advogado": return credit.legalRepName;
    case "oab": return credit.legalRepOab;
    case "epes": return credit.epesNumber ? `${credit.epesNumber}${credit.epesYear ? `/${credit.epesYear}` : ""}` : "";
    case "numeroPrecatorio": return credit.precatoryNumber;
    case "contato": return { phone: operation.workflow.client.phone, email: operation.workflow.client.email };
    case "statusOperacional": return operation.stage;
  }
}

function sameSnapshotValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function comparableValue(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (Array.isArray(value)) return value.map(comparableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, comparableValue(child)]));
  }
  return value;
}

function equivalentObservedValue(original: unknown, observed: unknown) {
  return JSON.stringify(comparableValue(original ?? null)) === JSON.stringify(comparableValue(observed ?? null));
}

function assertCurrentTitularAttribution(input: {
  operation: Operation;
  field: ReconfirmationFieldResult["field"];
  status: ReconfirmationFieldResult["status"];
  observedValue: unknown;
  evidenceIds: readonly string[];
  evidenceReferences: readonly { id: string; status: string; evidenceStrength: string }[];
}) {
  if (input.field !== "titular" || !["CONFIRMADO", "ATUALIZADO"].includes(input.status)) return;

  const currentTitulares = input.operation.workflow.client.beneficiaries.filter((beneficiary) =>
    beneficiary.role === "TITULAR" && beneficiary.status === "CURRENT_CONFIRMED",
  );
  const currentTitular = currentTitulares[0];
  const supportedEvidence = currentTitulares.length === 1
    && Boolean(currentTitular?.evidenceId)
    && input.evidenceIds.includes(currentTitular.evidenceId)
    && input.evidenceReferences.some((reference) =>
      reference.id === currentTitular.evidenceId
      && reference.status === "VERIFIED"
      && reference.evidenceStrength === "STRONG",
    );

  if (!supportedEvidence || !equivalentObservedValue(currentTitular?.name, input.observedValue)) {
    throw new Error("RECONFIRMATION_CURRENT_TITULAR_CONFIRMATION_REQUIRED");
  }
}

function normalizedObservation(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function observationReferencesOnlyManualSource(observation: string) {
  const text = normalizedObservation(observation);
  const manualSource = /\b(?:evidencia|documento|fonte) manual\b|\bmanualbasereferences\b|\b(?:xlsx|planilha)\b/.test(text);
  const officialSource = /\b(?:evidencia|documento|fonte|registro|publicacao) oficial\b|\bdiario oficial\b|\btjsp\b/.test(text);
  return manualSource && !officialSource;
}

function observationMakesOfficialEvidenceClaim(attempt: AiReconfirmationAttempt, item: ReconfirmationModelOutput["fields"][number]) {
  const text = normalizedObservation(item.observation);
  const factualStatement = /\b(?:menciona|mencionado|informa|informado|registra|registrado|apresenta|apresentado|contem|identifica|identificado|indica|indicado|consta|nao consta|nao informa|nao indica|nao apresenta|nao foi identificado|nao foi localizado|nao ha|sem suporte|ausencia de suporte|atesta|diferente|diverso|incompativel)\b/.test(text);
  const officialSource = /\b(?:evidencia|documento|fonte|registro|publicacao) oficial\b|\bdiario oficial\b|\btjsp\b/.test(text);
  if (officialSource && factualStatement) return true;
  if (observationReferencesOnlyManualSource(item.observation)) return false;

  const genericDocumentStatement = /\b(?:documento|documentos|evidencia|evidencias)\b.{0,120}\b(?:menciona|mencionado|informa|informado|registra|registrado|apresenta|apresentado|contem|identifica|identificado|indica|indicado|consta|nao consta|nao informa|nao indica|nao apresenta|nao foi identificado|nao foi localizado)\b/.test(text);
  return genericDocumentStatement && attempt.documentReferences.length === 0;
}

function mapEvidenceReference(item: OfficialEvidenceDocument) {
  return evidenceReferenceSchema.parse({
    id: item.id,
    documentType: item.documentType,
    source: item.source,
    sourceUrl: item.sourceUrl,
    documentIdentifier: item.documentIdentifier,
    reference: item.reference,
    collectedAt: item.collectedAt,
    status: item.status,
    evidenceStrength: item.evidenceStrength,
    hash: item.hash,
    contentFingerprint: item.contentFingerprint,
  });
}

function mapDocumentReference(item: DocumentMetadata) {
  return documentReferenceSchema.parse({
    id: item.id,
    name: item.name,
    hash: item.hash,
    size: item.size,
    mime: item.mime,
    category: item.category,
    status: item.status,
    scanStatus: item.scanStatus,
    version: item.version,
    createdAt: item.createdAt,
  });
}

export async function prepareAiReconfirmationPreview(input: {
  organizationId: string;
  operationId: string;
  client?: Client;
  storage?: StorageAdapter;
  model?: string;
  promptVersion?: string;
}): Promise<AiReconfirmationPreview | null> {
  const client = input.client || db;
  const operation = await getOperation(input.operationId, client, input.organizationId);
  if (!operation) return null;

  const allEvidence = await listOfficialEvidence(operation.id, input.organizationId, client);
  const usableEvidence = allEvidence.filter((item) =>
    ["COLLECTED", "VERIFIED", "DIVERGENT"].includes(item.status) && isOfficialSourceUrl(item.sourceUrl),
  );
  const storage = input.storage || documentStorage;
  const allDocuments = await storage.list(operation.id, input.organizationId);
  const availableDocuments = allDocuments.filter((item) => ["SAFE", "UPLOADED"].includes(item.status));
  const evidenceRefs = usableEvidence.map(mapEvidenceReference);
  const documentRefs = availableDocuments.map(mapDocumentReference);
  const documentationCoverage = countVerifiedOfficialEvidence(allEvidence);
  const blockers: string[] = [];
  if (!evidenceRefs.length) blockers.push("Nenhuma evidência oficial utilizável está associada à operação.");
  if (!availableDocuments.length) blockers.push("Nenhum documento anexado disponível; a reconfirmação ainda pode analisar apenas evidências oficiais estruturadas.");

  return {
    previewOnly: true,
    attemptCreated: false,
    operationId: operation.id,
    operationVersion: operation.version,
    model: input.model || process.env.CP_AI_MODEL || "qwen3:4b",
    promptVersion: input.promptVersion || "reconfirmation-v1",
    originalSnapshot: operationSnapshot(operation),
    officialEvidenceReferences: evidenceRefs,
    excludedOfficialEvidenceIds: allEvidence.filter((item) => !usableEvidence.includes(item)).map((item) => item.id),
    documentReferences: documentRefs,
    documentationCoverage: {
      verifiedDistinctDocuments: documentationCoverage,
      requiredDocuments: 2,
      status: documentationCoverage >= 2 ? "2/2" : documentationCoverage === 1 ? "1/2" : "0/2",
    },
    canStartExecution: evidenceRefs.length > 0,
    blockers,
  };
}

export async function beginAiReconfirmation(input: {
  organizationId: string;
  operationId: string;
  actorUserId: string;
  model: string;
  promptVersion: string;
  client?: Client;
  storage?: StorageAdapter;
}) {
  const client = input.client || db;
  const preview = await prepareAiReconfirmationPreview({ ...input, client });
  if (!preview) throw new Error("RECONFIRMATION_OPERATION_NOT_FOUND");
  if (!preview.officialEvidenceReferences.length) throw new Error("RECONFIRMATION_OFFICIAL_EVIDENCE_REQUIRED");
  if (input.model.trim().length < 1 || input.model.length > 120) throw new Error("RECONFIRMATION_MODEL_INVALID");
  if (input.promptVersion.trim().length < 1 || input.promptVersion.length > 80) throw new Error("RECONFIRMATION_PROMPT_VERSION_INVALID");

  await initializeAiReconfirmation(client);
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const tx = await client.transaction("write");
  try {
    await tx.execute({
      sql: "INSERT INTO ai_reconfirmation_runs(id,organization_id,operation_id,actor_user_id,started_at,completed_at,status,model,prompt_version,original_snapshot_json,evidence_refs_json,document_refs_json,result_status,confidence,summary,error) VALUES(?,?,?,?,?,'','PENDING',?,?,?, ?,?,'',NULL,'','')",
      args: [id, input.organizationId, input.operationId, input.actorUserId, startedAt, input.model, input.promptVersion, JSON.stringify(preview.originalSnapshot), JSON.stringify(preview.officialEvidenceReferences), JSON.stringify(preview.documentReferences)],
    });
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "AI_RECONFIRMATION_PREPARED",
      entityType: "ai_reconfirmation_run",
      entityId: id,
      previousStateSummary: {},
      nextStateSummary: { status: "PENDING", operationId: input.operationId, evidenceCount: preview.officialEvidenceReferences.length, documentCount: preview.documentReferences.length, aiExecuted: false },
      metadata: { model: input.model, promptVersion: input.promptVersion, operationVersion: preview.operationVersion },
      requestId: crypto.randomUUID(),
      source: "AI_RECONFIRMATION",
    }, tx);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getAiReconfirmationAttempt(id, input.organizationId, input.operationId, client);
}

export async function markAiReconfirmationRunning(input: {
  organizationId: string;
  operationId: string;
  runId: string;
  actorUserId: string;
  client?: Client;
}) {
  const client = input.client || db;
  await initializeAiReconfirmation(client);
  const tx = await client.transaction("write");
  try {
    const selected = await tx.execute({
      sql: "SELECT status,model,prompt_version FROM ai_reconfirmation_runs WHERE id=? AND organization_id=? AND operation_id=?",
      args: [input.runId, input.organizationId, input.operationId],
    });
    if (!selected.rows[0]) throw new Error("RECONFIRMATION_RUN_NOT_FOUND");
    if (String(selected.rows[0].status) !== "PENDING") throw new Error("RECONFIRMATION_RUN_NOT_PENDING");
    const updated = await tx.execute({
      sql: "UPDATE ai_reconfirmation_runs SET status='RUNNING' WHERE id=? AND organization_id=? AND operation_id=? AND status='PENDING'",
      args: [input.runId, input.organizationId, input.operationId],
    });
    if (updated.rowsAffected !== 1) throw new Error("RECONFIRMATION_RUN_NOT_PENDING");
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "AI_RECONFIRMATION_STARTED",
      entityType: "ai_reconfirmation_run",
      entityId: input.runId,
      previousStateSummary: { status: "PENDING" },
      nextStateSummary: { status: "RUNNING", operationId: input.operationId },
      metadata: { model: String(selected.rows[0].model), promptVersion: String(selected.rows[0].prompt_version) },
      requestId: crypto.randomUUID(),
      source: "AI_RECONFIRMATION",
    }, tx);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getAiReconfirmationAttempt(input.runId, input.organizationId, input.operationId, client);
}

export async function failPendingAiReconfirmation(input: {
  organizationId: string;
  operationId: string;
  runId: string;
  actorUserId: string;
  error: string;
  client?: Client;
}) {
  const client = input.client || db;
  const message = input.error.trim().slice(0, 2000) || "RECONFIRMATION_FAILED_BEFORE_EXECUTION";
  await initializeAiReconfirmation(client);
  const tx = await client.transaction("write");
  try {
    const selected = await tx.execute({
      sql: "SELECT status FROM ai_reconfirmation_runs WHERE id=? AND organization_id=? AND operation_id=?",
      args: [input.runId, input.organizationId, input.operationId],
    });
    if (!selected.rows[0]) throw new Error("RECONFIRMATION_RUN_NOT_FOUND");
    if (String(selected.rows[0].status) !== "PENDING") throw new Error("RECONFIRMATION_RUN_NOT_PENDING");
    const completedAt = new Date().toISOString();
    const updated = await tx.execute({
      sql: "UPDATE ai_reconfirmation_runs SET completed_at=?,status='FAILED',error=? WHERE id=? AND organization_id=? AND operation_id=? AND status='PENDING'",
      args: [completedAt, message, input.runId, input.organizationId, input.operationId],
    });
    if (updated.rowsAffected !== 1) throw new Error("RECONFIRMATION_RUN_NOT_PENDING");
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "AI_RECONFIRMATION_FAILED",
      entityType: "ai_reconfirmation_run",
      entityId: input.runId,
      previousStateSummary: { status: "PENDING" },
      nextStateSummary: { status: "FAILED", executionStarted: false },
      metadata: { operationId: input.operationId, error: message },
      requestId: crypto.randomUUID(),
      source: "AI_RECONFIRMATION",
    }, tx);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getAiReconfirmationAttempt(input.runId, input.organizationId, input.operationId, client);
}

type ReconfirmationExecutionOptions = {
  client?: Client;
  storage?: StorageAdapter;
  fetcher?: typeof fetch;
  config?: AIProviderConfig;
  provider?: ConfiguredAIProvider;
  generate?: (prompt: string, system: string) => Promise<ReconfirmationModelOutput>;
  onProviderMetrics?: (metrics: ProviderMetrics) => void;
};

function overallStatusFromFields(fields: ReconfirmationFieldResult[]): z.infer<typeof reconfirmationOverallStatusSchema> {
  if (fields.some((field) => field.status === "DIVERGENTE")) return "DIVERGÊNCIA";
  if (fields.some((field) => field.status === "ATUALIZADO")) return "ATUALIZADO";
  if (fields.every((field) => field.status === "CONFIRMADO")) return "RECONFIRMADO";
  if (fields.every((field) => field.status === "NÃO_CONFIRMADO")) return "NÃO LOCALIZADO";
  return "PARCIAL";
}

function averageConfidence(fields: ReconfirmationFieldResult[]) {
  const values = fields.filter((field) => field.status !== "NÃO_CONFIRMADO" && field.confidence !== null).map((field) => field.confidence as number);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

type ReconfirmationDocumentStorage = {
  createPrivateAccess(id: string, organizationId: string): Promise<{ metadata: Pick<DocumentMetadata, "hash" | "version">; bytes: ArrayBuffer } | null>;
};

async function buildDocumentInputs(attempt: AiReconfirmationAttempt, storage: ReconfirmationDocumentStorage) {
  const documents: { id: string; name: string; hash: string; category: string; extraction: "TEXT" | "NO_TEXT" | "SKIPPED_SIZE"; pages: string[] }[] = [];
  for (const reference of attempt.documentReferences) {
    const access = await storage.createPrivateAccess(reference.id, attempt.organizationId);
    if (!access) throw new Error(`RECONFIRMATION_DOCUMENT_UNAVAILABLE:${reference.id}`);
    if (access.metadata.hash !== reference.hash || access.metadata.version !== reference.version) {
      throw new Error(`RECONFIRMATION_DOCUMENT_CHANGED:${reference.id}`);
    }
    if (reference.size > 5_000_000) {
      documents.push({ id: reference.id, name: reference.name, hash: reference.hash, category: reference.category, extraction: "SKIPPED_SIZE", pages: [] });
      continue;
    }
    try {
      const extracted = await extractPdfText(new Uint8Array(access.bytes));
      const pages = extracted.pages.map((page) => page.slice(0, 12_000));
      documents.push({ id: reference.id, name: reference.name, hash: reference.hash, category: reference.category, extraction: pages.some((page) => page.trim()) ? "TEXT" : "NO_TEXT", pages });
    } catch {
      documents.push({ id: reference.id, name: reference.name, hash: reference.hash, category: reference.category, extraction: "NO_TEXT", pages: [] });
    }
  }
  return documents;
}

export function buildAiReconfirmationPrompt(attempt: AiReconfirmationAttempt, documents: Awaited<ReturnType<typeof buildDocumentInputs>>) {
  const originalFields = reconfirmationFieldNames.map((field) => ({ field, value: originalValueForField(attempt.originalSnapshot, field) }));
  const manualEvidence = attempt.originalSnapshot.workflow.evidence.filter((item) => item.sourceType !== "OFFICIAL").map((item) => ({ source: item.source, reference: item.reference, notes: item.notes }));
  const officialEvidenceTokens = attempt.officialEvidenceReferences.map((item, index) => ({ id: item.id, token: `EVIDENCE-${index + 1}` }));
  const documentTokens = documents.map((item, index) => ({ id: item.id, token: `DOC-${index + 1}` }));
  
  const tokenizedEvidence = attempt.officialEvidenceReferences.map((item, index) => ({ ...item, sourceToken: `EVIDENCE-${index + 1}` }));
  const tokenizedDocuments = documents.map((item, index) => ({ ...item, sourceToken: `DOC-${index + 1}` }));

  const packet = {
    operationSnapshot: attempt.originalSnapshot,
    originalFields,
    officialEvidence: tokenizedEvidence,
    attachedDocuments: tokenizedDocuments,
    manualBaseReferences: manualEvidence,
  };
  const contextJson = JSON.stringify(packet);
  if (contextJson.length > 32_000) throw new Error("RECONFIRMATION_INPUT_TOO_LARGE");

  // Build UUID-based guidance for deterministic evidence attribution.
  // The system (CP) will resolve sourceTokens → actual evidenceIds.
  // The AI must cite the sourceToken of the evidence it observed; the system validates and maps.
  const availableTokens = [...officialEvidenceTokens, ...documentTokens];
  const officialEvidenceIds = attempt.officialEvidenceReferences.map((item) => item.id);
  
  const evidenceIdGuidance = availableTokens.length
    ? [
      `UUIDs de officialEvidence disponíveis para copiar exatamente: ${officialEvidenceIds.join(", ")}.`,
      `Tokens de fontes disponíveis: ${availableTokens.map((t) => `${t.token}=${t.id}`).join(", ")}.`,
      "REGRA OPERACIONAL OBRIGATÓRIA: Se uma observation afirmar qualquer fato presente ou ausente no conteúdo de uma officialEvidence ou documento, sourceTokens NÃO PODE ser []. Copie para esse array o token exato (ex: EVIDENCE-1) da fonte que sustenta a observation. O sistema CP mapeará o token para o UUID correspondente — evidenceIds deve conter o ID dessa evidência.",
      `Exemplo: observation 'Na evidência oficial vinculada, constam os dados do DEPRE.' -> sourceTokens: ["${availableTokens[0]?.token || "EVIDENCE-1"}"]. Se esse token for EVIDENCE-1 e seu id for ${availableTokens[0]?.id || "<uuid>"}, o sistema registrará evidenceIds: ["${availableTokens[0]?.id || "<uuid>"}"].`,
      "Use somente tokens listados acima. Tokens inexistentes (ex: EVIDENCE-999) serão rejeitados pelo sistema.",
    ].join(" ")
    : "Não há officialEvidence ou documentos vinculados. Não invente tokens; observations limitadas ao snapshot/manual usam sourceTokens=[].";

  const system = [
    "Você é um auditor de reconfirmação de dados de precatórios. Analise exclusivamente o pacote persistido recebido; não consulte a internet, ferramentas ou conhecimento externo.",
    "Separe as origens: operationSnapshot/originalFields são a base importada; officialEvidence são registros oficiais; attachedDocuments são anexos; manualBaseReferences são referências manuais do XLSX e nunca são evidência oficial.",
    "Se uma observation afirmar conteúdo presente ou ausente em uma officialEvidence ou documento, sourceTokens deve conter o token dessa fonte (ex: EVIDENCE-1, DOC-1). Nunca associe um token a uma afirmação derivada apenas de manualBaseReferences ou do snapshot.",
    evidenceIdGuidance,
    "Limite cada observation à fonte examinada. Prefira 'Na evidência oficial [TOKEN], não foi identificado X' a afirmações amplas como 'nenhuma fonte oficial do pacote informa X', salvo quando todas as fontes do pacote tiverem sido verificadas e citadas.",
    "Para titular, CONFIRMADO ou ATUALIZADO só são permitidos quando o snapshot já contém exatamente um beneficiário role=TITULAR e status=CURRENT_CONFIRMED, o nome observado coincide exatamente após normalização e a evidência vinculada está VERIFIED + STRONG. Menção histórica, credor provisório, candidato, advogado ou papel de parte não confirma titularidade atual.",
    "Afirmações exclusivamente sobre o snapshot devem ser identificadas como tal e não precisam de sourceTokens. Nunca invente fontes, IDs, tokens, URLs, valores, datas, CPF/CNPJ, advogado, OAB ou contatos.",
    "Para cada campo listado em originalFields, retorne exatamente um resultado. Sem suporte direto, status NÃO_CONFIRMADO, observedValue null e confidence null.",
    "CONFIRMADO exige fonte vinculada que sustente valor semanticamente igual ao original. DIVERGENTE exige fonte explícita com valor incompatível. ATUALIZADO exige fonte oficial explícita com atualização real; diferenças apenas de grafia/formatação não são atualização.",
    "Uma pessoa diferente mencionada em documento não é automaticamente titular adicional, substituta, sucessora ou coproprietária; preserve a diferença como observação e não infira relação jurídica. Menção de advogado em documento não confirma automaticamente o campo advogado do snapshot. Nunca use ausência de informação como divergência. Nunca interprete dataRecebimento como data-base nem SEI como processo originário. Não misture os papéis dos campos.",
    "Resultado geral será calculado pelo sistema a partir dos estados por campo. Retorne summary e fields apenas.",
    "não infira relação jurídica entre pessoas citadas e os credores originais.",
  ].join(" ");
  const prompt = `<pacote_persistido>\n${contextJson}\n</pacote_persistido>\n\nRetorne JSON com summary e exatamente ${reconfirmationFieldNames.length} resultados, um por campo. Para NÃO_CONFIRMADO use observedValue null, confidence null e explique a ausência de suporte.`;
  return { prompt, system, contextJson, schema: reconfirmationModelOutputSchema };
}


export async function buildAiReconfirmationRequest(attempt: AiReconfirmationAttempt, storage: ReconfirmationDocumentStorage) {
  const documents = await buildDocumentInputs(attempt, storage);
  return { ...buildAiReconfirmationPrompt(attempt, documents), documents };
}

export async function readAiReconfirmationAttemptForBenchmark(runId: string, client: Client = db) {
  const result = await client.execute({
    sql: "SELECT * FROM ai_reconfirmation_runs WHERE id=? LIMIT 1",
    args: [runId],
  });
  if (!result.rows[0]) return null;
  return rowAttempt(result.rows[0], await fieldRowsForRun(runId, String(result.rows[0].organization_id), client));
}

function validateModelFieldResults(attempt: AiReconfirmationAttempt, output: ReconfirmationModelOutput): ReconfirmationFieldResult[] {
  const tokenToEvidenceId = new Map(attempt.officialEvidenceReferences.map((item, index) => [`EVIDENCE-${index + 1}`, item.id]));
  const tokenToDocumentId = new Map(attempt.documentReferences.map((item, index) => [`DOC-${index + 1}`, item.id]));

  const fields = output.fields.map((item) => {
    const originalValue = originalValueForField(attempt.originalSnapshot, item.field);
    const evidenceIds: string[] = [];
    const documentIds: string[] = [];
    
    // Deterministic attribution: map system-assigned tokens back to the real UUIDs.
    // Tokens that do not resolve to a known UUID are a protocol violation —
    // the AI cited a reference that does not exist in this package.
    for (const token of item.sourceTokens || []) {
      const eId = tokenToEvidenceId.get(token);
      if (eId) { evidenceIds.push(eId); continue; }
      const dId = tokenToDocumentId.get(token);
      if (dId) { documentIds.push(dId); continue; }
      // Token not recognized: the AI cited a source that is not part of this run.
      // This is a source-reference mismatch, not a missing-reference error.
      throw new Error(`RECONFIRMATION_SOURCE_REFERENCE_MISMATCH:${item.field}`);
    }

    if (item.status === "NÃO_CONFIRMADO" && item.observedValue !== null) throw new Error(`RECONFIRMATION_UNSUPPORTED_OBSERVATION:${item.field}`);
    assertCurrentTitularAttribution({ operation: attempt.originalSnapshot, field: item.field, status: item.status, observedValue: item.observedValue, evidenceIds, evidenceReferences: attempt.officialEvidenceReferences });
    if (item.status === "CONFIRMADO" && (!evidenceIds.length && !documentIds.length || !equivalentObservedValue(originalValue, item.observedValue))) throw new Error(`RECONFIRMATION_UNSUPPORTED_CONFIRMATION:${item.field}`);
    if ((item.status === "DIVERGENTE" || item.status === "ATUALIZADO") && ((!evidenceIds.length && !documentIds.length) || item.observedValue === null || equivalentObservedValue(originalValue, item.observedValue))) throw new Error(`RECONFIRMATION_UNSUPPORTED_CHANGE:${item.field}`);
    if (observationReferencesOnlyManualSource(item.observation) && evidenceIds.length) throw new Error(`RECONFIRMATION_MANUAL_EVIDENCE_REFERENCE_MISMATCH:${item.field}`);
    if (observationMakesOfficialEvidenceClaim(attempt, { ...item, evidenceIds, documentIds }) && !evidenceIds.length) throw new Error(`RECONFIRMATION_EVIDENCE_REFERENCE_REQUIRED:${item.field}`);
    
    return { 
      field: item.field,
      observedValue: item.observedValue,
      status: item.status,
      confidence: item.confidence,
      evidenceIds,
      documentIds,
      observation: item.observation,
      originalValue, 
    };
  });

  if (new Set(fields.map((field) => field.field)).size !== reconfirmationFieldNames.length) throw new Error("RECONFIRMATION_FIELD_SET_INCOMPLETE");
  return fields;
}

export async function executeAiReconfirmation(input: {
  organizationId: string;
  operationId: string;
  runId: string;
  actorUserId: string;
}, options: ReconfirmationExecutionOptions = {}) {
  const client = options.client || db;
  const fetcher = options.fetcher || fetch;
  const provider = options.provider || (options.config
    ? {
      ...resolveAIProvider("ollama", false),
      model: options.config.model,
      endpoint: `${options.config.baseUrl.replace(/\/$/, "")}/api/chat`,
      timeoutMs: options.config.timeoutMs,
      maxRetries: options.config.maxRetries,
      ollamaConfig: options.config,
    }
    : resolveAIProvider());
  const attempt = await getAiReconfirmationAttempt(input.runId, input.organizationId, input.operationId, client);
  if (!attempt) throw new Error("RECONFIRMATION_RUN_NOT_FOUND");
  if (attempt.status !== "PENDING") throw new Error("RECONFIRMATION_RUN_NOT_PENDING");

  let started = false;
  try {
    if (provider.provider === "ollama") {
      const baseUrl = new URL(provider.ollamaConfig!.baseUrl);
      if (baseUrl.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname)) {
        throw new Error("RECONFIRMATION_LOCAL_OLLAMA_REQUIRED");
      }
      const tagsResponse = await fetcher(new URL("/api/tags", baseUrl), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!tagsResponse.ok) throw new Error(`RECONFIRMATION_OLLAMA_UNAVAILABLE:HTTP_${tagsResponse.status}`);
      const tags = await tagsResponse.json() as { models?: { name?: string }[] };
      if (!Array.isArray(tags.models) || !tags.models.some((model) => model.name === attempt.model || model.name?.startsWith(`${attempt.model}:`))) {
        throw new Error("RECONFIRMATION_OLLAMA_MODEL_NOT_FOUND");
      }
    }
    if (attempt.model !== provider.model) throw new Error("RECONFIRMATION_MODEL_CONFIGURATION_MISMATCH");
    if (provider.provider !== "ollama" && !provider.apiKey) throw new Error(`AI_PROVIDER_API_KEY_MISSING:${provider.provider}`);

    const request = await buildAiReconfirmationRequest(attempt, options.storage || documentStorage);
    const running = await markAiReconfirmationRunning({ ...input, client });
    started = true;
    if (!running) throw new Error("RECONFIRMATION_RUN_NOT_FOUND");

    const output = options.generate
      ? await options.generate(request.prompt, request.system)
      : await generateStructuredWithProvider({ config: provider, prompt: request.prompt, system: request.system, schema: request.schema, fetcher, onMetrics: options.onProviderMetrics });
    const parsedOutput = reconfirmationModelOutputSchema.parse(output);
    const fieldResults = validateModelFieldResults(attempt, parsedOutput);
    return await completeAiReconfirmation({
      ...input,
      client,
      completion: {
        status: "COMPLETED",
        overallStatus: overallStatusFromFields(fieldResults),
        confidence: averageConfidence(fieldResults),
        summary: parsedOutput.summary,
        fieldResults,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "RECONFIRMATION_EXECUTION_FAILED";
    const current = await getAiReconfirmationAttempt(input.runId, input.organizationId, input.operationId, client).catch(() => null);
    if (current?.status === "RUNNING" && started) {
      return completeAiReconfirmation({ ...input, client, completion: { status: "FAILED", error: message } });
    }
    if (current?.status === "PENDING") {
      return failPendingAiReconfirmation({ ...input, client, error: message });
    }
    throw error;
  }
}

const completionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("COMPLETED"), overallStatus: reconfirmationOverallStatusSchema, confidence: z.number().min(0).max(100).nullable(), summary: z.string().trim().max(4000), fieldResults: z.array(reconfirmationFieldResultSchema).max(reconfirmationFieldNames.length) }).strict(),
  z.object({ status: z.literal("FAILED"), error: z.string().trim().min(1).max(2000) }).strict(),
]);

export async function completeAiReconfirmation(input: {
  organizationId: string;
  operationId: string;
  runId: string;
  actorUserId: string;
  completion: z.input<typeof completionSchema>;
  client?: Client;
}) {
  const client = input.client || db;
  const completion = completionSchema.parse(input.completion);
  await initializeAiReconfirmation(client);
  const tx = await client.transaction("write");
  try {
    const selected = await tx.execute({
      sql: "SELECT * FROM ai_reconfirmation_runs WHERE id=? AND organization_id=? AND operation_id=?",
      args: [input.runId, input.organizationId, input.operationId],
    });
    if (!selected.rows[0]) throw new Error("RECONFIRMATION_RUN_NOT_FOUND");
    const run = selected.rows[0];
    if (String(run.status) !== "RUNNING") throw new Error("RECONFIRMATION_RUN_NOT_RUNNING");
    const originalSnapshot = JSON.parse(String(run.original_snapshot_json)) as Operation;
    const evidenceRefs = JSON.parse(String(run.evidence_refs_json)) as { id: string; status: string; evidenceStrength: string }[];
    const documentRefs = JSON.parse(String(run.document_refs_json)) as { id: string }[];
    const allowedEvidenceIds = new Set(evidenceRefs.map((item) => item.id));
    const allowedDocumentIds = new Set(documentRefs.map((item) => item.id));

    if (completion.status === "COMPLETED") {
      const fields = completion.fieldResults.map((item) => reconfirmationFieldResultSchema.parse(item));
      if (new Set(fields.map((item) => item.field)).size !== fields.length) throw new Error("RECONFIRMATION_DUPLICATE_FIELD");
      for (const field of fields) {
        if (!sameSnapshotValue(field.originalValue, originalValueForField(originalSnapshot, field.field))) throw new Error("RECONFIRMATION_ORIGINAL_VALUE_MISMATCH");
        if (field.evidenceIds.some((id) => !allowedEvidenceIds.has(id))) throw new Error("RECONFIRMATION_EVIDENCE_REFERENCE_MISMATCH");
        if (field.documentIds.some((id) => !allowedDocumentIds.has(id))) throw new Error("RECONFIRMATION_DOCUMENT_REFERENCE_MISMATCH");
        assertCurrentTitularAttribution({ operation: originalSnapshot, field: field.field, status: field.status, observedValue: field.observedValue, evidenceIds: field.evidenceIds, evidenceReferences: evidenceRefs });
      }
      const completedAt = new Date().toISOString();
      await tx.execute({
        sql: "UPDATE ai_reconfirmation_runs SET completed_at=?,status='COMPLETED',result_status=?,confidence=?,summary=?,error='' WHERE id=? AND organization_id=? AND operation_id=? AND status='RUNNING'",
        args: [completedAt, completion.overallStatus, completion.confidence, completion.summary, input.runId, input.organizationId, input.operationId],
      });
      for (const field of fields) {
        await tx.execute({
          sql: "INSERT INTO ai_reconfirmation_field_results(id,run_id,organization_id,operation_id,field_name,original_value_json,observed_value_json,status,confidence,evidence_ids_json,document_ids_json,observation,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          args: [crypto.randomUUID(), input.runId, input.organizationId, input.operationId, field.field, JSON.stringify(field.originalValue ?? null), JSON.stringify(field.observedValue ?? null), field.status, field.confidence, JSON.stringify(field.evidenceIds), JSON.stringify(field.documentIds), field.observation, completedAt],
        });
      }
      await appendAudit({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "AI_RECONFIRMATION_COMPLETED",
        entityType: "ai_reconfirmation_run",
        entityId: input.runId,
        previousStateSummary: { status: "RUNNING" },
        nextStateSummary: { status: "COMPLETED", overallStatus: completion.overallStatus, fieldCount: fields.length, confidence: completion.confidence },
        metadata: { operationId: input.operationId, model: String(run.model), promptVersion: String(run.prompt_version) },
        requestId: crypto.randomUUID(),
        source: "AI_RECONFIRMATION",
      }, tx);
    } else {
      const completedAt = new Date().toISOString();
      await tx.execute({
        sql: "UPDATE ai_reconfirmation_runs SET completed_at=?,status='FAILED',error=? WHERE id=? AND organization_id=? AND operation_id=? AND status='RUNNING'",
        args: [completedAt, completion.error, input.runId, input.organizationId, input.operationId],
      });
      await appendAudit({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "AI_RECONFIRMATION_FAILED",
        entityType: "ai_reconfirmation_run",
        entityId: input.runId,
        previousStateSummary: { status: "RUNNING" },
        nextStateSummary: { status: "FAILED" },
        metadata: { operationId: input.operationId, error: completion.error },
        requestId: crypto.randomUUID(),
        source: "AI_RECONFIRMATION",
      }, tx);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getAiReconfirmationAttempt(input.runId, input.organizationId, input.operationId, client);
}

export async function getAiReconfirmationAttempt(runId: string, organizationId: string, operationId: string, client: Client = db) {
  await initializeAiReconfirmation(client);
  const result = await client.execute({
    sql: "SELECT * FROM ai_reconfirmation_runs WHERE id=? AND organization_id=? AND operation_id=?",
    args: [runId, organizationId, operationId],
  });
  if (!result.rows[0]) return null;
  return rowAttempt(result.rows[0], await fieldRowsForRun(runId, organizationId, client));
}

export async function listAiReconfirmationAttempts(organizationId: string, operationId: string, client: Client = db) {
  await initializeAiReconfirmation(client);
  const result = await client.execute({
    sql: "SELECT * FROM ai_reconfirmation_runs WHERE organization_id=? AND operation_id=? ORDER BY started_at DESC,id DESC",
    args: [organizationId, operationId],
  });
  const attempts: AiReconfirmationAttempt[] = [];
  for (const row of result.rows) attempts.push(rowAttempt(row, await fieldRowsForRun(String(row.id), organizationId, client)));
  return attempts;
}
