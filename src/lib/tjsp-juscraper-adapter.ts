import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isValidCnjProcessNumber } from "./acquisition-sources";
import type {
  OfficialProcessRoute,
  OfficialProcessSearchRequest,
  OfficialProcessSearchResult,
  TjspNormalizedResult,
} from "./datajud-tjsp-experimental";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 12_000;

type TjspJuscraperCommandResult = {
  stdout: string;
  stderr?: string;
  code?: number | null;
  signal?: string;
  requestAttempted?: boolean;
};

export type TjspJuscraperRunnerInput = {
  processNumber: string;
  timeoutMs: number;
  method: "cpopg" | "cposg";
};

export type TjspJuscraperAdapterOptions = {
  runner?: (input: TjspJuscraperRunnerInput) => Promise<TjspJuscraperCommandResult>;
  timeoutMs?: number;
  pythonExecutable?: string;
};

export type TjspJuscraperResult = Omit<OfficialProcessSearchResult, "normalized"> & {
  provider: "JUSCRAPER";
  underlyingSource: "TJSP";
  sourceType: "OFFICIAL_TRIBUNAL";
  official: true;
  numeroProcessoDEPRE: string | null;
  numeroProcessoOriginario: string | null;
  numeroPrecatorio: string | null;
  numeroProcessoEncontrado: string | null;
  officialUrl: string | null;
  officialUrlStatus: "RETURNED" | "NOT_RETURNED";
  rawPayload: unknown;
  normalized?: TjspNormalizedResult;
};

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function pickString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    const text = asString(value);
    if (text) return text;
    const alternate = Object.entries(payload).find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
    if (alternate && typeof alternate[1] === "string" && String(alternate[1]).trim()) return String(alternate[1]).trim();
  }
  return null;
}

function extractProcessInfo(payload: Record<string, unknown>): { numeroProcessoEncontrado: string | null; numeroProcessoOriginario: string | null; numeroPrecatorio: string | null; } {
  const numeroProcessoEncontrado = pickString(payload, [
    "numero_cnj",
    "numeroCNJ",
    "numeroProcesso",
    "numero_processo",
    "processo",
    "processNumber",
    "cnj",
    "id_cnj",
    "numero_cnj_processo",
  ]);
  const numeroProcessoOriginario = pickString(payload, [
    "numeroProcessoOriginario",
    "numero_processo_origem",
    "processoOriginario",
    "originProcessNumber",
    "processo_origem",
  ]);
  const numeroPrecatorio = pickString(payload, [
    "numeroPrecatorio",
    "numero_precatorio",
    "precatorio",
    "paymentOrderNumber",
  ]);
  return { numeroProcessoEncontrado: numeroProcessoEncontrado ?? null, numeroProcessoOriginario: numeroProcessoOriginario ?? null, numeroPrecatorio: numeroPrecatorio ?? null };
}

function inferStatusFromText(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("timeout") || text.includes("timed out")) return "TIMEOUT";
  if (text.includes("rate limit") || text.includes("too many requests") || text.includes("429")) return "RATE_LIMITED";
  if (text.includes("captcha") || text.includes("cloudflare") || text.includes("turnstile") || text.includes("challenge")) return "CAPTCHA_REQUIRED";
  if (text.includes("python") || text.includes("module not found") || text.includes("not installed") || text.includes("not configured") || text.includes("not available")) return "NOT_CONFIGURED";
  return null;
}

async function defaultRunner(input: TjspJuscraperRunnerInput, preferredPythonExecutable?: string): Promise<TjspJuscraperCommandResult> {
  let pythonExecutable: string | null = null;
  const candidates = preferredPythonExecutable?.trim() ? [preferredPythonExecutable.trim()] : ["python3", "python"];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-c", "import sys; print(sys.version)"], { timeout: 2_000, windowsHide: true });
      pythonExecutable = candidate;
      break;
    } catch {
      continue;
    }
  }
  if (!pythonExecutable) {
    return {
      stdout: JSON.stringify({ status: "NOT_CONFIGURED", message: "Python executable not found or unavailable." }),
      stderr: "",
      code: 127,
      requestAttempted: false,
    };
  }

  const script = `import json, sys
try:
    import juscraper as jus
    scraper = jus.scraper('tjsp')
    method = sys.argv[2]
    payload = getattr(scraper, method)(sys.argv[1])
    print(json.dumps({"status": "SUCCESS", "payload": payload}))
except ModuleNotFoundError:
    print(json.dumps({"status": "NOT_CONFIGURED", "message": "juscraper not installed"}))
except Exception as exc:
    message = str(exc)
    lower = message.lower()
    if 'timeout' in lower or 'timed out' in lower:
        status = 'TIMEOUT'
    elif '429' in lower or 'rate limit' in lower or 'too many requests' in lower:
        status = 'RATE_LIMITED'
    elif 'captcha' in lower or 'turnstile' in lower or 'cloudflare' in lower or 'challenge' in lower:
        status = 'CAPTCHA_REQUIRED'
    elif 'not configured' in lower or 'not available' in lower or 'missing' in lower:
        status = 'NOT_CONFIGURED'
    else:
        status = 'ERROR'
    print(json.dumps({"status": status, "message": message}))
`;

  return new Promise((resolve) => {
    execFile(pythonExecutable, ["-c", script, input.processNumber, input.method], { timeout: input.timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error && !stdout) {
        if (error.code === "ENOENT") {
          resolve({ stdout: JSON.stringify({ status: "NOT_CONFIGURED", message: "python executable not found" }), stderr: String(stderr || error.message), code: 127, signal: error.signal || undefined });
          return;
        }
        resolve({ stdout: stdout || JSON.stringify({ status: "ERROR", message: error.message }), stderr: String(stderr || ""), code: typeof error.code === "number" ? error.code : null, signal: error.signal || undefined });
        return;
      }
      resolve({ stdout: stdout || "", stderr: String(stderr || ""), code: 0, signal: undefined });
    });
  });
}

export class TjspJuscraperAdapter implements OfficialProcessRoute {
  readonly source = "TJSP_DIRECT" as const;

  constructor(private readonly options: TjspJuscraperAdapterOptions = {}) {}

  supports(request: OfficialProcessSearchRequest) {
    return Boolean(request.processNumber?.trim()) && !request.partyName?.trim() && !request.documentNumber?.trim();
  }

  async search(request: OfficialProcessSearchRequest): Promise<TjspJuscraperResult> {
    if (!request.processNumber?.trim()) {
      return {
        ok: false,
        source: this.source,
        status: "INVALID_QUERY",
        requestAttempted: false,
        httpStatus: null,
        durationMs: 0,
        query: { ...request },
        provider: "JUSCRAPER",
        underlyingSource: "TJSP",
        sourceType: "OFFICIAL_TRIBUNAL",
        official: true,
        numeroProcessoDEPRE: null,
        numeroProcessoOriginario: null,
        numeroPrecatorio: null,
        numeroProcessoEncontrado: null,
        officialUrl: null,
        officialUrlStatus: "NOT_RETURNED",
        rawPayload: null,
        error: { code: "PROCESS_NUMBER_REQUIRED", message: "A consulta TJSP direta exige processNumber." },
      };
    }
    if (!isValidCnjProcessNumber(request.processNumber)) {
      return {
        ok: false,
        source: this.source,
        status: "INVALID_QUERY",
        requestAttempted: false,
        httpStatus: null,
        durationMs: 0,
        query: { ...request },
        provider: "JUSCRAPER",
        underlyingSource: "TJSP",
        sourceType: "OFFICIAL_TRIBUNAL",
        official: true,
        numeroProcessoDEPRE: request.processNumber,
        numeroProcessoOriginario: null,
        numeroPrecatorio: null,
        numeroProcessoEncontrado: null,
        officialUrl: null,
        officialUrlStatus: "NOT_RETURNED",
        rawPayload: null,
        error: { code: "INVALID_CNJ_NUMBER", message: "O número informado não passou na validação CNJ do DEPRE/TJSP." },
      };
    }

    const startedAt = Date.now();
    const runner = this.options.runner ?? ((input: TjspJuscraperRunnerInput) => defaultRunner(input, this.options.pythonExecutable ?? process.env.CP_JUSCRAPER_PYTHON));
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      const result = await runner({ processNumber: request.processNumber, timeoutMs, method: "cpopg" });
      const fallbackStatus = inferStatusFromText(result.stderr) ?? inferStatusFromText(result.stdout);
      let raw: unknown = null;
      if (result.stdout && result.stdout.trim()) {
        try {
          raw = JSON.parse(result.stdout);
        } catch {
          raw = { status: fallbackStatus ?? "ERROR", message: result.stdout.trim() };
        }
      } else if (fallbackStatus) {
        raw = { status: fallbackStatus, message: result.stderr || result.stdout || "Consulta do TJSP falhou sem resposta útil." };
      }

      if (!raw || typeof raw !== "object") {
        return {
          ok: false,
          source: this.source,
          status: "UNAVAILABLE",
          requestAttempted: true,
          httpStatus: null,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: null,
          officialUrl: null,
          officialUrlStatus: "NOT_RETURNED",
          rawPayload: { stdout: result.stdout, stderr: result.stderr },
          error: { code: "INVALID_JSON", message: "O runner do JusScraper não retornou JSON válido." },
        };
      }

      const payload = raw as Record<string, unknown>;
      const status = String(payload.status || "").toUpperCase();
      const message = asString(payload.message) ?? "Consulta TJSP não retornou resultado útil.";
      const processSummary = payload.payload && typeof payload.payload === "object" ? (payload.payload as Record<string, unknown>) : payload;
      const officialUrl = asString(processSummary.url ?? processSummary.officialUrl ?? processSummary.link ?? processSummary.urlOficial ?? processSummary.oficialUrl ?? payload.url ?? payload.officialUrl ?? payload.link ?? payload.urlOficial ?? payload.oficialUrl) ?? null;
      const officialUrlStatus: "RETURNED" | "NOT_RETURNED" = officialUrl ? "RETURNED" : "NOT_RETURNED";
      const identified = extractProcessInfo(processSummary);

      const normalized: TjspNormalizedResult = {
        kind: "TJSP_JUSCRAPER",
        processNumber: request.processNumber,
        relatedProcessNumber: null,
        className: asString(processSummary.classe ?? processSummary.class ?? processSummary.classeProcessual),
        subject: asString(processSummary.assunto ?? processSummary.subject ?? processSummary.materia),
        forum: asString(processSummary.foro ?? processSummary.forum),
        courtUnit: asString(processSummary.vara ?? processSummary.unidade ?? processSummary.orgaoJulgador),
        parties: processSummary.partes ?? processSummary.parties ?? null,
        movements: processSummary.movimentacoes ?? processSummary.movements ?? null,
        identifiers: {
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoEncontrado: identified.numeroProcessoEncontrado,
          numeroProcessoOriginario: identified.numeroProcessoOriginario,
          numeroPrecatorio: identified.numeroPrecatorio,
        },
        officialUrl,
      };

      if (status === "NOT_CONFIGURED" || /not configured|not installed|python executable not found|modulenotfounderror/i.test(message)) {
        return {
          ok: false,
          source: this.source,
          status: "NOT_CONFIGURED",
          requestAttempted: result.requestAttempted ?? true,
          httpStatus: null,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: null,
          officialUrl: null,
          officialUrlStatus: "NOT_RETURNED",
          rawPayload: processSummary,
          normalized,
          error: { code: "PYTHON_NOT_AVAILABLE", message: message || "JusScraper não está configurado neste ambiente." },
        };
      }

      if (status === "TIMEOUT" || /timeout|timed out/i.test(message) || fallbackStatus === "TIMEOUT") {
        return {
          ok: false,
          source: this.source,
          status: "TIMEOUT",
          requestAttempted: true,
          httpStatus: null,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: null,
          officialUrl: null,
          officialUrlStatus: "NOT_RETURNED",
          rawPayload: processSummary,
          normalized,
          error: { code: "TIMEOUT", message: message || "A consulta direta do TJSP excedeu o timeout." },
        };
      }

      if (status === "RATE_LIMITED" || /429|rate limit|too many requests/i.test(message) || fallbackStatus === "RATE_LIMITED") {
        return {
          ok: false,
          source: this.source,
          status: "RATE_LIMITED",
          requestAttempted: true,
          httpStatus: 429,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: identified.numeroProcessoEncontrado,
          officialUrl,
          officialUrlStatus,
          rawPayload: processSummary,
          normalized,
          error: { code: "RATE_LIMITED", message: message || "O TJSP limitou a consulta direta." },
        };
      }

      if (status === "CAPTCHA_REQUIRED" || status === "BLOCKED" || /captcha|turnstile|cloudflare|challenge|blocked/i.test(message) || fallbackStatus === "CAPTCHA_REQUIRED") {
        return {
          ok: false,
          source: this.source,
          status: "CAPTCHA_REQUIRED",
          requestAttempted: true,
          httpStatus: 403,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: identified.numeroProcessoEncontrado,
          officialUrl,
          officialUrlStatus,
          rawPayload: processSummary,
          normalized,
          error: { code: "CAPTCHA_REQUIRED", message: message || "O TJSP exigiu CAPTCHA ou bloqueio de segurança." },
        };
      }

      if (status === "NO_RESULT" || status === "NOT_FOUND" || status === "EMPTY") {
        return {
          ok: true,
          source: this.source,
          status: "NO_RESULT",
          requestAttempted: true,
          httpStatus: 200,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: null,
          officialUrl,
          officialUrlStatus,
          rawPayload: processSummary,
          normalized,
        };
      }

      if (status === "SUCCESS" || status === "FOUND") {
        return {
          ok: true,
          source: this.source,
          status: "FOUND",
          requestAttempted: true,
          httpStatus: 200,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: identified.numeroProcessoOriginario,
          numeroPrecatorio: identified.numeroPrecatorio,
          numeroProcessoEncontrado: identified.numeroProcessoEncontrado,
          officialUrl,
          officialUrlStatus,
          rawPayload: processSummary,
          normalized,
        };
      }

      return {
        ok: false,
        source: this.source,
        status: "UNAVAILABLE",
        requestAttempted: true,
        httpStatus: null,
        durationMs: Date.now() - startedAt,
        query: { ...request },
        provider: "JUSCRAPER",
        underlyingSource: "TJSP",
        sourceType: "OFFICIAL_TRIBUNAL",
        official: true,
        numeroProcessoDEPRE: request.processNumber,
        numeroProcessoOriginario: null,
        numeroPrecatorio: null,
        numeroProcessoEncontrado: identified.numeroProcessoEncontrado,
        officialUrl,
        officialUrlStatus,
        rawPayload: processSummary,
        normalized,
        error: { code: status || "UNAVAILABLE", message: message || "A consulta direta do TJSP retornou um estado inesperado." },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha técnica do runner do JusScraper.";
      if (/python|module not found|not installed|not configured|not available|missing/i.test(message)) {
        return {
          ok: false,
          source: this.source,
          status: "NOT_CONFIGURED",
          requestAttempted: false,
          httpStatus: null,
          durationMs: Date.now() - startedAt,
          query: { ...request },
          provider: "JUSCRAPER",
          underlyingSource: "TJSP",
          sourceType: "OFFICIAL_TRIBUNAL",
          official: true,
          numeroProcessoDEPRE: request.processNumber,
          numeroProcessoOriginario: null,
          numeroPrecatorio: null,
          numeroProcessoEncontrado: null,
          officialUrl: null,
          officialUrlStatus: "NOT_RETURNED",
          rawPayload: { message },
          error: { code: "PYTHON_NOT_AVAILABLE", message },
        };
      }
      return {
        ok: false,
        source: this.source,
        status: /timeout|timed out/i.test(message) ? "TIMEOUT" : "UNAVAILABLE",
        requestAttempted: true,
        httpStatus: null,
        durationMs: Date.now() - startedAt,
        query: { ...request },
        provider: "JUSCRAPER",
        underlyingSource: "TJSP",
        sourceType: "OFFICIAL_TRIBUNAL",
        official: true,
        numeroProcessoDEPRE: request.processNumber,
        numeroProcessoOriginario: null,
        numeroPrecatorio: null,
        numeroProcessoEncontrado: null,
        officialUrl: null,
        officialUrlStatus: "NOT_RETURNED",
        rawPayload: { message },
        error: { code: /timeout|timed out/i.test(message) ? "TIMEOUT" : "RUNNER_ERROR", message },
      };
    }
  }
}
