import { createClient } from "@libsql/client";
import { runSourceAcquisitionJobOnce } from "../src/lib/automation-service";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const excluded = new Set([
  "0149031-15.2024.8.26.0500", "0078231-59.2024.8.26.0500", "0234462-80.2025.8.26.0500", "0066316-47.2023.8.26.0500",
  "0246430-49.2021.8.26.0500", "0325500-18.2021.8.26.0500", "0034190-80.2019.8.26.0500", "0065683-46.2017.8.26.0500",
  "0165056-11.2021.8.26.0500", "7006578-24.2014.8.26.0500",
]);

const q = await client.execute({ sql: "SELECT id, organization_id, version, is_demo, workflow, debtor FROM operations WHERE organization_id=? AND is_demo=0 ORDER BY id", args: [org] });
const rows = q.rows.map((r) => {
  const value = r as Record<string, unknown>;
  const workflow = JSON.parse(String(value.workflow)) as { credit?: { numeroProcessoDEPRE?: string; municipality?: string; titular?: string; valor?: number; dataBase?: string; processoOriginario?: string; advogado?: string; oab?: string } };
  return { id: String(value.id), version: Number(value.version), depre: workflow.credit?.numeroProcessoDEPRE ?? "", municipality: workflow.credit?.municipality ?? "", debtor: String(value.debtor ?? ""), credit: workflow.credit ?? {} };
}).filter((r) => r.depre && !excluded.has(r.depre) && /São Paulo|Guarulhos|Campinas/i.test(r.municipality));
const selected: typeof rows = [];
for (const municipality of ["São Paulo", "Guarulhos", "Campinas"]) selected.push(...rows.filter((r) => r.municipality === municipality).slice(0, 5));
const used = new Set(selected.map((r) => r.id));
for (const row of rows) { if (selected.length >= 25) break; if (!used.has(row.id)) { selected.push(row); used.add(row.id); } }
if (selected.length !== 25) throw new Error(`O2_SELECTION_REQUIRES_25_GOT_${selected.length}`);

const before = await client.execute("SELECT COUNT(*) operations, (SELECT COUNT(*) FROM official_evidence_documents) evidence, (SELECT COUNT(*) FROM automation_jobs) jobs, (SELECT COUNT(*) FROM audit_logs) audits FROM operations");
console.log(JSON.stringify({ phase: "O2", organizationId: org, route: "TJSP/e-SAJ", keyPresent: Boolean(process.env.CP_DATAJUD_API_KEY || process.env.DATAJUD_PUBLIC_API_KEY), selection: selected.map((r) => ({ id: r.id, depre: r.depre, municipality: r.municipality, debtor: r.debtor, version: r.version })), before: before.rows[0] }, null, 2));
const results: unknown[] = [];
for (const operation of selected) {
  const output = await runSourceAcquisitionJobOnce(org, operation.id, client, "esaj");
  results.push({ operationId: operation.id, depre: operation.depre, municipality: operation.municipality, jobId: output.job.id, jobStatus: output.job.status, sourceStatus: output.result.sourceResult?.status ?? null, candidates: output.result.candidates ?? 0, resolved: output.result.resolved?.length ?? 0, error: output.result.error ?? null });
  console.log(JSON.stringify(results.at(-1)));
}
const after = await client.execute("SELECT COUNT(*) operations, (SELECT COUNT(*) FROM official_evidence_documents) evidence, (SELECT COUNT(*) FROM automation_jobs) jobs, (SELECT COUNT(*) FROM audit_logs) audits FROM operations");
console.log(JSON.stringify({ after: after.rows[0], results }, null, 2));
