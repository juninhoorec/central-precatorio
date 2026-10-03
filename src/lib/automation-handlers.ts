import { buildEvidenceCandidates, resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult, type ResolvedEvidence } from "./research-pipeline";
import { persistResolvedOfficialEvidence, type PersistenceContext } from "./evidence-persistence";
import { createCrmTask } from "./crm-service";
import type { AutomationJob } from "./automation";
import type { OfficialEvidenceDocument } from "./autonomous-acquisition";

export type AutomationHandlerContext = {
  acquire?: (job: AutomationJob) => Promise<SourceAcquisitionResult>;
  existingEvidence?: OfficialEvidenceDocument[];
  persistence?: PersistenceContext;
  ai?: (job: AutomationJob) => Promise<{ status: "SUCCEEDED" | "FAILED" | "MANUAL_REQUIRED"; error?: string }>;
  crmTask?: Parameters<typeof createCrmTask>[0];
  alert?: (job: AutomationJob, key: string) => Promise<void>;
};

export type AutomationHandlerResult = { status: "SUCCEEDED" | "FAILED" | "MANUAL_REQUIRED"; sourceResult?: SourceAcquisitionResult; candidates?: number; resolved?: ResolvedEvidence[]; error?: string };

export async function executeAutomationHandler(job: AutomationJob, context: AutomationHandlerContext): Promise<AutomationHandlerResult> {
  if (!job.organizationId || !job.targetId) return { status: "FAILED", error: "TENANT_OR_TARGET_REQUIRED" };
  if (job.type === "SOURCE_ACQUISITION") {
    if (!context.acquire) return { status: "FAILED", error: "SOURCE_HANDLER_MISSING" };
    const sourceResult = await context.acquire(job);
    const candidates = buildEvidenceCandidates(sourceResult);
    const resolved = resolveEvidenceCandidatesForAcquisition(sourceResult, context.existingEvidence ?? []);
    if (context.persistence) for (const item of resolved) await persistResolvedOfficialEvidence(item, context.persistence, context.existingEvidence);
    const manual = ["MANUAL_REQUIRED", "CAPTCHA_REQUIRED", "AUTH_REQUIRED", "RESEARCH_AUTHORIZATION_REQUIRED"].includes(sourceResult.status);
    return { status: sourceResult.status === "SUCCESS" ? "SUCCEEDED" : manual ? "MANUAL_REQUIRED" : "FAILED", sourceResult, candidates: candidates.length, resolved };
  }
  if (job.type === "AI_RECONFIRMATION") { if (!context.ai) return { status: "FAILED", error: "AI_HANDLER_MISSING" }; return context.ai(job); }
  if (job.type === "CRM_FOLLOW_UP") { if (!context.crmTask) return { status: "FAILED", error: "CRM_TASK_INPUT_MISSING" }; await createCrmTask(context.crmTask); return { status: "SUCCEEDED" }; }
  if (job.type === "ALERT") { if (!context.alert) return { status: "FAILED", error: "ALERT_HANDLER_MISSING" }; await context.alert(job, `${job.organizationId}:${job.targetId}:${job.type}`); return { status: "SUCCEEDED" }; }
  return { status: "SUCCEEDED" };
}
