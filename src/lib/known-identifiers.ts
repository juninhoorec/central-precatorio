/**
 * PHASE 7 — BLOCKER-7-02
 * KNOWN IDENTIFIERS EXTRACTOR
 *
 * Deterministic, safe extraction of known identifiers from an operation's
 * workflow JSON.
 *
 * INVARIANTS:
 *   1. DEPRE remains the primary identifier — not replaced by any derived field.
 *   2. numeroProcessoOrigem ≠ DEPRE — they are different concepts.
 *   3. EPES is a distinct identifier — not automatically equivalent to the origin process.
 *   4. Missing fields remain missing — no fabrication.
 *   5. Null, empty string, "null", "undefined" → treated as absent.
 *   6. Duplicate values are deduplicated.
 *   7. Malformed values are rejected with a reason — not silently accepted.
 *   8. Every extracted identifier retains its source path for provenance.
 */

/** Supported known identifier types. */
export type KnownIdentifierType =
  | "DEPRE"
  | "PROCESSO_ORIGINARIO"
  | "EPES"
  | "TITULAR_NAME"
  | "DOCUMENT_REFERENCE";

/** A single extracted identifier with full provenance. */
export type KnownIdentifier = {
  type: KnownIdentifierType;
  /** Raw value as found in the workflow JSON. */
  value: string;
  /** Normalized value for search/comparison (trimmed, whitespace-collapsed). */
  normalizedValue: string;
  /** JSON path that produced this value (e.g. "$.credit.numeroProcessoOrigem"). */
  sourcePath: string;
};

/** Result of extracting known identifiers from a workflow. */
export type KnownIdentifiersResult = {
  identifiers: KnownIdentifier[];
  /** Fields that were present but empty/null — for transparency. */
  absentFields: Array<{ path: string; reason: "NULL" | "EMPTY" | "MALFORMED" }>;
};

/** Map of identifier type to compatible input structure for manual-research module. */
export type KnownIdentifiersCompat = {
  originProcessNumber?: string;
  epesNumber?: string;
  beneficiaryCandidateName?: string;
  documentReference?: string;
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Known "absent" sentinel values that must be treated as missing. */
const ABSENT_SENTINELS = new Set(["", "null", "undefined", "n/a", "na", "não informado", "nao informado"]);

function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return ABSENT_SENTINELS.has(s);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Validate a CNJ process number format: NNNNNNN-DD.AAAA.J.TT.OOOO
 * Accepts both punctuated and raw (digits-only) forms.
 * Returns the normalized value or null if malformed.
 */
function validateCnjProcessNumber(value: string): string | null {
  const stripped = value.replace(/\D/g, "");
  if (stripped.length !== 20) return null;
  // Re-punctuate to canonical CNJ format
  return `${stripped.slice(0, 7)}-${stripped.slice(7, 9)}.${stripped.slice(9, 13)}.${stripped.slice(13, 14)}.${stripped.slice(14, 16)}.${stripped.slice(16)}`;
}

/**
 * Safe JSON parse of a workflow value (string or object).
 */
function parseWorkflow(workflow: unknown): Record<string, unknown> {
  if (typeof workflow === "string") {
    try {
      return JSON.parse(workflow) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof workflow === "object" && workflow !== null && !Array.isArray(workflow)) {
    return workflow as Record<string, unknown>;
  }
  return {};
}

function getPath(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract all known identifiers from a raw workflow JSON value.
 *
 * Extraction paths:
 *   $.credit.numeroProcessoDEPRE           → DEPRE
 *   $.credit.numeroProcessoOrigem          → PROCESSO_ORIGINARIO  (Phase 6 path)
 *   $.credit.originProcessNumber           → PROCESSO_ORIGINARIO  (legacy path)
 *   $.credit.numeroEPES                    → EPES                (Phase 6 path)
 *   $.credit.epesNumber                    → EPES                (legacy path)
 *   $.titular.nomeBeneficiario             → TITULAR_NAME        (Phase 6 path)
 *   $.client.name                          → TITULAR_NAME        (legacy path)
 *   $.credit.documentReference             → DOCUMENT_REFERENCE
 */
export function extractKnownIdentifiers(workflow: unknown): KnownIdentifiersResult {
  const wf = parseWorkflow(workflow);
  const credit = parseWorkflow(getPath(wf, "credit"));
  const titular = parseWorkflow(getPath(wf, "titular"));
  const client = parseWorkflow(getPath(wf, "client"));

  const identifiers: KnownIdentifier[] = [];
  const absentFields: KnownIdentifiersResult["absentFields"] = [];
  const seenNormalized = new Set<string>(); // deduplication by type+normalized

  function tryAdd(
    type: KnownIdentifierType,
    rawValue: unknown,
    sourcePath: string,
    validator?: (v: string) => string | null,
  ) {
    if (isAbsent(rawValue)) {
      absentFields.push({ path: sourcePath, reason: "NULL" });
      return;
    }
    const raw = String(rawValue);
    const normalized = normalize(raw);
    if (!normalized) {
      absentFields.push({ path: sourcePath, reason: "EMPTY" });
      return;
    }

    let finalValue = normalized;
    if (validator) {
      const validated = validator(normalized);
      if (!validated) {
        absentFields.push({ path: sourcePath, reason: "MALFORMED" });
        return;
      }
      finalValue = validated;
    }

    const dedupeKey = `${type}|${finalValue.toLowerCase()}`;
    if (seenNormalized.has(dedupeKey)) return; // duplicate
    seenNormalized.add(dedupeKey);

    identifiers.push({ type, value: raw, normalizedValue: finalValue, sourcePath });
  }

  // DEPRE — primary identifier
  tryAdd("DEPRE", getPath(credit, "numeroProcessoDEPRE"), "$.credit.numeroProcessoDEPRE", validateCnjProcessNumber);

  // PROCESSO_ORIGINARIO — distinct from DEPRE
  tryAdd("PROCESSO_ORIGINARIO", getPath(credit, "numeroProcessoOrigem"), "$.credit.numeroProcessoOrigem", validateCnjProcessNumber);
  tryAdd("PROCESSO_ORIGINARIO", getPath(credit, "originProcessNumber"), "$.credit.originProcessNumber", validateCnjProcessNumber);

  // EPES
  tryAdd("EPES", getPath(credit, "numeroEPES"), "$.credit.numeroEPES");
  tryAdd("EPES", getPath(credit, "epesNumber"), "$.credit.epesNumber");

  // TITULAR_NAME — never used for identity confirmation alone
  tryAdd("TITULAR_NAME", getPath(titular, "nomeBeneficiario"), "$.titular.nomeBeneficiario");
  tryAdd("TITULAR_NAME", getPath(client, "name"), "$.client.name");

  // DOCUMENT_REFERENCE
  tryAdd("DOCUMENT_REFERENCE", getPath(credit, "documentReference"), "$.credit.documentReference");

  return { identifiers, absentFields };
}

/**
 * Convert extracted identifiers to the compat format expected by
 * GenerateManualTaskInput.knownIdentifiers.
 *
 * Only the first found value per type is used (highest-priority source path wins).
 * DEPRE is NOT included here — it is passed separately as the primary identifier.
 */
export function toKnownIdentifiersCompat(result: KnownIdentifiersResult): KnownIdentifiersCompat {
  const find = (type: KnownIdentifierType) =>
    result.identifiers.find((i) => i.type === type)?.normalizedValue;

  return {
    originProcessNumber: find("PROCESSO_ORIGINARIO"),
    epesNumber: find("EPES"),
    beneficiaryCandidateName: find("TITULAR_NAME"),
    documentReference: find("DOCUMENT_REFERENCE"),
  };
}

/**
 * Extract known identifiers from a workflow and return them in compat format.
 * Convenience wrapper combining extractKnownIdentifiers + toKnownIdentifiersCompat.
 */
export function extractKnownIdentifiersCompat(workflow: unknown): KnownIdentifiersCompat {
  return toKnownIdentifiersCompat(extractKnownIdentifiers(workflow));
}
