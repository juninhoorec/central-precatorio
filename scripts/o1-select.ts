import { createClient } from "@libsql/client";
void (async () => { const c = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const q = await c.execute("SELECT id,organization_id,version,is_demo,json_extract(workflow,'$.credit.numeroProcessoDEPRE') depre,json_extract(workflow,'$.credit.municipality') municipality,debtor FROM operations WHERE is_demo=0 AND json_extract(workflow,'$.credit.numeroProcessoDEPRE')<>'' ORDER BY id");
const rows = q.rows.map((r) => ({ id: r.id, org: r.organization_id, version: r.version, depre: r.depre, municipality: r.municipality, debtor: r.debtor }));
console.log(JSON.stringify(rows.filter((r) => /São Paulo|Guarulhos|Campinas/i.test(String(r.municipality))).slice(0, 50), null, 2));
console.log(JSON.stringify({ keyPresent: Boolean(process.env.CP_DATAJUD_API_KEY || process.env.DATAJUD_PUBLIC_API_KEY), authorized: process.env.DATAJUD_COMMERCIAL_USE_AUTHORIZED === "true" || process.env.CP_DATAJUD_RESEARCH_AUTHORIZED === "true" })); })();
