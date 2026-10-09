import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
const stable = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
};
const asString = (value: unknown) => String(value ?? "");
const hashFor = (row: Record<string, unknown>) => createHash("sha256").update(stable({
  id: asString(row.id), organizationId: asString(row.organization_id), actorUserId: asString(row.actor_user_id), action: asString(row.action),
  entityType: asString(row.entity_type), entityId: asString(row.entity_id), previousStateSummary: JSON.parse(asString(row.previous_state_summary)),
  nextStateSummary: JSON.parse(asString(row.next_state_summary)), metadata: JSON.parse(asString(row.metadata)), requestId: asString(row.request_id),
  source: asString(row.source), timestamp: asString(row.timestamp), previousEventHash: asString(row.previous_event_hash),
})).digest("hex");

try {
  const rows = (await client.execute("SELECT rowid, * FROM audit_logs ORDER BY rowid ASC")).rows as Record<string, unknown>[];
  const all: unknown[] = [];
  const tenants = new Map<string, { previous: string; count: number }>();
  const seenHashes = new Map<string, number[]>();
  const seenIds = new Map<string, number[]>();
  for (const row of rows) {
    const tenant = asString(row.organization_id);
    const state = tenants.get(tenant) || { previous: "", count: 0 };
    const expectedPrevious = state.previous;
    const expectedHash = hashFor(row);
    const storedPrevious = asString(row.previous_event_hash);
    const storedHash = asString(row.event_hash);
    const issues = [
      ...(storedPrevious !== expectedPrevious ? ["PREVIOUS_EVENT_HASH_MISMATCH"] : []),
      ...(storedHash !== expectedHash ? ["EVENT_HASH_MISMATCH"] : []),
    ];
    if (issues.length) all.push({ rowid: row.rowid, id: row.id, organizationId: tenant, action: row.action, entityType: row.entity_type, issues, storedPrevious, expectedPrevious, storedHash, expectedHash });
    tenants.set(tenant, { previous: storedHash, count: state.count + 1 });
    seenHashes.set(storedHash, [...(seenHashes.get(storedHash) || []), Number(row.rowid)]);
    seenIds.set(asString(row.id), [...(seenIds.get(asString(row.id)) || []), Number(row.rowid)]);
  }
  const duplicateHashes = [...seenHashes.entries()].filter(([, ids]) => ids.length > 1).map(([hash, rowids]) => ({ hash, rowids }));
  const duplicateIds = [...seenIds.entries()].filter(([, ids]) => ids.length > 1).map(([id, rowids]) => ({ id, rowids }));
  const orphanPredecessors = rows.filter((row) => {
    const previous = asString(row.previous_event_hash);
    return previous !== "" && !seenHashes.has(previous);
  }).map((row) => ({ rowid: row.rowid, id: row.id, organizationId: row.organization_id, previousEventHash: row.previous_event_hash }));
  const actions = await client.execute("SELECT action, COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY action");
  const tenantCounts = await client.execute("SELECT organization_id, COUNT(*) AS count FROM audit_logs GROUP BY organization_id ORDER BY organization_id");
  console.log(JSON.stringify({ status: all.length ? "INVALID" : "VALID", totalEvents: rows.length, tenants: [...tenants].map(([organizationId, value]) => ({ organizationId, ...value, valid: !all.some((item) => (item as { organizationId: string }).organizationId === organizationId) })), mismatches: all, duplicateHashes, duplicateIds, orphanPredecessors, actions: actions.rows, tenantCounts: tenantCounts.rows }, null, 2));
} finally { await client.close(); }
