import { createClient } from "@libsql/client";
import { updateManualTaskStatus } from "../src/lib/manual-research.ts";

const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID || "legacy-internal";
const actor = process.env.CP_IMPORT_ACTOR || "official-enrichment-907";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const rows = await client.execute({ sql: "SELECT id FROM manual_research_tasks WHERE organization_id=? AND status='OPEN' AND blocker_type='MANUAL_REQUIRED'", args: [organizationId] });
for (const row of rows.rows) await updateManualTaskStatus(String(row.id), organizationId, "WAITING_EXTERNAL", actor, undefined, client);
console.log(JSON.stringify({ updated: rows.rows.length }));
await client.close();
