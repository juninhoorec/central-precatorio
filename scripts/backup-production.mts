import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("file:")) throw new Error("PRODUCTION_DATABASE_URL_REQUIRED");
const organizationId = process.env.CP_BACKUP_ORGANIZATION_ID;
if (!organizationId) throw new Error("CP_BACKUP_ORGANIZATION_ID_REQUIRED");
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const tables = ["operations", "operation_documents", "official_evidence_documents", "audit_logs", "crm_records", "crm_tasks", "crm_activities", "crm_stage_history", "manual_research_tasks", "capture_import_rows"];
const snapshot: Record<string, unknown> = { generatedAt: new Date().toISOString(), organizationId, tables: {} };
for (const table of tables) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client.execute({ sql: `select * from ${table} where organization_id=? limit 1000 offset ?`, args: [organizationId, offset] });
    rows.push(...result.rows);
    if (result.rows.length < 1000) break;
  }
  (snapshot.tables as Record<string, unknown>)[table] = rows;
}
const body = JSON.stringify(snapshot);
const hash = createHash("sha256").update(body).digest("hex");
const directory = process.env.CP_BACKUP_DIRECTORY || path.join(process.cwd(), "backups");
await fs.mkdir(directory, { recursive: true });
const file = path.join(directory, `cp-${organizationId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await fs.writeFile(file, body, "utf8");
await fs.writeFile(`${file}.sha256`, `${hash}  ${path.basename(file)}\n`, "utf8");
console.log(JSON.stringify({ status: "BACKUP_CREATED", file, sha256: hash, organizationId }, null, 2));
await client.close();
