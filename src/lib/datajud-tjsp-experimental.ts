import { isValidCnjProcessNumber, normalizeCnjProcessNumber } from "./acquisition-sources";

export type OfficialProcessSearchRequest = {
  processNumber?: string;
  partyName?: string;
  documentNumber?: string;
};

export type DataJudProcessRecord = {
  processNumber: string | null;
  tribunal: string | null;
  degree: string | null;
  judgingBody: unknown;
  class: unknown;
  subjects: unknown;
  movements: unknown;
  priority: unknown;
  electronicSystem: unknown;
  systemIdentification: unknown;
  dscSistema: unknown;
  activePole: unknown;
  passivePole: unknown;
  parties: unknown;
  identifiers: { hitId: unknown; sourceId: unknown };
};

export type DataJudNormalizedResult = {
  kind: "DATAJUD";
  total: number;
  processes: DataJudProcessRecord[];
};

export type TjspNormalizedResult = {
  kind: "TJSP_JUSCRAPER";
  processNumber: string | null;
  relatedProcessNumber: string | null;
  className: string | null;
  subject: string | null;
  forum: string | null;
  courtUnit: string | null;
  parties: unknown;
  movements: unknown;
  identifiers: Record<string, unknown>;
  officialUrl: string | null;
};

export type DataJudSearchResult = Omit<OfficialProcessSearchResult, "normalized"> & {
  normalized?: DataJudNormalizedResult;
};

export type OfficialProcessSearchResult = {
  ok: boolean;
  source: "TJSP_DIRECT" | "DATAJUD_TJSP" | "DJEN" | "TJSP_ESAJ" | "TJSP_DEPRE_CAC";
  status: string;
  requestAttempted: boolean;
  credentialSource?: "ENVIRONMENT" | "CNJ_PUBLICATION_RESEARCH_FALLBACK";
  httpStatus: number | null;
  durationMs: number;
  endpoint?: string;
  query: OfficialProcessSearchRequest;
  headers?: {
    contentType?: string | null;
    date?: string | null;
    requestId?: string | null;
    retryAfter?: string | null;
    rateLimitLimit?: string | null;
    rateLimitRemaining?: string | null;
  };
  rawPayload?: unknown;
  normalized?: DataJudNormalizedResult | TjspNormalizedResult;
  error?: { code: string; message: string };
};

export type OfficialProcessRoute = {
  source: OfficialProcessSearchResult["source"];
  supports(request: OfficialProcessSearchRequest): boolean;
  search(request: OfficialProcessSearchRequest): Promise<OfficialProcessSearchResult>;
};

export type DataJudTJSPAdapterOptions = {
  baseUrl?: string;
  apiKey?: string;
  researchAuthorized?: boolean;
  allowPublicKeyFallback?: boolean;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  credentialFetcher?: typeof fetch;
};

const DEFAULT_DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const OFFICIAL_DATAJUD_HOST = "api-publica.datajud.cnj.jus.br";
const DATAJUD_TJSP_SEARCH_PATH = "/api_publica_tjsp/_search";
const OFFICIAL_ACCESS_DOCUMENTATION_URL = "https://datajud-wiki.cnj.jus.br/api-publica/acesso/";
const DEFAULT_TIMEOUT_MS = 8_000;

function safeText(value: string, secret: string) {
  const redactedSecret = secret ? value.split(secret).join("[REDACTED]") : value;
  return redactedSecret.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF REDIGIDO]")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[CNPJ REDIGIDO]");
}

function redactPayload(value: unknown, secret: string): unknown {
  if (typeof value === "string") return safeText(value, secret);
  if (Array.isArray(value)) return value.map((item) => redactPayload(item, secret));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => {
    if (/authorization|api.?key|cpf|cnpj/i.test(key)) return [key, "[REDACTED]"];
    return [key, redactPayload(child, secret)];
  }));
}

function officialEndpoint(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.hostname !== OFFICIAL_DATAJUD_HOST || (url.port && url.port !== "443") || url.username || url.password || !["", "/"].includes(url.pathname) || url.search || url.hash) return null;
    return `${url.origin}${DATAJUD_TJSP_SEARCH_PATH}`;
  } catch {
    return null;
  }
}

function recordValue(source: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : null;
}

function normalizeHit(hit: unknown): DataJudProcessRecord | null {
  if (!hit || typeof hit !== "object") return null;
  const hitRecord = hit as Record<string, unknown>;
  const rawSource = hitRecord._source;
  if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) return null;
  const source = rawSource as Record<string, unknown>;
  const processNumber = recordValue(source, "numeroProcesso");
  const tribunal = recordValue(source, "tribunal");
  const degree = recordValue(source, "grau");
  return {
    processNumber: typeof processNumber === "string" ? processNumber : null,
    tribunal: typeof tribunal === "string" ? tribunal : null,
    degree: typeof degree === "string" ? degree : null,
    judgingBody: recordValue(source, "orgaoJulgador"),
    class: recordValue(source, "classe"),
    subjects: recordValue(source, "assuntos"),
    movements: recordValue(source, "movimentos"),
    priority: recordValue(source, "prioridade"),
    electronicSystem: recordValue(source, "formato"),
    systemIdentification: recordValue(source, "sistema"),
    dscSistema: recordValue(source, "dscSistema"),
    activePole: recordValue(source, "poloAtivo"),
    passivePole: recordValue(source, "poloPassivo"),
    parties: recordValue(source, "partes"),
    identifiers: { hitId: recordValue(hitRecord, "_id"), sourceId: recordValue(source, "id") },
  };
}

function totalHits(payload: Record<string, unknown>): number | null {
  const hits = payload.hits;
  if (!hits || typeof hits !== "object") return null;
  const total = (hits as Record<string, unknown>).total;
  if (typeof total === "number" && Number.isSafeInteger(total)) return total;
  if (total && typeof total === "object") {
    const value = (total as Record<string, unknown>).value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  }
  return null;
}

function safeHeaders(headers: Headers): NonNullable<OfficialProcessSearchResult["headers"]> {
  return {
    contentType: headers.get("content-type"),
    date: headers.get("date"),
    requestId: headers.get("x-request-id") || headers.get("x-correlation-id"),
    retryAfter: headers.get("retry-after"),
    rateLimitLimit: headers.get("x-ratelimit-limit"),
    rateLimitRemaining: headers.get("x-ratelimit-remaining"),
  };
}

function baseResult(query: OfficialProcessSearchRequest, status: string, code: string, message: string): Omit<OfficialProcessSearchResult, "normalized"> & { normalized?: undefined } {
  return { ok: false, source: "DATAJUD_TJSP", status, requestAttempted: false, httpStatus: null, durationMs: 0, query: { ...query }, error: { code, message } };
}

async function getCurrentPublicDataJudKey(fetcher: typeof fetch): Promise<string | null> {
  const response = await fetcher(OFFICIAL_ACCESS_DOCUMENTATION_URL, {
    headers: { Accept: "text/html" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const html = await response.text();
  const readable = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ");
  const match = readable.match(/Authorization\s*:\s*APIKey\s+([A-Za-z0-9+/_=-]{20,})/i);
  return match?.[1] ?? null;
}

export class DataJudTJSPAdapter implements OfficialProcessRoute {
  readonly source = "DATAJUD_TJSP" as const;

  constructor(private readonly options: DataJudTJSPAdapterOptions = {}) {}

  supports(request: OfficialProcessSearchRequest) {
    return Boolean(request.processNumber?.trim()) && !request.partyName?.trim() && !request.documentNumber?.trim();
  }

  async search(request: OfficialProcessSearchRequest): Promise<DataJudSearchResult> {
    if (!request.processNumber?.trim()) return baseResult(request, "INVALID_QUERY", "PROCESS_NUMBER_REQUIRED", "Esta rota requer processNumber.");
    if (request.partyName?.trim() || request.documentNumber?.trim()) return baseResult(request, "UNSUPPORTED_QUERY", "QUERY_FIELD_NOT_DOCUMENTED", "Nesta etapa, a API oficial foi verificada apenas para busca por numeroProcesso.");
    if (!isValidCnjProcessNumber(request.processNumber)) return baseResult(request, "INVALID_QUERY", "INVALID_CNJ_NUMBER", "O identificador não passou na validação estrutural e no dígito verificador CNJ.");

    const endpoint = officialEndpoint(this.options.baseUrl ?? process.env.CP_DATAJUD_BASE_URL ?? DEFAULT_DATAJUD_BASE_URL);
    const authorized = this.options.researchAuthorized ?? process.env.CP_DATAJUD_RESEARCH_AUTHORIZED === "true";
    if (!authorized) return baseResult(request, "RESEARCH_AUTHORIZATION_REQUIRED", "RESEARCH_NOT_ENABLED", "Consulta DataJud bloqueada: defina autorização explícita de uso RESEARCH para este ambiente.");
    if (!endpoint) return baseResult(request, "CONFIGURATION_INVALID", "OFFICIAL_ENDPOINT_REQUIRED", "CP_DATAJUD_BASE_URL deve apontar à origem HTTPS oficial api-publica.datajud.cnj.jus.br.");

    let secret = this.options.apiKey ?? process.env.CP_DATAJUD_API_KEY ?? "";
    let credentialSource: OfficialProcessSearchResult["credentialSource"] = secret.trim() ? "ENVIRONMENT" : undefined;
    const publicKeyFallbackAllowed = this.options.allowPublicKeyFallback ?? process.env.CP_DATAJUD_PUBLIC_KEY_FALLBACK === "true";
    if (!secret.trim() && publicKeyFallbackAllowed) {
      try {
        secret = await getCurrentPublicDataJudKey(this.options.credentialFetcher ?? fetch) ?? "";
        if (secret) credentialSource = "CNJ_PUBLICATION_RESEARCH_FALLBACK";
      } catch {
        return baseResult(request, "CONFIGURATION_MISSING", "PUBLIC_KEY_LOOKUP_FAILED", "Não foi possível obter a chave pública atual da documentação oficial do CNJ; nenhuma consulta DataJud foi enviada.");
      }
    }
    if (!secret.trim()) return baseResult(request, "CONFIGURATION_MISSING", "CREDENTIAL_MISSING", "CP_DATAJUD_API_KEY ausente e fallback da chave pública CNJ desabilitado ou indisponível; nenhuma requisição foi enviada.");

    const fetcher = this.options.fetcher ?? fetch;
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const queryId = normalizeCnjProcessNumber(request.processNumber);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { Authorization: `APIKey ${secret}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ size: 10, query: { match: { numeroProcesso: queryId } } }),
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;
      const headers = safeHeaders(response.headers);
      const rawText = await response.text();
      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(rawText);
      } catch {
        rawPayload = safeText(rawText, secret);
        return { ok: false, source: this.source, status: "INVALID_RESPONSE", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload, error: { code: "INVALID_JSON", message: "A resposta do DataJud não era JSON válido." } };
      }
      const safeRawPayload = redactPayload(rawPayload, secret);
      if (response.status >= 300 && response.status < 400) return { ok: false, source: this.source, status: "SOURCE_BLOCKED", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: "REDIRECT_BLOCKED", message: "Redirecionamento do DataJud bloqueado." } };
      if (response.status === 401 || response.status === 403) return { ok: false, source: this.source, status: "SOURCE_BLOCKED", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: `HTTP_${response.status}`, message: `DataJud recusou a chave (HTTP ${response.status}); atualizar CP_DATAJUD_API_KEY ou habilitar fallback RESEARCH.` } };
      if (response.status === 429) return { ok: false, source: this.source, status: "RATE_LIMITED", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: "HTTP_429", message: "DataJud limitou a consulta; não houve retry." } };
      if (!response.ok) return { ok: false, source: this.source, status: "UNAVAILABLE", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: `HTTP_${response.status}`, message: `DataJud respondeu HTTP ${response.status}.` } };

      if (!safeRawPayload || typeof safeRawPayload !== "object" || Array.isArray(safeRawPayload)) return { ok: false, source: this.source, status: "INVALID_RESPONSE", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: "INVALID_DATAJUD_PAYLOAD", message: "Resposta JSON sem objeto raiz esperado." } };
      const payload = safeRawPayload as Record<string, unknown>;
      const hitContainer = payload.hits;
      const hits = hitContainer && typeof hitContainer === "object" ? (hitContainer as Record<string, unknown>).hits : null;
      if (!Array.isArray(hits)) return { ok: false, source: this.source, status: "INVALID_RESPONSE", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, error: { code: "INVALID_DATAJUD_HITS", message: "Resposta JSON sem hits.hits esperado." } };
      const processes = hits.map(normalizeHit).filter((record): record is DataJudProcessRecord => record !== null);
      const total = totalHits(payload);
      return { ok: true, source: this.source, status: processes.length ? "FOUND" : "NO_RESULTS", requestAttempted: true, credentialSource, httpStatus: response.status, durationMs, endpoint, query: { ...request }, headers, rawPayload: safeRawPayload, normalized: { kind: "DATAJUD", total: total ?? processes.length, processes } };
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      const message = error instanceof Error ? safeText(error.message, secret) : "Falha de rede DataJud.";
      return { ok: false, source: this.source, status: timedOut ? "TIMEOUT" : "UNAVAILABLE", requestAttempted: true, credentialSource, httpStatus: null, durationMs: Date.now() - startedAt, endpoint, query: { ...request }, error: { code: timedOut ? "TIMEOUT" : "NETWORK_ERROR", message: message.slice(0, 240) } };
    } finally {
      clearTimeout(timer);
    }
  }
}
