import {
  djenAdapter,
  esajAdapter,
  isValidCnjProcessNumber,
  type DjenLookupResult,
  type SourceLookupResult,
} from "./acquisition-sources";
import {
  DataJudTJSPAdapter,
  type OfficialProcessRoute,
  type OfficialProcessSearchRequest,
  type OfficialProcessSearchResult,
} from "./datajud-tjsp-experimental";
import { TjspJuscraperAdapter } from "./tjsp-juscraper-adapter";

const TJSP_CAC_SEARCH_URL = "https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx";

function skippedResult(route: OfficialProcessRoute, request: OfficialProcessSearchRequest): OfficialProcessSearchResult {
  return {
    ok: false,
    source: route.source,
    status: "NOT_APPLICABLE",
    requestAttempted: false,
    httpStatus: null,
    durationMs: 0,
    query: { ...request },
    error: { code: "ROUTE_NOT_APPLICABLE", message: "A rota não suporta os identificadores fornecidos." },
  };
}

function routeFailure(route: OfficialProcessRoute, request: OfficialProcessSearchRequest, error: unknown): OfficialProcessSearchResult {
  const message = error instanceof Error ? error.message.slice(0, 240) : "Falha não identificada na rota oficial.";
  return {
    ok: false,
    source: route.source,
    status: "UNAVAILABLE",
    requestAttempted: false,
    httpStatus: null,
    durationMs: 0,
    query: { ...request },
    error: { code: "ROUTE_ERROR", message },
  };
}

export class OfficialProcessSourceCollector {
  constructor(private readonly routes: readonly OfficialProcessRoute[]) {}

  async search(request: OfficialProcessSearchRequest): Promise<OfficialProcessSearchResult[]> {
    return Promise.allSettled(this.routes.map(async (route) => {
      try {
        if (!route.supports(request)) return skippedResult(route, request);
        return await route.search(request);
      } catch (error) {
        return routeFailure(route, request, error);
      }
    })).then((results) => results.map((result) => result.status === "fulfilled" ? result.value : {
      ok: false,
      source: "TJSP_DIRECT",
      status: "UNAVAILABLE",
      requestAttempted: false,
      httpStatus: null,
      durationMs: 0,
      query: { ...request },
      error: { code: "ROUTE_REJECTED", message: result.reason instanceof Error ? result.reason.message : "Rota rejeitada sem erro declarativo." },
    }));
  }
}

function hasProcessNumber(request: OfficialProcessSearchRequest) {
  return Boolean(request.processNumber?.trim()) && !request.partyName?.trim() && !request.documentNumber?.trim() && isValidCnjProcessNumber(request.processNumber!);
}

function fromDjen(request: OfficialProcessSearchRequest, result: DjenLookupResult): OfficialProcessSearchResult {
  const ok = result.status === "FOUND" || result.status === "NO_RESULT";
  return {
    ok,
    source: "DJEN",
    status: result.status,
    requestAttempted: result.requestAttempted,
    httpStatus: result.httpStatus,
    durationMs: result.latencyMs,
    endpoint: result.sourceUrl,
    query: { ...request },
    headers: {
      rateLimitLimit: result.rateLimitLimit === null ? null : String(result.rateLimitLimit),
      rateLimitRemaining: result.rateLimitRemaining === null ? null : String(result.rateLimitRemaining),
    },
    rawPayload: result,
    error: ok ? undefined : { code: result.status, message: result.failureReason || "A consulta DJEN não foi concluída." },
  };
}

function fromEsaj(request: OfficialProcessSearchRequest, result: SourceLookupResult): OfficialProcessSearchResult {
  return {
    ok: false,
    source: "TJSP_ESAJ",
    status: result.status,
    requestAttempted: result.requestAttempted,
    httpStatus: result.httpStatus,
    durationMs: result.latencyMs,
    endpoint: result.sourceUrl,
    query: { ...request },
    rawPayload: result,
    error: { code: result.status, message: result.failureReason || "Consulta automatizada indisponível; requer ação assistida." },
  };
}

export function createResearchOfficialProcessRoutes(dataJud = new DataJudTJSPAdapter()): OfficialProcessRoute[] {
  return [
    new TjspJuscraperAdapter(),
    dataJud,
    {
      source: "DJEN",
      supports: hasProcessNumber,
      async search(request) {
        return fromDjen(request, await djenAdapter.lookup({ processNumber: request.processNumber! }));
      },
    },
    {
      source: "TJSP_ESAJ",
      supports: hasProcessNumber,
      async search(request) {
        return fromEsaj(request, await esajAdapter.lookup({ processNumber: request.processNumber! }));
      },
    },
    {
      source: "TJSP_DEPRE_CAC",
      supports(request) {
        return hasProcessNumber(request);
      },
      async search(request) {
        return {
          ok: false,
          source: "TJSP_DEPRE_CAC",
          status: "CAPTCHA_REQUIRED",
          requestAttempted: false,
          httpStatus: null,
          durationMs: 0,
          endpoint: TJSP_CAC_SEARCH_URL,
          query: { ...request },
          error: { code: "ASSISTED_SOURCE_REQUIRED", message: "A consulta CAC do TJSP requer pesquisa assistida; nenhuma requisição ou CAPTCHA foi executado." },
        };
      },
    },
  ];
}