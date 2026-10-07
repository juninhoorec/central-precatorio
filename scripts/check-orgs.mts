import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const res = await db.execute("SELECT organization_id, count(1) as c FROM operations GROUP BY organization_id");
  console.log(JSON.stringify(res.rows, null, 2));
}
run().catch(console.error).finally(() => process.exit(0));
