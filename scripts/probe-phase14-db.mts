import { createClient } from "@libsql/client";
import { verifyAuditChain } from "../src/lib/audit";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db" });
try {
  const auditTenants = await client.execute("SELECT organization_id, COUNT(*) AS audit_count FROM audit_logs GROUP BY organization_id ORDER BY organization_id");
  const chains = await Promise.all(auditTenants.rows.map(async (row) => ({
    auditCount: Number(row.audit_count),
    valid: await verifyAuditChain(String(row.organization_id), client),
  })));
  const migrations = await client.execute("SELECT version FROM schema_migrations ORDER BY version").catch(() => ({ rows: [] }));
  console.log(JSON.stringify({
    auditTenants: auditTenants.rows.length,
    auditChains: chains,
    migrations: migrations.rows.map(row => row.version),
  }));
} finally {
  await client.close();
}
