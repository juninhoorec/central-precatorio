import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { runSourceAcquisitionJobOnce } from "../src/lib/automation-service";
const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const selected = [
  ["02fcb9ba-4e32-4a50-b999-c6de044320a5", "0149031-15.2024.8.26.0500", "São Paulo"],
  ["0b7595bf-7b90-49e3-9aa7-a08df9efcf3b", "0078231-59.2024.8.26.0500", "São Paulo"],
  ["15c336d1-809f-40b1-8c05-a389787f7435", "0234462-80.2025.8.26.0500", "São Paulo"],
  ["39e553b2-35ca-432b-a5e0-fc3beca68c42", "0066316-47.2023.8.26.0500", "São Paulo"],
  ["1475ea97-9217-44e0-9c0b-5c0f76e37307", "0246430-49.2021.8.26.0500", "Guarulhos"],
  ["14dcc002-cf54-428c-87ec-0f9063878ece", "0325500-18.2021.8.26.0500", "Guarulhos"],
  ["2442a714-8aa7-41f0-b1f9-2690acc44fb6", "0034190-80.2019.8.26.0500", "Guarulhos"],
  ["0e9d52b7-2eb3-4691-920e-2c46301ff317", "0065683-46.2017.8.26.0500", "Campinas"],
  ["120ca91d-ac87-47a9-83d6-765f56828680", "0165056-11.2021.8.26.0500", "Campinas"],
  ["13ebb355-9e14-48cf-bc4a-3f14a2471282", "7006578-24.2014.8.26.0500", "Campinas"],
] as const;
const before = await client.execute({ sql: "SELECT id,version,workflow FROM operations WHERE organization_id=? AND id IN (?,?,?,?,?,?,?,?,?,?)", args: [org, ...selected.map((item) => item[0])] });
const counts = await client.execute({ sql: "SELECT (SELECT count(*) FROM operations) operations,(SELECT count(DISTINCT json_extract(workflow,'$.credit.numeroProcessoDEPRE')) FROM operations WHERE json_extract(workflow,'$.credit.numeroProcessoDEPRE')<>'') depre,(SELECT count(*) FROM official_evidence_documents) evidence,(SELECT count(*) FROM automation_jobs) jobs,(SELECT count(*) FROM audit_logs) audits", args: [] });
console.log("PILOT_SELECTION", JSON.stringify(selected));
console.log("BASELINE", JSON.stringify({ rows: before.rows.length, counts: counts.rows[0] }));
const results = [];
for (const [operationId, depre, municipality] of selected) { const output = await runSourceAcquisitionJobOnce(org, operationId, client); results.push({ operationId, depre, municipality, status: output.result.status, sourceStatus: output.result.sourceResult?.status, candidates: output.result.candidates ?? 0, resolved: output.result.resolved?.length ?? 0, jobId: output.job.id, finalJobStatus: output.job.status }); }
const after = await client.execute({ sql: "SELECT id,version,workflow FROM operations WHERE organization_id=? AND id IN (?,?,?,?,?,?,?,?,?,?)", args: [org, ...selected.map((item) => item[0])] });
const countsAfter = await client.execute({ sql: "SELECT (SELECT count(*) FROM operations) operations,(SELECT count(DISTINCT json_extract(workflow,'$.credit.numeroProcessoDEPRE')) FROM operations WHERE json_extract(workflow,'$.credit.numeroProcessoDEPRE')<>'') depre,(SELECT count(*) FROM official_evidence_documents) evidence,(SELECT count(*) FROM automation_jobs) jobs,(SELECT count(*) FROM audit_logs) audits", args: [] });
console.log("RESULTS", JSON.stringify(results));
console.log("INTEGRITY", JSON.stringify({ versionsBefore: before.rows.map((row) => row.version), versionsAfter: after.rows.map((row) => row.version), countsAfter: countsAfter.rows[0] }));
