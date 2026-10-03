import { describe, expect, it } from "vitest";
import { buildEvidenceCandidates, evaluateAcquisitionCoverage, type SourceAcquisitionResult } from "./research-pipeline";

const validCnj = "70060507820008260500";

function result(overrides: Partial<SourceAcquisitionResult> = {}): SourceAcquisitionResult {
  return {
    provider: "TJSP",
    source: "TJSP",
    sourceId: "tjsp-processual",
    route: "cpopg",
    requestedIdentifier: validCnj,
    normalizedIdentifier: null,
    startedAt: "2026-10-03T12:00:00.000Z",
    completedAt: "2026-10-03T12:00:01.000Z",
    durationMs: 1000,
    status: "SUCCESS",
    requestAttempted: true,
    httpStatus: 200,
    sourceUrl: "https://www.tjsp.jus.br/cpopg",
    officialSourceUrl: "https://www.tjsp.jus.br/documentos/oficio-1?b=2&a=1",
    errorCode: null,
    errorMessage: null,
    rawPayload: { result: "original" },
    metadata: {
      evidenceCandidates: [{
        documentType: "OFICIO_REQUISITORIO",
        documentIdentifier: "  Ofício   001 ",
        reference: "REF-001",
        officialSourceUrl: "https://www.tjsp.jus.br/documentos/oficio-1?b=2&a=1",
        contentHash: "a".repeat(64),
        contentFingerprint: "fingerprint-001",
        rawPayload: { document: "original-document" },
      }],
    },
    ...overrides,
  };
}

describe("buildEvidenceCandidates", () => {
  it("builds a deterministic candidate from explicit successful official-source metadata", () => {
    const [candidate] = buildEvidenceCandidates(result());

    expect(candidate).toMatchObject({
      acquisitionResultRef: {
        provider: "TJSP",
        source: "TJSP",
        sourceId: "tjsp-processual",
        route: "cpopg",
        sourceUrl: "https://www.tjsp.jus.br/cpopg",
        requestedIdentifier: validCnj,
        normalizedIdentifier: validCnj,
      },
      documentType: "OFICIO_REQUISITORIO",
      documentIdentifier: "ofício 001",
      reference: "REF-001",
      officialSourceUrl: "https://www.tjsp.jus.br/documentos/oficio-1?a=1&b=2",
      contentHash: "a".repeat(64),
      contentFingerprint: "fingerprint-001",
      rawPayload: { document: "original-document" },
    });
  });

  it.each([
    "EMPTY_RESPONSE",
    "NO_RESULT",
    "TIMEOUT",
    "TRANSPORT_FAILURE",
    "SOURCE_UNAVAILABLE",
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "MANUAL_REQUIRED",
    "HTTP_ERROR",
    "ENDPOINT_NOT_FOUND",
    "NETWORK_ERROR",
  ])("does not manufacture candidates for %s", (status) => {
    expect(buildEvidenceCandidates(result({ status }))).toEqual([]);
  });

  it("does not manufacture a candidate from an HTTP 200 result without explicit evidence metadata", () => {
    expect(buildEvidenceCandidates(result({ metadata: {}, rawPayload: { body: [] } }))).toEqual([]);
  });

  it("preserves an invalid official URL as unresolved instead of making it valid", () => {
    const [candidate] = buildEvidenceCandidates(result({
      officialSourceUrl: "http://www.tjsp.jus.br/documentos/oficio-1",
      metadata: {
        evidenceCandidates: [{ documentType: "OFICIO_REQUISITORIO" }],
      },
    }));

    expect(candidate?.officialSourceUrl).toBeNull();
    expect(candidate?.acquisitionResultRef.sourceUrl).toBe("https://www.tjsp.jus.br/cpopg");
  });

  it("normalizes a DEPRE identifier while preserving its original formatting", () => {
    const depre = "0038850-88.2017.8.26.0500";
    const [candidate] = buildEvidenceCandidates(result({ requestedIdentifier: depre }));

    expect(candidate?.acquisitionResultRef).toMatchObject({
      requestedIdentifier: depre,
      normalizedIdentifier: "00388508820178260500",
    });
  });

  it("is deterministic and does not assign evidence IDs or persist anything", () => {
    const input = result();

    expect(buildEvidenceCandidates(input)).toEqual(buildEvidenceCandidates(input));
    expect(buildEvidenceCandidates(input)[0]).not.toHaveProperty("evidenceId");
  });

  it("preserves one source identity across different routes", () => {
    const first = buildEvidenceCandidates(result({ route: "cpopg" }))[0];
    const second = buildEvidenceCandidates(result({ route: "cposg" }))[0];

    expect(first?.acquisitionResultRef).toMatchObject({ source: "TJSP", sourceId: "tjsp-processual", route: "cpopg" });
    expect(second?.acquisitionResultRef).toMatchObject({ source: "TJSP", sourceId: "tjsp-processual", route: "cposg" });
  });

  it("does not infer a document identifier, reference, hash, or URL when absent", () => {
    const [candidate] = buildEvidenceCandidates(result({
      officialSourceUrl: null,
      metadata: { evidenceCandidates: [{ documentType: "OFFICIAL_RECORD" }] },
    }));

    expect(candidate).toMatchObject({
      documentIdentifier: null,
      reference: null,
      officialSourceUrl: null,
      contentHash: null,
      contentFingerprint: null,
      rawPayload: { result: "original" },
    });
  });

  it("accepts the typed documentaryCandidates boundary without metadata coupling", () => {
    const [candidate] = buildEvidenceCandidates(result({
      metadata: {},
      documentaryCandidates: [{
        documentType: "OFICIO_COMPLEMENTAR",
        documentIdentifier: "DOC-2",
        reference: "REF-2",
        officialSourceUrl: "https://www.tjsp.jus.br/documentos/2",
        rawPayload: { explicit: true },
      }],
    }));
    expect(candidate).toMatchObject({ documentType: "OFICIO_COMPLEMENTAR", documentIdentifier: "doc-2", reference: "REF-2" });
  });

  it("aggregates coverage through the canonical evaluator and preserves failure taxonomy", () => {
    const assessment = evaluateAcquisitionCoverage([
      result({ status: "EMPTY_RESPONSE", documentaryCandidates: [], canonicalResult: { provider: "TJSP", source: "TJSP", sourceId: "tjsp-processual", route: "cpopg", queryIdentifier: validCnj, status: "EMPTY_RESPONSE", category: "APPLICATION_RESULT", requestAttempted: true, startedAt: null, finishedAt: null, durationMs: null, httpStatus: 200, officialUrl: null, resultCount: 0, errorCategory: null, errorMessage: null, legacyStatus: "EMPTY_RESPONSE" } }),
      result({ route: "cposg", status: "CAPTCHA_REQUIRED", documentaryCandidates: [], canonicalResult: { provider: "TJSP", source: "TJSP", sourceId: "tjsp-processual", route: "cposg", queryIdentifier: validCnj, status: "CAPTCHA_REQUIRED", category: "ACCESS_ASSISTED", requestAttempted: true, startedAt: null, finishedAt: null, durationMs: null, httpStatus: 403, officialUrl: null, resultCount: null, errorCategory: "CAPTCHA_REQUIRED", errorMessage: "captcha", legacyStatus: "CAPTCHA_REQUIRED" } }),
    ], { policyId: "tjsp-policy", requiredSourceIds: ["tjsp-processual"] });
    expect(assessment.sourcesWithNoResult).toContain("tjsp-processual");
    expect(assessment.rationale.join(" ")).toMatch(/intervenção humana|manual|CAPTCHA/i);
    expect(assessment.state).not.toBe("NOT_FOUND_GLOBAL");
  });
});
