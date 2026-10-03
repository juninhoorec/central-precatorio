import { createClient, type Client } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const migrations = [
  { version: "001_crm_automation", path: "001_crm_automation.sql" },
  { version: "002_crm_automation_integrity", path: "002_crm_automation_integrity.sql" },
  { version: "003_crm_operation_tenant_guard", path: "003_crm_operation_tenant_guard.sql" },
  { version: "004_relation_tenant_update_guards", path: "004_relation_tenant_update_guards.sql" },
] as const;
const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../migrations");

function splitMigrationStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let inTrigger = false;
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!inTrigger && /^CREATE\s+TRIGGER\b/i.test(trimmed)) inTrigger = true;
    current += `${line}\n`;
    if (inTrigger ? /^END;\s*$/i.test(trimmed) : /;\s*$/.test(trimmed)) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      inTrigger = false;
    }
  }
  const remainder = current.trim();
  if (remainder) statements.push(remainder);
  return statements;
}

/**
 * Explicit migration entry point. Invoke from the deployment/migration command,
 * never from a normal request, worker, or CRM mutation.
 */
export async function applySchemaMigrations(client: Client = db) {
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const migration of migrations) {
    const applied = await client.execute({ sql: "SELECT version FROM schema_migrations WHERE version=?", args: [migration.version] });
    if (applied.rows.length) continue;
    const sql = await readFile(resolve(migrationsDirectory, migration.path), "utf8");
    await client.batch(splitMigrationStatements(sql), "write");
    await client.execute({ sql: "INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)", args: [migration.version, new Date().toISOString()] });
  }
  return (await client.execute("SELECT version,applied_at FROM schema_migrations ORDER BY version")).rows;
}

/** Read-only runtime guard: production traffic must use an already migrated schema. */
export async function assertSchemaMigrations(client: Client = db) {
  let rows: { version: unknown }[];
  try {
    rows = (await client.execute("SELECT version FROM schema_migrations")).rows as unknown as { version: unknown }[];
  } catch {
    throw new Error("SCHEMA_MIGRATIONS_REQUIRED");
  }
  const applied = new Set(rows.map((row) => String(row.version)));
  const missing = migrations.filter((migration) => !applied.has(migration.version)).map((migration) => migration.version);
  if (missing.length) throw new Error(`SCHEMA_MIGRATIONS_REQUIRED:${missing.join(",")}`);
  return migrations.map((migration) => migration.version);
}
