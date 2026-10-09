import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { recordSourceBlockerEvent } from "../src/lib/acquisition-event-recorder";
import { isBlockingResult } from "../src/lib/acquisition-event-recorder";

const db = createClient({
  url: requireExplicitDatabaseUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function backfill() {
  console.log("CARRY-8-03: Backfilling acquisition events for existing manual tasks");
  const tasks = await db.execute("SELECT * FROM manual_research_tasks WHERE status = 'OPEN'");
  
  for (const t of tasks.rows) {
    const canonicalResult = String(t.blocker_type);
    if (!isBlockingResult(canonicalResult)) {
      console.log(`Skipping task ${t.id} - not a blocker type: ${canonicalResult}`);
      continue;
    }
    
    const eventResult = canonicalResult as Parameters<typeof recordSourceBlockerEvent>[0]["canonicalResult"];
    await recordSourceBlockerEvent({
      organizationId: String(t.organization_id),
      operationId: String(t.operation_id),
      depre: String(t.depre),
      sourceId: String(t.source_id),
      sourceName: String(t.source),
      route: String(t.route),
      canonicalResult: eventResult,
      failureReason: "Legacy task backfill",
      queryIdentifier: String(t.depre),
      attemptedAt: String(t.generated_at),
      details: {
        backfilledFromPhase8: true,
        taskId: String(t.id)
      }
    }, db);
  }
  
  console.log(`Processed ${tasks.rows.length} tasks.`);
}

backfill().catch(console.error);
