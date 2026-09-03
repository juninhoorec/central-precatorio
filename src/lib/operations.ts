import { createClient, type Client } from "@libsql/client";
import { z } from "zod";
import { createDefaultWorkflow, operationalWorkflowSchema, transitionBlockReason } from "./operational-workflow";

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

export async function initializeOperations(db: Client = client) {
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
}

function workflowFromRow(row: Record<string, unknown>) {
  try { return operationalWorkflowSchema.parse(JSON.parse(String(row.workflow || "{}"))); }
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

export async function loadDemoOperation(db:Client=client,organizationId="legacy-internal",actor="demo"){await initializeOperations(db);const existing=await db.execute({sql:"SELECT * FROM operations WHERE organization_id=? AND is_demo=1 ORDER BY created_at DESC LIMIT 1",args:[organizationId]});if(existing.rows[0])return fromRow(existing.rows[0]);const workflow=createDefaultWorkflow(480000);workflow.priority="HIGH";workflow.confidence=35;workflow.client={name:"Pessoa Credora Demonstrativa",document:"***.***.***-**",phone:"(00) 00000-0000",email:"demo@exemplo.invalid"};workflow.credit={precatoryNumber:"DEMO-CP-0001",nature:"Alimentar — dado sintético",grossAmount:480000,availableEstimate:0};workflow.nextAction={title:"Revisar dados sintéticos da triagem",dueAt:"",status:"PENDING",owner:"Analista de demonstração",reason:"Iniciar a jornada guiada do caso demonstrativo."};return createOperation({title:"DEMONSTRAÇÃO — Operação sintética",debtor:"Ente devedor fictício",tribunal:"TRIBUNAL DEMO",process:"PROCESSO-DEMO-SEM-VALIDADE",owner:"Equipe de demonstração",source:"DADOS SINTÉTICOS CP",stage:"Entrada",nominal:480000,notes:"DADOS DE DEMONSTRAÇÃO — SEM VALIDADE REAL. Não consultar como processo real.",tasks:[{id:crypto.randomUUID(),title:"Revisar dados sintéticos da triagem",due:"",done:false}],checks:[],proposals:[],workflow,isDemo:true},db,organizationId,actor)}

export async function resetDemoOperations(db:Client=client,organizationId="legacy-internal"){await initializeOperations(db);const rows=await db.execute({sql:"SELECT id FROM operations WHERE organization_id=? AND is_demo=1",args:[organizationId]});const ids=rows.rows.map(r=>String(r.id));if(ids.length){try{for(const id of ids)await db.execute({sql:"DELETE FROM operation_documents WHERE organization_id=? AND operation_id=?",args:[organizationId,id]})}catch{/* tabela documental pode ainda não existir */}await db.execute({sql:"DELETE FROM operations WHERE organization_id=? AND is_demo=1",args:[organizationId]})}return{removed:ids.length,ids}}

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
