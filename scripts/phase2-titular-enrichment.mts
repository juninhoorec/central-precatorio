import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { recordHistoricalBeneficiaryObservation, recordImportedBeneficiarySnapshot } from "../src/lib/beneficiary-enrichment";
import { listOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { persistResolvedOfficialEvidence } from "../src/lib/evidence-persistence";
import { resolveEvidenceCandidatesForAcquisition, type SourceAcquisitionResult } from "../src/lib/research-pipeline";
import { getOperation } from "../src/lib/operations";

const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
const apply = process.argv.includes("--apply");
const targets = [
  { id: "120ca91d-ac87-47a9-83d6-765f56828680", depre: "0165056-11.2021.8.26.0500" },
  { id: "2ade7ad1-a29d-4551-80ab-2ad59058136f", depre: "0061620-12.2016.8.26.0500" },
  { id: "2da66ef7-5c56-43a1-8eb8-f24ce10d98cd", depre: "0002075-74.2017.8.26.0500" },
  { id: "433c2565-d5d0-424a-b0e1-af7e1d3962b2", depre: "0038850-88.2017.8.26.0500" },
  { id: "d9f156b3-a743-4591-b0cf-d9626f87086f", depre: "0196151-64.2018.8.26.0500" },
  { id: "1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd", depre: "7007091-55.2015.8.26.0500" },
  { id: "33b49922-d550-4af5-ad9a-4f39b9fadf46", depre: "0513642-74.2019.8.26.0500" },
  { id: "0e9d52b7-2eb3-4691-920e-2c46301ff317", depre: "0065683-46.2017.8.26.0500" },
  { id: "ffcf4c72-faab-43fe-a288-2d7f06b41782", depre: "0500766-24.2018.8.26.0500" },
  { id: "861df0cb-05b6-4aa2-b081-d88a51f2219d", depre: "7007092-40.2015.8.26.0500" },
] as const;

const facts = [
  {
    operationId: "2da66ef7-5c56-43a1-8eb8-f24ce10d98cd", depre: "0002075-74.2017.8.26.0500",
    name: "Elson de Souza Moura", role: "CREDOR" as const, status: "HISTORICAL_CONFIRMED" as const,
    source: "Diário Oficial de Guarulhos", sourceId: "guarulhos-diario-oficial", sourceUrl: "https://www.guarulhos.sp.gov.br/diario-oficial/uploads/pdf/1325059861.pdf",
    provider: "OFFICIAL_PDF_FETCH", route: "pdfjs-exact-depre-scan", sourceStatus: "SUCCESS" as const, requestAttempted: true, httpStatus: 200,
    documentIdentifier: "Edital 002/2024-SF", reference: "Edital 002/2024-SF, p. 42; DEPRE exato; ordem cronológica 11/2018-alimentar; habilitação provisória",
    page: 42,
    evidenceReference: "Edital 002/2024-SF", lawyerName: "", lawyerOab: "", lawyerSource: "", lawyerSourceUrl: "", lawyerSourceStatus: "" as const,
    context: "Publicado como credor provisoriamente habilitado; confirma apenas a relação histórica/provisória, não a titularidade atual. CPF público foi minimizado e não copiado.",
    rawExcerpt: "p. 42: Elson de Souza Moura; DEPRE 0002075-74.2017.8.26.0500; ordem cronológica 11/2018-alimentar; homologado provisoriamente.",
  },
  {
    operationId: "433c2565-d5d0-424a-b0e1-af7e1d3962b2", depre: "0038850-88.2017.8.26.0500",
    name: "Lúcia Helena Silveira de Freitas Blandy", role: "TITULAR" as const, status: "HISTORICAL_CONFIRMED" as const,
    source: "Diário Oficial de Campinas", sourceId: "campinas-diario-oficial", sourceUrl: "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/4444946.pdf",
    provider: "OFFICIAL_PDF_FETCH", route: "official-publication-pdf", sourceStatus: "SUCCESS" as const, requestAttempted: true, httpStatus: 200,
    documentIdentifier: "PMC.2021.00051374-90", reference: "PMC.2021.00051374-90, p. 34; DEPRE 0038850-88.2017.8.26.0500; ordem 89/2020",
    page: 34,
    evidenceReference: "PMC.2021.00051374-90", lawyerName: "Daniel Krahembuhl Wanderley", lawyerOab: "307900/SP",
    lawyerSource: "Cadastro Nacional dos Advogados — OAB Nacional", lawyerSourceUrl: "https://cna.oab.org.br/", lawyerSourceStatus: "SUCCESS" as const,
    context: "Titular histórico listado em publicação oficial. Cadastro CNA retornou uma inscrição SP pelo nome completo; isso não confirma titularidade atual nem contato. OAB é dado profissional separado.",
    rawExcerpt: "p. 34: DEPRE 0038850-88.2017.8.26.0500; Lúcia Helena Silveira de Freitas Blandy; advogado Daniel Krahembuhl Wanderley; PMC.2021.00051374-90.",
  },
  {
    operationId: "433c2565-d5d0-424a-b0e1-af7e1d3962b2", depre: "0038850-88.2017.8.26.0500",
    name: "Nelson Barthelson", role: "TITULAR" as const, status: "HISTORICAL_CONFIRMED" as const,
    source: "Diário Oficial de Campinas", sourceId: "campinas-diario-oficial", sourceUrl: "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/4444946.pdf",
    provider: "OFFICIAL_PDF_FETCH", route: "official-publication-pdf", sourceStatus: "SUCCESS" as const, requestAttempted: true, httpStatus: 200,
    documentIdentifier: "PMC.2021.00051365-07", reference: "PMC.2021.00051365-07, p. 34; DEPRE 0038850-88.2017.8.26.0500; ordem 89/2020",
    page: 34,
    evidenceReference: "PMC.2021.00051365-07", lawyerName: "Daniel Krahembuhl Wanderley", lawyerOab: "307900/SP",
    lawyerSource: "Cadastro Nacional dos Advogados — OAB Nacional", lawyerSourceUrl: "https://cna.oab.org.br/", lawyerSourceStatus: "SUCCESS" as const,
    context: "Segundo titular histórico, preservado em observação separada; ambas as pessoas aparecem no mesmo DEPRE e no mesmo PDF. O mesmo documento não será contado duas vezes para 2/2.",
    rawExcerpt: "p. 34: DEPRE 0038850-88.2017.8.26.0500; Nelson Barthelson; advogado Daniel Krahembuhl Wanderley; PMC.2021.00051365-07.",
  },
  {
    operationId: "33b49922-d550-4af5-ad9a-4f39b9fadf46", depre: "0513642-74.2019.8.26.0500",
    name: "Sandra Mara Maschio", role: "TITULAR" as const, status: "HISTORICAL_CONFIRMED" as const,
    source: "Diário Oficial de Campinas", sourceId: "campinas-diario-oficial", sourceUrl: "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/4444946.pdf",
    provider: "OFFICIAL_PDF_FETCH", route: "official-publication-pdf", sourceStatus: "SUCCESS" as const, requestAttempted: true, httpStatus: 200,
    documentIdentifier: "PMC.2021.00049793-06", reference: "PMC.2021.00049793-06, p. 35; DEPRE 0513642-74.2019.8.26.0500; ordem 24/2021",
    page: 35,
    evidenceReference: "PMC.2021.00049793-06", lawyerName: "Eneida Rute Manfredini Barbosa", lawyerOab: "128909/SP",
    lawyerSource: "Cadastro Nacional dos Advogados — OAB Nacional", lawyerSourceUrl: "https://cna.oab.org.br/", lawyerSourceStatus: "SUCCESS" as const,
    context: "Titular histórico listado em publicação oficial. O CNA retornou uma inscrição SP pelo nome completo; não confirma titularidade atual nem contato.",
    rawExcerpt: "p. 35: DEPRE 0513642-74.2019.8.26.0500; Sandra Mara Maschio; advogado Eneida Rute Manfredini Barbosa; PMC.2021.00049793-06.",
  },
  {
    operationId: "d9f156b3-a743-4591-b0cf-d9626f87086f", depre: "0196151-64.2018.8.26.0500",
    name: "Fernando José dos Santos Oliveira", role: "TITULAR" as const, status: "DIVERGENT" as const,
    source: "Diário Oficial do Município de Campinas — Câmara de Conciliação de Precatórios", sourceId: "campinas-diario-oficial",
    sourceUrl: "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/561915106409510645619126.pdf",
    provider: "PERSISTED_CP_EVIDENCE", route: "preexisting-official-evidence", sourceStatus: "NOT_ATTEMPTED" as const, requestAttempted: false, httpStatus: null,
    documentIdentifier: "", reference: "p. 7; ordem cronológica 84/2019; DEPRE 0196151-64.2018.8.26.0500; SEI PMC.2023.00073678-24",
    page: 7,
    evidenceReference: "p. 7; ordem cronológica 84/2019; processo DEPRE 0196151-64.2018.8.26.0500; titular indicado no documento: Fernando José dos Santos Oliveira; advogado: Carlos Eduardo de Oliveira; SEI PMC.2023.00073678-24.",
    lawyerName: "Carlos Eduardo de Oliveira", lawyerOab: "", lawyerSource: "Cadastro Nacional dos Advogados — OAB Nacional",
    lawyerSourceUrl: "https://cna.oab.org.br/", lawyerSourceStatus: "MANUAL_REQUIRED" as const,
    context: "Documento oficial já estava persistido antes desta fase. O nome publicado diverge dos sete nomes do snapshot importado. Consulta CNA por nome excedeu 10 resultados; OAB não atribuída. Titular atual não confirmado.",
    rawExcerpt: "Documento preexistente, p. 7, DEPRE exato, ordem 84/2019, SEI PMC.2023.00073678-24; source PDF não foi rebaixado nem duplicado.",
  },
] as const;
const importedSnapshots = [
  {
    operationId: "0e9d52b7-2eb3-4691-920e-2c46301ff317", depre: "0065683-46.2017.8.26.0500",
    names: ["Maria Ester Rosa", "Marta Diniz Rosa"],
  },
  {
    operationId: "1a90d0ac-159e-4ec6-8c89-c96c95c8c1dd", depre: "7007091-55.2015.8.26.0500",
    names: ["Ivelise Poli Barea", "Guilherme Barea Filho", "Cláudia Poli de Almeida Barea Teixeira", "Gabriela Barea Teixeira"],
  },
  {
    operationId: "d9f156b3-a743-4591-b0cf-d9626f87086f", depre: "0196151-64.2018.8.26.0500",
    names: ["Hélio Patrício dos Santos", "Luciano Falleiros Nunes", "Luis Fernando Gomes Tojal Mattoso", "José Alexandre da Graça Bento", "Marcelo Yasuhiko Yaginuma", "Marlene Franco Mendes", "Paulo Corrêa Luiz Ferroz"],
  },
] as const;

const sourceByFact = new Map<string, SourceAcquisitionResult>();
for (const fact of facts) {
  if (fact.sourceStatus !== "SUCCESS") continue;
  const sourceResult: SourceAcquisitionResult = {
    provider: fact.provider,
    source: fact.source,
    sourceId: fact.sourceId,
    route: fact.route,
    requestedIdentifier: fact.depre,
    normalizedIdentifier: fact.depre.replace(/\D/g, ""),
    startedAt: null,
    completedAt: null,
    durationMs: null,
    status: "SUCCESS",
    requestAttempted: fact.requestAttempted,
    httpStatus: fact.httpStatus,
    sourceUrl: fact.sourceUrl,
    officialSourceUrl: fact.sourceUrl,
    errorCode: null,
    errorMessage: null,
    rawPayload: { exactDepreMatch: fact.depre, excerpt: fact.rawExcerpt },
    metadata: { reference: fact.evidenceReference, sourceStatus: fact.sourceStatus },
    documentaryCandidates: [{
      documentType: "OFFICIAL_RECORD",
      documentIdentifier: fact.documentIdentifier,
      reference: fact.evidenceReference,
      officialSourceUrl: fact.sourceUrl,
      title: fact.source,
      page: fact.page,
      status: "COLLECTED",
      evidenceStrength: "MEDIUM",
      notes: fact.context,
    }],
  };
  sourceByFact.set(`${fact.operationId}|${fact.reference}`, sourceResult);
}

const before = await client.execute(`SELECT
  (SELECT COUNT(*) FROM operations) operations,
  (SELECT COUNT(*) FROM official_evidence_documents) evidence,
  (SELECT COUNT(*) FROM audit_logs) auditEvents`);
const checkedTargets = [];
for (const target of targets) {
  const operation = await getOperation(target.id, client, organizationId);
  if (!operation || operation.isDemo || operation.workflow.credit.numeroProcessoDEPRE !== target.depre) {
    throw new Error(`PHASE2_TARGET_INTEGRITY_MISMATCH:${target.depre}`);
  }
  checkedTargets.push({ id: target.id, depre: target.depre, isDemo: operation.isDemo });
}
if (new Set(checkedTargets.map((item) => item.depre)).size !== 10) throw new Error("PHASE2_TARGETS_NOT_UNIQUE");
for (const snapshot of importedSnapshots) {
  const operation = await getOperation(snapshot.operationId, client, organizationId);
  const currentNames = operation?.workflow.client.name.split(";").map((name) => name.trim()).filter(Boolean) ?? [];
  if (!operation || operation.workflow.credit.numeroProcessoDEPRE !== snapshot.depre || JSON.stringify(currentNames) !== JSON.stringify(snapshot.names)) {
    throw new Error(`PHASE2_IMPORTED_SNAPSHOT_MISMATCH:${snapshot.depre}`);
  }
}

const evidenceResolutions = [];
const evidenceIdsByFact = new Map<string, string>();
for (const fact of facts) {
  const existing = await listOfficialEvidence(fact.operationId, organizationId, client);
  if (fact.sourceStatus === "NOT_ATTEMPTED") {
    const evidence = existing.find((document) => document.reference === fact.evidenceReference);
    if (!evidence || evidence.id !== "e18443ce-f203-4c36-8736-50ce43f28678") throw new Error(`PHASE2_PREEXISTING_EVIDENCE_MISMATCH:${fact.depre}`);
    evidenceIdsByFact.set(`${fact.operationId}|${fact.reference}`, evidence.id);
    evidenceResolutions.push({ depre: fact.depre, name: fact.name, evidenceId: evidence.id, resolutionReason: "PREEXISTING_PERSISTED_EVIDENCE", qualifies2of2: false, result: "REUSED" });
    continue;
  }
  const result = sourceByFact.get(`${fact.operationId}|${fact.reference}`)!;
  const resolved = resolveEvidenceCandidatesForAcquisition(result, existing);
  if (resolved.length !== 1 || resolved[0].qualifiesForDocumentation) {
    throw new Error(`PHASE2_EVIDENCE_RESOLUTION_UNSAFE:${fact.depre}:${fact.reference}:${resolved[0]?.resolutionReason}`);
  }
  if (!resolved[0].evidenceId && !apply) {
    evidenceResolutions.push({ depre: fact.depre, name: fact.name, evidenceId: null, resolutionReason: resolved[0].resolutionReason, qualifies2of2: false, result: "UNRESOLVED_CANDIDATE" });
    continue;
  }
  const persistence = await persistResolvedOfficialEvidence(resolved[0], { organizationId, operationId: fact.operationId, client }, existing);
  if (persistence.status !== "REUSED" && persistence.status !== "PERSISTED") throw new Error(`PHASE2_EVIDENCE_PERSISTENCE_FAILED:${fact.depre}:${fact.reference}:${persistence.status}`);
  evidenceIdsByFact.set(`${fact.operationId}|${fact.reference}`, persistence.evidence.id);
  evidenceResolutions.push({ depre: fact.depre, name: fact.name, evidenceId: persistence.evidence.id, resolutionReason: resolved[0].resolutionReason, qualifies2of2: resolved[0].qualifiesForDocumentation, result: persistence.status });
}

const mutations = [];
for (const fact of facts) {
  const evidenceId = evidenceIdsByFact.get(`${fact.operationId}|${fact.reference}`);
  if (!evidenceId) {
    if (apply) throw new Error(`PHASE2_EVIDENCE_ID_MISSING:${fact.depre}`);
    mutations.push({ depre: fact.depre, name: fact.name, status: "DRY_RUN_UNRESOLVED_CANDIDATE", evidenceId: "" });
    continue;
  }
  const existing = await listOfficialEvidence(fact.operationId, organizationId, client);
  const evidence = existing.find((item) => item.id === evidenceId)!;
  const input = {
    operationId: fact.operationId,
    organizationId,
    actorUserId: "analyst:phase2-titular-enrichment",
    depre: fact.depre,
    name: fact.name,
    role: fact.role,
    status: fact.status,
    source: fact.source,
    sourceUrl: fact.sourceUrl,
    sourceType: "OFFICIAL_PUBLICATION" as const,
    provider: fact.provider,
    sourceId: fact.sourceId,
    route: fact.route,
    sourceStatus: fact.sourceStatus,
    documentIdentifier: fact.documentIdentifier,
    reference: fact.reference,
    collectedAt: new Date().toISOString(),
    evidenceId,
    evidenceStrength: evidence.evidenceStrength,
    lawyerName: fact.lawyerName,
    lawyerOab: fact.lawyerOab,
    lawyerSource: fact.lawyerSource,
    lawyerSourceUrl: fact.lawyerSourceUrl,
    lawyerSourceStatus: fact.lawyerSourceStatus,
    context: fact.context,
  };
  if (apply) {
    mutations.push({ depre: fact.depre, name: fact.name, ...(await recordHistoricalBeneficiaryObservation(input, client)) });
  } else {
    mutations.push({ depre: fact.depre, name: fact.name, status: "DRY_RUN", evidenceId });
  }
}
for (const snapshot of importedSnapshots) {
  for (const name of snapshot.names) {
    const input = {
      operationId: snapshot.operationId,
      organizationId,
      actorUserId: "analyst:phase2-titular-enrichment",
      depre: snapshot.depre,
      name,
      role: "UNKNOWN" as const,
      status: "UNVERIFIED_IMPORT" as const,
      source: "CP_pacote_completo_73_DEPREs.xlsx",
      sourceUrl: "" as const,
      sourceType: "IMPORTED_SNAPSHOT" as const,
      provider: "CP_IMPORT",
      sourceId: "initial-depre-package-73",
      route: "xlsx-snapshot",
      sourceStatus: "NOT_ATTEMPTED" as const,
      documentIdentifier: "",
      reference: "CP_pacote_completo_73_DEPREs.xlsx; original client.name snapshot",
      collectedAt: new Date().toISOString(),
      evidenceId: "" as const,
      evidenceStrength: "" as const,
      lawyerName: "",
      lawyerOab: "",
      lawyerSource: "",
      lawyerSourceUrl: "",
      lawyerSourceStatus: "" as const,
      context: "Candidate copied from the original semicolon-delimited import. Role and current-holder identity are not verified; this is not official evidence.",
    };
    if (apply) mutations.push({ depre: snapshot.depre, name, ...(await recordImportedBeneficiarySnapshot(input, client)) });
    else mutations.push({ depre: snapshot.depre, name, status: "DRY_RUN_UNVERIFIED_IMPORT", evidenceId: "" });
  }
}
const after = await client.execute(`SELECT
  (SELECT COUNT(*) FROM operations) operations,
  (SELECT COUNT(*) FROM official_evidence_documents) evidence,
  (SELECT COUNT(*) FROM audit_logs) auditEvents`);
console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", targetCount: checkedTargets.length, checkedTargets, before: before.rows[0], after: after.rows[0], evidenceResolutions, observations: mutations }, null, 2));
await client.close();
