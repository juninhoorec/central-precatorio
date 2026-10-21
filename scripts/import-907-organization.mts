import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@libsql/client";

const organizationId = process.argv[2];
if (!organizationId) throw new Error("ORGANIZATION_ID_REQUIRED");
const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url || !authToken) throw new Error("REMOTE_DATABASE_REQUIRED");
const source = JSON.parse(fs.readFileSync("data/queue-907-consolidated-final.json", "utf8")) as Array<Record<string, unknown>>;
const client = createClient({ url, authToken });
const now = new Date().toISOString();
const batch = source.map((item) => {
  const id = crypto.randomUUID();
  const value = Number(item.valor ?? 0);
  const workflow = {
    inventory: { origin: "OTHER", availability: "AVAILABLE", aiValidation: "PENDING", aiConfidence: null, divergenceAlert: "" },
    stage: "NEW", priority: Number(item.prioridade ?? 0) >= 70 ? "HIGH" : "MEDIUM", confidence: 0,
    client: { name: String(item.titular ?? ""), document: String(item.cpfCnpj ?? ""), phone: "", email: "", beneficiaries: [] },
    credit: {
      precatoryNumber: String(item.depre ?? ""), numeroProcessoDEPRE: String(item.depre ?? ""), numeroProcessoDEPRENormalizado: String(item.depre ?? "").replace(/\D/g, ""),
      paymentOrderNumber: "", nature: String(item.natureza ?? ""), grossAmount: value, availableEstimate: value, creditType: "PRECATORY",
      municipality: String(item.municipio ?? ""), issuingCourt: "TJSP", debtorState: "SP", sourceUrl: "", sourceName: "CP · fila DEPRE consolidada",
      checkedAt: "", valueDate: "", legalRepName: String(item.advogadoNome ?? ""), legalRepOab: String(item.advogadoOab ?? ""), contactSource: "", contactCheckedAt: "",
      precatoryYear: "", epesNumber: "", epesYear: "", principalRequisitionOfficeNumber: "", requisitionOfficeDate: "", originProcessNumber: String(item.processoOrigem ?? ""), requisitionProcessNumber: "", chronologicalOrderNumber: "", depreReference: String(item.depre ?? ""), depreReferenceSource: "fila-907",
      qualityOffices: [{ id: crypto.randomUUID(), label: "Ofício 1", category: "OFICIO_EMPRESA", requiredForQualification: true, status: "PENDENTE" }, { id: crypto.randomUUID(), label: "Ofício 2", category: "OFICIO_ORIGEM", requiredForQualification: true, status: "PENDENTE" }],
    }, evidence: [], legalReviews: [], pricingScenarios: [], negotiations: [], monitoring: [], queryStatus: "NOT_STARTED", documentStatus: "MISSING", legalStatus: "NOT_STARTED", sessionNotes: [],
  };
  return { sql: `INSERT OR REPLACE INTO operations (id,version,title,debtor,tribunal,process,owner,source,stage,nominal,notes,tasks,checks,proposals,history,workflow,is_demo,created_at,updated_at,organization_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, 1, `Dossiê DEPRE ${String(item.depre ?? "")}`, String(item.devedor ?? ""), "TJSP", String(item.processoOrigem ?? ""), "", "CP · fila DEPRE consolidada", "Entrada", value, "", "[]", "[]", "[]", JSON.stringify([{ at: now, text: "Dossiê importado da fila DEPRE consolidada para a organização operacional." }]), JSON.stringify(workflow), 0, now, now, organizationId] };
});
for (let i = 0; i < batch.length; i += 100) await client.batch(batch.slice(i, i + 100), "write");
console.log(JSON.stringify({ imported: batch.length, organizationId }));
await client.close();
