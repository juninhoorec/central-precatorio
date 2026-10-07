import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const res = await db.execute("SELECT status, count(1) as c FROM acquisition_events GROUP BY status");
  console.log(JSON.stringify(res.rows, null, 2));
}
run().catch(console.error).finally(() => process.exit(0));
