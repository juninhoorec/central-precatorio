/**
 * PHASE 7 — Tests for acquisition-event-recorder.ts (BLOCKER-7-01)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@libsql/client";
import {
  recordSourceBlockerEvent,
  recordSourceBlockerEventBatch,
  listSourceBlockerEvents,
  isBlockingResult,
  MANUAL_BLOCKER_RESULTS,
} from "./acquisition-event-recorder";
import { initializeAutonomousAcquisition } from "./autonomous-acquisition";

const client = createClient({ url: "file::memory:" });
const ORG = "test-org-acq-event";
const OP = "op-001";
const DEPRE = "1234567-89.2024.8.26.0000";

beforeAll(async () => {
  await client.execute("CREATE TABLE operations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL)");
  await client.execute({
    sql: "INSERT INTO operations(id,organization_id) VALUES(?,?),(?,?),(?,?),(?,?)",
    args: [OP, ORG, "op-no-result", ORG, "op-batch-1", ORG, "op-tenant-b", "other-org"],
  });
  await initializeAutonomousAcquisition(client);
});

describe("acquisition-event-recorder", () => {
  describe("recordSourceBlockerEvent", () => {
    it("creates a new event for a blocking source result", async () => {
      const result = await recordSourceBlockerEvent(
        {
          organizationId: ORG,
          operationId: OP,
          depre: DEPRE,
          sourceId: "tjsp-esaj",
          sourceName: "TJSP e-SAJ",
          route: "consulta-processo",
          canonicalResult: "MANUAL_REQUIRED",
          queryIdentifier: DEPRE,
          attemptedAt: "2026-10-07T12:00:00.000Z",
        },
        client,
      );

      expect(result.created).toBe(true);
      expect(result.eventId).toBeTruthy();
      expect(result.idempotencyKey).toBeTruthy();
      expect(result.canonicalResult).toBe("MANUAL_REQUIRED");
    });

    it("is idempotent — same input returns existing event", async () => {
      const result = await recordSourceBlockerEvent(
        {
          organizationId: ORG,
          operationId: OP,
          depre: DEPRE,
          sourceId: "tjsp-esaj",
          sourceName: "TJSP e-SAJ",
          route: "consulta-processo",
          canonicalResult: "MANUAL_REQUIRED",
          queryIdentifier: DEPRE,
          attemptedAt: "2026-10-07T12:00:00.000Z",
        },
        client,
      );

      expect(result.created).toBe(false);
      expect(result.idempotencyKey).toBeTruthy();
    });

    it("creates distinct events for different sources", async () => {
      const result = await recordSourceBlockerEvent(
        {
          organizationId: ORG,
          operationId: OP,
          depre: DEPRE,
          sourceId: "cnj-datajud",
          sourceName: "CNJ DataJud",
          route: "api-publica",
          canonicalResult: "CAPTCHA_REQUIRED",
          queryIdentifier: DEPRE,
          attemptedAt: "2026-10-07T12:00:00.000Z",
        },
        client,
      );

      expect(result.created).toBe(true);
      expect(result.canonicalResult).toBe("CAPTCHA_REQUIRED");
    });

    it("preserves NO_RESULT as-is — never escalates", async () => {
      const result = await recordSourceBlockerEvent(
        {
          organizationId: ORG,
          operationId: "op-no-result",
          depre: DEPRE,
          sourceId: "tjsp-esaj",
          sourceName: "TJSP e-SAJ",
          route: "consulta-cac",
          canonicalResult: "NO_RESULT",
          queryIdentifier: DEPRE,
          attemptedAt: "2026-10-07T13:00:00.000Z",
        },
        client,
      );

      expect(result.created).toBe(true);
      expect(result.canonicalResult).toBe("NO_RESULT");
    });

    it("enforces tenant isolation — different org creates separate event", async () => {
      const result = await recordSourceBlockerEvent(
        {
          organizationId: "other-org",
          operationId: "op-tenant-b",
          depre: DEPRE,
          sourceId: "tjsp-esaj",
          sourceName: "TJSP e-SAJ",
          route: "consulta-processo",
          canonicalResult: "MANUAL_REQUIRED",
          queryIdentifier: DEPRE,
          attemptedAt: "2026-10-07T12:00:00.000Z",
        },
        client,
      );

      expect(result.created).toBe(true);
    });
  });

  describe("listSourceBlockerEvents", () => {
    it("returns only blocker events for the specified operation", async () => {
      const events = await listSourceBlockerEvents(OP, ORG, client);

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every((e) => e.sourceId.length > 0)).toBe(true);
      expect(events.every((e) => e.idempotencyKey.length > 0)).toBe(true);
    });
  });

  describe("recordSourceBlockerEventBatch", () => {
    it("records multiple events idempotently", async () => {
      const results = await recordSourceBlockerEventBatch(
        [
          {
            organizationId: ORG,
            operationId: "op-batch-1",
            depre: DEPRE,
            sourceId: "tjsp-esaj",
            sourceName: "TJSP e-SAJ",
            route: "consulta-processo",
            canonicalResult: "TIMEOUT",
            queryIdentifier: DEPRE,
            attemptedAt: "2026-10-07T14:00:00.000Z",
          },
          {
            organizationId: ORG,
            operationId: "op-batch-1",
            depre: DEPRE,
            sourceId: "cnj-datajud",
            sourceName: "CNJ DataJud",
            route: "api-publica",
            canonicalResult: "AUTH_REQUIRED",
            queryIdentifier: DEPRE,
            attemptedAt: "2026-10-07T14:00:00.000Z",
          },
        ],
        client,
      );

      expect(results.length).toBe(2);
      expect(results[0].created).toBe(true);
      expect(results[1].created).toBe(true);

      // Re-run: idempotent
      const results2 = await recordSourceBlockerEventBatch(
        [
          {
            organizationId: ORG,
            operationId: "op-batch-1",
            depre: DEPRE,
            sourceId: "tjsp-esaj",
            sourceName: "TJSP e-SAJ",
            route: "consulta-processo",
            canonicalResult: "TIMEOUT",
            queryIdentifier: DEPRE,
            attemptedAt: "2026-10-07T14:00:00.000Z",
          },
        ],
        client,
      );
      expect(results2[0].created).toBe(false);
    });
  });

  describe("isBlockingResult", () => {
    it("returns true for manual-research blocker codes", () => {
      for (const code of MANUAL_BLOCKER_RESULTS) {
        expect(isBlockingResult(code)).toBe(true);
      }
    });

    it("returns false for non-blocking codes", () => {
      expect(isBlockingResult("SUCCESS")).toBe(false);
      expect(isBlockingResult("NO_RESULT")).toBe(false);
      expect(isBlockingResult("EMPTY_RESPONSE")).toBe(false);
    });
  });
});
