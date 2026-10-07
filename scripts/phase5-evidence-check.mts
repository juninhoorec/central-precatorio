import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";

const dups = await client.execute({
  sql: "SELECT hash, COUNT(*) c FROM official_evidence_documents WHERE organization_id=? GROUP BY hash HAVING c > 1",
  args: [org],
});
console.log("DUPLICATE HASH GROUPS:", JSON.stringify(dups.rows, null, 2));

const allEv = await client.execute({
  sql: "SELECT id, operation_id, hash, document_identifier, reference, source, status, evidence_strength FROM official_evidence_documents WHERE organization_id=? ORDER BY hash",
  args: [org],
});
console.log("ALL EVIDENCE:", JSON.stringify(allEv.rows, null, 2));

await client.close();
