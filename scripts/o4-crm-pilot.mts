import { createClient } from "@libsql/client";
import { createCrmRecord, createCrmTask } from "../src/lib/crm-service";
import { appendAudit } from "../src/lib/audit";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const ops = (await client.execute({ sql: "SELECT id, workflow FROM operations WHERE organization_id=? AND is_demo=0 ORDER BY id", args: [org] })).rows.map((raw) => { const r = raw as Record<string, unknown>; const w = JSON.parse(String(r.workflow)) as { credit?: { numeroProcessoDEPRE?: string; municipality?: string } }; return { id: String(r.id), depre: w.credit?.numeroProcessoDEPRE ?? "", municipality: w.credit?.municipality ?? "" }; });
const evidenceOperation = String(((await client.execute({ sql: "SELECT operation_id FROM official_evidence_documents WHERE organization_id=? ORDER BY operation_id LIMIT 1", args: [org] })).rows[0] as Record<string, unknown>)?.operation_id ?? "");
const selected = [...(evidenceOperation ? ops.filter((o) => o.id === evidenceOperation) : []), ...ops.filter((o) => o.id !== evidenceOperation)].slice(0, 15);
if (selected.length !== 15) throw new Error(`O4_REQUIRES_15_GOT_${selected.length}`);
const before = await client.execute("SELECT (SELECT COUNT(*) FROM crm_records) records, (SELECT COUNT(*) FROM crm_tasks) tasks, (SELECT COUNT(*) FROM crm_activities) activities, (SELECT COUNT(*) FROM audit_logs) audits");
const results: unknown[] = [];
for (const operation of selected) {
  const crmId = `o4-${operation.id}`;
  const crm = await createCrmRecord({ id: crmId, organizationId: org, operationId: operation.id, opportunityId: null, contactIds: [], stage: "NEW", nextActionAt: new Date(Date.now() + 7 * 86400000).toISOString() }, client);
  const task = await createCrmTask({ id: `o4-task-${operation.id}`, organizationId: org, crmId, title: "Executar pesquisa assistida e registrar pendências", description: "Revisar MANUAL_REQUIRED/documentação e registrar o próximo resultado; nenhuma comunicação externa automática.", dueAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: "OPEN", priority: "MEDIUM", assigneeId: null, completedAt: null, idempotencyKey: `o4-manual-review-${operation.id}` }, client);
  await appendAudit({ organizationId: org, actorUserId: "system:o4", action: "OPPORTUNITY_CREATED", entityType: "crm_record", entityId: crmId, previousStateSummary: {}, nextStateSummary: { stage: "NEW", operationId: operation.id }, metadata: { source: "O4_CONTROLLED_PILOT", depre: operation.depre }, requestId: crmId, source: "O4" }, client);
  results.push({ depre: operation.depre, municipality: operation.municipality, crmId, stage: crm.stage, taskId: task.id, taskStatus: task.status, overdue: false, activities: 0, readyForAnalyst: false, commercialReadiness: "RESEARCH_READY_ONLY" });
}
const after = await client.execute("SELECT (SELECT COUNT(*) FROM crm_records) records, (SELECT COUNT(*) FROM crm_tasks) tasks, (SELECT COUNT(*) FROM crm_activities) activities, (SELECT COUNT(*) FROM audit_logs) audits");
console.log(JSON.stringify({ phase: "O4", selected, before: before.rows[0], after: after.rows[0], results }, null, 2));
