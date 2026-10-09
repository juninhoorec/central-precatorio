import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
try {
  const result = await client.execute("SELECT id,organization_id,actor_user_id,action,entity_type,entity_id,timestamp,previous_state_summary,next_state_summary,metadata,request_id,source,previous_event_hash,event_hash FROM audit_logs ORDER BY rowid ASC");
  const stable = (value: unknown): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  };
  let previous = "";
  for (const [index, row] of result.rows.entries()) {
    const payload = {
      id: String(row.id), organizationId: String(row.organization_id), actorUserId: String(row.actor_user_id), action: String(row.action),
      entityType: String(row.entity_type), entityId: String(row.entity_id), previousStateSummary: JSON.parse(String(row.previous_state_summary)),
      nextStateSummary: JSON.parse(String(row.next_state_summary)), metadata: JSON.parse(String(row.metadata)), requestId: String(row.request_id),
      source: String(row.source), timestamp: String(row.timestamp), previousEventHash: String(row.previous_event_hash),
    };
    const expected = createHash("sha256").update(stable(payload)).digest("hex");
    if (String(row.previous_event_hash) !== previous || String(row.event_hash) !== expected) {
      console.log(JSON.stringify({ index, eventId: row.id, storedPrevious: row.previous_event_hash, expectedPrevious: previous, storedHash: row.event_hash, expectedHash: expected, mismatchFields: [String(row.previous_event_hash) !== previous ? "previous_event_hash" : null, String(row.event_hash) !== expected ? "event_hash" : null].filter(Boolean) }));
      break;
    }
    previous = String(row.event_hash);
  }
} finally {
  await client.close();
}
