import { createClient, type Client } from "@libsql/client";
import { z } from "zod";
import { calculatePricing, createDefaultWorkflow, inventoryMetadataForSources, operationalWorkflowSchema, transitionBlockReason, type OperationalWorkflow } from "./operational-workflow";
import { DEMO_DOCUMENT_DISCLAIMER, DEMO_DOCUMENT_NAME, DEMO_LEAD, DEMO_PRICING_MARKER, DEMO_REVIEW_MARKER } from "./demo-fixture";

export const operationStages = [
  "Entrada",
  "Análise",
  "Diligência",
  "Proposta",
  "Formalização",
  "Acompanhamento",
  "Encerrado",
] as const;

const shortText = z.string().trim().min(1).max(160);
const optionalShortText = z.string().trim().max(160);
const optionalIdentifier = z.string().trim().max(100);
const operationalDate = z.union([z.literal(""), z.iso.date(), z.iso.datetime()]);

export const operationTaskSchema = z
  .object({
    id: z.string().uuid(),
    title: shortText,
    due: operationalDate,
    done: z.boolean(),
  })
  .strict();

export const operationCheckSchema = z
  .object({ id: z.string().uuid(), title: shortText, done: z.boolean() })
  .strict();

export const operationProposalSchema = z
  .object({
    id: z.string().uuid(),
    buyer: shortText,
    price: z.number().finite().nonnegative().max(1_000_000_000_000),
    costs: z.number().finite().nonnegative().max(1_000_000_000_000),
    months: z.number().int().min(1).max(1200),
    receipt: z.number().finite().nonnegative().max(1_000_000_000_000),
    validUntil: operationalDate,
    conditions: z.string().trim().max(4_000),
  })
  .strict();

export const operationHistorySchema = z
  .object({ at: z.string().datetime(), text: z.string().min(1).max(600) })
  .strict();

export const operationSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    title: shortText,
    debtor: optionalShortText,
    tribunal: optionalIdentifier,
    process: optionalIdentifier,
    owner: optionalShortText,
    source: z.string().trim().max(240),
    stage: z.enum(operationStages),
    nominal: z.number().finite().nonnegative().max(1_000_000_000_000),
    notes: z.string().trim().max(12_000),
    tasks: z.array(operationTaskSchema).max(200),
    checks: z.array(operationCheckSchema).max(300),
    proposals: z.array(operationProposalSchema).max(100),
    history: z.array(operationHistorySchema).max(1_000),
    workflow: operationalWorkflowSchema,
    isDemo: z.boolean(),
  })
  .strict();

export const createOperationSchema = operationSchema
  .omit({ id: true, version: true, history: true })
  .extend({
    stage: z.enum(operationStages).default("Entrada"),
    nominal: z.number().finite().nonnegative().max(1_000_000_000_000).default(0),
    notes: z.string().trim().max(12_000).default(""),
    tasks: z.array(operationTaskSchema).max(200).default([]),
    checks: z.array(operationCheckSchema).max(300).default([]),
    proposals: z.array(operationProposalSchema).max(100).default([]),
    workflow: operationalWorkflowSchema.optional(),
    isDemo: z.boolean().default(false),
  })
  .strict();

// A UI pode devolver o objeto completo. O histórico é validado para o contrato,
// mas nunca é usado na gravação: apenas eventos criados pelo servidor persistem.
export const updateOperationSchema = operationSchema;

export type Operation = z.infer<typeof operationSchema>;
export type CreateOperationInput = z.input<typeof createOperationSchema>;

const client = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const initializedOperationSchemas = new WeakSet<Client>();

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  debtor TEXT NOT NULL,
  tribunal TEXT NOT NULL,
  process TEXT NOT NULL,
  owner TEXT NOT NULL,
  source TEXT NOT NULL,
  stage TEXT NOT NULL,
  nominal REAL NOT NULL,
  notes TEXT NOT NULL,
  tasks TEXT NOT NULL,
  checks TEXT NOT NULL,
  proposals TEXT NOT NULL,
  history TEXT NOT NULL,
  workflow TEXT NOT NULL DEFAULT '{}',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

export async function applyOperationsSchema(db: Client = client) {
  await db.execute(TABLE_SQL);
  const columns = await db.execute("PRAGMA table_info(operations)");
  if (!columns.rows.some(row => row.name === "organization_id")) {
    // Quarantine legacy records. Never assign them to a newly registered customer.
    try { await db.execute("ALTER TABLE operations ADD COLUMN organization_id TEXT NOT NULL DEFAULT 'legacy-internal'"); }
    catch (error) { const current = await db.execute("PRAGMA table_info(operations)"); if (!current.rows.some(row => row.name === "organization_id")) throw error; }
  }
  if (!columns.rows.some(row => row.name === "workflow")) {
    try { await db.execute("ALTER TABLE operations ADD COLUMN workflow TEXT NOT NULL DEFAULT '{}'"); }
    catch (error) { const current = await db.execute("PRAGMA table_info(operations)"); if (!current.rows.some(row => row.name === "workflow")) throw error; }
  }
  if (!columns.rows.some(row => row.name === "is_demo")) {
    try { await db.execute("ALTER TABLE operations ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0"); }
    catch (error) { const current = await db.execute("PRAGMA table_info(operations)"); if (!current.rows.some(row => row.name === "is_demo")) throw error; }
  }
  await db.execute("CREATE INDEX IF NOT EXISTS operations_organization_idx ON operations(organization_id,updated_at DESC)");
  await db.execute(
    "CREATE INDEX IF NOT EXISTS operations_updated_at_idx ON operations(updated_at DESC)",
  );
  initializedOperationSchemas.add(db);
}

export async function initializeOperations(db: Client = client) {
  if (initializedOperationSchemas.has(db)) return;
  if (process.env.NODE_ENV === "test") {
    await applyOperationsSchema(db);
    return;
  }
  let migrations: { version: unknown }[];
  try {
    migrations = (await db.execute("SELECT version FROM cp_migrations WHERE version='20260919_cp21_foundation'")).rows as unknown as { version: unknown }[];
  } catch {
    throw new Error("SCHEMA_MIGRATIONS_REQUIRED:20260919_cp21_foundation");
  }
  if (!migrations.length) throw new Error("SCHEMA_MIGRATIONS_REQUIRED:20260919_cp21_foundation");
  const columns = await db.execute("PRAGMA table_info(operations)");
  const existingColumns = new Set(columns.rows.map(row => String(row.name)));
  const requiredColumns = ["id", "version", "workflow", "is_demo", "organization_id"];
  const missing = requiredColumns.filter(column => !existingColumns.has(column));
  if (missing.length) throw new Error(`OPERATIONS_SCHEMA_INCOMPLETE:${missing.join(",")}`);
}

function workflowFromRow(row: Record<string, unknown>) {
  try {
    const storedWorkflow = JSON.parse(String(row.workflow || "{}")) as Record<string, unknown>;
    const workflow = operationalWorkflowSchema.parse(storedWorkflow);
    workflow.inventory = inventoryMetadataForSources([
      String(row.source || ""),
      workflow.credit.sourceName,
      ...workflow.evidence.map((item) => item.source),
    ], storedWorkflow.inventory);
    return workflow;
  }
  catch { return createDefaultWorkflow(Number(row.nominal) || 0); }
}

function fromRow(row: Record<string, unknown>): Operation {
  return operationSchema.parse({
    id: String(row.id),
    version: Number(row.version),
    title: String(row.title),
    debtor: String(row.debtor),
    tribunal: String(row.tribunal),
    process: String(row.process),
    owner: String(row.owner),
    source: String(row.source),
    stage: String(row.stage),
    nominal: Number(row.nominal),
    notes: String(row.notes),
    tasks: JSON.parse(String(row.tasks)),
    checks: JSON.parse(String(row.checks)),
    proposals: JSON.parse(String(row.proposals)),
    history: JSON.parse(String(row.history)),
    workflow: workflowFromRow(row),
    isDemo: Boolean(row.is_demo),
  });
}

export async function listOperations(db: Client = client, organizationId = "legacy-internal"): Promise<Operation[]> {
  await initializeOperations(db);
  const result = await db.execute({sql: "SELECT * FROM operations WHERE organization_id = ? ORDER BY updated_at DESC, id ASC", args: [organizationId]});
  return result.rows.map((row) => fromRow(row));
}

export async function getOperation(id:string, db:Client=client, organizationId="legacy-internal"):Promise<Operation|null>{await initializeOperations(db);const result=await db.execute({sql:"SELECT * FROM operations WHERE id=? AND organization_id=?",args:[id,organizationId]});return result.rows[0]?fromRow(result.rows[0]):null}

export async function createOperation(
  input: CreateOperationInput,
  db: Client = client,
  organizationId = "legacy-internal",
  actor = "internal",
): Promise<Operation> {
  const parsed = createOperationSchema.parse(input);
  if (parsed.workflow && parsed.workflow.stage !== "NEW") throw new Error("INVALID_INITIAL_WORKFLOW_STAGE");
  await initializeOperations(db);
  const now = new Date().toISOString();
  const operation: Operation = {
    ...parsed,
    workflow: parsed.workflow ?? createDefaultWorkflow(parsed.nominal),
    id: crypto.randomUUID(),
    version: 1,
    history: [{ at: now, text: `Operação criada. Usuário: ${actor}.` }],
  };
  await db.execute({
    sql: `INSERT INTO operations (id,version,title,debtor,tribunal,process,owner,source,stage,nominal,notes,tasks,checks,proposals,history,workflow,is_demo,created_at,updated_at,organization_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      operation.id,
      operation.version,
      operation.title,
      operation.debtor,
      operation.tribunal,
      operation.process,
      operation.owner,
      operation.source,
      operation.stage,
      operation.nominal,
      operation.notes,
      JSON.stringify(operation.tasks),
      JSON.stringify(operation.checks),
      JSON.stringify(operation.proposals),
      JSON.stringify(operation.history),
      JSON.stringify(operation.workflow),
      operation.isDemo ? 1 : 0,
      now,
      now,
      organizationId,
    ],
  });
  return operation;
}

const DEMO_EVIDENCE_SOURCE = DEMO_LEAD.source;
const DEMO_EVIDENCE_REFERENCE = DEMO_LEAD.reference;
const DEMO_DEPRE_NUMBER = DEMO_LEAD.depreNumber;

function demoEvidence(retrievedAt: string): OperationalWorkflow["evidence"][number] {
  return {
    id: crypto.randomUUID(),
    source: DEMO_EVIDENCE_SOURCE,
    sourceType: "MANUAL",
    reference: DEMO_EVIDENCE_REFERENCE,
    retrievedAt,
    confidence: 100,
    status: "COMPATÍVEL",
    notes: `${DEMO_LEAD.disclaimer}. Fonte inteiramente sintética; não é consulta oficial nem dado do TJSP. Trecho: DEMONSTRAÇÃO CP — Nº Processo DEPRE: ${DEMO_LEAD.depreNumber} — Valor atualizado: R$ 187.450,32 — Natureza: ${DEMO_LEAD.nature} — Devedora: ${DEMO_LEAD.debtor}.`,
  };
}

function populateDemoWorkflow(workflow: OperationalWorkflow, now: string) {
  workflow.priority = "HIGH";
  workflow.confidence = 100;
  workflow.client = {
    name: DEMO_LEAD.creditor,
    document: "DEMO-SEM-CPF",
    phone: "(00) 00000-0000",
    email: "demo@exemplo.invalid",
  };
  workflow.credit = {
    ...workflow.credit,
    precatoryNumber: DEMO_LEAD.precatoryNumber,
    numeroProcessoDEPRE: DEMO_DEPRE_NUMBER,
    numeroProcessoDEPRENormalizado: "DEMODEPRE0001",
    originProcessNumber: DEMO_LEAD.originProcess,
    epesNumber: DEMO_LEAD.epes,
    epesYear: "",
    nature: DEMO_LEAD.nature,
    grossAmount: DEMO_LEAD.amount,
    availableEstimate: DEMO_LEAD.amount,
    municipality: "Município Demonstrativo",
    issuingCourt: "Tribunal simulado CP",
    debtorState: "SP",
    sourceUrl: "",
    sourceName: DEMO_EVIDENCE_SOURCE,
    checkedAt: now,
    valueDate: now.slice(0, 10),
  };
  workflow.creditorResolution = {
    state: "CREDOR_IDENTIFICADO",
    confidence: "ALTA",
    currentHolderStatus: "CURRENT_HOLDER_CONFIRMED",
    identifiedName: DEMO_LEAD.creditor,
    explanation: "Identidade confirmada somente na base sintética de demonstração; nenhuma fonte externa foi consultada.",
    nextAction: "Validar identidade em fonte autorizada antes de qualquer operação real.",
    updatedAt: now,
  };
  workflow.queryStatus = "MANUAL_REQUIRED";
  workflow.evidence = [
    ...workflow.evidence.filter((item) => item.reference !== DEMO_EVIDENCE_REFERENCE),
    demoEvidence(now),
  ];
  workflow.nextAction = {
    title: "Revisar lead demonstrativo e confirmar a fonte",
    dueAt: "",
    status: "PENDING",
    owner: "Analista de demonstração",
    reason: "Dados sintéticos para demonstrar a jornada do CP; não usar em operação real.",
  };
  ensureDemoWorkflowExamples(workflow, now);
}

function ensureDemoWorkflowExamples(workflow: OperationalWorkflow, now: string) {
  if (!workflow.legalReviews.some((review) => review.observations.includes(DEMO_REVIEW_MARKER))) {
    workflow.legalReviews.push({
      id: crypto.randomUUID(),
      status: "APPROVED_WITH_REMARKS",
      reviewer: "Revisão demonstrativa",
      requestedAt: now,
      reviewedAt: now,
      observations: `${DEMO_REVIEW_MARKER}. Documento demonstrativo sujeito à conferência humana. Não representa parecer nem aprovação jurídica real.`,
      dossierVersion: 1,
    });
    workflow.legalStatus = "REMARKS";
  }
  if (!workflow.pricingScenarios.some((scenario) => scenario.assumptions.includes(DEMO_PRICING_MARKER))) {
    const base = {
      grossAmount: DEMO_LEAD.amount,
      deductions: 5000,
      encumbrances: 2500,
      transactionCosts: 1500,
      targetMarginPercent: 20,
    };
    workflow.pricingScenarios.push({
      id: crypto.randomUUID(),
      name: "BASE",
      ...base,
      ...calculatePricing(base),
      createdAt: now,
      assumptions: `${DEMO_PRICING_MARKER}. Premissas fictícias para demonstrar o cálculo determinístico; não é oferta vinculante.`,
    });
    if (workflow.commercialStatus === "NOT_STARTED") workflow.commercialStatus = "PRICING";
  }
}

function syntheticDemoPdfBytes() {
  const lines = [
    "DOCUMENTO DE DEMONSTRACAO - SEM VALIDADE REAL",
    `Credor: ${DEMO_LEAD.creditor.replace(" — ", " - ")}`,
    `DEPRE ${DEMO_LEAD.depreNumber}`,
    `Processo originario: ${DEMO_LEAD.originProcess}`,
    `EP/ES: ${DEMO_LEAD.epes}`,
    `PRC ${DEMO_LEAD.precatoryNumber}`,
    "Valor atualizado: R$ 187.450,32",
    `Natureza: ${DEMO_LEAD.nature}`,
    `Devedora: ${DEMO_LEAD.debtor.replace("São", "Sao")}`,
  ];
  const commands = lines.map((line, index) => {
    const escaped = line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
    return `BT /F1 ${index === 0 ? 13 : 10} Tf 50 ${760 - index * 22} Td (${escaped}) Tj ET`;
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function ensureDemoDocument(operation: Operation, db: Client, organizationId: string, actor: string) {
  const [{ DatabaseStorageAdapter }, { analyzePdf }] = await Promise.all([
    import("./document-storage"),
    import("./pdf-analysis"),
  ]);
  const storage = new DatabaseStorageAdapter(db);
  const documents = await storage.list(operation.id, organizationId);
  let document = documents.find((item) => item.name === DEMO_DOCUMENT_NAME);
  if (!document) {
    document = await storage.upload({
      operationId: operation.id,
      organizationId,
      name: DEMO_DOCUMENT_NAME,
      bytes: syntheticDemoPdfBytes(),
      createdBy: actor,
    });
    document = (await storage.updateReview(document.id, organizationId, {
      status: "QUARANTINED",
      category: "PRECATORIO",
      reviewerNotes: `${DEMO_DOCUMENT_DISCLAIMER}. Arquivo inteiramente sintético, vinculado apenas à operação demonstrativa.`,
      retentionUntil: "",
    })) || document;
  }
  await analyzePdf(document.id, organizationId, db, storage);
}

export async function loadDemoOperation(db:Client=client,organizationId="legacy-internal",actor="demo") {
  await initializeOperations(db);
  const existing = await db.execute({
    sql: "SELECT * FROM operations WHERE organization_id=? AND is_demo=1 ORDER BY created_at DESC LIMIT 1",
    args: [organizationId],
  });
  const now = new Date().toISOString();
  if (existing.rows[0]) {
    const operation = fromRow(existing.rows[0]);
    const workflow = structuredClone(operation.workflow);
    const beforeWorkflow = JSON.stringify(workflow);
    const missingLeadData = workflow.credit.numeroProcessoDEPRE !== DEMO_DEPRE_NUMBER || !workflow.evidence.some((item) => item.reference === DEMO_EVIDENCE_REFERENCE);
    if (missingLeadData) populateDemoWorkflow(workflow, now);
    ensureDemoWorkflowExamples(workflow, now);
    let current = operation;
    if (JSON.stringify(workflow) !== beforeWorkflow || operation.nominal !== DEMO_LEAD.amount) {
      const result = await updateOperation({
        ...operation,
        ...(missingLeadData ? {
          title: "DEMONSTRAÇÃO — João da Silva",
          debtor: DEMO_LEAD.debtor,
          tribunal: "TJSP — perfil simulado, fonte sintética",
          process: DEMO_LEAD.originProcess,
          source: DEMO_EVIDENCE_SOURCE,
          nominal: DEMO_LEAD.amount,
          notes: `${DEMO_LEAD.disclaimer}. Nenhuma informação veio de credor ou fonte oficial.`,
        } : {}),
        workflow,
        isDemo: true,
      }, db, organizationId, actor);
      if (result.status === "not_found") throw new Error("DEMO_OPERATION_NOT_FOUND");
      current = result.operation;
    }
    await ensureDemoDocument(current, db, organizationId, actor);
    return current;
  }
  const workflow = createDefaultWorkflow(DEMO_LEAD.amount);
  populateDemoWorkflow(workflow, now);
  const operation = await createOperation({
    title: "DEMONSTRAÇÃO — João da Silva",
    debtor: DEMO_LEAD.debtor,
    tribunal: "TJSP — perfil simulado, fonte sintética",
    process: DEMO_LEAD.originProcess,
    owner: "Equipe de demonstração",
    source: DEMO_EVIDENCE_SOURCE,
    stage: "Entrada",
    nominal: DEMO_LEAD.amount,
    notes: `${DEMO_LEAD.disclaimer}. Nenhuma informação veio de credor ou fonte oficial.`,
    tasks: [{ id: crypto.randomUUID(), title: "Revisar lead demonstrativo e confirmar a fonte", due: "", done: false }],
    checks: [],
    proposals: [],
    workflow,
    isDemo: true,
  }, db, organizationId, actor);
  await ensureDemoDocument(operation, db, organizationId, actor);
  return operation;
}

export async function resetDemoOperations(db:Client=client,organizationId="legacy-internal"){await initializeOperations(db);const rows=await db.execute({sql:"SELECT id FROM operations WHERE organization_id=? AND is_demo=1",args:[organizationId]});const ids=rows.rows.map(r=>String(r.id));if(ids.length){for(const id of ids){await db.execute({sql:"DELETE FROM document_analyses WHERE organization_id=? AND operation_id=?",args:[organizationId,id]}).catch(()=>{});await db.execute({sql:"DELETE FROM operation_documents WHERE organization_id=? AND operation_id=?",args:[organizationId,id]}).catch(()=>{})}await db.execute({sql:"DELETE FROM operations WHERE organization_id=? AND is_demo=1",args:[organizationId]})}return{removed:ids.length,ids}}

const labels: Record<Exclude<keyof Operation, "id" | "version" | "history">, string> = {
  title: "título",
  debtor: "devedor",
  tribunal: "tribunal",
  process: "processo",
  owner: "responsável",
  source: "origem",
  stage: "etapa",
  nominal: "valor nominal",
  notes: "observações",
  tasks: "tarefas",
  checks: "diligência",
  proposals: "propostas",
  workflow: "fluxo operacional",
  isDemo: "marcador de demonstração",
};

function historySummary(previous: Operation, next: Operation) {
  const changed = (Object.keys(labels) as Array<keyof typeof labels>).filter(
    (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
  );
  return changed.length
    ? `Atualização: ${changed.map((key) => labels[key]).join(", ")}.`
    : "Operação salva sem alterações de conteúdo.";
}

export type UpdateOperationResult =
  | { status: "updated"; operation: Operation }
  | { status: "conflict"; operation: Operation }
  | { status: "not_found" };

export async function updateOperation(
  input: Operation,
  db: Client = client,
  organizationId = "legacy-internal",
  actor = "internal",
): Promise<UpdateOperationResult> {
  const parsed = updateOperationSchema.parse(input);
  await initializeOperations(db);
  const tx = await db.transaction("write");
  try {
    const selected = await tx.execute({
      sql: "SELECT * FROM operations WHERE id = ? AND organization_id = ?",
      args: [parsed.id, organizationId],
    });
    if (!selected.rows[0]) {
      await tx.rollback();
      return { status: "not_found" };
    }
    const current = fromRow(selected.rows[0]);
    if (current.version !== parsed.version) {
      await tx.rollback();
      return { status: "conflict", operation: current };
    }
    const transitionError=current.workflow.stage !== parsed.workflow.stage?transitionBlockReason({...parsed.workflow,stage:current.workflow.stage},parsed.workflow.stage):null;
    if (transitionError) {
      await tx.rollback();
      throw new Error(`INVALID_WORKFLOW_TRANSITION:${transitionError}`);
    }
    const now = new Date().toISOString();
    const operation: Operation = {
      ...parsed,
      version: current.version + 1,
      history: [
        ...current.history.slice(-999),
        { at: now, text: `${historySummary(current, parsed)} Usuário: ${actor}.` },
      ],
    };
    const result = await tx.execute({
      sql: `UPDATE operations SET version=?,title=?,debtor=?,tribunal=?,process=?,owner=?,source=?,stage=?,nominal=?,notes=?,tasks=?,checks=?,proposals=?,history=?,workflow=?,is_demo=?,updated_at=? WHERE id=? AND version=? AND organization_id=?`,
      args: [
        operation.version,
        operation.title,
        operation.debtor,
        operation.tribunal,
        operation.process,
        operation.owner,
        operation.source,
        operation.stage,
        operation.nominal,
        operation.notes,
        JSON.stringify(operation.tasks),
        JSON.stringify(operation.checks),
        JSON.stringify(operation.proposals),
        JSON.stringify(operation.history),
        JSON.stringify(operation.workflow),
        operation.isDemo ? 1 : 0,
        now,
        operation.id,
        current.version,
        organizationId,
      ],
    });
    if (result.rowsAffected !== 1) {
      await tx.rollback();
      const latest = await db.execute({
        sql: "SELECT * FROM operations WHERE id = ? AND organization_id = ?",
        args: [parsed.id, organizationId],
      });
      return latest.rows[0]
        ? { status: "conflict", operation: fromRow(latest.rows[0]) }
        : { status: "not_found" };
    }
    await tx.commit();
    return { status: "updated", operation };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {}
    throw error;
  }
}
