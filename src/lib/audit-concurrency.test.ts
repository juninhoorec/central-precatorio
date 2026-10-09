import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { appendAudit, initializeAudit, verifyAuditChain } from "./audit";

describe("audit append across independent clients", () => {
  it("retries SQLite locks and preserves the chain", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cp-audit-concurrency-"));
    const url = `file:${join(directory, "audit.db")}`;
    const first = createClient({ url });
    const second = createClient({ url });
    try {
      await initializeAudit(first);
      const writes = Array.from({ length: 40 }, (_, index) => appendAudit({
        organizationId: "concurrency-test",
        actorUserId: "test",
        action: "OPPORTUNITY_UPDATED",
        entityType: "test",
        entityId: String(index),
        previousStateSummary: {},
        nextStateSummary: { index },
        metadata: {},
        requestId: `concurrency-${index}`,
        source: "CONCURRENCY_TEST",
      }, index % 2 ? first : second));
      await Promise.all(writes);
      expect(await verifyAuditChain("concurrency-test", first)).toBe(true);
      const count = await first.execute("SELECT COUNT(*) AS count FROM audit_logs WHERE organization_id='concurrency-test'");
      expect(Number(count.rows[0]?.count)).toBe(40);
    } finally {
      await first.close();
      await second.close();
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);
});
