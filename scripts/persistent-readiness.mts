import { access } from "node:fs/promises";
import { createClient } from "@libsql/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED_FOR_PERSISTENT_READINESS");
if (databaseUrl === "file:central-precatorios.db") throw new Error("AUTHORIZED_PERSISTENT_TARGET_REQUIRED");
if (databaseUrl.startsWith("file:")) await access(databaseUrl.slice("file:".length));

const client = createClient({ url: databaseUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
try {
  const integrity = await client.execute("PRAGMA integrity_check");
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const migrations = await client.execute("SELECT version FROM schema_migrations ORDER BY version");
  const counts = await client.execute(`SELECT
    (SELECT COUNT(*) FROM operations) operations,
    (SELECT COUNT(*) FROM capture_import_rows) imported_rows,
    (SELECT COUNT(*) FROM official_evidence_documents) evidence,
    (SELECT COUNT(*) FROM audit_logs) audits`);
  const requiredTables = ["operations", "capture_import_rows", "official_evidence_documents", "audit_logs", "schema_migrations"];
  const availableTables = new Set(tables.rows.map(row => String(row.name)));
  const missingTables = requiredTables.filter(table => !availableTables.has(table));
  const applied = new Set(migrations.rows.map(row => String(row.version)));
  const missingMigrations = ["001_crm_automation", "002_crm_automation_integrity", "003_crm_operation_tenant_guard", "004_relation_tenant_update_guards", "005_opportunity_evaluations", "006_manual_research_tasks", "007_manual_task_tenant_update_guard"].filter(version => !applied.has(version));
  console.log(JSON.stringify({ status: missingTables.length || missingMigrations.length || integrity.rows[0]?.integrity_check !== "ok" ? "BLOCKED" : "READY_FOR_PERSISTENT_VALIDATION", databaseKind: databaseUrl.startsWith("file:") ? "sqlite-file" : "libsql-remote", integrity: integrity.rows, missingTables, missingMigrations, counts: counts.rows }, null, 2));
} finally { await client.close(); }
