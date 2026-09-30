/**
 * PHASE 2 — DETERMINISTIC EVIDENCE RESOLVER
 *
 * Resolves EvidenceCandidates against persisted OfficialEvidenceDocuments
 * using deterministic matching — NO fuzzy semantic matching.
 *
 * Resolution order (highest confidence first):
 *   1. HASH_MATCH              — SHA-256 content hash equality
 *   2. EXACT_DOCUMENT_IDENTIFIER — normalized documentIdentifier equality
 *   3. EXACT_DEPRE_MATCH       — normalized DEPRE/CNJ process number equality
 *   4. EXACT_SOURCE_REFERENCE  — source + reference combination equality
 *   5. EXACT_OFFICIAL_URL      — normalized official URL equality
 *   6. UNRESOLVED              — no deterministic match possible
 *
 * INVARIANTS:
 *   - No fuzzy semantic matching.
 *   - If resolution cannot be established deterministically, evidenceId = null.
 *   - The same document from two routes → deduplicated to one resolved evidence item.
 *   - AI does NOT participate in this layer.
 */

import type { EvidenceCandidate, EvidenceResolutionReason, ResolvedEvidence } from "./research-pipeline";
import type { OfficialEvidenceDocument } from "./autonomous-acquisition";
import { countVerifiedOfficialEvidence } from "./autonomous-acquisition";
import {
  normalizeDepreIdentifier,
  normalizeDocumentIdentifier,
  normalizeOfficialUrl,
  normalizedIdentifiersMatch,
} from "./identifier-normalizer";

// ---------------------------------------------------------------------------
// Qualification helpers (delegates to countVerifiedOfficialEvidence)
// ---------------------------------------------------------------------------

const QUALIFYING_DOCUMENT_TYPES = new Set(["OFICIO_REQUISITORIO", "OFICIO_COMPLEMENTAR"]);

/**
 * Returns whether an evidence document qualifies for DOCUMENTAÇÃO 2/2.
 * This mirrors the logic inside countVerifiedOfficialEvidence without re-implementing it.
 * The authoritative count always comes from countVerifiedOfficialEvidence.
 */
function isQualifyingForDocumentation(doc: OfficialEvidenceDocument): boolean {
  if (doc.status !== "VERIFIED") return false;
  if (doc.evidenceStrength !== "STRONG") return false;
  if (!QUALIFYING_DOCUMENT_TYPES.has(doc.documentType)) return false;
  // URL check: must be official. We replicate the structural check here,
  // but countVerifiedOfficialEvidence remains authoritative for the count.
  try {
    const url = new URL(doc.sourceUrl);
    if (url.protocol !== "https:") return false;
    const officialDomains = ["tjsp.jus.br", "cnj.jus.br", "trf3.jus.br"];
    const configuredDomains = (process.env.OFFICIAL_SOURCE_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter((d) => /^[a-z0-9.-]+$/.test(d) && !d.startsWith("."));
    const hostname = url.hostname.toLowerCase();
    const isOfficial = [...officialDomains, ...configuredDomains].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (!isOfficial) return false;
  } catch {
    return false;
  }
  const docId = doc.documentIdentifier.trim();
  const ref = doc.reference.trim();
  return Boolean(docId || ref);
}

function qualificationRationale(doc: OfficialEvidenceDocument): string {
  if (doc.status !== "VERIFIED") return `Status '${doc.status}' não é VERIFIED; não qualifica.`;
  if (doc.evidenceStrength !== "STRONG") return `Força '${doc.evidenceStrength}' não é STRONG; não qualifica.`;
  if (!QUALIFYING_DOCUMENT_TYPES.has(doc.documentType)) return `Tipo '${doc.documentType}' não é qualificador (somente OFICIO_REQUISITORIO ou OFICIO_COMPLEMENTAR); não qualifica.`;
  return "Qualifica para DOCUMENTAÇÃO 2/2 (status VERIFIED, strength STRONG, tipo qualificador, URL oficial).";
}

// ---------------------------------------------------------------------------
// Single-candidate resolution against a set of official evidence documents
// ---------------------------------------------------------------------------

type MatchResult = {
  doc: OfficialEvidenceDocument;
  reason: EvidenceResolutionReason;
};

function tryMatchCandidate(
  candidate: EvidenceCandidate,
  existingDocs: OfficialEvidenceDocument[],
): MatchResult | null {
  // 1. Hash match (strongest — content equality)
  if (candidate.contentHash) {
    const hashMatch = existingDocs.find(
      (doc) => doc.hash && doc.hash.toLowerCase() === candidate.contentHash!.toLowerCase(),
    );
    if (hashMatch) return { doc: hashMatch, reason: "HASH_MATCH" };
  }

  // 2. Exact normalized document identifier match
  if (candidate.documentIdentifier) {
    const normCandidate = normalizeDocumentIdentifier(candidate.documentIdentifier);
    if (normCandidate.normalized) {
      const idMatch = existingDocs.find((doc) => {
        if (!doc.documentIdentifier.trim()) return false;
        const normDoc = normalizeDocumentIdentifier(doc.documentIdentifier);
        return normalizedIdentifiersMatch(normCandidate, normDoc);
      });
      if (idMatch) return { doc: idMatch, reason: "EXACT_DOCUMENT_IDENTIFIER" };
    }
  }

  // 3. Exact DEPRE/CNJ process number match via acquisition result route
  const requestedId = candidate.acquisitionResultRef.sourceUrl ?? "";
  if (requestedId) {
    const normCandidate = normalizeDepreIdentifier(requestedId);
    if (normCandidate.normalized) {
      const depreMatch = existingDocs.find((doc) => {
        if (!doc.documentIdentifier.trim()) return false;
        const normDoc = normalizeDepreIdentifier(doc.documentIdentifier);
        return normalizedIdentifiersMatch(normCandidate, normDoc);
      });
      if (depreMatch) return { doc: depreMatch, reason: "EXACT_DEPRE_MATCH" };
    }
  }

  // 4. Exact source + reference match
  if (candidate.reference && candidate.acquisitionResultRef.source) {
    const ref = candidate.reference.trim().toLowerCase();
    const src = candidate.acquisitionResultRef.source.trim().toLowerCase();
    if (ref && src) {
      const refMatch = existingDocs.find(
        (doc) =>
          doc.reference.trim().toLowerCase() === ref &&
          doc.source.trim().toLowerCase() === src,
      );
      if (refMatch) return { doc: refMatch, reason: "EXACT_SOURCE_REFERENCE" };
    }
  }

  // 5. Exact official URL match (normalized)
  if (candidate.officialSourceUrl) {
    const normCandidate = normalizeOfficialUrl(candidate.officialSourceUrl);
    if (normCandidate.normalized) {
      const urlMatch = existingDocs.find((doc) => {
        if (!doc.sourceUrl.trim()) return false;
        const normDoc = normalizeOfficialUrl(doc.sourceUrl);
        return normalizedIdentifiersMatch(normCandidate, normDoc);
      });
      if (urlMatch) return { doc: urlMatch, reason: "EXACT_OFFICIAL_URL" };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public resolution API
// ---------------------------------------------------------------------------

/**
 * Resolves a list of evidence candidates against persisted official evidence records.
 *
 * Deduplication: if two candidates resolve to the same evidenceId,
 * only the first (highest-priority match) is retained.
 *
 * Candidates that cannot be deterministically resolved receive:
 *   - evidenceId: null
 *   - resolutionReason: "UNRESOLVED"
 *
 * THE SYSTEM — NOT THE AI — assigns evidenceIds.
 */
export function resolveEvidenceCandidates(
  candidates: EvidenceCandidate[],
  existingDocs: OfficialEvidenceDocument[],
): ResolvedEvidence[] {
  const seenEvidenceIds = new Set<string>();

  return candidates.map((candidate): ResolvedEvidence => {
    const match = tryMatchCandidate(candidate, existingDocs);

    if (!match) {
      return {
        evidenceId: null,
        candidate,
        resolutionReason: "UNRESOLVED",
        unresolvedReason:
          "Nenhum critério determinístico (hash, identificador de documento, número DEPRE/CNJ, referência+fonte, URL oficial) produziu correspondência com os registros de evidência oficial existentes.",
        qualifiesForDocumentation: false,
        qualificationRationale: "UNRESOLVED: sem evidência persistida correspondente.",
      };
    }

    const { doc, reason } = match;

    // Deduplication: same evidenceId already claimed → mark as UNRESOLVED duplicate
    if (seenEvidenceIds.has(doc.id)) {
      return {
        evidenceId: null,
        candidate,
        resolutionReason: "UNRESOLVED",
        unresolvedReason: `Duplicata determinística: evidenceId '${doc.id}' já foi atribuído a outro candidato neste ciclo de resolução. O mesmo documento não é contado duas vezes.`,
        qualifiesForDocumentation: false,
        qualificationRationale: "UNRESOLVED: duplicata; evidência não contada duas vezes.",
      };
    }

    seenEvidenceIds.add(doc.id);

    return {
      evidenceId: doc.id,
      candidate,
      resolutionReason: reason,
      unresolvedReason: null,
      qualifiesForDocumentation: isQualifyingForDocumentation(doc),
      qualificationRationale: qualificationRationale(doc),
    };
  });
}

/**
 * Extracts the set of resolved evidenceIds (non-null, deduplicated) from a resolved set.
 * Used by the AI boundary to determine which UUIDs the system can attribute.
 */
export function extractResolvedEvidenceIds(resolved: ResolvedEvidence[]): string[] {
  return [...new Set(resolved.filter((r) => r.evidenceId !== null).map((r) => r.evidenceId!))];
}

/**
 * Counts qualifying DOCUMENTAÇÃO 2/2 items in a list of official evidence documents.
 * Delegates to the authoritative countVerifiedOfficialEvidence function.
 * Present here only as a convenient reference; the authoritative function is canonical.
 */
export { countVerifiedOfficialEvidence as countDocumentationQualifyingEvidence };
