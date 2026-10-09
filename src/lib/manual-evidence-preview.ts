import { type Client } from "@libsql/client";
import { resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult } from "./research-pipeline";
import { listOfficialEvidence } from "./autonomous-acquisition";
import type { SubmitManualEvidenceInput } from "./manual-research";

export async function previewManualEvidence(
  input: SubmitManualEvidenceInput,
  client: Client
): Promise<{ isDuplicate: boolean; duplicateOf: string | null }> {
  const acquisitionResult: SourceAcquisitionResult = {
    provider: "ANALYST_ASSISTED",
    source: input.source,
    sourceId: input.source,
    route: "MANUAL",
    requestedIdentifier: input.depre,
    normalizedIdentifier: input.depre,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    status: "SUCCESS",
    requestAttempted: true,
    httpStatus: 200,
    sourceUrl: input.officialUrl ?? null,
    officialSourceUrl: input.officialUrl ?? null,
    errorCode: null,
    errorMessage: null,
    rawPayload: {
      source: input.source,
      documentIdentifier: input.documentIdentifier,
      officialUrl: input.officialUrl,
      preview: true,
    },
    metadata: {
      documentType: input.documentType ?? "OFFICIAL_RECORD",
      evidenceStrength: input.evidenceStrength ?? "MEDIUM",
      qualificationStatus: input.qualificationStatus ?? "COLLECTED",
    },
    canonicalResult: {
      provider: "ANALYST_ASSISTED",
      source: input.source,
      sourceId: input.source,
      route: "MANUAL",
      queryIdentifier: input.depre,
      status: "SUCCESS",
      category: "APPLICATION_RESULT",
      requestAttempted: true,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      httpStatus: 200,
      officialUrl: input.officialUrl ?? null,
      resultCount: 1,
      errorCategory: null,
      errorMessage: null,
      legacyStatus: "SUCCESS",
    },
    documentaryCandidates: [
      {
        documentType: input.documentType ?? "OFFICIAL_RECORD",
        documentIdentifier: input.documentIdentifier,
        reference: input.documentReference,
        officialSourceUrl: input.officialUrl,
        title: `${input.source} — ${input.documentReference}`,
        status: input.qualificationStatus ?? "COLLECTED",
        evidenceStrength: input.evidenceStrength ?? "MEDIUM",
        notes: `Preview: ${input.evidenceNotes}`,
      },
    ],
  };

  const existing = await listOfficialEvidence(input.operationId, input.organizationId, client);
  const resolved = resolveEvidenceCandidatesForAcquisition(acquisitionResult, existing);

  if (resolved.length > 0 && resolved[0].evidenceId) {
    return { isDuplicate: true, duplicateOf: resolved[0].evidenceId };
  }
  
  return { isDuplicate: false, duplicateOf: null };
}
