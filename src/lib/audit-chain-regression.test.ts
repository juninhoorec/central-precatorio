import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { appendAudit, initializeAudit, inspectAuditChain } from "./audit";

const input = (requestId: string, nextStateSummary: Record<string, string | number | boolean | null> = {}) => ({
  organizationId: "audit-regression",
  actorUserId: "test",
  action: "OPPORTUNITY_UPDATED" as const,
  entityType: "test",
  entityId: requestId,
  previousStateSummary: {},
  nextStateSummary,
  metadata: {},
  requestId,
  source: "AUDIT_REGRESSION_TEST",
});

describe("strict audit-chain diagnostics", () => {
  it("accepts an intact chain written by appendAudit", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAudit(db);
    await appendAudit(input("one", { version: 1 }), db);
    await appendAudit(input("two", { version: 2 }), db);
    const result = await inspectAuditChain("audit-regression", db);
    expect(result).toMatchObject({ valid: true, eventCount: 2, issues: [], missingPredecessors: [] });
    await db.close();
  });

  it("reports an altered event hash without accepting the chain", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAudit(db);
    await appendAudit(input("one"), db);
    await db.execute("DROP TRIGGER audit_logs_append_only_update");
    await db.execute("UPDATE audit_logs SET action='DEMO_RESET' WHERE request_id='one'");
    const result = await inspectAuditChain("audit-regression", db);
    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => issue.kind)).toContain("EVENT_HASH_MISMATCH");
    await db.close();
  });

  it("distinguishes a divergent predecessor and reports a missing predecessor", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAudit(db);
    await appendAudit(input("one"), db);
    await appendAudit(input("two"), db);
    await db.execute("DROP TRIGGER audit_logs_append_only_update");
    await db.execute("UPDATE audit_logs SET previous_event_hash='missing-predecessor' WHERE request_id='two'");
    const result = await inspectAuditChain("audit-regression", db);
    expect(result.valid).toBe(false);
    expect(result.missingPredecessors).toHaveLength(1);
    expect(result.missingPredecessors[0]?.previousHash).toBe("missing-predecessor");
    await db.close();
  });

  it("rejects duplicate event hashes and detects an absent event", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAudit(db);
    const first = await appendAudit(input("one"), db);
    await expect(db.execute({
      sql: "INSERT INTO audit_logs SELECT id || '-duplicate',organization_id,actor_user_id,action,entity_type,entity_id,timestamp,previous_state_summary,next_state_summary,metadata,request_id || '-duplicate',source,previous_event_hash,event_hash FROM audit_logs WHERE id=?",
      args: [first.id],
    })).rejects.toThrow();
    await appendAudit(input("two"), db);
    await db.execute("DROP TRIGGER audit_logs_append_only_delete");
    await db.execute("DELETE FROM audit_logs WHERE request_id='one'");
    const result = await inspectAuditChain("audit-regression", db);
    expect(result.valid).toBe(false);
    expect(result.missingPredecessors.length).toBeGreaterThanOrEqual(1);
    await db.close();
  });

  it("does not leave a partial event after an interrupted transaction", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAudit(db);
    await appendAudit(input("one"), db);
    const transaction = await db.transaction("write");
    await transaction.execute("INSERT INTO audit_logs SELECT lower(hex(randomblob(16))),organization_id,actor_user_id,action,entity_type,entity_id,timestamp,previous_state_summary,next_state_summary,metadata,request_id || '-partial',source,previous_event_hash,event_hash FROM audit_logs WHERE request_id='one'").catch(() => undefined);
    await transaction.rollback();
    const result = await inspectAuditChain("audit-regression", db);
    expect(result).toMatchObject({ valid: true, eventCount: 1 });
    await db.close();
  });
});
