import { describe, expect, it } from "vitest";
import { canonicalizeSourceResult, evaluateSourceCoverage } from "./source-coverage";

const depre = "0196151-64.2018.8.26.0500";

function attempt(input: Record<string, unknown> = {}) {
  return {
    provider: "JUSCRAPER",
    source: "TJSP",
    sourceId: "tjsp-processual",
    route: "cpopg",
    queryIdentifier: depre,
    status: "EMPTY_RESPONSE",
    requestAttempted: true,
    ...input,
  };
}

function policy(requiredSourceIds: string[]) {
  return { policyId: "pilot-v1", requiredSourceIds };
}

describe("canonical source results", () => {
  it("normalizes explicit result families without treating them as global case states", () => {
    expect(canonicalizeSourceResult(attempt({ status: "PROCESS_NOT_FOUND" })).status).toBe("NO_RESULT");
    expect(canonicalizeSourceResult(attempt({ status: "NO_RESULTS" })).status).toBe("NO_RESULT");
    expect(canonicalizeSourceResult(attempt({ status: "TIMEOUT" })).status).toBe("TIMEOUT");
    expect(canonicalizeSourceResult(attempt({ status: "TRANSPORT_FAILURE" })).status).toBe("TRANSPORT_FAILURE");
    expect(canonicalizeSourceResult(attempt({ status: "SOURCE_UNAVAILABLE" })).status).toBe("SOURCE_UNAVAILABLE");
    expect(canonicalizeSourceResult(attempt({ status: "MANUAL_REQUIRED" })).status).toBe("MANUAL_REQUIRED");
    expect(canonicalizeSourceResult(attempt({ status: "CAPTCHA_REQUIRED" })).status).toBe("CAPTCHA_REQUIRED");
  });

  it("normalizes HTTP response codes before assigning coverage meaning", () => {
    expect(canonicalizeSourceResult(attempt({ status: undefined, httpStatus: 200, bodyText: "" })).status).toBe("EMPTY_RESPONSE");
    expect(canonicalizeSourceResult(attempt({ status: undefined, httpStatus: 200, jsonBody: [] })).status).toBe("EMPTY_RESPONSE");
    expect(canonicalizeSourceResult(attempt({ status: undefined, httpStatus: 204 })).status).toBe("EMPTY_RESPONSE");
    expect(canonicalizeSourceResult(attempt({ httpStatus: 401 })).status).toBe("AUTH_REQUIRED");
    expect(canonicalizeSourceResult(attempt({ httpStatus: 403 })).status).toBe("HTTP_ERROR");
    expect(canonicalizeSourceResult(attempt({ httpStatus: 404 })).status).toBe("ENDPOINT_NOT_FOUND");
    expect(canonicalizeSourceResult(attempt({ httpStatus: 429 })).status).toBe("RATE_LIMITED");
    expect(canonicalizeSourceResult(attempt({ httpStatus: 500 })).status).toBe("HTTP_ERROR");
  });

  it("preserves parser errors after HTTP 200 as failures instead of empty results", () => {
    const result = canonicalizeSourceResult(attempt({
      status: "ERROR",
      httpStatus: 200,
      errorCategory: "PARSER",
      errorMessage: "IndexError after response",
    }));

    expect(result).toMatchObject({ status: "SOURCE_UNAVAILABLE", category: "TRANSPORT_FAILURE", errorCategory: "PARSER" });
    expect(result.status).not.toBe("NO_RESULT");
  });

  it("redacts secrets and personal identifiers from persisted-safe errors", () => {
    const result = canonicalizeSourceResult(attempt({
      errorMessage: "Authorization: Bearer secret-value CPF 123.456.789-00 CNPJ 12.345.678/0001-90",
    }));

    expect(result.errorMessage).not.toContain("secret-value");
    expect(result.errorMessage).not.toContain("123.456.789-00");
    expect(result.errorMessage).not.toContain("12.345.678/0001-90");
  });
});

describe("evaluateSourceCoverage", () => {
  it("counts cpopg and cposg as one TJSP source, not two independent sources", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ route: "cpopg", status: "EMPTY_RESPONSE" }),
      attempt({ route: "cposg", status: "EMPTY_RESPONSE" }),
    ], policy(["tjsp-processual", "cnj-djen"]));

    expect(assessment.state).toBe("PARTIAL_COVERAGE");
    expect(assessment.evaluatedIndependentSourceIds).toEqual(["tjsp-processual"]);
    expect(assessment.qualifyingIndependentSourceIds).toEqual(["tjsp-processual"]);
    expect(assessment.sources).toHaveLength(1);
    expect(assessment.sources[0].routes).toEqual(["cpopg", "cposg"]);
    expect("notFoundGlobal" in assessment).toBe(false);
  });

  it("keeps DJEN NO_RESULT scoped to DJEN and cannot produce a global not-found state", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ provider: "CP-DJEN", source: "CNJ/DJEN", sourceId: "cnj-djen", route: "comunicacao", status: "NO_RESULT" }),
    ], policy(["cnj-djen", "cnj-datajud"]));

    expect(assessment.state).toBe("PARTIAL_COVERAGE");
    expect(assessment.sourcesWithNoResult).toEqual(["cnj-djen"]);
    expect(assessment.missingRequiredSourceIds).toEqual(["cnj-datajud"]);
    expect(JSON.stringify(assessment)).not.toContain("NOT_FOUND_GLOBAL");
  });

  it("records a DataJud timeout as unavailable and insufficient, not a missing process", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ provider: "CP-DATAJUD", source: "CNJ/DataJud", sourceId: "cnj-datajud", route: "api_publica_tjsp/_search", status: "TIMEOUT", httpStatus: null }),
    ], policy(["cnj-datajud"]));

    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.sourcesUnavailable).toEqual(["cnj-datajud"]);
    expect(assessment.qualifyingIndependentSourceIds).toEqual([]);
  });

  it("classifies MCP transport failure as unavailable even if a wrapper could emit empty text", () => {
    const result = canonicalizeSourceResult(attempt({
      provider: "MCP-Brasil",
      source: "Querido Diário",
      sourceId: "querido-diario",
      route: "buscar_diarios",
      status: "TRANSPORT_FAILURE",
      requestAttempted: true,
      errorCategory: "ConnectError",
      errorMessage: "TLS handshake failed",
    }));
    const assessment = evaluateSourceCoverage([result], policy(["querido-diario"]));

    expect(result).toMatchObject({ status: "TRANSPORT_FAILURE", category: "TRANSPORT_FAILURE" });
    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.sourcesUnavailable).toEqual(["querido-diario"]);
    expect(assessment.sourcesWithNoResult).toEqual([]);
  });

  it("treats manual and CAPTCHA routes as requiring intervention, not absence", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ provider: "CP-ESAJ", source: "TJSP/e-SAJ", sourceId: "tjsp-esaj", route: "manual", status: "MANUAL_REQUIRED", requestAttempted: false }),
      attempt({ provider: "CP-CAC", source: "TJSP/CAC", sourceId: "tjsp-cac", route: "assisted", status: "CAPTCHA_REQUIRED", requestAttempted: false }),
    ], policy(["tjsp-esaj", "tjsp-cac"]));

    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.sourcesRequiringManualAction).toEqual(["tjsp-esaj", "tjsp-cac"]);
    expect(assessment.qualifyingIndependentSourceIds).toEqual([]);
  });

  it("returns insufficient coverage when every required source is unavailable", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ sourceId: "cnj-datajud", source: "CNJ/DataJud", route: "search", status: "TIMEOUT" }),
      attempt({ sourceId: "querido-diario", source: "Querido Diário", provider: "MCP-Brasil", route: "buscar_diarios", status: "SOURCE_UNAVAILABLE" }),
    ], policy(["cnj-datajud", "querido-diario"]));

    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.sourcesUnavailable.toSorted()).toEqual(["cnj-datajud", "querido-diario"]);
  });

  it("returns partial coverage and explains a failed required source when another returns useful data", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ provider: "MCP-Brasil", source: "Querido Diário", sourceId: "querido-diario", route: "buscar_diarios", status: "SUCCESS", resultCount: 1 }),
      attempt({ provider: "CNJ", source: "CNJ/DataJud", sourceId: "cnj-datajud", route: "search", status: "TIMEOUT" }),
    ], policy(["querido-diario", "cnj-datajud"]));

    expect(assessment.state).toBe("PARTIAL_COVERAGE");
    expect(assessment.sourcesWithUsefulResults).toEqual(["querido-diario"]);
    expect(assessment.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "cnj-datajud", code: "SOURCE_UNAVAILABLE_OR_FAILED" }),
    ]));
    expect(assessment.rationale.join(" ")).toContain("sourceIds exigidas");
  });

  it("requires an explicit source policy and reports malformed/null results without credit", () => {
    const assessment = evaluateSourceCoverage([
      null,
      { ...attempt(), provider: "" },
      { ...attempt(), sourceId: "" },
      { ...attempt(), route: "" },
      { ...attempt(), source: "" },
      { ...attempt(), status: "UNRECOGNIZED_STATUS" },
    ], null);

    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.blockers.map((blocker) => blocker.code)).toContain("EXPLICIT_COVERAGE_POLICY_REQUIRED");
    expect(assessment.blockers.filter((blocker) => blocker.code === "SOURCE_IDENTITY_INCOMPLETE")).toHaveLength(5);
    expect(assessment.qualifyingIndependentSourceIds).toEqual([]);
  });

  it("does not count a declared result if the request was never attempted", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ status: "NO_RESULT", requestAttempted: false }),
    ], policy(["tjsp-processual"]));

    expect(assessment.state).toBe("INSUFFICIENT_COVERAGE");
    expect(assessment.qualifyingIndependentSourceIds).toEqual([]);
  });

  it("keeps two providers that query the same source in one independent-source group", () => {
    const assessment = evaluateSourceCoverage([
      attempt({ provider: "MCP-Brasil", sourceId: "querido-diario", source: "Querido Diário", route: "buscar_diarios", status: "NO_RESULT" }),
      attempt({ provider: "CP-direct", sourceId: "querido-diario", source: "Querido Diário", route: "api", status: "EMPTY_RESPONSE" }),
    ], policy(["querido-diario", "tjsp-processual"]));

    expect(assessment.evaluatedIndependentSourceIds).toEqual(["querido-diario"]);
    expect(assessment.sources[0].providers).toEqual(["MCP-Brasil", "CP-direct"]);
    expect(assessment.state).toBe("PARTIAL_COVERAGE");
  });
});