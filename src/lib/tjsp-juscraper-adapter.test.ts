import { describe, expect, it, vi } from "vitest";
import { TjspJuscraperAdapter } from "./tjsp-juscraper-adapter";
import { OfficialProcessSourceCollector } from "./official-process-source-collector";
import type { OfficialProcessRoute } from "./datajud-tjsp-experimental";

const depre = "0196151-64.2018.8.26.0500";

function makeSuccessPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "SUCCESS",
    payload: {
      numero_cnj: depre,
      processo: depre,
      classe: "Procedimento Comum",
      assunto: "Cobrança",
      foro: "TJSP",
      vara: "2ª Vara Cível",
      partes: [{ nome: "Municipio", papel: "devedor" }],
      movimentacoes: [{ descricao: "Distribuição" }],
      url: "https://www.tjsp.jus.br/consultaProcesso",
      ...overrides,
    },
  };
}

describe("TjspJuscraperAdapter", () => {
  it("returns a successful TJSP direct result while preserving the DEPRE and official URL", async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify(makeSuccessPayload()),
      stderr: "",
      code: 0,
    }));

    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.status).toBe("FOUND");
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("JUSCRAPER");
    expect(result.underlyingSource).toBe("TJSP");
    expect(result.sourceType).toBe("OFFICIAL_TRIBUNAL");
    expect(result.official).toBe(true);
    expect(result.numeroProcessoDEPRE).toBe(depre);
    expect(result.numeroProcessoEncontrado).toBe(depre);
    expect(result.officialUrl).toBe("https://www.tjsp.jus.br/consultaProcesso");
    expect(result.officialUrlStatus).toBe("RETURNED");
    expect(result.rawPayload).toBeTruthy();
  });

  it("returns NO_RESULT when the TJSP direct search yields no case", async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify({ status: "NO_RESULT" }), stderr: "", code: 0 }));
    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.status).toBe("NO_RESULT");
    expect(result.ok).toBe(true);
    expect(result.requestAttempted).toBe(true);
  });

  it("returns TIMEOUT when the JusScraper call times out", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "timeout", code: null, signal: "SIGTERM" }));
    const result = await new TjspJuscraperAdapter({ runner, timeoutMs: 1000 }).search({ processNumber: depre });

    expect(result.status).toBe("TIMEOUT");
    expect(result.error?.code).toBe("TIMEOUT");
  });

  it("returns RATE_LIMITED when the tribunal throttles the request", async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify({ status: "RATE_LIMITED", message: "429 Too Many Requests" }), stderr: "", code: 0 }));
    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.status).toBe("RATE_LIMITED");
    expect(result.error?.code).toBe("RATE_LIMITED");
  });

  it("returns CAPTCHA_REQUIRED when the tribunal blocks the request", async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify({ status: "BLOCKED", message: "Cloudflare Turnstile challenge" }), stderr: "", code: 0 }));
    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.status).toBe("CAPTCHA_REQUIRED");
    expect(result.error?.code).toBe("CAPTCHA_REQUIRED");
  });

  it("returns NOT_RETURNED when the official URL is absent", async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify(makeSuccessPayload({ url: null })), stderr: "", code: 0 }));
    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.officialUrl).toBeNull();
    expect(result.officialUrlStatus).toBe("NOT_RETURNED");
  });

  it("preserves the DEPRE without inferring a different process number", async () => {
    const runner = vi.fn(async () => ({
      stdout: JSON.stringify(makeSuccessPayload({ processo: "1234567-89.2024.8.26.0001", numero_cnj: "1234567-89.2024.8.26.0001" })),
      stderr: "",
      code: 0,
    }));

    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.numeroProcessoDEPRE).toBe(depre);
    expect(result.numeroProcessoEncontrado).toBe("1234567-89.2024.8.26.0001");
    expect(result.numeroProcessoOriginario).toBeNull();
    expect(result.numeroPrecatorio).toBeNull();
  });

  it("keeps raw payload and normalized details separated without inferring missing relationship data", async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify(makeSuccessPayload({ numero_processo: undefined, partes: [{ nome: "ABC", papel: "autora" }] })), stderr: "", code: 0 }));
    const result = await new TjspJuscraperAdapter({ runner }).search({ processNumber: depre });

    expect(result.rawPayload).toBeTruthy();
    expect(result.normalized?.processNumber).toBe(depre);
    expect(result.normalized?.parties).toHaveLength(1);
    expect(result.normalized?.relatedProcessNumber).toBeNull();
  });

  it("returns NOT_CONFIGURED when the local Python/JusScraper runtime is unavailable", async () => {
    const result = await new TjspJuscraperAdapter({ runner: async () => { throw new Error("python missing"); } }).search({ processNumber: depre });

    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.error?.code).toBe("PYTHON_NOT_AVAILABLE");
  });

  it("does not cancel other routes when one route fails", async () => {
    const started: string[] = [];

    const routes = [
      { source: "TJSP_DIRECT" as const, supports: () => true, search: async () => { started.push("A"); await new Promise((resolve) => setTimeout(resolve, 100)); return { source: "TJSP_DIRECT" as const, status: "FOUND", ok: true, requestAttempted: true, httpStatus: 200, durationMs: 100, query: { processNumber: depre } }; } },
      { source: "DATAJUD_TJSP" as const, supports: () => true, search: async () => { started.push("B"); await new Promise((resolve) => setTimeout(resolve, 100)); throw new Error("route failure"); } },
      { source: "DJEN" as const, supports: () => true, search: async () => { started.push("C"); await new Promise((resolve) => setTimeout(resolve, 100)); return { source: "DJEN" as const, status: "NO_RESULT", ok: true, requestAttempted: true, httpStatus: 200, durationMs: 100, query: { processNumber: depre } }; } },
    ] as OfficialProcessRoute[];

    const startedAt = Date.now();
    const results = await new OfficialProcessSourceCollector(routes).search({ processNumber: depre });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(250);
    expect(started).toEqual(["A", "B", "C"]);
    expect(results.find((item) => item.source === "TJSP_DIRECT")?.status).toBe("FOUND");
    expect(results.find((item) => item.source === "DATAJUD_TJSP")?.error?.code).toBe("ROUTE_ERROR");
    expect(results.find((item) => item.source === "DJEN")?.status).toBe("NO_RESULT");
  });
});
