import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { appendAudit, initializeAudit, verifyAuditChain } from "./audit";

describe("audit append through the supported shared client", () => {
  it("serializes concurrent writes and preserves the chain", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cp-audit-concurrency-"));
    const url = `file:${join(directory, "audit.db")}`;
    const client = createClient({ url });
    try {
      await initializeAudit(client);
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
      }, client));
      await Promise.all(writes);
      expect(await verifyAuditChain("concurrency-test", client)).toBe(true);
      const count = await client.execute("SELECT COUNT(*) AS count FROM audit_logs WHERE organization_id='concurrency-test'");
      expect(Number(count.rows[0]?.count)).toBe(40);
    } finally {
      await client.close();
      await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }, 60_000);
});
