import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const total = await db.execute("SELECT count(1) as c FROM manual_research_tasks");
  const byStatus = await db.execute("SELECT status, priority, count(1) as c FROM manual_research_tasks GROUP BY status, priority");
  const sample = await db.execute("SELECT id, depre, status, priority, blocker_type FROM manual_research_tasks LIMIT 5");
  console.log("Total tasks:", (total.rows[0] as Record<string, unknown>).c);
  console.log("By status/priority:", JSON.stringify(byStatus.rows, null, 2));
  console.log("Sample tasks:", JSON.stringify(sample.rows, null, 2));
}
run().catch(console.error).finally(() => process.exit(0));
