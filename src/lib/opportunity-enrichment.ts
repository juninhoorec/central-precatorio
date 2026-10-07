import { createClient, type Client } from "@libsql/client";
import { getOperation, updateOperation, type Operation } from "./operations";
import { listOfficialEvidence, countVerifiedOfficialEvidence } from "./autonomous-acquisition";
import { scoreOpportunity, deriveTitularStatusFromBeneficiaries, type OpportunityBlockerCode } from "./opportunity-engine";
import { persistOpportunityEvaluation } from "./opportunity-evaluations";
import { appendAudit, hasAuditRequest } from "./audit";
import { createHash } from "node:crypto";
import { isOfficialSourceUrl } from "./acquisition-sources";

const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

export type EnrichmentResult = {
  operationId: string;
  depre: string;
  titularStatus: string;
  beneficiaryCount: number;
  processStatus: string;
  valueStatus: string;
  dateBaseStatus: string;
  lawyerStatus: string;
  contactStatus: string;
  qualifyingEvidenceCount: number;
  blockers: OpportunityBlockerCode[];
  readyForAnalyst: boolean;
  opportunityStatus: string;
};

export async function enrichOpportunityFromEvidence(
  operationId: string,
  organizationId: string,
  actorUserId: string,
  client: Client = db
): Promise<EnrichmentResult> {
  const operation = await getOperation(operationId, client, organizationId);
  if (!operation) throw new Error("ENRICHMENT_OPERATION_NOT_FOUND");
  if (operation.isDemo) throw new Error("ENRICHMENT_DEMO_OPERATION_FORBIDDEN");

  const wf = operation.workflow;
  const depre = wf.credit.numeroProcessoDEPRE;
  if (!depre) throw new Error("ENRICHMENT_DEPRE_REQUIRED");

  const existingEvidence = await listOfficialEvidence(operationId, organizationId, client);
  const verifiedCount = countVerifiedOfficialEvidence(existingEvidence);
  const verifiedEvidence = existingEvidence.filter(e => e.status === "VERIFIED" && e.evidenceStrength === "STRONG");

  // In a real scenario, we'd parse facts from verifiedEvidence. 
  // For now, we respect the strict rules: do not infer, do not default.
  // We will preserve what is currently on the workflow unless we have explicit evidence to update it.

  // Extract fields
  const value = Number(wf.credit.grossAmount ?? wf.credit.availableEstimate ?? 0);
  const valueStatus = value > 0 ? "CONFIRMED" : "MISSING";
  const dateBase = wf.credit.valueDate || null;
  const lawyer = wf.credit.legalRepName || null;
  const oab = wf.credit.legalRepOab || null;
  
  const beneficiaries = Array.isArray(wf.client.beneficiaries) ? wf.client.beneficiaries : [];
  const titularStatus = deriveTitularStatusFromBeneficiaries(beneficiaries.map((b: any) => ({ role: b.role, status: b.status })));
  
  const contactAvailable = Boolean(wf.client.phone || wf.client.email);
  const contactStatus = wf.credit.contactSource ? "PROFESSIONAL_ROUTE" : contactAvailable ? "CONFIRMED" : "NO_CONFIRMED_CONTACT";

  const processNumber = wf.credit.originProcessNumber || wf.credit.requisitionProcessNumber || operation.process;
  const processStatus = processNumber ? "CONFIRMED" : "MISSING";

  // Check coverage state — use actual workflow schema enum values
  const isCoverageSufficient = wf.queryStatus === "CONFIRMED" || wf.documentStatus === "READY" ? "SUFFICIENT_COVERAGE" : "INSUFFICIENT_COVERAGE";

  // Score opportunity
  const scoreResult = scoreOpportunity({
    opportunityId: `enrich-${operationId}`,
    operationId,
    organizationId,
    depre,
    debtor: wf.credit.debtorState || operation.debtor || null,
    originalValue: value > 0 ? value : null,
    currentValue: null,
    dataBase: dateBase,
    lawyer,
    oab,
    contactAvailable,
    contactStatus,
    coverageState: isCoverageSufficient,
    qualifyingEvidenceCount: verifiedCount,
    aiValidation: "PENDING", // AI is optional, do not bypass
    divergence: false,
    availability: "AVAILABLE",
    titularStatus,
    valueStatus,
    lawyerStatus: lawyer && oab ? "CONFIRMED" : lawyer ? "UNCONFIRMED" : "MISSING",
    processStatus,
    researchStatus: wf.queryStatus || "MANUAL_REQUIRED",
    blockerCodes: beneficiaries.length > 1 ? ["MULTIPLE_BENEFICIARIES_UNRESOLVED"] : [],
    ruleVersion: "opportunity-rules-v3",
  });

  // Evaluate idempotency for the audit
  const idempotencyKey = `enrich-${hash(`${organizationId}|${operationId}|${scoreResult.evaluationVersion}|${verifiedCount}`)}`;
  const auditRequestId = `audit-${idempotencyKey}`;
  
  if (!(await hasAuditRequest(auditRequestId, client))) {
    // Only update DB if there's a meaningful change we detected, but we always persist evaluation
    await appendAudit({
      organizationId,
      actorUserId,
      action: "OPPORTUNITY_UPDATED",
      entityType: "operation",
      entityId: operationId,
      previousStateSummary: { 
        titularStatus: "UNKNOWN", // stub
        readyForAnalyst: false
      },
      nextStateSummary: { 
        titularStatus,
        verifiedCount,
        readyForAnalyst: scoreResult.readyForAnalyst
      },
      metadata: { phase: "PHASE_8", depre, idempotencyKey },
      requestId: auditRequestId,
      source: "PHASE_8_ENRICHMENT",
    }, client);
    
    // We update the workflow with new states if applicable (currently mostly keeping existing unless evidence parsed)
    // Since we don't have new parsing yet, we just update evaluation.
  }

  await persistOpportunityEvaluation(scoreResult, client);

  return {
    operationId,
    depre,
    titularStatus,
    beneficiaryCount: beneficiaries.length,
    processStatus,
    valueStatus,
    dateBaseStatus: dateBase ? "LOCALIZADO" : "NÃO_LOCALIZADO",
    lawyerStatus: lawyer && oab ? "CONFIRMED" : lawyer ? "UNCONFIRMED" : "MISSING",
    contactStatus,
    qualifyingEvidenceCount: verifiedCount,
    blockers: scoreResult.blockerCodes,
    readyForAnalyst: scoreResult.readyForAnalyst,
    opportunityStatus: scoreResult.status
  };
}
