import { createClient } from "@libsql/client";
import { scoreOpportunity, type Opportunity } from "../src/lib/opportunity-engine";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const operations = (await client.execute({ sql: "SELECT id, workflow, debtor, version FROM operations WHERE organization_id=? AND is_demo=0 ORDER BY id", args: [org] })).rows.map((raw) => {
  const row = raw as Record<string, unknown>;
  const workflow = JSON.parse(String(row.workflow)) as { credit?: Record<string, unknown> };
  return { id: String(row.id), workflow, debtor: String(row.debtor ?? ""), version: Number(row.version) };
});
const pilotIds = new Set((await client.execute({ sql: "SELECT target_id FROM automation_jobs WHERE organization_id=? AND job_type='SOURCE_ACQUISITION' ORDER BY created_at DESC LIMIT 25", args: [org] })).rows.map((r) => String((r as Record<string, unknown>).target_id)));
const selected = [...operations.filter((r) => pilotIds.has(r.id)), ...operations.filter((r) => !pilotIds.has(r.id))].slice(0, 35);
if (selected.length !== 35) throw new Error(`O3_REQUIRES_35_GOT_${selected.length}`);
const docs = await client.execute({ sql: "SELECT operation_id, COUNT(*) n FROM official_evidence_documents WHERE organization_id=? AND status='VERIFIED' AND evidence_strength='STRONG' GROUP BY operation_id", args: [org] });
const docCounts = new Map(docs.rows.map((r) => [String((r as Record<string, unknown>).operation_id), Number((r as Record<string, unknown>).n)]));
const evaluated: Opportunity[] = selected.map((operation, index) => {
  const credit = operation.workflow.credit ?? {};
  const evidence = docCounts.get(operation.id) ?? 0;
  const depre = typeof credit.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : null;
  const originalValue = typeof credit.valor === "number" ? credit.valor : null;
  return scoreOpportunity({ opportunityId: `derived-${operation.id}`, operationId: operation.id, organizationId: org, depre, debtor: operation.debtor, originalValue, currentValue: null, dataBase: typeof credit.dataBase === "string" ? credit.dataBase : null, lawyer: typeof credit.advogado === "string" ? credit.advogado : null, oab: typeof credit.oab === "string" ? credit.oab : null, contactAvailable: false, contactStatus: "NO_CONFIRMED_CONTACT", coverageState: "INSUFFICIENT_COVERAGE", qualifyingEvidenceCount: evidence, aiValidation: "PENDING", divergence: false, availability: "AVAILABLE", titularStatus: typeof credit.titular === "string" && credit.titular.trim() ? "UNRESOLVED" : "UNRESOLVED", valueStatus: originalValue === null ? "MISSING" : "HISTORICAL", lawyerStatus: typeof credit.advogado === "string" && credit.advogado ? "UNCONFIRMED" : "MISSING", researchStatus: "MANUAL_REQUIRED", ruleVersion: "opportunity-rules-v1" });
});
console.log(JSON.stringify({ phase: "O3", organizationId: org, count: evaluated.length, distribution: evaluated.reduce((a, item) => { a[item.priority] = (a[item.priority] ?? 0) + 1; return a; }, {} as Record<string, number>), lifecycle: evaluated.reduce((a, item) => { const key = item.lifecycle ?? "IN_REVIEW"; a[key] = (a[key] ?? 0) + 1; return a; }, {} as Record<string, number>), readyForAnalyst: evaluated.filter((item) => item.readyForAnalyst).length, matrix: evaluated.map((item) => ({ depre: item.depre, operationId: item.operationId, score: item.score, priority: item.priority, lifecycle: item.lifecycle, documentation: item.documentationStatus, evidenceCount: item.qualifyingEvidenceCount, positiveSignals: item.positiveSignals, blockingReasons: item.blockingReasons, readyForAnalyst: item.readyForAnalyst, alerts: item.alerts, ruleVersion: item.evaluationVersion })) }, null, 2));
