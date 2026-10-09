import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { verifyAuditChain } from "../src/lib/audit";

const expectedMigrations = ["001_crm_automation", "002_crm_automation_integrity", "003_crm_operation_tenant_guard", "004_relation_tenant_update_guards", "005_opportunity_evaluations", "006_manual_research_tasks", "007_manual_task_tenant_update_guard"];

const databaseUrl = requireExplicitDatabaseUrl();
if (!databaseUrl.startsWith("file:")) throw new Error("ISOLATED_BACKUP_REQUIRES_LOCAL_DATABASE");
const sourcePath = databaseUrl.slice("file:".length);
await access(sourcePath);

const directory = await mkdtemp(join(tmpdir(), "cp-backup-restore-"));
const backup = join(directory, "backup.db");
const restoredPath = join(directory, "restored.db");
const source = createClient({ url: databaseUrl });
let restored: Client | undefined;

async function fingerprint(client: Client) {
  const operations = await client.execute("SELECT id,organization_id,version,title,debtor,process,source,nominal,workflow,is_demo FROM operations ORDER BY id");
  const importedRows = await client.execute("SELECT organization_id,batch_id,operation_id,row_number,source_reference,raw_values_json,normalized_values_json FROM capture_import_rows ORDER BY organization_id,batch_id,row_number");
  return createHash("sha256").update(JSON.stringify({ operations: operations.rows, importedRows: importedRows.rows })).digest("hex");
}

async function summary(client: Client) {
  const counts = await client.execute(`SELECT
    (SELECT COUNT(*) FROM operations) operations,
    (SELECT COUNT(DISTINCT NULLIF(json_extract(workflow,'$.credit.numeroProcessoDEPRE'),'')) FROM operations) unique_depre,
    (SELECT COUNT(*) FROM capture_import_rows) imported_rows,
    (SELECT COUNT(*) FROM official_evidence_documents) evidence,
    (SELECT COUNT(*) FROM audit_logs) audits,
    (SELECT COUNT(*) FROM crm_records) crm_records,
    (SELECT COUNT(*) FROM crm_tasks) crm_tasks,
    (SELECT COUNT(*) FROM crm_activities) crm_activities,
    (SELECT COUNT(*) FROM automation_jobs) automation_jobs,
    (SELECT COUNT(*) FROM schema_migrations) migrations`);
  const entityCounts: Record<string, number> = {};
  for (const table of ["operation_documents", "manual_research_tasks", "opportunity_evaluations", "autonomous_acquisition_jobs", "ai_reconfirmation_runs"]) {
    const exists = await client.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", args: [table] });
    if (!exists.rows.length) continue;
    const count = await client.execute(`SELECT COUNT(*) AS total FROM ${table}`);
    entityCounts[table] = Number(count.rows[0]?.total || 0);
  }
  const tenants = await client.execute("SELECT organization_id,COUNT(*) operations FROM operations GROUP BY organization_id ORDER BY organization_id");
  const violations = await client.execute(`SELECT
    (SELECT COUNT(*) FROM official_evidence_documents d LEFT JOIN operations o ON o.id=d.operation_id AND o.organization_id=d.organization_id WHERE o.id IS NULL) orphan_evidence,
    (SELECT COUNT(*) FROM crm_records c LEFT JOIN operations o ON o.id=c.operation_id AND o.organization_id=c.organization_id WHERE o.id IS NULL) invalid_crm_operations,
    (SELECT COUNT(*) FROM crm_tasks t LEFT JOIN crm_records c ON c.id=t.crm_id AND c.organization_id=t.organization_id WHERE c.id IS NULL) orphan_crm_tasks,
    (SELECT COUNT(*) FROM crm_activities a LEFT JOIN crm_records c ON c.id=a.crm_id AND c.organization_id=a.organization_id WHERE c.id IS NULL) orphan_crm_activities,
    (SELECT COUNT(*) FROM automation_jobs j LEFT JOIN operations o ON o.id=j.target_id AND o.organization_id=j.organization_id WHERE j.target_type='operation' AND o.id IS NULL) invalid_operation_jobs`);
  const integrity = await client.execute("PRAGMA integrity_check");
  const migrationRows = await client.execute("SELECT version FROM schema_migrations ORDER BY version");
  const migrations = migrationRows.rows.map((row) => String((row as Record<string, unknown>).version));
  const auditTenants = await client.execute("SELECT DISTINCT organization_id FROM audit_logs ORDER BY organization_id");
  const auditChains = await Promise.all(auditTenants.rows.map(async (row) => ({
    organizationId: String((row as Record<string, unknown>).organization_id),
    valid: await verifyAuditChain(String((row as Record<string, unknown>).organization_id), client),
  })));
  return {
    counts: counts.rows[0],
    entityCounts,
    tenants: tenants.rows,
    violations: violations.rows[0],
    integrity: integrity.rows,
    migrations,
    auditChains,
  };
}

try {
  const sourceSummary = await summary(source);
  const sourceFingerprint = await fingerprint(source);
  await source.execute(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  await copyFile(backup, restoredPath);
  restored = createClient({ url: `file:${restoredPath}` });
  const restoredSummary = await summary(restored);
  const restoredFingerprint = await fingerprint(restored);
  const equivalent = JSON.stringify(sourceSummary) === JSON.stringify(restoredSummary)
    && sourceFingerprint === restoredFingerprint;
  if (!equivalent) throw new Error("BACKUP_RESTORE_MISMATCH");
  if (JSON.stringify(sourceSummary.integrity) !== JSON.stringify([{ integrity_check: "ok" }])) throw new Error("SOURCE_INTEGRITY_CHECK_FAILED");
  if (JSON.stringify(restoredSummary.integrity) !== JSON.stringify([{ integrity_check: "ok" }])) throw new Error("RESTORE_INTEGRITY_CHECK_FAILED");
  if (Object.values(sourceSummary.violations[0] as unknown as Record<string, number>).some(Number)) throw new Error("SOURCE_TENANT_INTEGRITY_FAILED");
  if (sourceSummary.auditChains.some((entry) => !entry.valid)) throw new Error("SOURCE_AUDIT_CHAIN_INVALID");
  if (process.argv.includes("--require-current-schema") && JSON.stringify(sourceSummary.migrations) !== JSON.stringify(expectedMigrations)) throw new Error("SCHEMA_MIGRATIONS_INCOMPLETE");
  console.log(JSON.stringify({ status: "PASS", equivalent, operationFingerprint: sourceFingerprint, source: sourceSummary, restored: restoredSummary }));
} finally {
  if (restored) await restored.close();
  await source.close();
  await rm(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 200 });
}
