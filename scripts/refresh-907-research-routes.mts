import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const rows = await client.execute({ sql: "SELECT id,instructions_json FROM manual_research_tasks WHERE organization_id=? AND source LIKE '%e-SAJ%'", args: ["legacy-internal"] });
let updated = 0;
for (const row of rows.rows) {
  const instructions = JSON.parse(String(row.instructions_json || "{}")) as Record<string, unknown>;
  instructions.primarySource = "TJSP / e-SAJ";
  instructions.primaryUrl = "https://esaj.tjsp.jus.br/cpopg/open.do";
  await client.execute({ sql: "UPDATE manual_research_tasks SET instructions_json=? WHERE id=? AND organization_id=?", args: [JSON.stringify(instructions), String(row.id), "legacy-internal"] });
  updated += 1;
}
console.log(JSON.stringify({ inspected: rows.rows.length, updated }));
await client.close();
