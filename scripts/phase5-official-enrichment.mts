import nextEnv from "@next/env";
import { createHash } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());

const { createClient } = await import("@libsql/client");
const { appendAudit, verifyAuditChain } = await import("../src/lib/audit.js");
const { listOfficialEvidence, countVerifiedOfficialEvidence } = await import("../src/lib/autonomous-acquisition.js");
const { djenAdapter, isValidCnjProcessNumber } = await import("../src/lib/acquisition-sources.js");
const { resolveAIProvider } = await import("../src/lib/ai/ai-provider.js");
const { listAiReconfirmationAttempts } = await import("../src/lib/ai-reconfirmation.js");
const { listOpportunityEvaluations } = await import("../src/lib/opportunity-evaluations.js");
const { executePhase5EnrichmentForCase } = await import("../src/lib/official-enrichment.js");

const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const actorUserId = "system:phase5-official-enrichment";
const execute = process.argv.includes("--execute");
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });

const selectedCases = [
  { operationId: "433c2565-d5d0-424a-b0e1-af7e1d3962b2", depre: "0038850-88.2017.8.26.0500" },
  { operationId: "120ca91d-ac87-47a9-83d6-765f56828680", depre: "0165056-11.2021.8.26.0500" },
  { operationId: "d9f156b3-a743-4591-b0cf-d9626f87086f", depre: "0196151-64.2018.8.26.0500" },
  { operationId: "1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd", depre: "7007091-55.2015.8.26.0500" },
  { operationId: "2da66ef7-5c56-43a1-8eb8-f24ce10d98cd", depre: "0002075-74.2017.8.26.0500" },
  { operationId: "33b49922-d550-4af5-ad9a-4f39b9fadf46", depre: "0513642-74.2019.8.26.0500" },
  { operationId: "2ade7ad1-a29d-4551-80ab-2ad59058136f", depre: "0061620-12.2016.8.26.0500" },
  { operationId: "32d9a352-c11d-4778-a82d-d6fc96fddd7f", depre: "02588958-52.2020.8.26.0500" },
  { operationId: "0e9d52b7-2eb3-4691-920e-2c46301ff317", depre: "0065683-46.2017.8.26.0500" },
  { operationId: "fef6cee2-053d-4fd3-8837-111c9bc59c4a", depre: "0005002-08.2020.8.26.0500" },
  { operationId: "ccba64aa-19c8-49a5-af10-0838f56736ec", depre: "0005094-49.2021.8.26.0500" },
  { operationId: "5cfb36a0-769b-400d-9147-0eab37fa99da", depre: "0020675-12.2018.8.26.0500" },
  { operationId: "2442a714-8aa7-41f0-b1f9-2690acc44fb6", depre: "0034190-80.2019.8.26.0500" },
  { operationId: "a6eed286-5ac2-478e-b126-aadcd06a1517", depre: "0037228-61.2023.8.26.0500" },
  { operationId: "aceba4c2-ab63-4e2d-82e1-b07c91ac16a5", depre: "0038851-73.2017.8.26.0500" },
  { operationId: "ad72aa6e-0e28-4e0f-ae3a-712bd724492f", depre: "0046135-30.2020.8.26.0500" },
  { operationId: "d12413c0-c613-44e8-bbd0-4f758cdd64f8", depre: "0051883-09.2021.8.26.0500" },
  { operationId: "8cb6a877-2112-4781-8cd9-0e7ce277698f", depre: "0054334-46.2017.8.26.0500" },
  { operationId: "ebd19f6d-a257-4ff2-9889-86257c8bb90a", depre: "0061616-72.2016.8.26.0500" },
  { operationId: "e16a1a9d-85b4-43b7-9c7c-307142257b5f", depre: "0061624-49.2016.8.26.0500" },
] as const;

const object = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

async function captureBaselineCounts() {
  const query = await client.execute({
    sql: `SELECT
      (SELECT COUNT(*) FROM operations) global_operations,
      (SELECT COUNT(*) FROM operations WHERE is_demo=0) global_non_demo,
      (SELECT COUNT(*) FROM operations WHERE is_demo=1) global_demo,
      (SELECT COUNT(*) FROM operations WHERE organization_id=?) tenant_operations,
      (SELECT COUNT(*) FROM operations WHERE organization_id=? AND is_demo=0) tenant_real,
      (SELECT COUNT(*) FROM operations WHERE organization_id=? AND is_demo=1) tenant_demo,
      (SELECT COUNT(DISTINCT NULLIF(json_extract(workflow,'$.credit.numeroProcessoDEPRE'),'')) FROM operations WHERE organization_id=? AND is_demo=0) tenant_unique_depre,
      (SELECT COUNT(*) FROM official_evidence_documents WHERE organization_id=?) evidence_total,
      (SELECT COUNT(*) FROM official_evidence_documents WHERE organization_id=? AND status='VERIFIED' AND evidence_strength='STRONG') evidence_verified_strong,
      (SELECT COUNT(*) FROM crm_records WHERE organization_id=?) crm_records,
      (SELECT COUNT(*) FROM crm_tasks WHERE organization_id=?) crm_tasks,
      (SELECT COUNT(*) FROM crm_activities WHERE organization_id=?) crm_activities,
      (SELECT COUNT(*) FROM automation_jobs WHERE organization_id=?) automation_jobs,
      (SELECT COUNT(*) FROM audit_logs WHERE organization_id=?) audit_events,
      (SELECT COUNT(*) FROM opportunity_evaluations WHERE organization_id=?) opportunity_evaluations,
      (SELECT COUNT(*) FROM opportunity_evaluations WHERE organization_id=? AND ready_for_analyst=1) ready_for_analyst,
      (SELECT COUNT(*) FROM ai_reconfirmation_runs WHERE organization_id=?) ai_attempts`,
    args: Array(14).fill(organizationId),
  });
  return object(query.rows[0]);
}

async function main() {
  const baseline = await captureBaselineCounts();
  if (
    Number(baseline.global_operations) !== 77 ||
    Number(baseline.global_non_demo) !== 76 ||
    Number(baseline.global_demo) !== 1 ||
    Number(baseline.tenant_operations) !== 74 ||
    Number(baseline.tenant_real) !== 73 ||
    Number(baseline.tenant_demo) !== 1 ||
    Number(baseline.tenant_unique_depre) !== 73
  ) {
    throw new Error(`PHASE5_INVENTORY_INVARIANT_VIOLATION:${JSON.stringify(baseline)}`);
  }

  const results = [];
  for (const target of selectedCases) {
    if (execute) {
      const res = await executePhase5EnrichmentForCase(
        {
          operationId: target.operationId,
          organizationId,
          depre: target.depre,
          actorUserId,
        },
        client,
      );
      results.push(res);
    } else {
      results.push({
        operationId: target.operationId,
        depre: target.depre,
        status: "PREVIEW_ONLY",
      });
    }
  }

  const after = await captureBaselineCounts();
  const evaluations = await listOpportunityEvaluations(organizationId, client);
  const auditValid = await verifyAuditChain(organizationId, client);
  const aiAttempts = await listAiReconfirmationAttempts(organizationId, "433c2565-d5d0-424a-b0e1-af7e1d3962b2", client);

  console.log(
    JSON.stringify(
      {
        mode: execute ? "EXECUTED" : "READ_ONLY_PREVIEW",
        baseline,
        after,
        researchLotCount: selectedCases.length,
        selectedCases: selectedCases.map((item, idx) => ({ order: idx + 1, ...item })),
        enrichmentResults: results,
        evaluationsSummary: {
          totalEvaluations: evaluations.length,
          readyForAnalyst: evaluations.filter((e) => Number(e.ready_for_analyst) === 1).length,
          blockedByIdentity: evaluations.filter((e) => e.qualification_status === "BLOCKED_BY_IDENTITY").length,
        },
        aiValidation: {
          totalRuns: aiAttempts.length,
          latestStatus: aiAttempts[0]?.status ?? "NOT_EXECUTED",
          overallStatus: aiAttempts[0]?.overallStatus ?? "",
          error: aiAttempts[0]?.error ?? null,
        },
        auditChainValid: auditValid,
      },
      null,
      2,
    ),
  );

  await client.close();
}

await main();
