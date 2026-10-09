/**
 * PHASE 7 — BLOCKER-7-01
 * ACQUISITION EVENT RECORDER
 *
 * Deterministic, idempotent service that records a canonical acquisition event
 * whenever a source attempt produces a blocking result (MANUAL_REQUIRED,
 * CAPTCHA_REQUIRED, AUTH_REQUIRED, etc.).
 *
 * CANONICAL CHAIN:
 *   Source attempt → CanonicalSourceResult → recordSourceBlockerEvent()
 *   → acquisition_events row (idempotent)
 *   → generateManualResearchTask() (Phase 6)
 *
 * INVARIANTS:
 *   1. An event is NEVER fabricated for an attempt that did not occur.
 *   2. Idempotency key prevents duplicate rows for the same attempt.
 *   3. NO_RESULT is preserved as NO_RESULT — never escalated.
 *   4. MANUAL/CAPTCHA/AUTH blocked results do not imply absence.
 *   5. Tenant isolation enforced at every write.
 */

import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { initializeAutonomousAcquisition } from "./autonomous-acquisition";
import { createDatabaseClient } from "./database-config";

const db = createDatabaseClient();

/** Canonical source result codes that should generate a manual research task. */
export const MANUAL_BLOCKER_RESULTS = [
  "MANUAL_REQUIRED",
  "CAPTCHA_REQUIRED",
  "AUTH_REQUIRED",
  "INSUFFICIENT_COVERAGE",
  "RATE_LIMITED",
  "SOURCE_UNAVAILABLE",
  "TIMEOUT",
  "TRANSPORT_FAILURE",
  "HTTP_ERROR",
  "ENDPOINT_NOT_FOUND",
  "NETWORK_ERROR",
] as const;

export type ManualBlockerResult = (typeof MANUAL_BLOCKER_RESULTS)[number];

/** All canonical source result codes as per project taxonomy. */
export const CANONICAL_SOURCE_RESULTS = [
  "SUCCESS",
  "EMPTY_RESPONSE",
  "NO_RESULT",
  "TIMEOUT",
  "TRANSPORT_FAILURE",
  "SOURCE_UNAVAILABLE",
  "AUTH_REQUIRED",
  "CAPTCHA_REQUIRED",
  "MANUAL_REQUIRED",
  "HTTP_ERROR",
  "ENDPOINT_NOT_FOUND",
  "NETWORK_ERROR",
  "INVALID_QUERY",
  "RATE_LIMITED",
  // Internal/extended codes
  "ASSISTED_SOURCE_REQUIRED",
  "DAILY_BUDGET_EXHAUSTED",
  "PROCESS_FOUND",
  "PROCESS_NOT_FOUND",
  "FOUND",
] as const;

export type CanonicalSourceResultCode = (typeof CANONICAL_SOURCE_RESULTS)[number];

/** Input for recording a source blocker acquisition event. */
export type SourceBlockerEventInput = {
  organizationId: string;
  operationId: string;
  depre: string;
  /** Stable source identifier (e.g. "tjsp-esaj", "cnj-datajud"). */
  sourceId: string;
  /** Human-readable source name. */
  sourceName: string;
  /** Technical route within the source. */
  route: string;
  /** Exact canonical result code — NEVER reinterpreted. */
  canonicalResult: CanonicalSourceResultCode;
  /** Optional: HTTP status code if a real HTTP request was made. */
  httpStatus?: number | null;
  /** Failure reason as returned by the source adapter. */
  failureReason?: string;
  /** Official URL queried (if any). */
  sourceUrl?: string;
  /** Query identifier used (DEPRE or process number). */
  queryIdentifier?: string;
  /** ISO timestamp of when the attempt started. */
  attemptedAt: string;
  /** Job ID — use empty string if no acquisition job exists for this attempt. */
  jobId?: string;
  /** Additional structured details for debugging. */
  details?: Record<string, unknown>;
};

/** Result of recording a blocker event. */
export type SourceBlockerEventResult = {
  created: boolean;
  eventId: string;
  idempotencyKey: string;
  canonicalResult: CanonicalSourceResultCode;
};

/**
 * Deterministic idempotency key for a source blocker event.
 * Same org+op+source+route+date → same key.
 */
function blockerEventKey(
  organizationId: string,
  operationId: string,
  sourceId: string,
  route: string,
  canonicalResult: string,
  attemptedAt: string,
): string {
  // Use date-only (UTC) so key is stable across a single UTC day per attempt
  const dateKey = attemptedAt.slice(0, 10);
  const raw = `${organizationId}|${operationId}|${sourceId}|${route}|${canonicalResult}|${dateKey}`;
  return `blocker-event-${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

/**
 * Record a canonical acquisition event when a source attempt produces a blocking result.
 *
 * Idempotent: duplicate calls with the same inputs will return the existing event.
 * Never fabricates an event for an attempt that did not actually occur.
 */
export async function recordSourceBlockerEvent(
  input: SourceBlockerEventInput,
  client: Client = db,
): Promise<SourceBlockerEventResult> {
  await initializeAutonomousAcquisition(client);

  const idempotencyKey = blockerEventKey(
    input.organizationId,
    input.operationId,
    input.sourceId,
    input.route,
    input.canonicalResult,
    input.attemptedAt,
  );

  // Check for existing event first (idempotency)
  const existing = await client.execute({
    sql: "SELECT id FROM acquisition_events WHERE organization_id=? AND operation_id=? AND idempotency_key=?",
    args: [input.organizationId, input.operationId, idempotencyKey],
  });

  if (existing.rows[0]) {
    return {
      created: false,
      eventId: String(existing.rows[0].id),
      idempotencyKey,
      canonicalResult: input.canonicalResult,
    };
  }

  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();

  const details: Record<string, unknown> = {
    canonicalResult: input.canonicalResult,
    depre: input.depre,
    sourceName: input.sourceName,
    attemptedAt: input.attemptedAt,
    phase: "phase7-blocker-event",
    ...(input.details ?? {}),
  };

  await client.execute({
    sql: `INSERT OR IGNORE INTO acquisition_events (
      id, organization_id, operation_id, job_id,
      source_id, event_type, status,
      query_identifier, source_url, query_id,
      consulted_at, source_reference_date,
      http_status, document_id, evidence_reference,
      access_result, failure_reason, details_json,
      idempotency_key
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      eventId,
      input.organizationId,
      input.operationId,
      input.jobId ?? "",
      input.sourceId,
      "SOURCE_BLOCKER_RECORDED",
      input.canonicalResult,
      input.queryIdentifier ?? input.depre,
      input.sourceUrl ?? "",
      input.queryIdentifier ?? input.depre,
      now,
      input.attemptedAt,
      input.httpStatus ?? null,
      "",
      "",
      input.canonicalResult,
      input.failureReason ?? "",
      JSON.stringify(details),
      idempotencyKey,
    ],
  });

  return {
    created: true,
    eventId,
    idempotencyKey,
    canonicalResult: input.canonicalResult,
  };
}

/**
 * Record multiple source blocker events for a batch of operations.
 * All writes are idempotent.
 */
export async function recordSourceBlockerEventBatch(
  events: SourceBlockerEventInput[],
  client: Client = db,
): Promise<SourceBlockerEventResult[]> {
  const results: SourceBlockerEventResult[] = [];
  for (const event of events) {
    results.push(await recordSourceBlockerEvent(event, client));
  }
  return results;
}

/**
 * List all source blocker events for an operation.
 * Results are ordered by consulted_at DESC.
 */
export async function listSourceBlockerEvents(
  operationId: string,
  organizationId: string,
  client: Client = db,
) {
  await initializeAutonomousAcquisition(client);
  const result = await client.execute({
    sql: `SELECT id, source_id, event_type, status, query_identifier, source_url,
                 consulted_at, http_status, access_result, failure_reason, details_json, idempotency_key
          FROM acquisition_events
          WHERE operation_id=? AND organization_id=?
            AND event_type='SOURCE_BLOCKER_RECORDED'
          ORDER BY consulted_at DESC`,
    args: [operationId, organizationId],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    sourceId: String(row.source_id),
    canonicalResult: String(row.status) as CanonicalSourceResultCode,
    queryIdentifier: String(row.query_identifier),
    sourceUrl: String(row.source_url),
    consultedAt: String(row.consulted_at),
    httpStatus: row.http_status === null ? null : Number(row.http_status),
    accessResult: String(row.access_result),
    failureReason: String(row.failure_reason),
    idempotencyKey: String(row.idempotency_key),
  }));
}

/** Returns true if the canonical result code justifies a manual research task. */
export function isBlockingResult(result: string): result is ManualBlockerResult {
  return (MANUAL_BLOCKER_RESULTS as readonly string[]).includes(result);
}
