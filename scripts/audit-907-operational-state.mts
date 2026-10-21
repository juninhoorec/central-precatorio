import { createClient } from "@libsql/client";

const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID || "legacy-internal";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const source = "CP · fila consolidada de 907 candidatos";
const scalar = async (sql: string, args: Array<string | number | null>) => Number((await client.execute({ sql, args })).rows[0]?.n || 0);
const opArgs = [organizationId, source];
const nestedArgs = [organizationId, organizationId, source];
const operations = await scalar("SELECT COUNT(*) n FROM operations WHERE organization_id=? AND source=? AND is_demo=0", opArgs);
const uniqueDepre = await scalar("SELECT COUNT(DISTINCT json_extract(workflow,'$.credit.numeroProcessoDEPRENormalizado')) n FROM operations WHERE organization_id=? AND source=? AND is_demo=0", opArgs);
const importRows = await scalar("SELECT COUNT(*) n FROM capture_import_rows WHERE organization_id=? AND operation_id IN (SELECT id FROM operations WHERE organization_id=? AND source=? AND is_demo=0)", nestedArgs);
const tasks = await scalar("SELECT COUNT(*) n FROM manual_research_tasks WHERE organization_id=? AND operation_id IN (SELECT id FROM operations WHERE organization_id=? AND source=? AND is_demo=0)", nestedArgs);
const evaluations = await scalar("SELECT COUNT(*) n FROM opportunity_evaluations WHERE organization_id=? AND operation_id IN (SELECT id FROM operations WHERE organization_id=? AND source=? AND is_demo=0)", nestedArgs);
const ready = await scalar("SELECT COUNT(*) n FROM opportunity_evaluations WHERE organization_id=? AND operation_id IN (SELECT id FROM operations WHERE organization_id=? AND source=? AND is_demo=0) AND ready_for_analyst=1", nestedArgs);
const verified = await scalar("SELECT COUNT(*) n FROM official_evidence_documents WHERE organization_id=? AND operation_id IN (SELECT id FROM operations WHERE organization_id=? AND source=? AND is_demo=0) AND status='VERIFIED' AND evidence_strength='STRONG'", nestedArgs);
const result = { operations, uniqueDepre, importRows, tasks, evaluations, ready, verified, pass: operations === 907 && uniqueDepre === 907 && importRows === 907 && tasks === 907 && evaluations === 907 && ready === 0 };
console.log(JSON.stringify(result, null, 2));
await client.close();
if (!result.pass) process.exitCode = 1;
