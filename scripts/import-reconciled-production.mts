import fs from "node:fs";
import { createClient } from "@libsql/client";
import { createDefaultWorkflow } from "../src/lib/operational-workflow.ts";

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("file:")) throw new Error("PRODUCTION_DATABASE_URL_REQUIRED");
const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID;
if (!organizationId) throw new Error("CP_IMPORT_ORGANIZATION_ID_REQUIRED");
const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const normalize = (value: string) => value.replace(/\D/g, "");
const conflicts = new Set<string>();
const conflictPath = "data/reconciliation-staging/candidates-conflict-review.jsonl";
if (fs.existsSync(conflictPath)) for (const line of fs.readFileSync(conflictPath, "utf8").split(/\r?\n/)) if (line.trim()) conflicts.add(String(JSON.parse(line).depreKey));
const rows = JSON.parse(fs.readFileSync("data/queue-100k-document-priority.json", "utf8")) as Array<Record<string, unknown>>;
const existingRows = await db.execute({ sql: "select json_extract(workflow,'$.credit.numeroProcessoDEPRENormalizado') k from operations where organization_id=?", args: [organizationId] });
const existing = new Set(existingRows.rows.map((row) => String((row as Record<string, unknown>).k ?? "")).filter(Boolean));
let batch: { sql: string; args: any[] }[] = [], created = 0, skipped = 0, rejected = 0;
async function flush() { if (!batch.length) return; await db.batch(batch, "write"); created += batch.length; batch = []; }
for (const row of rows) {
  const depre = String(row.depre ?? "").trim();
  const key = normalize(depre);
  const amount = Number(row.valor_max ?? 0);
  if (!depre || existing.has(key) || conflicts.has(key)) { skipped++; continue; }
  if (!amount || amount < 100000) { rejected++; continue; }
  const now = new Date().toISOString();
  const workflow = createDefaultWorkflow(amount);
  workflow.credit.numeroProcessoDEPRE = depre;
  workflow.credit.numeroProcessoDEPRENormalizado = key;
  workflow.credit.originProcessNumber = String(row.processo_origem ?? "");
  workflow.credit.grossAmount = amount;
  workflow.credit.municipality = String(row.devedora ?? "");
  workflow.credit.debtorState = "SP";
  workflow.credit.issuingCourt = "TJSP";
  workflow.credit.sourceName = "CP · fila geral reconciliada · lote sem conflito";
  workflow.credit.sourceUrl = "fila_pesquisa.csv";
  workflow.queryStatus = "PARTIAL";
  workflow.documentStatus = "MISSING";
  workflow.creditorResolution = { state: "PENDENTE", confidence: "BAIXA", currentHolderStatus: "CURRENT_HOLDER_NOT_CONFIRMED", identifiedName: "", explanation: "Fila geral; titularidade e documento aguardam pesquisa manual.", nextAction: "Pesquisar titular, CPF/CNPJ e documentos oficiais.", updatedAt: now };
  const id = crypto.randomUUID();
  batch.push({ sql: "insert into operations (id,version,title,debtor,tribunal,process,owner,source,stage,nominal,notes,tasks,checks,proposals,history,workflow,is_demo,created_at,updated_at,organization_id) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", args: [id, 1, `Candidato DEPRE ${depre}`, String(row.devedora ?? "TJSP"), "TJSP", String(row.processo_origem ?? ""), "", "CP · fila geral reconciliada · lote sem conflito", "Entrada", amount, "Fila geral reconciliada; aguardando pesquisa manual.", "[]", "[]", "[]", JSON.stringify([{ at: now, text: "Operação criada por importação reconciliada em produção." }]), JSON.stringify(workflow), 0, now, now, organizationId] });
  existing.add(key);
  if (batch.length >= 250) await flush();
}
await flush();
console.log(JSON.stringify({ status: "IMPORTED_TO_PRODUCTION", organizationId, sourceRows: rows.length, created, skipped, rejected }, null, 2));
await db.close();
