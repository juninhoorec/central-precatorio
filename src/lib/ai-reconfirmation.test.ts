import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listAudit, verifyAuditChain } from "./audit";
import { initializeAutonomousAcquisition, recordOfficialEvidence } from "./autonomous-acquisition";
import { DatabaseStorageAdapter } from "./document-storage";
import {
  beginAiReconfirmation,
  buildAiReconfirmationPrompt,
  completeAiReconfirmation,
  executeAiReconfirmation,
  getAiReconfirmationAttempt,
  listAiReconfirmationAttempts,
  markAiReconfirmationRunning,
  prepareAiReconfirmationPreview,
  reconfirmationFieldNames,
  type ReconfirmationFieldResult,
  type ReconfirmationModelOutput,
} from "./ai-reconfirmation";
import { createDefaultWorkflow } from "./operational-workflow";
import { createOperation } from "./operations";

afterEach(() => vi.unstubAllEnvs());

async function makeFixture(db: ReturnType<typeof createClient>, organizationId = "reconfirmation-org-a") {
  const workflow = createDefaultWorkflow(180000);
  workflow.client.name = "Titular Fixture";
  workflow.credit.numeroProcessoDEPRE = "0038850-88.2017.8.26.0500";
  workflow.credit.numeroProcessoDEPRENormalizado = "00388508820178260500";
  workflow.credit.originProcessNumber = "1000001-00.2010.8.26.0114";
  workflow.credit.municipality = "Campinas";
  const operation = await createOperation({
    title: "Operação fixture de reconfirmação",
    debtor: "Município de Campinas",
    tribunal: "TJSP",
    process: workflow.credit.originProcessNumber,
    owner: "",
    source: "Fixture de teste",
    stage: "Entrada",
    nominal: 180000,
    notes: "Fixture exclusivo de teste em banco em memória.",
    tasks: [],
    checks: [],
    proposals: [],
    workflow,
    isDemo: false,
  }, db, organizationId, "fixture-owner");

  await initializeAutonomousAcquisition(db);
  const evidence = await recordOfficialEvidence({
    operationId: operation.id,
    organizationId,
    documentType: "OFFICIAL_RECORD",
    title: "Consulta oficial fixture",
    source: "TJSP fixture",
    sourceUrl: "https://www.tjsp.jus.br/consulta-fixture",
    downloadUrl: "",
    documentIdentifier: "DOC-FIXTURE-001",
    reference: "REF-FIXTURE-001",
    publishedAt: "",
    page: null,
    hash: "",
    contentFingerprint: "fixture-evidence-fingerprint",
    status: "COLLECTED",
    evidenceStrength: "MEDIUM",
    notes: "Fixture exclusivo de teste; não é evidência de caso real.",
    idempotencyKey: `fixture-evidence-${operation.id}`,
  }, db);

  const storage = new DatabaseStorageAdapter(db);
  const document = await storage.upload({
    operationId: operation.id,
    organizationId,
    name: "Documento fixture.pdf",
    bytes: new TextEncoder().encode("%PDF-1.4 fixture"),
    createdBy: "fixture-owner",
  });
  await storage.updateReview(document.id, organizationId, {
    status: "UPLOADED",
    category: "PRECATORIO",
    reviewerNotes: "Fixture de teste.",
    retentionUntil: "",
  });
  return { operation, evidence, document, storage, organizationId };
}

function fieldResult(input: Partial<ReconfirmationFieldResult> & Pick<ReconfirmationFieldResult, "field" | "status">): ReconfirmationFieldResult {
  return {
    field: input.field,
    originalValue: input.originalValue ?? null,
    observedValue: input.observedValue ?? null,
    status: input.status,
    confidence: input.confidence ?? null,
    evidenceIds: input.evidenceIds ?? [],
    documentIds: input.documentIds ?? [],
    observation: input.observation ?? "",
  };
}

async function startRun(fixture: Awaited<ReturnType<typeof makeFixture>>, db: ReturnType<typeof createClient>) {
  const pending = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
  return markAiReconfirmationRunning({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: pending!.id, actorUserId: "fixture-owner", client: db });
}

function modelOutputWith(overrides: Partial<Record<ReconfirmationFieldResult["field"], Partial<ReconfirmationModelOutput["fields"][number]>>> = {}): ReconfirmationModelOutput {
  return {
    summary: "Resultados limitados às fontes e ao snapshot do fixture.",
    fields: reconfirmationFieldNames.map((field) => ({
      field,
      observedValue: null,
      status: "NÃO_CONFIRMADO",
      confidence: null,
      sourceTokens: [],

      observation: "O snapshot original não possui informação suficiente para este campo.",
      ...overrides[field],
    })),
  };
}

async function executeModelOutput(fixture: Awaited<ReturnType<typeof makeFixture>>, db: ReturnType<typeof createClient>, output: ReconfirmationModelOutput) {
  const pending = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
  return executeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: pending!.id, actorUserId: "fixture-owner" }, {
    client: db,
    storage: fixture.storage,
    provider: { provider: "deepseek", model: "fixture-model", endpoint: "https://api.deepseek.com/chat/completions", timeoutMs: 1000, maxRetries: 0, structuredOutputMode: "json_object", apiKey: "fixture-only-key" },
    generate: async () => output,
  });
}

describe("AI reconfirmation evidence traceability", () => {
  it("teaches the prompt to cite official evidence and keep manual/snapshot sources separate", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const pending = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    const prompt = buildAiReconfirmationPrompt(pending!, []);
    expect(prompt.system).toContain("evidenceIds deve conter o ID dessa evidência");
    expect(prompt.system).toContain(`UUIDs de officialEvidence disponíveis para copiar exatamente: ${fixture.evidence.id}`);
    expect(prompt.system).toContain(`evidenceIds: [\"${fixture.evidence.id}\"]`);
    expect(prompt.system).toContain("manualBaseReferences");
    expect(prompt.system).toContain("Na evidência oficial vinculada");
    expect(prompt.system).toContain("não infira relação jurídica");
    db.close();
  });

  it("accepts a factual official-evidence observation when its ID is cited", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    await fixture.storage.updateReview(fixture.document.id, fixture.organizationId, {
      status: "ARCHIVED",
      category: "PRECATORIO",
      reviewerNotes: "Fixture arquivado para cenário com uma única officialEvidence.",
      retentionUntil: "",
    });
    const output = modelOutputWith({ titular: {
      observation: "A evidência oficial vinculada informa a referência REF-FIXTURE-001, mas isso não confirma a titularidade do snapshot.",
      sourceTokens: ["EVIDENCE-1"],
    } });
    const attempt = await executeModelOutput(fixture, db, output);
    expect(attempt).toMatchObject({ status: "COMPLETED" });
    expect(output.fields).toHaveLength(12);
    expect(attempt?.officialEvidenceReferences).toHaveLength(1);
    expect(attempt?.documentReferences).toHaveLength(0);
    expect(attempt?.fieldResults).toHaveLength(12);
    expect(attempt?.fieldResults.find(field => field.field === "titular")).toMatchObject({ status: "NÃO_CONFIRMADO", observedValue: null, evidenceIds: [fixture.evidence.id] });
    db.close();
  });

  it("fails semantic validation when an official-evidence observation omits its ID", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ titular: {
      observation: "A evidência oficial vinculada menciona Titular Fixture, sem determinar relação com outros titulares.",
    } }));
    expect(attempt).toMatchObject({ status: "FAILED", error: "RECONFIRMATION_EVIDENCE_REFERENCE_REQUIRED:titular", fieldResults: [] });
    db.close();
  });

  it("does not require an evidence ID for an observation limited to the snapshot", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ advogado: {
      observation: "O campo advogado estava vazio no snapshot original.",
    } }));
    expect(attempt).toMatchObject({ status: "COMPLETED" });
    expect(attempt?.fieldResults.find(field => field.field === "advogado")).toMatchObject({ status: "NÃO_CONFIRMADO", evidenceIds: [] });
    db.close();
  });

  it("rejects an official evidence ID attributed only to manual XLSX evidence", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ contato: {
      observation: "A evidência manual do XLSX menciona um contato público.",
      sourceTokens: ["EVIDENCE-1"],
    } }));
    expect(attempt).toMatchObject({ status: "FAILED", error: "RECONFIRMATION_MANUAL_EVIDENCE_REFERENCE_MISMATCH:contato", fieldResults: [] });
    db.close();
  });

  it("rejects evidence IDs outside the attempt's official evidence references", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ titular: {
      observation: "A evidência oficial vinculada menciona Titular Fixture.",
      sourceTokens: ["EVIDENCE-999"],
    } }));
    expect(attempt).toMatchObject({ status: "FAILED", error: "RECONFIRMATION_SOURCE_REFERENCE_MISMATCH:titular", fieldResults: [] });
    db.close();
  });

  it("continues to allow NÃO_CONFIRMADO with a valid evidence ID", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ titular: {
      observation: "A evidência oficial menciona Titular Fixture, mas não estabelece sua relação com outros titulares.",
      sourceTokens: ["EVIDENCE-1"],
    } }));
    expect(attempt).toMatchObject({ status: "COMPLETED" });
    expect(attempt?.fieldResults.find(field => field.field === "titular")?.status).toBe("NÃO_CONFIRMADO");
    db.close();
  });

  it.each(["DIVERGENTE", "ATUALIZADO"] as const)("preserva as regras semânticas existentes para %s", async status => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await executeModelOutput(fixture, db, modelOutputWith({ titular: {
      observedValue: "Nome explicitamente apresentado na evidência",
      status,
      confidence: 80,
      sourceTokens: ["EVIDENCE-1"],
      observation: "A evidência oficial vinculada apresenta um nome diferente do valor original.",
    } }));
    expect(attempt).toMatchObject({ status: "COMPLETED" });
    expect(attempt?.fieldResults.find(field => field.field === "titular")?.status).toBe(status);
    db.close();
  });
});

describe("AI reconfirmation persistence", () => {
  it("returns an explicit preview without creating an attempt", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const preview = await prepareAiReconfirmationPreview({
      organizationId: fixture.organizationId,
      operationId: fixture.operation.id,
      client: db,
      storage: fixture.storage,
    });
    expect(preview).toMatchObject({ previewOnly: true, attemptCreated: false, canStartExecution: true });
    expect(preview?.officialEvidenceReferences.map(item => item.id)).toContain(fixture.evidence.id);
    expect(preview?.documentReferences.map(item => item.id)).toContain(fixture.document.id);
    const runTable = await db.execute("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='ai_reconfirmation_runs'");
    expect(Number(runTable.rows[0].count)).toBe(0);
    expect(await listAiReconfirmationAttempts(fixture.organizationId, fixture.operation.id, db)).toHaveLength(0);
    db.close();
  });

  it("creates a PENDING attempt with the original snapshot and its evidence/document references", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    expect(attempt).toMatchObject({ status: "PENDING", overallStatus: null, confidence: null, operationId: fixture.operation.id });
    expect(attempt?.originalSnapshot.workflow.credit.numeroProcessoDEPRE).toBe("0038850-88.2017.8.26.0500");
    expect(attempt?.officialEvidenceReferences.map(item => item.id)).toEqual([fixture.evidence.id]);
    expect(attempt?.documentReferences.map(item => item.id)).toEqual([fixture.document.id]);
    await expect(completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "FAILED", error: "IA ainda não foi iniciada." } })).rejects.toThrow("RECONFIRMATION_RUN_NOT_RUNNING");
    const running = await markAiReconfirmationRunning({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db });
    expect(running?.status).toBe("RUNNING");
    await expect(markAiReconfirmationRunning({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db })).rejects.toThrow("RECONFIRMATION_RUN_NOT_PENDING");
    db.close();
  });

  it("allows multiple immutable run IDs for the same operation", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const first = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    const second = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v2", client: db, storage: fixture.storage });
    expect(first?.id).not.toBe(second?.id);
    expect(await listAiReconfirmationAttempts(fixture.organizationId, fixture.operation.id, db)).toHaveLength(2);
    db.close();
  });

  it("isolates attempt reads and writes by organization", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db, "reconfirmation-org-owner");
    const attempt = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    expect(await getAiReconfirmationAttempt(attempt!.id, "reconfirmation-org-other", fixture.operation.id, db)).toBeNull();
    expect(await listAiReconfirmationAttempts("reconfirmation-org-other", fixture.operation.id, db)).toHaveLength(0);
    await expect(beginAiReconfirmation({ organizationId: "reconfirmation-org-other", operationId: fixture.operation.id, actorUserId: "other", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage })).rejects.toThrow("RECONFIRMATION_OPERATION_NOT_FOUND");
    db.close();
  });

  it("isolates attempt history by operation ID", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const other = await makeFixture(db, fixture.organizationId);
    await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    expect(await listAiReconfirmationAttempts(fixture.organizationId, other.operation.id, db)).toHaveLength(0);
    db.close();
  });

  it("persists field results and only references evidence/documents included in the run", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    const completed = await completeAiReconfirmation({
      organizationId: fixture.organizationId,
      operationId: fixture.operation.id,
      runId: attempt!.id,
      actorUserId: "fixture-owner",
      client: db,
      completion: { status: "COMPLETED", overallStatus: "RECONFIRMADO", confidence: 88, summary: "Campos identificadores compatíveis.", fieldResults: [fieldResult({ field: "numeroProcessoDEPRE", originalValue: "0038850-88.2017.8.26.0500", observedValue: "0038850-88.2017.8.26.0500", status: "CONFIRMADO", confidence: 95, evidenceIds: [fixture.evidence.id], documentIds: [fixture.document.id] })] },
    });
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.fieldResults[0]).toMatchObject({ field: "numeroProcessoDEPRE", status: "CONFIRMADO", evidenceIds: [fixture.evidence.id], documentIds: [fixture.document.id] });
    db.close();
  });

  it("preserves the original operation snapshot and row after a completed attempt", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const before = await db.execute({ sql: "SELECT version,history,workflow,nominal,is_demo FROM operations WHERE id=? AND organization_id=?", args: [fixture.operation.id, fixture.organizationId] });
    const attempt = await startRun(fixture, db);
    await completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "ATUALIZADO", confidence: 71, summary: "Atualização simulada no fixture.", fieldResults: [fieldResult({ field: "valor", originalValue: 180000, observedValue: 123456, status: "ATUALIZADO", sourceTokens: ["EVIDENCE-1"] })] } });
    const after = await db.execute({ sql: "SELECT version,history,workflow,nominal,is_demo FROM operations WHERE id=? AND organization_id=?", args: [fixture.operation.id, fixture.organizationId] });
    expect(after.rows[0]).toEqual(before.rows[0]);
    const storedAttempt = await getAiReconfirmationAttempt(attempt!.id, fixture.organizationId, fixture.operation.id, db);
    expect(storedAttempt?.originalSnapshot.version).toBe(fixture.operation.version);
    db.close();
  });

  it("supports a field that remains not confirmed", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    const result = await completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "RECONFIRMADO", confidence: 40, summary: "Valor sem suporte suficiente.", fieldResults: [fieldResult({ field: "valor", originalValue: 180000, observedValue: null, status: "NÃO_CONFIRMADO", confidence: null, observation: "A evidência não contém valor nem data-base." })] } });
    expect(result?.fieldResults[0]).toMatchObject({ status: "NÃO_CONFIRMADO", originalValue: 180000, observedValue: null, evidenceIds: [] });
    db.close();
  });

  it("supports a divergence without writing the observed value into the operation", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    const result = await completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "DIVERGÊNCIA", confidence: 66, summary: "Titular divergente para revisão humana.", fieldResults: [fieldResult({ field: "titular", originalValue: "Titular Fixture", observedValue: "Nome observado na evidência", status: "DIVERGENTE", confidence: 66, sourceTokens: ["EVIDENCE-1"], observation: "Não sobrescrever a base original." })] } });
    expect(result?.fieldResults[0]).toMatchObject({ status: "DIVERGENTE", originalValue: "Titular Fixture", observedValue: "Nome observado na evidência" });
    const unchanged = await db.execute({ sql: "SELECT workflow FROM operations WHERE id=? AND organization_id=?", args: [fixture.operation.id, fixture.organizationId] });
    expect(JSON.parse(String(unchanged.rows[0].workflow)).client.name).toBe("Titular Fixture");
    db.close();
  });

  it("supports an updated field result as a separate observation", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    const result = await completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "ATUALIZADO", confidence: 72, summary: "Valor novo encontrado; revisar antes de aplicar.", fieldResults: [fieldResult({ field: "valor", originalValue: 180000, observedValue: 210000, status: "ATUALIZADO", confidence: 72, sourceTokens: ["EVIDENCE-1"] })] } });
    expect(result?.fieldResults[0]).toMatchObject({ status: "ATUALIZADO", originalValue: 180000, observedValue: 210000 });
    db.close();
  });

  it("rejects field results that cite evidence outside the run's source set", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    await expect(completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "RECONFIRMADO", confidence: 50, summary: "Teste de integridade.", fieldResults: [fieldResult({ field: "titular", originalValue: "Titular Fixture", observedValue: "Titular Fixture", status: "CONFIRMADO", evidenceIds: ["00000000-0000-4000-8000-000000000999"] })] } })).rejects.toThrow("RECONFIRMATION_EVIDENCE_REFERENCE_MISMATCH");
    const fields = await db.execute({ sql: "SELECT COUNT(*) AS count FROM ai_reconfirmation_field_results WHERE run_id=?", args: [attempt!.id] });
    expect(Number(fields.rows[0].count)).toBe(0);
    db.close();
  });

  it("rejects a caller-supplied original value that differs from the persisted snapshot", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    await expect(completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "DIVERGÊNCIA", confidence: 80, summary: "Fixture de integridade.", fieldResults: [fieldResult({ field: "valor", originalValue: 999, observedValue: 210000, status: "DIVERGENTE", sourceTokens: ["EVIDENCE-1"] })] } })).rejects.toThrow("RECONFIRMATION_ORIGINAL_VALUE_MISMATCH");
    await db.close();
  });

  it("writes append-only start and completion audit events", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const attempt = await startRun(fixture, db);
    await completeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: attempt!.id, actorUserId: "fixture-owner", client: db, completion: { status: "COMPLETED", overallStatus: "RECONFIRMADO", confidence: 91, summary: "Conferido.", fieldResults: [fieldResult({ field: "numeroProcessoDEPRE", originalValue: "0038850-88.2017.8.26.0500", observedValue: "0038850-88.2017.8.26.0500", status: "CONFIRMADO", sourceTokens: ["EVIDENCE-1"] })] } });
    const events = await listAudit(fixture.organizationId, "ai_reconfirmation_run", attempt!.id, db);
    expect(events.map(event => event.action).toSorted()).toEqual(["AI_RECONFIRMATION_COMPLETED", "AI_RECONFIRMATION_PREPARED", "AI_RECONFIRMATION_STARTED"]);
    expect(await verifyAuditChain(fixture.organizationId, db)).toBe(true);
    db.close();
  });

  it("runs only from a pending persisted attempt and stores a partial field-by-field result", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const failedEvidence = await recordOfficialEvidence({
      operationId: fixture.operation.id,
      organizationId: fixture.organizationId,
      documentType: "OFFICIAL_RECORD",
      title: "Evidência inválida fixture",
      source: "TJSP fixture",
      sourceUrl: "https://www.tjsp.jus.br/consulta-fixture-failed",
      downloadUrl: "",
      documentIdentifier: "DOC-FIXTURE-FAILED",
      reference: "REF-FIXTURE-FAILED",
      publishedAt: "",
      page: null,
      hash: "",
      contentFingerprint: "fixture-failed",
      status: "FAILED",
      evidenceStrength: "WEAK",
      notes: "Não deve entrar no conjunto utilizado.",
      idempotencyKey: `fixture-failed-${fixture.operation.id}`,
    }, db);
    const pending = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    const generate = vi.fn(async (prompt: string, system: string) => {
      void system;
      expect(prompt).toContain(fixture.evidence.id);
      expect(prompt).not.toContain(failedEvidence.id);
      return {
        summary: "DEPRE e titular confirmados; demais campos sem suporte.",
        fields: reconfirmationFieldNames.map((field) => {
          const confirmed = field === "numeroProcessoDEPRE" || field === "titular";
          const originalValue = field === "numeroProcessoDEPRE"
            ? "0038850-88.2017.8.26.0500"
            : field === "titular" ? "Titular Fixture" : null;
          return {
            field,
            observedValue: confirmed ? originalValue : null,
            status: confirmed ? "CONFIRMADO" as const : "NÃO_CONFIRMADO" as const,
            confidence: confirmed ? 90 : null,
            sourceTokens: confirmed ? ["EVIDENCE-1"] : [],

            observation: confirmed ? "Correspondência explícita na referência oficial." : "Sem evidência suficiente no pacote.",
          };
        }),
      };
    });
    const attempt = await executeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: pending!.id, actorUserId: "fixture-owner" }, {
      client: db,
      storage: fixture.storage,
      config: { baseUrl: "http://127.0.0.1:11434", model: "fixture-model", timeoutMs: 1000, maxRetries: 0 },
      fetcher: vi.fn(async () => Response.json({ models: [{ name: "fixture-model" }] })),
      generate,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(attempt).toMatchObject({ status: "COMPLETED", overallStatus: "PARCIAL", officialEvidenceReferences: [expect.objectContaining({ id: fixture.evidence.id })] });
    expect(attempt?.fieldResults).toHaveLength(reconfirmationFieldNames.length);
    expect(attempt?.fieldResults.filter((item) => item.status === "CONFIRMADO").map(item => item.field).toSorted()).toEqual(["numeroProcessoDEPRE", "titular"]);
    expect(attempt?.fieldResults.filter((item) => item.status === "NÃO_CONFIRMADO")).toHaveLength(reconfirmationFieldNames.length - 2);
    db.close();
  });

  it("marks a pending attempt failed when the local Ollama endpoint is unavailable without calling inference", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    const pending = await beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage });
    const generate = vi.fn();
    const result = await executeAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, runId: pending!.id, actorUserId: "fixture-owner" }, {
      client: db,
      storage: fixture.storage,
      config: { baseUrl: "http://127.0.0.1:11434", model: "fixture-model", timeoutMs: 1000, maxRetries: 0 },
      fetcher: vi.fn(async () => Response.json({ error: "offline" }, { status: 503 })),
      generate,
    });
    expect(result?.status).toBe("FAILED");
    expect(result?.error).toContain("RECONFIRMATION_OLLAMA_UNAVAILABLE");
    expect(generate).not.toHaveBeenCalled();
    expect(await verifyAuditChain(fixture.organizationId, db)).toBe(true);
    db.close();
  });

  it("does not create an execution attempt when no official evidence is usable", async () => {
    const db = createClient({ url: ":memory:" });
    const fixture = await makeFixture(db);
    await db.execute({ sql: "UPDATE official_evidence_documents SET status='FAILED' WHERE operation_id=? AND organization_id=?", args: [fixture.operation.id, fixture.organizationId] });
    await expect(beginAiReconfirmation({ organizationId: fixture.organizationId, operationId: fixture.operation.id, actorUserId: "fixture-owner", model: "fixture-model", promptVersion: "v1", client: db, storage: fixture.storage })).rejects.toThrow("RECONFIRMATION_OFFICIAL_EVIDENCE_REQUIRED");
    const runs = await db.execute("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='ai_reconfirmation_runs'");
    expect(Number(runs.rows[0].count)).toBe(0);
    db.close();
  });
});



