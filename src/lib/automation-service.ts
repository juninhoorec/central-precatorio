import { createClient, type Client } from "@libsql/client";
import { claimJob, deterministicJobKey, type AutomationJob, type AutomationJobStatus, type AutomationJobType } from "./automation";
import { executeAutomationHandler } from "./automation-handlers";
import { DataJudTJSPAdapter } from "./datajud-tjsp-experimental";
import { createResearchOfficialProcessRoutes } from "./official-process-source-collector";
import { normalizeCnjProcessNumber } from "./acquisition-sources";
import { appendAudit } from "./audit";
import { assertSchemaMigrations } from "./schema-migrations";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
/** Runtime guard only; schema changes are applied by the explicit migration command. */
export async function initializeAutomation(client: Client = db) { await assertSchemaMigrations(client); }
function row(v: Record<string, unknown>): AutomationJob { return { id: String(v.id), organizationId: String(v.organization_id), type: String(v.job_type) as AutomationJobType, targetType: String(v.target_type), targetId: String(v.target_id), scheduledAt: String(v.scheduled_at), status: String(v.status) as AutomationJobStatus, attempts: Number(v.attempts), maxAttempts: Number(v.max_attempts), idempotencyKey: String(v.idempotency_key), leaseUntil: v.lease_until ? String(v.lease_until) : null, startedAt: v.started_at ? String(v.started_at) : null, completedAt: v.completed_at ? String(v.completed_at) : null, nextAttemptAt: v.next_attempt_at ? String(v.next_attempt_at) : null, errorCode: v.error_code ? String(v.error_code) : null, errorMessage: v.error_message ? String(v.error_message) : null, createdBy: String(v.created_by) }; }
export async function enqueueJob(input: { organizationId: string; type: AutomationJobType; targetType: string; targetId: string; scheduledAt?: string; maxAttempts?: number; idempotencyKey?: string; createdBy?: string }, client: Client = db): Promise<AutomationJob> { await initializeAutomation(client); const now = new Date().toISOString(); const key = input.idempotencyKey ?? deterministicJobKey(input.organizationId, input.type, input.targetId, input.scheduledAt?.slice(0, 10) ?? now.slice(0, 10)); await client.execute({ sql: "INSERT OR IGNORE INTO automation_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", args: [crypto.randomUUID(), input.organizationId, input.type, input.targetType, input.targetId, input.scheduledAt ?? now, "PENDING", 0, input.maxAttempts ?? 3, key, null, null, null, null, null, null, input.createdBy ?? "system", now] }); const result = await client.execute({ sql: "SELECT * FROM automation_jobs WHERE organization_id=? AND idempotency_key=?", args: [input.organizationId, key] }); return row(result.rows[0] as Record<string, unknown>); }
export async function claimNextJob(organizationId: string, now = new Date(), client: Client = db): Promise<AutomationJob | null> { await initializeAutomation(client); const result = await client.execute({ sql: "SELECT * FROM automation_jobs WHERE organization_id=? AND ((status IN ('PENDING','RETRY_SCHEDULED') AND scheduled_at<=?) OR (status='RUNNING' AND lease_until<=?)) ORDER BY scheduled_at ASC LIMIT 1", args: [organizationId, now.toISOString(), now.toISOString()] }); if (!result.rows[0]) return null; const current = row(result.rows[0] as Record<string, unknown>); const claimed = claimJob(current, "worker", now); await client.execute({ sql: "UPDATE automation_jobs SET status=?,lease_until=?,started_at=?,attempts=attempts+1 WHERE id=? AND organization_id=?", args: [claimed.status, claimed.leaseUntil, claimed.startedAt, current.id, organizationId] }); return { ...claimed, attempts: claimed.attempts + 1 }; }
export async function listAutomationJobs(organizationId: string, client: Client = db): Promise<AutomationJob[]> { await initializeAutomation(client); const result = await client.execute({ sql: "SELECT * FROM automation_jobs WHERE organization_id=? ORDER BY scheduled_at DESC", args: [organizationId] }); return result.rows.map((value) => row(value as Record<string, unknown>)); }

export async function runSourceAcquisitionJobOnce(organizationId: string, operationId: string, client: Client = db, sourceRoute: "datajud" | "esaj" | "djen" | "cac" = "datajud"): Promise<{ job: AutomationJob; result: Awaited<ReturnType<typeof executeAutomationHandler>> }> {
  const operation = await client.execute({ sql: "SELECT workflow FROM operations WHERE id=? AND organization_id=?", args: [operationId, organizationId] });
  if (!operation.rows[0]) throw new Error("TARGET_NOT_FOUND");
  const workflow = JSON.parse(String((operation.rows[0] as Record<string, unknown>).workflow)) as { credit?: { numeroProcessoDEPRE?: string } };
  const depre = workflow.credit?.numeroProcessoDEPRE?.trim();
  if (!depre) throw new Error("DEPRE_REQUIRED");
  const job = await enqueueJob({ organizationId, type: "SOURCE_ACQUISITION", targetType: "operation", targetId: operationId, idempotencyKey: deterministicJobKey(organizationId, "SOURCE_ACQUISITION", operationId, new Date().toISOString().slice(0, 10)) }, client);
  const claimed = await claimNextJob(organizationId, new Date(), client);
  if (!claimed || claimed.id !== job.id) throw new Error("JOB_CLAIM_FAILED");
  const result = await executeAutomationHandler(claimed, { acquire: async () => {
    const routes = createResearchOfficialProcessRoutes(new DataJudTJSPAdapter({ baseUrl: process.env.CP_DATAJUD_BASE_URL || "https://api-publica.datajud.cnj.jus.br", apiKey: process.env.CP_DATAJUD_API_KEY, researchAuthorized: process.env.CP_DATAJUD_RESEARCH_AUTHORIZED === "true" }));
    const sourceName = sourceRoute === "datajud" ? "DATAJUD_TJSP" : sourceRoute === "esaj" ? "TJSP_ESAJ" : sourceRoute === "djen" ? "DJEN" : "TJSP_DEPRE_CAC";
    const route = routes.find((candidate) => candidate.source === sourceName);
    if (!route) throw new Error("SOURCE_ROUTE_NOT_FOUND");
    const source = await route.search({ processNumber: depre });
    const sourceId = source.source === "DJEN" ? "djen" : source.source === "TJSP_ESAJ" ? "tjsp-esaj" : source.source === "TJSP_DEPRE_CAC" ? "tjsp-depre-cac" : "cnj-datajud";
    return { provider: source.source === "DJEN" ? "DJEN" : "TJSP", source: source.source, sourceId, route: sourceRoute, requestedIdentifier: depre, normalizedIdentifier: normalizeCnjProcessNumber(depre), startedAt: null, completedAt: new Date().toISOString(), durationMs: source.durationMs, status: source.status, requestAttempted: source.requestAttempted, httpStatus: source.httpStatus, sourceUrl: source.endpoint ?? null, officialSourceUrl: source.endpoint ?? null, errorCode: source.error?.code ?? null, errorMessage: source.error?.message ?? null, rawPayload: source.rawPayload, metadata: { query: source.query }, documentaryCandidates: [] };
  } });
  const manual = result.status === "MANUAL_REQUIRED" || ["CAPTCHA_REQUIRED", "AUTH_REQUIRED", "MANUAL_REQUIRED"].includes(result.sourceResult?.status ?? "");
  const status = result.status === "SUCCEEDED" && result.sourceResult?.status === "SUCCESS" ? "SUCCEEDED" : "FAILED";
  const completedAt = new Date().toISOString();
  await client.execute({ sql: "UPDATE automation_jobs SET status=?,completed_at=?,error_code=?,error_message=? WHERE id=? AND organization_id=?", args: [status, completedAt, result.sourceResult?.errorCode ?? (manual ? "MANUAL_REQUIRED" : result.sourceResult?.status ?? result.error ?? null), result.error ?? result.sourceResult?.errorMessage ?? null, claimed.id, organizationId] });
  await appendAudit({ organizationId, actorUserId: "system:automation", action: "ACQUISITION_JOB_PROCESSED", entityType: "automation_job", entityId: claimed.id, previousStateSummary: { status: "RUNNING" }, nextStateSummary: { status, sourceStatus: result.sourceResult?.status ?? null }, metadata: { targetId: operationId, candidates: result.candidates ?? 0, resolved: result.resolved?.length ?? 0 }, requestId: claimed.id, source: "AUTOMATION_WORKER" });
  return { job: { ...claimed, status, completedAt }, result };
}
