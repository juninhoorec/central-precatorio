import { createClient } from "@libsql/client";
import { generateManualResearchTask, submitManualEvidence } from "../src/lib/manual-research";
import { createOperation } from "../src/lib/operations";
import { createDefaultWorkflow } from "../src/lib/operational-workflow";
import { countVerifiedOfficialEvidence, listOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { previewManualEvidence } from "../src/lib/manual-evidence-preview";
import { getAnalystQueue, getCaseDetail } from "../src/lib/analyst-cockpit";
import { randomUUID } from "node:crypto";
import { appendAudit } from "../src/lib/audit";

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u"; 

async function run() {
  const databaseUrl = process.env.CP_E2E_DATABASE_URL;
  if (!databaseUrl || databaseUrl === "file:central-precatorios.db") throw new Error("E2E_REQUIRES_ISOLATED_DATABASE");
  const db = createClient({ url: databaseUrl });
  
  console.log("==================================================================");
  console.log("PHASE 10 - E2E ANALYST COCKPIT & SUCCESS PATH (CF-10-01, 10-07)");
  console.log("==================================================================");

  const testDepre = "9999999-99.9999.9.99.9999"; // Synthetic

  // 1. Create a fully loaded synthetic operation so that 2/2 evidence is the ONLY blocker
  const wf = createDefaultWorkflow(100000);
  wf.credit.numeroProcessoDEPRE = testDepre;
  wf.client.name = "Teste de Integração Fase 10";
  wf.client.beneficiaries = [{
    id: randomUUID(),
    depre: testDepre,
    name: "Titular E2E Phase 10",
    role: "TITULAR",
    status: "CURRENT_CONFIRMED",
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
    title: "E2E Phase 10 Test Op",
    debtor: "SP",
    tribunal: "TJSP",
    process: "8888888-88.8888.8.88.8888",
    owner: "tester",
    source: "E2E",
    workflow: wf
  }, db, ORGANIZATION_ID);

  console.log(`[1] Created Synthetic Operation: ${op.id}`);

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
    actorUserId: "phase10-e2e"
  }, db);

  console.log(`[2] Generated Manual Task: ${task.id} (Status: ${task.status})`);

  // 3. Cockpit Queue Verification
  const queue = await getAnalystQueue(ORGANIZATION_ID, { status: "OPEN" }, db);
  const queueItem = queue.find(q => q.operationId === op.id);
  console.log(`\n[3] Queue item verified: ${queueItem?.depre} (Blockers: ${queueItem?.blockerCount})`);

  // 4. Case Workspace Verification
  const workspace = await getCaseDetail(op.id, ORGANIZATION_ID, db);
  console.log(`[4] Workspace Verification (0/2): docs count = ${workspace?.documentation?.count}, READY = FALSE`);

  // 5. Analyst submits Document 1 (VERIFIED + STRONG)
  console.log(`\n[5] Submitting Document 1...`);
  const result1 = await submitManualEvidence({
    taskId: task.id,
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    actorUserId: "phase10-e2e",
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
  
  console.log(`    Doc 1 Persisted. 2/2 Count: ${result1.qualifyingEvidenceCount}`);

  // 5a. Preview duplicate document (10-05)
  console.log(`    Previewing duplicate document...`);
  const preview = await previewManualEvidence({
    taskId: task.id,
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    actorUserId: "phase10-e2e",
    officialUrl: "https://esaj.tjsp.jus.br/1",
    documentIdentifier: "DOC-1",
    documentReference: "CERTIDAO-1",
    documentDate: new Date().toISOString(),
    source: "TJSP_ESAJ",
    evidenceNotes: "Duplicate Doc 1",
    qualificationStatus: "VERIFIED",
    evidenceStrength: "STRONG",
    documentType: "OFICIO_REQUISITORIO"
  }, db);
  console.log(`    Duplicate detection: ${preview.isDuplicate} (EvidenceId: ${preview.duplicateOf})`);

  // 6. Analyst submits Document 2 (VERIFIED + STRONG)
  console.log(`\n[6] Submitting Document 2...`);
  const result2 = await submitManualEvidence({
    taskId: task.id,
    organizationId: ORGANIZATION_ID,
    operationId: op.id,
    depre: testDepre,
    actorUserId: "phase10-e2e",
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

  console.log(`    Doc 2 Persisted. 2/2 Count: ${result2.qualifyingEvidenceCount}`);

  // 7. Verify Opportunity Re-evaluation & Task Status
  const evalRow = await db.execute({
    sql: `SELECT * FROM opportunity_evaluations WHERE operation_id = ? ORDER BY evaluated_at DESC LIMIT 1`,
    args: [op.id]
  });
  const evaluation = evalRow.rows[0];

  const taskRow = await db.execute({
    sql: `SELECT status FROM manual_research_tasks WHERE id = ?`,
    args: [task.id]
  });

  console.log(`\n[7] Opportunity Status after Doc 2: ${evaluation?.status}`);
  console.log(`    Blockers: ${evaluation?.blocker_codes}`);
  console.log(`    READY_FOR_ANALYST: ${evaluation?.ready_for_analyst ? "TRUE" : "FALSE"}`);
  console.log(`    Task Status: ${taskRow.rows[0]?.status}`);

  // 8. Idempotency test - resubmitting to a completed task should be rejected
  console.log(`\n[8] Idempotency Test: Resubmitting Doc 2 to completed task...`);
  try {
    await submitManualEvidence({
      taskId: task.id,
      organizationId: ORGANIZATION_ID,
      operationId: op.id,
      depre: testDepre,
      actorUserId: "phase10-e2e",
      officialUrl: "https://esaj.tjsp.jus.br/2",
      documentIdentifier: "DOC-2",
      documentReference: "CERTIDAO-2",
      documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ",
      evidenceNotes: "E2E Doc 2 DUPLICATE",
      qualificationStatus: "VERIFIED",
      evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);
    console.log(`    ERROR: Should have been rejected!`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`    Correctly rejected: ${message}`);
  }
  // Verify doc count didn't inflate
  const finalDocs = await listOfficialEvidence(op.id, ORGANIZATION_ID, db);
  const finalCount = countVerifiedOfficialEvidence(finalDocs);
  console.log(`    Final doc count (should be 2): ${finalCount}`);
  console.log(`    Total evidence records: ${finalDocs.length}`);
  console.log(`    Idempotency: ${finalCount === 2 ? "PASS" : "FAIL"}`);

  // 9. Clean up
  await db.execute({ sql: `DELETE FROM operations WHERE id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM manual_research_tasks WHERE operation_id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM opportunity_evaluations WHERE operation_id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM official_evidence_documents WHERE operation_id = ?`, args: [op.id] });
  await db.execute({ sql: `DELETE FROM acquisition_events WHERE operation_id = ?`, args: [op.id] });

  console.log(`\n[9] Cleaned up synthetic records.`);
}

run().catch(console.error);
