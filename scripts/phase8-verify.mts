import { createClient } from "@libsql/client";
import { getOperation, listOperations } from "../src/lib/operations";
import { listSourceBlockerEvents } from "../src/lib/acquisition-event-recorder";
import { extractKnownIdentifiersCompat } from "../src/lib/known-identifiers";
import { listOfficialEvidence, countVerifiedOfficialEvidence } from "../src/lib/autonomous-acquisition";
import { resolveEvidenceCandidatesForAcquisition } from "../src/lib/research-pipeline";
import { scoreOpportunity } from "../src/lib/opportunity-engine";

const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";

async function verify() {
  console.log("==================================================");
  console.log("PHASE 8 - VERIFICATION HARNESS (GAP-8-01, 8-02, 8-04)");
  console.log("==================================================");

  // 1. Get Pilot Operations
  const allOps = await listOperations(db, ORGANIZATION_ID);
  const pilotOps = allOps.filter((op) => !op.isDemo); // 73 cases
  const demoOps = allOps.filter((op) => op.isDemo);   // 1 demo

  // Get the 20 manual tasks generated in Phase 6/7
  const tasksResult = await db.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE organization_id = ?",
    args: [ORGANIZATION_ID]
  });
  const manualTasks = tasksResult.rows;
  
  // Pilot DEPREs are those that have manual tasks
  const pilotDepresWithTasks = [...new Set(manualTasks.map(t => String(t.depre)))];
  const pilotOperations = pilotOps.filter((op) => {
    const wf = op.workflow as Record<string, unknown> | null;
    const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
    const depre = typeof credit?.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : undefined;
    return depre !== undefined && pilotDepresWithTasks.includes(depre);
  });

  console.log(`Global Operations: ${allOps.length} (73 real, 1 demo expected)`);
  console.log(`Pilot Operations with Tasks: ${pilotOperations.length} expected 20`);
  console.log(`Manual Tasks: ${manualTasks.length} expected 20`);

  let count0 = 0, count1 = 0, count2 = 0;
  
  const matrix: Array<{
    depre: string | undefined;
    hasAcquisitionEvent: boolean;
    hasKnownIdentifiers: boolean;
    taskCount: number;
    docCount: number;
    verified2of2: number;
    evalStatus: string;
    blockers: unknown;
  }> = [];

  for (const op of pilotOperations) {
    const wf = op.workflow as Record<string, unknown> | null;
    const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
    const depre = typeof credit?.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : undefined;
    
    // Acquisition Events
    const events = await listSourceBlockerEvents(op.id, ORGANIZATION_ID, db);
    const hasEvents = events.length > 0;
    
    // Known Identifiers
    const identifiersRow = await db.execute({
      sql: "SELECT workflow FROM operations WHERE id=? AND organization_id=?",
      args: [op.id, ORGANIZATION_ID]
    });
    const rawWorkflow = identifiersRow.rows[0]?.workflow;
    const knownIds = extractKnownIdentifiersCompat(rawWorkflow);
    
    // Manual Tasks
    const opTasks = manualTasks.filter(t => t.operation_id === op.id);
    
    // Official Evidence (Resolvers, Qualification, 2/2)
    const docs = await listOfficialEvidence(op.id, ORGANIZATION_ID, db);
    const verifiedCount = countVerifiedOfficialEvidence(docs);
    
    if (verifiedCount === 0) count0++;
    else if (verifiedCount === 1) count1++;
    else if (verifiedCount >= 2) count2++;
    
    // Re-evaluation
    const evals = await db.execute({
      sql: "SELECT qualification_status, ready_for_analyst, blocker_codes FROM opportunity_evaluations WHERE operation_id = ? AND organization_id = ? ORDER BY evaluated_at DESC LIMIT 1",
      args: [op.id, ORGANIZATION_ID]
    });
    const lastEval = evals.rows[0];
    const evalStatus = typeof lastEval?.qualification_status === "string"
      ? lastEval.qualification_status
      : "NO_EVAL";

    matrix.push({
      depre,
      hasAcquisitionEvent: hasEvents,
      hasKnownIdentifiers: !!(knownIds.originProcessNumber || knownIds.epesNumber || knownIds.beneficiaryCandidateName),
      taskCount: opTasks.length,
      docCount: docs.length,
      verified2of2: verifiedCount,
      evalStatus,
      blockers: lastEval?.blocker_codes || "NONE"
    });
  }

  console.log("\n--- GAP-8-01: 20-CASE MATRIX ---");
  console.table(matrix);

  console.log("\n--- GAP-8-02: DOCUMENTAÇÃO 2/2 REAL RESULTS ---");
  console.log(`0/2: ${count0}`);
  console.log(`1/2: ${count1}`);
  console.log(`2/2: ${count2}`);

  // GAP-8-03: Full End-to-End Proof
  console.log("\n--- GAP-8-03: FULL END-TO-END PROOF ---");
  
  // Pick the first manual task
  const testTask = manualTasks[0];
  const testDepre = testTask.depre;
  const testOperationId = testTask.operation_id;

  console.log(`Simulating manual evidence submission for DEPRE: ${testDepre}`);
  
  const { submitManualEvidence } = await import("../src/lib/manual-research");
  
  try {
    const result = await submitManualEvidence({
      taskId: String(testTask.id),
      organizationId: ORGANIZATION_ID,
      actorUserId: "phase8-verification",
      source: "Manual Analyst",
      documentIdentifier: "DOC-E2E-TEST-001",
      documentDate: new Date().toISOString(),
      documentReference: "CERTIDAO_TESTE",
      officialUrl: "https://esaj.tjsp.jus.br/fake",
      operationId: String(testOperationId),
      depre: String(testDepre),
      evidenceNotes: "E2E Proof execution"
    }, db);

    console.log("Evidence Submission Result:", result.persistenceResults);
    console.log(`Qualifying Evidence Count: ${result.qualifyingEvidenceCount}`);
    console.log(`Evaluation ID triggered: ${result.evaluationId}`);

    // Verify evaluation updated
    const finalEvalRow = await db.execute({
      sql: "SELECT qualification_status, blocker_codes FROM opportunity_evaluations WHERE operation_id = ? ORDER BY evaluated_at DESC LIMIT 1",
      args: [testOperationId]
    });
    console.log("Final Evaluation Status:", finalEvalRow.rows[0]?.qualification_status);
  } catch (error) {
    console.error("E2E Test failed:", error);
  }

}

verify().catch(console.error);
