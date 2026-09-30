import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dataJudAdapter,
  djenAdapter,
  esajAdapter,
  extractDataJudParties,
  investigateAllowedSources,
  isOfficialSourceUrl,
  isValidCnjProcessNumber,
  normalizeCnjProcessNumber,
} from "./acquisition-sources";

const validCnj = "7006050-78.2000.8.26.0500";

afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.stubEnv("DATAJUD_COMMERCIAL_USE_AUTHORIZED", "true");
});

describe("CNJ process identifiers", () => {
  it("normalizes formatting and validates the 20-digit CNJ number and modulo 97", () => {
    expect(normalizeCnjProcessNumber(validCnj)).toBe("70060507820008260500");
    expect(isValidCnjProcessNumber(validCnj)).toBe(true);
    expect(isValidCnjProcessNumber("7006050-79.2000.8.26.0500")).toBe(false);
    expect(isValidCnjProcessNumber("7006050782000826050")).toBe(false);
    expect(
      normalizeCnjProcessNumber("CNJ-70060507820008260500"),
    ).toBe("");
    expect(isValidCnjProcessNumber("not-a-process")).toBe(false);
  });
});

describe("permitted acquisition source adapters", () => {
  it("queries DJEN by normalized CNJ and preserves a communication as evidence, not creditor resolution", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v1/comunicacao");
      expect(url.searchParams.get("numeroProcesso")).toBe(
        "70060507820008260500",
      );
      expect(url.searchParams.get("pagina")).toBe("1");
      expect(url.searchParams.get("itensPorPagina")).toBe("100");
      return Response.json(
        {
          status: "success",
          count: 1,
          items: [
            {
              id: 123,
              hash: "synthetic-hash",
              numero_processo: "70060507820008260500",
              siglaTribunal: "TJSP",
              nomeOrgao: "Órgão Sintético",
              tipoComunicacao: "Intimação",
              data_disponibilizacao: "2026-04-01",
              meio: "Diário de Justiça Eletrônico",
              texto: "CREDOR: Pessoa Sintética; contato teste@example.invalid",
              link: "https://www.tjsp.jus.br/consulta/sintetica",
              destinatarios: [{ nome: "Pessoa Destinatária", polo: "A" }],
              destinatarioadvogados: [
                { advogado: { nome: "Advogado Sintético" } },
              ],
            },
          ],
        },
        {
          headers: {
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "59",
          },
        },
      );
    });

    const result = await djenAdapter.lookup({ processNumber: validCnj, fetcher });

    expect(result).toMatchObject({
      sourceId: "djen",
      status: "FOUND",
      queryId: "70060507820008260500",
      originalIdentifier: validCnj,
      requestAttempted: true,
      httpStatus: 200,
      resultCount: 1,
      rateLimitLimit: 60,
      rateLimitRemaining: 59,
    });
    expect(result.communications[0]).toMatchObject({
      hash: "synthetic-hash",
      certificateUrl:
        "https://hcomunicaapi.cnj.jus.br/api/v1/comunicacao/synthetic-hash/certidao",
      publicationDate: "2026-04-01",
    });
    expect(result.communications[0].partyObservations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Pessoa Destinatária",
          role: "UNKNOWN",
        }),
        expect.objectContaining({
          name: "Advogado Sintético",
          role: "ADVOGADO",
        }),
        expect.objectContaining({
          name: "Pessoa Sintética",
          role: "CREDOR",
        }),
      ]),
    );
    expect(result.communications[0].contacts).toEqual([
      { type: "EMAIL", value: "teste@example.invalid" },
    ]);
  });

  it("records an empty HTTP 200 as no result for this query", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ status: "success", count: 0, items: [] }),
    );
    const result = await djenAdapter.lookup({ processNumber: validCnj, fetcher });
    expect(result).toMatchObject({
      status: "NO_RESULT",
      httpStatus: 200,
      resultCount: 0,
      requestAttempted: true,
      communications: [],
    });
  });

  it("validates before spending source budget and distinguishes blocked and rate-limited responses", async () => {
    const fetcher = vi.fn(async () =>
      new Response(null, {
        status: 429,
        headers: { "x-ratelimit-remaining": "0" },
      }),
    );
    const invalid = await djenAdapter.lookup({
      processNumber: "7006050-79.2000.8.26.0500",
      fetcher,
    });
    const limited = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher,
    });
    const blocked = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () => new Response(null, { status: 403 })),
    });
    expect(invalid.status).toBe("INVALID_QUERY");
    expect(invalid.requestAttempted).toBe(false);
    expect(limited.status).toBe("RATE_LIMITED");
    expect(limited.rateLimitRemaining).toBe(0);
    expect(limited.requestAttempted).toBe(true);
    expect(blocked.status).toBe("SOURCE_BLOCKED");
    expect(blocked.status).not.toBe("NO_RESULT");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports malformed DJEN responses and network failures without labeling a creditor absent", async () => {
    const malformed = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () => Response.json({ unexpected: [] })),
    });
    const malformedJson = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () =>
        new Response("{", {
          headers: { "content-type": "application/json" },
        }),
      ),
    });
    const sourceError = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () =>
        Response.json({ status: "error", message: "synthetic error", items: [] }),
      ),
    });
    const failed = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () => {
        throw new Error("connection refused");
      }),
    });
    expect(malformed.status).toBe("ERROR");
    expect(malformedJson.status).toBe("ERROR");
    expect(sourceError.status).toBe("ERROR");
    expect(failed.status).toBe("SOURCE_UNAVAILABLE");
    expect(failed.failureReason).toContain("connection refused");
  });

  it("deduplicates identical communications by hash and decodes explicit role evidence", async () => {
    const communication = {
      id: 1,
      hash: "same-hash",
      numero_processo: "70060507820008260500",
      texto: "BENEFICI&Aacute;RIO: Pessoa Sint&eacute;tica",
    };
    const result = await djenAdapter.lookup({
      processNumber: validCnj,
      fetcher: vi.fn(async () =>
        Response.json({
          status: "success",
          count: 2,
          items: [communication, communication],
        }),
      ),
    });
    expect(result.status).toBe("FOUND");
    expect(result.resultCount).toBe(1);
    expect(result.communications[0].partyObservations).toContainEqual(
      expect.objectContaining({
        name: "Pessoa Sintética",
        role: "BENEFICIARIO",
      }),
    );
  });

  it("does not make a request or claim no result when the public key is absent", async () => {
    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "");
    const fetcher = vi.fn();
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      fetcher,
    });
    expect(result.status).toBe("DATAJUD_KEY_NOT_CONFIGURED");
    expect(result.requestAttempted).toBe(false);
    expect(result.queryId).toBe("70060507820008260500");
    expect(result.originalIdentifier).toBe(validCnj);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the connector disabled until commercial-use authorization is configured", async () => {
    vi.stubEnv("DATAJUD_COMMERCIAL_USE_AUTHORIZED", "false");
    const fetcher = vi.fn();
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.status).toBe("DATAJUD_USE_NOT_AUTHORIZED");
    expect(result.failureReason).toContain(
      "uso comercial sujeito a autorização",
    );
    expect(result.requestAttempted).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an invalid check digit before checking credentials or making a request", async () => {
    const fetcher = vi.fn();
    const result = await dataJudAdapter.lookup({
      processNumber: "7006050-79.2000.8.26.0500",
      apiKey: "test-only",
      fetcher,
    });

    expect(result.status).toBe("INVALID_IDENTIFIER");
    expect(result.requestAttempted).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends normalized identifiers to the configured official TJSP endpoint", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        hits: {
          hits: [
            {
              _source: {
                numeroProcesso: "70060507820008260500",
                partes: [
                  { nome: "Pessoa Credora Sintética", tipoParte: "BENEFICIÁRIO" },
                  { nome: "Ente Sintético", polo: "P" },
                ],
              },
            },
          ],
        },
      }),
    );
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });

    expect(result).toMatchObject({
      status: "PROCESS_FOUND",
      resultCount: 1,
      queryId: "70060507820008260500",
      originalIdentifier: validCnj,
      sourceId: "datajud",
      requestAttempted: true,
      httpStatus: 200,
    });
    expect(result.parties).toEqual([
      {
        name: "Pessoa Credora Sintética",
        role: "BENEFICIARIO",
        roleEvidence: "BENEFICIÁRIO",
      },
      { name: "Ente Sintético", role: "DEVEDOR", roleEvidence: "P" },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search",
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
        body: expect.stringContaining('"70060507820008260500"'),
      }),
    );
  });

  it("uses the externally configured endpoint when it stays on the official DataJud host", async () => {
    const endpoint =
      "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp_v2/_search";
    vi.stubEnv("DATAJUD_TJSP_ENDPOINT", endpoint);
    const fetcher = vi.fn(async () =>
      Response.json({ hits: { hits: [] } }),
    );
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.sourceUrl).toBe(`${endpoint}`);
    expect(fetcher).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("distinguishes a successful query with no process from source failures", async () => {
    const fetcher = vi.fn(async () => Response.json({ hits: { hits: [] } }));
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.status).toBe("PROCESS_NOT_FOUND");
    expect(result.httpStatus).toBe(200);
    expect(result.requestAttempted).toBe(true);
  });

  it("distinguishes a found process without public party data", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ hits: { hits: [{ _source: { numeroProcesso: "x" } }] } }),
    );
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.status).toBe("NO_PUBLIC_PARTY_DATA");
    expect(result.resultCount).toBe(1);
    expect(result.parties).toEqual([]);
  });

  it("does not deduplicate distinct party roles or claim the plaintiff is the current creditor", () => {
    const parties = extractDataJudParties({
      hits: {
        hits: [
          {
            _source: {
              partes: [
                {
                  nome: "Parte Sintética",
                  tipoParte: "REQUERENTE",
                  advogados: [{ nome: "Advogado Sintético" }],
                },
                { nome: "Parte Sintética", tipoParte: "CESSIONÁRIO" },
              ],
            },
          },
          {
            _source: {
              partes: [{ nome: "Parte Sintética", tipoParte: "REQUERENTE" }],
            },
          },
        ],
      },
    });

    expect(parties).toEqual([
      {
        name: "Parte Sintética",
        role: "REQUERENTE",
        roleEvidence: "REQUERENTE",
      },
      {
        name: "Advogado Sintético",
        role: "ADVOGADO",
        roleEvidence: "ADVOGADO",
      },
      {
        name: "Parte Sintética",
        role: "CESSIONARIO",
        roleEvidence: "CESSIONÁRIO",
      },
    ]);
  });

  it("treats API authentication failure as blocked instead of not found", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }));
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.status).toBe("SOURCE_BLOCKED");
    expect(result.requestAttempted).toBe(true);
    expect(result.status).not.toBe("PROCESS_NOT_FOUND");
  });

  it("reports malformed responses and rate limits as source failures", async () => {
    const malformed = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher: vi.fn(async () => Response.json({ unexpected: [] })),
    });
    const limited = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher: vi.fn(async () => new Response(null, { status: 429 })),
    });
    expect(malformed.status).toBe("SOURCE_UNAVAILABLE");
    expect(limited.status).toBe("RATE_LIMITED");
  });

  it("rejects an invalid configurable DataJud endpoint without sending a request", async () => {
    vi.stubEnv("DATAJUD_TJSP_ENDPOINT", "https://attacker.example/_search");
    const fetcher = vi.fn();
    const result = await dataJudAdapter.lookup({
      processNumber: validCnj,
      apiKey: "test-only",
      fetcher,
    });
    expect(result.status).toBe("SOURCE_BLOCKED");
    expect(result.requestAttempted).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts only HTTPS URLs on built-in or configured official domains", () => {
    expect(isOfficialSourceUrl("https://esaj.tjsp.jus.br/consulta")).toBe(true);
    expect(isOfficialSourceUrl("http://www.tjsp.jus.br/consulta")).toBe(false);
    expect(
      isOfficialSourceUrl("https://www.tjsp.jus.br.evil.example/consulta"),
    ).toBe(false);
    vi.stubEnv("OFFICIAL_SOURCE_DOMAINS", "portal.gov.br");
    expect(isOfficialSourceUrl("https://diario.portal.gov.br/consulta")).toBe(
      true,
    );
  });

  it("marks e-SAJ as manual-only without claiming CAPTCHA or sending a request", async () => {
    const fetcher = vi.fn();
    const result = await esajAdapter.lookup({
      processNumber: validCnj,
      fetcher,
    });

    expect(result.status).toBe("MANUAL_REQUIRED");
    expect(result.failureReason).not.toContain("CAPTCHA");
    expect(result.sourceUrl).toContain("esaj.tjsp.jus.br");
    expect(result.requestAttempted).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("runs adapters sequentially and preserves each source outcome", async () => {
    const order: string[] = [];
    const adapters = [
      {
        id: "datajud" as const,
        async lookup() {
          order.push("datajud");
          return dataJudAdapter.lookup({
            processNumber: validCnj,
            apiKey: "",
          });
        },
      },
      {
        id: "tjsp-esaj" as const,
        async lookup() {
          order.push("esaj");
          return esajAdapter.lookup({ processNumber: validCnj });
        },
      },
    ];
    const results = await investigateAllowedSources({
      processNumber: validCnj,
      adapters,
    });
    expect(order).toEqual(["datajud", "esaj"]);
    expect(results.map((result) => result.status)).toEqual([
      "DATAJUD_KEY_NOT_CONFIGURED",
      "MANUAL_REQUIRED",
    ]);
  });
});
