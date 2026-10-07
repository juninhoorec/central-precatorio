import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
async function run() {
  const res = await db.execute("SELECT id, title, workflow FROM operations LIMIT 5");
  console.log(JSON.stringify(res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const wf = JSON.parse(String(row.workflow || "{}")) as Record<string, unknown>;
    return {id: row.id, title: row.title, credit: (wf as Record<string, unknown>).credit};
  }), null, 2));
}
run().catch(console.error).finally(() => process.exit(0));
