import { type Client } from "@libsql/client";
import { buildEvidenceCandidates, resolveEvidenceCandidatesForAcquisition } from "./research-pipeline";
import { listOfficialEvidence } from "./autonomous-acquisition";
import type { SubmitManualEvidenceInput } from "./manual-research";

export async function previewManualEvidence(
  input: SubmitManualEvidenceInput,
  client: Client
): Promise<{ isDuplicate: boolean; duplicateOf: string | null }> {
  // Create candidate
  const acquisitionResult = {
    provider: "ANALYST_ASSISTED",
    sourceId: input.source,
    route: "MANUAL",
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
    canonicalResult: { status: "SUCCESS" },
  } as any;

  const existing = await listOfficialEvidence(input.operationId, input.organizationId, client);
  const resolved = resolveEvidenceCandidatesForAcquisition(acquisitionResult, existing);

  if (resolved.length > 0 && resolved[0].evidenceId) {
    return { isDuplicate: true, duplicateOf: resolved[0].evidenceId };
  }
  
  return { isDuplicate: false, duplicateOf: null };
}
