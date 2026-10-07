import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { appendAudit, hasAuditRequest } from "./audit";
import { listOfficialEvidence, countVerifiedOfficialEvidence } from "./autonomous-acquisition";
import { djenAdapter, isOfficialSourceUrl, isValidCnjProcessNumber, normalizeCnjProcessNumber } from "./acquisition-sources";
import { buildEvidenceCandidates, resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult } from "./research-pipeline";
import { persistResolvedOfficialEvidence } from "./evidence-persistence";
import { recordCreditorResolutionAttempt, initializeCreditorResolution, type CreditorCandidateInput } from "./creditor-resolution";
import { deriveTitularStatusFromBeneficiaries, scoreOpportunity, type OpportunityBlockerCode } from "./opportunity-engine";
import { persistOpportunityEvaluation } from "./opportunity-evaluations";
import { adaptDjenResult } from "./source-adapters";
import { type ContactStatus } from "./contact-enrichment";
import { getOperation } from "./operations";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });

const object = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

export type Phase5EnrichmentInput = {
  operationId: string;
  organizationId: string;
  depre: string;
  actorUserId: string;
};

export type Phase5EnrichmentResult = {
  operationId: string;
  depre: string;
  sourceStatus: string;
  requestAttempted: boolean;
  httpStatus: number | null;
  resultCount: number;
  candidateCount: number;
  currentHolderStatus: string;
  duplicateAttemptSkipped: boolean;
  documentaryCandidatesCount: number;
  qualifyingEvidenceCount: number;
  opportunityStatus: string;
  readyForAnalyst: boolean;
  blockerCodes: OpportunityBlockerCode[];
  contactStatus: ContactStatus;
  lawyerStatus: string;
  valueStatus: string;
  processStatus: string;
  evaluationId: string | null;
};

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
      idempotencyKey: `phase5-djen-document-${hash(`${depre}|${documentIdentifier}`)}`,
      rawPayload: { id: communicationId, hash: text(communication.hash), processNumber, communicationType: text(communication.communicationType), publicationDate: publishedAt, tribunal: text(communication.tribunal), courtUnit: text(communication.courtUnit) },
    }];
  });
}

export async function executePhase5EnrichmentForCase(
  input: Phase5EnrichmentInput,
  client: Client = db,
): Promise<Phase5EnrichmentResult> {
  const { operationId, organizationId, depre, actorUserId } = input;
  const operation = await getOperation(operationId, client, organizationId);
  if (!operation) throw new Error(`PHASE5_OPERATION_NOT_FOUND:${operationId}`);
  if (operation.isDemo) throw new Error(`PHASE5_DEMO_OPERATION_FORBIDDEN:${operationId}`);

  const credit = operation.workflow.credit;
  const actualDepre = text(credit.numeroProcessoDEPRE).trim();
  if (!actualDepre || actualDepre !== depre) throw new Error(`PHASE5_DEPRE_MISMATCH:${depre}`);

  // STEP A: Initial setup & idempotency check
  await initializeCreditorResolution(client);
  const idempotencyKey = `phase5-djen-${hash(`${organizationId}|${operationId}|${depre}`)}`;
  const previousAttempt = await client.execute({
    sql: "SELECT * FROM creditor_resolution_attempts WHERE organization_id=? AND operation_id=? AND idempotency_key=?",
    args: [organizationId, operationId, idempotencyKey],
  });

  const existingEvidence = await listOfficialEvidence(operationId, organizationId, client);
  let lookupStatus = "NO_RESULT";
  let requestAttempted = false;
  let httpStatus: number | null = null;
  let resultCount = 0;
  let candidates: CreditorCandidateInput[] = [];
  let candidateDocsCount = 0;
  let duplicateSkipped = false;
  let currentHolderStatus = operation.workflow.creditorResolution?.currentHolderStatus || "CURRENT_HOLDER_NOT_CONFIRMED";

  if (previousAttempt.rows[0]) {
    duplicateSkipped = true;
    const row = object(previousAttempt.rows[0]);
    lookupStatus = String(row.source).match(/status=([^;|]+)/)?.[1] || String(row.query_state);
    requestAttempted = String(row.source).includes("requestAttempted=true");
    resultCount = Number(row.result_count);
    candidates = JSON.parse(String(row.candidates_json || "[]"));
    currentHolderStatus = (text(row.current_holder_status) || currentHolderStatus) as typeof currentHolderStatus;
  } else {
    requestAttempted = true;
    if (!isValidCnjProcessNumber(depre)) {
      lookupStatus = "INVALID_QUERY";
      requestAttempted = false;
    } else {
      const lookup = await djenAdapter.lookup({ processNumber: depre });
      lookupStatus = lookup.status;
      httpStatus = lookup.httpStatus;
      resultCount = lookup.resultCount;
      const communications = lookup.communications.map(object);
      candidates = communications.flatMap((comm) => candidateFromCommunication(comm, depre, lookup.sourceUrl));

      const acquisitionResult = adaptDjenResult({
        provider: "CNJ/ComunicaCNJ",
        route: "GET /api/v1/comunicacao",
        requestedIdentifier: depre,
        status: lookup.status === "FOUND" ? "SUCCESS" : lookup.status,
        requestAttempted: lookup.requestAttempted,
        httpStatus: lookup.httpStatus,
        sourceUrl: lookup.sourceUrl,
        officialSourceUrl: lookup.sourceUrl,
        completedAt: new Date().toISOString(),
        durationMs: lookup.latencyMs,
        errorCode: lookup.status === "FOUND" || lookup.status === "NO_RESULT" ? null : lookup.status,
        errorMessage: lookup.failureReason || null,
        metadata: { resultCount: lookup.resultCount, sourceStatus: lookup.status, queryId: lookup.queryId },
        documentaryCandidates: documentaryCandidates(communications, depre),
      }) satisfies SourceAcquisitionResult;

      const evidenceCandidatesList = buildEvidenceCandidates(acquisitionResult);
      candidateDocsCount = evidenceCandidatesList.length;
      const resolutions = resolveEvidenceCandidatesForAcquisition(acquisitionResult, existingEvidence);

      for (const resolution of resolutions) {
        if (resolution.resolutionReason !== "EXACT_DEPRE_MATCH") {
          const saved = await persistResolvedOfficialEvidence(resolution, { organizationId, operationId, client }, existingEvidence);
          if (saved.status === "PERSISTED") {
            const auditRequestId = `phase5-evidence-${hash(`${organizationId}|${operationId}|${saved.evidence.id}`)}`;
            if (!(await hasAuditRequest(auditRequestId, client))) {
              await appendAudit({
                organizationId,
                actorUserId,
                action: "OFFICIAL_EVIDENCE_RECORDED",
                entityType: "operation",
                entityId: operationId,
                previousStateSummary: {},
                nextStateSummary: { evidenceId: saved.evidence.id, status: saved.evidence.status, evidenceStrength: saved.evidence.evidenceStrength },
                metadata: { phase: "PHASE_5", depre, source: saved.evidence.source, route: saved.evidence.sourceProvenance?.route || "GET /api/v1/comunicacao" },
                requestId: auditRequestId,
                source: "PHASE_5_RESEARCH",
              }, client);
            }
          }
        }
      }

      const sourceLabel = `DJEN | provider=CNJ/ComunicaCNJ | route=GET /api/v1/comunicacao | status=${lookup.status};requestAttempted=${lookup.requestAttempted};httpStatus=${lookup.httpStatus ?? "null"};queryId=${lookup.queryId};error=${lookup.failureReason.slice(0, 140)}`;
      const queryState = sourceQueryState(lookup.status);
      const recorded = await recordCreditorResolutionAttempt({
        organizationId,
        actorUserId,
        operationId,
        idempotencyKey,
        identifiers: { numeroProcessoDEPRE: depre, epes: text(credit.epesNumber), originProcessNumber: text(credit.originProcessNumber), precatoryNumber: text(credit.precatoryNumber), debtor: text(operation.debtor) },
        existingCreditorName: text(operation.workflow.client.name),
        source: sourceLabel,
        sourceUrl: lookup.sourceUrl,
        mode: "PUBLIC_LOOKUP",
        queryKind: "PROCESSO_DEPRE",
        queryValue: depre,
        queryState,
        resultCount: lookup.resultCount,
        candidates,
      }, client);

      currentHolderStatus = recorded.attempt.currentHolderStatus;

      const auditRequestId = `phase5-source-${hash(`${organizationId}|${operationId}|${idempotencyKey}`)}`;
      if (!(await hasAuditRequest(auditRequestId, client))) {
        await appendAudit({
          organizationId,
          actorUserId,
          action: "CREDITOR_RESOLUTION_ATTEMPTED",
          entityType: "operation",
          entityId: operationId,
          previousStateSummary: { operationVersion: operation.version },
          nextStateSummary: { sourceStatus: lookup.status, requestAttempted: lookup.requestAttempted, httpStatus: lookup.httpStatus, resultCount: lookup.resultCount, candidateCount: candidates.length, holderStatus: currentHolderStatus },
          metadata: { phase: "PHASE_5", provider: "CNJ/ComunicaCNJ", source: "DJEN", route: "GET /api/v1/comunicacao", queryIdentifier: depre, idempotencyKey },
          requestId: auditRequestId,
          source: "PHASE_5_RESEARCH",
        }, client);
      }
    }
  }

  // Refetch updated evidence list
  const currentEvidence = await listOfficialEvidence(operationId, organizationId, client);
  const qualifyingEvidence = countVerifiedOfficialEvidence(currentEvidence);

  // Extract fields with provenance
  const value = Number(credit.grossAmount ?? credit.availableEstimate ?? 0) || 0;
  const dateBase = text(credit.valueDate);
  const lawyer = text(credit.legalRepName);
  const oab = text(credit.legalRepOab);

  const beneficiaries = Array.isArray(operation.workflow.client.beneficiaries) ? operation.workflow.client.beneficiaries.map(object) : [];
  const titularStatus = deriveTitularStatusFromBeneficiaries(beneficiaries.map((b) => ({ role: text(b.role), status: text(b.status) })));
  const contactAvailable = Boolean(operation.workflow.client.phone || operation.workflow.client.email);
  const contactStatus: ContactStatus = text(credit.contactSource) ? "PROFESSIONAL_ROUTE" : contactAvailable ? "CONFIRMED" : "NOT_CONFIRMED";

  const processNumber = text(credit.originProcessNumber) || text(credit.requisitionProcessNumber) || text(operation.process);
  const processStatus = processNumber ? "CONFIRMED" : "PENDING";
  const lawyerStatus = lawyer && oab ? "CONFIRMED" : lawyer ? "UNCONFIRMED" : "MISSING";
  const valueStatus = value > 0 ? "CONFIRMED" : "MISSING";

  // Score opportunity using canonical opportunity engine
  const scoreResult = scoreOpportunity({
    opportunityId: `phase5-${operationId}`,
    operationId,
    organizationId,
    depre,
    debtor: text(operation.debtor) || null,
    originalValue: value > 0 ? value : null,
    currentValue: null,
    dataBase: dateBase || null,
    lawyer: lawyer || null,
    oab: oab || null,
    contactAvailable,
    contactStatus,
    coverageState: String(operation.workflow.queryStatus) === "SUCCESS" || String(operation.workflow.documentStatus) === "COMPLETE" ? "SUFFICIENT_COVERAGE" : "INSUFFICIENT_COVERAGE",
    qualifyingEvidenceCount: qualifyingEvidence,
    aiValidation: (text(operation.workflow.inventory?.aiValidation) || "PENDING") as "PENDING" | "CONFIRMADO" | "NÃO_CONFIRMADO" | "DIVERGENTE" | "ATUALIZADO",
    divergence: Boolean(String(operation.workflow.creditorResolution?.state) === "DIVERGENT" || operation.workflow.inventory?.divergenceAlert),
    availability: text(operation.workflow.inventory?.availability) || "AVAILABLE",
    titularStatus,
    valueStatus,
    lawyerStatus,
    processStatus,
    researchStatus: text(operation.workflow.queryStatus) || "MANUAL_REQUIRED",
    blockerCodes: beneficiaries.length > 1 ? ["MULTIPLE_BENEFICIARIES_UNRESOLVED"] : [],
    ruleVersion: "opportunity-rules-v3",
  });

  const persistedEval = await persistOpportunityEvaluation(scoreResult, client);

  return {
    operationId,
    depre,
    sourceStatus: lookupStatus,
    requestAttempted,
    httpStatus,
    resultCount,
    candidateCount: candidates.length,
    currentHolderStatus,
    duplicateAttemptSkipped: duplicateSkipped,
    documentaryCandidatesCount: candidateDocsCount,
    qualifyingEvidenceCount: qualifyingEvidence,
    opportunityStatus: scoreResult.status,
    readyForAnalyst: scoreResult.readyForAnalyst,
    blockerCodes: scoreResult.blockerCodes,
    contactStatus,
    lawyerStatus,
    valueStatus,
    processStatus,
    evaluationId: persistedEval ? String(persistedEval.id) : null,
  };
}
