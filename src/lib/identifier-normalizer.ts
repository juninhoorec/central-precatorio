/**
 * PHASE 2 — DETERMINISTIC IDENTIFIER NORMALIZER
 *
 * Rules:
 *   1. Always preserve the original identifier.
 *   2. Transformations are deterministic: same input → same output.
 *   3. Never infer missing legal facts.
 *   4. Never convert absence into a legal conclusion.
 *   5. When normalization is uncertain, mark as UNRESOLVABLE.
 *   6. Punctuation/whitespace differences are normalized away deterministically.
 */

import type { NormalizedIdentifier } from "./research-pipeline";
import { isValidCnjProcessNumber, normalizeCnjProcessNumber } from "./acquisition-sources";

// ---------------------------------------------------------------------------
// CNJ process number normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a CNJ process number to 20 raw digits.
 * Only accepts the two canonical formats:
 *   - formatted: NNNNNNN-DD.AAAA.J.TT.OOOO
 *   - raw digits: 20 consecutive digits
 *
 * Preserves the original. Returns UNRESOLVABLE if the input does not
 * pass structural+check-digit validation.
 */
export function normalizeCnjIdentifier(value: string): NormalizedIdentifier {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) {
    return { original, normalized: null, method: "UNRESOLVABLE", unresolvedReason: "Identificador vazio." };
  }
  if (isValidCnjProcessNumber(trimmed)) {
    return {
      original,
      normalized: normalizeCnjProcessNumber(trimmed),
      method: "CNJ_DIGITS_ONLY",
      unresolvedReason: null,
    };
  }
  // Attempt: strip all non-digits and see if the result is a valid 20-digit CNJ
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 20 && isValidCnjProcessNumber(digitsOnly)) {
    return {
      original,
      normalized: digitsOnly,
      method: "CNJ_DIGITS_ONLY",
      unresolvedReason: null,
    };
  }
  return {
    original,
    normalized: null,
    method: "UNRESOLVABLE",
    unresolvedReason: `Identificador '${trimmed.slice(0, 60)}' não passou na validação estrutural e no dígito verificador CNJ.`,
  };
}

// ---------------------------------------------------------------------------
// DEPRE process number normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a DEPRE process number.
 *
 * DEPRE numbers in TJSP follow two forms:
 *   - CNJ format: NNNNNNN-DD.AAAA.8.26.OOOO
 *   - Legacy format: varies (e.g. "0038850-88.2017.8.26.0500")
 *
 * Strategy: attempt CNJ validation first. If that fails, perform digit-only
 * normalization as a passthrough (no check-digit validation for non-CNJ DEPRE).
 */
export function normalizeDepreIdentifier(value: string): NormalizedIdentifier {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) {
    return { original, normalized: null, method: "UNRESOLVABLE", unresolvedReason: "Identificador DEPRE vazio." };
  }
  // Try as a CNJ number first (most DEPRE numbers are CNJ-format)
  const cnj = normalizeCnjIdentifier(trimmed);
  if (cnj.method !== "UNRESOLVABLE") {
    return { ...cnj, original, method: "DEPRE_DIGITS_ONLY" };
  }
  // Fallback: digit-only passthrough
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    return {
      original,
      normalized: digitsOnly,
      method: "DEPRE_DIGITS_ONLY",
      unresolvedReason: null,
    };
  }
  return {
    original,
    normalized: null,
    method: "UNRESOLVABLE",
    unresolvedReason: `Número DEPRE '${trimmed.slice(0, 60)}' não possui dígitos suficientes para normalização.`,
  };
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a URL deterministically:
 *   - Lowercases the scheme and host.
 *   - Removes default ports.
 *   - Removes trailing slashes from the path.
 *   - Removes fragment.
 *   - Sorts query parameters by key.
 *   - Rejects non-HTTPS URLs (not official sources).
 */
export function normalizeOfficialUrl(value: string): NormalizedIdentifier {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) {
    return { original, normalized: null, method: "UNRESOLVABLE", unresolvedReason: "URL vazia." };
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return {
        original,
        normalized: null,
        method: "UNRESOLVABLE",
        unresolvedReason: `URL '${trimmed.slice(0, 80)}' não usa HTTPS; apenas URLs oficiais com HTTPS são aceitas.`,
      };
    }
    if (url.username || url.password) {
      return {
        original,
        normalized: null,
        method: "UNRESOLVABLE",
        unresolvedReason: "URL contém credenciais; rejeitada por segurança.",
      };
    }
    const host = url.hostname.toLowerCase();
    const port = url.port && url.port !== "443" ? `:${url.port}` : "";
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const params = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const normalized = `https://${host}${port}${pathname}${params ? `?${params}` : ""}`;
    return { original, normalized, method: "URL_CANONICAL", unresolvedReason: null };
  } catch {
    return {
      original,
      normalized: null,
      method: "UNRESOLVABLE",
      unresolvedReason: `URL '${trimmed.slice(0, 80)}' é inválida.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Document identifier normalization (generic)
// ---------------------------------------------------------------------------

/**
 * Normalizes a document identifier:
 *   - Trims whitespace.
 *   - Collapses internal whitespace.
 *   - Lowercases for comparison.
 *   - Preserves the original.
 *
 * Does NOT infer legal meaning. Empty → UNRESOLVABLE.
 */
export function normalizeDocumentIdentifier(value: string): NormalizedIdentifier {
  const original = value;
  const trimmed = value.trim();
  if (!trimmed) {
    return { original, normalized: null, method: "UNRESOLVABLE", unresolvedReason: "Identificador de documento vazio." };
  }
  const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
  return { original, normalized, method: "PASSTHROUGH", unresolvedReason: null };
}

// ---------------------------------------------------------------------------
// Equivalence check
// ---------------------------------------------------------------------------

/**
 * Returns true when two normalized identifiers are equivalent.
 * Both must be non-null and equal after normalization.
 * Does NOT fall back to original comparison (avoids false positives from unnormalized data).
 */
export function normalizedIdentifiersMatch(a: NormalizedIdentifier | null, b: NormalizedIdentifier | null): boolean {
  if (!a || !b) return false;
  if (a.normalized === null || b.normalized === null) return false;
  return a.normalized === b.normalized;
}
