import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const res = await db.execute("SELECT blocker_codes, count(1) as c FROM opportunity_evaluations WHERE blocker_codes != '[]' GROUP BY blocker_codes");
  console.log(JSON.stringify(res.rows, null, 2));
}
run().catch(console.error).finally(() => process.exit(0));
