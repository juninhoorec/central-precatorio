import nextEnv from "@next/env";
import { createClient, type Client, type InArgs, type InStatement } from "@libsql/client";
import { createHash } from "node:crypto";
import { requireExplicitDatabaseUrl } from "./database-target.mjs";

nextEnv.loadEnvConfig(process.cwd());

const sourcePath = "evidence/audit-recovery-20261009/pre-production-backup-20261009.db";
if (!process.argv.includes("--apply")) throw new Error("IMPORT_REQUIRES_EXPLICIT_APPLY");
const databaseUrl = requireExplicitDatabaseUrl();
if (databaseUrl.startsWith("file:")) throw new Error("IMPORT_REQUIRES_REMOTE_TARGET");

const source = createClient({ url: `file:${sourcePath}` });
const target = createClient({ url: databaseUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
const q = async (client: Client, sql: string, args: InArgs = []) => (await client.execute({ sql, args })).rows;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const canonical = (value: unknown): unknown => value instanceof Uint8Array ? `bytes:${Buffer.from(value).toString("base64")}` : value;
const fingerprint = (rows: unknown[]) => {
  const normalized = rows
    .map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, canonical(value)])))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

try {
  const targetTables = await q(target, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const targetTableNames = new Set(targetTables.map((row) => String(row.name)));
  const sourceTables = await q(source, "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('schema_migrations','cp_migrations') ORDER BY name");
  const sourceTableNames = sourceTables.map((row) => String(row.name));
  for (const row of sourceTables) {
    const table = String(row.name);
    if (targetTableNames.has(table)) {
      const sourceColumns = await q(source, `PRAGMA table_info(${quote(table)})`);
      const targetColumns = await q(target, `PRAGMA table_info(${quote(table)})`);
      const sourceShape = sourceColumns.map((x) => `${x.name}:${x.type}:${x.notnull}:${x.pk}`).sort().join("|");
      const targetShape = targetColumns.map((x) => `${x.name}:${x.type}:${x.notnull}:${x.pk}`).sort().join("|");
      if (sourceShape !== targetShape) throw new Error(`IMPORT_SCHEMA_MISMATCH:${table}`);
    } else {
      await target.execute(String(row.sql));
    }
  }

  const sourceObjects = await q(source, "SELECT name, type, sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type,name");
  const targetObjects = await q(target, "SELECT name FROM sqlite_master WHERE type IN ('index','trigger')");
  const targetObjectNames = new Set(targetObjects.map((row) => String(row.name)));
  for (const row of sourceObjects) {
    const name = String(row.name);
    if (name.startsWith("sqlite_autoindex_") || targetObjectNames.has(name)) continue;
    await target.execute(String(row.sql));
  }

  await target.execute("PRAGMA defer_foreign_keys=ON");
  const dependencies = new Map<string, Set<string>>();
  for (const table of sourceTableNames) {
    const foreignKeys = await q(source, `PRAGMA foreign_key_list(${quote(table)})`);
    const parents = new Set(foreignKeys.map((row) => String(row.table)).filter((parent) => parent !== table && sourceTableNames.includes(parent)));
    for (const [child, parent] of [["automation_jobs", "operations"], ["crm_records", "operations"], ["crm_tasks", "crm_records"], ["crm_activities", "crm_records"], ["crm_stage_history", "crm_records"], ["opportunity_evaluations", "operations"], ["manual_research_tasks", "operations"], ["operation_documents", "operations"]] as const) {
      if (table === child && sourceTableNames.includes(parent)) parents.add(parent);
    }
    dependencies.set(table, parents);
  }
  const orderedTables: string[] = [];
  const dependencyRemaining = new Set(sourceTableNames);
  while (dependencyRemaining.size) {
    const ready = [...dependencyRemaining].filter((table) => [...(dependencies.get(table) ?? new Set())].every((parent) => !dependencyRemaining.has(parent)));
    if (!ready.length) throw new Error(`IMPORT_SCHEMA_DEPENDENCY_CYCLE:${[...dependencyRemaining].join(",")}`);
    for (const table of ready) { orderedTables.push(table); dependencyRemaining.delete(table); }
  }
  const imported: Record<string, number> = {};
  for (const table of orderedTables) {
    const columns = (await q(source, `PRAGMA table_info(${quote(table)})`)).map((row) => String(row.name));
    const rows = await q(source, `SELECT * FROM ${quote(table)}`);
    imported[table] = rows.length;
    const existingCount = Number((await q(target, `SELECT COUNT(*) AS n FROM ${quote(table)}`))[0]?.n ?? 0);
    if (existingCount > 0) {
      if (existingCount !== rows.length) throw new Error(`IMPORT_PARTIAL_TABLE_MISMATCH:${table}`);
      const existingRows = await q(target, `SELECT * FROM ${quote(table)}`);
      if (fingerprint(existingRows) !== fingerprint(rows)) throw new Error(`IMPORT_EXISTING_DATA_MISMATCH:${table}`);
      continue;
    }
    const columnSql = columns.map(quote).join(",");
    const valueSql = `(${columns.map(() => "?").join(",")})`;
    for (let offset = 0; offset < rows.length; offset += 100) {
      const statements: InStatement[] = rows.slice(offset, offset + 100).map((row) => ({
        sql: `INSERT INTO ${quote(table)} (${columnSql}) VALUES ${valueSql}`,
        args: columns.map((column) => (row as Record<string, unknown>)[column]) as InArgs,
      }));
      if (statements.length) await target.batch(statements, "write");
    }
  }

  const remaining = await q(target, "SELECT (SELECT COUNT(*) FROM operations) operations,(SELECT COUNT(*) FROM capture_import_rows) imported_rows,(SELECT COUNT(*) FROM official_evidence_documents) evidence,(SELECT COUNT(*) FROM audit_logs) audits");
  const integrity = await q(target, "PRAGMA integrity_check");
  console.log(JSON.stringify({ status: "PASS", sourcePath, tables: sourceTableNames.length, imported, counts: remaining[0], integrity }, null, 2));
} finally {
  source.close();
  target.close();
}
