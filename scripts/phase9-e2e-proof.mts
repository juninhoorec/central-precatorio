import { createClient } from "@libsql/client";
import { generateManualResearchTask, submitManualEvidence } from "../src/lib/manual-research";
import { createOperation } from "../src/lib/operations";
import { createDefaultWorkflow } from "../src/lib/operational-workflow";
import { countVerifiedOfficialEvidence, listOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { randomUUID } from "node:crypto";

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u"; 

async function run() {
  const databaseUrl = process.env.CP_E2E_DATABASE_URL;
  if (!databaseUrl || databaseUrl === "file:central-precatorios.db") throw new Error("E2E_REQUIRES_ISOLATED_DATABASE");
  const db = createClient({ url: databaseUrl });
  
  console.log("==================================================================");
  console.log("PHASE 9 - ANALYST EVIDENCE INGESTION E2E PROOF");
  console.log("==================================================================");

  const testDepre = "9999999-99.9999.9.99.9999"; // Synthetic

  // 1. Create a fully loaded synthetic operation so that 2/2 evidence is the ONLY blocker
  const wf = createDefaultWorkflow(100000);
  wf.credit.numeroProcessoDEPRE = testDepre;
  wf.client.name = "Teste de Integração Fase 9";
  wf.client.beneficiaries = [{
    id: randomUUID(),
    depre: testDepre,
    name: "Titular E2E Test",
    role: "TITULAR",
    status: "CURRENT_CONFIRMED", // Pre-confirmed to bypass identity blocker
    source: "e2e",
    sourceUrl: "https://tjsp.jus.br",
    sourceType: "OFFICIAL_PUBLICATION",
    provider: "e2e",
    sourceId: "s1",
    route: "route",
    sourceStatus: "SUCCESS",
    documentIdentifier: "",
    reference: "",
    collectedAt: new Date().toISOString(),
    evidenceId: "",
    evidenceStrength: "",
    lawyerName: "",
    lawyerOab: "",
    lawyerSource: "",
    lawyerSourceUrl: "",
    lawyerSourceStatus: "",
    context: "",
  }];
  wf.credit.originProcessNumber = "8888888-88.8888.8.88.8888";
  wf.credit.legalRepName = "Dr. Advogado E2E";
  wf.credit.legalRepOab = "SP999999";
  wf.credit.valueDate = "2024-01-01";
  wf.client.phone = "(11) 99999-9999";
  wf.documentStatus = "READY";

  const op = await createOperation({
    title: "E2E Phase 9 Test Op",
    debtor: "SP",
    tribunal: "TJSP",
    process: "8888888-88.8888.8.88.8888",
    owner: "tester",
    source: "E2E",
    workflow: wf
  }, db, ORGANIZATION_ID);

  console.log(`Created Synthetic Operation: ${op.id}`);

  // 2. Generate Analyst Task (simulate automated blocker)
  const { task } = await generateManualResearchTask({
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    source: "TJSP_ESAJ",
    sourceId: "src-1",
    route: "cpopg",
    blockerType: "CAPTCHA_REQUIRED",
    sourceResult: "CAPTCHA_REQUIRED",
    blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], // Force this blocker
    actorUserId: "phase9-e2e"
  }, db);

  console.log(`Generated Manual Task: ${task.id} (Status: ${task.status})`);

  // 3. Analyst submits Document 1 (VERIFIED + STRONG)
  console.log(`\nSubmitting Document 1...`);
  const result1 = await submitManualEvidence({
    taskId: task.id,
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    actorUserId: "phase9-e2e",
    officialUrl: "https://esaj.tjsp.jus.br/1",
    documentIdentifier: "DOC-1",
    documentReference: "CERTIDAO-1",
    documentDate: new Date().toISOString(),
    source: "TJSP_ESAJ",
    evidenceNotes: "E2E Doc 1",
    qualificationStatus: "VERIFIED",
    evidenceStrength: "STRONG",
    documentType: "OFICIO_REQUISITORIO"
  }, db);
  
  console.log(`Doc 1 Results -> Persisted: ${result1.persistenceResults.map(r=>r.status)}, 2/2 Count: ${result1.qualifyingEvidenceCount}`);

  // 4. Analyst submits Document 2 (VERIFIED + STRONG)
  console.log(`\nSubmitting Document 2...`);
  const result2 = await submitManualEvidence({
    taskId: task.id,
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    actorUserId: "phase9-e2e",
    officialUrl: "https://esaj.tjsp.jus.br/2",
    documentIdentifier: "DOC-2",
    documentReference: "CERTIDAO-2",
    documentDate: new Date().toISOString(),
    source: "TJSP_ESAJ",
    evidenceNotes: "E2E Doc 2",
    qualificationStatus: "VERIFIED",
    evidenceStrength: "STRONG",
    documentType: "OFICIO_REQUISITORIO"
  }, db);

  console.log(`Doc 2 Results -> Persisted: ${result2.persistenceResults.map(r=>r.status)}, 2/2 Count: ${result2.qualifyingEvidenceCount}`);

  // 5. Verify Opportunity Re-evaluation
  const evalRow = await db.execute({
    sql: `SELECT * FROM opportunity_evaluations WHERE operation_id = ? ORDER BY evaluated_at DESC LIMIT 1`,
    args: [op.id]
  });
  const evaluation = evalRow.rows[0];

  console.log(`\nOpportunity Status after Doc 2: ${evaluation?.status}`);
  console.log(`Blockers: ${evaluation?.blocker_codes}`);
  console.log(`READY_FOR_ANALYST: ${evaluation?.ready_for_analyst ? "TRUE" : "FALSE"}`);

  // 6. Clean up
  await db.execute({ sql: `DELETE FROM operations WHERE id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM manual_research_tasks WHERE operation_id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM opportunity_evaluations WHERE operation_id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM official_evidence_documents WHERE operation_id = ?`, args: [op.id] });
  console.log(`\nCleaned up synthetic records.`);
}

run().catch(console.error);
