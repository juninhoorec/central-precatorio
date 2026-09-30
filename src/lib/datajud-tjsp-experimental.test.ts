import { describe, expect, it, vi } from "vitest";
import { DataJudTJSPAdapter } from "./datajud-tjsp-experimental";

const depre = "0196151-64.2018.8.26.0500";
const officialBase = "https://api-publica.datajud.cnj.jus.br";
const secret = "unit-test-datajud-secret";

function adapter(fetcher: typeof fetch, options: Partial<ConstructorParameters<typeof DataJudTJSPAdapter>[0]> = {}) {
  return new DataJudTJSPAdapter({ baseUrl: officialBase, apiKey: secret, researchAuthorized: true, fetcher, ...options });
}

describe("DataJudTJSPAdapter experimental", () => {
  it("constructs the documented TJSP URL, match query and APIKey authorization", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe(`${officialBase}/api_publica_tjsp/_search`);
      expect(init?.method).toBe("POST");
      return Response.json({ hits: { total: { value: 0 }, hits: [] } });
    });
    const result = await adapter(fetcher).search({ processNumber: depre });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${officialBase}/api_publica_tjsp/_search`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(`APIKey ${secret}`);
    expect(JSON.parse(String(init?.body))).toEqual({ size: 10, query: { match: { numeroProcesso: "01961516420188260500" } } });
    expect(result).toMatchObject({ source: "DATAJUD_TJSP", status: "NO_RESULTS", requestAttempted: true, httpStatus: 200, ok: true, normalized: { total: 0, processes: [] } });
  });

  it("normalizes only explicitly returned metadata and preserves unknown structures", async () => {
    const source = {
      numeroProcesso: "01961516420178260500",
      tribunal: "TJSP",
      grau: "G1",
      orgaoJulgador: { codigo: 71, nome: "Vara Fixture" },
      classe: { codigo: 1265, nome: "Precatório" },
      assuntos: [{ codigo: 1, nome: "Assunto fixture" }],
      movimentos: [{ codigo: 26, nome: "Distribuição", dataHora: "2020-01-01T00:00:00" }],
      sistema: { codigo: 3, nome: "SAJ" },
      formato: { codigo: 1, nome: "Eletrônico" },
      partes: [{ nome: "Parte Fixture", tipoParte: "BENEFICIÁRIO" }],
      id: "TJSP_fixture_123",
    };
    const result = await adapter(async () => Response.json({ hits: { total: { value: 1 }, hits: [{ _id: "hit-fixture", _source: source }] } })).search({ processNumber: depre });

    expect(result.normalized?.total).toBe(1);
    expect(result.normalized?.processes[0]).toMatchObject({
      processNumber: source.numeroProcesso,
      tribunal: "TJSP",
      degree: "G1",
      judgingBody: source.orgaoJulgador,
      class: source.classe,
      subjects: source.assuntos,
      movements: source.movimentos,
      systemIdentification: source.sistema,
      electronicSystem: source.formato,
      parties: source.partes,
      identifiers: { hitId: "hit-fixture", sourceId: "TJSP_fixture_123" },
      dscSistema: null,
      priority: null,
      activePole: null,
      passivePole: null,
    });
    expect(result.rawPayload).toMatchObject({ hits: { hits: [{ _source: source }] } });
  });

  it("returns null for fields absent from the response without inferring from parts", async () => {
    const result = await adapter(async () => Response.json({ hits: { hits: [{ _source: { numeroProcesso: "01961516420178260500", partes: [{ nome: "Pessoa" }] } }] } })).search({ processNumber: depre });
    expect(result.normalized?.processes[0]).toMatchObject({ tribunal: null, degree: null, judgingBody: null, class: null, subjects: null, movements: null, priority: null, electronicSystem: null, systemIdentification: null, dscSistema: null, activePole: null, passivePole: null });
  });

  it("reports an empty result separately from source errors", async () => {
    const result = await adapter(async () => Response.json({ hits: { total: { value: 0, relation: "eq" }, hits: [] } })).search({ processNumber: depre });
    expect(result).toMatchObject({ ok: true, status: "NO_RESULTS", httpStatus: 200, normalized: { total: 0, processes: [] } });
  });

  it.each([401, 403])("classifies HTTP %s without retrying", async status => {
    const fetcher = vi.fn(async () => Response.json({ message: "denied" }, { status }));
    const result = await adapter(fetcher).search({ processNumber: depre });
    expect(result).toMatchObject({ ok: false, status: "SOURCE_BLOCKED", httpStatus: status, requestAttempted: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("classifies rate limiting without retrying", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: "slow down" }, { status: 429, headers: { "retry-after": "30" } }));
    const result = await adapter(fetcher).search({ processNumber: depre });
    expect(result).toMatchObject({ status: "RATE_LIMITED", headers: { retryAfter: "30" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles invalid JSON and network errors", async () => {
    const invalidJson = await adapter(async () => new Response("not-json", { status: 200 })).search({ processNumber: depre });
    const networkError = await adapter(async () => { throw new Error("socket unavailable"); }).search({ processNumber: depre });
    expect(invalidJson).toMatchObject({ status: "INVALID_RESPONSE", error: { code: "INVALID_JSON" } });
    expect(networkError).toMatchObject({ status: "UNAVAILABLE", error: { code: "NETWORK_ERROR" } });
  });

  it("rejects missing credentials, unapproved research, invalid URLs and unsupported party searches before network", async () => {
    const fetcher = vi.fn();
    expect((await new DataJudTJSPAdapter({ baseUrl: officialBase, researchAuthorized: true, fetcher }).search({ processNumber: depre })).error?.code).toBe("CREDENTIAL_MISSING");
    expect((await new DataJudTJSPAdapter({ baseUrl: officialBase, apiKey: secret, researchAuthorized: false, fetcher }).search({ processNumber: depre })).error?.code).toBe("RESEARCH_NOT_ENABLED");
    expect((await new DataJudTJSPAdapter({ baseUrl: "https://example.org", apiKey: secret, researchAuthorized: true, fetcher }).search({ processNumber: depre })).error?.code).toBe("OFFICIAL_ENDPOINT_REQUIRED");
    expect((await adapter(fetcher).search({ partyName: "Pessoa Fixture" })).error?.code).toBe("PROCESS_NUMBER_REQUIRED");
    expect((await adapter(fetcher).search({ processNumber: depre, partyName: "Pessoa Fixture" })).error?.code).toBe("QUERY_FIELD_NOT_DOCUMENTED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads the current public CNJ key only after explicit RESEARCH opt-in and never returns it", async () => {
    const publicKey = "Zml4dHVyZS1vbmx5LXB1YmxpYy1rZXk=";
    const credentialFetcher = vi.fn<typeof fetch>(async () => new Response(`<p>Authorization: APIKey ${publicKey}</p>`, { status: 200 }));
    const queryFetcher = vi.fn<typeof fetch>(async () => Response.json({ hits: { total: { value: 0 }, hits: [] } }));
    const result = await new DataJudTJSPAdapter({
      baseUrl: officialBase,
      researchAuthorized: true,
      allowPublicKeyFallback: true,
      credentialFetcher,
      fetcher: queryFetcher,
    }).search({ processNumber: depre });

    expect(credentialFetcher).toHaveBeenCalledTimes(1);
    expect(credentialFetcher.mock.calls[0][0]).toBe("https://datajud-wiki.cnj.jus.br/api-publica/acesso/");
    expect(queryFetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(queryFetcher.mock.calls[0][1]?.headers).get("authorization")).toBe(`APIKey ${publicKey}`);
    expect(result).toMatchObject({ status: "NO_RESULTS", credentialSource: "CNJ_PUBLICATION_RESEARCH_FALLBACK" });
    expect(JSON.stringify(result)).not.toContain(publicKey);
  });

  it("never returns the API key in headers, payload, or errors", async () => {
    const fetcher = vi.fn(async () => Response.json({ message: secret, authorization: secret, cpf: "123.456.789-00" }, { status: 403 }));
    const result = await adapter(fetcher).search({ processNumber: depre });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("123.456.789-00");
    expect(result.headers).not.toHaveProperty("authorization");
    expect(result.rawPayload).toMatchObject({ message: "[REDACTED]", authorization: "[REDACTED]", cpf: "[REDACTED]" });
  });
});