import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { appendAudit } from "../src/lib/audit";
const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const jobId = "e3ecd21a-a2bf-4b92-8d8b-ec2bb9a1c017";
await client.execute({ sql: "UPDATE automation_jobs SET status='FAILED',completed_at=?,error_code='RESEARCH_AUTHORIZATION_REQUIRED',error_message='Fonte não autorizada para pesquisa neste ambiente.' WHERE id=? AND organization_id=?", args: [new Date().toISOString(), jobId, organizationId] });
await appendAudit({ organizationId, actorUserId: "system:automation", action: "ACQUISITION_JOB_PROCESSED", entityType: "automation_job", entityId: jobId, previousStateSummary: { status: "SUCCEEDED" }, nextStateSummary: { status: "FAILED", sourceStatus: "RESEARCH_AUTHORIZATION_REQUIRED" }, metadata: { reconciled: true, candidates: 0, resolved: 0 }, requestId: `${jobId}:reconcile`, source: "AUTOMATION_WORKER" });
console.log("RECONCILED", jobId);
