import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult } from "../src/lib/research-pipeline";
import { listOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { persistResolvedOfficialEvidence } from "../src/lib/evidence-persistence";
import { appendAudit } from "../src/lib/audit";

const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const cases = [
  { depre: "7007091-55.2015.8.26.0500", municipality: "Campinas", url: "https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/511454721404472145114514.pdf", date: "2023-04-14", ref: "PMC.2023.00018771-11; PMC.2023.00018774-64; PMC.2023.00018773-83; PMC.2023.00018777-15", entries: ["Claudia Poli de Almeida Barea Teixeira / Carlos Eduardo de Oliveira / PMC.2023.00018771-11", "Gabriela Barea Teixeira / Carlos Eduardo de Oliveira / PMC.2023.00018774-64", "Ivelise Poli Barea / Carlos Eduardo de Oliveira / PMC.2023.00018773-83", "Guilherme Barea Filho / Carlos Eduardo de Oliveira / PMC.2023.00018777-15"] },
  { depre: "0061620-12.2016.8.26.0500", municipality: "Campinas", url: "https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/511454721404472145114514.pdf", date: "2023-04-14", ref: "PMC.2023.00019963-91", entries: ["Vivian Cristina de Menezes Eugenio Dias / Ulysses A. Cunha Franco / PMC.2023.00019963-91"] },
  { depre: "0002075-74.2017.8.26.0500", municipality: "Guarulhos", url: "https://diariooficial.guarulhos.sp.gov.br/uploads/pdf/1325059861.pdf", date: "2024-07-26", ref: "Edital 002/2024-SF", entries: ["Elson de Souza Moura / CPF 108.665.608-31 / lista oficial de credores"] },
  { depre: "02588958-52.2020.8.26.0500", municipality: "Guarulhos", url: "https://diariooficial.guarulhos.sp.gov.br/uploads/pdf/181191508.pdf", date: "2024-07-26", ref: "Edital 002/2024-SF", entries: ["Styvenson Noboro Koga / CPF/CNPJ 078.296.538-52 / lista oficial de credores"] },
  { depre: "0513642-74.2019.8.26.0500", municipality: "Campinas", url: "https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/4444946.pdf", date: "2021-09-27", ref: "PMC.2021.00049793-06", entries: ["Sandra Mara Maschio / CPF 213.568.818-58 / Eneida Rute Manfredini Barbosa / PMC.2021.00049793-06"] },
] as const;

const placeholders = cases.map(() => "?").join(",");
const ops = await client.execute({ sql: `SELECT id, workflow FROM operations WHERE organization_id=? AND json_extract(workflow,'$.credit.numeroProcessoDEPRE') IN (${placeholders})`, args: [organizationId, ...cases.map(c => c.depre)] });
const ids = new Map<string, string>();
for (const row of ops.rows) { const r = row as Record<string, unknown>; const w = JSON.parse(String(r.workflow)) as { credit?: { numeroProcessoDEPRE?: string } }; if (w.credit?.numeroProcessoDEPRE) ids.set(w.credit.numeroProcessoDEPRE, String(r.id)); }
const results: unknown[] = [];
for (const item of cases) {
  const operationId = ids.get(item.depre);
  if (!operationId) { results.push({ ...item, result: "OPERATION_NOT_FOUND" }); continue; }
  const now = new Date().toISOString();
  const sourceResult: SourceAcquisitionResult = {
    provider: "ASSISTED_OFFICIAL_WEB", source: item.municipality === "Campinas" ? "Diário Oficial de Campinas" : "Diário Oficial de Guarulhos", sourceId: `${item.municipality.toLowerCase()}-diario-oficial`, route: "official-pdf-manual", requestedIdentifier: item.depre, normalizedIdentifier: item.depre.replace(/\D/g, ""), startedAt: now, completedAt: now, durationMs: 0, status: "SUCCESS", requestAttempted: true, httpStatus: 200, sourceUrl: item.url, officialSourceUrl: item.url, errorCode: null, errorMessage: null, rawPayload: { publicationDate: item.date, historicalEntries: item.entries }, metadata: { publicationDate: item.date, reference: item.ref, municipality: item.municipality }, documentaryCandidates: [{ documentType: "OFFICIAL_RECORD", documentIdentifier: item.ref, reference: item.ref, officialSourceUrl: item.url, title: `Diário Oficial de ${item.municipality} — registro DEPRE`, publishedAt: item.date, status: "COLLECTED", evidenceStrength: "MEDIUM", notes: "Documento oficial localizado por rota pública; não qualifica automaticamente DOCUMENTAÇÃO 2/2." }]
  };
  const existing = await listOfficialEvidence(operationId, organizationId, client);
  const resolved = resolveEvidenceCandidatesForAcquisition(sourceResult, existing);
  const saved = [] as unknown[];
  for (const candidate of resolved) saved.push(await persistResolvedOfficialEvidence(candidate, { organizationId, operationId, client }, existing));
  await appendAudit({ organizationId, actorUserId: "analyst:assisted-research", action: "DOCUMENT_MATCHED", entityType: "operation", entityId: operationId, previousStateSummary: {}, nextStateSummary: { depre: item.depre, publication: item.date, reference: item.ref, relationshipCount: item.entries.length }, metadata: { source: sourceResult.source, route: sourceResult.route, url: item.url, fieldLevelProvenance: true, documentaryQualification: false }, requestId: `next-five-official-${item.depre}-${item.ref}`, source: "NEXT_FIVE_OFFICIAL_RESEARCH" }, client);
  results.push({ depre: item.depre, municipality: item.municipality, url: item.url, reference: item.ref, entries: item.entries, resolution: saved.map((s) => (s as { status?: string }).status ?? "UNKNOWN") });
}
console.log(JSON.stringify({ cases: results }, null, 2));
