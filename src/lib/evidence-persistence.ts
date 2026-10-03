import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import {
  listOfficialEvidence,
  recordOfficialEvidence,
  type OfficialEvidenceDocument,
} from "./autonomous-acquisition";
import type { EvidenceCandidate, ResolvedEvidence } from "./research-pipeline";

export type EvidencePersistenceResult =
  | { status: "REUSED"; evidence: OfficialEvidenceDocument }
  | { status: "PERSISTED"; evidence: OfficialEvidenceDocument }
  | { status: "REJECTED"; reason: string };

export type PersistenceContext = {
  organizationId: string;
  operationId: string;
  client: Client;
};

function deterministicIdempotencyKey(candidate: EvidenceCandidate): string {
  if (candidate.idempotencyKey?.trim()) return candidate.idempotencyKey.trim();
  const identity = [
    candidate.documentType,
    candidate.documentIdentifier ?? "",
    candidate.reference ?? "",
    candidate.officialSourceUrl ?? "",
    candidate.contentHash ?? "",
    candidate.contentFingerprint ?? "",
    candidate.acquisitionResultRef.sourceId,
  ].join("|");
  return `candidate-${createHash("sha256").update(identity).digest("hex")}`;
}

function reject(candidate: EvidenceCandidate, reason: string): EvidencePersistenceResult {
  return { status: "REJECTED", reason: `${reason}:${candidate.documentType}` };
}

/**
 * Persists only unresolved candidates with explicit, schema-valid evidence
 * metadata. Existing resolved IDs are reused and never inserted again.
 */
export async function persistResolvedOfficialEvidence(
  resolved: ResolvedEvidence,
  context: PersistenceContext,
  existingDocuments?: OfficialEvidenceDocument[],
): Promise<EvidencePersistenceResult> {
  const candidate = resolved.candidate;
  if (resolved.evidenceId !== null) {
    const existing = (existingDocuments ?? await listOfficialEvidence(context.operationId, context.organizationId, context.client))
      .find((document) => document.id === resolved.evidenceId);
    if (!existing) return reject(candidate, "RESOLVED_EVIDENCE_NOT_FOUND");
    return { status: "REUSED", evidence: existing };
  }

  if (!candidate.officialSourceUrl) return reject(candidate, "OFFICIAL_SOURCE_URL_REQUIRED");
  if (!candidate.documentIdentifier && !candidate.reference) return reject(candidate, "EVIDENCE_IDENTITY_REQUIRED");
  if (!candidate.title?.trim()) return reject(candidate, "EVIDENCE_TITLE_REQUIRED");
  if (!candidate.status) return reject(candidate, "EVIDENCE_STATUS_REQUIRED");
  if (!candidate.evidenceStrength) return reject(candidate, "EVIDENCE_STRENGTH_REQUIRED");
  if (candidate.contentHash !== null && candidate.contentHash !== "" && !/^[a-f0-9]{64}$/i.test(candidate.contentHash)) {
    return reject(candidate, "EVIDENCE_HASH_INVALID");
  }

  const evidence = await recordOfficialEvidence({
    organizationId: context.organizationId,
    operationId: context.operationId,
    documentType: candidate.documentType as OfficialEvidenceDocument["documentType"],
    title: candidate.title,
    source: candidate.acquisitionResultRef.source,
    sourceUrl: candidate.officialSourceUrl,
    downloadUrl: candidate.downloadUrl ?? "",
    documentIdentifier: candidate.documentIdentifier ?? "",
    reference: candidate.reference ?? "",
    publishedAt: candidate.publishedAt ?? "",
    page: candidate.page ?? null,
    hash: candidate.contentHash ?? "",
    contentFingerprint: candidate.contentFingerprint ?? "",
    status: candidate.status,
    evidenceStrength: candidate.evidenceStrength,
    notes: candidate.notes ?? "",
    sourceProvenance: {
      provider: candidate.acquisitionResultRef.provider,
      sourceId: candidate.acquisitionResultRef.sourceId,
      route: candidate.acquisitionResultRef.route,
    },
    idempotencyKey: deterministicIdempotencyKey(candidate),
  }, context.client);
  return { status: "PERSISTED", evidence };
}

