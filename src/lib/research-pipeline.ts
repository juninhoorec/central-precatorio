/**
 * PHASE 2 — CANONICAL RESEARCH PIPELINE
 *
 * Authoritative flow:
 *   DEPRE
 *   → Source Registry
 *   → Provider / Source / Route
 *   → Collector
 *   → Raw Source Result (SourceAcquisitionResult)
 *   → Normalizer (NormalizedResearchResult)
 *   → Evidence Resolver (EvidenceCandidate → ResolvedEvidence)
 *   → Evidence Package (EvidencePackage)
 *   → Coverage Evaluator (CoverageAssessment)
 *   → DOCUMENTAÇÃO 2/2
 *
 * INVARIANTS — NEVER VIOLATE:
 *   1. Source failures NEVER escalate to global NOT_FOUND.
 *   2. AI does NOT generate evidence UUIDs.
 *   3. Provider ≠ Source ≠ Route.
 *   4. Two routes of the same underlying source = ONE sourceId.
 *   5. Coverage governed exclusively by evaluateSourceCoverage.
 *   6. DOCUMENTAÇÃO 2/2 governed exclusively by countVerifiedOfficialEvidence.
 */

import type { CanonicalSourceResult, CoverageAssessment } from "./source-coverage";

// ---------------------------------------------------------------------------
// A. RESEARCH REQUEST
// ---------------------------------------------------------------------------

export type ResearchRequest = {
  /** Stable UUID of the operation this research targets. */
  operationId: string;
  /** Stable UUID of the organization owning the operation. */
  organizationId: string;
  /** DEPRE process number as-imported (may include punctuation). */
  depre: string | null;
  /** CNJ process number, if available (may be same as depre or origin process). */
  cnj: string | null;
  /** Origin process number, if available. */
  originProcessNumber: string | null;
  /** Free-text creditor name for context (never used for evidence identity). */
  creditorName: string | null;
};

// ---------------------------------------------------------------------------
// B. SOURCE IDENTITY REGISTRY
// ---------------------------------------------------------------------------

/**
 * Stable identity of a registered source.
 * Provider and route are technical; sourceId is the underlying source authority.
 *
 * PRINCIPLE:
 *   JusScraper → TJSP → cpopg   \
 *   JusScraper → TJSP → cposg    > same sourceId: "tjsp-processual"
 *   DataJud    → TJSP → api      /
 */
export type RegisteredSource = {
  /** Stable identifier for the underlying legal/public source authority. */
  sourceId: string;
  /** Human-readable name of the underlying source. */
  sourceName: string;
  /** Technical provider mechanism (e.g. "JusScraper", "DataJud", "MCP-Brasil"). */
  provider: string;
  /** Specific technical route within the source. */
  route: string;
  /** Whether this source can produce qualifying DOCUMENTAÇÃO 2/2 evidence. */
  canQualifyDocumentation: boolean;
  /** Official base domain of the source (e.g. "tjsp.jus.br"). */
  officialDomain: string | null;
};

// ---------------------------------------------------------------------------
// C. RAW SOURCE ACQUISITION RESULT
// ---------------------------------------------------------------------------

/**
 * Full raw result from a single provider/source/route attempt.
 * Every collector output MUST produce one of these.
 * The raw payload is preserved; normalization happens downstream.
 *
 * STATUS semantics: describes the acquisition attempt — NOT a legal conclusion.
 *
 * NEVER transform:
 *   NO_RESULT       → NOT_FOUND
 *   EMPTY_RESPONSE  → NOT_FOUND
 *   TIMEOUT         → NOT_FOUND
 *   (etc.)
 */
export type SourceAcquisitionResult = {
  /** Stable technical provider mechanism. */
  provider: string;
  /** Stable underlying source identity (used for coverage grouping). */
  source: string;
  /** Stable sourceId for coverage deduplication (same source = same sourceId across providers/routes). */
  sourceId: string;
  /** Specific technical route within the provider+source pair. */
  route: string;
  /** The identifier queried (as-submitted, before normalization). */
  requestedIdentifier: string;
  /** Normalized query identifier, or null if normalization was not applicable/possible. */
  normalizedIdentifier: string | null;
  /** ISO-8601 timestamp when the attempt started. */
  startedAt: string | null;
  /** ISO-8601 timestamp when the attempt completed. */
  completedAt: string | null;
  /** Duration in milliseconds, or null if not measured. */
  durationMs: number | null;
  /** Source-level acquisition status — NEVER escalated to global NOT_FOUND by the pipeline. */
  status: string;
  /** Whether an actual network/subprocess request was attempted. */
  requestAttempted: boolean;
  /** HTTP status code if available. */
  httpStatus: number | null;
  /** The URL actually queried (source/endpoint URL). */
  sourceUrl: string | null;
  /** Official source URL returned by the source, if the source itself provided one. */
  officialSourceUrl: string | null;
  /** Error code if the attempt failed. */
  errorCode: string | null;
  /** Sanitized error message if the attempt failed. */
  errorMessage: string | null;
  /** Raw payload from the source (provider-specific structure; preserved as-is). */
  rawPayload: unknown;
  /** Additional structured metadata about the acquisition attempt. */
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// D. NORMALIZED RESEARCH RESULT
// ---------------------------------------------------------------------------

/**
 * Result after deterministic normalization of a SourceAcquisitionResult.
 *
 * INVARIANTS:
 *   - Original identifier is always preserved.
 *   - No legal conclusions inferred from empty results.
 *   - No ownership/succession/substitution inferred from names alone.
 *   - No process origin inferred from degree/route alone.
 */
export type NormalizedIdentifier = {
  /** Original value as-submitted. */
  original: string;
  /** Deterministically normalized form, or null if unresolvable. */
  normalized: string | null;
  /** Normalization method applied. */
  method:
    | "CNJ_DIGITS_ONLY"
    | "DEPRE_DIGITS_ONLY"
    | "URL_CANONICAL"
    | "HASH_NORMALIZED"
    | "PASSTHROUGH"
    | "UNRESOLVABLE";
  /** Why the identifier could not be normalized, if applicable. */
  unresolvedReason: string | null;
};

export type NormalizedResearchResult = {
  /** Source of this result. */
  acquisitionResult: SourceAcquisitionResult;
  /** Canonical source result (compatible with evaluateSourceCoverage). */
  canonicalResult: CanonicalSourceResult;
  /** Normalized identifiers extracted from the result, keyed by role. */
  identifiers: {
    depre: NormalizedIdentifier | null;
    cnj: NormalizedIdentifier | null;
    documentIdentifier: NormalizedIdentifier | null;
    officialUrl: NormalizedIdentifier | null;
  };
  /**
   * Whether this result contains data that could be evidence candidates.
   * FALSE for: TIMEOUT, TRANSPORT_FAILURE, SOURCE_UNAVAILABLE, AUTH_REQUIRED,
   *            CAPTCHA_REQUIRED, MANUAL_REQUIRED, HTTP_ERROR, NOT_CONFIGURED,
   *            ENDPOINT_NOT_FOUND, NETWORK_ERROR, RATE_LIMITED, INVALID_QUERY.
   * TRUE only when status is SUCCESS.
   * EMPTY_RESPONSE/NO_RESULT also returns false (completed without data).
   */
  hasEvidenceCandidates: boolean;
  /** Normalization warnings (non-fatal issues). */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// E. EVIDENCE CANDIDATE AND RESOLVED EVIDENCE
// ---------------------------------------------------------------------------

export const evidenceResolutionReasons = [
  "EXACT_DOCUMENT_IDENTIFIER",
  "EXACT_DEPRE_MATCH",
  "EXACT_SOURCE_REFERENCE",
  "EXACT_OFFICIAL_URL",
  "HASH_MATCH",
  "UNRESOLVED",
] as const;

export type EvidenceResolutionReason = (typeof evidenceResolutionReasons)[number];

/**
 * A candidate for evidence attribution before deterministic resolution.
 * Carries full provenance so resolution can be audited.
 */
export type EvidenceCandidate = {
  /** Source acquisition this candidate was extracted from. */
  acquisitionResultRef: {
    provider: string;
    source: string;
    sourceId: string;
    route: string;
    sourceUrl: string | null;
  };
  /** Type of evidence document. */
  documentType: string;
  /** Document identifier (from the source, normalized when deterministic). */
  documentIdentifier: string | null;
  /** Document reference (from the source). */
  reference: string | null;
  /** Official source URL of the specific document. */
  officialSourceUrl: string | null;
  /** SHA-256 hash of document content, if available. */
  contentHash: string | null;
  /** Content fingerprint for deduplication. */
  contentFingerprint: string | null;
  /** The raw payload that constitutes this candidate. */
  rawPayload: unknown;
};

/**
 * An evidence candidate after deterministic resolution.
 * If resolution fails, reason is UNRESOLVED and evidenceId is null.
 * THE SYSTEM — NOT THE AI — assigns evidenceIds.
 */
export type ResolvedEvidence = {
  /**
   * Assigned evidence ID — the UUID of an existing `official_evidence_documents` record,
   * or null if the candidate cannot be deterministically resolved.
   * NEVER invented by the AI; always assigned by the CP system.
   */
  evidenceId: string | null;
  /** The candidate that was resolved. */
  candidate: EvidenceCandidate;
  /** How the resolution was achieved. */
  resolutionReason: EvidenceResolutionReason;
  /** Why resolution failed, if reason is UNRESOLVED. */
  unresolvedReason: string | null;
  /** Whether this evidence qualifies for DOCUMENTAÇÃO 2/2 per the existing rule. */
  qualifiesForDocumentation: boolean;
  /** Why it does or does not qualify for documentation. */
  qualificationRationale: string;
};

// ---------------------------------------------------------------------------
// F. EVIDENCE PACKAGE
// ---------------------------------------------------------------------------

/**
 * Immutable, inspectable evidence package for a research attempt.
 * Deterministic: same inputs produce the same package identity.
 *
 * INVARIANTS:
 *   - MANUAL_REFERENCE ≠ OFFICIAL_EVIDENCE (always distinguished).
 *   - The package does NOT generate UUIDs; it references persisted records.
 *   - The same document returned through two routes is deduplicated.
 */
export type EvidencePackageSnapshot = {
  /** Version of the operation snapshot at time of package creation. */
  operationVersion: number;
  /** DEPRE process number as-imported. */
  depre: string | null;
  /** CNJ process number as-imported. */
  cnj: string | null;
  /** Creditor name for context only — never used for evidence attribution. */
  creditorName: string | null;
};

export type ManualReference = {
  type: "MANUAL_REFERENCE";
  source: string;
  reference: string;
  notes: string;
};

export type EvidencePackage = {
  /** Stable package ID derived deterministically from its content. */
  packageId: string;
  /** ISO-8601 timestamp when the package was assembled. */
  assembledAt: string;
  /** Operation snapshot at time of assembly. */
  snapshot: EvidencePackageSnapshot;
  /** Official evidence records from the database. */
  officialEvidence: Array<{
    id: string;
    documentType: string;
    source: string;
    sourceUrl: string;
    documentIdentifier: string;
    reference: string;
    evidenceType: string;
    collectionTimestamp: string;
    status: string;
    strength: string;
    hash: string;
    /** Provider/source/route provenance of the evidence record. */
    provenance: { provider: string; sourceId: string; route: string } | null;
  }>;
  /** Raw source acquisition results for this research cycle. */
  sourceResults: SourceAcquisitionResult[];
  /** Resolved evidence from the current research cycle. */
  resolvedEvidence: ResolvedEvidence[];
  /** Manual references from XLSX/analyst notes. */
  manualReferences: ManualReference[];
  /** Coverage assessment. */
  coverage: CoverageAssessment;
};

// ---------------------------------------------------------------------------
// G. PIPELINE RESULT
// ---------------------------------------------------------------------------

/**
 * Top-level result of the research pipeline for a single research cycle.
 */
export type ResearchPipelineResult = {
  request: ResearchRequest;
  sourceResults: SourceAcquisitionResult[];
  normalizedResults: NormalizedResearchResult[];
  evidenceCandidates: EvidenceCandidate[];
  resolvedEvidence: ResolvedEvidence[];
  evidencePackage: EvidencePackage;
  coverage: CoverageAssessment;
  /**
   * Count of qualifying DOCUMENTAÇÃO 2/2 items.
   * Governed exclusively by countVerifiedOfficialEvidence — not by this pipeline directly.
   */
  documentationCount: number;
};
