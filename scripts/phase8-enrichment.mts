import { createClient } from "@libsql/client";
import { getOperation, listOperations } from "../src/lib/operations";
import { enrichOpportunityFromEvidence } from "../src/lib/opportunity-enrichment";

const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const ACTOR_ID = "system:phase8";

async function runEnrichment() {
  console.log("==================================================");
  console.log("PHASE 8 - COMPLETE OPPORTUNITY ENRICHMENT");
  console.log("==================================================");

  // Get Pilot Operations (the 20 ones that have manual tasks)
  const allOps = await listOperations(db, ORGANIZATION_ID);
  
  const tasksResult = await db.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE organization_id = ?",
    args: [ORGANIZATION_ID]
  });
  const manualTasks = tasksResult.rows;
  
  const pilotDepresWithTasks = [...new Set(manualTasks.map(t => String(t.depre)))];
  const pilotOperations = allOps.filter(op => {
    const wf = op.workflow as any;
    return !op.isDemo && pilotDepresWithTasks.includes(wf.credit?.numeroProcessoDEPRE);
  });

  console.log(`Running enrichment on ${pilotOperations.length} pilot operations...`);
  
  const resultsMatrix: any[] = [];

  for (const op of pilotOperations) {
    try {
      const result = await enrichOpportunityFromEvidence(op.id, ORGANIZATION_ID, ACTOR_ID, db);
      const wf = op.workflow as any;

      resultsMatrix.push({
        DEPRE: result.depre,
        TITULAR: result.titularStatus,
        DEVEDOR: wf.credit?.debtorState || op.debtor || "UNKNOWN",
        VALUE: result.valueStatus,
        DATE_BASE: result.dateBaseStatus,
        PROCESS: result.processStatus,
        LAWYER_OAB: result.lawyerStatus,
        CONTACT: result.contactStatus,
        DOC_X_2: `${result.qualifyingEvidenceCount}/2`,
        COVERAGE: wf.queryStatus === "SUCCESS" || wf.documentStatus === "COMPLETE" ? "SUFFICIENT" : "INSUFFICIENT",
        BLOCKERS: result.blockers.length,
        READY: result.readyForAnalyst
      });
    } catch (e: any) {
      console.error(`Error enriching operation ${op.id}:`, e.message);
    }
  }

  console.log("\n--- GAP-8-01 / ENRICHMENT MATRIX ---");
  console.table(resultsMatrix);

}

runEnrichment().catch(console.error);
