import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult } from "../src/lib/research-pipeline";
import { listOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { persistResolvedOfficialEvidence } from "../src/lib/evidence-persistence";
import { appendAudit } from "../src/lib/audit";

const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const pdf2021 = "https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/1882658638.pdf";
const pdf2023a = "https://portal-api.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/511454721404472145114514.pdf";
const pdf2023b = "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/561915106409510645619126.pdf";
const docs = [
  ["0038850-88.2017.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051374-90", "LÚCIA HELENA SILVEIRA DE FREITAS BLANDY / DANIEL KRAHEMBUHL WANDERLEY"],
  ["0038850-88.2017.8.26.0500", pdf2023a, "2023-04-14", "PMC.2023.00023499-09", "LUCIA HELENA SILVEIRA DE FREITAS BLANDY / DANIEL KRAHEMBUHL WANDERLEY"],
  ["0038851-73.2017.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051378-13", "JOSÉ ALCIDE PORTO ROSSI / DANIEL KRAHEMBUHL WANDERLEY / precatório integralmente pago"],
  ["0046135-30.2020.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051252-11", "BEATRIZ HELENA ASTOLFI / DANIEL KRAHEMBUHL WANDERLEY"],
  ["0061616-72.2016.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00050320-43", "MARIA DO CARMO SILVA FOCHI / ULYSSES ANILDO CUNHA FRANCO"],
  ["0061620-12.2016.8.26.0500", pdf2023a, "2023-04-14", "PMC.2023.00019963-91", "VIVIAN CRISTINA DE MENEZES EUGENIO DIAS / ULYSSES A. CUNHA FRANCO"],
  ["0061624-49.2016.8.26.0500", pdf2023a, "2023-04-14", "PUBLICAÇÃO OFICIAL — registro DEPRE 0061624-49.2016.8.26.0500", "Correspondência textual localizada na publicação oficial"],
  ["0065683-46.2017.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00073517-40; PMC.2023.00073514-05", "MARIA ESTER ROSA / MARTA DINIZ ROSA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165045-79.2021.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075714-30", "LUIZ CARLOS LIMA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165048-34.2021.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075725-92", "LUIZ CARLOS LIMA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165049-19.2021.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075695-32", "LUIZ CARLOS LIMA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165055-26.2021.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075716-00", "LUIZ CARLOS LIMA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165056-11.2021.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075698-85", "LUIZ CARLOS LIMA / FERNANDA C. NOGUEIRA RIZZIOLLI"],
  ["0165056-11.2021.8.26.0500", pdf2023a, "2023-04-14", "PUBLICAÇÃO OFICIAL — registro DEPRE 0165056-11.2021.8.26.0500", "Correspondência textual localizada em publicação oficial anterior"],
  ["0187219-48.2022.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075375-09", "PRECATÓRIOS DO BRASIL LTDA. / CAROLINE DOMINGUES"],
  ["0190358-13.2019.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051246-73", "CÉLIA BENEDITA GOMES CARNEIRO / FÁBIO IZIQUE CHEBABI"],
  ["0240468-16.2019.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00045554-41", "KAREN GONÇALVES / DANIELA GONÇALVES MENOSSI BAPTISTA"],
  ["0279214-11.2023.8.26.0500", pdf2023b, "2023-09-26", "PMC.2023.00075692-90", "VALTER ALVES DOS SANTOS / ANDRÉ LAUBENSTEIN PEREIRA"],
  ["0513631-45.2019.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051043-03", "JOSIANE APARECIDA FIDELIS DIAS / ENEIDA RUTE MANFREDINI BARBOSA"],
  ["0513642-74.2019.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00049793-06", "SANDRA MARA MASCHIO / ENEIDA RUTE MANFREDINI BARBOSA"],
  ["0513646-14.2019.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00049790-55", "EDMEIA FRANCISCA FIDELIS / ENEIDA RUTE MANFREDINI BARBOSA"],
  ["7005322-80.2013.8.26.0500", pdf2023a, "2023-04-14", "PUBLICAÇÃO OFICIAL — registro DEPRE 7005322-80.2013.8.26.0500", "REGINA CÉLIA DE FREITAS PEREIRA"],
  ["7007091-55.2015.8.26.0500", pdf2023a, "2023-04-14", "PMC.2023.00018771-11; PMC.2023.00018774-64", "CLÁUDIA POLI DE ALMEIDA BAREA TEIXEIRA; GABRIELA BAREA TEIXEIRA / CARLOS EDUARDO DE OLIVEIRA"],
  ["7008115-21.2015.8.26.0500", pdf2021, "2021-09-27", "PMC.2021.00051251-31", "JÚLIO CUOCO DE CAMARGO JUNIOR / ANTONIO CARLOS FELIPE MACHADO"],
] as const;

const placeholders = docs.map(() => "?").join(",");
const rows = await client.execute({ sql: `SELECT id,workflow FROM operations WHERE organization_id=? AND json_extract(workflow,'$.credit.numeroProcessoDEPRE') IN (${placeholders})`, args: [organizationId, ...docs.map(([depre]) => depre)] });
const ids = new Map<string, string>();
for (const row of rows.rows) { const r = row as Record<string, unknown>; const workflow = JSON.parse(String(r.workflow)) as { credit?: { numeroProcessoDEPRE?: string } }; if (workflow.credit?.numeroProcessoDEPRE) ids.set(workflow.credit.numeroProcessoDEPRE, String(r.id)); }
const result: unknown[] = [];
for (const [depre, url, date, reference, excerpt] of docs) {
  const operationId = ids.get(depre);
  if (!operationId) { result.push({ depre, status: "OPERATION_NOT_FOUND" }); continue; }
  const now = new Date().toISOString();
  const source: SourceAcquisitionResult = { provider: "ASSISTED_OFFICIAL_WEB", source: "Diário Oficial de Campinas", sourceId: "campinas-diario-oficial", route: "official-pdf-manual", requestedIdentifier: depre, normalizedIdentifier: depre.replace(/\D/g, ""), startedAt: now, completedAt: now, durationMs: 0, status: "SUCCESS", requestAttempted: true, httpStatus: 200, sourceUrl: url, officialSourceUrl: url, errorCode: null, errorMessage: null, rawPayload: { publicationDate: date, excerpt }, metadata: { publicationDate: date, reference }, documentaryCandidates: [{ documentType: "OFFICIAL_RECORD", documentIdentifier: reference, reference, officialSourceUrl: url, title: "Diário Oficial de Campinas — registro DEPRE", publishedAt: date, status: "COLLECTED", evidenceStrength: "MEDIUM", notes: "Correspondência oficial registrada; não qualifica automaticamente DOCUMENTAÇÃO 2/2." }] };
  const existing = await listOfficialEvidence(operationId, organizationId, client);
  const resolved = resolveEvidenceCandidatesForAcquisition(source, existing);
  const saved = [] as string[];
  for (const candidate of resolved) saved.push((await persistResolvedOfficialEvidence(candidate, { organizationId, operationId, client })).status);
  await appendAudit({ organizationId, actorUserId: "analyst:campinas-22-validation", action: "DOCUMENT_MATCHED", entityType: "operation", entityId: operationId, previousStateSummary: {}, nextStateSummary: { depre, publication: date, reference, evidenceStatus: "COLLECTED", documentaryQualification: false }, metadata: { source: "Diário Oficial de Campinas", officialUrl: url, reference, excerpt, noPromotion: true }, requestId: `campinas-22-${depre}-${reference}`, source: "CAMPINAS_22_DOCUMENT_VALIDATION" }, client);
  result.push({ depre, reference, status: saved.length ? saved : ["REUSED_OR_ALREADY_PRESENT"] });
}
console.log(JSON.stringify({ targetCount: new Set(docs.map(([depre]) => depre)).size, recordsProcessed: docs.length, result }, null, 2));
