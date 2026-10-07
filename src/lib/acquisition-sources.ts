export type SourceLookupStatus =
  | "PROCESS_FOUND"
  | "PROCESS_NOT_FOUND"
  | "NO_PUBLIC_PARTY_DATA"
  | "INVALID_IDENTIFIER"
  | "DATAJUD_KEY_NOT_CONFIGURED"
  | "DATAJUD_USE_NOT_AUTHORIZED"
  | "SOURCE_BLOCKED"
  | "SOURCE_BLOCKED_CAPTCHA"
  | "MANUAL_REQUIRED"
  | "SOURCE_UNAVAILABLE"
  | "DAILY_BUDGET_EXHAUSTED"
  | "RATE_LIMITED";

export type PartyRole =
  | "BENEFICIARIO"
  | "CREDOR"
  | "REQUERENTE"
  | "AUTOR"
  | "ADVOGADO"
  | "DEVEDOR"
  | "HERDEIRO"
  | "CESSIONARIO"
  | "OTHER";

export type SourceParty = {
  name: string;
  role: PartyRole;
  roleEvidence: string;
};

export type SourceLookupResult = {
  sourceId: "datajud" | "tjsp-esaj";
  status: SourceLookupStatus;
  sourceUrl: string;
  originalIdentifier: string;
  queryId: string;
  resultCount: number;
  httpStatus: number | null;
  latencyMs: number;
  requestAttempted: boolean;
  parties: SourceParty[];
  failureReason: string;
};

export type AcquisitionSourceAdapter = {
  id: SourceLookupResult["sourceId"];
  lookup(input: {
    processNumber: string;
    fetcher?: typeof fetch;
    apiKey?: string;
  }): Promise<SourceLookupResult>;
};

export type DjenStatus =
  | "FOUND"
  | "NO_RESULT"
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_BLOCKED"
  | "RATE_LIMITED"
  | "INVALID_QUERY"
  | "ERROR";

export type DjenPartyObservation = {
  name: string;
  role:
    | "CREDOR"
    | "BENEFICIARIO"
    | "REQUERENTE"
    | "AUTOR"
    | "DEVEDOR"
    | "REU"
    | "ADVOGADO"
    | "CESSIONARIO"
    | "HERDEIRO"
    | "UNKNOWN";
  roleEvidence: string;
  communicationHash: string;
};

export type DjenCommunication = {
  id: string;
  hash: string;
  processNumber: string;
  tribunal: string;
  courtUnit: string;
  communicationType: string;
  publicationDate: string;
  medio: string;
  text: string;
  textTruncated: boolean;
  sourceLink: string;
  certificateUrl: string;
  partyObservations: DjenPartyObservation[];
  contacts: Array<{ type: "EMAIL" | "PHONE"; value: string }>;
};

export type DjenLookupResult = {
  sourceId: "djen";
  status: DjenStatus;
  sourceName: "DJEN";
  sourceType: "PUBLIC_API";
  jurisdiction: "BRAZIL";
  access: "PUBLIC";
  sourceUrl: string;
  originalIdentifier: string;
  queryId: string;
  queriedAt: string;
  resultCount: number;
  httpStatus: number | null;
  latencyMs: number;
  requestAttempted: boolean;
  rateLimitLimit: number | null;
  rateLimitRemaining: number | null;
  communications: DjenCommunication[];
  failureReason: string;
};

export type DjenSourceAdapter = {
  id: "djen";
  lookup(input: {
    processNumber: string;
    fetcher?: typeof fetch;
  }): Promise<DjenLookupResult>;
};

const DEFAULT_DATAJUD_ENDPOINT =
  "https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search";
const DJEN_API_BASE = "https://hcomunicaapi.cnj.jus.br/api/v1";
const DJEN_QUERY_ENDPOINT = `${DJEN_API_BASE}/comunicacao`;
const ESAJ_CONSULTATION_URL =
  "https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do";
const DATAJUD_TIMEOUT_MS = 8_000;
const DJEN_TIMEOUT_MS = 12_000;
const BUILT_IN_OFFICIAL_DOMAINS = [
  "tjsp.jus.br",
  "cnj.jus.br",
  "trf3.jus.br",
  "campinas.sp.gov.br",
  "guarulhos.sp.gov.br",
  "prefeitura.sp.gov.br",
  "oab.org.br",
];

export function normalizeCnjProcessNumber(value: string) {
  const identifier = value.trim();
  if (
    !/^(?:\d{20}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$/.test(identifier)
  ) {
    return "";
  }
  return identifier.replace(/\D/g, "");
}

export function isValidCnjProcessNumber(value: string) {
  const digits = normalizeCnjProcessNumber(value);
  if (!/^\d{20}$/.test(digits)) return false;

  const sequence = digits.slice(0, 7);
  const segment = digits.slice(13, 14);
  if (Number(segment) < 1 || Number(segment) > 9) return false;

  const remainderInput = `${sequence}${digits.slice(9)}00`;
  const checkDigits = BigInt(98) - (BigInt(remainderInput) % BigInt(97));
  return Number(digits.slice(7, 9)) === Number(checkDigits);
}

export function isOfficialSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return false;
    }
    const configuredDomains = (process.env.OFFICIAL_SOURCE_DOMAINS || "")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => /^[a-z0-9.-]+$/.test(domain) && !domain.startsWith("."));
    const allowedDomains = [...BUILT_IN_OFFICIAL_DOMAINS, ...configuredDomains];
    const hostname = url.hostname.toLowerCase();
    return allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function configuredDataJudEndpoint() {
  const endpoint =
    process.env.DATAJUD_TJSP_ENDPOINT?.trim() || DEFAULT_DATAJUD_ENDPOINT;
  try {
    const url = new URL(endpoint);
    if (
      url.protocol === "https:" &&
      url.hostname === "api-publica.datajud.cnj.jus.br" &&
      url.pathname.endsWith("/_search") &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443")
    ) {
      return url.toString();
    }
  } catch {
    // Invalid endpoint configuration is reported by the adapter.
  }
  return null;
}

function isDataJudResponse(
  payload: unknown,
): payload is { hits: { hits: unknown[] } } {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "hits" in payload &&
      payload.hits &&
      typeof payload.hits === "object" &&
      "hits" in payload.hits &&
      Array.isArray(payload.hits.hits),
  );
}

function roleFor(value: string): PartyRole {
  const role = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (role.includes("CESSION")) return "CESSIONARIO";
  if (role.includes("HERDEIR") || role.includes("SUCESS")) return "HERDEIRO";
  if (role.includes("ADVOG")) return "ADVOGADO";
  if (role.includes("DEVED") || role.includes("PASSIV")) return "DEVEDOR";
  if (role.includes("BENEFICI")) return "BENEFICIARIO";
  if (role.includes("CREDOR")) return "CREDOR";
  if (role === "P" || role.includes("DEVED") || role.includes("PASSIV")) {
    return "DEVEDOR";
  }
  if (role.includes("REQUER") || role === "A") return "REQUERENTE";
  if (role.includes("AUTOR")) return "AUTOR";
  return "OTHER";
}

export function extractDataJudParties(payload: unknown): SourceParty[] {
  if (!isDataJudResponse(payload)) return [];
  const candidates = new Map<string, SourceParty>();
  for (const hit of payload.hits.hits) {
    if (!hit || typeof hit !== "object" || !("_source" in hit)) continue;
    const source = hit._source;
    if (!source || typeof source !== "object") continue;
    const rawParties = "partes" in source ? source.partes : undefined;
    if (!Array.isArray(rawParties)) continue;
    for (const party of rawParties) {
      if (!party || typeof party !== "object") continue;
      const name = "nome" in party ? String(party.nome || "").trim() : "";
      if (!name) continue;
      const roleEvidence =
        ("tipoParte" in party ? String(party.tipoParte || "") : "") ||
        ("polo" in party ? String(party.polo || "") : "");
      const role = roleFor(roleEvidence);
      const key = `${name.toLocaleLowerCase("pt-BR")}|${role}|${roleEvidence}`;
      candidates.set(key, { name, role, roleEvidence });

      const attorneys = "advogados" in party ? party.advogados : undefined;
      if (!Array.isArray(attorneys)) continue;
      for (const attorney of attorneys) {
        if (!attorney || typeof attorney !== "object" || !("nome" in attorney)) {
          continue;
        }
        const attorneyName = String(attorney.nome || "").trim();
        if (!attorneyName) continue;
        const attorneyKey = `${attorneyName.toLocaleLowerCase("pt-BR")}|ADVOGADO|ADVOGADO`;
        candidates.set(attorneyKey, {
          name: attorneyName,
          role: "ADVOGADO",
          roleEvidence: "ADVOGADO",
        });
      }
    }
  }
  return [...candidates.values()];
}

function djenText(value: unknown, maximumLength = 4_000) {
  const decodeCodePoint = (value: number) =>
    Number.isInteger(value) && value >= 0 && value <= 0x10ffff &&
    !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value)
      : "";
  const raw = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|section|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&#(\d+);/g, (_, code: string) =>
      decodeCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      decodeCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
  return {
    text: raw.slice(0, maximumLength),
    textTruncated: raw.length > maximumLength,
  };
}

function djenRole(value: string): DjenPartyObservation["role"] {
  const role = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (role.includes("BENEFICI")) return "BENEFICIARIO";
  if (role.includes("CREDOR")) return "CREDOR";
  if (role.includes("REQUER")) return "REQUERENTE";
  if (role.includes("AUTOR")) return "AUTOR";
  if (role.includes("DEVED")) return "DEVEDOR";
  if (role === "REU" || role.includes("REQUERIDO")) return "REU";
  if (role.includes("ADVOG")) return "ADVOGADO";
  if (role.includes("CESSION")) return "CESSIONARIO";
  if (role.includes("HERDEIR") || role.includes("SUCESS")) return "HERDEIRO";
  return "UNKNOWN";
}

function djenPartyObservations(
  item: Record<string, unknown>,
  text: string,
  communicationHash: string,
): DjenPartyObservation[] {
  const observations = new Map<string, DjenPartyObservation>();
  const add = (name: unknown, roleEvidence: string) => {
    const partyName = String(name || "").trim();
    if (!partyName) return;
    const role = djenRole(roleEvidence);
    const key = `${partyName.toLocaleLowerCase("pt-BR")}|${role}|${roleEvidence}`;
    observations.set(key, { name: partyName, role, roleEvidence, communicationHash });
  };

  const recipients = Array.isArray(item.destinatarios) ? item.destinatarios : [];
  for (const recipient of recipients) {
    if (!recipient || typeof recipient !== "object") continue;
    const candidate = recipient as Record<string, unknown>;
    add(
      candidate.nome,
      `Destinatário DJEN; polo ${String(candidate.polo || "não informado")}`,
    );
  }

  const attorneys = Array.isArray(item.destinatarioadvogados)
    ? item.destinatarioadvogados
    : [];
  for (const entry of attorneys) {
    if (!entry || typeof entry !== "object") continue;
    const attorney = (entry as Record<string, unknown>).advogado;
    if (attorney && typeof attorney === "object") {
      add(
        (attorney as Record<string, unknown>).nome,
        "Advogado indicado como destinatário da comunicação",
      );
    }
  }

  const explicitRolePattern =
    /\b(CREDOR(?:A)?|BENEFICI[ÁA]RIO(?:A)?|REQUERENTE|AUTOR(?:A)?|DEVEDOR(?:A)?|R[EÉ]U|REQUERIDO(?:A)?|ADVOGADO(?:A)?|CESSION[ÁA]RIO(?:A)?|HERDEIR[OA]|SUCESSOR(?:A)?)\s*[:\-]\s*([^;\n<]+)/giu;
  for (const match of text.matchAll(explicitRolePattern)) {
    add(match[2], match[1]);
  }

  return [...observations.values()];
}

function djenContactObservations(text: string) {
  const contacts = new Map<string, { type: "EMAIL" | "PHONE"; value: string }>();
  for (const match of text.matchAll(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  )) {
    const value = match[0].slice(0, 320);
    contacts.set(`EMAIL|${value.toLowerCase()}`, { type: "EMAIL", value });
  }
  for (const match of text.matchAll(
    /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)9?\d{4}[-\s]?\d{4}\b/g,
  )) {
    const value = match[0].trim().slice(0, 40);
    contacts.set(`PHONE|${value}`, { type: "PHONE", value });
  }
  return [...contacts.values()];
}

function mapDjenCommunication(value: unknown): DjenCommunication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const hash = String(item.hash || "").trim();
  const { text, textTruncated } = djenText(item.texto);
  const rawLink = String(item.link || "").trim();
  const sourceLink = rawLink.startsWith("https://") ? rawLink : "";
  const certificateUrl = hash
    ? `${DJEN_API_BASE}/comunicacao/${encodeURIComponent(hash)}/certidao`
    : "";
  return {
    id: String(item.id ?? ""),
    hash,
    processNumber: String(item.numero_processo || ""),
    tribunal: String(item.siglaTribunal || ""),
    courtUnit: String(item.nomeOrgao || ""),
    communicationType: String(item.tipoComunicacao || ""),
    publicationDate: String(item.data_disponibilizacao || ""),
    medio: String(item.meiocompleto || item.meio || ""),
    text,
    textTruncated,
    sourceLink,
    certificateUrl,
    partyObservations: djenPartyObservations(item, text, hash),
    contacts: djenContactObservations(text),
  };
}

function parseRateLimitHeader(value: string | null) {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

export const djenAdapter: DjenSourceAdapter = {
  id: "djen",
  async lookup({ processNumber, fetcher = fetch }) {
    const originalIdentifier = processNumber.trim();
    const queryId = normalizeCnjProcessNumber(originalIdentifier);
    const queriedAt = new Date().toISOString();
    const url = new URL(DJEN_QUERY_ENDPOINT);
    if (queryId) {
      url.searchParams.set("numeroProcesso", queryId);
      url.searchParams.set("pagina", "1");
      url.searchParams.set("itensPorPagina", "100");
    }
    const base = {
      sourceId: "djen" as const,
      sourceName: "DJEN" as const,
      sourceType: "PUBLIC_API" as const,
      jurisdiction: "BRAZIL" as const,
      access: "PUBLIC" as const,
      sourceUrl: url.toString(),
      originalIdentifier,
      queryId,
      queriedAt,
      resultCount: 0,
      httpStatus: null,
      latencyMs: 0,
      requestAttempted: false,
      rateLimitLimit: null,
      rateLimitRemaining: null,
      communications: [] as DjenCommunication[],
    };
    if (!isValidCnjProcessNumber(originalIdentifier)) {
      return {
        ...base,
        status: "INVALID_QUERY" as const,
        failureReason: "Identificador não atende à estrutura e ao dígito verificador CNJ.",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DJEN_TIMEOUT_MS);
    const startedAt = Date.now();
    let parsingResponse = false;
    try {
      const response = await fetcher(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      const rateLimitLimit = parseRateLimitHeader(
        response.headers.get("x-ratelimit-limit"),
      );
      const rateLimitRemaining = parseRateLimitHeader(
        response.headers.get("x-ratelimit-remaining"),
      );
      if (response.status === 429) {
        return {
          ...base,
          status: "RATE_LIMITED" as const,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: "DJEN respondeu HTTP 429; aguardar pelo menos 60 segundos antes de retomar.",
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ...base,
          status: "SOURCE_BLOCKED" as const,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: `DJEN bloqueou a consulta (HTTP ${response.status}).`,
        };
      }
      if (!response.ok) {
        return {
          ...base,
          status: "SOURCE_UNAVAILABLE" as const,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: `DJEN respondeu HTTP ${response.status}.`,
        };
      }

      parsingResponse = true;
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== "object" ||
        !("items" in payload) ||
        !Array.isArray(payload.items)
      ) {
        return {
          ...base,
          status: "ERROR" as const,
          httpStatus: response.status,
          latencyMs: Date.now() - startedAt,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: "Resposta DJEN sem a lista de comunicações documentada.",
        };
      }
      if (
        "status" in payload &&
        typeof payload.status === "string" &&
        !["success", "ok"].includes(payload.status.trim().toLowerCase())
      ) {
        return {
          ...base,
          status: "ERROR" as const,
          httpStatus: response.status,
          latencyMs: Date.now() - startedAt,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: "DJEN retornou uma resposta de erro com HTTP 200.",
        };
      }

      const parsedCommunications = payload.items
        .map(mapDjenCommunication)
        .filter((item): item is DjenCommunication => item !== null);
      if (parsedCommunications.length !== payload.items.length) {
        return {
          ...base,
          status: "ERROR" as const,
          httpStatus: response.status,
          latencyMs: Date.now() - startedAt,
          requestAttempted: true,
          rateLimitLimit,
          rateLimitRemaining,
          failureReason: "Uma ou mais comunicações DJEN têm formato inválido.",
        };
      }
      const distinctCommunications = new Map<string, DjenCommunication>();
      for (const communication of parsedCommunications) {
        const key = communication.hash || communication.id;
        distinctCommunications.set(key || JSON.stringify(communication), communication);
      }
      const communications = [...distinctCommunications.values()];
      return {
        ...base,
        status: communications.length ? "FOUND" as const : "NO_RESULT" as const,
        httpStatus: response.status,
        latencyMs: Date.now() - startedAt,
        requestAttempted: true,
        rateLimitLimit,
        rateLimitRemaining,
        resultCount: communications.length,
        communications,
        failureReason: "",
      };
    } catch (error) {
      return {
        ...base,
        status: parsingResponse ? "ERROR" as const : "SOURCE_UNAVAILABLE" as const,
        latencyMs: Date.now() - startedAt,
        requestAttempted: true,
        failureReason:
          parsingResponse
            ? "DJEN respondeu, mas o corpo não pôde ser interpretado como JSON."
            : error instanceof Error ? error.message.slice(0, 240) : "Falha de rede DJEN.",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const dataJudAdapter: AcquisitionSourceAdapter = {
  id: "datajud",
  async lookup({
    processNumber,
    fetcher = fetch,
    apiKey = process.env.DATAJUD_PUBLIC_API_KEY,
  }) {
    const originalIdentifier = processNumber;
    const queryId = normalizeCnjProcessNumber(processNumber);
    const endpoint = configuredDataJudEndpoint();
    const base = {
      sourceId: "datajud" as const,
      originalIdentifier,
      queryId,
      resultCount: 0,
      httpStatus: null,
      latencyMs: 0,
      requestAttempted: false,
      parties: [] as SourceParty[],
    };
    if (!isValidCnjProcessNumber(processNumber)) {
      return {
        ...base,
        status: "INVALID_IDENTIFIER" as const,
        sourceUrl: endpoint || DEFAULT_DATAJUD_ENDPOINT,
        failureReason: "Identificador não atende à estrutura e ao dígito verificador CNJ.",
      };
    }
    if (!endpoint) {
      return {
        ...base,
        status: "SOURCE_BLOCKED" as const,
        sourceUrl: process.env.DATAJUD_TJSP_ENDPOINT || "",
        failureReason:
          "DATAJUD_TJSP_ENDPOINT deve usar HTTPS no host oficial da API pública DataJud.",
      };
    }
    if (process.env.DATAJUD_COMMERCIAL_USE_AUTHORIZED !== "true") {
      return {
        ...base,
        status: "DATAJUD_USE_NOT_AUTHORIZED" as const,
        sourceUrl: endpoint,
        failureReason:
          "Disponível tecnicamente / uso comercial sujeito a autorização; nenhuma requisição foi enviada.",
      };
    }
    if (!apiKey?.trim()) {
      return {
        ...base,
        status: "DATAJUD_KEY_NOT_CONFIGURED" as const,
        sourceUrl: endpoint,
        failureReason:
          "DATAJUD_PUBLIC_API_KEY não configurada; nenhuma requisição foi enviada.",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const response = await fetcher(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `APIKey ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            size: 5,
            _source: [
              "numeroProcesso",
              "tribunal",
              "grau",
              "dataAjuizamento",
              "nivelSigilo",
              "partes",
            ],
            query: { term: { numeroProcesso: queryId } },
          }),
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        },
      );
      let latencyMs = Date.now() - startedAt;
      if (response.status >= 300 && response.status < 400) {
        return {
          ...base,
          status: "SOURCE_BLOCKED" as const,
          sourceUrl: endpoint,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          failureReason: "DataJud respondeu com redirecionamento; resposta bloqueada.",
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ...base,
          status: "SOURCE_BLOCKED" as const,
          sourceUrl: endpoint,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          failureReason: `DataJud bloqueou a requisição (HTTP ${response.status}).`,
        };
      }
      if (!response.ok) {
        return {
          ...base,
          status: response.status === 429 ? "RATE_LIMITED" as const : "SOURCE_UNAVAILABLE" as const,
          sourceUrl: endpoint,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          failureReason: `DataJud respondeu HTTP ${response.status}.`,
        };
      }

      const payload: unknown = await response.json();
      latencyMs = Date.now() - startedAt;
      if (!isDataJudResponse(payload)) {
        return {
          ...base,
          status: "SOURCE_UNAVAILABLE" as const,
          sourceUrl: endpoint,
          httpStatus: response.status,
          latencyMs,
          requestAttempted: true,
          failureReason: "Resposta DataJud sem o formato esperado.",
        };
      }
      const hits = payload.hits.hits;
      const parties = extractDataJudParties(payload);
      return {
        ...base,
        status: !hits.length
          ? "PROCESS_NOT_FOUND" as const
          : parties.length
            ? "PROCESS_FOUND" as const
            : "NO_PUBLIC_PARTY_DATA" as const,
        sourceUrl: endpoint,
        resultCount: hits.length,
        httpStatus: response.status,
        latencyMs,
        requestAttempted: true,
        parties,
        failureReason: "",
      };
    } catch (error) {
      return {
        ...base,
        status: "SOURCE_UNAVAILABLE" as const,
        sourceUrl: endpoint,
        latencyMs: Date.now() - startedAt,
        requestAttempted: true,
        failureReason:
          error instanceof Error
            ? error.message.slice(0, 240)
            : "Falha de rede DataJud.",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const esajAdapter: AcquisitionSourceAdapter = {
  id: "tjsp-esaj",
  async lookup({ processNumber }) {
    const originalIdentifier = processNumber;
    return {
      sourceId: "tjsp-esaj",
      status: "MANUAL_REQUIRED",
      sourceUrl: ESAJ_CONSULTATION_URL,
      originalIdentifier,
      queryId: normalizeCnjProcessNumber(processNumber),
      resultCount: 0,
      httpStatus: null,
      latencyMs: 0,
      requestAttempted: false,
      parties: [],
      failureReason:
        "Consulta automatizada não habilitada; nenhuma requisição foi enviada.",
    };
  },
};

export async function investigateAllowedSources(input: {
  processNumber: string;
  fetcher?: typeof fetch;
  dataJudApiKey?: string;
  adapters?: AcquisitionSourceAdapter[];
}) {
  const adapters = input.adapters ?? [dataJudAdapter, esajAdapter];
  const results: SourceLookupResult[] = [];
  for (const adapter of adapters) {
    results.push(
      await adapter.lookup({
        processNumber: input.processNumber,
        fetcher: input.fetcher,
        apiKey: input.dataJudApiKey,
      }),
    );
  }
  return results;
}
