import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const res = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(res.rows.map((r) => (r as Record<string, unknown>).name));
}
run().catch(console.error).finally(() => process.exit(0));
