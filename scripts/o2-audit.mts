import { createClient } from "@libsql/client";
const c = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const queries = [
  ["operations", "SELECT COUNT(*) n, COUNT(DISTINCT json_extract(workflow,'$.credit.numeroProcessoDEPRE')) unique_depre, SUM(CASE WHEN is_demo=1 THEN 1 ELSE 0 END) demo FROM operations"],
  ["availability", "SELECT workflow->>'$.inventory.availability' availability, COUNT(*) n FROM operations GROUP BY availability"],
  ["jobs", "SELECT status, COUNT(*) n FROM automation_jobs GROUP BY status ORDER BY status"],
  ["evidence", "SELECT COUNT(*) n FROM official_evidence_documents"],
  ["audit", "SELECT COUNT(*) n FROM audit_logs"],
  ["crm", "SELECT (SELECT COUNT(*) FROM crm_records) records, (SELECT COUNT(*) FROM crm_tasks) tasks, (SELECT COUNT(*) FROM crm_activities) activities"],
  ["tenants", "SELECT organization_id, COUNT(*) n FROM operations GROUP BY organization_id"],
];
const out: Record<string, unknown> = {};
for (const [name, sql] of queries) out[name] = (await c.execute(sql)).rows;
console.log(JSON.stringify(out, null, 2));
