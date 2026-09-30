export const sourceResultStatuses = [
  "SUCCESS",
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
  "RATE_LIMITED",
  "INVALID_QUERY",
  "NOT_APPLICABLE",
  "NOT_ATTEMPTED",
  "NOT_CONFIGURED",
  "INVALID_RESULT",
] as const;

export type SourceResultStatus = (typeof sourceResultStatuses)[number];

export const sourceResultCategories = [
  "TRANSPORT_FAILURE",
  "HTTP_FAILURE",
  "APPLICATION_RESULT",
  "ACCESS_ASSISTED",
  "CONFIGURATION",
  "INPUT_VALIDATION",
] as const;

export type SourceResultCategory = (typeof sourceResultCategories)[number];

export type CanonicalSourceResult = {
  provider: string | null;
  source: string | null;
  sourceId: string | null;
  route: string | null;
  queryIdentifier: string | null;
  status: SourceResultStatus;
  category: SourceResultCategory;
  requestAttempted: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  httpStatus: number | null;
  officialUrl: string | null;
  resultCount: number | null;
  errorCategory: string | null;
  errorMessage: string | null;
  legacyStatus: string | null;
};

export type SourceCoveragePolicy = {
  policyId: string;
  requiredSourceIds: readonly string[];
};

export type CoverageState =
  | "INSUFFICIENT_COVERAGE"
  | "PARTIAL_COVERAGE"
  | "SUFFICIENT_COVERAGE";

export type CoverageBlocker = {
  code: string;
  sourceId: string | null;
  status: SourceResultStatus | null;
  message: string;
};

export type CoverageSourceSummary = {
  sourceId: string;
  source: string;
  providers: string[];
  routes: string[];
  statuses: SourceResultStatus[];
  queryAttempted: boolean;
  usefulResult: boolean;
  completedWithoutResult: boolean;
  requiresManualAction: boolean;
  unavailable: boolean;
};

export type CoverageAssessment = {
  state: CoverageState;
  policyId: string | null;
  requiredSourceIds: string[];
  evaluatedIndependentSourceIds: string[];
  qualifyingIndependentSourceIds: string[];
  sourcesWithUsefulResults: string[];
  sourcesWithNoResult: string[];
  sourcesUnavailable: string[];
  sourcesRequiringManualAction: string[];
  missingRequiredSourceIds: string[];
  sources: CoverageSourceSummary[];
  blockers: CoverageBlocker[];
  rationale: string[];
};

export type SourceIdentity = {
  provider?: string | null;
  source?: string | null;
  sourceId?: string | null;
  route?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const legacyStatusMap: Record<string, SourceResultStatus> = {
  SUCCESS: "SUCCESS",
  FOUND: "SUCCESS",
  PROCESS_FOUND: "SUCCESS",
  NO_PUBLIC_PARTY_DATA: "SUCCESS",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
  EMPTY: "EMPTY_RESPONSE",
  NO_RESULT: "NO_RESULT",
  NO_RESULTS: "NO_RESULT",
  PROCESS_NOT_FOUND: "NO_RESULT",
  TIMEOUT: "TIMEOUT",
  TRANSPORT_FAILURE: "TRANSPORT_FAILURE",
  SOURCE_UNAVAILABLE: "SOURCE_UNAVAILABLE",
  UNAVAILABLE: "SOURCE_UNAVAILABLE",
  ERROR: "INVALID_RESULT",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  RESEARCH_AUTHORIZATION_REQUIRED: "AUTH_REQUIRED",
  DATAJUD_USE_NOT_AUTHORIZED: "AUTH_REQUIRED",
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",
  SOURCE_BLOCKED_CAPTCHA: "CAPTCHA_REQUIRED",
  MANUAL_REQUIRED: "MANUAL_REQUIRED",
  HTTP_ERROR: "HTTP_ERROR",
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",
  SOURCE_BLOCKED: "HTTP_ERROR",
  INVALID_RESPONSE: "INVALID_RESULT",
  CONFIGURATION_MISSING: "NOT_CONFIGURED",
  CONFIGURATION_INVALID: "NOT_CONFIGURED",
  DATAJUD_KEY_NOT_CONFIGURED: "NOT_CONFIGURED",
  DAILY_BUDGET_EXHAUSTED: "NOT_CONFIGURED",
  NOT_IMPLEMENTED: "NOT_CONFIGURED",
  NETWORK_ERROR: "NETWORK_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_QUERY: "INVALID_QUERY",
  INVALID_IDENTIFIER: "INVALID_QUERY",
  INVALID_CNJ_NUMBER: "INVALID_QUERY",
  UNSUPPORTED_QUERY: "INVALID_QUERY",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  NOT_ATTEMPTED: "NOT_ATTEMPTED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
};

const completedStatuses = new Set<SourceResultStatus>([
  "SUCCESS",
  "EMPTY_RESPONSE",
  "NO_RESULT",
]);

const unavailableStatuses = new Set<SourceResultStatus>([
  "TIMEOUT",
  "TRANSPORT_FAILURE",
  "SOURCE_UNAVAILABLE",
  "AUTH_REQUIRED",
  "HTTP_ERROR",
  "ENDPOINT_NOT_FOUND",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "NOT_CONFIGURED",
  "INVALID_RESULT",
]);

const manualStatuses = new Set<SourceResultStatus>([
  "CAPTCHA_REQUIRED",
  "MANUAL_REQUIRED",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function cleanHttpStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function cleanDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function sanitizeErrorMessage(value: unknown): string | null {
  const message = cleanText(value);
  if (!message) return null;
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|authorization|cookie|set-cookie|token)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF REDIGIDO]")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[CNPJ REDIGIDO]")
    .slice(0, 500);
}

function statusFromHttp(httpStatus: number | null): SourceResultStatus | null {
  if (httpStatus === null) return null;
  if (httpStatus === 204) return "EMPTY_RESPONSE";
  if (httpStatus === 401) return "AUTH_REQUIRED";
  if (httpStatus === 404) return "ENDPOINT_NOT_FOUND";
  if (httpStatus === 429) return "RATE_LIMITED";
  if (httpStatus === 408) return "TIMEOUT";
  if (httpStatus >= 400) return "HTTP_ERROR";
  return null;
}

function isEmptyBody(value: unknown): boolean {
  if (value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (!isRecord(value)) return false;
  const hits = value.hits;
  if (Array.isArray(hits)) return hits.length === 0;
  if (isRecord(hits) && Array.isArray(hits.hits)) return hits.hits.length === 0;
  return false;
}

function statusCategory(status: SourceResultStatus): SourceResultCategory {
  if (status === "SUCCESS" || status === "EMPTY_RESPONSE" || status === "NO_RESULT") {
    return "APPLICATION_RESULT";
  }
  if (manualStatuses.has(status)) return "ACCESS_ASSISTED";
  if (status === "TIMEOUT" || status === "HTTP_ERROR" || status === "ENDPOINT_NOT_FOUND" || status === "AUTH_REQUIRED" || status === "RATE_LIMITED") {
    return "HTTP_FAILURE";
  }
  if (status === "TRANSPORT_FAILURE" || status === "SOURCE_UNAVAILABLE" || status === "NETWORK_ERROR") {
    return "TRANSPORT_FAILURE";
  }
  if (status === "INVALID_QUERY") return "INPUT_VALIDATION";
  return "CONFIGURATION";
}

function errorCategoryFromStatus(status: SourceResultStatus): string | null {
  if (status === "TIMEOUT") return "TIMEOUT";
  if (status === "TRANSPORT_FAILURE" || status === "NETWORK_ERROR") return "TRANSPORT";
  if (status === "SOURCE_UNAVAILABLE") return "SOURCE_UNAVAILABLE";
  if (status === "AUTH_REQUIRED") return "AUTHENTICATION";
  if (status === "CAPTCHA_REQUIRED" || status === "MANUAL_REQUIRED") return "ASSISTED_ACCESS";
  if (status === "HTTP_ERROR" || status === "ENDPOINT_NOT_FOUND" || status === "RATE_LIMITED") return "HTTP";
  if (status === "NOT_CONFIGURED") return "CONFIGURATION";
  if (status === "INVALID_QUERY" || status === "INVALID_RESULT") return "VALIDATION";
  return null;
}

function normalizeStatus(input: UnknownRecord, httpStatus: number | null, resultCount: number | null): SourceResultStatus {
  const rawStatus = cleanText(input.status)?.toUpperCase() ?? "";
  const errorCategory = cleanText(input.errorCategory) ?? cleanText(isRecord(input.error) ? input.error.category : null);
  const directStatus = legacyStatusMap[rawStatus];

  if (errorCategory === "PARSER") return "SOURCE_UNAVAILABLE";
  if (httpStatus === 401) return "AUTH_REQUIRED";
  if (httpStatus === 404) return "ENDPOINT_NOT_FOUND";
  if (httpStatus === 429) return "RATE_LIMITED";
  if (httpStatus === 408) return "TIMEOUT";
  if (httpStatus !== null && httpStatus >= 400) {
    if (directStatus === "CAPTCHA_REQUIRED" || directStatus === "AUTH_REQUIRED") return directStatus;
    return "HTTP_ERROR";
  }
  if (directStatus) {
    if (directStatus === "SUCCESS" && resultCount === 0) return "EMPTY_RESPONSE";
    return directStatus;
  }
  if (httpStatus === 204 || (httpStatus !== null && httpStatus >= 200 && httpStatus < 300 && (
    isEmptyBody(input.body) || isEmptyBody(input.bodyText) || isEmptyBody(input.responseBody) ||
    isEmptyBody(input.jsonBody) || resultCount === 0
  ))) return "EMPTY_RESPONSE";
  if (input.requestAttempted === false) return "NOT_ATTEMPTED";
  return "INVALID_RESULT";
}

export function canonicalizeSourceResult(input: unknown, identity: SourceIdentity = {}): CanonicalSourceResult {
  const raw = isRecord(input) ? input : {};
  const rawError = isRecord(raw.error) ? raw.error : {};
  const httpStatus = cleanHttpStatus(raw.httpStatus);
  const resultCount = cleanCount(raw.resultCount) ?? cleanCount(raw.count);
  const status = isRecord(input)
    ? normalizeStatus(raw, httpStatus, resultCount)
    : "INVALID_RESULT";

  return {
    provider: cleanText(raw.provider) ?? cleanText(identity.provider),
    source: cleanText(raw.underlyingSource) ?? cleanText(raw.sourceName) ??
      (cleanText(raw.sourceId) && cleanText(raw.route) ? cleanText(raw.source) : null) ?? cleanText(identity.source),
    sourceId: cleanText(raw.sourceId) ?? cleanText(identity.sourceId),
    route: cleanText(raw.route) ?? cleanText(identity.route),
    queryIdentifier: cleanText(raw.queryIdentifier) ?? cleanText(raw.originalIdentifier) ?? cleanText(raw.queryId) ?? cleanText(isRecord(raw.query) ? raw.query.processNumber : null),
    status,
    category: statusCategory(status),
    requestAttempted: raw.requestAttempted === true,
    startedAt: cleanText(raw.startedAt),
    finishedAt: cleanText(raw.finishedAt) ?? cleanText(raw.queriedAt),
    durationMs: cleanDuration(raw.durationMs) ?? cleanDuration(raw.latencyMs),
    httpStatus,
    officialUrl: cleanText(raw.officialUrl) ?? cleanText(raw.endpoint) ?? cleanText(raw.sourceUrl),
    resultCount,
    errorCategory: cleanText(raw.errorCategory) ?? errorCategoryFromStatus(status),
    errorMessage: sanitizeErrorMessage(raw.errorMessage) ?? sanitizeErrorMessage(raw.failureReason) ?? sanitizeErrorMessage(rawError.message),
    legacyStatus: cleanText(raw.status),
  };
}

export function evaluateSourceCoverage(
  sourceResults: readonly unknown[],
  policy: SourceCoveragePolicy | null | undefined,
): CoverageAssessment {
  const blockers: CoverageBlocker[] = [];
  const rationale: string[] = [];
  const attempts = sourceResults.map((result) => canonicalizeSourceResult(result));
  const groups = new Map<string, CanonicalSourceResult[]>();

  for (const attempt of attempts) {
    if (!attempt.provider || !attempt.source || !attempt.sourceId || !attempt.route || !attempt.queryIdentifier) {
      blockers.push({
        code: "SOURCE_IDENTITY_INCOMPLETE",
        sourceId: attempt.sourceId,
        status: attempt.status,
        message: "Resultado ignorado para cobertura: provider, source, sourceId, route e queryIdentifier são necessários.",
      });
      continue;
    }
    const key = attempt.sourceId.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), attempt]);
  }

  const rawRequiredIds = policy && Array.isArray(policy.requiredSourceIds)
    ? policy.requiredSourceIds
    : [];
  const requiredSourceIds = [...new Set(rawRequiredIds
    .filter((sourceId): sourceId is string => typeof sourceId === "string" && Boolean(sourceId.trim()))
    .map((sourceId) => sourceId.trim().toLowerCase()))];

  if (!policy || !cleanText(policy.policyId) || requiredSourceIds.length === 0) {
    blockers.push({
      code: "EXPLICIT_COVERAGE_POLICY_REQUIRED",
      sourceId: null,
      status: null,
      message: "Sem uma policy explícita com sourceIds obrigatórios, cobertura permanece insuficiente.",
    });
  }

  const sources = [...groups.entries()].map(([sourceId, sourceAttempts]) => {
    const attempted = sourceAttempts.filter((attempt) => attempt.requestAttempted);
    const statuses = [...new Set(sourceAttempts.map((attempt) => attempt.status))];
    const usefulResult = attempted.some((attempt) => attempt.status === "SUCCESS");
    const completedWithoutResult = !usefulResult && attempted.some((attempt) => attempt.status === "EMPTY_RESPONSE" || attempt.status === "NO_RESULT");
    const requiresManualAction = sourceAttempts.some((attempt) => manualStatuses.has(attempt.status));
    const unavailable = sourceAttempts.some((attempt) => unavailableStatuses.has(attempt.status));

    return {
      sourceId,
      source: sourceAttempts[0].source ?? sourceId,
      providers: [...new Set(sourceAttempts.map((attempt) => attempt.provider).filter((provider): provider is string => Boolean(provider)))],
      routes: [...new Set(sourceAttempts.map((attempt) => attempt.route).filter((route): route is string => Boolean(route)))],
      statuses,
      queryAttempted: attempted.length > 0,
      usefulResult,
      completedWithoutResult,
      requiresManualAction,
      unavailable,
    } satisfies CoverageSourceSummary;
  });

  const coveredSourceIds = sources
    .filter((source) => source.queryAttempted && (source.usefulResult || source.completedWithoutResult))
    .map((source) => source.sourceId);
  const covered = new Set(coveredSourceIds);
  const missingRequiredSourceIds = requiredSourceIds.filter((sourceId) => !covered.has(sourceId));

  for (const sourceId of missingRequiredSourceIds) {
    const source = sources.find((item) => item.sourceId === sourceId);
    const code = !source
      ? "REQUIRED_SOURCE_NOT_ATTEMPTED"
      : source.requiresManualAction
        ? "SOURCE_REQUIRES_MANUAL_ACTION"
        : source.unavailable
          ? "SOURCE_UNAVAILABLE_OR_FAILED"
          : "SOURCE_HAS_NO_CONCLUSIVE_ATTEMPT";
    blockers.push({
      code,
      sourceId,
      status: source?.statuses.at(-1) ?? null,
      message: source
        ? `A fonte obrigatória '${sourceId}' não possui uma consulta concluída e conclusiva.`
        : `A fonte obrigatória '${sourceId}' não foi consultada.`,
    });
  }

  let state: CoverageState = "INSUFFICIENT_COVERAGE";
  if (requiredSourceIds.length > 0 && missingRequiredSourceIds.length === 0) {
    state = "SUFFICIENT_COVERAGE";
    rationale.push("Todas as sourceIds explicitamente exigidas pela policy tiveram uma consulta concluída.");
  } else if (coveredRequiredCount(requiredSourceIds, covered) > 0) {
    state = "PARTIAL_COVERAGE";
    rationale.push("Parte das sourceIds exigidas foi consultada conclusivamente; há fontes obrigatórias sem cobertura.");
  } else {
    rationale.push("Nenhuma policy/source obrigatória foi coberta por resultado conclusivo; cobertura insuficiente.");
  }

  if (sources.some((source) => source.completedWithoutResult)) {
    rationale.push("Resultados vazios/sem correspondência contam apenas como resultado daquela sourceId; não demonstram inexistência global.");
  }
  if (sources.some((source) => source.requiresManualAction)) {
    rationale.push("Há sourceIds que requerem intervenção humana.");
  }
  if (sources.some((source) => source.unavailable)) {
    rationale.push("Há falhas de transporte, HTTP, configuração ou execução registradas por sourceId.");
  }

  return {
    state,
    policyId: cleanText(policy?.policyId),
    requiredSourceIds,
    evaluatedIndependentSourceIds: sources.map((source) => source.sourceId),
    qualifyingIndependentSourceIds: coveredSourceIds,
    sourcesWithUsefulResults: sources.filter((source) => source.usefulResult).map((source) => source.sourceId),
    sourcesWithNoResult: sources.filter((source) => source.completedWithoutResult).map((source) => source.sourceId),
    sourcesUnavailable: sources.filter((source) => source.unavailable).map((source) => source.sourceId),
    sourcesRequiringManualAction: sources.filter((source) => source.requiresManualAction).map((source) => source.sourceId),
    missingRequiredSourceIds,
    sources,
    blockers,
    rationale,
  };
}

function coveredRequiredCount(requiredSourceIds: string[], covered: Set<string>) {
  return requiredSourceIds.filter((sourceId) => covered.has(sourceId)).length;
}