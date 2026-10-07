import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { z } from "zod";
import { appendAudit } from "./audit";
import { listOfficialEvidence } from "./autonomous-acquisition";
import { isOfficialSourceUrl } from "./acquisition-sources";
import { getOperation, updateOperation } from "./operations";
import { beneficiaryObservationSchema } from "./operational-workflow";
import { normalizeOfficialUrl } from "./identifier-normalizer";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const historicalObservationInput = beneficiaryObservationSchema.omit({ id: true }).extend({
  status: z.enum(["HISTORICAL_CONFIRMED", "DIVERGENT"]),
});
const importedObservationInput = beneficiaryObservationSchema.omit({ id: true }).extend({
  role: z.literal("UNKNOWN"),
  status: z.literal("UNVERIFIED_IMPORT"),
  sourceUrl: z.literal(""),
  sourceType: z.literal("IMPORTED_SNAPSHOT"),
  sourceStatus: z.literal("NOT_ATTEMPTED"),
  evidenceId: z.literal(""),
  evidenceStrength: z.literal(""),
});

export type HistoricalBeneficiaryObservationInput = z.input<typeof historicalObservationInput> & {
  operationId: string;
  organizationId: string;
  actorUserId: string;
};

export type ImportedBeneficiarySnapshotInput = z.input<typeof importedObservationInput> & {
  operationId: string;
  organizationId: string;
  actorUserId: string;
};

export type BeneficiaryObservationResult =
  | { status: "ADDED"; beneficiaryId: string; operationVersion: number }
  | { status: "RECONCILED"; beneficiaryId: string; operationVersion: number }
  | { status: "ALREADY_PRESENT"; beneficiaryId: string; operationVersion: number };

/** Persists a historical/source assertion only when the exact DEPRE and existing official evidence agree. */
export async function recordHistoricalBeneficiaryObservation(
  input: HistoricalBeneficiaryObservationInput,
  client: Client = db,
): Promise<BeneficiaryObservationResult> {
  const { operationId, organizationId, actorUserId, ...rawObservation } = input;
  const observation = historicalObservationInput.parse(rawObservation);
  const operation = await getOperation(operationId, client, organizationId);
  if (!operation) throw new Error("BENEFICIARY_OPERATION_NOT_FOUND");
  if (operation.isDemo) throw new Error("BENEFICIARY_DEMO_OPERATION_FORBIDDEN");
  if (!operation.workflow.credit.numeroProcessoDEPRE || observation.depre !== operation.workflow.credit.numeroProcessoDEPRE) {
    throw new Error("BENEFICIARY_DEPRE_MISMATCH");
  }
  if (!isOfficialSourceUrl(observation.sourceUrl)) throw new Error("BENEFICIARY_OFFICIAL_SOURCE_REQUIRED");
  if (observation.lawyerSourceUrl && !isOfficialSourceUrl(observation.lawyerSourceUrl)) {
    throw new Error("BENEFICIARY_LAWYER_SOURCE_REQUIRED");
  }
  if (!observation.evidenceId || !["SUCCESS", "NOT_ATTEMPTED"].includes(observation.sourceStatus)) {
    throw new Error("BENEFICIARY_HISTORICAL_EVIDENCE_REQUIRED");
  }

  const documents = await listOfficialEvidence(operationId, organizationId, client);
  const evidence = documents.find((document) => document.id === observation.evidenceId);
  if (!evidence || evidence.status === "FAILED" || evidence.documentType !== "OFFICIAL_RECORD") {
    throw new Error("BENEFICIARY_EVIDENCE_NOT_FOUND");
  }
  const candidateUrl = normalizeOfficialUrl(observation.sourceUrl).normalized;
  const evidenceUrl = normalizeOfficialUrl(evidence.sourceUrl).normalized;
  const referenceMatches = [evidence.documentIdentifier, evidence.reference]
    .some((value) => value.trim().toLowerCase() === observation.reference.trim().toLowerCase()
      || value.trim().toLowerCase() === observation.documentIdentifier.trim().toLowerCase());
  if ((!candidateUrl || candidateUrl !== evidenceUrl) && !referenceMatches) {
    throw new Error("BENEFICIARY_EVIDENCE_PROVENANCE_MISMATCH");
  }
  if (observation.evidenceStrength !== evidence.evidenceStrength) {
    throw new Error("BENEFICIARY_EVIDENCE_STRENGTH_MISMATCH");
  }

  const beneficiary = beneficiaryObservationSchema.parse({ ...observation, id: crypto.randomUUID() });
  const existingIndex = operation.workflow.client.beneficiaries.findIndex((item) =>
    item.depre === beneficiary.depre
    && item.name.trim().toLocaleLowerCase("pt-BR") === beneficiary.name.trim().toLocaleLowerCase("pt-BR")
    && item.reference.trim().toLocaleLowerCase("pt-BR") === beneficiary.reference.trim().toLocaleLowerCase("pt-BR")
  );
  const existing = existingIndex >= 0 ? operation.workflow.client.beneficiaries[existingIndex] : null;
  const equivalent = existing && (
    existing.evidenceId === beneficiary.evidenceId
    && existing.sourceUrl === beneficiary.sourceUrl
    && existing.role === beneficiary.role
    && existing.status === beneficiary.status
    && existing.source === beneficiary.source
    && existing.sourceType === beneficiary.sourceType
    && existing.provider === beneficiary.provider
    && existing.sourceId === beneficiary.sourceId
    && existing.route === beneficiary.route
    && existing.sourceStatus === beneficiary.sourceStatus
    && existing.documentIdentifier === beneficiary.documentIdentifier
    && existing.evidenceStrength === beneficiary.evidenceStrength
    && existing.lawyerName === beneficiary.lawyerName
    && existing.lawyerOab === beneficiary.lawyerOab
    && existing.lawyerSource === beneficiary.lawyerSource
    && existing.lawyerSourceUrl === beneficiary.lawyerSourceUrl
    && existing.lawyerSourceStatus === beneficiary.lawyerSourceStatus
    && existing.context === beneficiary.context
  );
  if (existing && equivalent) {
    return { status: "ALREADY_PRESENT", beneficiaryId: existing.id, operationVersion: operation.version };
  }
  const persistedBeneficiary = existing ? { ...beneficiary, id: existing.id } : beneficiary;
  const beneficiaries = [...operation.workflow.client.beneficiaries];
  if (existingIndex >= 0) beneficiaries[existingIndex] = persistedBeneficiary;
  else beneficiaries.push(persistedBeneficiary);

  const updated = await updateOperation({
    ...operation,
    workflow: {
      ...operation.workflow,
      client: {
        ...operation.workflow.client,
        beneficiaries,
      },
    },
  }, client, organizationId, actorUserId);
  if (updated.status !== "updated") throw new Error(`BENEFICIARY_OPERATION_UPDATE_${updated.status.toUpperCase()}`);

  await appendAudit({
    organizationId,
    actorUserId,
    action: beneficiary.status === "DIVERGENT"
      ? "CREDITOR_IDENTITY_CONFLICT"
      : existing ? "DOCUMENT_MATCHED" : "CREDITOR_CANDIDATE_FOUND",
    entityType: "operation",
    entityId: operationId,
    previousStateSummary: {
      beneficiaryCount: operation.workflow.client.beneficiaries.length,
      priorEvidenceId: existing?.evidenceId ?? "",
      priorSourceUrl: existing?.sourceUrl ?? "",
    },
    nextStateSummary: {
      beneficiaryCount: updated.operation.workflow.client.beneficiaries.length,
      depre: persistedBeneficiary.depre,
      status: persistedBeneficiary.status,
      evidenceId: persistedBeneficiary.evidenceId,
    },
    metadata: {
      source: persistedBeneficiary.source,
      sourceId: persistedBeneficiary.sourceId,
      route: persistedBeneficiary.route,
      reference: persistedBeneficiary.reference,
      sourceStatus: persistedBeneficiary.sourceStatus,
      currentHolderConfirmed: false,
    },
    requestId: `beneficiary-${createHash("sha256").update(`${operationId}|${persistedBeneficiary.evidenceId}|${persistedBeneficiary.reference}`).digest("hex")}`,
    source: "PHASE_2_TITULAR_ENRICHMENT",
  }, client);

  return { status: existing ? "RECONCILED" : "ADDED", beneficiaryId: persistedBeneficiary.id, operationVersion: updated.operation.version };
}

export async function recordImportedBeneficiarySnapshot(
  input: ImportedBeneficiarySnapshotInput,
  client: Client = db,
): Promise<BeneficiaryObservationResult> {
  const { operationId, organizationId, actorUserId, ...rawObservation } = input;
  const observation = importedObservationInput.parse(rawObservation);
  const operation = await getOperation(operationId, client, organizationId);
  if (!operation) throw new Error("BENEFICIARY_OPERATION_NOT_FOUND");
  if (operation.isDemo) throw new Error("BENEFICIARY_DEMO_OPERATION_FORBIDDEN");
  if (!operation.workflow.credit.numeroProcessoDEPRE || observation.depre !== operation.workflow.credit.numeroProcessoDEPRE) {
    throw new Error("BENEFICIARY_DEPRE_MISMATCH");
  }
  const importedNames = operation.workflow.client.name.split(";").map((name) => name.trim()).filter(Boolean);
  const hasInitialPackageProvenance = operation.workflow.credit.sourceName.includes("Pacote 73") || operation.source.includes("Pacote 73");
  if (!importedNames.includes(observation.name) || !hasInitialPackageProvenance) {
    throw new Error("BENEFICIARY_IMPORTED_SNAPSHOT_NOT_FOUND");
  }
  const beneficiary = beneficiaryObservationSchema.parse({ ...observation, id: crypto.randomUUID() });
  const existing = operation.workflow.client.beneficiaries.find((item) =>
    item.depre === beneficiary.depre
    && item.name.trim() === beneficiary.name.trim()
    && item.sourceType === "IMPORTED_SNAPSHOT"
    && item.evidenceId === "",
  );
  if (existing) return { status: "ALREADY_PRESENT", beneficiaryId: existing.id, operationVersion: operation.version };

  const updated = await updateOperation({
    ...operation,
    workflow: {
      ...operation.workflow,
      client: { ...operation.workflow.client, beneficiaries: [...operation.workflow.client.beneficiaries, beneficiary] },
    },
  }, client, organizationId, actorUserId);
  if (updated.status !== "updated") throw new Error(`BENEFICIARY_OPERATION_UPDATE_${updated.status.toUpperCase()}`);

  await appendAudit({
    organizationId,
    actorUserId,
    action: "CREDITOR_CANDIDATE_FOUND",
    entityType: "operation",
    entityId: operationId,
    previousStateSummary: { beneficiaryCount: operation.workflow.client.beneficiaries.length },
    nextStateSummary: {
      beneficiaryCount: updated.operation.workflow.client.beneficiaries.length,
      depre: beneficiary.depre,
      status: "UNVERIFIED_IMPORT",
      currentHolderConfirmed: false,
    },
    metadata: { source: beneficiary.source, sourceId: beneficiary.sourceId, route: beneficiary.route, sourceStatus: "NOT_ATTEMPTED" },
    requestId: `beneficiary-import-${createHash("sha256").update(`${operationId}|${beneficiary.depre}|${beneficiary.name}`).digest("hex")}`,
    source: "PHASE_2_TITULAR_ENRICHMENT",
  }, client);
  return { status: "ADDED", beneficiaryId: beneficiary.id, operationVersion: updated.operation.version };
}
