import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import nextEnv from "@next/env";
import { createHash } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());

const { createClient } = await import("@libsql/client");
const { appendAudit, verifyAuditChain } = await import("../src/lib/audit");
const { listOfficialEvidence, countVerifiedOfficialEvidence } = await import("../src/lib/autonomous-acquisition");
const { djenAdapter, isOfficialSourceUrl, isValidCnjProcessNumber, normalizeCnjProcessNumber } = await import("../src/lib/acquisition-sources");
const { resolveAIProvider } = await import("../src/lib/ai/ai-provider");
const { beginAiReconfirmation, executeAiReconfirmation, listAiReconfirmationAttempts } = await import("../src/lib/ai-reconfirmation");
const { persistResolvedOfficialEvidence } = await import("../src/lib/evidence-persistence");
const { buildEvidenceCandidates, resolveEvidenceCandidatesForAcquisition } = await import("../src/lib/research-pipeline");
const { recordCreditorResolutionAttempt, initializeCreditorResolution } = await import("../src/lib/creditor-resolution");
const { deriveTitularStatusFromBeneficiaries, scoreOpportunity } = await import("../src/lib/opportunity-engine");
const { persistOpportunityEvaluation, listOpportunityEvaluations } = await import("../src/lib/opportunity-evaluations");
const { adaptDjenResult } = await import("../src/lib/source-adapters");
type SourceAcquisitionResult = import("../src/lib/research-pipeline").SourceAcquisitionResult;
type CreditorCandidateInput = import("../src/lib/creditor-resolution").CreditorCandidateInput;

const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const actorUserId = "system:phase4-controlled-research";
const aiPromptVersion = "phase4-controlled-v1";
const execute = process.argv.includes("--execute");
const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });

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

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
  const invalidTargets = await client.execute({
    sql: `SELECT COUNT(*) n FROM automation_jobs j
      LEFT JOIN operations o ON o.id=j.target_id AND o.organization_id=j.organization_id
      WHERE j.organization_id=? AND j.target_type='operation' AND o.id IS NULL`,
    args: [organizationId],
  });
  const orphanCounts = await client.execute({
    sql: `SELECT
      (SELECT COUNT(*) FROM official_evidence_documents e LEFT JOIN operations o ON o.id=e.operation_id AND o.organization_id=e.organization_id WHERE e.organization_id=? AND o.id IS NULL) evidence,
      (SELECT COUNT(*) FROM crm_records c LEFT JOIN operations o ON o.id=c.operation_id AND o.organization_id=c.organization_id WHERE c.organization_id=? AND o.id IS NULL) crm_records,
      (SELECT COUNT(*) FROM crm_tasks t LEFT JOIN crm_records r ON r.id=t.crm_id AND r.organization_id=t.organization_id WHERE t.organization_id=? AND r.id IS NULL) crm_tasks`,
    args: [organizationId, organizationId, organizationId],
  });
  return { ...object(query.rows[0]), invalid_automation_targets: Number(invalidTargets.rows[0]?.n || 0), orphans: object(orphanCounts.rows[0]) };
}

async function operationFingerprint() {
  const rows = await client.execute({ sql: "SELECT id,organization_id,version,title,debtor,process,source,nominal,workflow,is_demo FROM operations WHERE organization_id=? ORDER BY id", args: [organizationId] });
  return hash(JSON.stringify(rows.rows));
}

function sourceQueryState(status: string) {
  if (status === "FOUND") return "RESULTS_FOUND" as const;
  if (status === "NO_RESULT") return "RESULT_ZERO" as const;
  if (status === "SOURCE_BLOCKED") return "REQUIRES_ASSISTED_ACTION" as const;
  return "ACCESS_FAILED" as const;
}

function roleForResolution(role: string): CreditorCandidateInput["role"] {
  const roles: Record<string, CreditorCandidateInput["role"]> = {
    CREDOR: "CREDOR",
    BENEFICIARIO: "BENEFICIÁRIO",
    REQUERENTE: "REQUERENTE",
    AUTOR: "AUTOR",
    ADVOGADO: "ADVOGADO",
    DEVEDOR: "DEVEDOR",
    HERDEIRO: "HERDEIRO",
    CESSIONARIO: "CESSIONÁRIO",
    UNKNOWN: "NÃO_IDENTIFICADO",
  };
  return roles[role] ?? "OUTRO";
}

function candidateFromCommunication(communication: Record<string, unknown>, depre: string, sourceUrl: string): CreditorCandidateInput[] {
  const processNumber = text(communication.processNumber);
  if (!processNumber || normalizeCnjProcessNumber(processNumber) !== normalizeCnjProcessNumber(depre)) return [];
  const parties = Array.isArray(communication.partyObservations) ? communication.partyObservations.map(object) : [];
  return parties.flatMap((party) => {
    const name = text(party.name).trim();
    if (!name) return [];
    const roleEvidence = text(party.roleEvidence).trim();
    const role = text(party.role);
    const explicitRole = /^(CREDOR(?:A)?|BENEFICI[ÁA]RIO(?:A)?|HERDEIR[OA]|CESSION[ÁA]RIO(?:A)?)\b/i.test(roleEvidence);
    const reference = text(communication.hash) || text(communication.id);
    return [{
      displayName: name,
      debtorName: "",
      personType: "UNKNOWN",
      role: roleForResolution(role),
      maskedCpf: "",
      matchedField: "numeroProcessoDEPRE",
      matchedValue: depre,
      evidenceExcerpt: `DJEN ${text(communication.communicationType) || "comunicação"}; DEPRE exato ${depre}; ${roleEvidence || "papel não informado"}; referência ${reference || "não informada"}.`,
      source: "DJEN",
      sourceUrl: sourceUrl || text(communication.sourceLink),
      sourceReferenceDate: /^\d{4}-\d{2}-\d{2}/.test(text(communication.publicationDate)) ? text(communication.publicationDate).slice(0, 10) : "",
      sourcePage: null,
      officialRoleConfirmed: explicitRole,
      currentHolderClaim: "UNKNOWN",
    }];
  });
}

function documentaryCandidates(communications: Record<string, unknown>[], depre: string) {
  return communications.flatMap((communication) => {
    const processNumber = text(communication.processNumber);
    if (!processNumber || normalizeCnjProcessNumber(processNumber) !== normalizeCnjProcessNumber(depre)) return [];
    const documentUrl = text(communication.sourceLink);
    if (!documentUrl || !isOfficialSourceUrl(documentUrl)) return [];
    const documentIdentifier = text(communication.hash) || text(communication.id);
    if (!documentIdentifier) return [];
    const communicationId = text(communication.id) || documentIdentifier;
    const publishedAt = text(communication.publicationDate);
    return [{
      documentType: "OTHER_OFFICIAL_DOCUMENT",
      documentIdentifier,
      reference: `DJEN:${communicationId}`,
      officialSourceUrl: documentUrl,
      title: `DJEN communication: ${text(communication.communicationType) || "official communication"}`,
      publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ? publishedAt : "",
      status: "COLLECTED" as const,
      evidenceStrength: "MEDIUM" as const,
      notes: `Official DJEN communication returned for exact DEPRE ${depre}. Communication is not a requisitório and does not confirm current titular or 2/2.`,
      idempotencyKey: `phase4-djen-document-${hash(`${organizationId}|${depre}|${documentIdentifier}`)}`,
      rawPayload: { id: communicationId, hash: text(communication.hash), processNumber, communicationType: text(communication.communicationType), publicationDate: publishedAt, tribunal: text(communication.tribunal), courtUnit: text(communication.courtUnit) },
    }];
  });
}

async function hasAuditRequest(requestId: string) {
  const result = await client.execute({ sql: "SELECT id FROM audit_logs WHERE organization_id=? AND request_id=? LIMIT 1", args: [organizationId, requestId] });
  return result.rows.length > 0;
}

async function performDjenResearch(target: typeof selectedCases[number], operation: Record<string, unknown>, existingEvidence: Awaited<ReturnType<typeof listOfficialEvidence>>) {
  const queryId = normalizeCnjProcessNumber(target.depre);
  const idempotencyKey = `phase4-djen-${hash(`${organizationId}|${target.operationId}|${target.depre}`)}`;
  await initializeCreditorResolution(client);
  const previous = await client.execute({ sql: "SELECT * FROM creditor_resolution_attempts WHERE organization_id=? AND operation_id=? AND idempotency_key=?", args: [organizationId, target.operationId, idempotencyKey] });
  if (previous.rows[0]) {
    const row = object(previous.rows[0]);
    const auditRequestId = `phase4-source-${hash(`${organizationId}|${target.operationId}|${idempotencyKey}`)}`;
    if (!(await hasAuditRequest(auditRequestId))) {
      await appendAudit({ organizationId, actorUserId, action: "CREDITOR_RESOLUTION_ATTEMPTED", entityType: "operation", entityId: target.operationId, previousStateSummary: {}, nextStateSummary: { queryState: text(row.query_state), resultCount: Number(row.result_count), idempotentReplayAudit: true }, metadata: { phase: "PHASE_4", source: text(row.source), idempotencyKey }, requestId: auditRequestId, source: "PHASE_4_RESEARCH" }, client);
    }
    return { operationId: target.operationId, depre: target.depre, sourceStatus: String(row.source).match(/status=([^;|]+)/)?.[1] || String(row.query_state), requestAttempted: String(row.source).includes("requestAttempted=true"), httpStatus: null, resultCount: Number(row.result_count), candidateCount: JSON.parse(String(row.candidates_json)).length, duplicateAttemptSkipped: true, documentaryCandidates: [], evidenceResolutions: [] };
  }

  const now = new Date().toISOString();
  let lookup;
  if (!isValidCnjProcessNumber(target.depre)) {
    lookup = await djenAdapter.lookup({ processNumber: target.depre });
  } else {
    await wait(1_100);
    lookup = await djenAdapter.lookup({ processNumber: target.depre });
  }

  const communications = lookup.communications.map(object);
  const candidates = communications.flatMap((communication) => candidateFromCommunication(communication, target.depre, lookup.sourceUrl));
  const acquisitionResult = adaptDjenResult({
    provider: "CNJ/ComunicaCNJ",
    route: "GET /api/v1/comunicacao",
    requestedIdentifier: target.depre,
    status: lookup.status === "FOUND" ? "SUCCESS" : lookup.status,
    requestAttempted: lookup.requestAttempted,
    httpStatus: lookup.httpStatus,
    sourceUrl: lookup.sourceUrl,
    officialSourceUrl: lookup.sourceUrl,
    completedAt: now,
    durationMs: lookup.latencyMs,
    errorCode: lookup.status === "FOUND" || lookup.status === "NO_RESULT" ? null : lookup.status,
    errorMessage: lookup.failureReason || null,
    metadata: { resultCount: lookup.resultCount, sourceStatus: lookup.status, queryId: lookup.queryId },
    documentaryCandidates: documentaryCandidates(communications, target.depre),
  }) satisfies SourceAcquisitionResult;
  const evidenceCandidates = buildEvidenceCandidates(acquisitionResult);
  const resolutions = resolveEvidenceCandidatesForAcquisition(acquisitionResult, existingEvidence);
  const evidenceResolutions: Array<Record<string, unknown>> = [];
  for (const resolution of resolutions) {
    if (resolution.resolutionReason === "EXACT_DEPRE_MATCH") {
      evidenceResolutions.push({ reason: resolution.resolutionReason, status: "REJECTED_DEPRE_ONLY_MATCH", documentIdentifier: resolution.candidate.documentIdentifier });
      continue;
    }
    const saved = await persistResolvedOfficialEvidence(resolution, { organizationId, operationId: target.operationId, client }, existingEvidence);
    evidenceResolutions.push({ reason: resolution.resolutionReason, status: saved.status, evidenceId: saved.status === "REJECTED" ? null : saved.evidence.id, rationale: saved.status === "REJECTED" ? saved.reason : resolution.qualificationRationale });
    if (saved.status === "PERSISTED") {
      const auditRequestId = `phase4-evidence-${hash(`${organizationId}|${target.operationId}|${saved.evidence.id}`)}`;
      if (!(await hasAuditRequest(auditRequestId))) {
        await appendAudit({ organizationId, actorUserId, action: "OFFICIAL_EVIDENCE_RECORDED", entityType: "operation", entityId: target.operationId, previousStateSummary: {}, nextStateSummary: { evidenceId: saved.evidence.id, status: saved.evidence.status, evidenceStrength: saved.evidence.evidenceStrength }, metadata: { phase: "PHASE_4", depre: target.depre, source: saved.evidence.source, sourceId: saved.evidence.sourceProvenance?.sourceId || "djen", route: saved.evidence.sourceProvenance?.route || "GET /api/v1/comunicacao", qualifiesForDocumentation: countVerifiedOfficialEvidence([saved.evidence]) > 0 }, requestId: auditRequestId, source: "PHASE_4_RESEARCH" }, client);
      }
    }
  }

  const sourceLabel = `DJEN | provider=CNJ/ComunicaCNJ | route=GET /api/v1/comunicacao | status=${lookup.status};requestAttempted=${lookup.requestAttempted};httpStatus=${lookup.httpStatus ?? "null"};queryId=${lookup.queryId};error=${lookup.failureReason.slice(0, 140)}`;
  const queryState = sourceQueryState(lookup.status);
  const recorded = await recordCreditorResolutionAttempt({
    organizationId,
    actorUserId,
    operationId: target.operationId,
    idempotencyKey,
    identifiers: { numeroProcessoDEPRE: target.depre, epes: text(object(object(operation.workflow).credit).epesNumber), originProcessNumber: text(object(object(operation.workflow).credit).originProcessNumber), precatoryNumber: text(object(object(operation.workflow).credit).precatoryNumber), debtor: text(operation.debtor) },
    existingCreditorName: text(object(object(operation.workflow).client).name),
    source: sourceLabel,
    sourceUrl: lookup.sourceUrl,
    mode: "PUBLIC_LOOKUP",
    queryKind: "PROCESSO_DEPRE",
    queryValue: target.depre,
    queryState,
    resultCount: lookup.resultCount,
    candidates,
  }, client);
  const auditRequestId = `phase4-source-${hash(`${organizationId}|${target.operationId}|${idempotencyKey}`)}`;
  if (!(await hasAuditRequest(auditRequestId))) {
    await appendAudit({ organizationId, actorUserId, action: "CREDITOR_RESOLUTION_ATTEMPTED", entityType: "operation", entityId: target.operationId, previousStateSummary: { operationVersion: Number(operation.version) }, nextStateSummary: { sourceStatus: lookup.status, requestAttempted: lookup.requestAttempted, httpStatus: lookup.httpStatus, resultCount: lookup.resultCount, candidateCount: candidates.length, queryState, holderStatus: recorded.attempt.currentHolderStatus }, metadata: { phase: "PHASE_4", provider: "CNJ/ComunicaCNJ", source: "DJEN", route: "GET /api/v1/comunicacao", queryKind: "PROCESSO_DEPRE", queryIdentifier: target.depre, idempotencyKey, errorCategory: lookup.status === "FOUND" || lookup.status === "NO_RESULT" ? "" : lookup.status }, requestId: auditRequestId, source: "PHASE_4_RESEARCH" }, client);
  }
  return { operationId: target.operationId, depre: target.depre, sourceStatus: lookup.status, requestAttempted: lookup.requestAttempted, httpStatus: lookup.httpStatus, resultCount: lookup.resultCount, candidateCount: candidates.length, resolution: recorded.attempt.state, currentHolderStatus: recorded.attempt.currentHolderStatus, duplicateAttemptSkipped: recorded.duplicate, documentaryCandidates: evidenceCandidates.length, evidenceResolutions };
}

async function persistOpportunityResults(operations: Map<string, Record<string, unknown>>) {
  const outcomes = [];
  for (const target of selectedCases) {
    const operation = operations.get(target.operationId);
    if (!operation) throw new Error(`PHASE4_OPERATION_NOT_FOUND:${target.operationId}`);
    const workflow = object(operation.workflow);
    const credit = object(workflow.credit);
    const clientWorkflow = object(workflow.client);
    const inventory = object(workflow.inventory);
    const beneficiaries = Array.isArray(clientWorkflow.beneficiaries) ? clientWorkflow.beneficiaries.map(object) : [];
    const documents = await listOfficialEvidence(target.operationId, organizationId, client);
    const qualifyingEvidence = countVerifiedOfficialEvidence(documents);
    const value = Number(credit.grossAmount ?? credit.availableEstimate ?? 0) || 0;
    const dateBase = text(credit.valueDate);
    const lawyer = text(credit.legalRepName);
    const oab = text(credit.legalRepOab);
    const titularStatus = deriveTitularStatusFromBeneficiaries(beneficiaries.map((item) => ({ role: text(item.role), status: text(item.status) })));
    const result = scoreOpportunity({
      opportunityId: `phase3-${target.operationId}`,
      operationId: target.operationId,
      organizationId,
      depre: target.depre,
      debtor: text(operation.debtor) || null,
      originalValue: value > 0 ? value : null,
      currentValue: null,
      dataBase: dateBase || null,
      lawyer: lawyer || null,
      oab: oab || null,
      contactAvailable: false,
      contactStatus: text(credit.contactSource) ? "PROFESSIONAL_ROUTE" : "NO_CONFIRMED_CONTACT",
      coverageState: workflow.queryStatus === "SUCCESS" || workflow.documentStatus === "COMPLETE" ? "SUFFICIENT_COVERAGE" : "INSUFFICIENT_COVERAGE",
      qualifyingEvidenceCount: qualifyingEvidence,
      aiValidation: (text(inventory.aiValidation) || "PENDING") as "PENDING" | "CONFIRMADO" | "NÃO_CONFIRMADO" | "DIVERGENTE" | "ATUALIZADO",
      divergence: Boolean(object(workflow.creditorResolution).state === "DIVERGENT" || inventory.divergenceAlert),
      availability: text(inventory.availability) || "AVAILABLE",
      titularStatus,
      valueStatus: value > 0 ? "CONFIRMED" : "MISSING",
      lawyerStatus: lawyer && oab ? "CONFIRMED" : lawyer ? "UNCONFIRMED" : "MISSING",
      processStatus: credit.originProcessNumber || credit.requisitionProcessNumber ? "CONFIRMED" : "PENDING",
      researchStatus: text(workflow.queryStatus) || "MANUAL_REQUIRED",
      blockerCodes: beneficiaries.length > 1 ? ["MULTIPLE_BENEFICIARIES_UNRESOLVED"] : [],
      ruleVersion: "opportunity-rules-v3",
    });
    const persisted = await persistOpportunityEvaluation(result, client);
    outcomes.push({ operationId: target.operationId, depre: target.depre, status: result.status, readyForAnalyst: result.readyForAnalyst, blockerCodes: result.blockerCodes, evaluationId: persisted?.id });
  }
  return outcomes;
}

async function captureCounts() {
  const counts = await client.execute({
    sql: `SELECT
      (SELECT COUNT(*) FROM operations) globalOperations,
      (SELECT COUNT(*) FROM operations WHERE is_demo=0) globalNonDemo,
      (SELECT COUNT(*) FROM operations WHERE is_demo=1) globalDemo,
      (SELECT COUNT(*) FROM operations WHERE organization_id=?) tenantOperations,
      (SELECT COUNT(*) FROM operations WHERE organization_id=? AND is_demo=0) tenantReal,
      (SELECT COUNT(*) FROM operations WHERE organization_id=? AND is_demo=1) tenantDemo,
      (SELECT COUNT(DISTINCT NULLIF(json_extract(workflow,'$.credit.numeroProcessoDEPRE'),'')) FROM operations WHERE organization_id=? AND is_demo=0) uniqueDepre,
      (SELECT COUNT(*) FROM official_evidence_documents WHERE organization_id=?) evidence,
      (SELECT COUNT(*) FROM official_evidence_documents WHERE organization_id=? AND status='VERIFIED' AND evidence_strength='STRONG') verifiedStrong,
      (SELECT COUNT(*) FROM crm_records WHERE organization_id=?) crm,
      (SELECT COUNT(*) FROM crm_tasks WHERE organization_id=?) tasks,
      (SELECT COUNT(*) FROM crm_activities WHERE organization_id=?) activities,
      (SELECT COUNT(*) FROM automation_jobs WHERE organization_id=?) automationJobs,
      (SELECT COUNT(*) FROM audit_logs WHERE organization_id=?) audit,
      (SELECT COUNT(*) FROM opportunity_evaluations WHERE organization_id=?) evaluations,
      (SELECT COUNT(*) FROM opportunity_evaluations WHERE organization_id=? AND ready_for_analyst=1) ready,
      (SELECT COUNT(*) FROM ai_reconfirmation_runs WHERE organization_id=?) aiAttempts`,
    args: Array(17).fill(organizationId),
  });
  return object(counts.rows[0]);
}

async function main() {
  const baseline = await captureBaselineCounts() as Record<string, unknown>;
  if (Number(baseline.global_operations) !== 77 || Number(baseline.global_non_demo) !== 76 || Number(baseline.global_demo) !== 1 || Number(baseline.tenant_operations) !== 74 || Number(baseline.tenant_real) !== 73 || Number(baseline.tenant_demo) !== 1 || Number(baseline.tenant_unique_depre) !== 73) {
    throw new Error(`PHASE4_BASELINE_MISMATCH_STOPPED_BEFORE_MUTATION:${JSON.stringify(baseline)}`);
  }
  if (selectedCases.length !== 20 || new Set(selectedCases.map((item) => item.operationId)).size !== 20 || new Set(selectedCases.map((item) => item.depre)).size !== 20) throw new Error("PHASE4_SELECTION_NOT_UNIQUE");
  const expectedIds = selectedCases.map((item) => item.operationId);
  const rows = await client.execute({ sql: `SELECT id,organization_id,is_demo,version,debtor,workflow FROM operations WHERE organization_id=? AND id IN (${expectedIds.map(() => "?").join(",")})`, args: [organizationId, ...expectedIds] });
  if (rows.rows.length !== 20 || rows.rows.some((row) => String(row.organization_id) !== organizationId || Number(row.is_demo) !== 0)) throw new Error("PHASE4_TENANT_OR_REAL_OPERATION_ASSERTION_FAILED");
  const operations = new Map<string, Record<string, unknown>>();
  for (const raw of rows.rows) {
    const row = object(raw);
    const workflow = JSON.parse(text(row.workflow));
    const actualDepre = text(object(workflow.credit).numeroProcessoDEPRE).trim();
    const target = selectedCases.find((item) => item.operationId === String(row.id));
    if (!target || target.depre !== actualDepre) throw new Error(`PHASE4_DEPRE_SNAPSHOT_MISMATCH:${String(row.id)}`);
    operations.set(String(row.id), { ...row, workflow });
  }
  const initialOperationFingerprint = await operationFingerprint();
  const officialSourcePreflight = {
    "TJSP_DIRECT/JusScraper": "NOT_CONFIGURED: local juscraper module absent; no route call",
    "DataJud/TJSP": "AUTH_REQUIRED: CP_DATAJUD_RESEARCH_AUTHORIZED is false and no DATAJUD key; no request",
    "TJSP/e-SAJ": "MANUAL_REQUIRED: adapter explicitly sends no request",
    "TJSP/DEPRE/CAC": "CAPTCHA_REQUIRED: route requires human-assisted access; no request",
    "CNJ/DJEN": "public API; one serial lookup per selected DEPRE where the identifier passes CNJ validation",
  };
  let djenRateLimited = false;
  const sourceResults = [];
  if (execute) await initializeCreditorResolution(client);
  for (const target of selectedCases) {
    const operation = operations.get(target.operationId)!;
    const evidence = await listOfficialEvidence(target.operationId, organizationId, client);
    let output: Record<string, unknown>;
    if (execute) {
      output = await performDjenResearch(target, operation, evidence);
      if (output.sourceStatus === "RATE_LIMITED") djenRateLimited = true;
    } else {
      output = { operationId: target.operationId, depre: target.depre, sourceStatus: isValidCnjProcessNumber(target.depre) ? "NOT_ATTEMPTED_PREVIEW" : "INVALID_QUERY", requestAttempted: false, evidenceCount: evidence.length };
    }
    sourceResults.push(output);
  }

  let ai = { status: "AI_EXTERNAL_VERIFICATION_PENDING", runId: "", overallStatus: "", confirmedFields: [] as string[], unconfirmedFields: [] as string[], errorCategory: "" };
  if (execute) {
    const model = resolveAIProvider("deepseek", true);
    const attemptKey = await client.execute({ sql: "SELECT id,status FROM ai_reconfirmation_runs WHERE organization_id=? AND operation_id=? AND prompt_version=? ORDER BY started_at LIMIT 1", args: [organizationId, "433c2565-d5d0-424a-b0e1-af7e1d3962b2", aiPromptVersion] });
    if (attemptKey.rows[0]) {
      const existing = await listAiReconfirmationAttempts(organizationId, "433c2565-d5d0-424a-b0e1-af7e1d3962b2", client);
      const run = existing.find((item) => item.id === String(attemptKey.rows[0].id));
      ai = { status: run?.status || "PENDING_EXISTING_PHASE4_RUN", runId: String(attemptKey.rows[0].id), overallStatus: run?.overallStatus || "", confirmedFields: run?.fieldResults.filter((field) => field.status === "CONFIRMADO").map((field) => field.field) || [], unconfirmedFields: run?.fieldResults.filter((field) => field.status === "NÃO_CONFIRMADO").map((field) => field.field) || [], errorCategory: run?.error ? run.error.split(":")[0] : "" };
    } else {
      const pending = await beginAiReconfirmation({ organizationId, operationId: "433c2565-d5d0-424a-b0e1-af7e1d3962b2", actorUserId, model: model.model, promptVersion: aiPromptVersion, client });
      if (!pending) throw new Error("PHASE4_AI_CASE_NOT_FOUND");
      const result = await executeAiReconfirmation({ organizationId, operationId: pending.operationId, runId: pending.id, actorUserId }, { client, provider: model });
      const confirmedFields = result?.fieldResults.filter((field) => field.status === "CONFIRMADO").map((field) => field.field) ?? [];
      const unconfirmedFields = result?.fieldResults.filter((field) => field.status === "NÃO_CONFIRMADO").map((field) => field.field) ?? [];
      ai = { status: result?.status ?? "FAILED", runId: pending.id, overallStatus: result?.overallStatus ?? "", confirmedFields, unconfirmedFields, errorCategory: result?.error ? result.error.split(":")[0] : "" };
    }
  }

  const evaluations = execute ? await persistOpportunityResults(operations) : [];
  const after = await captureCounts();
  const finalOperationFingerprint = await operationFingerprint();
  const attempts = execute ? await listCreditorResolutionAttemptsForBatch() : [];
  const finalEvaluations = await listOpportunityEvaluations(organizationId, client);
  const auditValid = await verifyAuditChain(organizationId, client);
  const result = {
    mode: execute ? "EXECUTED" : "READ_ONLY_PREVIEW",
    baseline,
    after,
    officialSourcePreflight,
    selectionRule: "qualifying evidence desc; raw official evidence desc; structured beneficiary observations desc; DEPRE ascending tie-break; only active-tenant non-demo rows with non-empty DEPRE",
    selectedCases: selectedCases.map((item, index) => ({ order: index + 1, ...item })),
    sourceResults,
    djenStoppedForRateLimit: djenRateLimited,
    ai: { ...ai, provider: execute ? "deepseek" : "not-executed-preview", model: execute ? "deepseek-flash" : "not-started" },
    evaluations,
    finalEvaluationCount: finalEvaluations.length,
    finalReadyCount: finalEvaluations.filter((row) => Number(row.ready_for_analyst) === 1).length,
    phase4ResolutionAttempts: attempts.length,
    operationRowsUnchanged: initialOperationFingerprint === finalOperationFingerprint,
    auditChainValid: auditValid,
  };
  console.log(JSON.stringify(result, null, 2));
  await client.close();
}

async function listCreditorResolutionAttemptsForBatch() {
  const result = await client.execute({
    sql: `SELECT operation_id,query_state,result_count,idempotency_key,source
      FROM creditor_resolution_attempts
      WHERE organization_id=? AND operation_id IN (${selectedCases.map(() => "?").join(",")})
      AND idempotency_key LIKE 'phase4-djen-%' ORDER BY operation_id`,
    args: [organizationId, ...selectedCases.map((item) => item.operationId)],
  });
  return result.rows;
}

await main();
