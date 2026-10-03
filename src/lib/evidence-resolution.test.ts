import { describe, expect, it } from "vitest";
import type { OfficialEvidenceDocument } from "./autonomous-acquisition";
import { resolveEvidenceCandidates } from "./evidence-resolver";
import {
  resolveEvidenceCandidatesForAcquisition,
  type EvidenceCandidate,
  type SourceAcquisitionResult,
} from "./research-pipeline";

function candidate(overrides: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return {
    acquisitionResultRef: {
      provider: "TJSP",
      source: "TJSP",
      sourceId: "tjsp-processual",
      route: "cpopg",
      sourceUrl: "https://www.tjsp.jus.br/cpopg",
      requestedIdentifier: "0038850-88.2017.8.26.0500",
      normalizedIdentifier: "00388508820178260500",
    },
    documentType: "OFFICIAL_RECORD",
    documentIdentifier: "doc-001",
    reference: "REF-001",
    officialSourceUrl: "https://www.tjsp.jus.br/documentos/1",
    contentHash: null,
    contentFingerprint: null,
    rawPayload: { source: "fixture" },
    ...overrides,
  };
}

function document(overrides: Partial<OfficialEvidenceDocument> = {}): OfficialEvidenceDocument {
  return {
    id: "evidence-existing-1",
    organizationId: "fixture-org",
    operationId: "fixture-operation",
    documentType: "OFFICIAL_RECORD",
    title: "Documento fixture",
    source: "TJSP",
    sourceUrl: "https://www.tjsp.jus.br/documentos/1",
    downloadUrl: "",
    documentIdentifier: "DOC-001",
    reference: "REF-001",
    publishedAt: "2026-10-03",
    collectedAt: "2026-10-03T12:00:00.000Z",
    page: null,
    hash: "",
    contentFingerprint: "",
    status: "COLLECTED",
    evidenceStrength: "MEDIUM",
    notes: "fixture isolado",
    sourceProvenance: null,
    ...overrides,
  };
}

function acquisitionResult(): SourceAcquisitionResult {
  return {
    provider: "TJSP",
    source: "TJSP",
    sourceId: "tjsp-processual",
    route: "cpopg",
    requestedIdentifier: "0038850-88.2017.8.26.0500",
    normalizedIdentifier: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    status: "SUCCESS",
    requestAttempted: true,
    httpStatus: 200,
    sourceUrl: "https://www.tjsp.jus.br/cpopg",
    officialSourceUrl: "https://www.tjsp.jus.br/documentos/1",
    errorCode: null,
    errorMessage: null,
    rawPayload: { source: "fixture" },
    metadata: {
      evidenceCandidates: [{
        documentType: "OFFICIAL_RECORD",
        documentIdentifier: "DOC-001",
        reference: "REF-001",
        officialSourceUrl: "https://www.tjsp.jus.br/documentos/1",
      }],
    },
  };
}

describe("deterministic evidence resolution", () => {
  it("connects acquisition candidates to the existing resolver without persistence", () => {
    const docs = [document()];
    const before = structuredClone(docs);

    const resolved = resolveEvidenceCandidatesForAcquisition(acquisitionResult(), docs);

    expect(resolved).toMatchObject([{ evidenceId: docs[0].id, resolutionReason: "EXACT_DOCUMENT_IDENTIFIER" }]);
    expect(docs).toEqual(before);
  });

  it("uses HASH_MATCH before all other deterministic criteria", () => {
    const hashDoc = document({ id: "hash-doc", hash: "a".repeat(64), documentIdentifier: "other" });
    const identifierDoc = document({ id: "identifier-doc", hash: "", documentIdentifier: "DOC-001" });

    const [resolved] = resolveEvidenceCandidates([candidate({ contentHash: "a".repeat(64) })], [identifierDoc, hashDoc]);

    expect(resolved).toMatchObject({ evidenceId: "hash-doc", resolutionReason: "HASH_MATCH" });
  });

  it("uses an exact normalized document identifier when no hash matches", () => {
    const [resolved] = resolveEvidenceCandidates([candidate({ contentHash: null, documentIdentifier: "  DOC-001 " })], [document({ hash: "" })]);

    expect(resolved).toMatchObject({ evidenceId: "evidence-existing-1", resolutionReason: "EXACT_DOCUMENT_IDENTIFIER" });
  });

  it("uses the preserved CNJ/DEPRE query identifier when no hash or document identifier matches", () => {
    const [resolved] = resolveEvidenceCandidates([candidate({ contentHash: null, documentIdentifier: null })], [document({ documentIdentifier: "0038850-88.2017.8.26.0500", reference: "other", sourceUrl: "https://www.tjsp.jus.br/other" })]);

    expect(resolved).toMatchObject({ evidenceId: "evidence-existing-1", resolutionReason: "EXACT_DEPRE_MATCH" });
  });

  it("uses exact source plus reference before official URL", () => {
    const sourceReferenceDoc = document({ id: "source-ref", documentIdentifier: "other", reference: "REF-001", sourceUrl: "https://www.tjsp.jus.br/other" });
    const urlDoc = document({ id: "url-doc", documentIdentifier: "other", reference: "other", sourceUrl: "https://www.tjsp.jus.br/documentos/1" });

    const [resolved] = resolveEvidenceCandidates([candidate({ contentHash: null, documentIdentifier: null })], [urlDoc, sourceReferenceDoc]);

    expect(resolved).toMatchObject({ evidenceId: "source-ref", resolutionReason: "EXACT_SOURCE_REFERENCE" });
  });

  it("uses exact official URL when higher-priority criteria do not match", () => {
    const [resolved] = resolveEvidenceCandidates([candidate({ contentHash: null, documentIdentifier: null, reference: "other" })], [document({ documentIdentifier: "different", reference: "different" })]);

    expect(resolved).toMatchObject({ evidenceId: "evidence-existing-1", resolutionReason: "EXACT_OFFICIAL_URL" });
  });

  it("returns an unresolved result without inventing an evidence ID", () => {
    const [resolved] = resolveEvidenceCandidates([candidate({ documentIdentifier: null, reference: null, officialSourceUrl: null, contentHash: null })], []);

    expect(resolved).toMatchObject({ evidenceId: null, resolutionReason: "UNRESOLVED", qualifiesForDocumentation: false });
    expect(resolved?.unresolvedReason).toContain("Nenhum critério determinístico");
  });

  it("allows only the first candidate to claim the same existing evidence", () => {
    const resolved = resolveEvidenceCandidates([candidate({ contentHash: "b".repeat(64) }), candidate({ contentHash: "b".repeat(64) })], [document({ hash: "b".repeat(64) })]);

    expect(resolved[0]).toMatchObject({ evidenceId: "evidence-existing-1", resolutionReason: "HASH_MATCH" });
    expect(resolved[1]).toMatchObject({ evidenceId: null, resolutionReason: "UNRESOLVED" });
    expect(resolved[1].unresolvedReason).toContain("Duplicata determinística");
  });

  it("keeps resolution distinct from DOCUMENTAÇÃO 2/2 qualification", () => {
    const [nonQualifying] = resolveEvidenceCandidates([candidate()], [document()]);
    const [qualifying] = resolveEvidenceCandidates([candidate()], [document({ documentType: "OFICIO_REQUISITORIO", status: "VERIFIED", evidenceStrength: "STRONG" })]);

    expect(nonQualifying).toMatchObject({ evidenceId: "evidence-existing-1", qualifiesForDocumentation: false });
    expect(qualifying).toMatchObject({ evidenceId: "evidence-existing-1", qualifiesForDocumentation: true });
  });

  it("does not match invalid candidate identifiers or mutate provenance", () => {
    const input = candidate({
      documentIdentifier: "?",
      reference: null,
      officialSourceUrl: null,
      contentHash: null,
      acquisitionResultRef: { ...candidate().acquisitionResultRef, requestedIdentifier: "invalid", normalizedIdentifier: null },
    });
    const originalProvenance = structuredClone(input.acquisitionResultRef);

    const [resolved] = resolveEvidenceCandidates([input], [document({ documentIdentifier: "different", reference: "different", sourceUrl: "https://www.tjsp.jus.br/other" })]);

    expect(resolved).toMatchObject({ evidenceId: null, resolutionReason: "UNRESOLVED", candidate: { acquisitionResultRef: originalProvenance } });
  });

  it("is deterministic for the same candidate and evidence inputs", () => {
    const candidates = [candidate()];
    const docs = [document()];

    expect(resolveEvidenceCandidates(candidates, docs)).toEqual(resolveEvidenceCandidates(candidates, docs));
  });
});
